package com.signageplayertv;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.net.ConnectivityManager;
import android.net.LinkAddress;
import android.net.LinkProperties;
import android.net.Network;
import android.net.wifi.WifiManager;
import android.os.StatFs;
import android.provider.Settings;
import android.text.TextUtils;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import fi.iki.elonen.NanoHTTPD;

import org.json.JSONArray;
import org.json.JSONObject;

import java.lang.ref.WeakReference;
import java.io.File;
import java.net.InetAddress;
import java.net.Inet4Address;
import java.net.NetworkInterface;
import java.util.Collections;
import java.util.Enumeration;
import java.util.Locale;

public final class EmbeddedCmsRuntime {
    public static final String PREFS_NAME = "embedded_cms_prefs";
    public static final String KEY_DEVICE_NAME = "device_name";
    public static final String KEY_RUNTIME_INFO = "runtime_info";
    public static final String KEY_HOSTNAME = "cms_hostname";
    public static final int DEFAULT_SERVER_PORT = 8080;
    private static final int[] SERVER_PORT_CANDIDATES = new int[]{8080, 8081, 9090, 10080};

    private static final Object LOCK = new Object();
    private static WeakReference<ReactApplicationContext> reactContextRef = new WeakReference<>(null);
    private static TvDiscoveryManager discoveryManager;
    private static EmbeddedCmsServer server;
    private static int currentServerPort = DEFAULT_SERVER_PORT;

    private EmbeddedCmsRuntime() {
    }

    public static void attachReactContext(ReactApplicationContext context) {
        reactContextRef = new WeakReference<>(context);
        ensureStarted(context.getApplicationContext());
    }

    public static void ensureStarted(Context context) {
        synchronized (LOCK) {
            Context appContext = context.getApplicationContext();
            if (server == null) {
                for (int port : SERVER_PORT_CANDIDATES) {
                    EmbeddedCmsServer candidate = new EmbeddedCmsServer(appContext, port);
                    try {
                        candidate.start(NanoHTTPD.SOCKET_READ_TIMEOUT, false);
                        server = candidate;
                        currentServerPort = port;
                        break;
                    } catch (Exception ignored) {
                        try {
                            candidate.stop();
                        } catch (Exception ignoredToo) {
                        }
                    }
                }
            }
            if (discoveryManager == null) {
                discoveryManager = new TvDiscoveryManager(appContext);
                discoveryManager.start();
            }
        }
    }

    public static SharedPreferences getPrefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public static String getDeviceId(Context context) {
        String value = Settings.Secure.getString(
                context.getApplicationContext().getContentResolver(),
                Settings.Secure.ANDROID_ID
        );
        return value == null ? "unknown" : value;
    }

    public static String getDefaultDeviceName() {
        String model = android.os.Build.MODEL == null ? "Android TV" : android.os.Build.MODEL.trim();
        return model.isEmpty() ? "Android TV" : model;
    }

    public static String getDeviceName(Context context) {
        String saved = String.valueOf(getPrefs(context).getString(KEY_DEVICE_NAME, "")).trim();
        return saved.isEmpty() ? getDefaultDeviceName() : saved;
    }

    public static void setDeviceName(Context context, String value) {
        String next = String.valueOf(value == null ? "" : value).trim();
        if (next.isEmpty()) next = getDefaultDeviceName();
        getPrefs(context).edit().putString(KEY_DEVICE_NAME, next).apply();
        getPrefs(context).edit().putString(KEY_HOSTNAME, buildHostName(context)).apply();
        if (discoveryManager != null) discoveryManager.restartAdvertising();
        emitEvent("device-name-updated", buildSelfStatus(context));
    }

    public static String sanitizeHostLabel(String value) {
        String lower = String.valueOf(value == null ? "" : value).trim().toLowerCase(Locale.US);
        lower = lower.replaceAll("[^a-z0-9]+", "-");
        lower = lower.replaceAll("^-+", "").replaceAll("-+$", "");
        return lower.isEmpty() ? "android-tv" : lower;
    }

    private static String buildHostName(Context context) {
        String suffix = getDeviceId(context);
        if (suffix.length() > 6) {
            suffix = suffix.substring(Math.max(0, suffix.length() - 6));
        }
        return sanitizeHostLabel(getDeviceName(context)) + "-" + suffix + ".local";
    }

    public static String getLocalHostName(Context context) {
        String saved = String.valueOf(getPrefs(context).getString(KEY_HOSTNAME, "")).trim();
        if (!saved.isEmpty()) return saved;
        String host = buildHostName(context);
        getPrefs(context).edit().putString(KEY_HOSTNAME, host).apply();
        return host;
    }

