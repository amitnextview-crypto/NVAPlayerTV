import { NativeEventEmitter, NativeModules } from "react-native";
import type { MediaItem } from "./mediaService";

const { UsbManagerModule } = NativeModules as any;

export type UsbState = {
  mounted: boolean;
  /** Physical external USB drive connection, separate from internal Storage playback. */
  usbMounted?: boolean;
  hasPlayableMedia: boolean;
  mountPath: string;
  mountPaths: string[];
  playlist: MediaItem[];
  sourceType?: "usb" | "tvad";
  reason?: string;
};

const EMPTY_USB_STATE: UsbState = {
  mounted: false,
  usbMounted: false,
  hasPlayableMedia: false,
  mountPath: "",
  mountPaths: [],
  playlist: [],
};

function normalizeUsbState(value: any): UsbState {
  return {
    mounted: !!value?.mounted,
    usbMounted: !!value?.usbMounted,
    hasPlayableMedia: !!value?.hasPlayableMedia,
    mountPath: String(value?.mountPath || ""),
    mountPaths: Array.isArray(value?.mountPaths)
      ? value.mountPaths.map((entry: any) => String(entry || "")).filter(Boolean)
      : [],
    playlist: Array.isArray(value?.playlist) ? value.playlist : [],
    sourceType: value?.sourceType === "tvad" ? "tvad" : "usb",
    reason: value?.reason ? String(value.reason) : undefined,
  };
}

export function isUsbModuleAvailable() {
  return !!UsbManagerModule;
}

export async function refreshUsbState(): Promise<UsbState> {
  if (!UsbManagerModule?.refreshUsbState) return EMPTY_USB_STATE;
  const result = await UsbManagerModule.refreshUsbState();
  return normalizeUsbState(result);
}

export async function getCurrentUsbState(): Promise<UsbState> {
  if (!UsbManagerModule?.getCurrentUsbState) return EMPTY_USB_STATE;
  const result = await UsbManagerModule.getCurrentUsbState();
  return normalizeUsbState(result);
}

export function subscribeUsbState(listener: (state: UsbState) => void) {
  if (!UsbManagerModule) {
    return () => {};
  }
  const emitter = new NativeEventEmitter(UsbManagerModule);
  const subscription = emitter.addListener("usbMediaStateChanged", (event: any) => {
    listener(normalizeUsbState(event));
  });
  return () => subscription.remove();
}

export type DocumentConversionProgress = { percent: number; message: string };

export function subscribeDocumentConversionProgress(listener: (progress: DocumentConversionProgress) => void) {
  if (!UsbManagerModule) return () => {};
  const emitter = new NativeEventEmitter(UsbManagerModule);
  const subscription = emitter.addListener("documentConversionProgress", (event: any) => {
    listener({ percent: Math.max(0, Math.min(100, Number(event?.percent || 0))), message: String(event?.message || "Converting PDF...") });
  });
  return () => subscription.remove();
}

