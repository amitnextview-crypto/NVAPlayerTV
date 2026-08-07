import type { AppConfig } from "../types/config";
import {
  clearPlaybackOverride,
  setPlaybackOverride,
  type MediaItem,
} from "./mediaService";

const USB_SOURCE_ID = "usb";
const INSTANT_STREAM_SOURCE_ID = "instant-stream";

export class PlaybackController {
  playUsbPlaylist(playlist: MediaItem[]) {
    const activeSections = Array.from(
      new Set(
        playlist
          .map((item) => Math.max(1, Math.min(3, Number(item?.section || 1))))
          .filter(Boolean)
      )
    ).sort((a, b) => a - b);
    const sectionMap = new Map(activeSections.map((section, index) => [section, index + 1]));
    setPlaybackOverride(
      USB_SOURCE_ID,
      playlist.map((item) => ({
        ...item,
        usbSection: Math.max(1, Math.min(3, Number(item?.section || 1))),
        section: sectionMap.get(Math.max(1, Math.min(3, Number(item?.section || 1)))) || 1,
      }))
    );
  }

  stopUsbPlayback() {
    clearPlaybackOverride(USB_SOURCE_ID);
  }

  playInstantStream(item: MediaItem) {
    setPlaybackOverride(INSTANT_STREAM_SOURCE_ID, [item]);
  }

  stopInstantStream() {
    clearPlaybackOverride(INSTANT_STREAM_SOURCE_ID);
  }

  buildUsbConfig(baseConfig: AppConfig | any, playlist: MediaItem[] = []) {
    const activeSections = Array.from(
      new Set(playlist.map((item) => Math.max(1, Math.min(3, Number(item?.section || 1)))))
    ).sort((a, b) => a - b);
    const sourceSections = activeSections.length ? activeSections : [1];
    const sections = sourceSections.map((sectionNo) => {
      const sourceSection = baseConfig?.sections?.[sectionNo - 1] || baseConfig?.sections?.[0] || {};
      return {
        ...sourceSection,
        sourceType: "multimedia",
        sourceUrl: "",
        // Offline USB/TvAd media should fill its assigned grid without cropping.
        usbFitMode: "stretch",
        slideDuration: Number(sourceSection?.slideDuration || baseConfig?.slideDuration || 5),
      };
    });
    return {
      ...baseConfig,
      orientation: baseConfig?.orientation || "horizontal",
      layout: sections.length === 1 ? "fullscreen" : sections.length === 2 ? "grid2" : "grid3",
      bgColor: baseConfig?.bgColor || "#000000",
      // USB playback uses the same ticker configuration as CMS playback.
      ticker: { ...(baseConfig?.ticker || {}) },
      sections,
    };
  }
}
