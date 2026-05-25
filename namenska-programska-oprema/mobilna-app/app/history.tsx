import { View, Text, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { getReadings, clearReadings, SensorReading } from './service/sensorStorage';

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
    <SafeAreaView>
      <ScrollView>
        <TouchableOpacity onPress={() => router.back()}>
          <Text>← NAZAJ</Text>
        </TouchableOpacity>
        
        <Text>ZGODOVINA MERITEV</Text>

        {readings.length === 0 ? (
          <Text>Ni še nobenih meritev.</Text>
        ) : (
          readings.map((r, i) => (
            <View key={i}>
              <Text>{new Date(r.timestamp).toLocaleTimeString()}</Text>
              <Text>X: {r.accelerometer.x.toFixed(3)}  Y: {r.accelerometer.y.toFixed(3)}  Z: {r.accelerometer.z.toFixed(3)}</Text>
              {r.location && (
                <Text>GPS: {r.location.latitude.toFixed(4)}, {r.location.longitude.toFixed(4)}</Text>
              )}
            </View>
          ))
        )}

        <TouchableOpacity onPress={handleClear}>
          <Text>ZBRIŠI ZGODOVINO</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}