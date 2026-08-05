import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules } from "react-native";

export type AppMode = "tvMode" | "adminOnlyMode";

const APP_MODE_KEY = "@app_mode";
const SETUP_COMPLETE_KEY = "@app_setup_completed";
const ADMIN_CMS_URL_KEY = "@admin_cms_url";
const { DeviceIdModule } = NativeModules as any;

function isAppMode(value: unknown): value is AppMode {
  return value === "tvMode" || value === "adminOnlyMode";
}

export async function getAppMode(): Promise<AppMode | null> {
  // Native preferences survive the CMS deep-clear path. Read these first and
  // repair AsyncStorage if it was removed with playback data.
  try {
    const nativeMode = DeviceIdModule?.getAppMode?.();
    if (isAppMode(nativeMode)) {
      await AsyncStorage.multiSet([
        [APP_MODE_KEY, nativeMode],
        [SETUP_COMPLETE_KEY, "true"],
      ]);
      return nativeMode;
    }
  } catch {
    // Fall back to AsyncStorage on builds without the native module update.
  }
  const [completed, mode] = await Promise.all([
    AsyncStorage.getItem(SETUP_COMPLETE_KEY),
    AsyncStorage.getItem(APP_MODE_KEY),
  ]);
  return completed === "true" && (mode === "tvMode" || mode === "adminOnlyMode")
    ? mode
    : null;
}

export async function saveAppMode(mode: AppMode): Promise<void> {
  try {
    DeviceIdModule?.setAppMode?.(mode);
  } catch {
    // AsyncStorage remains a compatible fallback on older APKs.
  }
  await AsyncStorage.multiSet([
    [APP_MODE_KEY, mode],
    [SETUP_COMPLETE_KEY, "true"],
  ]);
}

export async function getAdminCmsUrl(): Promise<string> {
  return (await AsyncStorage.getItem(ADMIN_CMS_URL_KEY)) || "";
}

export async function saveAdminCmsUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(ADMIN_CMS_URL_KEY, url);
}
