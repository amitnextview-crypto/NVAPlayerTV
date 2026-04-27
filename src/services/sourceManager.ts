import type { MediaItem } from "./mediaService";
import type { UsbState } from "./usbManagerModule";

export type PlaybackSource = "USB" | "CMS_ONLINE" | "CMS_OFFLINE";

export type SourceSnapshot = {
  activeSource: PlaybackSource;
  usbMounted: boolean;
  usbHasPlayableMedia: boolean;
  usbPlaylist: MediaItem[];
  usbMountPath: string;
  usbSuppressed: boolean;
};

type SourceListener = (snapshot: SourceSnapshot) => void;

function createSnapshot(state: InternalState): SourceSnapshot {
  return {
    activeSource: state.activeSource,
    usbMounted: state.usbMounted,
    usbHasPlayableMedia: state.usbHasPlayableMedia,
    usbPlaylist: state.usbPlaylist,
    usbMountPath: state.usbMountPath,
    usbSuppressed: state.usbSuppressed,
  };
}

type InternalState = {
  activeSource: PlaybackSource;
  browserCmsActive: boolean;
  usbMounted: boolean;
  usbHasPlayableMedia: boolean;
  usbPlaylist: MediaItem[];
  usbMountPath: string;
  usbSuppressed: boolean;
};

export class SourceManager {
  private listeners = new Set<SourceListener>();
  private state: InternalState = {
    activeSource: "CMS_OFFLINE",
    browserCmsActive: false,
    usbMounted: false,
    usbHasPlayableMedia: false,
    usbPlaylist: [],
    usbMountPath: "",
    usbSuppressed: false,
  };

  subscribe(listener: SourceListener) {
    this.listeners.add(listener);
    listener(createSnapshot(this.state));
    return () => this.listeners.delete(listener);
  }

  setBrowserCmsActive(active: boolean) {
    this.state.browserCmsActive = !!active;
    this.recompute("cms-availability");
  }

  onUsbState(state: UsbState) {
    const mounted = !!state.mounted;
    const previousMountPath = this.state.usbMountPath;
    const mountPath = String(state.mountPath || "");
    const mountChanged = previousMountPath !== mountPath;

    this.state.usbMounted = mounted;
    this.state.usbHasPlayableMedia = !!state.hasPlayableMedia;
    this.state.usbPlaylist = Array.isArray(state.playlist) ? state.playlist : [];
    this.state.usbMountPath = mountPath;

    // Any physical mount state change allows USB to compete again.
    if (!mounted || mountChanged) {
      this.state.usbSuppressed = false;
    }

    this.recompute("usb-state");
  }

  onCmsUpdate() {
    if (this.state.activeSource === "USB") {
      // A fresh CMS push should immediately reclaim playback until USB changes again.
      this.state.usbSuppressed = true;
    }
    this.recompute("cms-update");
  }

  getSnapshot() {
    return createSnapshot(this.state);
  }

  private recompute(_reason: string) {
    const nextSource = this.pickSource();
    const changed =
      nextSource !== this.state.activeSource;

    if (changed) {
      this.state.activeSource = nextSource;
    }

    this.emit();
  }

  private pickSource(): PlaybackSource {
    if (
      this.state.usbMounted &&
      this.state.usbHasPlayableMedia &&
      this.state.usbPlaylist.length > 0 &&
      !this.state.usbSuppressed
    ) {
      return "USB";
    }
    return this.state.browserCmsActive ? "CMS_ONLINE" : "CMS_OFFLINE";
  }

  private emit() {
    const snapshot = createSnapshot(this.state);
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

