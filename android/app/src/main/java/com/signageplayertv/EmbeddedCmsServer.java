package com.signageplayertv;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.AssetManager;
import android.net.Uri;
import android.webkit.MimeTypeMap;

import androidx.core.content.FileProvider;

import fi.iki.elonen.NanoHTTPD;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public final class EmbeddedCmsServer extends NanoHTTPD {
    private static final String CONFIG_FILE_NAME = "config.json";
    private static final String MEDIA_ROOT_DIR = "cms-media";
    private static final String APP_UPDATE_FILE_NAME = "NVA-SignagePlayerTV-update.apk";
    private static final String KIOSK_PREFS_NAME = "kiosk_prefs";
    private static final String KEY_AUTO_REOPEN_ENABLED = "auto_reopen_enabled";
    private static final String KEY_VIDEO_CACHE_MAX_BYTES = "video_cache_max_bytes";

    private final Context context;
    private final AssetManager assetManager;

    public EmbeddedCmsServer(Context context, int port) {
        super("0.0.0.0", port);
        this.context = context.getApplicationContext();
        this.assetManager = this.context.getAssets();
    }

    @Override
    public Response serve(IHTTPSession session) {
        try {
            if (Method.OPTIONS.equals(session.getMethod())) {
                return withCors(newFixedLengthResponse(Response.Status.OK, "text/plain", ""));
            }

            String uri = session.getUri();
            if (uri == null || uri.isEmpty() || "/".equals(uri)) {
                return serveAsset("cms/index.html", "text/html; charset=utf-8");
            }
            if ("/style.css".equals(uri)) {
                return serveAsset("cms/style.css", "text/css; charset=utf-8");
            }
            if ("/app.js".equals(uri)) {
                return serveAsset("cms/app.js", "application/javascript; charset=utf-8");
            }
            if ("/app-v2.js".equals(uri)) {
                return serveAsset("cms/app-v2.js", "application/javascript; charset=utf-8");
            }
            if ("/nvlogo.png".equals(uri)) {
                return serveAsset("cms/nvlogo.png", "image/png");
            }
            if ("/ping".equals(uri)) {
                JSONObject payload = new JSONObject();
                payload.put("ok", true);
                payload.put("time", System.currentTimeMillis());
                return json(payload);
            }
            if ("/status".equals(uri)) {
                return json(EmbeddedCmsRuntime.buildSelfStatus(context));
            }
            if ("/devices".equals(uri)) {
                return json(EmbeddedCmsRuntime.getDevicesJson(context));
            }
            if ("/device-status".equals(uri)) {
                return json(EmbeddedCmsRuntime.getDevicesJson(context));
            }
            if ("/config".equals(uri)) {
                if (Method.GET.equals(session.getMethod())) {
                    return json(readConfig());
                }
                if (Method.POST.equals(session.getMethod())) {
                    try {
                        JSONObject body = readJsonBody(session);
                        JSONObject config = extractConfigPayload(body);
                        if (body.has("deviceName")) {
                            EmbeddedCmsRuntime.setDeviceName(context, body.optString("deviceName", ""));
                        }
                        if (config != null && config.length() > 0) {
                            JSONObject merged = mergeJson(readConfig(), config);
                            writeConfig(merged);
                            applyConfigSideEffects(merged);
                        }
                        EmbeddedCmsRuntime.emitEvent("config-updated", EmbeddedCmsRuntime.buildSelfStatus(context));
                        JSONObject payload = new JSONObject();
                        payload.put("success", true);
                        payload.put("config", readConfig());
                        return json(payload);
                    } catch (Exception e) {
                        return errorJson(Response.Status.INTERNAL_ERROR, "config-save-failed", e);
                    }
                }
            }
            if ("/config/clear-cache".equals(uri) && Method.POST.equals(session.getMethod())) {
                return handleClearCache();
            }
            if ("/config/clear-device".equals(uri) && Method.POST.equals(session.getMethod())) {
                return handleClearDevice();
            }
            if ("/config/restart-device".equals(uri) && Method.POST.equals(session.getMethod())) {
                return handleRestartDevice();
            }
            if ("/config/auto-reopen".equals(uri) && Method.POST.equals(session.getMethod())) {
                return handleAutoReopen(session);
            }
            if ("/config/upload-app-update".equals(uri) && Method.POST.equals(session.getMethod())) {
                return handleAppUpdateUpload(session);
            }
            if ("/config/install-app-update".equals(uri) && Method.POST.equals(session.getMethod())) {
                return handleInstallAppUpdate(session);
            }
            if ("/media-list".equals(uri)) {
                return json(buildMediaList());
            }
            if ("/app-update.apk".equals(uri)) {
                return serveUploadedApk();
            }
            if (uri.startsWith("/media/")) {
                return serveMedia(uri.substring("/media/".length()));
            }
            if ("/upload".equals(uri) && Method.POST.equals(session.getMethod())) {
                int section = safeInt(session.getParms().get("section"), 1);
                return handleUpload(session, section);
            }
            if (uri.startsWith("/upload/") && Method.POST.equals(session.getMethod())) {
                String[] parts = uri.split("/");
                int section = parts.length >= 5 ? safeInt(parts[4], 1) : safeInt(session.getParms().get("section"), 1);
                return handleUpload(session, section);
            }
            return withCors(newFixedLengthResponse(Response.Status.NOT_FOUND, "application/json", "{\"error\":\"not-found\"}"));
        } catch (Exception ignored) {
            return withCors(newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "application/json", "{\"error\":\"server-error\"}"));
        }
    }

    private Response handleUpload(IHTTPSession session, int section) throws Exception {
        Map<String, String> files = new HashMap<>();
        session.parseBody(files);

        File incomingDir = new File(getMediaRoot(), "incoming-" + section + "-" + System.currentTimeMillis());
        incomingDir.mkdirs();
        List<File> staged = new ArrayList<>();

        for (Map.Entry<String, String> entry : files.entrySet()) {
            String key = entry.getKey();
            if (!key.startsWith("file")) continue;
            File temp = new File(String.valueOf(entry.getValue()));
            if (!temp.exists()) continue;
            String originalName = session.getParameters().containsKey(key)
                    ? session.getParameters().get(key).get(0)
                    : temp.getName();
            String safeName = sanitizeFileName(originalName);
            if (!isAllowedMedia(safeName)) continue;
            File dest = new File(incomingDir, safeName);
            copyFile(temp, dest);
            staged.add(dest);
        }

        if (staged.isEmpty()) {
            deleteRecursively(incomingDir);
            return withCors(newFixedLengthResponse(
                    Response.Status.BAD_REQUEST,
                    "application/json; charset=utf-8",
                    "{\"success\":false,\"error\":\"no-valid-files\"}"
            ));
        }

        File targetDir = new File(getMediaRoot(), "section" + Math.max(1, Math.min(3, section)));
        deleteRecursively(targetDir);
        targetDir.mkdirs();
        for (File file : staged) {
            copyFile(file, new File(targetDir, file.getName()));
        }
        deleteRecursively(incomingDir);
        clearVideoCache();

        JSONObject payload = new JSONObject();
        payload.put("section", section);
        payload.put("count", staged.size());
        EmbeddedCmsRuntime.emitEvent("media-updated", payload);

        JSONObject out = new JSONObject();
        out.put("success", true);
        out.put("section", section);
        out.put("count", staged.size());
        return json(out);
    }

    private Response handleClearCache() throws Exception {
        clearVideoCache();
        File cacheDir = context.getCacheDir();
        File[] children = cacheDir.listFiles();
        if (children != null) {
            for (File child : children) {
                if (child == null) continue;
                if ("webview".equalsIgnoreCase(child.getName())) continue;
                deleteRecursively(child);
            }
        }
        EmbeddedCmsRuntime.emitEvent("cache-cleared", EmbeddedCmsRuntime.buildSelfStatus(context));
        JSONObject out = new JSONObject();
        out.put("success", true);
        out.put("message", "Device cache cleared.");
        return json(out);
    }

    private Response handleClearDevice() throws Exception {
        getKioskPrefs()
                .edit()
                .putBoolean(KEY_AUTO_REOPEN_ENABLED, false)
                .remove(KEY_VIDEO_CACHE_MAX_BYTES)
                .apply();
        deleteRecursively(getMediaRoot());
        deleteRecursively(new File(context.getFilesDir(), CONFIG_FILE_NAME));
        deleteRecursively(new File(context.getCacheDir(), APP_UPDATE_FILE_NAME));
        clearVideoCache();
        EmbeddedCmsRuntime.setRuntimeInfo(context, "{}");
        EmbeddedCmsRuntime.emitEvent("device-cleared", EmbeddedCmsRuntime.buildSelfStatus(context));
        restartAppInternal(true);

        JSONObject out = new JSONObject();
        out.put("success", true);
        out.put("message", "Device data cleared. Restarting app.");
        return json(out);
    }

    private Response handleRestartDevice() throws Exception {
        restartAppInternal(false);
        JSONObject out = new JSONObject();
        out.put("success", true);
        out.put("message", "Restarting app.");
        return json(out);
    }

    private Response handleAutoReopen(IHTTPSession session) throws Exception {
        JSONObject body = readJsonBody(session);
        boolean enabled = body.optBoolean("enabled", true);
        getKioskPrefs().edit().putBoolean(KEY_AUTO_REOPEN_ENABLED, enabled).apply();

        JSONObject payload = new JSONObject();
        payload.put("success", true);
        payload.put("enabled", enabled);
        EmbeddedCmsRuntime.emitEvent("auto-reopen-updated", payload);
        return json(payload);
    }

    private Response handleAppUpdateUpload(IHTTPSession session) throws Exception {
        Map<String, String> files = new HashMap<>();
        session.parseBody(files);

        File apkFile = getUploadedApkFile();
        deleteRecursively(apkFile);

        boolean copied = false;
        for (Map.Entry<String, String> entry : files.entrySet()) {
            String key = entry.getKey();
            if (!key.startsWith("file")) continue;
            File temp = new File(String.valueOf(entry.getValue()));
            if (!temp.exists() || !temp.isFile()) continue;
            String originalName = session.getParameters().containsKey(key)
                    ? session.getParameters().get(key).get(0)
                    : temp.getName();
            String safeName = sanitizeFileName(originalName);
            if (!safeName.toLowerCase(Locale.US).endsWith(".apk")) continue;
            copyFile(temp, apkFile);
            copied = true;
            break;
        }

        if (!copied || !apkFile.exists()) {
            return withCors(newFixedLengthResponse(
                    Response.Status.BAD_REQUEST,
                    "application/json; charset=utf-8",
                    "{\"success\":false,\"error\":\"apk-required\"}"
            ));
        }

        JSONObject out = new JSONObject();
        out.put("success", true);
        out.put("apkUrl", EmbeddedCmsRuntime.getLocalUrl() + "/app-update.apk");
        out.put("publicApkUrl", EmbeddedCmsRuntime.getPublicUrl(context) + "/app-update.apk");
        out.put("size", apkFile.length());
        return json(out);
    }

    private Response handleInstallAppUpdate(IHTTPSession session) throws Exception {
        JSONObject body = readJsonBody(session);
        File apkFile = getUploadedApkFile();
        if (!apkFile.exists() || !apkFile.isFile()) {
            String apkUrl = body.optString("apkUrl", "").trim();
            if (!apkUrl.isEmpty()) {
                installApkFromUrl(apkUrl);
            } else {
                return withCors(newFixedLengthResponse(
                        Response.Status.BAD_REQUEST,
                        "application/json; charset=utf-8",
                        "{\"success\":false,\"error\":\"apk-missing\"}"
                ));
            }
        } else {
            installApkFile(apkFile);
        }

        JSONObject out = new JSONObject();
        out.put("success", true);
        out.put("message", "APK installer launched.");
        return json(out);
    }

    private Response serveUploadedApk() throws Exception {
        File apkFile = getUploadedApkFile();
        if (!apkFile.exists() || !apkFile.isFile()) {
            return withCors(newFixedLengthResponse(Response.Status.NOT_FOUND, "application/json", "{\"error\":\"not-found\"}"));
        }
        Response response = newChunkedResponse(
                Response.Status.OK,
                "application/vnd.android.package-archive",
                new FileInputStream(apkFile)
        );
        response.addHeader("Content-Length", String.valueOf(apkFile.length()));
        return withCors(response);
    }

    private JSONArray buildMediaList() throws Exception {
        JSONArray array = new JSONArray();
        for (int section = 1; section <= 3; section += 1) {
            File dir = new File(getMediaRoot(), "section" + section);
            File[] files = dir.listFiles();
            if (files == null) continue;
            Arrays.sort(files, Comparator.comparing(File::getName, String.CASE_INSENSITIVE_ORDER));
            for (File file : files) {
                if (!file.isFile()) continue;
                String name = file.getName();
                if (!isAllowedMedia(name)) continue;
                JSONObject item = new JSONObject();
                item.put("name", name);
                item.put("originalName", name);
                item.put("section", section);
                item.put("url", "/media/section" + section + "/" + name);
                item.put("type", "txt".equals(lowerExt(name)) ? "text" : "media");
                item.put("size", file.length());
                item.put("mtimeMs", file.lastModified());
                item.put("hash", sha1(file));
                array.put(item);
            }
        }
        return array;
    }

    private Response serveMedia(String relativePath) throws Exception {
        File file = new File(getMediaRoot(), relativePath);
        String root = getMediaRoot().getCanonicalPath();
        String target = file.getCanonicalPath();
        if (!target.startsWith(root) || !file.exists() || !file.isFile()) {
            return withCors(newFixedLengthResponse(Response.Status.NOT_FOUND, "application/json", "{\"error\":\"not-found\"}"));
        }
        Response response = newChunkedResponse(Response.Status.OK, guessMime(file.getName()), new FileInputStream(file));
        response.addHeader("Content-Length", String.valueOf(file.length()));
        response.addHeader("Accept-Ranges", "bytes");
        return withCors(response);
    }

    private JSONObject defaultConfig() throws Exception {
        JSONObject out = new JSONObject();
        out.put("orientation", "horizontal");
        out.put("layout", "fullscreen");
        out.put("grid3Layout", "stack-v");
        out.put("gridRatio", "1:1:1");
        out.put("slideDuration", 5);
        out.put("animation", "slide");
        out.put("bgColor", "#000000");
        JSONArray sections = new JSONArray();
        for (int i = 0; i < 3; i += 1) {
            JSONObject section = new JSONObject();
            section.put("slideDirection", "left");
            section.put("slideDuration", 5);
            section.put("sourceType", "multimedia");
            section.put("sourceUrl", "");
            sections.put(section);
        }
        out.put("sections", sections);
        JSONObject ticker = new JSONObject();
        ticker.put("text", "");
        ticker.put("color", "#ffffff");
        ticker.put("bgColor", "#000000");
        ticker.put("speed", 6);
        ticker.put("fontSize", 24);
        ticker.put("position", "bottom");
        out.put("ticker", ticker);
        JSONObject cache = new JSONObject();
        cache.put("videoMB", 2048);
        out.put("cache", cache);
        return out;
    }

    private JSONObject readConfig() throws Exception {
        File file = new File(context.getFilesDir(), CONFIG_FILE_NAME);
        if (!file.exists()) {
            JSONObject config = defaultConfig();
            writeConfig(config);
            return config;
        }
        return new JSONObject(readTextFile(file));
    }

    private void writeConfig(JSONObject config) throws Exception {
        File file = new File(context.getFilesDir(), CONFIG_FILE_NAME);
        writeTextFile(file, config.toString(2));
    }

    private JSONObject readJsonBody(IHTTPSession session) throws Exception {
        Map<String, String> headers = session.getHeaders();
        String contentType = headers == null ? "" : String.valueOf(headers.get("content-type")).toLowerCase(Locale.US);

        if (contentType.contains("application/json") || contentType.contains("text/plain")) {
            String raw = readRequestBody(session).trim();
            return raw.isEmpty() ? new JSONObject() : new JSONObject(raw);
        }

        Map<String, String> files = new HashMap<>();
        session.parseBody(files);
        String path = files.get("postData");
        if (path == null || path.trim().isEmpty()) {
            return new JSONObject();
        }
        String raw = readTextFile(new File(path)).trim();
        return raw.isEmpty() ? new JSONObject() : new JSONObject(raw);
    }

    private String readRequestBody(IHTTPSession session) throws IOException {
        Map<String, String> headers = session.getHeaders();
        int contentLength = safeInt(headers == null ? null : headers.get("content-length"), 0);
        if (contentLength <= 0) return "";

        InputStream input = session.getInputStream();
        ByteArrayOutputStream output = new ByteArrayOutputStream(Math.max(1024, contentLength));
        byte[] buffer = new byte[Math.min(8 * 1024, Math.max(1024, contentLength))];
        int remaining = contentLength;

        while (remaining > 0) {
            int read = input.read(buffer, 0, Math.min(buffer.length, remaining));
            if (read <= 0) break;
            output.write(buffer, 0, read);
            remaining -= read;
        }

        return output.toString(StandardCharsets.UTF_8.name());
    }

    private JSONObject extractConfigPayload(JSONObject body) throws Exception {
        if (body == null) return new JSONObject();
        Object nested = body.opt("config");
        if (nested instanceof JSONObject) {
            return (JSONObject) nested;
        }
        if (nested instanceof String) {
            String raw = String.valueOf(nested).trim();
            if (!raw.isEmpty()) {
                return new JSONObject(raw);
            }
        }
        JSONObject config = new JSONObject();
        JSONArray names = body.names();
        if (names == null) return config;
        for (int i = 0; i < names.length(); i += 1) {
            String key = names.optString(i, "");
            if (key.isEmpty() || "deviceName".equals(key) || "targetDevice".equals(key)) continue;
            config.put(key, body.opt(key));
        }
        return config;
    }

    private JSONObject mergeJson(JSONObject base, JSONObject patch) throws Exception {
        JSONObject merged = new JSONObject(base == null ? "{}" : base.toString());
        if (patch == null) return merged;
        JSONArray names = patch.names();
        if (names == null) return merged;
        for (int i = 0; i < names.length(); i += 1) {
            String key = names.optString(i, "");
            if (key.isEmpty()) continue;
            Object next = patch.opt(key);
            Object current = merged.opt(key);
            if (next instanceof JSONObject && current instanceof JSONObject) {
                merged.put(key, mergeJson((JSONObject) current, (JSONObject) next));
            } else {
                merged.put(key, next);
            }
        }
        return merged;
    }

    private File getMediaRoot() {
        File root = new File(context.getFilesDir(), MEDIA_ROOT_DIR);
        if (!root.exists()) root.mkdirs();
        return root;
    }

    private String sanitizeFileName(String raw) {
        String safe = String.valueOf(raw == null ? "media" : raw).replaceAll("[^a-zA-Z0-9._-]", "_");
        return safe.isEmpty() ? "media" : safe;
    }

    private boolean isAllowedMedia(String name) {
        String lower = String.valueOf(name).toLowerCase(Locale.US);
        return lower.endsWith(".mp4") || lower.endsWith(".mov") || lower.endsWith(".mkv")
                || lower.endsWith(".webm") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")
                || lower.endsWith(".png") || lower.endsWith(".txt");
    }

    private String lowerExt(String name) {
        int dot = name.lastIndexOf(".");
        return dot >= 0 ? name.substring(dot + 1).toLowerCase(Locale.US) : "";
    }

    private String guessMime(String name) {
        String ext = lowerExt(name);
        if ("mp4".equals(ext)) return "video/mp4";
        if ("mov".equals(ext)) return "video/quicktime";
        if ("mkv".equals(ext)) return "video/x-matroska";
        if ("webm".equals(ext)) return "video/webm";
        if ("jpg".equals(ext) || "jpeg".equals(ext)) return "image/jpeg";
        if ("png".equals(ext)) return "image/png";
        if ("txt".equals(ext)) return "text/plain; charset=utf-8";
        String fallback = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return fallback == null ? "application/octet-stream" : fallback;
    }

    private String sha1(File file) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-1");
            InputStream inputStream = new FileInputStream(file);
            byte[] buffer = new byte[16 * 1024];
            int read;
            while ((read = inputStream.read(buffer)) != -1) {
                digest.update(buffer, 0, read);
            }
            inputStream.close();
            byte[] out = digest.digest();
            StringBuilder builder = new StringBuilder();
            for (byte b : out) {
                builder.append(String.format(Locale.US, "%02x", b));
            }
            return builder.toString();
        } catch (Exception ignored) {
            return "";
        }
    }

    private void copyFile(File from, File to) throws IOException {
        InputStream input = new FileInputStream(from);
        FileOutputStream output = new FileOutputStream(to, false);
        byte[] buffer = new byte[16 * 1024];
        int read;
        while ((read = input.read(buffer)) != -1) {
          output.write(buffer, 0, read);
        }
        output.flush();
        input.close();
        output.close();
    }

    private String readTextFile(File file) throws IOException {
        InputStream input = new FileInputStream(file);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8 * 1024];
        int read;
        while ((read = input.read(buffer)) != -1) {
            output.write(buffer, 0, read);
        }
        input.close();
        return output.toString(StandardCharsets.UTF_8.name());
    }

    private void writeTextFile(File file, String value) throws IOException {
        FileOutputStream output = new FileOutputStream(file, false);
        output.write(String.valueOf(value).getBytes(StandardCharsets.UTF_8));
        output.flush();
        output.close();
    }

    private void deleteRecursively(File file) {
        if (file == null || !file.exists()) return;
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) deleteRecursively(child);
            }
        }
        try {
            if (!file.delete() && file.exists()) {
                file.deleteOnExit();
            }
        } catch (Exception ignored) {
        }
    }

    private int safeInt(String raw, int fallback) {
        try {
            return Integer.parseInt(String.valueOf(raw == null ? "" : raw).trim());
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private SharedPreferences getKioskPrefs() {
        return context.getSharedPreferences(KIOSK_PREFS_NAME, Context.MODE_PRIVATE);
    }

    private void applyConfigSideEffects(JSONObject config) {
        if (config == null) return;
        try {
            JSONObject cache = config.optJSONObject("cache");
            if (cache == null) return;
            long videoMb = Math.round(cache.optDouble("videoMB", 0));
            if (videoMb <= 0) return;
            long bytes = Math.max(64L * 1024 * 1024, videoMb * 1024L * 1024L);
            getKioskPrefs().edit().putLong(KEY_VIDEO_CACHE_MAX_BYTES, bytes).apply();
            clearVideoCache();
        } catch (Exception ignored) {
        }
    }

    private File getUploadedApkFile() {
        return new File(context.getCacheDir(), APP_UPDATE_FILE_NAME);
    }

    private void clearVideoCache() {
        try {
            NativeVideoPlayerView.clearVideoCache(context);
        } catch (Exception ignored) {
        }
    }

    private void restartAppInternal(boolean skipAutoReopenRestoreOnce) {
        try {
            Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
            if (launchIntent == null) return;
            launchIntent.addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK
                            | Intent.FLAG_ACTIVITY_CLEAR_TOP
                            | Intent.FLAG_ACTIVITY_CLEAR_TASK
            );
            if (skipAutoReopenRestoreOnce) {
                launchIntent.putExtra("skip_auto_reopen_restore_once", true);
            }
            context.startActivity(launchIntent);
        } catch (Exception ignored) {
        }
    }

    private void installApkFile(File apkFile) {
        try {
            Uri apkUri = FileProvider.getUriForFile(
                    context,
                    context.getPackageName() + ".fileprovider",
                    apkFile
            );
            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            context.startActivity(installIntent);
        } catch (Exception ignored) {
        }
    }

    private void installApkFromUrl(String apkUrl) {
        try {
            File target = getUploadedApkFile();
            HttpURLConnection connection = null;
            InputStream inputStream = null;
            FileOutputStream outputStream = null;
            try {
                connection = (HttpURLConnection) new URL(apkUrl).openConnection();
                connection.setConnectTimeout(20000);
                connection.setReadTimeout(120000);
                connection.setUseCaches(false);
                connection.connect();
                if (connection.getResponseCode() < 200 || connection.getResponseCode() >= 300) {
                    return;
                }
                inputStream = connection.getInputStream();
                outputStream = new FileOutputStream(target, false);
                byte[] buffer = new byte[64 * 1024];
                int read;
                while ((read = inputStream.read(buffer)) != -1) {
                    outputStream.write(buffer, 0, read);
                }
                outputStream.flush();
            } finally {
                try {
                    if (inputStream != null) inputStream.close();
                } catch (Exception ignored) {
                }
                try {
                    if (outputStream != null) outputStream.close();
                } catch (Exception ignored) {
                }
                try {
                    if (connection != null) connection.disconnect();
                } catch (Exception ignored) {
                }
            }
            installApkFile(target);
        } catch (Exception ignored) {
        }
    }

    private Response serveAsset(String path, String mime) throws IOException {
        byte[] bytes = readAssetBytes(path);
        String normalizedMime = String.valueOf(mime == null ? "" : mime).toLowerCase(Locale.US);
        if (normalizedMime.startsWith("text/")
                || normalizedMime.contains("javascript")
                || normalizedMime.contains("json")) {
            return withCors(newFixedLengthResponse(
                    Response.Status.OK,
                    mime,
                    new String(bytes, StandardCharsets.UTF_8)
            ));
        }
        return withCors(newFixedLengthResponse(Response.Status.OK, mime, new ByteArrayInputStream(bytes), bytes.length));
    }

    private byte[] readAssetBytes(String path) throws IOException {
        InputStream inputStream = assetManager.open(path);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8 * 1024];
        int read;
        while ((read = inputStream.read(buffer)) != -1) {
            output.write(buffer, 0, read);
        }
        inputStream.close();
        return output.toByteArray();
    }

    private Response json(Object payload) {
        return withCors(newFixedLengthResponse(Response.Status.OK, "application/json; charset=utf-8", String.valueOf(payload)));
    }

    private Response errorJson(Response.Status status, String code, Exception error) {
        try {
            JSONObject payload = new JSONObject();
            payload.put("success", false);
            payload.put("error", code);
            String message = error == null ? "" : String.valueOf(error.getMessage() == null ? "" : error.getMessage()).trim();
            if (!message.isEmpty()) {
                payload.put("message", message);
            }
            return withCors(newFixedLengthResponse(status, "application/json; charset=utf-8", payload.toString()));
        } catch (Exception ignored) {
            return withCors(newFixedLengthResponse(status, "application/json; charset=utf-8", "{\"success\":false,\"error\":\"" + code + "\"}"));
        }
    }

    private Response withCors(Response response) {
        response.addHeader("Access-Control-Allow-Origin", "*");
        response.addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        response.addHeader("Access-Control-Allow-Headers", "Content-Type");
        response.addHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        return response;
    }
}
