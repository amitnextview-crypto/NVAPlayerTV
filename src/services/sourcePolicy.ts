import type { MediaItem } from "./mediaService";
import type { UsbState } from "./usbManagerModule";

export type PlaybackSource = "USB" | "CMS_ONLINE" | "CMS_OFFLINE";

export type SourcePolicyState = {
  activeSource: PlaybackSource;
  browserCmsActive: boolean;
  usbMounted: boolean;
  usbHasPlayableMedia: boolean;
  usbPlaylist: MediaItem[];
  usbMountPath: string;
  usbSuppressed: boolean;
  usbSourceType: "usb" | "tvad";
};

export function createInitialSourcePolicyState(): SourcePolicyState {
  return {
    activeSource: "CMS_OFFLINE",
    browserCmsActive: false,
    usbMounted: false,
    usbHasPlayableMedia: false,
    usbPlaylist: [],
    usbMountPath: "",
    usbSuppressed: false,
    usbSourceType: "usb",
  };
}

export function pickPlaybackSource(state: SourcePolicyState): PlaybackSource {
  if (
    state.usbMounted &&
    state.usbHasPlayableMedia &&
    state.usbPlaylist.length > 0 &&
    !state.usbSuppressed
  ) {
    return "USB";
  }
  return state.browserCmsActive ? "CMS_ONLINE" : "CMS_OFFLINE";
}

export function reduceUsbState(
  current: SourcePolicyState,
  usbState: UsbState
): SourcePolicyState {
  const mounted = !!usbState.mounted;
  const mountPath = String(usbState.mountPath || "");
  const mountChanged = current.usbMountPath !== mountPath;

  const next: SourcePolicyState = {
    ...current,
    usbMounted: mounted,
    usbHasPlayableMedia: !!usbState.hasPlayableMedia,
    usbPlaylist: Array.isArray(usbState.playlist) ? usbState.playlist : [],
    usbMountPath: mountPath,
    usbSourceType: usbState.sourceType === "tvad" ? "tvad" : "usb",
  };

  if (!mounted || mountChanged) {
    next.usbSuppressed = false;
  }

  next.activeSource = pickPlaybackSource(next);
  return next;
}

export function reduceBrowserCmsState(
  current: SourcePolicyState,
  active: boolean
): SourcePolicyState {
  const next: SourcePolicyState = {
    ...current,
    browserCmsActive: !!active,
  };
  next.activeSource = pickPlaybackSource(next);
  return next;
}

export function reduceCmsUpdate(current: SourcePolicyState): SourcePolicyState {
  const next: SourcePolicyState = { ...current };
  next.activeSource = pickPlaybackSource(next);
  return next;
}
