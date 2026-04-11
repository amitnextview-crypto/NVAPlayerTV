import { NativeModules } from "react-native";

const { DeviceIdModule } = NativeModules as any;

export type CmsAccessInfo = {
  deviceId: string;
  deviceName: string;
  ipAddress: string;
  hostname: string;
  localUrl: string;
  publicUrl: string;
  qrDataUri: string;
};

const EMPTY_INFO: CmsAccessInfo = {
  deviceId: "",
  deviceName: "",
  ipAddress: "",
  hostname: "",
  localUrl: "http://127.0.0.1:8080",
  publicUrl: "",
  qrDataUri: "",
};

export function getCmsAccessInfo(): CmsAccessInfo {
  try {
    const info = DeviceIdModule?.getCmsAccessInfo?.() || {};
    return {
      deviceId: String(info.deviceId || ""),
      deviceName: String(info.deviceName || ""),
      ipAddress: String(info.ipAddress || ""),
      hostname: String(info.hostname || ""),
      localUrl: String(info.localUrl || EMPTY_INFO.localUrl),
      publicUrl: String(info.publicUrl || ""),
      qrDataUri: String(info.qrDataUri || ""),
    };
  } catch {
    return EMPTY_INFO;
  }
}

export function startEmbeddedCmsServer() {
  try {
    DeviceIdModule?.startEmbeddedCmsServer?.();
  } catch {
  }
}

export function setDeviceName(value: string) {
  try {
    DeviceIdModule?.setDeviceName?.(String(value || ""));
  } catch {
  }
}

export function setEmbeddedRuntimeInfo(payload: Record<string, any>) {
  try {
    DeviceIdModule?.setDeviceRuntimeInfo?.(JSON.stringify(payload || {}));
  } catch {
  }
}
