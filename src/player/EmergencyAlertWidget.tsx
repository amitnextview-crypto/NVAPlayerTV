import React, { useState, useEffect } from "react";
import { Text, View, Pressable, NativeModules } from "react-native";

interface EmergencyAlertData {
  active: boolean;
  type: string;
  title: string;
  message: string;
  sound: boolean;
}

const EmergencyAlertWidget = ({ alert, onClear }: { alert: EmergencyAlertData; onClear: () => void }) => {
  const [flash, setFlash] = useState<boolean>(false);

  useEffect(() => {
    if (!alert?.active) return;

    // Play siren if module exists
    if (alert.sound && (NativeModules as any)?.DeviceIdModule?.playSirenAlarm) {
      (NativeModules as any).DeviceIdModule.playSirenAlarm();
    }

    const interval = setInterval(() => setFlash((prev) => !prev), 500);
    return () => {
      clearInterval(interval);
      // Stop siren if module exists
      if ((NativeModules as any)?.DeviceIdModule?.stopSirenAlarm) {
        (NativeModules as any).DeviceIdModule.stopSirenAlarm();
      }
    };
  }, [alert?.active, alert?.sound]);

  if (!alert?.active) return null;

  // Use type-based colors for triggered alerts
  const typeBasedBgColor = alert.type === "FIRE" ? "#ef4444" : alert.type === "EVACUATION" ? "#f97316" : alert.type === "GENERAL" ? "#0284c7" : "#ef4444";
  const baseBg = typeBasedBgColor;
  const textColor = "#ffffff";

  // Create a darker version for flash effect
  const bg = flash ? baseBg : adjustColor(baseBg, -30);

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: bg,
        zIndex: 99999,
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
      }}
    >
      <Text
        style={{
          color: textColor,
          fontSize: 48,
          fontWeight: "900",
          textAlign: "center",
          textTransform: "uppercase",
          letterSpacing: 2,
        }}
      >
        {alert.title || "🚨 EMERGENCY ALERT"}
      </Text>
      <Text
        style={{
          color: textColor,
          fontSize: 26,
          fontWeight: "bold",
          textAlign: "center",
          marginTop: 24,
          lineHeight: 36,
        }}
      >
        {alert.message || "PLEASE EVACUATE IMMEDIATELY!"}
      </Text>
      <Pressable
        onPress={() => {
          if ((NativeModules as any)?.DeviceIdModule?.stopSirenAlarm) {
            (NativeModules as any).DeviceIdModule.stopSirenAlarm();
          }
          onClear();
        }}
        style={{ marginTop: 40, backgroundColor: "#ffffff", paddingHorizontal: 28, paddingVertical: 14, borderRadius: 8 }}
      >
        <Text style={{ color: "#000000", fontSize: 16, fontWeight: "bold" }}>CLEAR EMERGENCY ALERT</Text>
      </Pressable>
    </View>
  );
};

// Helper function to darken/lighten hex color
function adjustColor(color: string, amount: number): string {
  const hex = color.replace("#", "");
  const num = parseInt(hex, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}

export default EmergencyAlertWidget;
