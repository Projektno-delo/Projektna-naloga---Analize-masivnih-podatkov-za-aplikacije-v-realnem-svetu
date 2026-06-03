const http = require('http');
const bcrypt = require('bcryptjs');
const path = require('path');
const { spawn } = require('child_process');
const { ObjectId } = require('mongodb');
const { randomUUID } = require('crypto');

const axios = require('axios');
const FormData = require('form-data');

const ORV_API_URL = normalizeOrvApiUrl(process.env.ORV_API_URL || 'http://localhost:8000');
const ORV_FACE_THRESHOLD = readFaceThreshold(process.env.ORV_FACE_THRESHOLD, 0.7);
const ORV_FACE_TIMEOUT_MS = readPositiveInteger(
  process.env.ORV_FACE_TIMEOUT_MS,
  30000,
  'ORV_FACE_TIMEOUT_MS'
);
const ORV_2FA_TTL_MS = readPositiveInteger(process.env.ORV_2FA_TTL_MS, 90000);
const orv2faChallenges = new Map();
const SENSOR_DEVICE_ACTIVE_TIMEOUT_MS = readPositiveInteger(
  process.env.SENSOR_DEVICE_ACTIVE_TIMEOUT_MS,
  15000,
  'SENSOR_DEVICE_ACTIVE_TIMEOUT_MS'
);

const {
  scrapeAndStoreWeather,
  getLatestWeather
} = require('./services/weatherService');

const {
  getTrails,
  getTrailById
} = require('./services/trailService');

const { analyzeTrail } = require('./services/riskService');
const { getVisualizationData } = require('./services/visualizationService');
const {
  startSensorMqttSubscriber,
  publishMqttMessage,
  saveSensorReading,
  MQTT_ORV_2FA_REQUEST_TOPIC,
  SENSOR_READINGS_COLLECTION,
  SENSOR_HEARTBEATS_COLLECTION
} = require('./services/sensorMqttService');

const { getCollection, connect, initDb } = require('./db');

const PORT = 3000;

function normalizeOrvApiUrl(value) {
  return String(value || 'http://localhost:8000').replace(/\/+$/, '');
}

function readFaceThreshold(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const threshold = Number(value);

  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    console.warn(`[ORV] Neveljaven ORV_FACE_THRESHOLD="${value}", uporabljam ${fallback}.`);
    return fallback;
  }

  return threshold;
}

function readPositiveInteger(value, fallback, label = 'value') {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    console.warn(`[CONFIG] Neveljaven ${label}="${value}", uporabljam ${fallback}.`);
    return fallback;
  }

  return numberValue;
}

function parseRequestedFaceThreshold(value) {
  if (value === undefined || value === null || value === '') {
    return ORV_FACE_THRESHOLD;
  }

  const threshold = Number(value);

  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    const error = new Error('ORV threshold mora biti stevilo med 0.0 in 1.0.');
    error.statusCode = 400;
    throw error;
  }

  return threshold;
}

function getOrvApiErrorStatus(error) {
  if (error.statusCode) {
    return error.statusCode;
  }

  if (error instanceof SyntaxError) {
    return 400;
  }

  if (error.code === 'ECONNABORTED') {
    return 504;
  }

  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return 503;
  }

  if (error.response?.status) {
    return error.response.status;
  }

  return 500;
}

function getOrvApiErrorMessage(error) {
  if (error.statusCode === 400) {
    return error.message;
  }

  if (error instanceof SyntaxError) {
    return 'Neveljaven JSON v face-login zahtevku.';
  }

  if (error.code === 'ECONNABORTED') {
    return `ORV API se ni odzval v ${ORV_FACE_TIMEOUT_MS} ms.`;
  }

  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return `ORV API ni dosegljiv na ${ORV_API_URL}.`;
  }

  return 'Napaka pri preverjanju obraza prek ORV API-ja.';
}

function getOrvApiErrorDetail(error) {
  return error.response?.data?.detail
    || error.response?.data
    || error.message
    || String(error);
}

