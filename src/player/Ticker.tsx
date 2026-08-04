import React, { useEffect, useRef, useState } from "react";
import { Animated, View, Dimensions, Text, Easing } from "react-native";

export default function Ticker({ ticker }: any) {
  const { width } = Dimensions.get("window");
  const tickerText = String(ticker?.text || "");
  const loopText = `${tickerText}     •     `;
  const fontSize = Number(ticker?.fontSize || 24);
  const translateX = useRef(new Animated.Value(width)).current;
  const [textWidth, setTextWidth] = useState(0);
  const lastMeasuredRef = useRef(0);

  // Android TV's onTextLayout is not guaranteed to fire on every device.
  // This conservative fallback keeps the message visible immediately; when a
  // native measurement arrives it can only make the scroll distance longer.
  const estimatedTextWidth = Math.ceil(
    Math.max(1, Array.from(loopText).length) * Math.max(12, fontSize) * 1.5 + 48,
  );
  const effectiveTextWidth = textWidth > 0 ? Math.ceil(textWidth) : estimatedTextWidth;

  // Do not reuse a width measured for a smaller font or older message.
  // This prevents a short/stale animation when CMS updates the ticker live.
  useEffect(() => {
    lastMeasuredRef.current = 0;
    setTextWidth(0);
  }, [fontSize, tickerText]);

  useEffect(() => {
    if (!tickerText) return;

    const speed = ticker.speed ?? 6;

    const pixelsPerSecond = 40 + speed * 15;
    const duration = Math.max(1800, (effectiveTextWidth / pixelsPerSecond) * 1000);

    // Both units contain the same message. At the end of one unit, the next
    // is at the exact same screen position, so looping creates no blank gap.
    translateX.setValue(0);

    const animation = Animated.loop(
      Animated.timing(translateX, {
        toValue: -effectiveTextWidth,
        duration: duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    animation.start();

    return () => animation.stop();

  }, [effectiveTextWidth, ticker?.speed, tickerText, translateX, width]);

  if (!tickerText) return null;

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
          left: 0,
          top: 0,
          width: "100%",
          fontSize,
          fontWeight: "800",
          letterSpacing: 0.6,
        }}
        onTextLayout={(e) => {
          const lines = Array.isArray(e?.nativeEvent?.lines) ? e.nativeEvent.lines : [];
          // This invisible text is deliberately allowed to wrap. Adding each
          // laid-out line gives the full glyph width, rather than the first
          // screen-wide line that caused the visible ticker to be cut off.
          const widthValue = lines.reduce(
            (total: number, line: any) => total + Number(line?.width || 0),
            0,
          );
          if (!widthValue) return;
          if (Math.abs(widthValue - lastMeasuredRef.current) < 1) return;
          lastMeasuredRef.current = widthValue;
          setTextWidth(widthValue);
        }}
      >
        {loopText}
      </Text>
      <Animated.View
        style={{
          transform: [{ translateX }],
          flexDirection: "row",
          alignSelf: "flex-start",
        }}
      >
        {[0, 1].map((copy) => (
          <Text
            key={copy}
            numberOfLines={1}
            ellipsizeMode="clip"
            style={{
              // Give each rendered unit its full width. This prevents a
              // large font from being clipped to the TV viewport.
              width: effectiveTextWidth,
              flexShrink: 0,
              color: ticker.color || "#fff",
              fontSize,
              textShadowColor: "rgba(0, 0, 0, 0.85)",
              textShadowOffset: { width: 3, height: 3 },
              textShadowRadius: 6,
              letterSpacing: 0.6,
              fontWeight: "800",
            }}
          >
            {loopText}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}
