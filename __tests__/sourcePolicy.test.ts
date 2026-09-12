import {
  createInitialSourcePolicyState,
  pickPlaybackSource,
  reduceBrowserCmsState,
  reduceCmsOnlyMode,
  reduceCmsUpdate,
  reduceUsbState,
} from "../src/services/sourcePolicy";

describe("sourcePolicy", () => {
  test("prefers USB only while physically mounted with playable media", () => {
    const initial = createInitialSourcePolicyState();
    const cmsOnline = reduceBrowserCmsState(initial, true);
    const usbEnabled = reduceCmsOnlyMode(cmsOnline, false);
    const withUsb = reduceUsbState(usbEnabled, {
      mounted: true,
      hasPlayableMedia: true,
      mountPath: "/storage/usb1",
      mountPaths: ["/storage/usb1"],
      playlist: [{ name: "demo.mp4", url: "usb:///storage/usb1/Ads/demo.mp4" }],
    });

    expect(withUsb.activeSource).toBe("USB");
    expect(pickPlaybackSource(withUsb)).toBe("USB");
  });

  test("returns to CMS immediately when USB is removed", () => {
    const initial = createInitialSourcePolicyState();
    const cmsOnline = reduceBrowserCmsState(initial, true);
    const usbEnabled = reduceCmsOnlyMode(cmsOnline, false);
    const withUsb = reduceUsbState(usbEnabled, {
      mounted: true,
      hasPlayableMedia: true,
      mountPath: "/storage/usb1",
      mountPaths: ["/storage/usb1"],
      playlist: [{ name: "demo.mp4", url: "usb:///storage/usb1/Ads/demo.mp4" }],
    });
    const afterRemoval = reduceUsbState(withUsb, {
      mounted: false,
      hasPlayableMedia: false,
      mountPath: "",
      mountPaths: [],
      playlist: [],
    });

    expect(afterRemoval.activeSource).toBe("CMS_ONLINE");
  });

  test("cms updates do not steal playback from mounted usb", () => {
    const initial = createInitialSourcePolicyState();
    const cmsOnline = reduceBrowserCmsState(initial, true);
    const usbEnabled = reduceCmsOnlyMode(cmsOnline, false);
    const withUsb = reduceUsbState(usbEnabled, {
      mounted: true,
      hasPlayableMedia: true,
      mountPath: "/storage/usb1",
      mountPaths: ["/storage/usb1"],
      playlist: [{ name: "demo.jpg", url: "usb:///storage/usb1/Ads/demo.jpg" }],
    });

    const afterCmsUpdate = reduceCmsUpdate(withUsb);
    expect(afterCmsUpdate.activeSource).toBe("USB");
  });

  test("keeps CMS playback while CMS Only is enabled", () => {
    const cmsOnline = reduceBrowserCmsState(createInitialSourcePolicyState(), true);
    const withUsb = reduceUsbState(cmsOnline, {
      mounted: true,
      hasPlayableMedia: true,
      mountPath: "/storage/usb1",
      mountPaths: ["/storage/usb1"],
      playlist: [{ name: "demo.mp4", url: "usb:///storage/usb1/Ads/demo.mp4" }],
    });

    expect(withUsb.activeSource).toBe("CMS_ONLINE");
  });
});
