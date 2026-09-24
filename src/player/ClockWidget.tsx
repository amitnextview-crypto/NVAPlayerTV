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
  const size = config?.size || 1; // 0.5 = small, 2 = large
  const bgColor = config?.bgColor || "#000000";
  const textColor = config?.textColor || "#38bdf8";
  const bgAlpha = `rgba(${parseInt(bgColor.slice(1, 3), 16)}, ${parseInt(bgColor.slice(3, 5), 16)}, ${parseInt(bgColor.slice(5, 7), 16)}, ${1 - transparency})`;
  const borderColor = `rgba(${parseInt(textColor.slice(1, 3), 16)}, ${parseInt(textColor.slice(3, 5), 16)}, ${parseInt(textColor.slice(5, 7), 16)}, ${1 - transparency})`;
  const positionStyle = {
    position: "absolute" as const,
    top: position.includes("top") ? 20 : undefined,
    bottom: position.includes("bottom") ? 20 : undefined,
    left: position.includes("left") ? 20 : undefined,
    right: position.includes("right") ? 20 : undefined,
  };

  return (
    <View style={[positionStyle, { backgroundColor: bgAlpha, padding: 14 * size, borderRadius: 10, borderWidth: 1, borderColor: borderColor }]}>
      <Text style={{ color: textColor, fontSize: 26 * size, fontWeight: "900", letterSpacing: 1 }}>
        🕒 {timeStr}
      </Text>
      <Text style={{ color: textColor, fontSize: 12 * size, fontWeight: "600", marginTop: 4 }}>
        {dateStr}
      </Text>
    </View>
  );
};

export default ClockWidget;
