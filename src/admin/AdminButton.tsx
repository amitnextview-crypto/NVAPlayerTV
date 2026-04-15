import React, { useState } from "react";
import { TouchableOpacity, Text } from "react-native";

type Props = {
  onOpen: () => void;
  side?: "left" | "right";
  label?: string;
  icon?: string;
};

export default function AdminButton({
  onOpen,
  side = "left",
  label,
  icon = "\u2699",
}: Props) {
  const compact = !label;
  const [focused, setFocused] = useState(false);
  const isRight = side === "right";
  const baseColor = isRight ? "#f8b84e" : "#64d4ff";
  const accentColor = isRight ? "#ff7e63" : "#59f0cb";
  const activeColor = focused ? accentColor : baseColor;
  const shellSize = compact ? 24 : 29;
  return (
    <TouchableOpacity
      onPress={onOpen}
      activeOpacity={0.78}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      focusable
      style={{
        position: "absolute",
        bottom: 16,
        ...(side === "right" ? { right: 16 } : { left: 16 }),
        width: shellSize,
        height: shellSize,
        justifyContent: "center",
        opacity: focused ? 1 : 0.96,
        alignItems: "center",
        backgroundColor: isRight ? "rgba(62, 28, 12, 0.9)" : "rgba(7, 34, 46, 0.9)",
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: focused ? accentColor : `${baseColor}cc`,
      }}
    >
      <Text
        style={{
          fontSize: compact ? 10 : 8,
          color: activeColor,
          fontWeight: "800",
          textShadowColor: focused ? accentColor : baseColor,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: focused ? 14 : 8,
        }}
      >
        {icon}
      </Text>
      {label ? (
        <Text
          style={{
            fontSize: 9,
            color: activeColor,
            fontWeight: "800",
            textShadowColor: focused ? accentColor : baseColor,
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: focused ? 8 : 4,
          }}
        >
          {label}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}
