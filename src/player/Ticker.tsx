// import React, { useEffect, useRef, useState } from "react";
// import { Animated, View, Dimensions, Text, Easing } from "react-native";

// export default function Ticker({ ticker }: any) {
//   const { width } = Dimensions.get("window");

//   const translateX = useRef(new Animated.Value(width)).current;
//   const [textWidth, setTextWidth] = useState(0);
//   const lastMeasuredRef = useRef(0);

//   useEffect(() => {
//     if (!ticker?.text) return;

//     if (!textWidth) return; // wait until width calculated

//     const speed = ticker.speed ?? 6;

//     const pixelsPerSecond = 40 + speed * 15;
//     const distance = width + textWidth;
//     const duration = (distance / pixelsPerSecond) * 1000;

//     translateX.setValue(width);

//     const animation = Animated.loop(
//       Animated.timing(translateX, {
//         toValue: -textWidth,
//         duration: duration,
//         easing: Easing.linear,
//         useNativeDriver: true,
//       })
//     );

//     animation.start();

//     return () => animation.stop();

//   }, [ticker?.text, ticker?.speed, textWidth]);

//   if (!ticker?.text) return null;

//   return (
//     <View
//       renderToHardwareTextureAndroid
//       style={{
//         backgroundColor: ticker.bgColor || "#000",
//         overflow: "hidden",
//         paddingVertical: 6,
//         justifyContent: "center",
//       }}
//     >
//       <Text
//         style={{
//           position: "absolute",
//           opacity: 0,
//           fontSize: ticker.fontSize || 24,
//           fontWeight: "800",
//           letterSpacing: 0.6,
//         }}
//         onTextLayout={(e) => {
//           const line = e?.nativeEvent?.lines?.[0];
//           const widthValue = Number(line?.width || 0);
//           if (!widthValue) return;
//           if (Math.abs(widthValue - lastMeasuredRef.current) < 1) return;
//           lastMeasuredRef.current = widthValue;
//           setTextWidth(widthValue);
//         }}
//       >
//         {ticker.text}
//       </Text>
//       <Animated.Text
//         numberOfLines={1}
//         ellipsizeMode="clip"
//         style={{
//           transform: [{ translateX }],
//           color: ticker.color || "#fff",
//           fontSize: ticker.fontSize || 24,
//           textShadowColor: "rgba(0, 0, 0, 0.85)",
//           textShadowOffset: { width: 3, height: 3 },
//           textShadowRadius: 6,
//           letterSpacing: 0.6,
//           fontWeight: "800",
//         }}
//       >
//         {ticker.text}
//       </Animated.Text>
//     </View>
//   );
// }

import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  View,
  Dimensions,
  Text,
  Easing,
} from "react-native";

const MAX_TICKER_CHARS = 5000;

export default function Ticker({ ticker }: any) {
  const { width } = Dimensions.get("window");

  const translateX = useRef(
    new Animated.Value(width)
  ).current;

  const [textWidth, setTextWidth] = useState(0);
  const lastMeasuredRef = useRef(0);

  const displayText = String(
    ticker?.text || ""
  ).slice(0, MAX_TICKER_CHARS);

  useEffect(() => {
    if (!displayText) return;
    if (!textWidth) return;

    const speed = ticker?.speed ?? 6;

    const pixelsPerSecond = 40 + speed * 15;

    const distance = width + textWidth;

    const duration =
      (distance / pixelsPerSecond) * 1000;

    translateX.setValue(width);

    const animation = Animated.loop(
      Animated.timing(translateX, {
        toValue: -textWidth,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    animation.start();

    return () => animation.stop();
  }, [
    displayText,
    ticker?.speed,
    ticker?.fontSize,
    textWidth,
  ]);

  if (!displayText) return null;

  return (
    <View
      renderToHardwareTextureAndroid
      style={{
        backgroundColor:
          ticker?.bgColor || "#000",
        overflow: "hidden",
        paddingVertical: 6,
        minHeight:
          (ticker?.fontSize || 24) + 20,
        justifyContent: "center",
      }}
    >
      {/* Hidden width measurement */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          opacity: 0,
          width: 99999,
          left: 0,
          top: 0,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            fontSize:
              ticker?.fontSize || 24,
            fontWeight: "800",
            letterSpacing: 0.6,
            fontFamily:
              ticker?.fontFamily ||
              "sans-serif",
          }}
          onTextLayout={(e) => {
            const lines =
              e?.nativeEvent?.lines || [];

            const measuredWidth =
              Number(lines?.[0]?.width || 0);

            if (!measuredWidth) return;

            if (
              Math.abs(
                measuredWidth -
                lastMeasuredRef.current
              ) < 1
            ) {
              return;
            }

            lastMeasuredRef.current =
              measuredWidth;

            setTextWidth(measuredWidth);
          }}
        >
          {displayText}
        </Text>
      </View>

      {/* Visible ticker */}
      <View
        style={{
          overflow: "hidden",
          minHeight:
            (ticker?.fontSize || 24) + 20,
        }}
      >
        <Animated.View
          style={{
            transform: [{ translateX }],
            width: textWidth,
          }}
        >
          <Text
            style={{
              width: textWidth,

              color:
                ticker?.color || "#fff",

              fontSize:
                ticker?.fontSize || 24,

              fontFamily:
                ticker?.fontFamily ||
                "sans-serif",

              lineHeight:
                (ticker?.fontSize || 24) +
                10,

              fontWeight: "800",

              letterSpacing: 0.6,

              flexWrap: "nowrap",

              includeFontPadding: false,

              textShadowColor:
                "rgba(0,0,0,0.85)",

              textShadowOffset: {
                width: 3,
                height: 3,
              },

              textShadowRadius: 6,
            }}
          >
            {displayText}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}