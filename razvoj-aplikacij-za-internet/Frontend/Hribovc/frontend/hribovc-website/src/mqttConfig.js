const getDefaultBrokerUrl = () => {
  const hostname = window.location.hostname || 'localhost'
  return `ws://${hostname}:9001`
}

export const MQTT_CONFIG = {
  brokerUrl: import.meta.env.VITE_MQTT_BROKER_URL || getDefaultBrokerUrl(),
  sensorsTopic: import.meta.env.VITE_MQTT_SENSORS_TOPIC || 'hribovc/senzorji',
  heartbeatTopic: import.meta.env.VITE_MQTT_HEARTBEAT_TOPIC || 'hribovc/heartbeat',
  statusTopic: import.meta.env.VITE_MQTT_STATUS_TOPIC || 'hribovc/status',
  activeDeviceTimeoutMs: Number(import.meta.env.VITE_ACTIVE_DEVICE_TIMEOUT_MS) || 15000,
}