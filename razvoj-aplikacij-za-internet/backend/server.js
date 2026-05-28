const http = require('http');
const bcrypt = require('bcryptjs');
const path = require('path');
const { spawn } = require('child_process');
const { ObjectId } = require('mongodb');

const {
  scrapeAndStoreWeather,
  getLatestWeather
} = require('./services/weatherService');

const {
  getTrails,
  getTrailById
} = require('./services/trailService');

const { analyzeTrail } = require('./services/riskService');

const { getCollection, connect, initDb } = require('./db');

const PORT = 3000;

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
          : [data.username];
        const username = findExistingFaceUsername(usernameCandidates);

        if (!username) {
          res.writeHead(400, {
            'Content-Type': 'application/json',
            ...corsHeaders,
          });
          res.end(JSON.stringify({
            error: 'ORV profil ni najden. Preveri data/users ali ime uporabnika za face login.',
            tried: usernameCandidates.map(safeFaceUsername).filter(Boolean),
          }));
          return;
        }

        const result = await runFaceLogin({
          username,
          threshold: Number(data.threshold || 0.95),
          camera: Number(data.camera || 0),
          frames: Number(data.frames || 9),
          minAgreement: Number(data.minAgreement || 0.7),
          margin: Number(data.margin || 0.08),
          nightMode: Boolean(data.nightMode),
        });

        res.writeHead(result.success ? 200 : 401, {
          'Content-Type': 'application/json',
          ...corsHeaders,
        });
        res.end(JSON.stringify(result));
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

  if (req.method === 'GET' && req.url === '/stats') {
  try {
    const usersCollection = await getCollection('users');
    const weatherCollection = await getCollection('weather');
    const trailsCollection = await getCollection('trails');
    const riskAnalysesCollection = await getCollection('riskAnalyses');

    const usersCount = await usersCollection.countDocuments();
    const weatherCount = await weatherCollection.countDocuments();
    const trailsCount = await trailsCollection.countDocuments();
    const riskAnalysesCount = await riskAnalysesCollection.countDocuments();

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
