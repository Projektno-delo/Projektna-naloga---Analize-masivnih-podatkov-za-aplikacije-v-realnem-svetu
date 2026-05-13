const http = require('http');
const { scrapeWeather } = require('./scraper');
const { getCollection, connect } = require('./db');

const PORT = 3000;

const server = http.createServer(async (req, res) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/scrape') {
    try {
      const data = await scrapeWeather();
      const collection = await getCollection('weather');
      const document = { ...data, scrapedAt: new Date() };
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

        // Check if user already exists
        const existingUser = await usersCollection.findOne({ email: userData.email });
        if (existingUser) {
          res.writeHead(400, {
            'Content-Type': 'application/json',
            ...corsHeaders,
          });
          res.end(JSON.stringify({ error: 'User with this email already exists' }));
          return;
        }

        // Create new user
        const newUser = {
          ime: userData.ime,
          email: userData.email,
          password: userData.password, // In production, hash this password!
          starost: userData.starost,
          visina: userData.visina,
          teza: userData.teza,
          createdAt: new Date()
        };

        await usersCollection.insertOne(newUser);

        res.writeHead(201, {
          'Content-Type': 'application/json',
          ...corsHeaders,
        });
        res.end(JSON.stringify({ message: 'User registered successfully', userId: newUser._id }));
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

        // Find user by email
        const user = await usersCollection.findOne({ email: loginData.email });
        if (!user) {
          res.writeHead(401, {
            'Content-Type': 'application/json',
            ...corsHeaders,
          });
          res.end(JSON.stringify({ error: 'Invalid email or password' }));
          return;
        }

        // Check password (in production, use proper password hashing)
        if (user.password !== loginData.password) {
          res.writeHead(401, {
            'Content-Type': 'application/json',
            ...corsHeaders,
          });
          res.end(JSON.stringify({ error: 'Invalid email or password' }));
          return;
        }

        // Return user data (excluding password)
        const userResponse = {
          _id: user._id,
          ime: user.ime,
          email: user.email,
          starost: user.starost,
          visina: user.visina,
          teza: user.teza,
          createdAt: user.createdAt
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

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

connect()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Unable to connect to MongoDB:', error.message || error);
    process.exit(1);
  });