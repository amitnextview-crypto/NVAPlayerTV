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
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public final class EmbeddedCmsServer extends NanoHTTPD {
    private static final String CONFIG_FILE_NAME = "config.json";
    private static final String MEDIA_ROOT_DIR = "cms-media";
    private static final String APP_UPDATE_FILE_NAME = "NVA-SignagePlayerTV-update.apk";
    private static final String KIOSK_PREFS_NAME = "kiosk_prefs";
    private static final String KEY_AUTO_REOPEN_ENABLED = "auto_reopen_enabled";
    private static final String KEY_AUTO_REOPEN_MANUAL_OFF = "auto_reopen_manual_off";
    private static final String KEY_VIDEO_CACHE_MAX_BYTES = "video_cache_max_bytes";
    private static final long MEDIA_HASH_MAX_BYTES = 64L * 1024L * 1024L;
    private static final String SESSION_COOKIE = "embedded_cms_session";
    private static final long SESSION_TTL_MS = 12L * 60L * 60L * 1000L;
    private static final Map<String, Long> ACTIVE_SESSIONS = new ConcurrentHashMap<>();
    private static final Set<String> BULK_ACTIONS = new HashSet<>(Arrays.asList(
            "reboot",
            "restart-app",
            "refresh",
            "clear-cache",
            "deep-clear-data",
            "kiosk-toggle",
            "orientation",
            "brightness",
            "volume",
            "volume-step",
            "mute",
            "force-sync",
            "refresh-content",
            "sleep-timer",
            "wake-timer",
            "auto-start-on-boot"
    ));

    private final Context context;
    private final AssetManager assetManager;
    private final Object chunkUploadLock = new Object();

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
            if (requiresCmsAuth(uri, session.getMethod()) && !isCmsAuthed(session)) {
                return errorJson(Response.Status.UNAUTHORIZED, "unauthorized", null);
            }
            if (uri == null || uri.isEmpty() || "/".equals(uri)) {
                return serveAsset("cms/index.html", "text/html; charset=utf-8");
            }
            if ("/style.css".equals(uri)) {
                return serveAsset("cms/style.css", "text/css; charset=utf-8");
            }
            if ("/app.js".equals(uri)) {
                return serveAsset("cms/app.js", "application/javascript; charset=utf-8");
            }
            if ("/enterprise.js".equals(uri)) {
                return serveAsset("cms/enterprise.js", "application/javascript; charset=utf-8");
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
            if ("/network-state".equals(uri)) {
                return json(buildNetworkState());
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
            if ("/api/auth/session".equals(uri)) {
                return handleAuthSession(session);
            }
            if ("/api/auth/login".equals(uri) && Method.POST.equals(session.getMethod())) {
                return handleAuthLogin(session);
            }
            if ("/api/auth/logout".equals(uri) && Method.POST.equals(session.getMethod())) {
                return handleAuthLogout(session);
            }
            if ("/api/auth/change-password".equals(uri) && Method.POST.equals(session.getMethod())) {
                return handleChangePassword(session);
            }
            if ("/api/groups".equals(uri) && Method.GET.equals(session.getMethod())) {
                return handleGroupsList();
            }
            if ("/api/groups".equals(uri) && Method.POST.equals(session.getMethod())) {
                return handleGroupSave(session);
            }
            if (uri.startsWith("/api/groups/") && Method.DELETE.equals(session.getMethod())) {
                return handleGroupDelete(uri);
            }
            if ("/api/groups/auto-create".equals(uri) && Method.POST.equals(session.getMethod())) {
                return handleGroupAutoCreate(session);
            }
            if ("/api/upload-queue".equals(uri) && Method.GET.equals(session.getMethod())) {
                return handleQueueState();
            }
            if ("/api/upload-queue/settings".equals(uri) && Method.POST.equals(session.getMethod())) {
                return handleQueueSettings(session);
            }
            if ("/api/upload-queue/pause".equals(uri) && Method.POST.equals(session.getMethod())) {
                return handleQueuePaused(true);
            }
            if ("/api/upload-queue/resume".equals(uri) && Method.POST.equals(session.getMethod())) {
                return handleQueuePaused(false);
            }
            if (uri.startsWith("/api/upload-queue/retry-failed/") && Method.POST.equals(session.getMethod())) {
                return handleQueueRetry(uri);
            }
            if ("/api/backup/export".equals(uri)) {
                return handleBackupExport();
            }
            if ("/api/backup/restore".equals(uri) && Method.POST.equals(session.getMethod())) {
                return handleBackupRestore(session);
            }
            if ("/api/access-overrides".equals(uri) && Method.GET.equals(session.getMethod())) {
                return handleAccessOverrides();
            }
            if ("/api/access-overrides".equals(uri) && Method.POST.equals(session.getMethod())) {
                return handleSaveAccessOverride(session);
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
                        JSONObject payload = new JSONObject();
                        payload.put("success", true);
                        payload.put("config", readConfig());
                        // Deliver the saved config to the player immediately.
                        // This avoids a second local HTTP read racing with the
                        // React event, which could otherwise leave one TV on a
                        // stale ticker configuration.
                        EmbeddedCmsRuntime.emitEvent("config-updated", payload);
                        if (body.optBoolean("restartAfterUpload", false)) {
                            new Thread(() -> {
                                try {
                                    Thread.sleep(700L);
                                } catch (InterruptedException ignored) {
                                }
                                restartAppInternal(false);
                            }).start();
                        }
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
            if ("/config/rename-device".equals(uri) && Method.POST.equals(session.getMethod())) {
                return handleRenameDevice(session);
            }
            if ("/config/access-url".equals(uri) && Method.POST.equals(session.getMethod())) {
                return handleAccessUrlUpdate(session);
            }
            if ("/config/clear-section-media".equals(uri) && Method.POST.equals(session.getMethod())) {
                return handleClearSectionMedia(session);
            }
            if ("/config/delete-section-media".equals(uri) && Method.POST.equals(session.getMethod())) {
                return handleDeleteSectionMedia(session);
            }
            if ("/config/bulk-action".equals(uri) && Method.POST.equals(session.getMethod())) {
                return handleBulkAction(session);
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
                return serveMedia(session, uri.substring("/media/".length()));
            }
            if ("/upload/chunk/init".equals(uri) && Method.POST.equals(session.getMethod())) {
                int section = safeInt(session.getParms().get("section"), 1);
                return handleChunkInit(session, section);
            }
            if (uri.startsWith("/upload/chunk/") && Method.POST.equals(session.getMethod())) {
                int section = safeInt(session.getParms().get("section"), 1);
                if (uri.endsWith("/complete")) {
                    return handleChunkComplete(session, section, extractChunkUploadId(uri));
                }
                if (uri.contains("/file/") && uri.contains("/part/")) {
                    return handleChunkPart(session, section, uri);
                }
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
        if (!incomingDir.mkdirs() && !incomingDir.exists()) {
            throw new IOException("Unable to prepare upload directory.");
        }
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
            File dest = uniqueFile(incomingDir, safeName);
            moveFileFast(temp, dest);
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

        activateIncomingSection(incomingDir, section);

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
        JSONObject command = new JSONObject();
        command.put("action", "deep-clear-data");
        command.put("preservedIdentity", true);
        EmbeddedCmsRuntime.emitEvent("device-command", command);
        JSONObject out = new JSONObject();
        out.put("success", true);
        out.put("message", "Deep clear command sent. Preserved identity keys will remain.");
        return json(out);
    }

    private Response handleRestartDevice() throws Exception {
        restartAppInternal(false);
        JSONObject out = new JSONObject();
        out.put("success", true);
        out.put("message", "Restarting app.");
        return json(out);
    }

    private boolean requiresCmsAuth(String uri, Method method) {
        String value = String.valueOf(uri == null ? "" : uri);
        if (value.isEmpty() || "/".equals(value)) return false;
        if ("/style.css".equals(value) || "/app.js".equals(value) || "/enterprise.js".equals(value) || "/app-v2.js".equals(value) || "/nvlogo.png".equals(value)) {
            return false;
        }
        if ("/ping".equals(value) || "/network-state".equals(value) || "/status".equals(value) || "/devices".equals(value) || "/device-status".equals(value)) {
            return false;
        }
        if ("/config".equals(value) && Method.GET.equals(method)) {
            return false;
        }
        if (value.startsWith("/media/") || "/media-list".equals(value) || "/app-update.apk".equals(value)) {
            return false;
        }
        if ("/api/auth/session".equals(value) || "/api/auth/login".equals(value)) {
            return false;
        }
        return value.startsWith("/api/") || value.startsWith("/config/") || "/config".equals(value) || value.startsWith("/upload");
    }

    private Map<String, String> parseCookies(IHTTPSession session) {
        Map<String, String> out = new HashMap<>();
        Map<String, String> headers = session.getHeaders();
        String raw = headers == null ? "" : String.valueOf(headers.get("cookie"));
        if (raw == null || raw.trim().isEmpty()) return out;
        String[] parts = raw.split(";");
        for (String part : parts) {
            String item = String.valueOf(part == null ? "" : part).trim();
            if (item.isEmpty() || !item.contains("=")) continue;
            String[] pair = item.split("=", 2);
            out.put(pair[0].trim(), pair.length > 1 ? pair[1].trim() : "");
        }
        return out;
    }

    private void purgeExpiredSessions() {
        long now = System.currentTimeMillis();
        ACTIVE_SESSIONS.entrySet().removeIf((entry) -> entry == null || entry.getValue() == null || entry.getValue() < now);
    }

    private boolean isCmsAuthed(IHTTPSession session) {
        try {
            Map<String, String> headers = session.getHeaders();
            String headerPassword = headers == null ? "" : String.valueOf(headers.get("x-cms-password")).trim();
            if (!headerPassword.isEmpty() && EmbeddedCmsRuntime.getCmsPassword(context).equals(headerPassword)) {
                return true;
            }
        } catch (Exception ignored) {
        }
        purgeExpiredSessions();
        String token = parseCookies(session).get(SESSION_COOKIE);
        if (token == null || token.trim().isEmpty()) return false;
        Long expiresAt = ACTIVE_SESSIONS.get(token.trim());
        if (expiresAt == null || expiresAt < System.currentTimeMillis()) {
            ACTIVE_SESSIONS.remove(token.trim());
            return false;
        }
        ACTIVE_SESSIONS.put(token.trim(), System.currentTimeMillis() + SESSION_TTL_MS);
        return true;
    }

    private Response handleAuthSession(IHTTPSession session) throws Exception {
        boolean authenticated = isCmsAuthed(session);
        JSONObject out = new JSONObject();
        out.put("ok", true);
        out.put("authenticated", authenticated);
        out.put("inactivityTimeoutMs", SESSION_TTL_MS);
        out.put("expiresAt", JSONObject.NULL);
        out.put("mode", "embedded-password");
        out.put("passwordConfigured", !EmbeddedCmsRuntime.getCmsPassword(context).isEmpty());
        return json(out);
    }

    private Response handleAuthLogin(IHTTPSession session) throws Exception {
        JSONObject body = readJsonBody(session);
        String password = body.optString("password", "").trim();
        if (!EmbeddedCmsRuntime.getCmsPassword(context).equals(password)) {
          return errorJson(Response.Status.UNAUTHORIZED, "invalid-password", null);
        }
        String token = UUID.randomUUID().toString();
        ACTIVE_SESSIONS.put(token, System.currentTimeMillis() + SESSION_TTL_MS);
        JSONObject out = new JSONObject();
        out.put("ok", true);
        out.put("authenticated", true);
        Response response = json(out);
        response.addHeader("Set-Cookie", SESSION_COOKIE + "=" + token + "; Max-Age=" + (SESSION_TTL_MS / 1000L) + "; Path=/; SameSite=Strict");
        return response;
    }

    private Response handleAuthLogout(IHTTPSession session) throws Exception {
        String token = parseCookies(session).get(SESSION_COOKIE);
        if (token != null) {
            ACTIVE_SESSIONS.remove(token.trim());
        }
        JSONObject out = new JSONObject();
        out.put("ok", true);
        out.put("authenticated", false);
        Response response = json(out);
        response.addHeader("Set-Cookie", SESSION_COOKIE + "=deleted; Max-Age=0; Path=/; SameSite=Strict");
        return response;
    }

    private Response handleChangePassword(IHTTPSession session) throws Exception {
        JSONObject body = readJsonBody(session);
        String currentPassword = body.optString("currentPassword", "").trim();
        String nextPassword = body.optString("nextPassword", "").trim();
        String savedPassword = EmbeddedCmsRuntime.getCmsPassword(context);
        if (!savedPassword.equals(currentPassword)) {
            return errorJson(Response.Status.UNAUTHORIZED, "invalid-password", null);
        }
        if (nextPassword.isEmpty()) {
            return errorJson(Response.Status.BAD_REQUEST, "new-password-required", null);
        }
        EmbeddedCmsRuntime.setCmsPassword(context, nextPassword);
        EmbeddedCmsRuntime.appendEnterpriseLog(context, "success", "Password Changed", "CMS password updated on embedded CMS.");
        JSONObject out = new JSONObject();
        out.put("ok", true);
        return json(out);
    }

    private Response handleGroupsList() throws Exception {
        JSONObject state = EmbeddedCmsRuntime.getEnterpriseState(context);
        JSONArray groups = buildGroupsWithDeviceSummary(state.optJSONArray("groups"));
        JSONObject out = new JSONObject();
        out.put("ok", true);
        out.put("groups", groups);
        return json(out);
    }

    private Response handleGroupSave(IHTTPSession session) throws Exception {
        JSONObject body = readJsonBody(session);
        JSONObject state = EmbeddedCmsRuntime.getEnterpriseState(context);
        JSONArray groups = state.optJSONArray("groups");
        if (groups == null) groups = new JSONArray();
        String id = body.optString("id", "").trim();
        String name = body.optString("name", "").trim();
        JSONArray devices = body.optJSONArray("devices");
        if (name.isEmpty()) {
            return errorJson(Response.Status.BAD_REQUEST, "group-name-required", null);
        }
        JSONArray uniqueDevices = uniqueStringArray(devices);
        for (int i = 0; i < groups.length(); i += 1) {
            JSONObject item = groups.optJSONObject(i);
            if (item == null) continue;
            if (name.equalsIgnoreCase(item.optString("name", "")) && !id.equals(item.optString("id", ""))) {
                return errorJson(Response.Status.CONFLICT, "group-name-duplicate", null);
            }
        }
        String now = String.valueOf(System.currentTimeMillis());
        JSONObject nextGroup = new JSONObject();
        nextGroup.put("id", id.isEmpty() ? ("group-" + now) : id);
        nextGroup.put("name", name);
        nextGroup.put("devices", uniqueDevices);
        nextGroup.put("updatedAt", System.currentTimeMillis());
        JSONArray nextGroups = new JSONArray();
        boolean replaced = false;
        for (int i = 0; i < groups.length(); i += 1) {
            JSONObject item = groups.optJSONObject(i);
            if (item == null) continue;
            if (!id.isEmpty() && id.equals(item.optString("id", ""))) {
                nextGroup.put("createdAt", item.optLong("createdAt", System.currentTimeMillis()));
                nextGroups.put(nextGroup);
                replaced = true;
            } else {
                nextGroups.put(item);
            }
        }
        if (!replaced) {
            nextGroup.put("createdAt", System.currentTimeMillis());
            nextGroups.put(nextGroup);
        }
        state.put("groups", nextGroups);
        state.put("updatedAt", System.currentTimeMillis());
        EmbeddedCmsRuntime.setEnterpriseState(context, state);
        EmbeddedCmsRuntime.appendEnterpriseLog(context, "success", "Group Saved", name + " updated.");

        JSONObject out = new JSONObject();
        out.put("ok", true);
        out.put("group", enrichGroup(nextGroup));
        return json(out);
    }

    private Response handleGroupDelete(String uri) throws Exception {
        String id = uri.substring("/api/groups/".length()).trim();
        if (id.isEmpty()) {
            return errorJson(Response.Status.BAD_REQUEST, "group-id-required", null);
        }
        JSONObject state = EmbeddedCmsRuntime.getEnterpriseState(context);
        JSONArray groups = state.optJSONArray("groups");
        JSONArray next = new JSONArray();
        boolean removed = false;
        if (groups != null) {
            for (int i = 0; i < groups.length(); i += 1) {
                JSONObject item = groups.optJSONObject(i);
                if (item == null) continue;
                if (id.equals(item.optString("id", ""))) {
                    removed = true;
                    continue;
                }
                next.put(item);
            }
        }
        if (!removed) {
            return errorJson(Response.Status.NOT_FOUND, "group-not-found", null);
        }
        state.put("groups", next);
        state.put("updatedAt", System.currentTimeMillis());
        EmbeddedCmsRuntime.setEnterpriseState(context, state);
        EmbeddedCmsRuntime.appendEnterpriseLog(context, "warning", "Group Deleted", id + " removed.");
        JSONObject out = new JSONObject();
        out.put("ok", true);
        return json(out);
    }

    private Response handleGroupAutoCreate(IHTTPSession session) throws Exception {
        JSONObject body = readJsonBody(session);
        JSONArray devices = uniqueStringArray(body.optJSONArray("devices"));
        int chunkSize = Math.max(1, body.optInt("groupSize", 5));
        JSONObject state = EmbeddedCmsRuntime.getEnterpriseState(context);
        JSONArray groups = state.optJSONArray("groups");
        if (groups == null) groups = new JSONArray();
        for (int index = 0; index < devices.length(); index += chunkSize) {
            JSONArray slice = new JSONArray();
            for (int i = index; i < Math.min(devices.length(), index + chunkSize); i += 1) {
                slice.put(devices.optString(i, ""));
            }
            JSONObject item = new JSONObject();
            item.put("id", "group-" + System.currentTimeMillis() + "-" + index);
            item.put("name", "Group " + ((index / chunkSize) + 1));
            item.put("devices", slice);
            item.put("createdAt", System.currentTimeMillis());
            item.put("updatedAt", System.currentTimeMillis());
            groups.put(item);
        }
        state.put("groups", groups);
        state.put("updatedAt", System.currentTimeMillis());
        EmbeddedCmsRuntime.setEnterpriseState(context, state);
        EmbeddedCmsRuntime.appendEnterpriseLog(context, "success", "Auto Groups Created", "Generated groups from selected devices.");
        JSONObject out = new JSONObject();
        out.put("ok", true);
        out.put("groups", buildGroupsWithDeviceSummary(groups));
        return json(out);
    }

    private Response handleQueueState() throws Exception {
        JSONObject state = EmbeddedCmsRuntime.getEnterpriseState(context);
        JSONObject queue = state.optJSONObject("queue");
        if (queue == null) queue = EmbeddedCmsRuntime.defaultEnterpriseState().optJSONObject("queue");
        JSONObject out = new JSONObject();
        out.put("ok", true);
        out.put("queue", queue == null ? new JSONObject() : queue);
        out.put("logs", state.optJSONArray("logs") == null ? new JSONArray() : state.optJSONArray("logs"));
        return json(out);
    }

    private Response handleQueueSettings(IHTTPSession session) throws Exception {
        JSONObject body = readJsonBody(session);
        JSONObject state = EmbeddedCmsRuntime.getEnterpriseState(context);
        JSONObject queue = state.optJSONObject("queue");
        if (queue == null) queue = new JSONObject();
        JSONObject settings = queue.optJSONObject("settings");
        if (settings == null) settings = new JSONObject();
        settings.put("maxConcurrentUploads", Math.max(1, Math.min(5, body.optInt("maxConcurrentUploads", settings.optInt("maxConcurrentUploads", 3)))));
        settings.put("groupSize", Math.max(1, body.optInt("groupSize", settings.optInt("groupSize", 5))));
        queue.put("settings", settings);
        state.put("queue", queue);
        state.put("updatedAt", System.currentTimeMillis());
        EmbeddedCmsRuntime.setEnterpriseState(context, state);
        EmbeddedCmsRuntime.appendEnterpriseLog(context, "info", "Queue Settings Saved", "Upload manager settings updated.");
        JSONObject out = new JSONObject();
        out.put("ok", true);
        out.put("settings", settings);
        return json(out);
    }

    private Response handleQueuePaused(boolean paused) throws Exception {
        JSONObject state = EmbeddedCmsRuntime.getEnterpriseState(context);
        JSONObject queue = state.optJSONObject("queue");
        if (queue == null) queue = new JSONObject();
        queue.put("paused", paused);
        state.put("queue", queue);
        state.put("updatedAt", System.currentTimeMillis());
        EmbeddedCmsRuntime.setEnterpriseState(context, state);
        EmbeddedCmsRuntime.appendEnterpriseLog(context, paused ? "warning" : "success", paused ? "Queue Paused" : "Queue Resumed", "Embedded enterprise queue state changed.");
        JSONObject out = new JSONObject();
        out.put("ok", true);
        out.put("queue", queue);
        return json(out);
    }

    private Response handleQueueRetry(String uri) throws Exception {
        String jobId = uri.substring("/api/upload-queue/retry-failed/".length()).trim();
        EmbeddedCmsRuntime.appendEnterpriseLog(context, "info", "Retry Requested", "Retry requested for job " + jobId + ".");
        JSONObject out = new JSONObject();
        out.put("ok", true);
        out.put("jobId", jobId);
        return json(out);
    }

    private Response handleBackupExport() throws Exception {
        JSONObject state = EmbeddedCmsRuntime.getEnterpriseState(context);
        JSONObject data = new JSONObject();
        data.put("groups", state.optJSONArray("groups") == null ? new JSONArray() : state.optJSONArray("groups"));
        data.put("uploadQueueSettings", state.optJSONObject("queue") == null ? new JSONObject() : state.optJSONObject("queue").optJSONObject("settings"));
        data.put("accessOverrides", state.optJSONObject("accessOverrides") == null ? new JSONObject() : state.optJSONObject("accessOverrides"));
        JSONObject out = new JSONObject();
        out.put("ok", true);
        out.put("exportedAt", System.currentTimeMillis());
        out.put("data", data);
        return json(out);
    }

    private Response handleBackupRestore(IHTTPSession session) throws Exception {
        JSONObject body = readJsonBody(session);
        JSONObject data = body.optJSONObject("data");
        if (data == null) {
            return errorJson(Response.Status.BAD_REQUEST, "backup-data-required", null);
        }
        JSONObject state = EmbeddedCmsRuntime.getEnterpriseState(context);
        JSONArray groups = data.optJSONArray("groups");
        if (groups != null) state.put("groups", groups);
        JSONObject accessOverrides = data.optJSONObject("accessOverrides");
        if (accessOverrides != null) state.put("accessOverrides", accessOverrides);
        JSONObject queue = state.optJSONObject("queue");
        if (queue == null) queue = new JSONObject();
        JSONObject settings = data.optJSONObject("uploadQueueSettings");
        if (settings != null) queue.put("settings", settings);
        state.put("queue", queue);
        state.put("updatedAt", System.currentTimeMillis());
        EmbeddedCmsRuntime.setEnterpriseState(context, state);
        EmbeddedCmsRuntime.appendEnterpriseLog(context, "success", "Backup Restored", "Groups and access settings restored.");
        JSONObject out = new JSONObject();
        out.put("ok", true);
        return json(out);
    }

    private Response handleAccessOverrides() throws Exception {
        JSONObject state = EmbeddedCmsRuntime.getEnterpriseState(context);
        JSONObject out = new JSONObject();
        out.put("ok", true);
        out.put("overrides", state.optJSONObject("accessOverrides") == null ? new JSONObject() : state.optJSONObject("accessOverrides"));
        return json(out);
    }

    private Response handleSaveAccessOverride(IHTTPSession session) throws Exception {
        JSONObject body = readJsonBody(session);
        String deviceId = body.optString("deviceId", "").trim();
        if (deviceId.isEmpty()) {
            return errorJson(Response.Status.BAD_REQUEST, "device-id-required", null);
        }
        JSONObject state = EmbeddedCmsRuntime.getEnterpriseState(context);
        JSONObject overrides = state.optJSONObject("accessOverrides");
        if (overrides == null) overrides = new JSONObject();
        JSONObject item = overrides.optJSONObject(deviceId);
        if (item == null) item = new JSONObject();
        item.put("deviceId", deviceId);
        item.put("origin", body.optString("origin", "").trim());
        item.put("preferredPort", EmbeddedCmsRuntime.sanitizePreferredPort(body.optInt("preferredPort", 0)));
        item.put("updatedAt", System.currentTimeMillis());
        overrides.put(deviceId, item);
        state.put("accessOverrides", overrides);
        state.put("updatedAt", System.currentTimeMillis());
        EmbeddedCmsRuntime.setEnterpriseState(context, state);
        JSONObject out = new JSONObject();
        out.put("ok", true);
        out.put("override", item);
        return json(out);
    }

    private Response handleRenameDevice(IHTTPSession session) throws Exception {
        JSONObject body = readJsonBody(session);
        String nextName = body.optString("deviceName", "").trim();
        if (nextName.isEmpty()) {
            return errorJson(Response.Status.BAD_REQUEST, "invalid-device-name", null);
        }
        EmbeddedCmsRuntime.setDeviceName(context, nextName);
        EmbeddedCmsRuntime.appendEnterpriseLog(context, "success", "Device Renamed", "Device renamed to " + nextName + ".");
        JSONObject out = new JSONObject();
        out.put("success", true);
        out.put("name", nextName);
        out.put("device", EmbeddedCmsRuntime.buildSelfStatus(context));
        return json(out);
    }

    private Response handleAccessUrlUpdate(IHTTPSession session) throws Exception {
        JSONObject body = readJsonBody(session);
        String accessUrl = body.optString("accessUrl", "").trim();
        int preferredPort = EmbeddedCmsRuntime.sanitizePreferredPort(body.optInt("preferredPort", 0));
        JSONObject state = EmbeddedCmsRuntime.getEnterpriseState(context);
        JSONObject overrides = state.optJSONObject("accessOverrides");
        if (overrides == null) overrides = new JSONObject();
        JSONObject self = EmbeddedCmsRuntime.buildSelfStatus(context);
        String deviceId = self.optString("deviceId", "");
        JSONObject override = new JSONObject();
        override.put("deviceId", deviceId);
        override.put("updatedAt", System.currentTimeMillis());
        override.put("origin", accessUrl);
        override.put("preferredPort", preferredPort);
        overrides.put(deviceId, override);
        state.put("accessOverrides", overrides);
        state.put("updatedAt", System.currentTimeMillis());
        EmbeddedCmsRuntime.setEnterpriseState(context, state);

        if (preferredPort > 0) {
            EmbeddedCmsRuntime.setPreferredPort(context, preferredPort);
            EmbeddedCmsRuntime.appendEnterpriseLog(context, "info", "Access Port Updated", "Preferred server port set to " + preferredPort + ".");
            EmbeddedCmsRuntime.restartServerAsync(context);
        } else {
            EmbeddedCmsRuntime.appendEnterpriseLog(context, "info", "Access URL Updated", "Manual access URL override updated.");
        }

        JSONObject out = new JSONObject();
        out.put("success", true);
        out.put("device", EmbeddedCmsRuntime.buildSelfStatus(context));
        out.put("override", override);
        return json(out);
    }

    private Response handleBulkAction(IHTTPSession session) throws Exception {
        JSONObject body = readJsonBody(session);
        String action = body.optString("action", "").trim();
        if (!BULK_ACTIONS.contains(action)) {
            return errorJson(Response.Status.BAD_REQUEST, "unsupported-action", null);
        }
        JSONObject payload = body.optJSONObject("payload");
        if (payload == null) payload = new JSONObject();
        boolean success = true;
        if ("restart-app".equals(action)) {
            restartAppInternal(false);
        } else if ("clear-cache".equals(action)) {
            handleClearCache();
        } else if ("deep-clear-data".equals(action)) {
            handleClearDevice();
        } else if ("orientation".equals(action)) {
            JSONObject config = readConfig();
            config.put("orientation", payload.optString("orientation", payload.optString("value", "horizontal")));
            writeConfig(config);
            JSONObject eventPayload = new JSONObject();
            eventPayload.put("success", true);
            eventPayload.put("config", config);
            EmbeddedCmsRuntime.emitEvent("config-updated", eventPayload);
        } else if ("refresh".equals(action) || "force-sync".equals(action) || "refresh-content".equals(action)) {
            EmbeddedCmsRuntime.emitEvent("media-updated", EmbeddedCmsRuntime.buildSelfStatus(context));
        } else {
            JSONObject command = new JSONObject();
            command.put("action", action);
            JSONArray names = payload.names();
            if (names != null) {
                for (int i = 0; i < names.length(); i += 1) {
                    String key = names.optString(i, "");
                    if (key.isEmpty()) continue;
                    command.put(key, payload.opt(key));
                }
            }
            EmbeddedCmsRuntime.emitEvent("device-command", command);
        }
        EmbeddedCmsRuntime.appendEnterpriseLog(context, success ? "success" : "error", "Bulk Action", action + " applied on embedded TV.");
        JSONObject out = new JSONObject();
        out.put("success", success);
        out.put("delivered", success ? 1 : 0);
        out.put("skipped", new JSONArray());
        return json(out);
    }

    private File getChunkSessionDir(int section, String uploadId) {
        return new File(getMediaRoot(), "chunk-upload-section" + section + "-" + safeUploadId(uploadId));
    }

    private File getChunkManifestFile(File sessionDir) {
        return new File(sessionDir, ".chunk-manifest.json");
    }

    private String safeUploadId(String raw) {
        String value = String.valueOf(raw == null ? "" : raw).trim().replaceAll("[^a-zA-Z0-9_-]", "");
        if (value.length() > 64) value = value.substring(0, 64);
        return value;
    }

    private String extractChunkUploadId(String uri) {
        String prefix = "/upload/chunk/";
        String value = String.valueOf(uri == null ? "" : uri);
        if (!value.startsWith(prefix)) return "";
        String rest = value.substring(prefix.length());
        int slash = rest.indexOf("/");
        return safeUploadId(slash >= 0 ? rest.substring(0, slash) : rest);
    }

    private String uniqueStoredName(String original, Set<String> used) {
        String safe = sanitizeFileName(original);
        String base = safe;
        String ext = "";
        int dot = safe.lastIndexOf(".");
        if (dot > 0) {
            base = safe.substring(0, dot);
            ext = safe.substring(dot);
        }
        String candidate = safe;
        int counter = 2;
        while (used.contains(candidate.toLowerCase(Locale.US))) {
            candidate = base + "-" + counter + ext;
            counter += 1;
        }
        used.add(candidate.toLowerCase(Locale.US));
        return candidate;
    }

    private JSONObject findChunkFile(JSONObject manifest, int fileIndex) {
        JSONArray files = manifest == null ? null : manifest.optJSONArray("files");
        if (files == null) return null;
        for (int i = 0; i < files.length(); i += 1) {
            JSONObject item = files.optJSONObject(i);
            if (item != null && item.optInt("index", -1) == fileIndex) return item;
        }
        return null;
    }

    private boolean jsonArrayContainsInt(JSONArray array, int value) {
        if (array == null) return false;
        for (int i = 0; i < array.length(); i += 1) {
            if (array.optInt(i, Integer.MIN_VALUE) == value) return true;
        }
        return false;
    }

    private JSONObject chunkStatus(JSONObject manifest) throws Exception {
        JSONObject out = new JSONObject();
        out.put("success", true);
        out.put("uploadId", manifest.optString("uploadId", ""));
        out.put("chunkSize", manifest.optInt("chunkSize", 5 * 1024 * 1024));
        JSONArray files = manifest.optJSONArray("files");
        JSONArray statusFiles = new JSONArray();
        if (files != null) {
            for (int i = 0; i < files.length(); i += 1) {
                JSONObject item = files.optJSONObject(i);
                if (item == null) continue;
                JSONObject status = new JSONObject();
                JSONArray received = item.optJSONArray("received");
                if (received == null) received = new JSONArray();
                status.put("index", item.optInt("index", i));
                status.put("name", item.optString("originalName", ""));
                status.put("size", item.optLong("size", 0L));
                status.put("storedName", item.optString("storedName", ""));
                status.put("chunks", item.optInt("chunks", 1));
                status.put("received", received);
                status.put("complete", received.length() >= item.optInt("chunks", 1));
                statusFiles.put(status);
            }
        }
        out.put("files", statusFiles);
        return out;
    }

    private byte[] readRequestBytes(IHTTPSession session) throws IOException {
        Map<String, String> headers = session.getHeaders();
        int contentLength = safeInt(headers == null ? null : headers.get("content-length"), 0);
        if (contentLength <= 0) return new byte[0];
        InputStream input = session.getInputStream();
        ByteArrayOutputStream output = new ByteArrayOutputStream(contentLength);
        byte[] buffer = new byte[Math.min(64 * 1024, Math.max(1024, contentLength))];
        int remaining = contentLength;
        while (remaining > 0) {
            int read = input.read(buffer, 0, Math.min(buffer.length, remaining));
            if (read <= 0) break;
            output.write(buffer, 0, read);
            remaining -= read;
        }
        return output.toByteArray();
    }

    private void writeRequestBodyToFile(IHTTPSession session, File target, long offset, long expectedBytes) throws IOException {
        Map<String, String> headers = session.getHeaders();
        long contentLength = safeLong(headers == null ? null : headers.get("content-length"), 0L);
        if (contentLength != expectedBytes) {
            throw new IOException("chunk-size-mismatch");
        }
        File parent = target.getParentFile();
        if (parent != null && !parent.exists() && !parent.mkdirs()) {
            throw new IOException("Unable to prepare upload directory.");
        }
        InputStream input = session.getInputStream();
        RandomAccessFile raf = new RandomAccessFile(target, "rw");
        byte[] buffer = new byte[256 * 1024];
        long remaining = expectedBytes;
        try {
            raf.seek(offset);
            while (remaining > 0) {
                int read = input.read(buffer, 0, (int) Math.min(buffer.length, remaining));
                if (read <= 0) break;
                raf.write(buffer, 0, read);
                remaining -= read;
            }
        } finally {
            raf.close();
        }
        if (remaining != 0L) {
            throw new IOException("chunk-size-mismatch");
        }
    }

    private void emitLocalMediaUpdated(int section, JSONArray files) throws Exception {
        long syncAt = System.currentTimeMillis();
        JSONObject timeline = new JSONObject();
        timeline.put("section", section);
        timeline.put("cycleId", section + "-local-upload-" + syncAt);
        timeline.put("syncAt", syncAt);
        timeline.put("updatedAt", syncAt);
        timeline.put("fileCount", files == null ? 0 : files.length());
        timeline.put("mediaSignature", files == null ? "[]" : files.toString());
        timeline.put("targetDevice", "local");

        JSONObject payload = new JSONObject();
        payload.put("section", section);
        payload.put("count", files == null ? 0 : files.length());
        payload.put("syncAt", syncAt);
        payload.put("timeline", timeline);
        EmbeddedCmsRuntime.emitEvent("media-updated", payload);
    }

    private void emitPlayNow(int section, JSONObject manifest, JSONObject fileMeta, File file) throws Exception {
        String uploadId = manifest.optString("uploadId", "");
        String storedName = fileMeta.optString("storedName", "");
        String baseUrl = EmbeddedCmsRuntime.getPublicUrl(context);
        if (baseUrl == null || baseUrl.trim().isEmpty()) {
            baseUrl = EmbeddedCmsRuntime.getLocalUrl();
        }
        String streamUrl = baseUrl.replaceAll("/+$", "")
                + "/media/section"
                + Math.max(1, Math.min(3, section))
                + "/"
                + storedName
                + "?v="
                + System.currentTimeMillis();

        JSONObject payload = new JSONObject();
        payload.put("action", "play_now");
        payload.put("section", section);
        payload.put("name", fileMeta.optString("originalName", storedName));
        payload.put("streamUrl", streamUrl);
        payload.put("stream_url", streamUrl);
        if (file != null && file.exists()) {
            payload.put("localUri", Uri.fromFile(file).toString());
            payload.put("local_uri", Uri.fromFile(file).toString());
            payload.put("localPath", file.getAbsolutePath());
        }
        payload.put("size", fileMeta.optLong("size", 0L));
        payload.put("availableBytes", fileMeta.optLong("size", file == null ? 0L : file.length()));
        payload.put("mtimeMs", System.currentTimeMillis());
        payload.put("priority", "new-upload-complete");
        EmbeddedCmsRuntime.emitEvent("play-now", payload);
    }

    private Response handleChunkInit(IHTTPSession session, int section) throws Exception {
        JSONObject body = readJsonBody(session);
        JSONArray files = body.optJSONArray("files");
        if (files == null || files.length() <= 0) {
            return withCors(newFixedLengthResponse(Response.Status.BAD_REQUEST, "application/json", "{\"success\":false,\"error\":\"files-required\"}"));
        }
        int chunkSize = Math.max(1024 * 1024, Math.min(25 * 1024 * 1024, body.optInt("chunkSize", 5 * 1024 * 1024)));
        String uploadId = safeUploadId(body.optString("uploadId", body.optString("uploadKey", "")));
        if (uploadId.isEmpty()) uploadId = UUID.randomUUID().toString().replace("-", "");
        File sessionDir = getChunkSessionDir(section, uploadId);
        if (!sessionDir.exists() && !sessionDir.mkdirs()) {
            throw new IOException("Unable to prepare chunk upload directory.");
        }

        File manifestFile = getChunkManifestFile(sessionDir);
        JSONObject manifest;
        if (manifestFile.exists()) {
            manifest = new JSONObject(readTextFile(manifestFile));
        } else {
            // Schedule profiles share a section media library. Do not erase an
            // earlier profile's files when a new profile uploads more media.
            manifest = new JSONObject();
            manifest.put("uploadId", uploadId);
            manifest.put("section", section);
            manifest.put("chunkSize", chunkSize);
            manifest.put("containsPpt", "1".equals(body.optString("containsPpt", "")));
            manifest.put("playNowSent", false);
            manifest.put("createdAt", System.currentTimeMillis());
            JSONArray outFiles = new JSONArray();
            Set<String> names = new HashSet<>();
            for (int i = 0; i < files.length(); i += 1) {
                JSONObject input = files.optJSONObject(i);
                if (input == null) continue;
                String originalName = input.optString("name", "media.bin");
                String storedName = uniqueStoredName(sanitizeFileName(originalName), names);
                if (!isAllowedMedia(storedName)) continue;
                long size = Math.max(0L, input.optLong("size", 0L));
                JSONObject item = new JSONObject();
                item.put("index", i);
                item.put("originalName", originalName);
                item.put("storedName", storedName);
                item.put("size", size);
                item.put("chunks", Math.max(1L, (size + chunkSize - 1L) / chunkSize));
                item.put("received", new JSONArray());
                outFiles.put(item);
            }
            manifest.put("files", outFiles);
            writeTextFile(manifestFile, manifest.toString());
        }

        return json(chunkStatus(manifest));
    }

    private Response handleChunkPart(IHTTPSession session, int section, String uri) throws Exception {
        String[] parts = uri.split("/");
        String uploadId = parts.length >= 4 ? safeUploadId(parts[3]) : "";
        int fileIndex = -1;
        int chunkIndex = -1;
        for (int i = 0; i < parts.length; i += 1) {
            if ("file".equals(parts[i]) && i + 1 < parts.length) fileIndex = safeInt(parts[i + 1], -1);
            if ("part".equals(parts[i]) && i + 1 < parts.length) chunkIndex = safeInt(parts[i + 1], -1);
        }
        if (uploadId.isEmpty() || fileIndex < 0 || chunkIndex < 0) {
            return withCors(newFixedLengthResponse(Response.Status.BAD_REQUEST, "application/json", "{\"success\":false,\"error\":\"invalid-chunk-path\"}"));
        }

        File sessionDir = getChunkSessionDir(section, uploadId);
        JSONObject manifest = new JSONObject(readTextFile(getChunkManifestFile(sessionDir)));
        JSONObject fileMeta = findChunkFile(manifest, fileIndex);
        if (fileMeta == null) {
            return withCors(newFixedLengthResponse(Response.Status.NOT_FOUND, "application/json", "{\"success\":false,\"error\":\"upload-file-not-found\"}"));
        }
        int chunkSize = manifest.optInt("chunkSize", 5 * 1024 * 1024);
        long size = fileMeta.optLong("size", 0L);
        long offset = (long) chunkIndex * (long) chunkSize;
        long expected = Math.max(0L, Math.min(size, offset + chunkSize) - offset);
        File target = new File(sessionDir, fileMeta.optString("storedName", "media.bin"));
        try {
            writeRequestBodyToFile(session, target, offset, expected);
        } catch (IOException io) {
            return withCors(newFixedLengthResponse(Response.Status.BAD_REQUEST, "application/json", "{\"success\":false,\"error\":\"chunk-size-mismatch\"}"));
        }

        synchronized (chunkUploadLock) {
            manifest = new JSONObject(readTextFile(getChunkManifestFile(sessionDir)));
            fileMeta = findChunkFile(manifest, fileIndex);
            if (fileMeta == null) {
                return withCors(newFixedLengthResponse(Response.Status.NOT_FOUND, "application/json", "{\"success\":false,\"error\":\"upload-file-not-found\"}"));
            }

            JSONArray received = fileMeta.optJSONArray("received");
            if (received == null) received = new JSONArray();
            if (!jsonArrayContainsInt(received, chunkIndex)) received.put(chunkIndex);
            fileMeta.put("received", received);
            manifest.put("updatedAt", System.currentTimeMillis());
            writeTextFile(getChunkManifestFile(sessionDir), manifest.toString());
        }

        JSONObject out = new JSONObject();
        out.put("success", true);
        out.put("fileIndex", fileIndex);
        out.put("chunkIndex", chunkIndex);
        return json(out);
    }

    private Response handleChunkComplete(IHTTPSession session, int section, String uploadId) throws Exception {
        File sessionDir = getChunkSessionDir(section, safeUploadId(uploadId));
        File manifestFile = getChunkManifestFile(sessionDir);
        if (!manifestFile.exists()) {
            return withCors(newFixedLengthResponse(Response.Status.NOT_FOUND, "application/json", "{\"success\":false,\"error\":\"upload-session-not-found\"}"));
        }
        JSONObject manifest = new JSONObject(readTextFile(manifestFile));
        JSONArray files = manifest.optJSONArray("files");
        if (files == null || files.length() <= 0) {
            return withCors(newFixedLengthResponse(Response.Status.BAD_REQUEST, "application/json", "{\"success\":false,\"error\":\"no-valid-files\"}"));
        }
        for (int i = 0; i < files.length(); i += 1) {
            JSONObject item = files.optJSONObject(i);
            if (item == null) continue;
            JSONArray received = item.optJSONArray("received");
            if (received == null || received.length() < item.optInt("chunks", 1)) {
                JSONObject out = chunkStatus(manifest);
                out.put("success", false);
                out.put("error", "upload-incomplete");
                return withCors(newFixedLengthResponse(Response.Status.CONFLICT, "application/json", out.toString()));
            }
            File mediaFile = new File(sessionDir, item.optString("storedName", ""));
            if (!mediaFile.exists() || mediaFile.length() != item.optLong("size", 0L)) {
                JSONObject out = chunkStatus(manifest);
                out.put("success", false);
                out.put("error", "uploaded-size-mismatch");
                return withCors(newFixedLengthResponse(Response.Status.CONFLICT, "application/json", out.toString()));
            }
        }

        if (manifestFile.exists()) manifestFile.delete();
        activateIncomingSection(sessionDir, section);

        JSONObject out = new JSONObject();
        out.put("success", true);
        out.put("section", section);
        out.put("count", files.length());
        return json(out);
    }

    private Response handleClearSectionMedia(IHTTPSession session) throws Exception {
        JSONObject body = readJsonBody(session);
        int section = safeInt(String.valueOf(body.opt("section")), 1);
        clearSectionMedia(section);
        JSONObject out = new JSONObject();
        out.put("success", true);
        out.put("section", section);
        return json(out);
    }

    private Response handleDeleteSectionMedia(IHTTPSession session) throws Exception {
        JSONObject body = readJsonBody(session);
        int section = Math.max(1, Math.min(3, safeInt(String.valueOf(body.opt("section")), 1)));
        JSONArray requested = body.optJSONArray("files");
        if (requested == null || requested.length() == 0) {
            return withCors(newFixedLengthResponse(Response.Status.BAD_REQUEST, "application/json", "{\"success\":false,\"error\":\"no-files\"}"));
        }
        Set<String> names = new HashSet<>();
        for (int i = 0; i < requested.length(); i += 1) {
            String name = new File(requested.optString(i, "")).getName();
            if (!name.isEmpty()) names.add(name);
        }
        File activeDir = resolveSectionDirectory(section);
        int deleted = 0;
        for (String name : names) {
            File file = new File(activeDir, name);
            if (file.getParentFile() != null && file.getParentFile().equals(activeDir) && file.exists() && file.isFile() && file.delete()) {
                deleted += 1;
            }
        }
        File activeFile = getSectionActiveFile(section);
        JSONObject state = readActiveSectionState(activeFile);
        if (state != null) {
            JSONArray kept = new JSONArray();
            JSONArray current = state.optJSONArray("files");
            if (current != null) {
                for (int i = 0; i < current.length(); i += 1) {
                    String name = current.optString(i, "");
                    if (!names.contains(name)) kept.put(name);
                }
            }
            state.put("files", kept);
            state.put("updatedAt", System.currentTimeMillis());
            writeTextFile(activeFile, state.toString());
        }
        JSONObject payload = new JSONObject();
        payload.put("section", section);
        payload.put("syncAt", System.currentTimeMillis());
        EmbeddedCmsRuntime.emitEvent("media-updated", payload);
        JSONObject out = new JSONObject();
        out.put("success", true);
        out.put("section", section);
        out.put("deleted", deleted);
        return json(out);
    }

    private Response handleAutoReopen(IHTTPSession session) throws Exception {
        JSONObject body = readJsonBody(session);
        boolean enabled = body.optBoolean("enabled", true);
        getKioskPrefs()
                .edit()
                .putBoolean(KEY_AUTO_REOPEN_ENABLED, enabled)
                .putBoolean(KEY_AUTO_REOPEN_MANUAL_OFF, !enabled)
                .apply();

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

    private JSONObject buildNetworkState() {
        JSONObject out = new JSONObject();
        try {
            android.net.ConnectivityManager cm = (android.net.ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            boolean connected = false;
            boolean internet = false;
            String transport = "none";
            if (cm != null) {
                android.net.Network active = cm.getActiveNetwork();
                if (active != null) {
                    android.net.NetworkCapabilities caps = cm.getNetworkCapabilities(active);
                    if (caps != null) {
                        boolean wifi = caps.hasTransport(android.net.NetworkCapabilities.TRANSPORT_WIFI);
                        boolean ethernet = caps.hasTransport(android.net.NetworkCapabilities.TRANSPORT_ETHERNET);
                        boolean cellular = caps.hasTransport(android.net.NetworkCapabilities.TRANSPORT_CELLULAR);
                        connected = wifi || ethernet || cellular;
                        internet = caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET)
                                && caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_VALIDATED);
                        if (wifi) transport = "wifi";
                        else if (ethernet) transport = "ethernet";
                        else if (cellular) transport = "cellular";
                        else transport = "other";
                    }
                }
            }
            out.put("connected", connected);
            out.put("internet", internet);
            out.put("transport", transport);
            out.put("localOnlyMode", !internet);
            out.put("origin", EmbeddedCmsRuntime.getLocalUrl());
        } catch (Exception ignored) {
        }
        return out;
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
            File dir = resolveSectionDirectory(section);
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
                item.put("url", "/media/section" + section + "/" + name + "?v=" + file.lastModified());
                item.put("type", "txt".equals(lowerExt(name)) ? "text" : "media");
                item.put("size", file.length());
                item.put("mtimeMs", file.lastModified());
                item.put("hash", shouldHashMedia(file) ? sha1(file) : "");
                array.put(item);
            }
        }
        return array;
    }

    private Response serveMedia(IHTTPSession session, String relativePath) throws Exception {
        File file = resolveMediaFile(relativePath);
        String root = getMediaRoot().getCanonicalPath();
        String target = file.getCanonicalPath();
        if (!target.startsWith(root) || !file.exists() || !file.isFile()) {
            return withCors(newFixedLengthResponse(Response.Status.NOT_FOUND, "application/json", "{\"error\":\"not-found\"}"));
        }
        long fileLength = Math.max(0L, file.length());
        String range = "";
        try {
            range = String.valueOf(session.getHeaders().get("range"));
        } catch (Exception ignored) {
        }
        if (range != null && range.toLowerCase(Locale.US).startsWith("bytes=")) {
            long start = 0L;
            long end = Math.max(0L, fileLength - 1L);
            try {
                String spec = range.substring("bytes=".length()).trim();
                int dash = spec.indexOf("-");
                if (dash >= 0) {
                    String startText = spec.substring(0, dash).trim();
                    String endText = spec.substring(dash + 1).trim();
                    if (!startText.isEmpty()) start = Long.parseLong(startText);
                    if (!endText.isEmpty()) end = Long.parseLong(endText);
                }
            } catch (Exception ignored) {
                start = 0L;
                end = Math.max(0L, fileLength - 1L);
            }
            if (start < 0L) start = 0L;
            if (target.contains("chunk-upload-section") && start >= fileLength) {
                long waitUntil = System.currentTimeMillis() + 8000L;
                while (System.currentTimeMillis() < waitUntil && file.exists() && file.length() <= start) {
                    try {
                        Thread.sleep(120L);
                    } catch (Exception ignored) {
                        break;
                    }
                }
                fileLength = Math.max(0L, file.length());
                end = Math.max(0L, fileLength - 1L);
            }
            if (end >= fileLength) end = Math.max(0L, fileLength - 1L);
            if (start > end || start >= fileLength) {
                Response response = newFixedLengthResponse(Response.Status.RANGE_NOT_SATISFIABLE, "text/plain", "");
                response.addHeader("Content-Range", "bytes */" + fileLength);
                response.addHeader("Accept-Ranges", "bytes");
                return withCors(response);
            }
            FileInputStream input = new FileInputStream(file);
            long skipped = 0L;
            while (skipped < start) {
                long step = input.skip(start - skipped);
                if (step <= 0L) break;
                skipped += step;
            }
            long contentLength = end - start + 1L;
            Response response = newFixedLengthResponse(Response.Status.PARTIAL_CONTENT, guessMime(file.getName()), input, contentLength);
            response.addHeader("Content-Length", String.valueOf(contentLength));
            response.addHeader("Content-Range", "bytes " + start + "-" + end + "/" + fileLength);
            response.addHeader("Accept-Ranges", "bytes");
            return withCors(response);
        }
        Response response = newFixedLengthResponse(Response.Status.OK, guessMime(file.getName()), new FileInputStream(file), fileLength);
        response.addHeader("Content-Length", String.valueOf(fileLength));
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

    private JSONArray uniqueStringArray(JSONArray source) {
        JSONArray out = new JSONArray();
        if (source == null) return out;
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < source.length(); i += 1) {
            String value = String.valueOf(source.opt(i)).trim();
            if (value.isEmpty() || seen.contains(value)) continue;
            seen.add(value);
            out.put(value);
        }
        return out;
    }

    private JSONObject enrichGroup(JSONObject group) throws Exception {
        JSONObject out = new JSONObject(group == null ? "{}" : group.toString());
        JSONArray devices = out.optJSONArray("devices");
        JSONArray entries = new JSONArray();
        int online = 0;
        if (devices != null) {
            JSONArray allDevices = EmbeddedCmsRuntime.getDevicesJson(context);
            Map<String, JSONObject> deviceMap = new HashMap<>();
            for (int i = 0; i < allDevices.length(); i += 1) {
                JSONObject item = allDevices.optJSONObject(i);
                if (item == null) continue;
                deviceMap.put(item.optString("deviceId", ""), item);
            }
            for (int i = 0; i < devices.length(); i += 1) {
                String id = devices.optString(i, "");
                if (id.isEmpty()) continue;
                JSONObject found = deviceMap.get(id);
                if (found != null) {
                    entries.put(found);
                    if (found.optBoolean("online", false)) online += 1;
                } else {
                    JSONObject fallback = new JSONObject();
                    fallback.put("deviceId", id);
                    fallback.put("name", id);
                    fallback.put("online", false);
                    entries.put(fallback);
                }
            }
        }
        out.put("devices", entries);
        out.put("deviceCount", entries.length());
        out.put("onlineCount", online);
        out.put("offlineCount", Math.max(0, entries.length() - online));
        return out;
    }

    private JSONArray buildGroupsWithDeviceSummary(JSONArray source) throws Exception {
        JSONArray out = new JSONArray();
        if (source == null) return out;
        for (int i = 0; i < source.length(); i += 1) {
            JSONObject item = source.optJSONObject(i);
            if (item == null) continue;
            out.put(enrichGroup(item));
        }
        return out;
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

    private File getSectionBase(int section) {
        return new File(getMediaRoot(), "section" + Math.max(1, Math.min(3, section)));
    }

    private File getSectionVersionsDir(int section) {
        File sectionBase = getSectionBase(section);
        return new File(sectionBase.getAbsolutePath() + "__versions");
    }

    private File getSectionActiveFile(int section) {
        File sectionBase = getSectionBase(section);
        return new File(sectionBase.getAbsolutePath() + "__active.txt");
    }

    private void clearSectionMedia(int section) throws Exception {
        int safeSection = Math.max(1, Math.min(3, section));
        deleteRecursively(getSectionBase(safeSection));
        deleteRecursively(getSectionVersionsDir(safeSection));
        deleteRecursively(getSectionActiveFile(safeSection));
        clearVideoCache();

        JSONObject timeline = new JSONObject();
        timeline.put("section", safeSection);
        timeline.put("cycleId", safeSection + "-cleared-" + System.currentTimeMillis());
        timeline.put("syncAt", System.currentTimeMillis());
        timeline.put("updatedAt", System.currentTimeMillis());
        timeline.put("fileCount", 0);
        timeline.put("mediaSignature", "");
        timeline.put("targetDevice", "all");

        JSONObject payload = new JSONObject();
        payload.put("section", safeSection);
        payload.put("syncAt", System.currentTimeMillis());
        payload.put("timeline", timeline);
        EmbeddedCmsRuntime.emitEvent("media-updated", payload);
    }

    private String buildVersionName() {
        return System.currentTimeMillis() + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 6);
    }

    private JSONObject readActiveSectionState(File activeFile) {
        if (activeFile == null || !activeFile.exists()) return null;
        try {
            String raw = String.valueOf(readTextFile(activeFile)).trim();
            if (raw.isEmpty()) return null;
            if (raw.startsWith("{")) {
                return new JSONObject(raw);
            }
            JSONObject out = new JSONObject();
            out.put("activeVersion", raw);
            out.put("files", new JSONArray());
            return out;
        } catch (Exception ignored) {
            return null;
        }
    }

    private File resolveSectionDirectory(int section) {
        try {
            File activeFile = getSectionActiveFile(section);
            File versionsDir = getSectionVersionsDir(section);
            JSONObject activeState = readActiveSectionState(activeFile);
            if (activeState != null && versionsDir.exists()) {
                String activeVersion = activeState.optString("activeVersion", "").trim();
                if (!activeVersion.isEmpty()) {
                    File activeDir = new File(versionsDir, activeVersion);
                    if (activeDir.exists() && activeDir.isDirectory()) return activeDir;
                }
            }
        } catch (Exception ignored) {
        }

        File directDir = getSectionBase(section);
        if (directDir.exists() && directDir.isDirectory()) return directDir;
        return directDir;
    }

    private void cleanupOldSectionVersions(File versionsDir, String keepVersion) {
        if (versionsDir == null || !versionsDir.exists() || !versionsDir.isDirectory()) return;
        File[] dirs = versionsDir.listFiles(File::isDirectory);
        if (dirs == null || dirs.length <= 1) return;
        Arrays.sort(dirs, (a, b) -> Long.compare(b.lastModified(), a.lastModified()));
        for (File dir : dirs) {
            if (dir == null) continue;
            if (dir.getName().equals(keepVersion)) continue;
            deleteRecursively(dir);
        }
    }

    private void activateIncomingSection(File incomingDir, int section) throws Exception {
        File previousDir = resolveSectionDirectory(section);
        File versionsDir = getSectionVersionsDir(section);
        File activeFile = getSectionActiveFile(section);
        if (!versionsDir.exists() && !versionsDir.mkdirs()) {
            throw new IOException("Unable to prepare section versions directory.");
        }
        String versionName = buildVersionName();
        File versionDir = new File(versionsDir, versionName);
        if (!incomingDir.renameTo(versionDir)) {
            copyDirectory(incomingDir, versionDir);
            deleteRecursively(incomingDir);
        }
        // New files replace same-named files; existing files stay available for
        // other saved schedule profiles.
        copyMissingDirectory(previousDir, versionDir);

        JSONArray files = new JSONArray();
        File[] versionFiles = versionDir.listFiles();
        if (versionFiles != null) {
            Arrays.sort(versionFiles, Comparator.comparing(File::getName, String.CASE_INSENSITIVE_ORDER));
            for (File file : versionFiles) {
                if (file != null && file.isFile() && isAllowedMedia(file.getName())) {
                    files.put(file.getName());
                }
            }
        }

        JSONObject activeState = new JSONObject();
        activeState.put("activeVersion", versionName);
        activeState.put("files", files);
        activeState.put("updatedAt", System.currentTimeMillis());
        writeTextFile(activeFile, activeState.toString());
        deleteRecursively(getSectionBase(section));
        cleanupOldSectionVersions(versionsDir, versionName);
    }

    private File resolveMediaFile(String relativePath) {
        String safeRelative = String.valueOf(relativePath == null ? "" : relativePath).trim().replace("\\", "/");
        int queryIndex = safeRelative.indexOf("?");
        if (queryIndex >= 0) {
            safeRelative = safeRelative.substring(0, queryIndex);
        }
        File direct = new File(getMediaRoot(), safeRelative);
        if (direct.exists() && direct.isFile()) return direct;

        try {
            String[] parts = safeRelative.split("/", 2);
            if (parts.length == 2 && parts[0].matches("section[1-3]")) {
                int section = safeInt(parts[0].replace("section", ""), 1);
                File activeDir = resolveSectionDirectory(section);
                File candidate = new File(activeDir, parts[1]);
                if (candidate.exists() && candidate.isFile()) return candidate;
            }
        } catch (Exception ignored) {
        }

        return direct;
    }

    private String sanitizeFileName(String raw) {
        String safe = String.valueOf(raw == null ? "media" : raw).replaceAll("[^a-zA-Z0-9._-]", "_");
        return safe.isEmpty() ? "media" : safe;
    }

    private boolean isAllowedMedia(String name) {
        String lower = String.valueOf(name).toLowerCase(Locale.US);
        return lower.endsWith(".mp4") || lower.endsWith(".m4v") || lower.endsWith(".mov") || lower.endsWith(".mkv")
                || lower.endsWith(".webm") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")
                || lower.endsWith(".png") || lower.endsWith(".txt");
    }

    private boolean isVideoMedia(String name) {
        String lower = String.valueOf(name).toLowerCase(Locale.US);
        return lower.endsWith(".mp4") || lower.endsWith(".m4v") || lower.endsWith(".mov") || lower.endsWith(".mkv")
                || lower.endsWith(".webm");
    }

    private boolean shouldHashMedia(File file) {
        try {
            return file != null && (!isVideoMedia(file.getName()) || file.length() <= MEDIA_HASH_MAX_BYTES);
        } catch (Exception ignored) {
            return false;
        }
    }

    private String lowerExt(String name) {
        int dot = name.lastIndexOf(".");
        return dot >= 0 ? name.substring(dot + 1).toLowerCase(Locale.US) : "";
    }

    private String guessMime(String name) {
        String ext = lowerExt(name);
        if ("mp4".equals(ext) || "m4v".equals(ext)) return "video/mp4";
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
        File parent = to.getParentFile();
        if (parent != null && !parent.exists() && !parent.mkdirs()) {
            throw new IOException("Unable to create directory: " + parent.getAbsolutePath());
        }
        try (InputStream input = new FileInputStream(from);
             FileOutputStream output = new FileOutputStream(to, false)) {
            byte[] buffer = new byte[1024 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) {
              output.write(buffer, 0, read);
            }
            output.flush();
        }
    }

    private File uniqueFile(File dir, String fileName) {
        File candidate = new File(dir, fileName);
        if (!candidate.exists()) return candidate;
        String name = fileName;
        String ext = "";
        int dot = fileName.lastIndexOf(".");
        if (dot > 0) {
            name = fileName.substring(0, dot);
            ext = fileName.substring(dot);
        }
        int count = 2;
        while (candidate.exists()) {
            candidate = new File(dir, name + "-" + count + ext);
            count += 1;
        }
        return candidate;
    }

    private void moveFileFast(File from, File to) throws IOException {
        File parent = to.getParentFile();
        if (parent != null && !parent.exists() && !parent.mkdirs()) {
            throw new IOException("Unable to create directory: " + parent.getAbsolutePath());
        }
        if (from.renameTo(to)) return;
        copyFile(from, to);
        try {
            if (!from.delete()) {
                from.deleteOnExit();
            }
        } catch (Exception ignored) {
        }
    }

    private void copyDirectory(File from, File to) throws IOException {
        if (from == null || !from.exists()) return;
        if (from.isDirectory()) {
            if (!to.exists() && !to.mkdirs()) {
                throw new IOException("Unable to create directory: " + to.getAbsolutePath());
            }
            File[] children = from.listFiles();
            if (children != null) {
                for (File child : children) {
                    copyDirectory(child, new File(to, child.getName()));
                }
            }
            return;
        }
        File parent = to.getParentFile();
        if (parent != null && !parent.exists() && !parent.mkdirs()) {
            throw new IOException("Unable to create directory: " + parent.getAbsolutePath());
        }
        copyFile(from, to);
    }

    private void copyMissingDirectory(File from, File to) throws IOException {
        if (from == null || !from.exists()) return;
        if (from.isDirectory()) {
            if (!to.exists() && !to.mkdirs()) {
                throw new IOException("Unable to create directory: " + to.getAbsolutePath());
            }
            File[] children = from.listFiles();
            if (children != null) {
                for (File child : children) {
                    copyMissingDirectory(child, new File(to, child.getName()));
                }
            }
            return;
        }
        if (to.exists()) return;
        File parent = to.getParentFile();
        if (parent != null && !parent.exists() && !parent.mkdirs()) {
            throw new IOException("Unable to create directory: " + parent.getAbsolutePath());
        }
        copyFile(from, to);
    }

    private void restoreBackupDirectory(File backupDir, File targetDir) throws IOException {
        if (backupDir == null || !backupDir.exists()) return;
        deleteRecursively(targetDir);
        if (!backupDir.renameTo(targetDir)) {
            copyDirectory(backupDir, targetDir);
            deleteRecursively(backupDir);
        }
    }

    private void replaceSectionDirSafely(File stagedDir, File targetDir) throws IOException {
        File parent = targetDir.getParentFile();
        if (parent != null && !parent.exists() && !parent.mkdirs()) {
            throw new IOException("Unable to prepare media directory.");
        }
        File backupDir = new File(parent, targetDir.getName() + "__backup");
        deleteRecursively(backupDir);
        boolean hadPrevious = targetDir.exists();

        try {
            if (hadPrevious && !targetDir.renameTo(backupDir)) {
                copyDirectory(targetDir, backupDir);
                deleteRecursively(targetDir);
            }

            if (!stagedDir.renameTo(targetDir)) {
                if (!targetDir.exists() && !targetDir.mkdirs()) {
                    throw new IOException("Unable to activate uploaded media.");
                }
                copyDirectory(stagedDir, targetDir);
                deleteRecursively(stagedDir);
            }

            deleteRecursively(backupDir);
        } catch (IOException error) {
            deleteRecursively(targetDir);
            if (hadPrevious) {
                restoreBackupDirectory(backupDir, targetDir);
            } else {
                deleteRecursively(backupDir);
            }
            throw error;
        } catch (RuntimeException error) {
            deleteRecursively(targetDir);
            if (hadPrevious) {
                try {
                    restoreBackupDirectory(backupDir, targetDir);
                } catch (IOException ignored) {
                }
            } else {
                deleteRecursively(backupDir);
            }
            throw error;
        }
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
        try {
            output.getFD().sync();
        } catch (Exception ignored) {
        }
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

    private long safeLong(String raw, long fallback) {
        try {
            return Long.parseLong(String.valueOf(raw == null ? "" : raw).trim());
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
            long previous = getKioskPrefs().getLong(KEY_VIDEO_CACHE_MAX_BYTES, 0L);
            getKioskPrefs().edit().putLong(KEY_VIDEO_CACHE_MAX_BYTES, bytes).apply();
            if (previous != bytes) {
                clearVideoCache();
            }
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
            Response response = newFixedLengthResponse(
                    Response.Status.OK,
                    mime,
                    new String(bytes, StandardCharsets.UTF_8)
            );
            response.addHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
            return withCors(response);
        }
        Response response = newFixedLengthResponse(Response.Status.OK, mime, new ByteArrayInputStream(bytes), bytes.length);
        response.addHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        return withCors(response);
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
        response.addHeader("Access-Control-Allow-Headers", "Content-Type, X-CMS-Password");
        response.addHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        return response;
    }
}
