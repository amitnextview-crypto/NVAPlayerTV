import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { AppMode } from "../services/setupService";

type Props = {
  onSelectMode: (mode: AppMode) => void;
};

export default function SetupScreen({ onSelectMode }: Props) {
  const [tvFocused, setTvFocused] = useState(false);
  const [adminFocused, setAdminFocused] = useState(false);

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>WELCOME</Text>
        <Text style={styles.title}>Use this device for TV signage?</Text>
        <Text style={styles.description}>
          Choose TV mode for media playback, or Admin only to manage a TV CMS from this device.
        </Text>
        <View style={styles.actions}>
          <Pressable
            onPress={() => onSelectMode("tvMode")}
            onFocus={() => setTvFocused(true)}
            onBlur={() => setTvFocused(false)}
            style={({ pressed }) => [styles.button, tvFocused ? styles.buttonFocused : null, pressed ? styles.buttonPressed : null]}
            focusable
            hasTVPreferredFocus
          >
            <Text style={styles.buttonTitle}>Yes — TV Mode</Text>
            <Text style={styles.buttonHint}>Play signage content on this screen</Text>
          </Pressable>
          <Pressable
            onPress={() => onSelectMode("adminOnlyMode")}
            onFocus={() => setAdminFocused(true)}
            onBlur={() => setAdminFocused(false)}
            style={({ pressed }) => [styles.button, adminFocused ? styles.buttonFocused : null, pressed ? styles.buttonPressed : null]}
            focusable
          >
            <Text style={styles.buttonTitle}>No — Admin Only</Text>
            <Text style={styles.buttonHint}>Open and manage a TV CMS</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b111a", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 680, borderRadius: 20, padding: 28, backgroundColor: "#14202d", borderWidth: 1, borderColor: "rgba(120,190,231,0.25)" },
  eyebrow: { color: "#73c6ff", fontSize: 13, fontWeight: "800", letterSpacing: 1.2 },
  title: { marginTop: 8, color: "#fff", fontSize: 27, fontWeight: "800" },
  description: { marginTop: 12, color: "rgba(225,239,250,0.78)", fontSize: 15, lineHeight: 22 },
  actions: { marginTop: 24, gap: 14 },
  button: { borderRadius: 12, padding: 18, backgroundColor: "#1d8fff", borderWidth: 2, borderColor: "rgba(129,207,255,0.55)" },
  buttonFocused: { backgroundColor: "#43a6ff", borderColor: "#d3f5ff", transform: [{ scale: 1.025 }] },
  buttonPressed: { opacity: 0.85 },
  buttonTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  buttonHint: { marginTop: 4, color: "rgba(255,255,255,0.84)", fontSize: 13 },
});
