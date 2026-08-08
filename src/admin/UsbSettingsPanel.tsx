import React, { useEffect, useState } from "react";
import { Modal, NativeModules, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

type Props = {
  visible: boolean;
  config: any;
  activeSectionCount: number;
  sourceName: "USB" | "Storage";
  onClose: () => void;
  onSave: (config: any) => void;
  onRefreshStorage: () => Promise<{ count: number; sourceName: string }>;
};

const ORIENTATIONS = ["horizontal", "vertical", "reverse-horizontal", "reverse-vertical"];
const GRID_LAYOUTS = [
  { id: "stack-v", label: "Stack Vertical" },
  { id: "stack-h", label: "Stack Horizontal" },
  { id: "top-two-bottom-one", label: "Top 2 / Bottom 1" },
  { id: "top-one-bottom-two", label: "Top 1 / Bottom 2" },
];

const cycle = (items: string[], value: string) => items[(Math.max(0, items.indexOf(value)) + 1) % items.length];
const label = (value: string) => value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function UsbSettingsPanel({ visible, config, activeSectionCount, sourceName, onClose, onSave, onRefreshStorage }: Props) {
  const [draft, setDraft] = useState<any>(config || {});
  const [focusedField, setFocusedField] = useState("");
  const [scanStatus, setScanStatus] = useState("");
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (visible) setDraft(config || {});
  }, [config, visible]);

  const apply = () => {
    const tickerDraft = draft?.ticker || {};
    const normalizeNumber = (value: any, fallback: number, min: number, max: number) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
    };
    onSave({
      ...config,
      ...draft,
      ticker: {
        ...(config?.ticker || {}),
        ...tickerDraft,
        fontSize: normalizeNumber(tickerDraft.fontSize, 24, 10, 100),
        speed: normalizeNumber(tickerDraft.speed, 6, 1, 20),
      },
    });
  };
  const openWifiSettings = () => {
    (NativeModules as any)?.DeviceIdModule?.setAutoReopenEnabled?.(false);
    (NativeModules as any)?.DeviceIdModule?.openWifiSettings?.();
  };
  const refreshApp = () => {
    (NativeModules as any)?.DeviceIdModule?.restartApp?.();
  };
  const refreshStorage = async () => {
    if (scanning) return;
    setScanning(true);
    setScanStatus(`Scanning ${sourceName} in background…`);
    try {
      const result = await onRefreshStorage();
      setScanStatus(`${result.sourceName} scan complete: ${result.count} playable file${result.count === 1 ? "" : "s"}.`);
    } catch {
      setScanStatus("Storage scan failed. Check folder access and try again.");
    } finally {
      setScanning(false);
    }
  };
  const inputProps = (field: string) => ({
    onFocus: () => setFocusedField(field),
    onBlur: () => setFocusedField(""),
    selectTextOnFocus: true,
    style: [styles.input, focusedField === field && styles.focused],
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View><Text style={styles.title}>{sourceName} Settings</Text><Text style={styles.subtitle}>Only {sourceName} playback controls</Text></View>
            <View style={styles.headerActions}><Pressable style={({ hovered, pressed }: any) => [styles.refresh, (focusedField === "refresh" || hovered || pressed) && styles.focused]} onFocus={() => setFocusedField("refresh")} onBlur={() => setFocusedField("")} onPress={refreshApp}><Text style={styles.refreshText}>Refresh App</Text></Pressable><Pressable style={({ hovered, pressed }: any) => [styles.close, (focusedField === "close" || hovered || pressed) && styles.focused]} onFocus={() => setFocusedField("close")} onBlur={() => setFocusedField("")} onPress={onClose}><Text style={styles.closeText}>Close</Text></Pressable></View>
          </View>
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator>
            <Text style={styles.label}>Screen rotation</Text>
            <Pressable style={({ hovered, pressed }: any) => [styles.option, (focusedField === "rotation" || hovered || pressed) && styles.focused]} onFocus={() => setFocusedField("rotation")} onBlur={() => setFocusedField("")} onPress={() => setDraft((value: any) => ({ ...value, orientation: cycle(ORIENTATIONS, value.orientation || "horizontal") }))}>
              <Text style={styles.optionText}>{label(draft.orientation || "horizontal")}</Text><Text style={styles.optionHint}>Tap to change</Text>
            </Pressable>
            <Text style={styles.label}>USB layout template</Text>
            <View style={styles.autoLayout}><Text style={styles.optionText}>{activeSectionCount <= 1 ? "Fullscreen" : `Grid ${activeSectionCount}`}</Text><Text style={styles.optionHint}>Auto-selected from populated USB sections</Text></View>
            {activeSectionCount >= 2 ? <>
              <Text style={styles.label}>Grid Layout Options</Text>
              <Text style={styles.optionHint}>Select the exact arrangement you want on screen.</Text>
              <View style={styles.layoutGrid}>
                {GRID_LAYOUTS.slice(0, activeSectionCount === 2 ? 2 : 4).map((item) => {
                  const selected = String(draft?.grid3Layout || "stack-v") === item.id;
                  return <Pressable key={item.id} style={({ hovered, pressed }: any) => [styles.layoutChoice, selected && styles.layoutSelected, (focusedField === `grid-${item.id}` || hovered || pressed) && styles.focused]} onFocus={() => setFocusedField(`grid-${item.id}`)} onBlur={() => setFocusedField("")} onPress={() => setDraft((value: any) => ({ ...value, grid3Layout: item.id }))}><Text style={styles.optionText}>{item.label}</Text></Pressable>;
                })}
              </View>
              <Text style={styles.label}>Select ratio</Text>
              <View style={styles.layoutGrid}>
                {(activeSectionCount === 2 ? ["1:1", "2:1", "1:2", "3:2", "2:3"] : ["1:1:1", "2:1:1", "1:2:1", "1:1:2", "2:2:1"]).map((ratio) => {
                  const selected = String(draft?.gridRatio || (activeSectionCount === 2 ? "1:1" : "1:1:1")) === ratio;
                  return <Pressable key={ratio} style={({ hovered, pressed }: any) => [styles.ratioChoice, selected && styles.layoutSelected, (focusedField === `ratio-${ratio}` || hovered || pressed) && styles.focused]} onFocus={() => setFocusedField(`ratio-${ratio}`)} onBlur={() => setFocusedField("")} onPress={() => setDraft((value: any) => ({ ...value, gridRatio: ratio }))}><Text style={styles.optionText}>{ratio}</Text></Pressable>;
                })}
              </View>
            </> : null}
            <Pressable disabled={scanning} style={({ hovered, pressed }: any) => [styles.storageRefresh, (focusedField === "storage-refresh" || hovered || pressed) && styles.focused, scanning && styles.disabled]} onFocus={() => setFocusedField("storage-refresh")} onBlur={() => setFocusedField("")} onPress={refreshStorage}><Text style={styles.wifiText}>{scanning ? "Scanning Storage…" : "Refresh Storage"}</Text><Text style={styles.optionHint}>{scanStatus || "Rescan USB/internal nvsign folders without restarting the app."}</Text></Pressable>
            <Text style={styles.label}>Ticker text</Text>
            <TextInput value={String(draft?.ticker?.text || "")} onChangeText={(text) => setDraft((value: any) => ({ ...value, ticker: { ...(value.ticker || {}), text } }))} placeholder="Optional ticker message" placeholderTextColor="#7890a0" {...inputProps("ticker-text")} />
            <View style={styles.tickerGrid}>
              <View style={styles.field}><Text style={styles.fieldLabel}>Font size</Text><TextInput keyboardType="numeric" value={String(draft?.ticker?.fontSize ?? 24)} onChangeText={(fontSize) => setDraft((value: any) => ({ ...value, ticker: { ...(value.ticker || {}), fontSize } }))} {...inputProps("ticker-font-size")} /></View>
              <View style={styles.field}><Text style={styles.fieldLabel}>Speed</Text><TextInput keyboardType="numeric" value={String(draft?.ticker?.speed ?? 6)} onChangeText={(speed) => setDraft((value: any) => ({ ...value, ticker: { ...(value.ticker || {}), speed } }))} {...inputProps("ticker-speed")} /></View>
              <View style={styles.field}><Text style={styles.fieldLabel}>Text color</Text><TextInput value={String(draft?.ticker?.color || "#ffffff")} onChangeText={(color) => setDraft((value: any) => ({ ...value, ticker: { ...(value.ticker || {}), color } }))} {...inputProps("ticker-color")} /></View>
              <View style={styles.field}><Text style={styles.fieldLabel}>Background color</Text><TextInput value={String(draft?.ticker?.bgColor || "#000000")} onChangeText={(bgColor) => setDraft((value: any) => ({ ...value, ticker: { ...(value.ticker || {}), bgColor } }))} {...inputProps("ticker-bg-color")} /></View>
            </View>
            <Pressable style={({ hovered, pressed }: any) => [styles.wifi, (focusedField === "wifi" || hovered || pressed) && styles.focused]} onFocus={() => setFocusedField("wifi")} onBlur={() => setFocusedField("")} onPress={openWifiSettings}><Text style={styles.wifiText}>Connect Wi-Fi</Text><Text style={styles.optionHint}>Auto reopen is disabled before opening Wi-Fi settings</Text></Pressable>
          </ScrollView>
          <View style={styles.footer}><Pressable style={({ hovered, pressed }: any) => [styles.save, (focusedField === "save" || hovered || pressed) && styles.focused]} onFocus={() => setFocusedField("save")} onBlur={() => setFocusedField("")} onPress={apply}><Text style={styles.saveText}>Apply USB Settings</Text></Pressable></View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, padding: 16, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(2,8,14,0.82)" },
  card: { width: "100%", maxWidth: 640, maxHeight: "90%", borderRadius: 20, overflow: "hidden", backgroundColor: "#0b1722", borderWidth: 1, borderColor: "rgba(120,210,255,0.4)" },
  header: { padding: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "rgba(150,220,255,0.14)" },
  title: { color: "#fff", fontSize: 22, fontWeight: "800" }, subtitle: { marginTop: 3, color: "#a9c9db" },
  close: { backgroundColor: "#cf5d4f", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 }, closeText: { color: "#fff", fontWeight: "800" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  refresh: { backgroundColor: "#1689e8", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 }, refreshText: { color: "#fff", fontWeight: "800" },
  body: { padding: 18, gap: 9 }, label: { marginTop: 6, color: "#dceefa", fontWeight: "800", fontSize: 14 },
  option: { borderRadius: 12, padding: 14, backgroundColor: "#12283a", borderWidth: 2, borderColor: "rgba(126,205,255,0.28)" }, autoLayout: { borderRadius: 12, padding: 14, backgroundColor: "#12283a", borderWidth: 1, borderColor: "rgba(126,205,255,0.28)" }, optionText: { color: "#fff", fontSize: 16, fontWeight: "700" }, optionHint: { marginTop: 4, color: "#8eb7ce", fontSize: 12 },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: "#fff", backgroundColor: "#12283a", borderWidth: 1, borderColor: "rgba(126,205,255,0.28)" },
  wifi: { marginTop: 8, borderRadius: 12, padding: 14, backgroundColor: "#155f9f" }, wifiText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  storageRefresh: { marginTop: 8, borderRadius: 12, padding: 14, backgroundColor: "#126b87", borderWidth: 1, borderColor: "#4de0d0" },
  layoutGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, layoutChoice: { flexGrow: 1, flexBasis: "42%", borderRadius: 12, padding: 13, backgroundColor: "#12283a", borderWidth: 2, borderColor: "rgba(126,205,255,0.28)" }, layoutSelected: { borderColor: "#1689e8", backgroundColor: "#123c59" },
  ratioChoice: { flexGrow: 1, flexBasis: "27%", borderRadius: 12, padding: 12, backgroundColor: "#12283a", borderWidth: 2, borderColor: "rgba(126,205,255,0.28)", alignItems: "center" },
  tickerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, field: { flexGrow: 1, flexBasis: "44%" }, fieldLabel: { color: "#b9d7e8", marginBottom: 5, fontSize: 12, fontWeight: "700" },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: "rgba(150,220,255,0.14)" }, save: { borderRadius: 12, paddingVertical: 14, alignItems: "center", backgroundColor: "#1689e8", borderWidth: 2, borderColor: "transparent" }, saveText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  focused: { borderColor: "#58e68b", shadowColor: "#58e68b", shadowOpacity: 0.7, shadowRadius: 10, elevation: 7, transform: [{ scale: 1.02 }] },
  disabled: { opacity: 0.65 },
});
