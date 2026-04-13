package com.signageplayertv;

import android.provider.Settings;
import android.content.Context;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.StatFs;
import android.app.Activity;
import android.content.ClipData;

import androidx.core.content.FileProvider;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import org.json.JSONObject;
import org.json.JSONArray;

public class DeviceIdModule extends ReactContextBaseJavaModule implements ActivityEventListener {
    private static final String PREFS_NAME = "kiosk_prefs";
    private static final String KEY_AUTO_REOPEN_ENABLED = "auto_reopen_enabled";
    private static final String KEY_VIDEO_CACHE_MAX_BYTES = "video_cache_max_bytes";
    private static final int MAIN_REOPEN_REQ_CODE = 7201;
    private static final int SERVICE_REOPEN_REQ_CODE = 7202;
    private static final int PICK_MEDIA_REQ_CODE = 8101;

    private final ReactApplicationContext reactContext;
    private Promise pendingMediaPickerPromise;
    private int pendingUploadSection = 1;
    private String pendingUploadTargetsJson = "[]";

    DeviceIdModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
        EmbeddedCmsRuntime.attachReactContext(context);
        context.addActivityEventListener(this);
    }

    @Override
    public String getName() {
        return "DeviceIdModule";
    }

    @ReactMethod
    public void addListener(String eventName) {
        // Required by NativeEventEmitter on Android.
    }

    @ReactMethod
    public void removeListeners(double count) {
        // Required by NativeEventEmitter on Android.
    }

    @ReactMethod
    public void startEmbeddedCmsServer() {
        EmbeddedCmsRuntime.ensureStarted(reactContext.getApplicationContext());
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public WritableMap getCmsAccessInfo() {
        return EmbeddedCmsRuntime.getCmsAccessInfoMap(reactContext.getApplicationContext());
    }

    @ReactMethod
    public void setDeviceName(String value) {
        EmbeddedCmsRuntime.setDeviceName(reactContext.getApplicationContext(), value);
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public String getDeviceName() {
        return EmbeddedCmsRuntime.getDeviceName(reactContext.getApplicationContext());
    }

    @ReactMethod
    public void setDeviceRuntimeInfo(String json) {
        EmbeddedCmsRuntime.setRuntimeInfo(reactContext.getApplicationContext(), json);
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public String getDeviceId() {
        Context context = reactContext.getApplicationContext();
        return Settings.Secure.getString(
                context.getContentResolver(),
                Settings.Secure.ANDROID_ID
        );
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public String getAppVersion() {
        try {
            PackageManager pm = reactContext.getPackageManager();
            PackageInfo info = pm.getPackageInfo(reactContext.getPackageName(), 0);
            return String.valueOf(info.versionName);
        } catch (Exception ignored) {
            return "";
        }
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public WritableMap getStorageStats() {
        WritableMap out = Arguments.createMap();
        out.putDouble("freeBytes", 0);
        out.putDouble("totalBytes", 0);

        try {
            File dataDir = reactContext.getFilesDir();
            if (dataDir == null) return out;
            StatFs statFs = new StatFs(dataDir.getAbsolutePath());
            long blockSize = statFs.getBlockSizeLong();
            long totalBlocks = statFs.getBlockCountLong();
            long availableBlocks = statFs.getAvailableBlocksLong();
            out.putDouble("freeBytes", (double) (availableBlocks * blockSize));
            out.putDouble("totalBytes", (double) (totalBlocks * blockSize));
        } catch (Exception ignored) {
        }

        return out;
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public boolean canDrawOverlays() {
        try {
            Context context = reactContext.getApplicationContext();
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
                return true;
            }
            return Settings.canDrawOverlays(context);
        } catch (Exception ignored) {
            return false;
        }
    }

    @ReactMethod
    public void openOverlaySettings() {
        try {
            Context context = reactContext.getApplicationContext();
            Intent intent = new Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + context.getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
        } catch (Exception ignored) {
        }
    }

    @ReactMethod
    public void setAutoReopenEnabled(boolean enabled) {
        Context context = reactContext.getApplicationContext();
        android.content.SharedPreferences.Editor editor = context
                .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putBoolean(KEY_AUTO_REOPEN_ENABLED, enabled);
        editor.commit();

        if (!enabled) {
            cancelReopenAlarm(context, MAIN_REOPEN_REQ_CODE);
            cancelReopenAlarm(context, SERVICE_REOPEN_REQ_CODE);
            try {
                Activity activity = getCurrentActivity();
                if (activity instanceof MainActivity) {
                    activity.runOnUiThread(() -> {
                        try {
                            ((MainActivity) activity).cancelScheduledReopenFromJs();
                        } catch (Exception ignored) {
                        }
                    });
                }
            } catch (Exception ignored) {
            }
        }
    }

    @ReactMethod
    public void setVideoCacheMaxBytes(double bytes) {
        long value = (long) bytes;
        if (value < 64L * 1024 * 1024) value = 64L * 1024 * 1024;
        Context context = reactContext.getApplicationContext();
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putLong(KEY_VIDEO_CACHE_MAX_BYTES, value)
                .apply();
    }

    @ReactMethod
    public void clearVideoCache() {
        try {
            Context context = reactContext.getApplicationContext();
            NativeVideoPlayerView.clearVideoCache(context);
        } catch (Exception ignored) {
        }
    }

    @ReactMethod
    public void restartApp() {
        try {
            reactContext.runOnUiQueueThread(() -> {
                try {
                    Activity activity = getCurrentActivity();
                    Context appContext = reactContext.getApplicationContext();
                    Intent launchIntent = appContext.getPackageManager()
                            .getLaunchIntentForPackage(appContext.getPackageName());
                    if (launchIntent == null) return;

                    launchIntent.addFlags(
                            Intent.FLAG_ACTIVITY_NEW_TASK
                                    | Intent.FLAG_ACTIVITY_CLEAR_TOP
                                    | Intent.FLAG_ACTIVITY_CLEAR_TASK
                    );
                    appContext.startActivity(launchIntent);

                    if (activity != null) {
                        activity.finishAffinity();
                    }
                } catch (Exception ignored) {
                }
            });
        } catch (Exception ignored) {
        }
    }

    @ReactMethod
    public void installApkUpdate(String apkUrl) {
        try {
            Context appContext = reactContext.getApplicationContext();
            String safeUrl = apkUrl == null ? "" : apkUrl.trim();
            if (safeUrl.isEmpty()) return;
            String fileName = "NVA-SignagePlayerTV-update.apk";
            File apkFile = new File(appContext.getCacheDir(), fileName);
            sendApkUpdateEvent("downloading", "Downloading APK update...", 0, 0, 0, "");

            new Thread(() -> {
                HttpURLConnection connection = null;
                InputStream inputStream = null;
                FileOutputStream outputStream = null;
                try {
                    URL url = new URL(safeUrl);
                    connection = (HttpURLConnection) url.openConnection();
                    connection.setConnectTimeout(20000);
                    connection.setReadTimeout(120000);
                    connection.setUseCaches(false);
                    connection.connect();
                    int status = connection.getResponseCode();
                    if (status < 200 || status >= 300) {
                        sendApkUpdateEvent("error", "APK download failed", 0, 0, 0, "http-" + status);
                        return;
                    }
                    int contentLength = connection.getContentLength();

                    inputStream = new BufferedInputStream(connection.getInputStream());
                    outputStream = new FileOutputStream(apkFile, false);
                    byte[] buffer = new byte[64 * 1024];
                    int read;
                    long written = 0L;
                    while ((read = inputStream.read(buffer)) != -1) {
                        outputStream.write(buffer, 0, read);
                        written += read;
                        int percent = contentLength > 0
                                ? Math.max(0, Math.min(100, (int) Math.round((written * 100d) / contentLength)))
                                : 0;
                        sendApkUpdateEvent(
                                "downloading",
                                "Downloading APK update...",
                                percent,
                                written,
                                contentLength,
                                ""
                        );
                    }
                    outputStream.flush();
                    sendApkUpdateEvent("downloaded", "APK downloaded. Launching installer...", 100, written, contentLength, "");
                    final long finalWritten = written;
                    final int finalContentLength = contentLength;

                    reactContext.runOnUiQueueThread(() -> {
                        try {
                            Intent installIntent = new Intent(Intent.ACTION_VIEW);
                            android.net.Uri apkUri = FileProvider.getUriForFile(
                                    appContext,
                                    appContext.getPackageName() + ".fileprovider",
                                    apkFile
                            );
                            installIntent.setDataAndType(
                                    apkUri,
                                    "application/vnd.android.package-archive"
                            );
                            installIntent.addFlags(
                                    Intent.FLAG_ACTIVITY_NEW_TASK
                                            | Intent.FLAG_GRANT_READ_URI_PERMISSION
                            );
                            appContext.startActivity(installIntent);
                            sendApkUpdateEvent(
                                    "awaiting-confirmation",
                                    "Installer opened. Confirm update on TV if prompted.",
                                    100,
                                    finalWritten,
                                    finalContentLength,
                                    ""
                            );
                        } catch (Exception ignored) {
                            sendApkUpdateEvent("error", "Unable to open installer", 100, finalWritten, finalContentLength, "launch-failed");
                        }
                    });
                } catch (Exception ignored) {
                    sendApkUpdateEvent("error", "APK update failed", 0, 0, 0, String.valueOf(ignored.getMessage()));
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
            }).start();
        } catch (Exception ignored) {
        }
    }

    private void sendApkUpdateEvent(
            String status,
            String message,
            int percent,
            long receivedBytes,
            long totalBytes,
            String detail
    ) {
        try {
            WritableMap payload = Arguments.createMap();
            payload.putString("status", String.valueOf(status));
            payload.putString("message", String.valueOf(message));
            payload.putInt("percent", Math.max(0, Math.min(100, percent)));
            payload.putDouble("receivedBytes", (double) Math.max(0L, receivedBytes));
            payload.putDouble("totalBytes", (double) Math.max(0L, totalBytes));
            payload.putString("detail", detail == null ? "" : detail);
            reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit("apkUpdateProgress", payload);
            try {
                JSONObject patch = new JSONObject();
                JSONObject apk = new JSONObject();
                apk.put("status", String.valueOf(status));
                apk.put("message", String.valueOf(message));
                apk.put("percent", Math.max(0, Math.min(100, percent)));
                apk.put("detail", detail == null ? "" : detail);
                patch.put("apkUpdate", apk);
                EmbeddedCmsRuntime.mergeRuntimeInfo(reactContext.getApplicationContext(), patch);
            } catch (Exception ignoredToo) {
            }
        } catch (Exception ignored) {
        }
    }

    @ReactMethod
    public void pickAndUploadMediaFiles(double sectionValue, String targetOriginsJson, Promise promise) {
        try {
            if (pendingMediaPickerPromise != null) {
                promise.reject("picker_busy", "Another file picker request is already running.");
                return;
            }

            Activity activity = getCurrentActivity();
            if (activity == null) {
                promise.reject("no_activity", "TV activity is not available.");
                return;
            }

            int section = (int) Math.max(1, Math.min(3, Math.round(sectionValue)));
            pendingUploadSection = section;
            pendingUploadTargetsJson = targetOriginsJson == null ? "[]" : targetOriginsJson;
            pendingMediaPickerPromise = promise;

            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("*/*");
            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            String[] mimeTypes = new String[]{
                    "video/*",
                    "image/*",
                    "text/plain",
                    "application/pdf",
                    "application/vnd.ms-powerpoint",
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            };
            intent.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes);
            activity.startActivityForResult(Intent.createChooser(intent, "Select media files"), PICK_MEDIA_REQ_CODE);
        } catch (Exception e) {
            pendingMediaPickerPromise = null;
            promise.reject("picker_launch_failed", String.valueOf(e.getMessage()));
        }
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public WritableMap getNetworkState() {
        WritableMap out = Arguments.createMap();
        out.putBoolean("connected", false);
        out.putBoolean("internet", false);
        out.putString("transport", "none");

        try {
            ConnectivityManager cm = (ConnectivityManager) reactContext.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return out;

            Network active = cm.getActiveNetwork();
            if (active == null) return out;

            NetworkCapabilities caps = cm.getNetworkCapabilities(active);
            if (caps == null) return out;

            boolean hasInternet = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
            boolean validated = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
            boolean wifi = caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI);
            boolean cellular = caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR);
            boolean ethernet = caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET);

            out.putBoolean("connected", wifi || cellular || ethernet);
            out.putBoolean("internet", hasInternet && validated);
            if (wifi) out.putString("transport", "wifi");
            else if (ethernet) out.putString("transport", "ethernet");
            else if (cellular) out.putString("transport", "cellular");
            else out.putString("transport", "other");
        } catch (Exception ignored) {
        }

        return out;
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public WritableMap tryRecoverInternet() {
        WritableMap out = Arguments.createMap();
        out.putBoolean("attempted", true);
        out.putBoolean("wifiEnabled", false);
        out.putBoolean("reassociateCalled", false);
        out.putBoolean("reconnectCalled", false);
        out.putString("note", "");

        try {
            WifiManager wifiManager = (WifiManager) reactContext.getApplicationContext()
                    .getSystemService(Context.WIFI_SERVICE);
            if (wifiManager == null) {
                out.putString("note", "wifi-manager-unavailable");
                return out;
            }

            boolean enabled = wifiManager.isWifiEnabled();
            if (!enabled && Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                enabled = wifiManager.setWifiEnabled(true);
            }
            out.putBoolean("wifiEnabled", enabled);

            try {
                wifiManager.reassociate();
                out.putBoolean("reassociateCalled", true);
            } catch (Exception ignored) {
            }

            try {
                wifiManager.reconnect();
                out.putBoolean("reconnectCalled", true);
            } catch (Exception ignored) {
            }

            if (!enabled && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                out.putString("note", "android-q-plus-wifi-toggle-restricted");
            } else {
                out.putString("note", "wifi-recovery-triggered");
            }
        } catch (Exception e) {
            out.putString("note", "recovery-error:" + String.valueOf(e.getMessage()));
        }

        return out;
    }

    private void cancelReopenAlarm(Context context, int requestCode) {
        try {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) return;

            // Cancel activity-based reopen (current behavior)
            Intent activityIntent = new Intent(context, MainActivity.class);
            activityIntent.setAction(Intent.ACTION_MAIN);
            activityIntent.addCategory(Intent.CATEGORY_LEANBACK_LAUNCHER);
            activityIntent.addCategory(Intent.CATEGORY_LAUNCHER);
            activityIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent activityPending = PendingIntent.getActivity(
                    context,
                    requestCode,
                    activityIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            alarmManager.cancel(activityPending);

            // Best-effort cleanup for older broadcast-based reopen.
            Intent reopenIntent = new Intent(context, ReopenReceiver.class);
            PendingIntent broadcastPending = PendingIntent.getBroadcast(
                    context,
                    requestCode,
                    reopenIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            alarmManager.cancel(broadcastPending);
        } catch (Exception ignored) {
            // Best-effort cleanup. Preference remains source of truth.
        }
    }

    @Override
    public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
        if (requestCode != PICK_MEDIA_REQ_CODE) return;

        Promise promise = pendingMediaPickerPromise;
        pendingMediaPickerPromise = null;

        if (promise == null) return;
        if (resultCode != Activity.RESULT_OK || data == null) {
            promise.reject("picker_cancelled", "File selection cancelled.");
            return;
        }

        try {
            List<SelectedUploadFile> pickedFiles = new ArrayList<>();
            ClipData clipData = data.getClipData();
            if (clipData != null && clipData.getItemCount() > 0) {
                for (int i = 0; i < clipData.getItemCount(); i += 1) {
                    SelectedUploadFile item = createSelectedUploadFile(clipData.getItemAt(i).getUri());
                    if (item != null) pickedFiles.add(item);
                }
            } else {
                SelectedUploadFile item = createSelectedUploadFile(data.getData());
                if (item != null) pickedFiles.add(item);
            }

            if (pickedFiles.isEmpty()) {
                promise.reject("no_valid_files", "No supported files were selected.");
                return;
            }

            List<String> targetOrigins = parseTargetOrigins(pendingUploadTargetsJson);
            if (targetOrigins.isEmpty()) {
                targetOrigins.add("http://127.0.0.1:8080");
            }
            for (String origin : targetOrigins) {
                uploadFilesToOrigin(origin, pendingUploadSection, pickedFiles);
            }

            try {
                NativeVideoPlayerView.clearVideoCache(reactContext.getApplicationContext());
            } catch (Exception ignored) {
            }

            JSONObject payload = new JSONObject();
            payload.put("section", pendingUploadSection);
            payload.put("count", pickedFiles.size());
            EmbeddedCmsRuntime.emitEvent("media-updated", payload);

            WritableMap out = Arguments.createMap();
            out.putBoolean("success", true);
            out.putInt("section", pendingUploadSection);
            out.putInt("count", pickedFiles.size());
            out.putInt("targets", targetOrigins.size());
            promise.resolve(out);
        } catch (Exception e) {
            promise.reject("upload_failed", String.valueOf(e.getMessage()));
        }
    }

    @Override
    public void onNewIntent(Intent intent) {
        // no-op
    }

    private SelectedUploadFile createSelectedUploadFile(Uri uri) {
        if (uri == null) return null;
        try {
            String safeName = sanitizeFileName(resolveDisplayName(uri));
            if (!isAllowedMedia(safeName)) return null;
            return new SelectedUploadFile(uri, safeName);
        } catch (Exception ignored) {
            return null;
        }
    }

    private List<String> parseTargetOrigins(String rawJson) {
        List<String> targets = new ArrayList<>();
        try {
            JSONArray array = new JSONArray(rawJson == null ? "[]" : rawJson);
            for (int i = 0; i < array.length(); i += 1) {
                String value = String.valueOf(array.optString(i, "")).trim();
                if (value.isEmpty()) continue;
                targets.add(value.replaceAll("/+$", ""));
            }
        } catch (Exception ignored) {
        }
        return targets;
    }

    private void uploadFilesToOrigin(String origin, int section, List<SelectedUploadFile> files) throws Exception {
        String safeOrigin = String.valueOf(origin == null ? "" : origin).trim().replaceAll("/+$", "");
        if (safeOrigin.isEmpty()) {
            throw new Exception("Upload target is empty.");
        }
        String boundary = "----SignageTvBoundary" + System.currentTimeMillis();
        HttpURLConnection connection = null;
        OutputStream rawOutput = null;
        BufferedOutputStream output = null;
        InputStream inputStream = null;
        try {
            URL url = new URL(safeOrigin + "/upload?section=" + section);
            connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(20000);
            connection.setReadTimeout(120000);
            connection.setUseCaches(false);
            connection.setDoOutput(true);
            connection.setRequestMethod("POST");
            connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);

            rawOutput = connection.getOutputStream();
            output = new BufferedOutputStream(rawOutput);

            boolean containsPpt = false;
            for (SelectedUploadFile file : files) {
                if (isPptFile(file.fileName)) {
                    containsPpt = true;
                    break;
                }
            }
            if (containsPpt) {
                writeTextPart(output, boundary, "containsPpt", "1");
            }

            for (SelectedUploadFile file : files) {
                writeFilePart(output, boundary, file);
            }
            writeClosingBoundary(output, boundary);
            output.flush();

            int status = connection.getResponseCode();
            inputStream = status >= 200 && status < 300
                    ? connection.getInputStream()
                    : connection.getErrorStream();
            String responseText = readStreamText(inputStream);
            if (status < 200 || status >= 300) {
                throw new Exception("Upload failed for " + safeOrigin + " (HTTP " + status + "): " + responseText);
            }
        } finally {
            try {
                if (inputStream != null) inputStream.close();
            } catch (Exception ignored) {
            }
            try {
                if (output != null) output.close();
            } catch (Exception ignored) {
            }
            try {
                if (rawOutput != null) rawOutput.close();
            } catch (Exception ignored) {
            }
            try {
                if (connection != null) connection.disconnect();
            } catch (Exception ignored) {
            }
        }
    }

    private void writeTextPart(OutputStream output, String boundary, String name, String value) throws Exception {
        output.write(("--" + boundary + "\r\n").getBytes("UTF-8"));
        output.write(("Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n").getBytes("UTF-8"));
        output.write(String.valueOf(value == null ? "" : value).getBytes("UTF-8"));
        output.write("\r\n".getBytes("UTF-8"));
    }

    private void writeFilePart(OutputStream output, String boundary, SelectedUploadFile file) throws Exception {
        output.write(("--" + boundary + "\r\n").getBytes("UTF-8"));
        output.write(("Content-Disposition: form-data; name=\"file" + System.nanoTime() + "\"; filename=\"" + file.fileName + "\"\r\n").getBytes("UTF-8"));
        output.write(("Content-Type: " + resolveMimeType(file.fileName) + "\r\n\r\n").getBytes("UTF-8"));

        InputStream input = null;
        try {
            input = reactContext.getContentResolver().openInputStream(file.uri);
            if (input == null) {
                throw new Exception("Unable to read selected file: " + file.fileName);
            }
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
        } finally {
            try {
                if (input != null) input.close();
            } catch (Exception ignored) {
            }
        }

        output.write("\r\n".getBytes("UTF-8"));
    }

    private void writeClosingBoundary(OutputStream output, String boundary) throws Exception {
        output.write(("--" + boundary + "--\r\n").getBytes("UTF-8"));
    }

    private String resolveMimeType(String fileName) {
        String lower = String.valueOf(fileName == null ? "" : fileName).toLowerCase(Locale.US);
        if (lower.endsWith(".mp4")) return "video/mp4";
        if (lower.endsWith(".mov")) return "video/quicktime";
        if (lower.endsWith(".mkv")) return "video/x-matroska";
        if (lower.endsWith(".webm")) return "video/webm";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".txt")) return "text/plain";
        if (lower.endsWith(".pdf")) return "application/pdf";
        if (lower.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
        if (lower.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
        if (lower.endsWith(".pptm")) return "application/vnd.ms-powerpoint.presentation.macroEnabled.12";
        if (lower.endsWith(".pps")) return "application/vnd.ms-powerpoint";
        if (lower.endsWith(".ppsx")) return "application/vnd.openxmlformats-officedocument.presentationml.slideshow";
        if (lower.endsWith(".potx")) return "application/vnd.openxmlformats-officedocument.presentationml.template";
        return "application/octet-stream";
    }

    private boolean isPptFile(String fileName) {
        String lower = String.valueOf(fileName == null ? "" : fileName).toLowerCase(Locale.US);
        return lower.endsWith(".ppt") || lower.endsWith(".pptx") || lower.endsWith(".pptm")
                || lower.endsWith(".pps") || lower.endsWith(".ppsx") || lower.endsWith(".potx");
    }

    private String readStreamText(InputStream inputStream) {
        if (inputStream == null) return "";
        try {
            byte[] buffer = new byte[8 * 1024];
            StringBuilder builder = new StringBuilder();
            int read;
            while ((read = inputStream.read(buffer)) != -1) {
                builder.append(new String(buffer, 0, read, "UTF-8"));
            }
            return builder.toString().trim();
        } catch (Exception ignored) {
            return "";
        }
    }

    private static class SelectedUploadFile {
        final Uri uri;
        final String fileName;

        SelectedUploadFile(Uri uri, String fileName) {
            this.uri = uri;
            this.fileName = fileName;
        }
    }

    private String resolveDisplayName(Uri uri) {
        try {
            String last = String.valueOf(uri.getLastPathSegment() == null ? "" : uri.getLastPathSegment()).trim();
            if (!last.isEmpty()) {
                int slash = last.lastIndexOf('/');
                if (slash >= 0 && slash < last.length() - 1) {
                    last = last.substring(slash + 1);
                }
                return last;
            }
        } catch (Exception ignored) {
        }
        return "media-" + System.currentTimeMillis();
    }

    private String sanitizeFileName(String raw) {
        String safe = String.valueOf(raw == null ? "media" : raw).replaceAll("[^a-zA-Z0-9._-]", "_");
        return safe.isEmpty() ? "media" : safe;
    }

    private boolean isAllowedMedia(String name) {
        String lower = String.valueOf(name == null ? "" : name).toLowerCase(Locale.US);
        return lower.endsWith(".mp4") || lower.endsWith(".mov") || lower.endsWith(".mkv")
                || lower.endsWith(".webm") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")
                || lower.endsWith(".png") || lower.endsWith(".txt") || lower.endsWith(".pdf")
                || lower.endsWith(".ppt") || lower.endsWith(".pptx") || lower.endsWith(".pptm")
                || lower.endsWith(".pps") || lower.endsWith(".ppsx") || lower.endsWith(".potx");
    }

    private void deleteRecursively(File file) {
        if (file == null || !file.exists()) return;
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteRecursively(child);
                }
            }
        }
        try {
            if (!file.delete() && file.exists()) {
                file.deleteOnExit();
            }
        } catch (Exception ignored) {
        }
    }
}
