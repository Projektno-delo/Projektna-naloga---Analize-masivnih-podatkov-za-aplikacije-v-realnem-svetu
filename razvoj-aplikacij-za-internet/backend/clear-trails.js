const { getCollection, connect } = require('./db');

async function clearTrails() {
  try {
    await connect();
    const trailsCollection = await getCollection('trails');
    await trailsCollection.deleteMany({});
    console.log('Trails collection cleared.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

clearTrails();
