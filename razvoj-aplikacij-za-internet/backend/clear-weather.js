const { getCollection, connect } = require('./db');

async function clearWeather() {
  try {
    await connect();
    const weatherCollection = await getCollection('weather');
    await weatherCollection.deleteMany({});
    console.log('Weather collection cleared.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

clearWeather();
