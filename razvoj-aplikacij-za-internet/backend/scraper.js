const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeWeather() {
  try {
    const postaja = 'https://meteo.arso.gov.si/uploads/probase/www/observ/surface/text/sl/observation_LJUBL-ANA_BEZIGRAD_latest.xml';
    const odgovor = await axios.get(postaja);

    const $xml = cheerio.load(odgovor.data, 
    { 
      xmlMode: true 
    });

    const temperatura = $xml('t').first().text();
    const veter_v_km_h = $xml('ff_val_kmh').first().text();

    let wind;
    if (veter_v_km_h) 
    {
      wind = `${veter_v_km_h} km/h`;
    } 
    else 
    {
      wind = 'Not found';
    }

    const url = 'https://meteo.arso.gov.si/uploads/probase/www/warning/text/sl/bundle/warning_TS_si-region_d1.html';
    const response = await axios.get(url);

    const $ts = cheerio.load(response.data);
    const text = $ts('body').text();

    let thunderstorms;
    if (text.includes('Dodatnega opozorila ni')) 
    {
      thunderstorms = 'No thunderstorms';
    } else {
      thunderstorms = 'Thunderstorms possible';
    }

    let temperatureOutput;
    if (temperatura) 
    {
      temperatureOutput = `${temperatura} °C`;
    } else {
      temperatureOutput = 'Not found';
    }

    console.log('Temperature:', temperatureOutput);
    console.log('Wind:', wind);
    console.log('Thunderstorms:', thunderstorms);
  } 
  catch (error)
   {
    console.error('Error scraping:', error.message || error);
  }
}

scrapeWeather();