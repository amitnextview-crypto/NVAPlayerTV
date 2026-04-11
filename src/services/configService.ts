import { readConfig, writeConfig } from "../utils/fileSystem";
import { getServer } from "./serverService";
import { NativeModules } from "react-native";

const { DeviceIdModule } = NativeModules;
const CONFIG_FETCH_TIMEOUT_MS = 6000;

function fetchWithTimeout(url: string, timeoutMs = CONFIG_FETCH_TIMEOUT_MS): Promise<Response> {
  return Promise.race([
    fetch(url, {
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    }),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error("config-fetch-timeout")), timeoutMs)
    ),
  ]);
}

export async function loadConfig(setConfig: Function) {
  let lastError: any = null;
  try {
    const server = getServer();
    if (!server) throw new Error("server-not-ready");

    const deviceId = await DeviceIdModule.getDeviceId();

    const res = await fetchWithTimeout(
      `${server}/config?deviceId=${deviceId}&ts=${Date.now()}`
    );
    if (!res.ok) throw new Error(`config-http-${res.status}`);

    const config = await res.json();
    if (!config || typeof config !== "object") {
      throw new Error("config-invalid-payload");
    }

    await writeConfig(config);
    setConfig(config);
    return config;
  } catch (e) {
    lastError = e;
    console.log("Server config failed", e);
  }

  try {
    const cached = await readConfig();
    if (cached && typeof cached === "object") {
      setConfig(cached);
      return cached;
    }
  } catch (cacheErr) {
    console.log("Cached config load failed", cacheErr);
  }

  if (lastError) {
    console.log("Config unavailable from both server and local cache");
  }
  return null;
}
