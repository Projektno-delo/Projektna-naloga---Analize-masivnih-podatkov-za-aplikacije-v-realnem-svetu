import mqtt from 'mqtt'
import { MQTT_CONFIG } from './mqttConfig'

export const parseMqttJson = (payload, topic = 'unknown') => {
  try {
    return JSON.parse(payload.toString())
  } catch {
    console.warn(`Invalid MQTT JSON payload on topic ${topic}:`, payload.toString())
    return null
  }
}

export const isSensorReading = (value) => {
  const accelerometer = value?.accelerometer
  const hasAccelerometer = (
    Number.isFinite(accelerometer?.x)
    && Number.isFinite(accelerometer?.y)
    && Number.isFinite(accelerometer?.z)
  )

  if (!hasAccelerometer) {
    return false
  }

  if (!value.location) {
    return true
  }

  return (
    Number.isFinite(value.location.latitude)
    && Number.isFinite(value.location.longitude)
  )
}

export const createWebMqttClient = ({
  onStatusChange,
  onSensorReading,
  onHeartbeat,
  onDeviceStatus,
  onError,
} = {}) => {
  const client = mqtt.connect(MQTT_CONFIG.brokerUrl, {
    clientId: `hribovc_web_${Math.random().toString(16).slice(2)}`,
    clean: true,
    connectTimeout: 5000,
    reconnectPeriod: 2000,
  })

  client.on('connect', () => {
    onStatusChange?.('connected')

    client.subscribe([
      MQTT_CONFIG.sensorsTopic,
      MQTT_CONFIG.heartbeatTopic,
      MQTT_CONFIG.statusTopic,
    ], (error) => {
      if (error) {
        onError?.(error)
        return
      }

      console.log('Subscribed to MQTT topics:', {
        sensorsTopic: MQTT_CONFIG.sensorsTopic,
        heartbeatTopic: MQTT_CONFIG.heartbeatTopic,
        statusTopic: MQTT_CONFIG.statusTopic,
      })
    })
  })

  client.on('reconnect', () => onStatusChange?.('reconnecting'))
  client.on('offline', () => onStatusChange?.('offline'))
  client.on('close', () => onStatusChange?.('offline'))

  client.on('error', error => {
    onStatusChange?.('error')
    onError?.(error)
  })

  client.on('message', (topic, payload) => {
    const parsed = parseMqttJson(payload, topic)

    if (!parsed) {
      return
    }

    if (topic === MQTT_CONFIG.sensorsTopic && isSensorReading(parsed)) {
      onSensorReading?.(parsed)
      return
    }

    if (topic === MQTT_CONFIG.heartbeatTopic) {
      onHeartbeat?.(parsed)
      return
    }

    if (topic === MQTT_CONFIG.statusTopic) {
      onDeviceStatus?.(parsed)
    }
  })

  return client
}