function calculateBmi(visina, teza) {
  const heightCm = Number(visina);
  const weightKg = Number(teza);

  if (!heightCm || !weightKg) {
    return null;
  }

  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(1));
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeHealthProfile(data = {}) {
  const height = numberOrNull(data.height ?? data.visina);
  const weight = numberOrNull(data.weight ?? data.teza);
  const calculatedBmi = calculateBmi(height, weight);
  const bmi = numberOrNull(data.bmi) ?? calculatedBmi;

  return {
    bmi,
    age: numberOrNull(data.age ?? data.starost),
    height,
    weight,
    smoker: data.smoker === 'yes' ? 'yes' : 'no',
    activity: ['low', 'medium', 'high'].includes(data.activity) ? data.activity : 'medium',
    condition: ['none', 'heart', 'lungs', 'joints'].includes(data.condition) ? data.condition : 'none',
    updatedAt: new Date()
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function publicUser(user) {
  return {
    _id: user._id,
    ime: user.ime,
    email: user.email,
    starost: user.starost,
    visina: user.visina,
    teza: user.teza,
    bmi: user.bmi,
    healthProfile: user.healthProfile || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function parseMeasure(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const number = parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function parseDurationHours(value) {
  const text = String(value || '').toLowerCase().replace(',', '.');
  const hours = text.match(/(\d+(?:\.\d+)?)\s*h/);
  const minutes = text.match(/(\d+)\s*min/);

  if (hours) {
    return Number(hours[1]) + (minutes ? Number(minutes[1]) / 60 : 0);
  }

  return parseMeasure(text);
}

function getHighestWeatherRisk(weather) {
  const stations = weather?.stations || [];

  if (stations.some(station => station.risk === 'extreme')) {
    return { risk: 'extreme', riskLabel: 'Ekstremno', penalty: 35 };
  }

  if (stations.some(station => station.risk === 'high')) {
    return { risk: 'high', riskLabel: 'Nevarno', penalty: 25 };
  }

  if (stations.some(station => station.risk === 'medium')) {
    return { risk: 'medium', riskLabel: 'Previdno', penalty: 12 };
  }

  if (stations.some(station => station.risk === 'low')) {
    return { risk: 'low', riskLabel: 'Varno', penalty: 0 };
  }

  return { risk: 'unknown', riskLabel: 'Ni podatkov', penalty: 0 };
}

function calculateTrailRiskFactor({ healthProfile, trail, weatherRisk }) {
  const bmi = numberOrNull(healthProfile.bmi);
  const age = numberOrNull(healthProfile.age);
  const distanceKm = parseMeasure(trail.distanceKm ?? trail.distance);
  const elevationM = parseMeasure(trail.elevationM ?? trail.elevation);
  const durationHours = parseDurationHours(trail.duration);
  const difficulty = String(trail.difficulty || '').toLowerCase();
  const factors = [];

  let riskFactor = weatherRisk?.penalty || 0;

  if (weatherRisk?.risk === 'extreme' || weatherRisk?.risk === 'high') {
    factors.push(`Vremensko tveganje: ${weatherRisk.riskLabel}.`);
  }

  if (difficulty.includes('zelo')) {
    riskFactor += 30;
    factors.push('Zelo zahtevna pot.');
  } else if (difficulty.includes('zahtevna')) {
    riskFactor += 22;
    factors.push('Zahtevna pot.');
  } else if (difficulty.includes('sred')) {
    riskFactor += 10;
  }

  if (distanceKm >= 14) {
    riskFactor += 14;
    factors.push('Dolga razdalja.');
  } else if (distanceKm >= 9) {
    riskFactor += 8;
  }

  if (elevationM >= 1400) {
    riskFactor += 14;
    factors.push('Velika visinska razlika.');
  } else if (elevationM >= 900) {
    riskFactor += 8;
  }

  if (durationHours >= 7) {
    riskFactor += 12;
  } else if (durationHours >= 5) {
    riskFactor += 7;
  }

  if (bmi !== null) {
    if (bmi >= 35) {
      riskFactor += 24;
      factors.push('Visok BMI.');
    } else if (bmi >= 30) {
      riskFactor += 16;
      factors.push('Visji BMI.');
    } else if (bmi >= 25 || bmi < 18.5) {
      riskFactor += 7;
    }
  }

  if (age !== null) {
    if (age >= 70) {
      riskFactor += 18;
      factors.push('Visja starost.');
    } else if (age >= 60) {
      riskFactor += 10;
    }
  }

  if (healthProfile.smoker === 'yes') {
    riskFactor += 12;
    factors.push('Kajenje.');
  }

  if (healthProfile.condition === 'heart') {
    riskFactor += 28;
    factors.push('Srcno-zilno opozorilo.');
  } else if (healthProfile.condition === 'lungs') {
    riskFactor += 22;
    factors.push('Dihalno opozorilo.');
  } else if (healthProfile.condition === 'joints') {
    riskFactor += 16;
    factors.push('Opozorilo za sklepe.');
  }

  if (healthProfile.activity === 'low') {
    riskFactor += 18;
    factors.push('Nizka aktivnost.');
  } else if (healthProfile.activity === 'high') {
    riskFactor -= 8;
  }

  riskFactor = Math.max(0, Math.min(100, Math.round(riskFactor)));

  const recommendation = riskFactor >= 70
    ? 'ODSVETOVANO'
    : riskFactor >= 35
      ? 'PREVIDNO'
      : 'PRIPOROCENO';

  return {
    riskFactor,
    suitabilityScore: 100 - riskFactor,
    recommendation,
    factors,
    reason: factors.slice(0, 3).join(' ') || 'Nizko tveganje glede na vnesene podatke.'
  };
}

function runFaceLogin({
  username,
  threshold = 0.95,
  camera = 0,
  frames = 9,
  minAgreement = 0.7,
  margin = 0.08,
  nightMode = false
}) {
  return new Promise((resolve, reject) => {
    const bridgePath = path.resolve(
      __dirname,
      '..',
      '..',
      'osnove-racunalniskega-vida',
      'face_name_preview.py'
    );
    const pythonBin = process.env.PYTHON_BIN || 'python';
    const faceArgs = [
      bridgePath,
      'login-users',
      username,
      '--threshold',
      String(threshold),
      '--camera',
      String(camera),
      '--frames',
      String(frames),
      '--min-agreement',
      String(minAgreement),
      '--margin',
      String(margin),
    ];

    if (nightMode) {
      faceArgs.push('--night-mode');
    }

    const child = spawn(
      pythonBin,
      faceArgs,
      {
        cwd: path.dirname(bridgePath),
        windowsHide: false,
      }
    );

    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('Face login timed out'));
    }, 60000);

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('error', error => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on('close', () => {
      clearTimeout(timeout);

      const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
      const lastLine = lines[lines.length - 1];

      if (!lastLine) {
        reject(new Error(stderr || 'Face login did not return a result'));
        return;
      }

      try {
        resolve(JSON.parse(lastLine));
      } catch (error) {
        reject(new Error(stderr || error.message));
      }
    });
  });
}

function safeFaceUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '');
}

function faceProfilePath(username) {
  return path.resolve(
    __dirname,
    '..',
    '..',
    'osnove-racunalniskega-vida',
    'data',
    'users',
    `${username}.npz`
  );
}

function findExistingFaceUsername(candidates) {
  const fs = require('fs');

  for (const candidate of candidates) {
    const username = safeFaceUsername(candidate);
    if (username && fs.existsSync(faceProfilePath(username))) {
      return username;
    }
  }

  return null;
}

function imageBase64ToBuffer(imageBase64) {
  if (!imageBase64) {
    return null;
  }

  const value = String(imageBase64);
  const base64 = value.includes(',')
    ? value.split(',')[1]
    : value;

  return Buffer.from(base64, 'base64');
}

async function verifyFaceWithOrvApi({
  imageBase64,
  expectedUser,
  threshold = ORV_FACE_THRESHOLD,
  nightMode = false,
}) {
  const imageBuffer = imageBase64ToBuffer(imageBase64);

  if (!imageBuffer || imageBuffer.length === 0) {
    throw new Error('Slika za preverjanje obraza ni bila poslana.');
  }

  const form = new FormData();

  form.append('image', imageBuffer, {
    filename: 'face-login.jpg',
    contentType: 'image/jpeg',
  });

  form.append('expectedUser', expectedUser);
  form.append('threshold', String(threshold));
  form.append('nightMode', String(Boolean(nightMode)));

  const response = await axios.post(`${ORV_API_URL}/verify-face`, form, {
    headers: form.getHeaders(),
    timeout: ORV_FACE_TIMEOUT_MS,
  });

  return response.data;
}

async function sendPhonePreviewFrameToOrvApi({
  imageBase64,
  expectedUser,
  nightMode = false,
}) {
  const imageBuffer = imageBase64ToBuffer(imageBase64);

  if (!imageBuffer || imageBuffer.length === 0) {
    throw new Error('Slika za ORV preview ni bila poslana.');
  }

  const form = new FormData();

  form.append('image', imageBuffer, {
    filename: 'phone-preview.jpg',
    contentType: 'image/jpeg',
  });
  form.append('expectedUser', expectedUser || '');
  form.append('nightMode', String(Boolean(nightMode)));

  const response = await axios.post(`${ORV_API_URL}/phone-preview-frame`, form, {
    headers: form.getHeaders(),
    timeout: 5000,
  });

  return response.data;
}

async function checkOrvApiHealth() {
  const response = await axios.get(`${ORV_API_URL}/health`, {
    timeout: ORV_FACE_TIMEOUT_MS,
  });

  return response.data;
}

async function closePhonePreviewWindow() {
  try {
    await axios.post(`${ORV_API_URL}/phone-preview-close`, null, {
      timeout: 2000,
    });
  } catch (error) {
    console.warn('[ORV] Phone preview close failed:', error.message || error);
  }
}

function getFaceUsernameFromRequest(data = {}) {
  const usernameCandidates = Array.isArray(data.usernames)
    ? data.usernames
    : [data.username, data.expectedUser, data.email, data.userEmail];

  const username = findExistingFaceUsername(usernameCandidates);

  return {
    username,
    tried: usernameCandidates.map(safeFaceUsername).filter(Boolean),
  };
}

function normalizeFaceLoginResult(result = {}, fallbackExpectedUser = null) {
  const verified = Boolean(result.verified ?? result.success);

  return {
    success: Boolean(result.success ?? verified),
    verified,
    pending: false,
    status: verified ? 'approved' : 'rejected',
    faceDetected: result.faceDetected,
    expectedUser: result.expectedUser ?? result.username ?? fallbackExpectedUser,
    predictedUser: result.predictedUser ?? result.recognized,
    probability: result.probability ?? result.score,
    threshold: result.threshold,
    faceBox: result.faceBox,
    message: result.message || result.error || null,
    error: result.error || null,
  };
}

function createOrv2faChallenge({ username, userEmail, threshold, nightMode }) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ORV_2FA_TTL_MS);
  const challenge = {
    challengeId: randomUUID(),
    status: 'pending',
    username,
    userEmail: String(userEmail || '').trim().toLowerCase(),
    threshold,
    nightMode: Boolean(nightMode),
    createdAt: now,
    expiresAt,
    result: null,
  };

  orv2faChallenges.set(challenge.challengeId, challenge);

  setTimeout(() => {
    const current = orv2faChallenges.get(challenge.challengeId);

    if (current?.status === 'pending') {
      current.status = 'expired';
      current.result = {
        success: false,
        verified: false,
        pending: false,
        status: 'expired',
        expectedUser: current.username,
        error: 'ORV 2FA zahteva je potekla.',
      };
    }
  }, ORV_2FA_TTL_MS + 1000);

  return challenge;
}

