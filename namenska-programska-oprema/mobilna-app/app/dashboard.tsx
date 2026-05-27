import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { Accelerometer } from 'expo-sensors';
import * as Location from 'expo-location';
import mqtt from 'mqtt';
import { CONFIG } from './config';
import { saveReading } from './service/sensorStorage';
//import { requestPermissions, sendNotification } from './service/notifications';
import * as Haptics from 'expo-haptics';


export default function Dashboard() {
  const router = useRouter();
  const [accel, setAccel] = useState({ x: 0, y: 0, z: 0 });
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const clientRef = useRef<any>(null);
  const heartbeatRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  

  useEffect(() => {
    if (isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.8, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isActive]);

  
  useEffect(() => {
    const client = mqtt.connect(CONFIG.MQTT_BROKER);
    clientRef.current = client;
    client.on('connect', () => setMqttConnected(true));
    client.on('error', () => setMqttConnected(false));
    client.on('disconnect', () => setMqttConnected(false));

    heartbeatRef.current = setInterval(() => {
      if (client.connected) {
        client.publish(CONFIG.MQTT_TOPIC_HEARTBEAT, JSON.stringify({
          status: 'alive',
          timestamp: new Date().toISOString(),
        }));
      }
    }, 5000);

    return () => {
      client.end();
      clearInterval(heartbeatRef.current);
    };
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('GPS status:', status);
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      console.log('GPS loc:', loc);
      setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    })();
  }, []);

  const toggleAccelerometer = async () => {
    if (subscription) {
        subscription.remove();
        setSubscription(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setIsActive(false);
      } else {
      Accelerometer.setUpdateInterval(500);
      const sub = Accelerometer.addListener((data) => {
        setAccel(data);
        const reading = {
          accelerometer: data,
          location,
          timestamp: new Date().toISOString(),
        };
        if (clientRef.current?.connected) {
          clientRef.current.publish(CONFIG.MQTT_TOPIC_SENSORS, JSON.stringify(reading));
        }
        saveReading(reading);
      });
      setSubscription(sub);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsActive(true);
    }
  };

  useEffect(() => {
    return () => { if (subscription) subscription.remove(); };
  }, [subscription]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.scrollContent}>

        <View style={styles.header}>
          <Text style={styles.logo}>HRIBOVC <Text style={styles.orange}>DASH</Text></Text>
          <View style={styles.statusRow}>
            <Animated.View style={[styles.statusDot, { backgroundColor: isActive ? '#44ff44' : '#ff4444', transform: [{ scale: pulseAnim }]}]} />
            <Text style={styles.statusText}>{isActive ? 'Senzorji tečejo' : 'Senzorji ustavljeni'}</Text>
            <View style={[styles.statusDot, { backgroundColor: mqttConnected ? '#44ff44' : '#ff4444', marginLeft: 12 }]} />
            <Text style={styles.statusText}>{mqttConnected ? 'MQTT povezan' : 'MQTT odklopljen'}</Text>
          </View>
        </View>

        <View style={styles.statsSection}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>POSPEŠKOMER X</Text>
            <Text style={styles.statValue}>{accel.x.toFixed(3)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>POSPEŠKOMER Y</Text>
            <Text style={styles.statValue}>{accel.y.toFixed(3)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>POSPEŠKOMER Z</Text>
            <Text style={styles.statValue}>{accel.z.toFixed(3)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>GPS LOKACIJA</Text>
            <Text style={[styles.statValue, { fontSize: 22 }]}>
              {location ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : 'Pridobivam...'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>MQTT KANAL</Text>
            <Text style={[styles.statValue, { fontSize: 16, color: '#666' }]}>{CONFIG.MQTT_TOPIC_SENSORS}</Text>
          </View>
        </View>

        <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.mainBtn, isActive && styles.btnActive]}
          onPress={toggleAccelerometer}
        >
          <Text style={styles.btnText}>
            {isActive ? 'USTAVI SENZORJE' : 'AKTIVIRAJ ZAJEM'}
          </Text>
        </TouchableOpacity>
        
        <View style={styles.bottomRow}>
          <TouchableOpacity onPress={() => router.push('/history')}>
            <Text style={styles.logoutText}>ZGODOVINA</Text>
          </TouchableOpacity>
        </View>
      </View>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },

  scrollContent: {
    paddingHorizontal: 30,
    paddingTop: 20,
    paddingBottom: 20,
  },

  header: {
    marginBottom: 30,
    marginTop: 20,
  },

  logo: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
  },

  orange: {
    color: '#ff6b35',
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  statusText: {
    color: '#555',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  statsSection: {
    marginBottom: 10,
  },

  statItem: {
    paddingVertical: 10,
  },

  statLabel: {
    color: '#444',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },

  statValue: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '300',
    fontFamily: 'monospace',
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  footer: {
    marginTop: 20,
    gap: 20,
    paddingBottom: 20,
  },

  mainBtn: {
    borderWidth: 1,
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
  },

  btnActive: {
    backgroundColor: '#ff6b35',
  },

  btnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },

  logoutText: {
    color: '#333',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
});