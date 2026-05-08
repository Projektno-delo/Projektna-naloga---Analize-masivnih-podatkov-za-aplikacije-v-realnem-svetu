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

async function getCollection(collectionName) {
  const client = await getClient();
  return client.db(dbName).collection(collectionName);
}

module.exports = {
  connect,
  getCollection,
};
