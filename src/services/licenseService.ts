import AsyncStorage from "@react-native-async-storage/async-storage";

const LICENSE_KEY_STORAGE_KEY = "license_key_v1";
const LICENSE_DEVICE_STORAGE_KEY = "license_device_id_v1";
const LICENSE_GENERATOR_BASE_URL = "https://local-signage-player-tv-admin-user.vercel.app"; // Set this to your license generator server URL
const LICENSE_TIMEOUT_MS = 8000;

function normalizeKey(value: string): string {
  return String(value || "").trim().toUpperCase();
}

function hasConfiguredGeneratorUrl() {
  return /^https?:\/\//i.test(LICENSE_GENERATOR_BASE_URL);
}

function fetchWithTimeout(url: string, timeoutMs = LICENSE_TIMEOUT_MS): Promise<Response> {
  return Promise.race([
    fetch(url, {
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    }),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error("license-timeout")), timeoutMs)
    ),
  ]);
}

async function getExpectedLicenseFromServer(deviceId: string): Promise<string | null> {
  if (!hasConfiguredGeneratorUrl()) return null;
  const res = await fetchWithTimeout(
    `${LICENSE_GENERATOR_BASE_URL}/api/generate?deviceId=${encodeURIComponent(deviceId)}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  return normalizeKey(String(data?.licenseKey || ""));
}

export async function readStoredLicense() {
  const [deviceId, licenseKey] = await Promise.all([
    AsyncStorage.getItem(LICENSE_DEVICE_STORAGE_KEY),
    AsyncStorage.getItem(LICENSE_KEY_STORAGE_KEY),
  ]);
  return {
    deviceId: String(deviceId || ""),
    licenseKey: normalizeKey(String(licenseKey || "")),
  };
}

export async function saveLicense(deviceId: string, licenseKey: string) {
  await Promise.all([
    AsyncStorage.setItem(LICENSE_DEVICE_STORAGE_KEY, String(deviceId)),
    AsyncStorage.setItem(LICENSE_KEY_STORAGE_KEY, normalizeKey(licenseKey)),
  ]);
}

export async function hasLocalActivationForDevice(deviceId: string) {
  const stored = await readStoredLicense();
  return (
    stored.deviceId === String(deviceId || "") &&
    !!stored.licenseKey &&
    stored.licenseKey.length >= 8
  );
}

export async function activateDeviceWithKey(deviceId: string, enteredKey: string) {
  const normalizedDeviceId = String(deviceId || "").trim();
  const normalizedKey = normalizeKey(enteredKey);

  if (!normalizedDeviceId) {
    return { success: false, message: "Device ID not found." };
  }
  if (!normalizedKey) {
    return { success: false, message: "Please enter license key." };
  }
  if (!hasConfiguredGeneratorUrl()) {
    return {
      success: false,
      message:
        "License server URL not configured. Set LICENSE_GENERATOR_BASE_URL in app.",
    };
  }

  try {
    const expectedKey = await getExpectedLicenseFromServer(normalizedDeviceId);
    if (!expectedKey) {
      return {
        success: false,
        message: "Unable to verify key. Check internet/license server.",
      };
    }
    if (expectedKey !== normalizedKey) {
      return { success: false, message: "Invalid license key." };
    }

    await saveLicense(normalizedDeviceId, normalizedKey);
    return { success: true, message: "Activation successful." };
  } catch (e: any) {
    return {
      success: false,
      message: e?.message || "Activation failed. Try again.",
    };
  }
}

