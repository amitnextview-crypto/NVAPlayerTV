import React, { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  CmsAccessInfo,
  getCmsAccessInfo,
  setDeviceName,
} from "../services/embeddedCmsService";

type Props = {
  compact?: boolean;
  onOpenCms?: () => void;
  preferredFocusTarget?: "openCms" | "saveName";
};

export default function CmsAccessCard({
  compact = false,
  onOpenCms,
  preferredFocusTarget = "openCms",
}: Props) {
  const { width, height } = useWindowDimensions();
  const isCompactScreen = Math.min(width, height) < 720;
  const isPortraitScreen = height >= width;
  const [info, setInfo] = useState<CmsAccessInfo>(getCmsAccessInfo());
  const [nameInput, setNameInput] = useState(info.deviceName || "");
  const [openFocused, setOpenFocused] = useState(false);
  const [saveFocused, setSaveFocused] = useState(false);
  const accessUrl = info.publicUrl || info.localUrl;
  const displayIp =
    info.ipAddress ||
    String(accessUrl || "").match(/^https?:\/\/([^/:]+)/i)?.[1] ||
    "";

  useEffect(() => {
    const refresh = () => {
      const next = getCmsAccessInfo();
      setInfo(next);
      setNameInput((current) => current || next.deviceName || "");
    };
    refresh();
    const warmupTimer = setTimeout(refresh, 1500);
    const timer = setInterval(refresh, 5000);
    return () => {
      clearTimeout(warmupTimer);
      clearInterval(timer);
    };
  }, []);

  const onSaveName = () => {
    const next = String(nameInput || "").trim();
    if (!next) return;
    setDeviceName(next);
    const refreshed = getCmsAccessInfo();
    setInfo(refreshed);
    setNameInput(refreshed.deviceName || next);
  };

  return (
    <View
      style={[
        styles.card,
        compact ? styles.cardCompact : null,
        isPortraitScreen ? styles.cardPortrait : null,
        isCompactScreen ? styles.cardSmall : null,
      ]}
    >
      <View
        style={[
          styles.qrWrap,
          isPortraitScreen ? styles.qrWrapPortrait : null,
          isCompactScreen ? styles.qrWrapSmall : null,
        ]}
      >
        {info.qrDataUri ? (
          <Image
            source={{ uri: info.qrDataUri }}
            style={[
              styles.qrImage,
              isPortraitScreen ? styles.qrImagePortrait : null,
              isCompactScreen ? styles.qrImageSmall : null,
            ]}
          />
        ) : (
          <View
            style={[
              styles.qrImage,
              styles.qrPlaceholder,
              isPortraitScreen ? styles.qrImagePortrait : null,
              isCompactScreen ? styles.qrImageSmall : null,
            ]}
          >
            <Text style={styles.qrPlaceholderText}>QR</Text>
          </View>
        )}
        <Text style={styles.scanHint}>Scan to open CMS</Text>
        <Text selectable style={styles.qrIpText}>{displayIp || "IP not available"}</Text>
        {!!onOpenCms && (
          <Pressable
            onPress={onOpenCms}
            onFocus={() => setOpenFocused(true)}
            onBlur={() => setOpenFocused(false)}
            style={({ pressed }) => [
              styles.openBtn,
              openFocused ? styles.focusedActionBtn : null,
              pressed ? styles.openBtnActive : null,
            ]}
            focusable
            accessible
            hasTVPreferredFocus={preferredFocusTarget === "openCms"}
          >
            <Text style={styles.openBtnText}>Open CMS</Text>
          </Pressable>
        )}
      </View>

      <View style={[styles.metaWrap, isPortraitScreen ? styles.metaWrapPortrait : null]}>
        <Text style={styles.sectionLabel}>TV Name</Text>
        <View style={styles.nameRow}>
          <TextInput
            value={nameInput}
            onChangeText={setNameInput}
            placeholder="Enter TV name"
            placeholderTextColor="rgba(209,223,236,0.42)"
            style={styles.nameInput}
          />
          <Pressable
            onPress={onSaveName}
            onFocus={() => setSaveFocused(true)}
            onBlur={() => setSaveFocused(false)}
            style={({ pressed }) => [
              styles.saveBtn,
              saveFocused ? styles.focusedActionBtn : null,
              pressed ? styles.saveBtnActive : null,
            ]}
            focusable
            accessible
            hasTVPreferredFocus={preferredFocusTarget === "saveName"}
          >
            <Text style={styles.saveBtnText}>Save</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Access URL</Text>
        <Text selectable style={styles.metaValue}>{accessUrl}</Text>

        <Text style={styles.sectionLabel}>Device ID</Text>
        <Text selectable style={styles.metaValue}>{info.deviceId || "unknown"}</Text>

        <Text style={styles.sectionLabel}>IP Address</Text>
        <Text selectable style={styles.metaValue}>{displayIp || "Not available"}</Text>

        <Text style={styles.sectionLabel}>.local Hostname</Text>
        <Text selectable style={styles.metaValue}>{info.hostname || "Not available"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(120, 190, 231, 0.25)",
    backgroundColor: "rgba(10, 16, 24, 0.9)",
    padding: 16,
    flexDirection: "row",
  },
  cardCompact: {
    marginTop: 0,
  },
  cardPortrait: {
    flexDirection: "column",
  },
  cardSmall: {
    padding: 12,
    borderRadius: 14,
  },
  qrWrap: {
    width: 154,
    alignItems: "center",
    marginRight: 16,
  },
  qrWrapPortrait: {
    width: "100%",
    marginRight: 0,
    marginBottom: 14,
  },
  qrWrapSmall: {
    marginBottom: 12,
  },
  qrImage: {
    width: 138,
    height: 138,
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },
  qrImagePortrait: {
    width: 136,
    height: 136,
  },
  qrImageSmall: {
    width: 120,
    height: 120,
    borderRadius: 10,
  },
  qrPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  qrPlaceholderText: {
    color: "#0c1720",
    fontWeight: "800",
    fontSize: 28,
  },
  scanHint: {
    marginTop: 8,
    color: "rgba(215, 229, 240, 0.82)",
    fontSize: 12,
    textAlign: "center",
  },
  qrIpText: {
    marginTop: 4,
    color: "#f1f8ff",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
  openBtn: {
    marginTop: 12,
    minWidth: 138,
    borderRadius: 10,
    backgroundColor: "#1d8fff",
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(29, 143, 255, 0.4)",
  },
  openBtnActive: {
    backgroundColor: "#43a6ff",
    borderColor: "#9ad0ff",
  },
  focusedActionBtn: {
    transform: [{ scale: 1.04 }],
    borderColor: "#bdf1ff",
    shadowColor: "#6ce8ff",
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  openBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  metaWrap: {
    flex: 1,
    minWidth: 0,
  },
  metaWrapPortrait: {
    width: "100%",
  },
  sectionLabel: {
    color: "#a8cde8",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 4,
  },
  metaValue: {
    color: "#f1f8ff",
    fontSize: 13,
    lineHeight: 18,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  nameInput: {
    flex: 1,
    color: "#f2fbff",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "rgba(124, 190, 231, 0.34)",
    borderRadius: 10,
    backgroundColor: "rgba(14, 19, 27, 0.88)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
  },
  saveBtn: {
    backgroundColor: "#1d8fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "rgba(29, 143, 255, 0.4)",
  },
  saveBtnActive: {
    backgroundColor: "#43a6ff",
    borderColor: "#9ad0ff",
  },
  saveBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
});
