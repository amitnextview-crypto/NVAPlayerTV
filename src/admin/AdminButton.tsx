import React from "react";
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
  return (
    <TouchableOpacity
      onPress={onOpen}
      style={{
        position: "absolute",
        bottom: 8,
        ...(side === "right" ? { right: 8 } : { left: 8 }),
        minWidth: label ? 54 : 24,
        paddingHorizontal: label ? 8 : 5,
        paddingVertical: label ? 5 : 3,
        backgroundColor: "rgba(10, 18, 26, 0.5)",
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(120, 200, 255, 0.22)",
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 4,
        elevation: 3,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
      }}
    >
      <Text
        style={{
          fontSize: label ? 9 : 8,
          color: "rgba(233, 246, 255, 0.92)",
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
