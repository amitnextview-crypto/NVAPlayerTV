package com.signageplayertv;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.URL;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class TvDiscoveryManager {
    private static final String SERVICE_TYPE = "_tv._tcp.";
    private static final long DISCOVERY_STALE_MS = 30000L;
    private static final int[] FALLBACK_SCAN_PORTS = new int[]{8080, 8081, 9090, 10080};

    private final Context context;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Map<String, JSONObject> discoveredByIp = new ConcurrentHashMap<>();

    private NsdManager nsdManager;
    private NsdManager.RegistrationListener registrationListener;
    private NsdManager.DiscoveryListener discoveryListener;
    private boolean started = false;

    public TvDiscoveryManager(Context context) {
        this.context = context.getApplicationContext();
    }

    public synchronized void start() {
        if (started) return;
        nsdManager = (NsdManager) context.getSystemService(Context.NSD_SERVICE);
        if (nsdManager == null) return;
        started = true;
        registerService();
        discoverServices();
        probeLocalSubnet();
    }

    public synchronized void restartAdvertising() {
        if (!started || nsdManager == null) return;
        try {
            if (registrationListener != null) {
                nsdManager.unregisterService(registrationListener);
            }
        } catch (Exception ignored) {
        }
        registerService();
        probeLocalSubnet();
    }

    private void probeLocalSubnet() {
        executor.execute(() -> {
            try {
                String ip = EmbeddedCmsRuntime.getIpAddress(context);
                String[] parts = String.valueOf(ip).trim().split("\\.");
                if (parts.length != 4) return;
                String prefix = parts[0] + "." + parts[1] + "." + parts[2] + ".";
                String selfId = EmbeddedCmsRuntime.getDeviceId(context);
                for (int host = 1; host < 255; host += 1) {
                    String candidateIp = prefix + host;
                    if (candidateIp.equals(ip)) continue;
                    for (int port : FALLBACK_SCAN_PORTS) {
                        JSONObject status = fetchStatusSync(candidateIp, port);
                        if (status == null) continue;
                        String deviceId = status.optString("deviceId", "");
                        if (!deviceId.isEmpty() && deviceId.equals(selfId)) continue;
                        discoveredByIp.put(candidateIp, status);
                        break;
                    }
                }
            } catch (Exception ignored) {
            }
        });
    }

    private void registerService() {
        if (nsdManager == null) return;
        NsdServiceInfo serviceInfo = new NsdServiceInfo();
        serviceInfo.setServiceType(SERVICE_TYPE);
        serviceInfo.setPort(EmbeddedCmsRuntime.getServerPort());
        serviceInfo.setServiceName(buildServiceName());
        registrationListener = new NsdManager.RegistrationListener() {
            @Override
            public void onServiceRegistered(NsdServiceInfo serviceInfo) {
            }

            @Override
            public void onRegistrationFailed(NsdServiceInfo serviceInfo, int errorCode) {
            }

            @Override
            public void onServiceUnregistered(NsdServiceInfo serviceInfo) {
            }

            @Override
            public void onUnregistrationFailed(NsdServiceInfo serviceInfo, int errorCode) {
            }
        };
        try {
            nsdManager.registerService(serviceInfo, NsdManager.PROTOCOL_DNS_SD, registrationListener);
        } catch (Exception ignored) {
        }
    }

    private void discoverServices() {
        if (nsdManager == null) return;
        discoveryListener = new NsdManager.DiscoveryListener() {
            @Override
            public void onDiscoveryStarted(String regType) {
            }

            @Override
            public void onServiceFound(NsdServiceInfo service) {
                if (!SERVICE_TYPE.equals(service.getServiceType())) return;
                if (buildServiceName().equals(service.getServiceName())) return;
                resolveService(service);
            }

            @Override
            public void onServiceLost(NsdServiceInfo service) {
                String key = service.getHost() != null ? service.getHost().getHostAddress() : service.getServiceName();
                if (key == null) return;
                discoveredByIp.remove(key);
            }

            @Override
            public void onDiscoveryStopped(String serviceType) {
            }

            @Override
            public void onStartDiscoveryFailed(String serviceType, int errorCode) {
            }

            @Override
            public void onStopDiscoveryFailed(String serviceType, int errorCode) {
            }
        };
        try {
            nsdManager.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, discoveryListener);
        } catch (Exception ignored) {
        }
    }

    private void resolveService(NsdServiceInfo serviceInfo) {
        if (nsdManager == null) return;
        try {
            nsdManager.resolveService(serviceInfo, new NsdManager.ResolveListener() {
                @Override
                public void onResolveFailed(NsdServiceInfo serviceInfo, int errorCode) {
                }

                @Override
                public void onServiceResolved(NsdServiceInfo resolved) {
                    InetAddress host = resolved.getHost();
                    if (host == null) return;
                    String ip = host.getHostAddress();
                    if (ip == null || ip.contains(":")) return;
                    fetchStatus(ip, resolved.getPort());
                }
            });
        } catch (Exception ignored) {
        }
    }

    private void fetchStatus(final String ip, final int port) {
        executor.execute(() -> {
            try {
                JSONObject status = fetchStatusSync(ip, port);
                if (status != null) {
                    discoveredByIp.put(ip, status);
                } else {
                    discoveredByIp.remove(ip);
                }
            } catch (Exception ignored) {
                discoveredByIp.remove(ip);
            }
        });
    }

    private JSONObject fetchStatusSync(String ip, int port) {
        HttpURLConnection connection = null;
        try {
            int safePort = port > 0 ? port : EmbeddedCmsRuntime.DEFAULT_SERVER_PORT;
            URL url = new URL("http://" + ip + ":" + safePort + "/status");
            connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(1200);
            connection.setReadTimeout(1200);
            connection.setRequestProperty("Cache-Control", "no-cache");
            connection.connect();
            if (connection.getResponseCode() < 200 || connection.getResponseCode() >= 300) return null;
            BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()));
            StringBuilder builder = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                builder.append(line);
            }
            JSONObject status = new JSONObject(builder.toString());
            status.put("online", true);
            status.put("status", "online");
            status.put("lastSeen", System.currentTimeMillis());
            if (status.optInt("port", 0) <= 0) {
                status.put("port", safePort);
            }
            return status;
        } catch (Exception ignored) {
            return null;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private String buildServiceName() {
        String suffix = EmbeddedCmsRuntime.getDeviceId(context);
        if (suffix.length() > 6) {
            suffix = suffix.substring(Math.max(0, suffix.length() - 6));
        }
        return EmbeddedCmsRuntime.sanitizeHostLabel(EmbeddedCmsRuntime.getDeviceName(context)) + "-" + suffix;
    }

    public JSONArray getDiscoveredDevices() {
        JSONArray out = new JSONArray();
        for (JSONObject value : discoveredByIp.values()) {
            long lastSeen = value.optLong("lastSeen", 0L);
            if (lastSeen > 0L && (System.currentTimeMillis() - lastSeen) > DISCOVERY_STALE_MS) continue;
            if (!value.optBoolean("online", true)) continue;
            out.put(value);
        }
        return out;
    }
}
