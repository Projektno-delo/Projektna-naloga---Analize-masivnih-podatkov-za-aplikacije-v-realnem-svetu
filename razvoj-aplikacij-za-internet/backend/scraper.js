const axios = require('axios');
const cheerio = require('cheerio');

const STATIONS = [
  { id: 'dolina', name: 'Dolina', location: 'Ljubljana', altitude: '300 m', url: 'https://meteo.arso.gov.si/uploads/probase/www/observ/surface/text/sl/observation_LJUBL-ANA_BEZIGRAD_latest.xml' },
  { id: 'sredogorje', name: 'Sredogorje', location: 'Vogel', altitude: '1500 m', url: 'https://meteo.arso.gov.si/uploads/probase/www/observ/surface/text/sl/observation_VOGEL_latest.xml' },
  { id: 'visokogorje', name: 'Visokogorje', location: 'Kredarica', altitude: '2500 m', url: 'https://meteo.arso.gov.si/uploads/probase/www/observ/surface/text/sl/observation_KREDA-ICA_latest.xml' }
];

function calculateRisk(temp, windSpeed) {
  const wind = parseFloat(windSpeed) || 0;
  const t = parseFloat(temp) || 20;

  if (wind > 60 || t < -10) return { risk: 'extreme', riskLabel: 'Ekstremno' };
  if (wind > 40 || t < 0) return { risk: 'high', riskLabel: 'Nevarno' };
  if (wind > 20 || t < 10) return { risk: 'medium', riskLabel: 'Previdno' };
  return { risk: 'low', riskLabel: 'Varno' };
}

function getDescription(risk) {
  switch (risk) {
    case 'low': return { title: 'Jasno in sončno.', sub: 'Idealni pogoji za pohod.' };
    case 'medium': return { title: 'Zmeren veter.', sub: 'Bodite previdni pri višjih predelih.' };
    case 'high': return { title: 'Močan veter.', sub: 'Odsvetujemo vzpon za manj izkušene.' };
    case 'extreme': return { title: 'Zelo močan veter / mraz.', sub: 'Vzpon je nevaren.' };
    default: return { title: 'Podatki niso na voljo.', sub: '' };
  }
}

async function scrapeWeather() {
  const results = [];

  for (const station of STATIONS) {
    try {
      const response = await axios.get(station.url, { timeout: 10000 });
      const $xml = cheerio.load(response.data, { xmlMode: true });

      const temp = $xml('t').first().text();
      const windSpeed = $xml('ff_val_kmh').first().text();
      const windDir = $xml('dd_shortText').first().text();
      const humidity = $xml('rh').first().text();
      const pressure = $xml('p').first().text();
      const visibility = $xml('vis_value').first().text() + ' ' + $xml('vis_unit').first().text();
      const time = $xml('tsValid_issued').first().text();

      const { risk, riskLabel } = calculateRisk(temp, windSpeed);
      const { title, sub } = getDescription(risk);

      results.push({
        id: station.id,
        altitude: station.altitude,
        location: station.location,
        temp: temp ? `${temp}°C` : 'N/A',
        feelsLike: temp ? `${(parseFloat(temp) - 2).toFixed(0)}°C` : 'N/A', // Simple approximation
        wind: windSpeed ? `${windSpeed} km/h` : 'N/A',
        windDir: windDir || 'N/A',
        risk: risk,
        riskLabel: riskLabel,
        humidity: parseInt(humidity) || 0,
        pressure: pressure ? `${pressure} hPa` : 'N/A',
        visibility: visibility.trim() || 'N/A',
        descTitle: title,
        descSub: sub,
        updatedAt: time
      });
    } catch (error) {
      console.error(`Error scraping station ${station.name}:`, error.message);
      // Fallback for this station if needed
    }
  }

  return results;
}

if (require.main === module) {
  scrapeWeather()
    .then(data => {
      console.log(JSON.stringify(data, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}

module.exports = { scrapeWeather };