    public static String getIpAddress(Context context) {
        String activeIp = getActiveNetworkIpv4(context);
        if (!activeIp.isEmpty()) return activeIp;

        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            for (NetworkInterface intf : Collections.list(interfaces)) {
                try {
                    if (!intf.isUp() || intf.isLoopback() || intf.isVirtual()) continue;
                } catch (Exception ignored) {
                }
                String name = String.valueOf(intf.getName()).toLowerCase(Locale.US);
                if (!(name.startsWith("wlan") || name.startsWith("eth") || name.startsWith("en"))) {
                    continue;
                }
                Enumeration<InetAddress> addrs = intf.getInetAddresses();
                for (InetAddress addr : Collections.list(addrs)) {
                    String host = sanitizeIpv4(addr);
                    if (host.isEmpty()) continue;
                    return host;
                }
            }
        } catch (Exception ignored) {
        }
        try {
            WifiManager wifiManager = (WifiManager) context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wifiManager != null && wifiManager.getConnectionInfo() != null) {
                int ip = wifiManager.getConnectionInfo().getIpAddress();
                if (ip != 0) {
                    return String.format(
                            Locale.US,
                            "%d.%d.%d.%d",
                            (ip & 0xff),
                            (ip >> 8 & 0xff),
                            (ip >> 16 & 0xff),
                            (ip >> 24 & 0xff)
                    );
                }
            }
        } catch (Exception ignored) {
        }
        return "";
    }

    private static String getActiveNetworkIpv4(Context context) {
        try {
            ConnectivityManager cm = (ConnectivityManager) context.getApplicationContext()
                    .getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return "";
            Network active = cm.getActiveNetwork();
            if (active == null) return "";
            LinkProperties properties = cm.getLinkProperties(active);
            if (properties == null) return "";
            for (LinkAddress linkAddress : properties.getLinkAddresses()) {
                String host = sanitizeIpv4(linkAddress == null ? null : linkAddress.getAddress());
                if (!host.isEmpty()) return host;
            }
        } catch (Exception ignored) {
        }
        return "";
    }

    private static String sanitizeIpv4(InetAddress address) {
        if (!(address instanceof Inet4Address)) return "";
        if (address.isLoopbackAddress() || address.isLinkLocalAddress()) return "";
        String host = address.getHostAddress();
        if (host == null || host.trim().isEmpty()) return "";
        return host;
    }

    public static String getPublicUrl(Context context) {
        String ip = getIpAddress(context);
        return ip.isEmpty() ? "" : "http://" + ip + ":" + getServerPort();
    }

    public static int getServerPort() {
        synchronized (LOCK) {
            return currentServerPort;
        }
    }

    public static String getLocalUrl() {
        return "http://127.0.0.1:" + getServerPort();
    }

    public static JSONObject getRuntimeInfo(Context context) {
        String raw = String.valueOf(getPrefs(context).getString(KEY_RUNTIME_INFO, "")).trim();
        if (raw.isEmpty()) return new JSONObject();
        try {
            return new JSONObject(raw);
        } catch (Exception ignored) {
            return new JSONObject();
        }
    }

    public static void setRuntimeInfo(Context context, String json) {
        getPrefs(context).edit().putString(KEY_RUNTIME_INFO, String.valueOf(json == null ? "" : json)).apply();
    }

    public static void mergeRuntimeInfo(Context context, JSONObject patch) {
        try {
            JSONObject current = getRuntimeInfo(context);
            JSONArray names = patch.names();
            if (names == null) return;
            for (int i = 0; i < names.length(); i += 1) {
                String key = names.optString(i, "");
                if (key.isEmpty()) continue;
                current.put(key, patch.opt(key));
            }
            setRuntimeInfo(context, current.toString());
        } catch (Exception ignored) {
        }
    }

    public static JSONObject buildSelfStatus(Context context) {
        ensureStarted(context);
        JSONObject out = new JSONObject();
        try {
            JSONObject runtime = getRuntimeInfo(context);
            JSONObject meta = runtime.optJSONObject("meta");
            if (meta == null) meta = new JSONObject();
            long freeBytes = 0L;
            long totalBytes = 0L;
            try {
                StatFs statFs = new StatFs(context.getFilesDir().getAbsolutePath());
                freeBytes = statFs.getAvailableBytes();
                totalBytes = statFs.getTotalBytes();
            } catch (Exception ignored) {
            }
            meta.put("server", getPublicUrl(context));
            meta.put("localServer", getLocalUrl());
            meta.put("appVersion", getAppVersion(context));
            meta.put("freeBytes", freeBytes);
            meta.put("totalBytes", totalBytes);
            meta.put("mediaBytes", dirSize(new File(context.getFilesDir(), "cms-media")));
            meta.put("configBytes", fileSize(new File(context.getFilesDir(), "config.json")));
            meta.put("cacheBytes", dirSize(context.getCacheDir()));

            out.put("name", getDeviceName(context));
            out.put("deviceId", getDeviceId(context));
            out.put("ip", getIpAddress(context));
            out.put("hostname", getLocalHostName(context));
            out.put("localUrl", getLocalUrl());
            out.put("publicUrl", getPublicUrl(context));
            out.put("status", "online");
            out.put("online", true);
            out.put("port", getServerPort());
            out.put("lastSeen", System.currentTimeMillis());
            out.put("appState", runtime.optString("appState", "running"));
            out.put("runtime", runtime);
            out.put("meta", meta);
        } catch (Exception ignored) {
        }
        return out;
    }

    private static String getAppVersion(Context context) {
        try {
            PackageInfo info = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            return String.valueOf(info.versionName == null ? "" : info.versionName);
        } catch (Exception ignored) {
            return "";
        }
    }

    private static long fileSize(File file) {
        try {
            return file != null && file.isFile() ? Math.max(0L, file.length()) : 0L;
        } catch (Exception ignored) {
            return 0L;
        }
    }

    private static long dirSize(File file) {
        try {
            if (file == null || !file.exists()) return 0L;
            if (file.isFile()) return Math.max(0L, file.length());
            long total = 0L;
            File[] children = file.listFiles();
            if (children == null) return 0L;
            for (File child : children) {
                total += dirSize(child);
            }
            return total;
        } catch (Exception ignored) {
            return 0L;
        }
    }

    public static JSONArray getDevicesJson(Context context) {
        ensureStarted(context);
        JSONArray array = new JSONArray();
        array.put(buildSelfStatus(context));
        if (discoveryManager != null) {
            JSONArray discovered = discoveryManager.getDiscoveredDevices();
            for (int i = 0; i < discovered.length(); i += 1) {
                JSONObject item = discovered.optJSONObject(i);
                if (item == null) continue;
                String deviceId = item.optString("deviceId", "");
                if (!TextUtils.isEmpty(deviceId) && deviceId.equals(getDeviceId(context))) continue;
                array.put(item);
            }
        }
        return array;
    }

    public static WritableMap getCmsAccessInfoMap(Context context) {
        JSONObject status = buildSelfStatus(context);
        WritableMap map = Arguments.createMap();
        map.putString("deviceId", status.optString("deviceId", ""));
        map.putString("deviceName", status.optString("name", ""));
        map.putString("ipAddress", status.optString("ip", ""));
        map.putString("hostname", status.optString("hostname", ""));
        map.putString("localUrl", status.optString("localUrl", ""));
        map.putString("publicUrl", status.optString("publicUrl", ""));
        map.putString("qrDataUri", QrCodeHelper.buildQrDataUri(status.optString("publicUrl", "")));
        return map;
    }

    public static void emitEvent(String type, JSONObject payload) {
        try {
            ReactApplicationContext reactContext = reactContextRef.get();
            if (reactContext == null || !reactContext.hasActiveReactInstance()) return;
            WritableMap event = Arguments.createMap();
            event.putString("type", String.valueOf(type));
            event.putString("payload", payload == null ? "{}" : payload.toString());
            reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit("embeddedCmsEvent", event);
        } catch (Exception ignored) {
        }
    }

    public static WritableMap jsonObjectToWritableMap(JSONObject object) {
        WritableMap map = Arguments.createMap();
        if (object == null) return map;
        JSONArray names = object.names();
        if (names == null) return map;
        for (int i = 0; i < names.length(); i += 1) {
            String key = names.optString(i, "");
            if (key.isEmpty()) continue;
            Object value = object.opt(key);
            if (value == null || value == JSONObject.NULL) {
                map.putNull(key);
            } else if (value instanceof Boolean) {
                map.putBoolean(key, (Boolean) value);
            } else if (value instanceof Integer) {
                map.putInt(key, (Integer) value);
            } else if (value instanceof Long) {
                map.putDouble(key, ((Long) value).doubleValue());
            } else if (value instanceof Double) {
                map.putDouble(key, (Double) value);
            } else if (value instanceof Float) {
                map.putDouble(key, ((Float) value).doubleValue());
            } else if (value instanceof JSONObject) {
                map.putMap(key, jsonObjectToWritableMap((JSONObject) value));
            } else if (value instanceof JSONArray) {
                map.putArray(key, jsonArrayToWritableArray((JSONArray) value));
            } else {
                map.putString(key, String.valueOf(value));
            }
        }
        return map;
    }

    public static WritableArray jsonArrayToWritableArray(JSONArray array) {
        WritableArray out = Arguments.createArray();
        if (array == null) return out;
        for (int i = 0; i < array.length(); i += 1) {
            Object value = array.opt(i);
            if (value == null || value == JSONObject.NULL) {
                out.pushNull();
            } else if (value instanceof Boolean) {
                out.pushBoolean((Boolean) value);
            } else if (value instanceof Integer) {
                out.pushInt((Integer) value);
            } else if (value instanceof Long) {
                out.pushDouble(((Long) value).doubleValue());
            } else if (value instanceof Double) {
                out.pushDouble((Double) value);
            } else if (value instanceof Float) {
                out.pushDouble(((Float) value).doubleValue());
            } else if (value instanceof JSONObject) {
                out.pushMap(jsonObjectToWritableMap((JSONObject) value));
            } else if (value instanceof JSONArray) {
                out.pushArray(jsonArrayToWritableArray((JSONArray) value));
            } else {
                out.pushString(String.valueOf(value));
            }
        }
        return out;
    }
}
