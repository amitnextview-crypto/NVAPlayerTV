import React, { useState, useEffect } from "react";
import { Text, View } from "react-native";

const ClockWidget = ({ config }: { config: any }) => {
  const [timeStr, setTimeStr] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const is24h = config?.format === "24h";
      setTimeStr(
        now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: !is24h,
        })
      );
      setDateStr(
        now.toLocaleDateString([], {
          weekday: "long",
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [config?.format]);

  const position = config?.position || "top-left";
  const transparency = config?.transparency || 0.5; // 0 = opaque, 1 = fully transparent
  const bgColor = `rgba(0, 0, 0, ${1 - transparency})`;
  const borderColor = `rgba(56, 189, 248, ${1 - transparency})`;
  const positionStyle = {
    position: "absolute" as const,
    top: position.includes("top") ? 20 : undefined,
    bottom: position.includes("bottom") ? 20 : undefined,
    left: position.includes("left") ? 20 : undefined,
    right: position.includes("right") ? 20 : undefined,
  };

  return (
    <View style={[positionStyle, { backgroundColor: bgColor, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: borderColor }]}>
      <Text style={{ color: "#38bdf8", fontSize: 26, fontWeight: "900", letterSpacing: 1 }}>
        🕒 {timeStr}
      </Text>
      <Text style={{ color: "#cbd5e1", fontSize: 12, fontWeight: "600", marginTop: 4 }}>
        {dateStr}
      </Text>
    </View>
  );
};

export default ClockWidget;
