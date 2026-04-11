import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import CmsAccessCard from "./CmsAccessCard";
import {
  getCmsAccessInfo,
  startEmbeddedCmsServer,
} from "../services/embeddedCmsService";

type Props = {
  visible: boolean;
  onClose: () => void;
  initialView?: "access" | "cms";
};

export default function AdminCmsPanel({ visible, onClose, initialView = "access" }: Props) {
  const slide = useRef(new Animated.Value(400)).current;
  const [cmsUrl, setCmsUrl] = useState("http://127.0.0.1:8080");
  const [currentView, setCurrentView] = useState<"access" | "cms">(initialView);

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

  return (
    <Animated.View style={[styles.overlay, { transform: [{ translateX: slide }] }]}>
      {currentView === "cms" ? (
        <View style={styles.fullscreenWrap}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>CMS</Text>
              <Text style={styles.subtitle}>Use remote, mouse, or touch to control the panel.</Text>
            </View>
            <Pressable
              onPress={() => {
                if (initialView === "access") setCurrentView("access");
                else onClose();
              }}
              style={({ pressed }) => [
                styles.backBtn,
                pressed ? styles.backBtnActive : null,
              ]}
              focusable
              accessible
              hasTVPreferredFocus
            >
              <Text style={styles.backBtnText}>Back</Text>
            </Pressable>
          </View>
          <View style={styles.webWrapFullscreen}>
            <WebView
              source={{ uri: cmsUrl }}
              style={styles.webview}
              originWhitelist={["*"]}
            />
          </View>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Admin Panel</Text>
              <Text style={styles.subtitle}>TV-hosted CMS is running locally.</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.close}>X</Text>
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 2,
    color: "rgba(212,225,238,0.7)",
    fontSize: 12,
  },
  close: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
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
    backgroundColor: "#ffffff",
  },
  backBtn: {
    minWidth: 88,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1d8fff",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(29, 143, 255, 0.4)",
  },
  backBtnActive: {
    backgroundColor: "#43a6ff",
    borderColor: "#9ad0ff",
  },
  backBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
