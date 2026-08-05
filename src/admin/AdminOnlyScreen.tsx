import React, { useEffect, useState } from "react";
import { BackHandler, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { WebView } from "react-native-webview";
import { getAdminCmsUrl, saveAdminCmsUrl } from "../services/setupService";
import {
  getCmsAccessInfo,
  setAutoReopenEnabled,
  startEmbeddedCmsServer,
} from "../services/embeddedCmsService";

function normalizeCmsUrl(value: string): string {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

function buildAdminOnlyCmsScript(deviceId: string, deviceUrl: string): string {
  return `
    (function() {
      var ownDeviceId = ${JSON.stringify(deviceId)};
      var ownDeviceUrl = ${JSON.stringify(deviceUrl)};
      function normalize(value) {
        return String(value || '').trim().toLowerCase().replace(/^https?:\\/\\//, '').replace(/\\/+$/, '');
      }
      var ownOrigin = normalize(ownDeviceUrl);
      function belongsToThisAdminDevice(element) {
        if (!element) return false;
        var holder = element.closest ? (element.closest('label, .device-check-item, .enterprise-picker-item, option') || element) : element;
        var text = [
          element.value,
          element.getAttribute && element.getAttribute('data-device-id'),
          element.getAttribute && element.getAttribute('data-origin'),
          holder && holder.textContent,
        ].join(' ');
        var normalizedText = normalize(text);
        return (ownDeviceId && text.indexOf(ownDeviceId) >= 0)
          || (ownOrigin && normalizedText.indexOf(ownOrigin) >= 0);
      }
      function lockAdminDeviceTarget() {
        var select = document.getElementById('deviceSelect');
        if (select) {
          Array.prototype.forEach.call(select.options || [], function(option) {
            // "All Devices" includes this admin-only device, so it must not
            // be selectable either.
            var isAll = String(option.value || '') === 'all';
            if (isAll || belongsToThisAdminDevice(option)) {
              option.disabled = true;
              if (option.selected) option.selected = false;
            }
          });
          if (select.selectedIndex < 0) select.value = '';
        }
        Array.prototype.forEach.call(
          document.querySelectorAll('#deviceChecklist input[type="checkbox"], #enterpriseUploadTargets input[type="checkbox"]'),
          function(input) {
            if (!belongsToThisAdminDevice(input)) return;
            input.checked = false;
            input.disabled = true;
            var row = input.closest && input.closest('label, .device-check-item, .enterprise-picker-item');
            if (row) row.style.opacity = '0.45';
          }
        );
        if (window.__cmsGetSelectedOrigins && window.__cmsSetSelectedOrigins) {
          var selected = window.__cmsGetSelectedOrigins() || [];
          var allowed = selected.filter(function(origin) {
            return normalize(origin) !== ownOrigin && String(origin || '').indexOf(ownDeviceId) < 0;
          });
          if (allowed.length !== selected.length) window.__cmsSetSelectedOrigins(allowed);
        }
      }
      function addSafeOverlayStyles() {
        var style = document.createElement('style');
        style.textContent = '.dashboard-overlay, .template-editor-overlay, .enterprise-modal-overlay, .modal-overlay { box-sizing: border-box !important; padding: 14px !important; } .dashboard-panel, .enterprise-modal-panel { margin: 0 auto !important; max-height: calc(100dvh - 28px) !important; overflow: auto !important; }';
        document.head.appendChild(style);
      }
      addSafeOverlayStyles();
      lockAdminDeviceTarget();
      new MutationObserver(lockAdminDeviceTarget).observe(document.documentElement, { childList: true, subtree: true });
      setInterval(lockAdminDeviceTarget, 1200);
    })();
    true;
  `;
}

export default function AdminOnlyScreen() {
  const [urlInput, setUrlInput] = useState("");
  const [deviceCmsUrl, setDeviceCmsUrl] = useState("http://127.0.0.1:8080");
  const [deviceId, setDeviceId] = useState("");
  const [activeUrl, setActiveUrl] = useState("");
  const [error, setError] = useState("");
  const [openFocused, setOpenFocused] = useState(false);
  const [backFocused, setBackFocused] = useState(false);

  useEffect(() => {
    getAdminCmsUrl().then((url) => setUrlInput(url)).catch(() => undefined);
    startEmbeddedCmsServer();
    const refreshDeviceUrl = () => {
      const info = getCmsAccessInfo();
      setDeviceCmsUrl(normalizeCmsUrl(info.publicUrl || info.localUrl) || "http://127.0.0.1:8080");
      setDeviceId(String(info.deviceId || ""));
    };
    refreshDeviceUrl();
    const retryTimer = setTimeout(refreshDeviceUrl, 1500);
    return () => clearTimeout(retryTimer);
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!activeUrl) return false;
      setActiveUrl("");
      return true;
    });
    return () => subscription.remove();
  }, [activeUrl]);

  const openCms = async () => {
    // Empty input intentionally opens the embedded CMS on this device.
    // A typed URL/IP still lets an admin connect to another TV.
    const url = normalizeCmsUrl(urlInput) || deviceCmsUrl;
    setError("");
    setUrlInput(url);
    setActiveUrl(url);
    await saveAdminCmsUrl(url);
  };

  if (activeUrl) {
    return (
      <View style={[styles.root, styles.rootWeb]}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Admin CMS</Text>
            <Text style={styles.url} numberOfLines={1}>{activeUrl}</Text>
          </View>
          <Pressable
            onPress={() => setActiveUrl("")}
            onFocus={() => setBackFocused(true)}
            onBlur={() => setBackFocused(false)}
            style={[styles.backButton, backFocused ? styles.focused : null]}
            focusable
            hasTVPreferredFocus
          >
            <Text style={styles.buttonText}>Back</Text>
          </Pressable>
        </View>
        <View style={styles.webWrap}>
          <WebView
            key={activeUrl}
            source={{ uri: activeUrl }}
            style={styles.webview}
            originWhitelist={["*"]}
            javaScriptEnabled
            domStorageEnabled
            allowFileAccess
            allowUniversalAccessFromFileURLs
            mixedContentMode="always"
            setSupportMultipleWindows={false}
            androidLayerType="software"
            overScrollMode="never"
            nestedScrollEnabled
            bounces={false}
            injectedJavaScriptBeforeContentLoaded={buildAdminOnlyCmsScript(deviceId, deviceCmsUrl)}
            injectedJavaScript={`
              (function() {
                function disableAutoReopenForFilePicker(event) {
                  var target = event && event.target;
                  if (target && target.matches && target.matches('input[type="file"]')) {
                    window.ReactNativeWebView && window.ReactNativeWebView.postMessage('TV_FILE_PICKER_OPENING');
                  }
                }
                document.addEventListener('pointerdown', disableAutoReopenForFilePicker, true);
                document.addEventListener('touchstart', disableAutoReopenForFilePicker, true);
                document.addEventListener('click', disableAutoReopenForFilePicker, true);
              })();
              true;
            `}
            onMessage={(event) => {
              if (String(event?.nativeEvent?.data || "").trim() === "TV_FILE_PICKER_OPENING") {
                setAutoReopenEnabled(false);
              }
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>ADMIN ONLY MODE</Text>
        <Text style={styles.title}>Open TV Admin CMS</Text>
        <Text style={styles.description}>
          Scan the QR code shown on the TV or enter its CMS address below. Example: 192.168.1.25:8080
        </Text>
        <TextInput
          value={urlInput}
          onChangeText={(value) => { setUrlInput(value); setError(""); }}
          placeholder="TV CMS URL or IP address"
          placeholderTextColor="rgba(218,235,248,0.45)"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={styles.input}
        />
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Pressable
          onPress={openCms}
          onFocus={() => setOpenFocused(true)}
          onBlur={() => setOpenFocused(false)}
          style={[styles.openButton, openFocused ? styles.focused : null]}
          focusable
          hasTVPreferredFocus
        >
          <Text style={styles.buttonText}>Open Admin CMS</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b111a", padding: 16 },
  rootWeb: { padding: 0 },
  card: { flex: 1, width: "100%", maxWidth: 720, alignSelf: "center", justifyContent: "center" },
  eyebrow: { color: "#73c6ff", fontSize: 13, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: "#fff", fontSize: 26, fontWeight: "800" },
  description: { marginTop: 12, color: "rgba(225,239,250,0.78)", fontSize: 15, lineHeight: 22 },
  input: { marginTop: 20, color: "#fff", fontSize: 16, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 10, borderWidth: 1, borderColor: "rgba(120,190,231,0.45)", backgroundColor: "#14202d" },
  error: { marginTop: 8, color: "#ffafaa", fontSize: 13 },
  openButton: { marginTop: 16, alignSelf: "flex-start", minWidth: 200, alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, backgroundColor: "#1d8fff", borderRadius: 10, borderWidth: 2, borderColor: "rgba(129,207,255,0.55)" },
  backButton: { minWidth: 80, alignItems: "center", paddingHorizontal: 14, paddingVertical: 11, backgroundColor: "#1d8fff", borderRadius: 10, borderWidth: 2, borderColor: "rgba(129,207,255,0.55)" },
  focused: { backgroundColor: "#43a6ff", borderColor: "#d3f5ff", transform: [{ scale: 1.04 }] },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  header: { minHeight: 70, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 12, backgroundColor: "#17202c" },
  headerCopy: { flex: 1, minWidth: 0 },
  url: { marginTop: 3, color: "rgba(225,239,250,0.7)", fontSize: 12 },
  webWrap: { flex: 1, overflow: "hidden" },
  webview: { flex: 1, backgroundColor: "#0b111a" },
});
