import type { MediaItem } from "./mediaService";
import {
  createInitialSourcePolicyState,
  reduceBrowserCmsState,
  reduceCmsUpdate,
  reduceUsbState,
  type PlaybackSource,
} from "./sourcePolicy";
import type { UsbState } from "./usbManagerModule";

export type SourceSnapshot = {
  activeSource: PlaybackSource;
  usbMounted: boolean;
  usbHasPlayableMedia: boolean;
  usbPlaylist: MediaItem[];
  usbMountPath: string;
  usbSuppressed: boolean;
  usbSourceType: "usb" | "tvad";
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
    usbSourceType: state.usbSourceType,
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
  usbSourceType: "usb" | "tvad";
};

export class SourceManager {
  private listeners = new Set<SourceListener>();
  private state: InternalState = createInitialSourcePolicyState();

  subscribe(listener: SourceListener) {
    this.listeners.add(listener);
    listener(createSnapshot(this.state));
    return () => this.listeners.delete(listener);
  }

  setBrowserCmsActive(active: boolean) {
    this.state = reduceBrowserCmsState(this.state, active);
    this.emit();
  }

  onUsbState(state: UsbState) {
    this.state = reduceUsbState(this.state, state);
    this.emit();
  }

  onCmsUpdate() {
    this.state = reduceCmsUpdate(this.state);
    this.emit();
  }

  getSnapshot() {
    return createSnapshot(this.state);
  }

  private emit() {
    const snapshot = createSnapshot(this.state);
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
