import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { Accelerometer } from 'expo-sensors';
import { CONFIG } from './config';

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState({ x: 0, y: 0, z: 0 });
  const [isActive, setIsActive] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);

  const toggleAccelerometer = () => {
    if (subscription) {
      subscription.remove();
      setSubscription(null);
      setIsActive(false);
    } else {
      Accelerometer.setUpdateInterval(500);
      setSubscription(Accelerometer.addListener(setData));
      setIsActive(true);
    }
  };

  useEffect(() => {
    return () => { if (subscription) subscription.remove(); };
  }, [subscription]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <Text style={styles.logo}>HRIBOVC <Text style={styles.orange}>DASH</Text></Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: isActive ? '#44ff44' : '#ff4444' }]} />
            <Text style={styles.statusText}>{isActive ? 'Senzorji tečejo' : 'Senzorji ustavljeni'}</Text>
          </View>
        </View>

        <View style={styles.statsSection}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>POSPEŠKOMER X</Text>
            <Text style={styles.statValue}>{data.x.toFixed(3)}</Text>
          </View>
          
          <View style={styles.divider} />

          <View style={styles.statItem}>
            <Text style={styles.statLabel}>POSPEŠKOMER Y</Text>
            <Text style={styles.statValue}>{data.y.toFixed(3)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statItem}>
            <Text style={styles.statLabel}>POSPEŠKOMER Z</Text>
            <Text style={styles.statValue}>{data.z.toFixed(3)}</Text>
          </View>
          
          <View style={styles.divider} />

          <View style={styles.statItem}>
            <Text style={styles.statLabel}>MQTT KANAL</Text>
            <Text style={[styles.statValue, {fontSize: 16, color: '#666'}]}>{CONFIG.MQTT_TOPIC_SENSORS}</Text>
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

          <TouchableOpacity onPress={() => router.replace('/login')}>
            <Text style={styles.logoutText}>ODJAVA IZ SISTEMA</Text>
          </TouchableOpacity>
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
    paddingTop: 40,
  },
  header: {
    marginBottom: 50,
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
    marginBottom: 40,
  },
  statItem: {
    paddingVertical: 20,
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
});