import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { Accelerometer } from 'expo-sensors';
import * as Location from 'expo-location';
import mqtt from 'mqtt';
import { CONFIG } from './config';
import { saveReading } from './service/sensorStorage';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_SAVE_INTERVAL_MS = 5000;

export default function Dashboard() {
  const router = useRouter();

  const [accel, setAccel] = useState({ x: 0, y: 0, z: 0 });
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [lastUploadStatus, setLastUploadStatus] = useState('Ni zapisa');
  const [userEmail, setUserEmail] = useState('');
  const [deviceId, setDeviceId] = useState('unknown-device');
  const [subscription, setSubscription] = useState<any>(null);

  const clientRef = useRef<any>(null);
  const heartbeatRef = useRef<any>(null);
  const latestAccelRef = useRef({ x: 0, y: 0, z: 0 });
  const latestLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const userEmailRef = useRef('');
  const deviceIdRef = useRef('unknown-device');
  const lastBackendSaveAtRef = useRef(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const getCurrentDeviceId = () => deviceIdRef.current || 'unknown-device';
  const getCurrentUserEmail = () => userEmailRef.current || 'unknown';

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
    let mounted = true;
    let client: any = null;

    const loadIdentityAndConnectMqtt = async () => {
      let email = '';

      try {
        const data = await AsyncStorage.getItem('user');

        if (data) {
          const user = JSON.parse(data);
          email = user.email || '';
        }
      } catch (error) {
        console.log('Napaka pri branju uporabnika iz AsyncStorage:', error);
      }

      if (!mounted) {
        return;
      }

      const nextDeviceId = email || 'unknown-device';

      userEmailRef.current = email;
      deviceIdRef.current = nextDeviceId;

      setUserEmail(email);
      setDeviceId(nextDeviceId);

      client = mqtt.connect(CONFIG.MQTT_BROKER, {
        clientId: `hribovc_mobile_${nextDeviceId.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 3000,
        will: {
          topic: CONFIG.MQTT_TOPIC_STATUS,
          payload: JSON.stringify({
            deviceId: nextDeviceId,
            userEmail: email || 'unknown',
            status: 'offline',
            timestamp: new Date().toISOString(),
          }),
          qos: 1,
          retain: false,
        },
      });

      clientRef.current = client;

      client.on('connect', () => {
        console.log('MQTT connected:', CONFIG.MQTT_BROKER);
        setMqttConnected(true);

        client.publish(
          CONFIG.MQTT_TOPIC_STATUS,
          JSON.stringify({
            deviceId: nextDeviceId,
            userEmail: email || 'unknown',
            status: 'online',
            timestamp: new Date().toISOString(),
          }),
          { qos: 1 }
        );
      });

      client.on('reconnect', () => {
        console.log('MQTT reconnecting');
        setMqttConnected(false);
      });

      client.on('offline', () => {
        console.log('MQTT offline');
        setMqttConnected(false);
      });

      client.on('close', () => {
        console.log('MQTT closed');
        setMqttConnected(false);
      });

      client.on('end', () => {
        console.log('MQTT ended');
        setMqttConnected(false);
      });

      client.on('error', (error: any) => {
        console.log('MQTT error:', error?.message);
        setMqttConnected(false);
      });

      heartbeatRef.current = setInterval(() => {
        if (client.connected) {
          client.publish(
            CONFIG.MQTT_TOPIC_HEARTBEAT,
            JSON.stringify({
              status: 'alive',
              deviceId: nextDeviceId,
              userEmail: email || 'unknown',
              timestamp: new Date().toISOString(),
            }),
            { qos: 1 }
          );
        }
      }, 5000);
    };

    loadIdentityAndConnectMqtt();

    return () => {
      mounted = false;

      const finalDeviceId = getCurrentDeviceId();
      const finalUserEmail = getCurrentUserEmail();

      if (client?.connected) {
        client.publish(
          CONFIG.MQTT_TOPIC_STATUS,
          JSON.stringify({
            deviceId: finalDeviceId,
            userEmail: finalUserEmail,
            status: 'offline',
            timestamp: new Date().toISOString(),
          }),
          { qos: 1 }
        );
      }

      client?.end();
      clearInterval(heartbeatRef.current);
    };
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      const nextLocation = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };

      latestLocationRef.current = nextLocation;
      setLocation(nextLocation);
    })();
  }, []);

  const getFreshLocation = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();

      if (status !== 'granted') {
        return latestLocationRef.current;
      }

      const loc = await Location.getCurrentPositionAsync({});
      const nextLocation = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };

      latestLocationRef.current = nextLocation;
      setLocation(nextLocation);

      return nextLocation;
    } catch (error) {
      return latestLocationRef.current;
    }
  };

  const buildReading = (readingLocation = latestLocationRef.current) => ({
    deviceId: getCurrentDeviceId(),
    userEmail: getCurrentUserEmail(),
    accelerometer: latestAccelRef.current,
    location: readingLocation,
    timestamp: new Date().toISOString(),
  });

  const saveReadingToBackend = async (reading: any) => {
    const response = await fetch(`${CONFIG.API_URL}/sensor-readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reading),
    });

    if (!response.ok) {
      throw new Error(`Backend save failed: ${response.status}`);
    }

    return response.json();
  };

  const publishSensorReading = (reading: any) => {
    if (!clientRef.current?.connected) {
      return Promise.reject(new Error('MQTT ni povezan'));
    }

    return new Promise<void>((resolve, reject) => {
      clientRef.current.publish(
        CONFIG.MQTT_TOPIC_SENSORS,
        JSON.stringify(reading),
        { qos: 1 },
        (error: Error | null) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        }
      );
    });
  };

  const queueBackendSave = (reading: any, force = false) => {
    const now = Date.now();

    if (!force && now - lastBackendSaveAtRef.current < BACKEND_SAVE_INTERVAL_MS) {
      return Promise.resolve(null);
    }

    lastBackendSaveAtRef.current = now;

    return saveReadingToBackend(reading)
      .then((result) => {
        setLastUploadStatus('Shranjeno v bazo');
        return result;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Ni shranjeno v bazo';
        setLastUploadStatus(`Napaka: ${message}`);
        throw error;
      });
  };

  const sendTestReading = async () => {
    const freshLocation = await getFreshLocation();

    const testReading = {
      deviceId: getCurrentDeviceId(),
      userEmail: getCurrentUserEmail(),
      accelerometer: {
        x: Number((Math.random() * 2 - 1).toFixed(3)),
        y: Number((Math.random() * 2 - 1).toFixed(3)),
        z: Number((Math.random() * 2 - 1).toFixed(3)),
      },
      location: freshLocation,
      timestamp: new Date().toISOString(),
      type: 'test-reading',
    };

    try {
      await saveReading(testReading);

      const [mqttResult, backendResult] = await Promise.allSettled([
        publishSensorReading(testReading),
        queueBackendSave(testReading, true),
      ]);

      if (backendResult.status === 'rejected') {
        throw backendResult.reason;
      }

      setLastUploadStatus(
        mqttResult.status === 'fulfilled'
          ? 'Testna meritev shranjena v bazo'
          : 'Testna meritev shranjena v bazo, MQTT ni povezan'
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Testna meritev ni bila shranjena';
      setLastUploadStatus(`Napaka: ${message}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

  const toggleAccelerometer = async () => {
    if (subscription) {
      subscription.remove();
      setSubscription(null);
      setIsActive(false);

      const stopLocation = await getFreshLocation();
      const finalReading = buildReading(stopLocation);

      saveReading(finalReading);

      try {
        await queueBackendSave(finalReading, true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Ni shranjeno v bazo';
        setLastUploadStatus(`Napaka: ${message}`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } else {
      Accelerometer.setUpdateInterval(500);

      const sub = Accelerometer.addListener((data) => {
        latestAccelRef.current = data;
        setAccel(data);

        const reading = {
          deviceId: getCurrentDeviceId(),
          userEmail: getCurrentUserEmail(),
          accelerometer: data,
          location: latestLocationRef.current,
          timestamp: new Date().toISOString(),
        };

        saveReading(reading);
        publishSensorReading(reading).catch(() => {});
        queueBackendSave(reading).catch(() => {});
      });

      setSubscription(sub);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsActive(true);
    }
  };

  useEffect(() => {
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [subscription]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        <View style={styles.header}>
          <Text style={styles.logo}>HRIBOVC <Text style={styles.orange}>DASH</Text></Text>

          <View style={styles.statusRow}>
            <Animated.View style={[styles.statusDot, {
              backgroundColor: isActive ? '#44ff44' : '#ff4444',
              transform: [{ scale: pulseAnim }],
            }]} />

            <Text style={styles.statusText}>
              {isActive ? 'Senzorji tecejo' : 'Senzorji ustavljeni'}
            </Text>

            <View style={[styles.statusDot, {
              backgroundColor: mqttConnected ? '#44ff44' : '#ff4444',
              marginLeft: 12,
            }]} />

            <Text style={styles.statusText}>
              {mqttConnected ? 'MQTT povezan' : 'MQTT odklopljen'}
            </Text>
          </View>
        </View>

        <View style={styles.statsSection}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>DEVICE ID</Text>
            <Text style={[styles.statValue, { fontSize: 18, color: '#aaa' }]}>{deviceId}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statItem}>
            <Text style={styles.statLabel}>UPORABNIK</Text>
            <Text style={[styles.statValue, { fontSize: 18, color: '#aaa' }]}>
              {userEmail || 'Ni prijavljenega uporabnika'}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statItem}>
            <Text style={styles.statLabel}>POSPESKOMER X</Text>
            <Text style={styles.statValue}>{accel.x.toFixed(3)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statItem}>
            <Text style={styles.statLabel}>POSPESKOMER Y</Text>
            <Text style={styles.statValue}>{accel.y.toFixed(3)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statItem}>
            <Text style={styles.statLabel}>POSPESKOMER Z</Text>
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
            <Text style={[styles.statValue, { fontSize: 16, color: '#666' }]}>
              {CONFIG.MQTT_TOPIC_SENSORS}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statItem}>
            <Text style={styles.statLabel}>MQTT BROKER</Text>
            <Text style={[styles.statValue, { fontSize: 16, color: '#666' }]}>
              {CONFIG.MQTT_BROKER}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statItem}>
            <Text style={styles.statLabel}>API SERVER</Text>
            <Text style={[styles.statValue, { fontSize: 16, color: '#666' }]}>
              {CONFIG.API_URL}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statItem}>
            <Text style={styles.statLabel}>ZADNJI ZAPIS</Text>
            <Text style={[styles.statValue, { fontSize: 16, color: '#666' }]}>
              {lastUploadStatus}
            </Text>
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

          <TouchableOpacity
            style={[styles.mainBtn, styles.secondaryBtn]}
            onPress={sendTestReading}
          >
            <Text style={styles.btnText}>SEND TEST READING</Text>
          </TouchableOpacity>

          <View style={styles.bottomRow}>
            <TouchableOpacity onPress={() => router.push('/history')}>
              <Text style={styles.logoutText}>ZGODOVINA</Text>
            </TouchableOpacity>

            <Text style={styles.logoutText}>.</Text>

            <TouchableOpacity onPress={() => router.replace('/')}>
              <Text style={styles.logoutText}>DOMOV</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
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
    paddingBottom: 100,
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
    borderColor: '#333',
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
  },

  secondaryBtn: {
    borderColor: '#ff6b35',
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