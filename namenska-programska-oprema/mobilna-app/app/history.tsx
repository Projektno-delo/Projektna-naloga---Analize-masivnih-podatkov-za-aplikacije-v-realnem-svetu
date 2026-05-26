import { View, Text, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { getReadings, clearReadings, SensorReading } from './service/sensorStorage';
import { StyleSheet } from 'react-native';

export default function History() {
  const router = useRouter();
  const [readings, setReadings] = useState<SensorReading[]>([]);

  useEffect(() => {
    loadReadings();
  }, []);

  const loadReadings = async () => {
    const data = await getReadings();
    setReadings(data);
  };

  const handleClear = async () => {
    await clearReadings();
    setReadings([]);
  };

 return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            {/* <Text style={styles.back}>← NAZAJ</Text> */}
          </TouchableOpacity>
          <Text style={styles.title}>HRIBOVC <Text style={styles.orange}>HISTORY</Text></Text>
        </View>

        {readings.length === 0 ? (
          <Text style={styles.empty}>Ni še nobenih meritev.</Text>
        ) : (
          readings.map((r, i) => (
            <View key={i} style={styles.card}>
              <Text style={styles.time}>{new Date(r.timestamp).toLocaleTimeString()}</Text>
              <Text style={styles.data}>X: {r.accelerometer.x.toFixed(3)}  Y: {r.accelerometer.y.toFixed(3)}  Z: {r.accelerometer.z.toFixed(3)}</Text>
              {r.location && (
                <Text style={styles.gps}>GPS: {r.location.latitude.toFixed(4)}, {r.location.longitude.toFixed(4)}</Text>
              )}
            </View>
          ))
        )}

        <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
          <Text style={styles.clearText}>ZBRIŠI ZGODOVINO</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );

}

 const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#050505' 
  },
  scrollContent: { 
    paddingHorizontal: 30, 
    paddingTop: 40, 
    paddingBottom: 40 
  },
  header: { 
    marginBottom: 40 
  },
  back: { 
    color: '#ff6b35', 
    fontSize: 13, 
    fontWeight: '700', 
    letterSpacing: 1, 
    marginBottom: 16 
  },
  title: { 
    color: '#fff', 
    fontSize: 24, 
    fontWeight: '900', 
    letterSpacing: 2 
  },
  orange: { 
    color: '#ff6b35' 
  },
  empty: { 
    color: '#444', 
    fontSize: 16, 
    textAlign: 'center', 
    marginTop: 60 
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  time: { 
    color: '#ff6b35', 
    fontSize: 12, 
    fontWeight: '700', 
    letterSpacing: 1, 
    marginBottom: 6 
  },
  data: { 
    color: '#fff', 
    fontSize: 16, 
    fontFamily: 'monospace', 
    marginBottom: 4 
  },
  gps: { 
    color: '#555', 
    fontSize: 12 
  },
  clearBtn: {
    marginTop: 30,
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
  },
  clearText: { 
    color: '#ff4444', 
    fontSize: 13, 
    fontWeight: '700', 
    letterSpacing: 1 
  },
}); 
