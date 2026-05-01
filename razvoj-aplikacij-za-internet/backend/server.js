const http = require('http');
const { scrapeWeather } = require('./scraper');

const PORT = 3000;

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/scrape') {
    try {
      const data = await scrapeWeather();
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify(data));
    } catch (error) {
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({ error: error.message || String(error) }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});