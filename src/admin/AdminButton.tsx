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
  const baseColor = isRight ? "#ffb347" : "#62d7ff";
  const accentColor = isRight ? "#ff6b6b" : "#4af2c8";
  const activeColor = focused ? accentColor : baseColor;
  return (
    <TouchableOpacity
      onPress={onOpen}
      activeOpacity={0.78}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      focusable
      style={{
        position: "absolute",
        bottom: 8,
        ...(side === "right" ? { right: 8 } : { left: 8 }),
        minWidth: compact ? 22 : 54,
        minHeight: compact ? 22 : 28,
        paddingHorizontal: compact ? 2 : 8,
        paddingVertical: compact ? 5 : 5,
        backgroundColor: "transparent",
        borderRadius: 0,
        borderWidth: 0,
        opacity: focused ? 1 : 0.96,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
      }}
    >
      <Text
        style={{
          fontSize: compact ? 12 : 10,
          color: activeColor,
          fontWeight: "800",
          textShadowColor: focused ? accentColor : baseColor,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: focused ? 10 : 6,
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
