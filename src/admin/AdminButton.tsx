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
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
      }}
    >
      <Text
        style={{
          fontSize: compact ? 10 : 9,
          color: focused ? "#62c7ff" : "rgba(233, 246, 255, 0.92)",
          fontWeight: "800",
        }}
      >
        {icon}
      </Text>
      {label ? (
        <Text
          style={{
            fontSize: 9,
            color: "rgba(233, 246, 255, 0.92)",
            fontWeight: "800",
          }}
        >
          {label}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}
