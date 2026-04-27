import type { AppConfig } from "../types/config";
import {
  clearPlaybackOverride,
  setPlaybackOverride,
  type MediaItem,
} from "./mediaService";

const USB_SOURCE_ID = "usb";

export class PlaybackController {
  playUsbPlaylist(playlist: MediaItem[]) {
    setPlaybackOverride(USB_SOURCE_ID, playlist);
  }

  stopUsbPlayback() {
    clearPlaybackOverride(USB_SOURCE_ID);
  }

  buildUsbConfig(baseConfig: AppConfig | any) {
    const sourceSection = baseConfig?.sections?.[0] || {};
    return {
      ...baseConfig,
      layout: "fullscreen",
      bgColor: baseConfig?.bgColor || "#000000",
      ticker: {
        ...(baseConfig?.ticker || {}),
        text: "",
      },
      sections: [
        {
          ...sourceSection,
          sourceType: "multimedia",
          sourceUrl: "",
          usbFitMode: "contain",
          slideDuration: Number(sourceSection?.slideDuration || baseConfig?.slideDuration || 5),
        },
      ],
    };
  }
}
