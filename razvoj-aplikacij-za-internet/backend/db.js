const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB || 'hribovc';

let clientPromise;

function getClient() {
  if (!clientPromise) {
    const client = new MongoClient(uri);
    clientPromise = client.connect();
  }

  return clientPromise;
}

async function connect() {
  await getClient();
}

async function getDb() {
  const client = await getClient();
  return client.db(dbName);
}

async function getCollection(collectionName) {
  const db = await getDb();
  return db.collection(collectionName);
}

async function initDb() {
  const db = await getDb();

  await db.collection('users').createIndex(
    { email: 1 },
    { unique: true }
  );

  await db.collection('weather').createIndex(
    { scrapedAt: -1 }
  );

  await db.collection('trails').createIndex(
    { url: 1 },
    { unique: true }
  );

  await db.collection('trails').createIndex(
    { region: 1 }
  );

  await db.collection('trails').createIndex(
    { difficulty: 1 }
  );

  await db.collection('riskAnalyses').createIndex(
    { userId: 1 }
  );

  await db.collection('riskAnalyses').createIndex(
    { trailId: 1 }
  );

  await db.collection('riskAnalyses').createIndex(
    { createdAt: -1 }
  );

  await db.collection('riskAnalyses').createIndex(
    { userId: 1, type: 1 }
  );

  await db.collection('riskAnalyses').createIndex(
    { userId: 1, trailId: 1, type: 1 }
  );

  console.log('MongoDB data model initialized');
}

module.exports = {
  connect,
  getDb,
  getCollection,
  initDb,
};
