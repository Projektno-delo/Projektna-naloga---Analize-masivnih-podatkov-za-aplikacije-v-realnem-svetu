const http = require('http');
const bcrypt = require('bcryptjs');
const path = require('path');
const { spawn } = require('child_process');

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

function runFaceLogin({ username, threshold = 0.95, camera = 0 }) {
  return new Promise((resolve, reject) => {
    const bridgePath = path.resolve(
      __dirname,
      '..',
      '..',
      'osnove-racunalniskega-vida',
      'face_login_bridge.py'
    );
    const pythonBin = process.env.PYTHON_BIN || 'python';
    const child = spawn(
      pythonBin,
      [
        bridgePath,
        username,
        '--threshold',
        String(threshold),
        '--camera',
        String(camera),
      ],
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

        const newUser = {
          ime: userData.ime,
          email: userData.email,
          passwordHash,
          starost: Number(userData.starost),
          visina: Number(userData.visina),
          teza: Number(userData.teza),
          bmi: calculateBmi(userData.visina, userData.teza),
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

        const userResponse = {
          _id: user._id,
          ime: user.ime,
          email: user.email,
          starost: user.starost,
          visina: user.visina,
          teza: user.teza,
          bmi: user.bmi,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        };

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
