import React, { useEffect, useRef, useState } from "react";
import { Animated, View, Dimensions, Text, Easing } from "react-native";

export default function Ticker({ ticker }: any) {
  const { width } = Dimensions.get("window");

  const translateX = useRef(new Animated.Value(width)).current;
  const [textWidth, setTextWidth] = useState(0);
  const lastMeasuredRef = useRef(0);

  useEffect(() => {
    if (!ticker?.text) return;

    if (!textWidth) return; // wait until width calculated

    const speed = ticker.speed ?? 6;

    const pixelsPerSecond = 40 + speed * 15;
    const distance = width + textWidth;
    const duration = (distance / pixelsPerSecond) * 1000;

    translateX.setValue(width);

    const animation = Animated.loop(
      Animated.timing(translateX, {
        toValue: -textWidth,
        duration: duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    animation.start();

    return () => animation.stop();

  }, [ticker?.text, ticker?.speed, textWidth]);

  if (!ticker?.text) return null;

  return (
    <View
      renderToHardwareTextureAndroid
      style={{
        backgroundColor: ticker.bgColor || "#000",
        overflow: "hidden",
        paddingVertical: 6,
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          position: "absolute",
          opacity: 0,
          fontSize: ticker.fontSize || 24,
          fontWeight: "800",
          letterSpacing: 0.6,
        }}
        onTextLayout={(e) => {
          const line = e?.nativeEvent?.lines?.[0];
          const widthValue = Number(line?.width || 0);
          if (!widthValue) return;
          if (Math.abs(widthValue - lastMeasuredRef.current) < 1) return;
          lastMeasuredRef.current = widthValue;
          setTextWidth(widthValue);
        }}
      >
        {ticker.text}
      </Text>
      <Animated.Text
        numberOfLines={1}
        ellipsizeMode="clip"
        style={{
          transform: [{ translateX }],
          color: ticker.color || "#fff",
          fontSize: ticker.fontSize || 24,
          textShadowColor: "rgba(0, 0, 0, 0.85)",
          textShadowOffset: { width: 3, height: 3 },
          textShadowRadius: 6,
          letterSpacing: 0.6,
          fontWeight: "800",
        }}
      >
        {ticker.text}
      </Animated.Text>
    </View>
  );
}
