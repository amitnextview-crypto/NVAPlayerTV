import React, { useEffect, useRef, useState } from "react";
import { Animated, View, Dimensions, Text, Easing } from "react-native";

export default function Ticker({ ticker }: any) {
  const { width } = Dimensions.get("window");
  const tickerText = String(ticker?.text || "");
  const loopText = `${tickerText}     •     `;
  const fontSize = Number(ticker?.fontSize || 24);
  // Start on-screen while native layout measures the first copy.
  const translateX = useRef(new Animated.Value(0)).current;
  const [textWidth, setTextWidth] = useState(0);
  const lastMeasuredRef = useRef(0);
  const effectiveTextWidth = Math.ceil(textWidth);
  // Used only before native measurement arrives, so even a very long message
  // receives enough layout width and cannot be clipped by the TV viewport.
  const fallbackTextWidth = Math.ceil(
    Math.max(1, Array.from(loopText).length) * Math.max(12, fontSize) * 2 + 64,
  );
  // Some TV firmware does not dispatch onTextLayout consistently. The fallback
  // is intentionally a valid animation width, not a reason to stop scrolling.
  const animationTextWidth = effectiveTextWidth || fallbackTextWidth;
  // Two copies leave a visible empty stretch when a short message is shown on
  // a large TV. Fill the viewport with repeated units plus an extra one for
  // the seamless hand-off at the animation boundary.
  const copyCount = Math.max(2, Math.ceil(width / animationTextWidth) + 2);

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
    const duration = Math.max(1800, (animationTextWidth / pixelsPerSecond) * 1000);

    // Every unit contains the same message. At the end of one unit, the next
    // is at the exact same screen position, so looping creates no blank gap.
    translateX.setValue(0);

    const animation = Animated.loop(
      Animated.timing(translateX, {
        toValue: -animationTextWidth,
        duration: duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    animation.start();

    return () => animation.stop();

  }, [animationTextWidth, ticker?.speed, tickerText, translateX, width]);

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
        onTextLayout={(event) => {
          // This copy can wrap; adding all line widths gives the width of the
          // complete message rather than the width of the TV screen.
          const lines = Array.isArray(event?.nativeEvent?.lines)
            ? event.nativeEvent.lines
            : [];
          const widthValue = lines.reduce(
            (total: number, line: any) => total + Number(line?.width || 0),
            0,
          );
          if (!widthValue || Math.abs(widthValue - lastMeasuredRef.current) < 1) return;
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
        {Array.from({ length: copyCount }, (_, copy) => (
          <Text
            key={copy}
            numberOfLines={1}
            ellipsizeMode="clip"
            style={{
              // Android may otherwise constrain long row children to the TV
              // viewport. Give every unit the full measured message width.
              width: animationTextWidth,
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
