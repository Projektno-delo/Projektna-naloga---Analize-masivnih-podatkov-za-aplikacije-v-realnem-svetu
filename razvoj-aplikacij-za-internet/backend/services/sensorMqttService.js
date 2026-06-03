const mqtt = require('mqtt');
const os = require('os');
const { getCollection } = require('../db');

function getLocalNetworkHost() {
  const interfaces = os.networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address;
      }
    }
  }

  return '127.0.0.1';
}

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || `mqtt://${getLocalNetworkHost()}:1883`;
const MQTT_SENSORS_TOPIC = process.env.MQTT_SENSORS_TOPIC || 'hribovc/senzorji';
const MQTT_HEARTBEAT_TOPIC = process.env.MQTT_HEARTBEAT_TOPIC || 'hribovc/heartbeat';
const MQTT_STATUS_TOPIC = process.env.MQTT_STATUS_TOPIC || 'hribovc/status';
const SENSOR_READINGS_COLLECTION = 'mobileSensorReadings';
const SENSOR_HEARTBEATS_COLLECTION = 'mobileSensorHeartbeats';

let client;

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parsePayload(payload) {
  try {
    return JSON.parse(payload.toString());
  } catch {
    return null;
  }
}

function normalizeSensorReading(payload, source = 'mobile-mqtt') {
  const accelerometer = payload?.accelerometer;
  const x = finiteNumber(accelerometer?.x);
  const y = finiteNumber(accelerometer?.y);
  const z = finiteNumber(accelerometer?.z);

  if (x === null || y === null || z === null) {
    return null;
  }

  const latitude = finiteNumber(payload?.location?.latitude);
  const longitude = finiteNumber(payload?.location?.longitude);
  const deviceTimestamp = payload?.timestamp ? new Date(payload.timestamp) : null;

  return {
    deviceId: payload?.deviceId || 'unknown-device',
    userEmail: payload?.userEmail || 'unknown',
    accelerometer: { x, y, z },
    location: latitude !== null && longitude !== null
      ? { latitude, longitude }
      : null,
    deviceTimestamp: deviceTimestamp && !Number.isNaN(deviceTimestamp.getTime())
      ? deviceTimestamp
      : null,
    receivedAt: new Date(),
    source,
  };
}

async function saveSensorReading(payload, source = 'mobile-mqtt') {
  const reading = normalizeSensorReading(payload, source);

  if (!reading) {
    return null;
  }

  const collection = await getCollection(SENSOR_READINGS_COLLECTION);
  const result = await collection.insertOne(reading);
  return {
    ...reading,
    _id: result.insertedId,
  };
}

async function saveHeartbeat(payload, source = 'mobile-mqtt-heartbeat') {
  const timestamp = payload?.timestamp ? new Date(payload.timestamp) : null;
  const collection = await getCollection(SENSOR_HEARTBEATS_COLLECTION);

  await collection.insertOne({
    deviceId: payload?.deviceId || 'unknown-device',
    userEmail: payload?.userEmail || 'unknown',
    status: payload?.status || 'unknown',
    deviceTimestamp: timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp : null,
    receivedAt: new Date(),
    source,
  });
}

function startSensorMqttSubscriber() {
  if (client) {
    return client;
  }

  client = mqtt.connect(MQTT_BROKER_URL, {
    clientId: `hribovc_backend_${Math.random().toString(16).slice(2)}`,
    clean: true,
    connectTimeout: 5000,
    reconnectPeriod: 3000,
  });

  client.on('connect', () => {
    console.log(`MQTT backend connected to ${MQTT_BROKER_URL}`);
    client.subscribe([MQTT_SENSORS_TOPIC, MQTT_HEARTBEAT_TOPIC, MQTT_STATUS_TOPIC], error => {
      if (error) {
        console.error('MQTT backend subscribe failed:', error.message || error);
      }
    });
  });

  client.on('reconnect', () => {
    console.log('MQTT backend reconnecting...');
  });

  client.on('error', error => {
    console.error('MQTT backend error:', error.message || error);
  });

  client.on('message', (topic, payload) => {
    const parsed = parsePayload(payload);

    if (!parsed) {
      return;
    }

    if (topic === MQTT_SENSORS_TOPIC) {
      saveSensorReading(parsed).catch(error => {
        console.error('Saving sensor reading failed:', error.message || error);
      });
      return;
    }

    if (topic === MQTT_HEARTBEAT_TOPIC) {
      saveHeartbeat(parsed).catch(error => {
        console.error('Saving sensor heartbeat failed:', error.message || error);
      });
      return;
    }

    if (topic === MQTT_STATUS_TOPIC) {
      saveHeartbeat(parsed, 'mobile-mqtt-status').catch(error => {
        console.error('Saving sensor status failed:', error.message || error);
      });
    }
  });

  return client;
}

module.exports = {
  startSensorMqttSubscriber,
  normalizeSensorReading,
  saveSensorReading,
  MQTT_BROKER_URL,
  MQTT_SENSORS_TOPIC,
  MQTT_HEARTBEAT_TOPIC,
  MQTT_STATUS_TOPIC,
  SENSOR_READINGS_COLLECTION,
  SENSOR_HEARTBEATS_COLLECTION,
};
