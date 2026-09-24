import React, { useState, useEffect } from "react";
import { Text, View } from "react-native";

const WeatherWidget = ({ config }: { config: any }) => {
  const [temp, setTemp] = useState<string>("--");
  const [condition, setCondition] = useState<string>("Loading...");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const city = config?.city || "Delhi";
        setLoading(true);

        // Fetch coordinates from city name using Open-Meteo Geocoding API
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
            city
          )}&count=1&language=en&format=json`
        );
        const geoData = await geoRes.json();

        if (!geoData.results || geoData.results.length === 0) {
          setCondition("City not found");
          setLoading(false);
          return;
        }

        const { latitude, longitude } = geoData.results[0];

        // Fetch weather using coordinates
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
        );
        const weatherData = await weatherRes.json();

        if (weatherData && weatherData.current_weather) {
          const t = Math.round(weatherData.current_weather.temperature);
          const unit = config?.unit === "fahrenheit" ? "°F" : "°C";
          const tempInUnit = config?.unit === "fahrenheit" ? Math.round(t * (9 / 5) + 32) : t;
          setTemp(`${tempInUnit}${unit}`);

          const code = weatherData.current_weather.weathercode;
          if (code === 0) setCondition("Clear ☀️");
          else if (code >= 1 && code <= 3) setCondition("Partly Cloudy ⛅");
          else if (code >= 45 && code <= 48) setCondition("Foggy 🌫️");
          else if (code >= 51 && code <= 67) setCondition("Rain 🌧️");
          else if (code >= 71 && code <= 77) setCondition("Snow 🌨️");
          else if (code >= 80 && code <= 82) setCondition("Showers 🌦️");
          else if (code >= 95) setCondition("Thunderstorm ⛈️");
          else setCondition("Cloudy ☁️");
        } else {
          setCondition("Weather unavailable");
        }
      } catch (e) {
        console.error("Weather fetch error:", e);
        setCondition("Error loading weather");
      } finally {
        setLoading(false);
      }
    };
    fetchWeather();
    const interval = setInterval(fetchWeather, 600000); // Refresh every 10 minutes
    return () => clearInterval(interval);
  }, [config?.city, config?.unit]);

  const position = config?.position || "top-right";
  const transparency = config?.transparency || 0.5; // 0 = opaque, 1 = fully transparent
  const size = config?.size || 1; // 0.5 = small, 2 = large
  const bgColor = config?.bgColor || "#000000";
  const textColor = config?.textColor || "#4ade80";
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
      <Text style={{ color: textColor, fontSize: 24 * size, fontWeight: "bold" }}>
        {loading ? "Loading..." : condition}
      </Text>
      <Text style={{ color: textColor, fontSize: 20 * size, fontWeight: "800", marginTop: 2 }}>
        {config?.city || "Delhi"}: {temp}
      </Text>
    </View>
  );
};

export default WeatherWidget;
