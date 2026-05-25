import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SensorReading{
    timestamp: string;
    accelerometer: { x: number, y: number, z: number};
    location: {latitude: number, longitude: number } | null;
}

const STORAGE_KEY = 'sensor_history';
const MAX_READINGS = 50;

export const saveReading = async (reading: SensorReading) => {
  try {
    const existing = await getReadings();
    const updated = [reading, ...existing].slice(0, MAX_READINGS);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Napaka pri shranjevanju:', e);
  }
};

export const getReadings = async (): Promise<SensorReading[]> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const clearReadings = async () => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Napaka pri brisanju:', e);
  }
};