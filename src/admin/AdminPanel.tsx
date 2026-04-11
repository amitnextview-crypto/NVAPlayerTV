import React, { useState, useEffect, useRef } from "react";
import { View, TouchableOpacity, Text, StyleSheet, Animated, TextInput, Alert } from "react-native";
import { WebView } from "react-native-webview";
import { findCMS, getServer, setServer } from "../services/serverService";

export default function AdminPanel({ visible, onClose }: any) {
  const slide = useRef(new Animated.Value(400)).current;

  const [server, updateServer] = useState("");
  const [manualInput, setManualInput] = useState("http://172.19.88.107:8080");

  useEffect(() => {
    async function init() {
      const url = await findCMS();
      if (url) updateServer(url);
    }
    init();
  }, []);

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 0 : 400,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible]);

const saveManualServer = async () => {
  if (!manualInput.startsWith("http")) {
    return Alert.alert("Enter full URL, e.g., http://192.168.1.5:8080");
  }

  await setServer(manualInput);

  Alert.alert("Saved CMS URL", manualInput);

  // 🔥 Close panel
  onClose();

  // 🔥 Force full app reload
  const { DevSettings } = require("react-native");
  DevSettings.reload();
};

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { transform: [{ translateX: slide }] }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin Panel</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, padding: 10 }}>
        {/* Manual CMS input */}
        <Text style={{ color: "#fff", marginBottom: 6 }}>CMS URL (manual):</Text>
        <TextInput
          placeholder="http://PC_IP:8080"
          placeholderTextColor="#888"
          value={manualInput}
          onChangeText={setManualInput}
          style={{
            backgroundColor: "#222",
            color: "#fff",
            padding: 10,
            borderRadius: 6,
            marginBottom: 10,
          }}
        />
        <TouchableOpacity
          onPress={saveManualServer}
          style={{ backgroundColor: "#4da3ff", padding: 10, borderRadius: 6, marginBottom: 20 }}
        >
          <Text style={{ color: "#fff", textAlign: "center" }}>Save CMS URL</Text>
        </TouchableOpacity>

        {/* WebView for config */}
        {server ? (
          <WebView
            source={{ uri: server }}
            style={{ flex: 1 }}
            onMessage={(event) => {
              if (event.nativeEvent.data === "CONFIG_SAVED") onClose();
            }}
          />
        ) : (
          <Text style={{ color: "#fff" }}>CMS not detected. Enter URL above.</Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "90%",
    backgroundColor: "#111",
  },
  header: {
    height: 60,
    backgroundColor: "#222",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  close: { color: "#fff", fontSize: 24 },
});






