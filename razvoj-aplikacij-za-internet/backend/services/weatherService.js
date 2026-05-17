const { scrapeWeather } = require('../scraper');
const { getCollection } = require('../db');

async function scrapeAndStoreWeather() {
  const stations = await scrapeWeather();

  const document = {
    stations,
    source: 'ARSO',
    scrapedAt: new Date()
  };

  const collection = await getCollection('weather');
  const result = await collection.insertOne(document);

  return {
    _id: result.insertedId,
    ...document
  };
}

async function getLatestWeather() {
  const collection = await getCollection('weather');

  const latestWeather = await collection
    .find({})
    .sort({ scrapedAt: -1 })
    .limit(1)
    .toArray();

  return latestWeather[0] || {
    stations: [],
    source: 'ARSO',
    scrapedAt: null
  };
}

module.exports = {
  scrapeAndStoreWeather,
  getLatestWeather
};