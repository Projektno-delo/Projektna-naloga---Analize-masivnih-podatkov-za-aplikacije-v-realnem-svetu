import Constants from 'expo-constants';

const getDevServerHost = () => {
  const hostUri = Constants.expoConfig?.hostUri;
  return hostUri?.split(':')[0] || 'localhost';
};

const DEV_SERVER_HOST = getDevServerHost();

export const CONFIG = {
  API_URL: `http://${DEV_SERVER_HOST}:3000`,
  MQTT_BROKER: `ws://${DEV_SERVER_HOST}:9001`,
  MQTT_TOPIC_SENSORS: 'hribovc/senzorji',
  MQTT_TOPIC_HEARTBEAT: 'hribovc/heartbeat',
};
