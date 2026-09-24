import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, Pressable, NativeModules } from 'react-native';

const ClockWidget = ({ config }: { config: any }) => {
  const [timeStr, setTimeStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const is24h = config?.clockFormat === '24h';
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: !is24h }));
      setDateStr(now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [config?.clockFormat]);

  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.92)', padding: 14, justifyContent: 'center', alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#38bdf8' }}>
      <Text style={{ color: '#38bdf8', fontSize: 26, fontWeight: '900', letterSpacing: 1 }}>🕒 {timeStr}</Text>
      <Text style={{ color: '#cbd5e1', fontSize: 12, fontWeight: '600', marginTop: 4 }}>{dateStr}</Text>
    </View>
  );
};

const WeatherWidget = ({ config }: { config: any }) => {
  const [temp, setTemp] = useState<string>('--');
  const [condition, setCondition] = useState<string>('Loading...');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const city = config?.weatherCity || 'Delhi';
        setLoading(true);
        
        // Fetch coordinates from city name using Open-Meteo Geocoding API
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
        const geoData = await geoRes.json();
        
        if (!geoData.results || geoData.results.length === 0) {
          setCondition('City not found');
          setLoading(false);
          return;
        }
        
        const { latitude, longitude } = geoData.results[0];
        
        // Fetch weather using coordinates
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
        const weatherData = await weatherRes.json();
        
        if (weatherData && weatherData.current_weather) {
          const t = Math.round(weatherData.current_weather.temperature);
          const unit = config?.weatherUnit === 'fahrenheit' ? '°F' : '°C';
          const tempInUnit = config?.weatherUnit === 'fahrenheit' ? Math.round(t * 9/5 + 32) : t;
          setTemp(`${tempInUnit}${unit}`);
          
          const code = weatherData.current_weather.weathercode;
          if (code === 0) setCondition('Clear ☀️');
          else if (code >= 1 && code <= 3) setCondition('Partly Cloudy ⛅');
          else if (code >= 45 && code <= 48) setCondition('Foggy 🌫️');
          else if (code >= 51 && code <= 67) setCondition('Rain 🌧️');
          else if (code >= 71 && code <= 77) setCondition('Snow 🌨️');
          else if (code >= 80 && code <= 82) setCondition('Showers 🌦️');
          else if (code >= 95) setCondition('Thunderstorm ⛈️');
          else setCondition('Cloudy ☁️');
        } else {
          setCondition('Weather unavailable');
        }
      } catch (e) {
        console.error('Weather fetch error:', e);
        setCondition('Error loading weather');
      } finally {
        setLoading(false);
      }
    };
    fetchWeather();
    const interval = setInterval(fetchWeather, 600000); // Refresh every 10 minutes
    return () => clearInterval(interval);
  }, [config?.weatherCity, config?.weatherUnit]);

  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.92)', padding: 14, justifyContent: 'center', alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#4ade80' }}>
      <Text style={{ color: '#4ade80', fontSize: 24, fontWeight: 'bold' }}>{loading ? 'Loading...' : condition}</Text>
      <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '800', marginTop: 2 }}>{config?.weatherCity || 'Delhi'}: {temp}</Text>
    </View>
  );
};

interface EmergencyAlertData {
  active: boolean;
  type: string;
  title: string;
  message: string;
  sound: boolean;
}

const EmergencyAlertOverlay = ({ alert, onClear }: { alert: EmergencyAlertData; onClear: () => void }) => {
  const [flash, setFlash] = useState<boolean>(false);

  useEffect(() => {
    if (!alert?.active) return;
    
    // Play siren if module exists
    if (alert.sound && (NativeModules as any)?.CmsServerModule?.playSirenAlarm) {
      (NativeModules as any).CmsServerModule.playSirenAlarm();
    }
    
    const interval = setInterval(() => setFlash((prev) => !prev), 500);
    return () => {
      clearInterval(interval);
      // Stop siren if module exists
      if ((NativeModules as any)?.CmsServerModule?.stopSirenAlarm) {
        (NativeModules as any).CmsServerModule.stopSirenAlarm();
      }
    };
  }, [alert?.active, alert?.sound]);

  if (!alert?.active) return null;

  const bg = alert.type === 'FIRE' ? (flash ? '#ef4444' : '#991b1b') : alert.type === 'EVACUATION' ? (flash ? '#f97316' : '#c2410c') : '#0284c7';

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: bg, zIndex: 99999, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text style={{ color: '#ffffff', fontSize: 48, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2 }}>
        {alert.title || '🚨 EMERGENCY ALERT'}
      </Text>
      <Text style={{ color: '#ffffff', fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginTop: 24, lineHeight: 36 }}>
        {alert.message || 'PLEASE EVACUATE IMMEDIATELY!'}
      </Text>
      <Pressable
        onPress={() => {
          if ((NativeModules as any)?.CmsServerModule?.stopSirenAlarm) {
            (NativeModules as any).CmsServerModule.stopSirenAlarm();
          }
          onClear();
        }}
        style={{ marginTop: 40, backgroundColor: '#ffffff', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 8 }}
      >
        <Text style={{ color: '#000000', fontSize: 16, fontWeight: 'bold' }}>CLEAR EMERGENCY ALERT</Text>
      </Pressable>
    </View>
  );
};

function App() {
  const [config, setConfig] = useState({ clockFormat: '12h', weatherCity: 'Delhi', weatherUnit: 'celsius' });
  const [emergencyAlert, setEmergencyAlert] = useState({ active: false, type: '', title: '', message: '', sound: false });

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Signage Player Running 🚀</Text>
      
      {/* Widgets positioned absolutely over the main content */}
      <View style={{ position: 'absolute', top: 20, left: 20, width: 200, height: 100 }}>
        <ClockWidget config={config} />
      </View>
      
      <View style={{ position: 'absolute', top: 20, right: 20, width: 200, height: 100 }}>
        <WeatherWidget config={config} />
      </View>
      
      <EmergencyAlertOverlay 
        alert={emergencyAlert} 
        onClear={() => setEmergencyAlert({ ...emergencyAlert, active: false })} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 40,
    color: 'red',
  },
});

export default App;
