const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeWeather() {
  try {
    const postaja = 'https://meteo.arso.gov.si/uploads/probase/www/observ/surface/text/sl/observation_LJUBL-ANA_BEZIGRAD_latest.xml';
    const odgovor = await axios.get(postaja);

    const $xml = cheerio.load(odgovor.data, { xmlMode: true });

    const temperatura = $xml('t').first().text();
    const veter_v_km_h = $xml('ff_val_kmh').first().text();
    const smer_vetra = $xml('dd_longText').first().text();

    const vlaga = $xml('rh').first().text();
    const tlak = $xml('p').first().text();
    const vidljivost_value = $xml('vis_value').first().text();
    const vidljivost_unit = $xml('vis_unit').first().text();
    const padavine = $xml('rr24h_val').first().text();
    const cas_meritve = $xml('tsValid_issued').first().text();
    const rosa_point = $xml('td').first().text();
    const tlak_morje = $xml('msl').first().text();

    let temperatureOutput = 'Not found';
    if (temperatura) {
      temperatureOutput = `${temperatura} °C`;
    }

    let wind = 'Not found';
    if (veter_v_km_h) {
      wind = `${veter_v_km_h} km/h`;
    }

    let windDirection = 'Not found';
    if (smer_vetra) {
      windDirection = smer_vetra;
    }

    let humidity = 'Not found';
    if (vlaga) {
      humidity = `${vlaga} %`;
    }

    let pressure = 'Not found';
    if (tlak) {
      pressure = `${tlak} hPa`;
    }

    let visibility = 'Not found';
    if (vidljivost_value && vidljivost_unit) {
      visibility = `${vidljivost_value} ${vidljivost_unit}`;
    }

    let precipitation = '0 mm';
    if (padavine) {
      precipitation = `${padavine} mm`;
    }

    let measurementTime = 'Not found';
    if (cas_meritve) {
      measurementTime = cas_meritve;
    }

    let dewPoint = 'Not found';
    if (rosa_point) {
      dewPoint = `${rosa_point} °C`;
    }

    let seaLevelPressure = 'Not found';
    if (tlak_morje) {
      seaLevelPressure = `${tlak_morje} hPa`;
    }

    const url = 'https://meteo.arso.gov.si/uploads/probase/www/warning/text/sl/bundle/warning_TS_si-region_d1.html';
    const response = await axios.get(url);
    const $ts = cheerio.load(response.data);
    const text = $ts('body').text();
    let thunderstorms = 'Thunderstorms possible';
    if (text.includes('Dodatnega opozorila ni')) {
      thunderstorms = 'No thunderstorms';
    }

    console.log('Temperature:', temperatureOutput);
    console.log('Wind Speed:', wind);
    console.log('Wind Direction:', windDirection);
    console.log('Humidity:', humidity);
    console.log('Pressure:', pressure);
    console.log('Visibility:', visibility);
    console.log('Precipitation:', precipitation);
    console.log('Thunderstorms:', thunderstorms);
  } catch (error) {
    console.error('Error scraping:', error.message || error);
  }
}

scrapeWeather();