import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules } from "react-native";

const { DeviceIdModule } = NativeModules as any;

let SERVER = "http://127.0.0.1:8080";
const SERVER_KEY = "CMS_SERVER";
const FETCH_TIMEOUT = 4000;

function fetchWithTimeout(url: string, timeout = FETCH_TIMEOUT): Promise<Response> {
  return Promise.race([
    fetch(url),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), timeout)
    ),
  ]);
}

function normalizeUrl(value: string): string {
  return String(value || "").trim().replace(/\/+$/, "");
}

function isLocalhostUrl(value: string): boolean {
  const url = normalizeUrl(value).toLowerCase();
  return url.includes("127.0.0.1") || url.includes("localhost");
}

async function probeCMS(url: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${url}/config`);
    return !!res?.ok;
  } catch {
    return false;
  }
}

async function saveAndReturn(url: string): Promise<string> {
  SERVER = url;
  await AsyncStorage.setItem(SERVER_KEY, url);
  return url;
}

function getLocalEmbeddedUrl(): string {
  try {
    const info = DeviceIdModule?.getCmsAccessInfo?.();
    const localUrl = normalizeUrl(String(info?.localUrl || ""));
    if (localUrl) {
      SERVER = localUrl;
      return localUrl;
    }
  } catch {
  }
  return "http://127.0.0.1:8080";
}

export async function findCMS(): Promise<string> {
  const local = getLocalEmbeddedUrl();
  await saveAndReturn(local);
  return local;
}

export function getServer(): string {
  return SERVER;
}

/** Restore last known server URL from storage so cached media list and URLs work when CMS is offline. */
export async function restoreServerFromStorage(): Promise<string> {
  const local = getLocalEmbeddedUrl();
  SERVER = local;
  await AsyncStorage.setItem(SERVER_KEY, local);
  return local;
}

export async function setServer(url: string) {
  const normalized = normalizeUrl(url);
  SERVER = normalized;
  await AsyncStorage.setItem(SERVER_KEY, normalized);
}

