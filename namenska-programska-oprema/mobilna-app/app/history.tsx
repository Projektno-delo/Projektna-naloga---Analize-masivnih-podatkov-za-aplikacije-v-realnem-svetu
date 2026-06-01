import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, Alert } from 'react-native';
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

  const handleClear = () => {
  if (readings.length === 0) {
    Alert.alert(
      'Prazna zgodovina',
      'Ni meritev za brisanje.'
    );
    return;
  }

    Alert.alert(
      'Izbris zgodovine',
      `Ali res želite izbrisati vseh ${readings.length} shranjenih meritev? Teh podatkov ni mogoče obnoviti.`,
      [
        {
          text: 'Prekliči',
          style: 'cancel',
        },
        {
          text: 'Izbriši',
          style: 'destructive',
          onPress: async () => {
            await clearReadings();
            setReadings([]);

            Alert.alert(
              'Uspešno',
              'Zgodovina meritev je bila uspešno izbrisana.'
            );
          },
        },
      ]
    );
  };

  const avgX =
  readings.length > 0
    ? readings.reduce((sum, r) => sum + r.accelerometer.x, 0) / readings.length
    : 0;

  const avgY =
    readings.length > 0
      ? readings.reduce((sum, r) => sum + r.accelerometer.y, 0) / readings.length
      : 0;

  const avgZ =
    readings.length > 0
      ? readings.reduce((sum, r) => sum + r.accelerometer.z, 0) / readings.length
      : 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>HRIBOVC <Text style={styles.orange}>HISTORY</Text></Text>
          <Text style={styles.count}>Shranjenih meritev: {readings.length}</Text>
        </View>

        <View style={styles.statsBox}>
        <Text style={styles.statsTitle}>STATISTIKA MERITEV</Text>

        <Text style={styles.statText}>
          Meritev skupaj: {readings.length}
        </Text>

        <Text style={styles.statText}>
          Povprečen X: {avgX.toFixed(3)}
        </Text>

        <Text style={styles.statText}>
          Povprečen Y: {avgY.toFixed(3)}
        </Text>

        <Text style={styles.statText}>
          Povprečen Z: {avgZ.toFixed(3)}
        </Text>
      </View>

        {readings.length === 0 ? (
          <Text style={styles.empty}>Ni še nobenih meritev.</Text>
        ) : (
          readings.map((r, i) => (
            <View key={i} style={styles.card}>
              <Text style={styles.time}>{new Date(r.timestamp).toLocaleTimeString()}</Text>
              <Text style={styles.data}>X: {r.accelerometer.x.toFixed(3)}</Text>
              <Text style={styles.data}>Y: {r.accelerometer.y.toFixed(3)}</Text>
              <Text style={styles.data}>Z: {r.accelerometer.z.toFixed(3)}</Text>
              <Text style={styles.gps}>
                {r.location 
                  ? `GPS: ${r.location.latitude.toFixed(4)}, ${r.location.longitude.toFixed(4)}` 
                  : 'Lokacija ni na voljo'}
              </Text>
            </View>
          ))
        )}
        
        <View style={{ height: 200 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
          <Text style={styles.clearText}>ZBRIŠI ZGODOVINO</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/')}>
          <Text style={styles.homeText}>DOMOV</Text>
        </TouchableOpacity>
      </View>

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

  count: { 
    color: '#444', 
    fontSize: 12, 
    fontWeight: '700', 
    letterSpacing: 1,
    marginTop: 8,
  },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 30,
    paddingBottom: 70,
    paddingTop: 16,
    backgroundColor: '#050505',
    gap: 14,
},

  homeBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
},

  homeText: { 
    color: '#fff', 
    fontSize: 13, 
    fontWeight: '700', 
    letterSpacing: 1 
  },

  statsBox: {
  marginTop: -10,
  marginBottom: 16,
  padding: 14,
  borderRadius: 12,
  backgroundColor: 'rgba(255,255,255,0.04)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.06)',
},

statText: {
  color: '#fff',
  fontSize: 14,
  marginBottom: 4,
},

statsTitle: {
  color: '#ff6b35',
  fontSize: 18,
  fontWeight: '800',
  letterSpacing: 1,
  marginBottom: 14,
},
}); 
