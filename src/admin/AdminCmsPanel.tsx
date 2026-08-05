import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import CmsAccessCard from "./CmsAccessCard";
import {
  getCmsAccessInfo,
  pickMediaFilesForSection,
  setAutoReopenEnabled,
  startEmbeddedCmsServer,
  uploadPickedMediaFiles,
} from "../services/embeddedCmsService";

type Props = {
  visible: boolean;
  onClose: () => void;
  view: "access" | "cms" | "adminCms";
  onViewChange: (view: "access" | "cms" | "adminCms") => void;
  orientation?: string;
};

export default function AdminCmsPanel({
  visible,
  onClose,
  view,
  onViewChange,
  orientation = "horizontal",
}: Props) {
  const { width, height } = useWindowDimensions();
  const isPortraitScreen = height >= width;
  const isCompactScreen = Math.min(width, height) < 720;
  const slide = useRef(new Animated.Value(400)).current;
  const webRef = useRef<WebView>(null);
  const [cmsUrl, setCmsUrl] = useState("http://127.0.0.1:8080");
  const [backFocused, setBackFocused] = useState(false);
  const [webMountKey, setWebMountKey] = useState(0);

  useEffect(() => {
    startEmbeddedCmsServer();
    const info = getCmsAccessInfo();
    setCmsUrl(info.localUrl || "http://127.0.0.1:8080");
  }, []);

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 0 : 400,
      duration: 260,
      useNativeDriver: true,
    }).start();
    if (visible) {
      setWebMountKey((value) => value + 1);
    }
  }, [slide, visible]);

  if (!visible) return null;

  const nativeTvCmsUrl = `${cmsUrl}${cmsUrl.includes("?") ? "&" : "?"}tv=1&ori=${encodeURIComponent(String(orientation || "horizontal"))}`;
  const browserCmsUrl = cmsUrl;
  const isAdminCms = view === "adminCms";
  const activeCmsUrl = isAdminCms ? browserCmsUrl : nativeTvCmsUrl;

  const postWebEvent = (type: string, payload: Record<string, any>) => {
    const script = `
      if (window.handleTvNativeEvent) {
        window.handleTvNativeEvent(${JSON.stringify({ type, ...payload })});
      }
      true;
    `;
    webRef.current?.injectJavaScript(script);
  };

  const sanitizeNativeCmsError = (error: any) => {
    const raw = String(error?.message || error || "").trim();
    if (!raw) return "Action failed.";
    if (/no_files_picked/i.test(raw)) return "Pick files first, then try the upload again.";
    if (/upload target is empty/i.test(raw)) return "No upload target is available.";
    if (/connection\s*reset|connectionreset|sun\.net/i.test(raw)) {
      return "TV local upload connection was interrupted. The upload engine has been switched to direct local import. Please try again.";
    }
    if (/http 404|not found/i.test(raw)) return "Upload endpoint not found on the target device.";
    if (/http 413|too large/i.test(raw)) return "The selected file is too large for the target device.";
    if (/timed out|timeout/i.test(raw)) return "The upload timed out. Please try again.";
    if (/java\.io\./i.test(raw) || /failed for http/i.test(raw)) return "The TV could not complete the upload. Please verify the target device is online and try again.";
    return raw.length > 220 ? `${raw.slice(0, 220)}...` : raw;
  };

  const handleNativePick = async (section: number) => {
    try {
      setAutoReopenEnabled(false);
      const result: any = await pickMediaFilesForSection(section);
      postWebEvent("TV_PICK_COMPLETE", {
        section,
        count: Number(result?.count || 0),
      });
    } catch (error: any) {
      postWebEvent("TV_PICK_FAILED", {
        section,
        message: String(error?.message || "File selection cancelled."),
      });
    }
  };

  const handleNativeUpload = async (section: number, _targets: string[] = [cmsUrl]) => {
    try {
      const result: any = await uploadPickedMediaFiles(section, [cmsUrl]);
      postWebEvent("TV_UPLOAD_COMPLETE", {
        section,
        count: Number(result?.count || 0),
      });
    } catch (error: any) {
      postWebEvent("TV_UPLOAD_FAILED", {
        section,
        message: sanitizeNativeCmsError(error),
      });
    }
  };

  return (
    <Animated.View style={[styles.overlay, { transform: [{ translateX: slide }] }]}>
      {view === "cms" || view === "adminCms" ? (
        <View style={styles.fullscreenWrap}>
          <View style={[styles.header, isCompactScreen ? styles.headerCompact : null]}>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, isCompactScreen ? styles.titleCompact : null]}>
                {isAdminCms ? "Admin CMS" : "CMS"}
              </Text>
              <Text style={[styles.subtitle, isCompactScreen ? styles.subtitleCompact : null]}>
                {isAdminCms
                  ? "Full browser-style CMS running inside this TV app."
                  : "TV CMS mirrors browser features and uses the native TV picker for uploads."}
              </Text>
            </View>
            <TouchableOpacity
              onPress={isAdminCms ? () => onViewChange("access") : onClose}
              onFocus={() => setBackFocused(true)}
              onBlur={() => setBackFocused(false)}
              activeOpacity={0.8}
              style={[
                styles.iconBtn,
                isCompactScreen ? styles.iconBtnCompact : null,
                backFocused ? styles.iconBtnActive : null,
              ]}
              focusable
              accessible
              hasTVPreferredFocus
            >
              <Text style={styles.iconBtnText}>Back</Text>
            </TouchableOpacity>
          </View>
          <View
            style={[
              styles.webWrapFullscreen,
              isPortraitScreen ? styles.webWrapPortrait : styles.webWrapLandscape,
              isCompactScreen ? styles.webWrapCompact : null,
            ]}
            collapsable={false}
            renderToHardwareTextureAndroid
          >
            <WebView
              key={`${activeCmsUrl}:${webMountKey}`}
              ref={webRef}
              source={{ uri: activeCmsUrl }}
              style={styles.webview}
              originWhitelist={["*"]}
              javaScriptEnabled
              domStorageEnabled
              allowFileAccess
              allowUniversalAccessFromFileURLs
              allowingReadAccessToURL={"file://"}
              mixedContentMode="always"
              setSupportMultipleWindows={false}
              androidLayerType="software"
              hideKeyboardAccessoryView
              overScrollMode="never"
              nestedScrollEnabled
              bounces={false}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              injectedJavaScript={`
                (function() {
                  function focusFirst() {
                    var first = document.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
                    if (first && typeof first.focus === 'function') first.focus();
                  }
                  if (document.readyState === 'complete' || document.readyState === 'interactive') {
                    setTimeout(focusFirst, 120);
                  } else {
                    document.addEventListener('DOMContentLoaded', function() {
                      setTimeout(focusFirst, 120);
                    }, { once: true });
                  }
                  function disableAutoReopenForFilePicker(event) {
                    var target = event && event.target;
                    if (target && target.matches && target.matches('input[type="file"]')) {
                      window.ReactNativeWebView && window.ReactNativeWebView.postMessage('TV_FILE_PICKER_OPENING');
                    }
                  }
                  // Capture before the browser performs the input's default
                  // action, which launches Android's document picker.
                  document.addEventListener('pointerdown', disableAutoReopenForFilePicker, true);
                  document.addEventListener('touchstart', disableAutoReopenForFilePicker, true);
                  document.addEventListener('click', disableAutoReopenForFilePicker, true);
                })();
                true;
              `}
              onMessage={(event) => {
                const raw = String(event?.nativeEvent?.data || "").trim();
                if (raw === "TV_FILE_PICKER_OPENING") {
                  setAutoReopenEnabled(false);
                  return;
                }
                let parsed: any = null;
                try {
                  parsed = raw.startsWith("{") ? JSON.parse(raw) : null;
                } catch {
                  parsed = null;
                }
                const match = raw.match(/^TV_UPLOAD_SECTION:(\d+)$/);
                if (parsed?.type === "TV_PICK_SECTION") {
                  const section = Number(parsed?.section || 1);
                  handleNativePick(section);
                  return;
                }
                if (parsed?.type === "TV_UPLOAD_SECTION") {
                  const section = Number(parsed?.section || 1);
                  handleNativeUpload(section, [cmsUrl]);
                  return;
                }
                if (match) {
                  handleNativeUpload(Number(match[1] || 1), [cmsUrl]);
                  return;
                }
                if (raw === "CONFIG_SAVED") {
                  // Saving configuration (including after an upload) must not
                  // dismiss the CMS. Keep the WebView open so the user can
                  // finish the current upload workflow.
                  return;
                }
              }}
            />
          </View>
        </View>
      ) : (
        <>
          <View style={[styles.header, isCompactScreen ? styles.headerCompact : null]}>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, isCompactScreen ? styles.titleCompact : null]}>QR Access</Text>
              <Text style={[styles.subtitle, isCompactScreen ? styles.subtitleCompact : null]}>
                Use remote arrows to move focus. Press OK to open CMS.
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              onFocus={() => setBackFocused(true)}
              onBlur={() => setBackFocused(false)}
              activeOpacity={0.8}
              style={[
                styles.iconBtn,
                isCompactScreen ? styles.iconBtnCompact : null,
                backFocused ? styles.iconBtnActive : null,
              ]}
              focusable={false}
              accessible
            >
              <Text style={styles.iconBtnText}>X</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.accessScroll}
            contentContainerStyle={[
              styles.content,
              styles.accessScrollContent,
              isCompactScreen ? styles.contentCompact : null,
            ]}
            showsVerticalScrollIndicator
            persistentScrollbar
            keyboardShouldPersistTaps="handled"
          >
            <CmsAccessCard
              compact
              onOpenCms={() => onViewChange("cms")}
              onOpenAdminCms={() => onViewChange("adminCms")}
              preferredFocusTarget="openCms"
            />
          </ScrollView>
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    width: "100%",
    backgroundColor: "#0f141c",
    zIndex: 999,
    elevation: 999,
  },
  header: {
    minHeight: 68,
    backgroundColor: "#17202c",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  headerCompact: {
    minHeight: 60,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  titleCompact: {
    fontSize: 16,
  },
  subtitle: {
    marginTop: 2,
    color: "rgba(212,225,238,0.7)",
    fontSize: 11,
  },
  subtitleCompact: {
    fontSize: 10,
  },
  content: {
    padding: 12,
  },
  accessScroll: {
    flex: 1,
  },
  accessScrollContent: {
    flexGrow: 1,
    paddingBottom: 28,
  },
  contentCompact: {
    padding: 8,
  },
  fullscreenWrap: {
    flex: 1,
  },
  webWrap: {
    flex: 1,
    marginTop: 12,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(120, 190, 231, 0.2)",
  },
  webWrapFullscreen: {
    flex: 1,
    margin: 12,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(120, 190, 231, 0.2)",
    backgroundColor: "#0f141c",
    zIndex: 1,
    elevation: 1,
  },
  webWrapLandscape: {
    marginHorizontal: 12,
  },
  webWrapPortrait: {
    marginHorizontal: 8,
    marginVertical: 8,
  },
  webWrapCompact: {
    margin: 8,
    borderRadius: 12,
  },
  webview: {
    flex: 1,
    backgroundColor: "#0f141c",
    opacity: 0.99,
  },
  iconBtn: {
    minWidth: 54,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1d8fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(29, 143, 255, 0.4)",
  },
  iconBtnCompact: {
    minWidth: 48,
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  iconBtnActive: {
    backgroundColor: "#43a6ff",
    borderColor: "#9ad0ff",
  },
  iconBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