function refreshOrv2faChallengeStatus(challenge) {
  if (
    challenge
    && challenge.status === 'pending'
    && new Date(challenge.expiresAt).getTime() <= Date.now()
  ) {
    challenge.status = 'expired';
    challenge.result = {
      success: false,
      verified: false,
      pending: false,
      status: 'expired',
      expectedUser: challenge.username,
      error: 'ORV 2FA zahteva je potekla.',
    };
  }

  return challenge;
}

function publicOrv2faChallenge(challenge) {
  const current = refreshOrv2faChallengeStatus(challenge);

  if (!current) {
    return null;
  }

  return {
    challengeId: current.challengeId,
    pending: current.status === 'pending',
    status: current.status,
    expiresAt: current.expiresAt,
    expectedUser: current.username,
    userEmail: current.userEmail,
    result: current.result,
  };
}

function toTimestamp(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function serializeDate(value) {
  const date = toTimestamp(value);
  return date ? date.toISOString() : null;
}

function isLaterTimestamp(candidate, current) {
  const candidateDate = toTimestamp(candidate);
  const currentDate = toTimestamp(current);

  if (!candidateDate) {
    return false;
  }

  if (!currentDate) {
    return true;
  }

  return candidateDate.getTime() >= currentDate.getTime();
}

function createSensorDevice(deviceId) {
  return {
    deviceId,
    userEmail: 'unknown',
    active: false,
    status: 'unknown',
    lastReading: null,
    lastReadingAt: null,
    lastHeartbeatAt: null,
    lastStatusAt: null,
  };
}

function getSensorDeviceId(payload) {
  return payload?.deviceId
    || payload?.device_id
    || payload?.clientId
    || payload?.id
    || 'unknown-device';
}

function upsertSensorDevice(devices, deviceId) {
  if (!devices.has(deviceId)) {
    devices.set(deviceId, createSensorDevice(deviceId));
  }

  return devices.get(deviceId);
}

function applySensorReadingToDevice(devices, reading) {
  const deviceId = getSensorDeviceId(reading);
  const device = upsertSensorDevice(devices, deviceId);
  const readingAt = serializeDate(reading.receivedAt || reading.deviceTimestamp);

  device.userEmail = reading.userEmail || device.userEmail;

  if (!isLaterTimestamp(readingAt, device.lastReadingAt)) {
    return device;
  }

  device.lastReading = {
    accelerometer: reading.accelerometer || null,
    location: reading.location || null,
    deviceTimestamp: serializeDate(reading.deviceTimestamp),
    receivedAt: serializeDate(reading.receivedAt),
    source: reading.source || 'unknown',
  };
  device.lastReadingAt = readingAt;

  return device;
}

function applyHeartbeatToDevice(devices, heartbeat) {
  const deviceId = getSensorDeviceId(heartbeat);
  const device = upsertSensorDevice(devices, deviceId);
  const source = heartbeat.source || '';
  const status = heartbeat.status || 'unknown';
  const eventAt = serializeDate(heartbeat.receivedAt || heartbeat.deviceTimestamp);

  device.userEmail = heartbeat.userEmail || device.userEmail;

  if (source.includes('status') || status === 'online' || status === 'offline') {
    if (isLaterTimestamp(eventAt, device.lastStatusAt)) {
      device.status = status;
      device.lastStatusAt = eventAt;
    }

    return device;
  }

  if (isLaterTimestamp(eventAt, device.lastHeartbeatAt)) {
    device.lastHeartbeatAt = eventAt;
  }

  return device;
}

function calculateSensorDeviceActivity(device, now = Date.now()) {
  if (device.status === 'offline') {
    return false;
  }

  if (!device.lastHeartbeatAt) {
    return false;
  }

  const lastHeartbeatTime = new Date(device.lastHeartbeatAt).getTime();

  if (Number.isNaN(lastHeartbeatTime)) {
    return false;
  }

  return now - lastHeartbeatTime <= SENSOR_DEVICE_ACTIVE_TIMEOUT_MS;
}

function sortSensorDevices(devices) {
  return [...devices.values()]
    .map(device => ({
      ...device,
      active: calculateSensorDeviceActivity(device),
    }))
    .sort((a, b) => {
      if (a.active !== b.active) {
        return a.active ? -1 : 1;
      }

      const aTime = new Date(a.lastHeartbeatAt || a.lastReadingAt || 0).getTime();
      const bTime = new Date(b.lastHeartbeatAt || b.lastReadingAt || 0).getTime();

      return bTime - aTime;
    });
}

const server = http.createServer(async (req, res) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && req.url === '/scrape') {
    try {
      const weather = await scrapeAndStoreWeather();

      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
      res.end(JSON.stringify(weather.stations));
    } catch (error) {
      res.writeHead(500, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
      res.end(JSON.stringify({ error: error.message || String(error) }));
    }
    return;
  }

  if (req.method === 'GET' && req.url === '/weather') {
    try {
      const weather = await getLatestWeather();

      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
      res.end(JSON.stringify(weather));
    } catch (error) {
      res.writeHead(500, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
      res.end(JSON.stringify({ error: error.message || String(error) }));
    }
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === '/sensor-devices') {
    try {
      const limit = Math.min(
        Math.max(parseInt(requestUrl.searchParams.get('limit') || '500', 10), 1),
        1000
      );

      const sensorReadingsCollection = await getCollection(SENSOR_READINGS_COLLECTION);
      const sensorHeartbeatsCollection = await getCollection(SENSOR_HEARTBEATS_COLLECTION);

      const [readings, heartbeats] = await Promise.all([
        sensorReadingsCollection
          .find({})
          .sort({ receivedAt: -1 })
          .limit(limit)
          .toArray(),
        sensorHeartbeatsCollection
          .find({})
          .sort({ receivedAt: -1 })
          .limit(limit)
          .toArray(),
      ]);

      const devices = new Map();

      for (const reading of readings) {
        applySensorReadingToDevice(devices, reading);
      }

      for (const heartbeat of heartbeats) {
        applyHeartbeatToDevice(devices, heartbeat);
      }

      const deviceList = sortSensorDevices(devices);
      const activeDevicesCount = deviceList.filter(device => device.active).length;

      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });

      res.end(JSON.stringify({
        activeDevicesCount,
        inactiveDevicesCount: deviceList.length - activeDevicesCount,
        totalDevicesCount: deviceList.length,
        activeDeviceTimeoutMs: SENSOR_DEVICE_ACTIVE_TIMEOUT_MS,
        generatedAt: new Date().toISOString(),
        devices: deviceList,
      }));
    } catch (error) {
      res.writeHead(500, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });

      res.end(JSON.stringify({ error: error.message || String(error) }));
    }

    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === '/sensor-readings') {
    try {
      const limit = Math.min(
        Math.max(parseInt(requestUrl.searchParams.get('limit') || '50', 10), 1),
        200
      );
      const sensorReadingsCollection = await getCollection(SENSOR_READINGS_COLLECTION);
      const sensorHeartbeatsCollection = await getCollection(SENSOR_HEARTBEATS_COLLECTION);
      const readings = await sensorReadingsCollection
        .find({})
        .sort({ receivedAt: -1 })
        .limit(limit)
        .toArray();
      const latestHeartbeat = await sensorHeartbeatsCollection
        .find({})
        .sort({ receivedAt: -1 })
        .limit(1)
        .toArray();

      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });

      res.end(JSON.stringify({
        readings,
        latestHeartbeat: latestHeartbeat[0] || null,
      }));
    } catch (error) {
      res.writeHead(500, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
      res.end(JSON.stringify({ error: error.message || String(error) }));
    }
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === '/sensor-readings') {
    try {
      const sensorData = await readJsonBody(req);
      const reading = await saveSensorReading(sensorData, 'mobile-http-stop');

      if (!reading) {
        res.writeHead(400, {
          'Content-Type': 'application/json',
          ...corsHeaders,
        });
        res.end(JSON.stringify({ error: 'Invalid sensor reading payload' }));
        return;
      }

      res.writeHead(201, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
      res.end(JSON.stringify({
        message: 'Sensor reading saved',
        reading,
      }));
    } catch (error) {
      res.writeHead(500, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
      res.end(JSON.stringify({ error: error.message || String(error) }));
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/register') {
    console.log('Register endpoint called');

    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      console.log('Register request body:', body);

      try {
        const userData = JSON.parse(body);
        console.log('Parsed user data:', userData);

        const usersCollection = await getCollection('users');

        const existingUser = await usersCollection.findOne({ email: userData.email });

        if (existingUser) {
          res.writeHead(400, {
            'Content-Type': 'application/json',
            ...corsHeaders,
          });
          res.end(JSON.stringify({ error: 'User with this email already exists' }));
          return;
        }

        const passwordHash = await bcrypt.hash(userData.password, 10);
        const now = new Date();
        const healthProfile = normalizeHealthProfile({
          age: userData.starost,
          height: userData.visina,
          weight: userData.teza,
          bmi: userData.bmi,
          smoker: userData.smoker,
          activity: userData.activity,
          condition: userData.condition
        });

        const newUser = {
          ime: userData.ime,
          email: userData.email,
          passwordHash,
          starost: healthProfile.age,
          visina: healthProfile.height,
          teza: healthProfile.weight,
          bmi: healthProfile.bmi,
          healthProfile,
          createdAt: now,
          updatedAt: now
        };

        const result = await usersCollection.insertOne(newUser);

        res.writeHead(201, {
          'Content-Type': 'application/json',
          ...corsHeaders,
        });
        res.end(JSON.stringify({
          message: 'User registered successfully',
          userId: result.insertedId
        }));
      } catch (error) {
        res.writeHead(500, {
          'Content-Type': 'application/json',
          ...corsHeaders,
        });
        res.end(JSON.stringify({ error: error.message || String(error) }));
      }
    });

    return;
  }

  if (req.method === 'POST' && req.url === '/login') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const loginData = JSON.parse(body);
        const usersCollection = await getCollection('users');

        const user = await usersCollection.findOne({ email: loginData.email });

        if (!user) {
          res.writeHead(401, {
            'Content-Type': 'application/json',
            ...corsHeaders,
          });
          res.end(JSON.stringify({ error: 'Invalid email or password' }));
          return;
        }

        const passwordMatches = await bcrypt.compare(loginData.password, user.passwordHash);

        if (!passwordMatches) {
          res.writeHead(401, {
            'Content-Type': 'application/json',
            ...corsHeaders,
          });
          res.end(JSON.stringify({ error: 'Invalid email or password' }));
          return;
        }

        const userResponse = publicUser(user);

        res.writeHead(200, {
          'Content-Type': 'application/json',
          ...corsHeaders,
        });
        res.end(JSON.stringify({
          message: 'Login successful',
          user: userResponse
        }));
      } catch (error) {
        res.writeHead(500, {
          'Content-Type': 'application/json',
          ...corsHeaders,
        });
        res.end(JSON.stringify({ error: error.message || String(error) }));
      }
    });

    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === '/orv-health') {
    try {
      const health = await checkOrvApiHealth();

      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });

      res.end(JSON.stringify({
        status: 'ok',
        connected: true,
        orvApiUrl: ORV_API_URL,
        api: health,
      }));
    } catch (error) {
      console.error('ORV API health check error:', error.response?.data || error.message || error);

      res.writeHead(getOrvApiErrorStatus(error), {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });

      res.end(JSON.stringify({
        status: 'error',
        connected: false,
        orvApiUrl: ORV_API_URL,
        error: getOrvApiErrorMessage(error),
        detail: getOrvApiErrorDetail(error),
      }));
    }

    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === '/orv-2fa/start') {
    try {
      const data = await readJsonBody(req);
      const cameraMode = data.cameraMode === 'phone' ? 'phone' : 'pc';
      const { username, tried } = getFaceUsernameFromRequest(data);

      if (!username) {
        res.writeHead(400, {
          'Content-Type': 'application/json',
          ...corsHeaders,
        });
        res.end(JSON.stringify({
          success: false,
          verified: false,
          error: 'ORV profil ni najden. Preveri data/users ali ime uporabnika za face login.',
          tried,
        }));
        return;
      }

      const threshold = parseRequestedFaceThreshold(data.threshold);
      const nightMode = Boolean(data.nightMode);

      if (cameraMode === 'pc') {
        const result = await runFaceLogin({
          username,
          threshold,
          camera: Number(data.camera || 0),
          frames: Number(data.frames || 9),
          minAgreement: Number(data.minAgreement || 0.7),
          margin: Number(data.margin || 0.08),
          nightMode,
        });
        const normalized = normalizeFaceLoginResult(result, username);

        res.writeHead(normalized.verified ? 200 : 401, {
          'Content-Type': 'application/json',
          ...corsHeaders,
        });
        res.end(JSON.stringify({
          ...normalized,
          cameraMode,
        }));
        return;
      }

      const challenge = createOrv2faChallenge({
        username,
        userEmail: data.email || data.userEmail,
        threshold,
        nightMode,
      });

      await publishMqttMessage(MQTT_ORV_2FA_REQUEST_TOPIC, {
        type: 'orv-2fa-request',
        challengeId: challenge.challengeId,
        userEmail: challenge.userEmail,
        expectedUser: challenge.username,
        threshold: challenge.threshold,
        nightMode: challenge.nightMode,
        createdAt: challenge.createdAt,
        expiresAt: challenge.expiresAt,
      });

      res.writeHead(202, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
      res.end(JSON.stringify({
        success: false,
        verified: false,
        pending: true,
        status: 'pending',
        cameraMode,
        challengeId: challenge.challengeId,
        expiresAt: challenge.expiresAt,
        topic: MQTT_ORV_2FA_REQUEST_TOPIC,
      }));
    } catch (error) {
      console.error('ORV 2FA start error:', error.response?.data || error.message || error);

      res.writeHead(getOrvApiErrorStatus(error), {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
      res.end(JSON.stringify({
        success: false,
        verified: false,
        error: getOrvApiErrorMessage(error),
        detail: getOrvApiErrorDetail(error),
      }));
    }
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === '/orv-2fa/status') {
    const challengeId = requestUrl.searchParams.get('challengeId');
    const challenge = publicOrv2faChallenge(orv2faChallenges.get(challengeId));

    if (!challenge) {
      res.writeHead(404, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
      res.end(JSON.stringify({
        success: false,
        verified: false,
        error: 'ORV 2FA zahteva ni najdena.',
      }));
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'application/json',
      ...corsHeaders,
    });
    res.end(JSON.stringify({
      success: challenge.status === 'approved',
      verified: challenge.status === 'approved',
      ...challenge,
    }));
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === '/orv-2fa/preview') {
    try {
      const data = await readJsonBody(req);
      const challenge = refreshOrv2faChallengeStatus(orv2faChallenges.get(data.challengeId));

      if (!challenge || challenge.status !== 'pending') {
        res.writeHead(404, {
          'Content-Type': 'application/json',
          ...corsHeaders,
        });
        res.end(JSON.stringify({
          success: false,
          error: 'ORV 2FA zahteva ni aktivna.',
        }));
        return;
      }

      const senderEmail = String(data.userEmail || '').trim().toLowerCase();

      if (challenge.userEmail && senderEmail && challenge.userEmail !== senderEmail) {
        res.writeHead(403, {
          'Content-Type': 'application/json',
          ...corsHeaders,
        });
        res.end(JSON.stringify({
          success: false,
          error: 'ORV 2FA zahteva pripada drugemu uporabniku.',
        }));
        return;
      }

      const preview = await sendPhonePreviewFrameToOrvApi({
        imageBase64: data.imageBase64,
        expectedUser: challenge.username,
        nightMode: Boolean(data.nightMode ?? challenge.nightMode),
      });

      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
      res.end(JSON.stringify({
        success: true,
        ...preview,
      }));
    } catch (error) {
      res.writeHead(getOrvApiErrorStatus(error), {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
      res.end(JSON.stringify({
        success: false,
        error: getOrvApiErrorMessage(error),
        detail: getOrvApiErrorDetail(error),
      }));
    }
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === '/orv-2fa/preview-close') {
    await closePhonePreviewWindow();

    res.writeHead(200, {
      'Content-Type': 'application/json',
      ...corsHeaders,
    });
    res.end(JSON.stringify({
      success: true,
    }));
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === '/orv-2fa/verify') {
    try {
      const data = await readJsonBody(req);
      const challenge = refreshOrv2faChallengeStatus(orv2faChallenges.get(data.challengeId));

      if (!challenge) {
        res.writeHead(404, {
          'Content-Type': 'application/json',
          ...corsHeaders,
        });
        res.end(JSON.stringify({
          success: false,
          verified: false,
          error: 'ORV 2FA zahteva ni najdena.',
        }));
        return;
      }

      if (challenge.status !== 'pending') {
        res.writeHead(409, {
          'Content-Type': 'application/json',
          ...corsHeaders,
        });
        res.end(JSON.stringify(publicOrv2faChallenge(challenge)));
        return;
      }

      const senderEmail = String(data.userEmail || '').trim().toLowerCase();

      if (challenge.userEmail && senderEmail && challenge.userEmail !== senderEmail) {
        res.writeHead(403, {
          'Content-Type': 'application/json',
          ...corsHeaders,
        });
        res.end(JSON.stringify({
          success: false,
          verified: false,
          error: 'ORV 2FA zahteva pripada drugemu uporabniku.',
        }));
        return;
      }

      const result = await verifyFaceWithOrvApi({
        imageBase64: data.imageBase64,
        expectedUser: challenge.username,
        threshold: challenge.threshold,
        nightMode: Boolean(data.nightMode ?? challenge.nightMode),
      });
      const normalized = normalizeFaceLoginResult(result, challenge.username);

      challenge.status = normalized.verified ? 'approved' : 'rejected';
      challenge.result = {
        ...normalized,
        status: challenge.status,
        deviceId: data.deviceId || null,
        userEmail: senderEmail || challenge.userEmail,
        verifiedAt: new Date(),
      };
      closePhonePreviewWindow();

      res.writeHead(normalized.verified ? 200 : 401, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
      res.end(JSON.stringify(publicOrv2faChallenge(challenge)));
    } catch (error) {
      console.error('ORV 2FA verify error:', error.response?.data || error.message || error);

      res.writeHead(getOrvApiErrorStatus(error), {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
      res.end(JSON.stringify({
        success: false,
        verified: false,
        error: getOrvApiErrorMessage(error),
        detail: getOrvApiErrorDetail(error),
        orvApiUrl: ORV_API_URL,
      }));
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/face-login') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const data = JSON.parse(body);

        const usernameCandidates = Array.isArray(data.usernames)
          ? data.usernames
          : [data.username, data.expectedUser, data.email];

        const username = findExistingFaceUsername(usernameCandidates);

        if (!username) {
          res.writeHead(400, {
            'Content-Type': 'application/json',
            ...corsHeaders,
          });
          res.end(JSON.stringify({
            success: false,
            verified: false,
            error: 'ORV profil ni najden. Preveri data/users ali ime uporabnika za face login.',
            tried: usernameCandidates.map(safeFaceUsername).filter(Boolean),
          }));
          return;
        }

        if (!data.imageBase64) {
          res.writeHead(400, {
            'Content-Type': 'application/json',
            ...corsHeaders,
          });
          res.end(JSON.stringify({
            success: false,
            verified: false,
            error: 'Slika za preverjanje obraza ni bila poslana.',
          }));
          return;
        }

        const requestedThreshold = parseRequestedFaceThreshold(data.threshold);

        const result = await verifyFaceWithOrvApi({
          imageBase64: data.imageBase64,
          expectedUser: username,
          threshold: requestedThreshold,
          nightMode: Boolean(data.nightMode),
        });

        res.writeHead(result.verified ? 200 : 401, {
          'Content-Type': 'application/json',
          ...corsHeaders,
        });

        res.end(JSON.stringify({
          success: result.success,
          verified: result.verified,
          faceDetected: result.faceDetected,
          expectedUser: result.expectedUser,
          predictedUser: result.predictedUser,
          probability: result.probability,
          threshold: result.threshold,
          faceBox: result.faceBox,
          message: result.message,
        }));
      } catch (error) {
        console.error('ORV API face login error:', error.response?.data || error.message || error);

        res.writeHead(getOrvApiErrorStatus(error), {
          'Content-Type': 'application/json',
          ...corsHeaders,
        });

        res.end(JSON.stringify({
          success: false,
          verified: false,
          error: getOrvApiErrorMessage(error),
          detail: getOrvApiErrorDetail(error),
          orvApiUrl: ORV_API_URL,
        }));
      }
    });

    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === '/health-profile') {
    try {
      const userId = requestUrl.searchParams.get('userId');

      if (!ObjectId.isValid(userId)) {
        res.writeHead(400, {
          'Content-Type': 'application/json',
          ...corsHeaders,
        });
        res.end(JSON.stringify({ error: 'Invalid userId' }));
        return;
      }

      const usersCollection = await getCollection('users');
      const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

      if (!user) {
        res.writeHead(404, {
          'Content-Type': 'application/json',
          ...corsHeaders,
        });
        res.end(JSON.stringify({ error: 'User not found' }));
        return;
      }

      const healthProfile = user.healthProfile || normalizeHealthProfile({
        bmi: user.bmi,
        age: user.starost,
        height: user.visina,
        weight: user.teza
      });

      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
      res.end(JSON.stringify({
        healthProfile,
        user: publicUser({
          ...user,
          healthProfile
        })
      }));
    } catch (error) {
      res.writeHead(500, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
      res.end(JSON.stringify({ error: error.message || String(error) }));
    }

    return;
  }

  if (req.method === 'POST' && req.url === '/health-profile') {
    try {
      const data = await readJsonBody(req);
      const userId = data.userId;

      if (!ObjectId.isValid(userId)) {
        res.writeHead(400, {
          'Content-Type': 'application/json',
          ...corsHeaders,
        });
        res.end(JSON.stringify({ error: 'Invalid userId' }));
        return;
      }

      const healthProfile = normalizeHealthProfile(data.healthProfile || data);
      const now = new Date();
      const usersCollection = await getCollection('users');
      const riskAnalysesCollection = await getCollection('riskAnalyses');
      const userObjectId = new ObjectId(userId);

      const result = await usersCollection.findOneAndUpdate(
        { _id: userObjectId },
        {
          $set: {
            healthProfile,
            starost: healthProfile.age,
            visina: healthProfile.height,
            teza: healthProfile.weight,
            bmi: healthProfile.bmi,
            updatedAt: now
          }
        },
        { returnDocument: 'after' }
      );

      const updatedUser = result.value || await usersCollection.findOne({ _id: userObjectId });

      if (!updatedUser) {
        res.writeHead(404, {
          'Content-Type': 'application/json',
          ...corsHeaders,
        });
        res.end(JSON.stringify({ error: 'User not found' }));
        return;
      }

      await riskAnalysesCollection.updateOne(
        {
          userId: userObjectId,
          type: 'healthProfile'
        },
        {
          $set: {
            type: 'healthProfile',
            userId: userObjectId,
            healthProfile,
            userSnapshot: {
              starost: healthProfile.age,
              visina: healthProfile.height,
              teza: healthProfile.weight,
              bmi: healthProfile.bmi,
              smoker: healthProfile.smoker,
              activity: healthProfile.activity,
              condition: healthProfile.condition
            },
            source: 'trails-health-form',
            updatedAt: now
          },
          $setOnInsert: {
            createdAt: now
          }
        },
        { upsert: true }
      );

      const trailsCollection = await getCollection('trails');
      const weatherCollection = await getCollection('weather');
      const trails = await trailsCollection.find({}).toArray();
      const latestWeather = await weatherCollection
        .find({})
        .sort({ scrapedAt: -1 })
        .limit(1)
        .toArray();
      const weather = latestWeather[0] || null;
      const weatherRisk = getHighestWeatherRisk(weather);

      const trailRiskOperations = trails.map(trail => {
        const risk = calculateTrailRiskFactor({
          healthProfile,
          trail,
          weatherRisk
        });

        return {
          updateOne: {
            filter: {
              userId: userObjectId,
              trailId: trail._id,
              type: 'trailRisk'
            },
            update: {
              $set: {
                type: 'trailRisk',
                userId: userObjectId,
                trailId: trail._id,
                weatherId: weather?._id || null,
                riskFactor: risk.riskFactor,
                suitabilityScore: risk.suitabilityScore,
                recommendation: risk.recommendation,
                reason: risk.reason,
                factors: risk.factors,
                healthProfile,
                userSnapshot: {
                  starost: healthProfile.age,
                  visina: healthProfile.height,
                  teza: healthProfile.weight,
                  bmi: healthProfile.bmi,
                  smoker: healthProfile.smoker,
                  activity: healthProfile.activity,
                  condition: healthProfile.condition
                },
                trailSnapshot: {
                  name: trail.name,
                  region: trail.region,
                  mountain: trail.mountain,
                  difficulty: trail.difficulty,
                  duration: trail.duration,
                  elevation: trail.elevation,
                  elevationM: trail.elevationM,
                  distance: trail.distance,
                  distanceKm: trail.distanceKm
                },
                weatherSnapshot: {
                  risk: weatherRisk.risk,
                  riskLabel: weatherRisk.riskLabel
                },
                source: 'trails-health-form',
                updatedAt: now
              },
              $setOnInsert: {
                createdAt: now
              }
            },
            upsert: true
          }
        };
      });

      if (trailRiskOperations.length > 0) {
        await riskAnalysesCollection.bulkWrite(trailRiskOperations, {
          ordered: false
        });
      }

      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
      res.end(JSON.stringify({
        message: 'Health profile saved successfully',
        healthProfile: updatedUser.healthProfile,
        user: publicUser(updatedUser),
        trailRiskCount: trailRiskOperations.length
      }));
    } catch (error) {
      res.writeHead(400, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
      res.end(JSON.stringify({ error: error.message || String(error) }));
    }

    return;
  }

  if (req.method === 'GET' && req.url === '/trails') {
    try {
      const trails = await getTrails();

      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
      res.end(JSON.stringify(trails));
    } catch (error) {
      res.writeHead(500, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
      res.end(JSON.stringify({ error: error.message || String(error) }));
    }

    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/trails/')) {
    try {
      const trailId = decodeURIComponent(req.url.split('/')[2]);
      const trail = await getTrailById(trailId);

      if (!trail) {
        res.writeHead(404, {
          'Content-Type': 'application/json',
          ...corsHeaders,
        });
        res.end(JSON.stringify({ error: 'Trail not found' }));
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
      res.end(JSON.stringify(trail));
    } catch (error) {
      res.writeHead(500, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
      res.end(JSON.stringify({ error: error.message || String(error) }));
    }

    return;
  }

  if (req.method === 'POST' && req.url === '/scrape-trails') {
    try {
      console.log('Starting trail scrape...');

      const { scrapeAndSaveTrails } = require('./trail-scraper');

      scrapeAndSaveTrails()
        .then(trails => {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            ...corsHeaders,
          });
          res.end(JSON.stringify({
            message: `Successfully scraped and saved ${trails.length} trails`,
            trails: trails
          }));
        })
        .catch(err => {
          res.writeHead(500, {
            'Content-Type': 'application/json',
            ...corsHeaders,
          });
          res.end(JSON.stringify({ error: err.message }));
        });
    } catch (error) {
      res.writeHead(500, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
      res.end(JSON.stringify({ error: error.message || String(error) }));
    }

    return;
  }

  if (req.method === 'POST' && req.url === '/analyze-trail') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const data = JSON.parse(body);

        const analysis = await analyzeTrail({
          userId: data.userId,
          trailId: data.trailId
        });

        res.writeHead(201, {
          'Content-Type': 'application/json',
          ...corsHeaders,
        });

        res.end(JSON.stringify({
          message: 'Trail analysis created successfully',
          analysis
        }));
      } catch (error) {
        res.writeHead(400, {
          'Content-Type': 'application/json',
          ...corsHeaders,
        });

        res.end(JSON.stringify({ error: error.message || String(error) }));
      }
    });

    return;
  }

  if (req.method === 'GET' && req.url === '/visualization-data') {
    try {
      const visualizationData = await getVisualizationData();

      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });

      res.end(JSON.stringify(visualizationData));
    } catch (error) {
      res.writeHead(500, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });

      res.end(JSON.stringify({ error: error.message || String(error) }));
    }

    return;
  }

  if (req.method === 'GET' && req.url === '/stats') {
    try {
      const usersCollection = await getCollection('users');
      const weatherCollection = await getCollection('weather');
      const trailsCollection = await getCollection('trails');
      const riskAnalysesCollection = await getCollection('riskAnalyses');
      const sensorReadingsCollection = await getCollection(SENSOR_READINGS_COLLECTION);

      const usersCount = await usersCollection.countDocuments();
      const weatherCount = await weatherCollection.countDocuments();
      const trailsCount = await trailsCollection.countDocuments();
      const riskAnalysesCount = await riskAnalysesCollection.countDocuments();
      const sensorReadingsCount = await sensorReadingsCollection.countDocuments();

      const latestWeather = await weatherCollection
        .find({})
        .sort({ scrapedAt: -1 })
        .limit(1)
        .toArray();

      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });

      res.end(JSON.stringify({
        usersCount,
        weatherCount,
        trailsCount,
        riskAnalysesCount,
        sensorReadingsCount,
        lastWeatherScrape: latestWeather[0]?.scrapedAt || null
      }));
    } catch (error) {
      res.writeHead(500, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });

      res.end(JSON.stringify({ error: error.message || String(error) }));
    }

    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

connect()
  .then(async () => {
    await initDb();

    try {
      console.log('Running weather scraper on server start...');
      await scrapeAndStoreWeather();
      console.log('Weather scraped and saved successfully');
    } catch (err) {
      console.error('Weather scrape on startup failed:', err.message || err);
    }

    startSensorMqttSubscriber();

    try {
      const { scrapeAndSaveTrails } = require('./trail-scraper');
      const trailsCollection = await getCollection('trails');
      const count = await trailsCollection.countDocuments();

      if (count === 0) {
        console.log('Trails database is empty, starting initial scrape...');
        scrapeAndSaveTrails().catch(err => console.error('Initial scrape failed:', err));
      }
    } catch (err) {
      console.error('Error checking trails database:', err);
    }

    server.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Unable to connect to MongoDB:', error.message || error);
    process.exit(1);
  });
