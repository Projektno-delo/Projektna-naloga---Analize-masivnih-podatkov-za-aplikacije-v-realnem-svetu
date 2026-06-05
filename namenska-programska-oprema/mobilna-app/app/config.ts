import Constants from 'expo-constants';

type ExpoHostSource = {
  hostUri?: string;
  debuggerHost?: string;
  extra?: {
    expoClient?: {
      hostUri?: string;
    };
  };
};

const getHostFromUri = (value?: string | null) => {
  if (!value) {
    return null;
  }

  return value
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0] || null;
};

const getDevServerHost = () => {
  const manifest = Constants.manifest as ExpoHostSource | null;
  const manifest2 = Constants.manifest2 as ExpoHostSource | null;
  const candidates = [
    process.env.EXPO_PUBLIC_DEV_SERVER_HOST,
    Constants.expoConfig?.hostUri,
    manifest2?.extra?.expoClient?.hostUri,
    manifest?.debuggerHost,
  ];

  for (const candidate of candidates) {
    const host = getHostFromUri(candidate);
    if (host) {
      return host;
    }
  }

  return 'localhost';
};

const DEV_SERVER_HOST = getDevServerHost();
const API_URL = process.env.EXPO_PUBLIC_API_URL || `http://${DEV_SERVER_HOST}:3000`;
const MQTT_BROKER = process.env.EXPO_PUBLIC_MQTT_BROKER_URL || `ws://${DEV_SERVER_HOST}:9001`;

export const CONFIG = {
  API_URL,
  MQTT_BROKER,
   //MQTT_BROKER: 'ws://broker.emqx.io:8083/mqtt', // Javen testni broker
  MQTT_TOPIC_SENSORS: 'hribovc/senzorji',
  MQTT_TOPIC_HEARTBEAT: 'hribovc/heartbeat',
  MQTT_TOPIC_STATUS: 'hribovc/status',
  MQTT_TOPIC_ORV_2FA_REQUEST: 'hribovc/orv-2fa/request',
};
