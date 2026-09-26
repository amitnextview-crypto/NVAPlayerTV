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
  cmsOnlyMode: boolean;
  cmsOnlyModeManualOverride: boolean; // Track if user manually set CMS Only mode
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
    // Keep CMS isolated by default. USB/Storage priority is explicitly enabled from its settings.
    cmsOnlyMode: true,
    cmsOnlyModeManualOverride: false,
  };
}

export function pickPlaybackSource(state: SourcePolicyState): PlaybackSource {
  if (
    !state.cmsOnlyMode &&
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
  const hasPlayableMedia = !!usbState.hasPlayableMedia;

  const next: SourcePolicyState = {
    ...current,
    usbMounted: mounted,
    usbHasPlayableMedia: hasPlayableMedia,
    usbPlaylist: Array.isArray(usbState.playlist) ? usbState.playlist : [],
    usbMountPath: mountPath,
    usbSourceType: usbState.sourceType === "tvad" ? "tvad" : "usb",
  };

  if (!mounted || mountChanged) {
    next.usbSuppressed = false;
  }

  // Auto-toggle CMS Only mode based on media presence, but respect manual override
  // If user manually set CMS Only mode, don't auto-change it
  if (!current.cmsOnlyModeManualOverride) {
    if (hasPlayableMedia) {
      // Auto-disable CMS Only mode when USB or Storage has playable media
      next.cmsOnlyMode = false;
    } else {
      // Auto-enable CMS Only mode when no media is present
      next.cmsOnlyMode = true;
    }
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

export function reduceCmsOnlyMode(
  current: SourcePolicyState,
  cmsOnlyMode: boolean
): SourcePolicyState {
  const next: SourcePolicyState = {
    ...current,
    cmsOnlyMode: !!cmsOnlyMode,
    cmsOnlyModeManualOverride: true, // Mark as manually set by user
  };
  next.activeSource = pickPlaybackSource(next);
  return next;
}
