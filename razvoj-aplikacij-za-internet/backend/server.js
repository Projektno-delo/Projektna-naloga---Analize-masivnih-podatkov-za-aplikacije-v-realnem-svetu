const http = require('http');
const bcrypt = require('bcryptjs');
const { scrapeWeather } = require('./scraper');
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
      const data = await scrapeWeather();
      const collection = await getCollection('weather');
      const document = { stations: data, scrapedAt: new Date() };
      await collection.insertOne(document);

      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
      res.end(JSON.stringify(data));
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
      const collection = await getCollection('weather');
      const latestWeather = await collection.find({}).sort({ scrapedAt: -1 }).limit(1).toArray();
      
      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
      res.end(JSON.stringify(latestWeather[0] || { stations: [] }));
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
        res.end(JSON.stringify({ message: 'User registered successfully', userId: result.insertedId }));
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
        res.end(JSON.stringify({ message: 'Login successful', user: userResponse }));
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
      const trailsCollection = await getCollection('trails');
      const trails = await trailsCollection.find({}).toArray();
      
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
      const trailId = req.url.split('/')[2];
      const { ObjectId } = require('mongodb');
      const trailsCollection = await getCollection('trails');
      
      let trail;
      try {
        trail = await trailsCollection.findOne({ _id: new ObjectId(trailId) });
      } catch {
        trail = await trailsCollection.findOne({ name: trailId });
      }
      
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

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

connect()
  .then(async () => {
    await initDb();

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