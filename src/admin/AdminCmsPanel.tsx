import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  StyleSheet,
  Text,
  TouchableOpacity,
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
  initialView?: "access" | "cms";
};

export default function AdminCmsPanel({ visible, onClose, initialView = "access" }: Props) {
  const slide = useRef(new Animated.Value(400)).current;
  const webRef = useRef<WebView>(null);
  const [cmsUrl, setCmsUrl] = useState("http://127.0.0.1:8080");
  const [currentView, setCurrentView] = useState<"access" | "cms">(initialView);
  const [backFocused, setBackFocused] = useState(false);

  useEffect(() => {
    startEmbeddedCmsServer();
    const info = getCmsAccessInfo();
    setCmsUrl(info.localUrl || "http://127.0.0.1:8080");
  }, []);

  useEffect(() => {
    if (visible) {
      setCurrentView(initialView);
    }
  }, [visible, initialView]);

  useEffect(() => {
    if (visible && currentView === "cms") {
      setAutoReopenEnabled(false);
    }
  }, [currentView, visible]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (visible && currentView === "cms" && initialView === "access") {
        setCurrentView("access");
        return true;
      }
      if (visible) {
        onClose();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [currentView, initialView, onClose, visible]);

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 0 : 400,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [slide, visible]);

  if (!visible) return null;

  const nativeTvCmsUrl = `${cmsUrl}${cmsUrl.includes("?") ? "&" : "?"}tv=1`;

  const postWebEvent = (type: string, payload: Record<string, any>) => {
    const script = `
      if (window.handleTvNativeEvent) {
        window.handleTvNativeEvent(${JSON.stringify({ type, ...payload })});
      }
      true;
    `;
    webRef.current?.injectJavaScript(script);
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

  const handleNativeUpload = async (section: number, targets: string[] = [cmsUrl]) => {
    try {
      setAutoReopenEnabled(false);
      const result: any = await uploadPickedMediaFiles(section, targets);
      postWebEvent("TV_UPLOAD_COMPLETE", {
        section,
        count: Number(result?.count || 0),
      });
    } catch (error: any) {
      postWebEvent("TV_UPLOAD_FAILED", {
        section,
        message: String(error?.message || "Upload failed."),
      });
    }
  };

  return (
    <Animated.View style={[styles.overlay, { transform: [{ translateX: slide }] }]}>
      {currentView === "cms" ? (
        <View style={styles.fullscreenWrap}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>CMS</Text>
              <Text style={styles.subtitle}>TV CMS mirrors browser features and uses the native TV picker for uploads.</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                if (initialView === "access") setCurrentView("access");
                else onClose();
              }}
              onFocus={() => setBackFocused(true)}
              onBlur={() => setBackFocused(false)}
              activeOpacity={0.8}
              style={[
                styles.iconBtn,
                backFocused ? styles.iconBtnActive : null,
              ]}
              focusable
              accessible
              hasTVPreferredFocus
            >
              <Text style={styles.iconBtnText}>Back</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.webWrapFullscreen}>
            <WebView
              ref={webRef}
              source={{ uri: nativeTvCmsUrl }}
              style={styles.webview}
              originWhitelist={["*"]}
              javaScriptEnabled
              domStorageEnabled
              allowFileAccess
              allowUniversalAccessFromFileURLs
              allowingReadAccessToURL={"file://"}
              mixedContentMode="always"
              setSupportMultipleWindows={false}
              hideKeyboardAccessoryView
              overScrollMode="never"
              bounces={false}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              onMessage={(event) => {
                const raw = String(event?.nativeEvent?.data || "").trim();
                let parsed: any = null;
                try {
                  parsed = raw.startsWith("{") ? JSON.parse(raw) : null;
                } catch (_e) {
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
                  const targets = Array.isArray(parsed?.targets)
                    ? parsed.targets.map((value: any) => String(value || "")).filter(Boolean)
                    : [cmsUrl];
                  handleNativeUpload(section, targets);
                  return;
                }
                if (match) {
                  handleNativeUpload(Number(match[1] || 1), [cmsUrl]);
                  return;
                }
                if (raw === "CONFIG_SAVED") {
                  setAutoReopenEnabled(false);
                  onClose();
                }
              }}
            />
          </View>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Admin Panel</Text>
              <Text style={styles.subtitle}>TV-hosted CMS is running locally.</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              onFocus={() => setBackFocused(true)}
              onBlur={() => setBackFocused(false)}
              activeOpacity={0.8}
              style={[
                styles.iconBtn,
                backFocused ? styles.iconBtnActive : null,
              ]}
              focusable
              accessible
            >
              <Text style={styles.iconBtnText}>X</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <CmsAccessCard compact onOpenCms={() => setCurrentView("cms")} />
          </View>
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
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 2,
    color: "rgba(212,225,238,0.7)",
    fontSize: 11,
  },
  content: {
    flex: 1,
    padding: 12,
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
  },
  webview: {
    flex: 1,
    backgroundColor: "#0f141c",
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
