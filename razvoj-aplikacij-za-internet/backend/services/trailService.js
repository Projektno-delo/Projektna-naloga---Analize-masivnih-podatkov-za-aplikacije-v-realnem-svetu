const { ObjectId } = require('mongodb');
const { getCollection } = require('../db');

function parseDistanceKm(distance) {
  if (!distance) {
    return null;
  }

  const value = parseFloat(String(distance).replace(',', '.'));

  return Number.isNaN(value) ? null : value;
}

function parseElevationM(elevation) {
  if (!elevation) {
    return null;
  }

  const value = parseInt(String(elevation).replace(/[^\d]/g, ''), 10);

  return Number.isNaN(value) ? null : value;
}

function normalizeTrail(trail) {
  const now = new Date();

  return {
    name: trail.name,
    url: trail.url,

    region: trail.region,
    mountain: trail.mountain,

    duration: trail.duration || 'N/A',
    difficulty: trail.difficulty || 'srednje',

    elevation: trail.elevation || '',
    elevationM: parseElevationM(trail.elevation),

    distance: trail.distance || '',
    distanceKm: parseDistanceKm(trail.distance),

    source: 'hribi.net',

    scrapedAt: trail.scrapedAt || now,
    updatedAt: now
  };
}

async function upsertTrails(rawTrails) {
  const trailsCollection = await getCollection('trails');

  const normalizedTrails = rawTrails
    .map(normalizeTrail)
    .filter(trail => trail.url);

  if (normalizedTrails.length === 0) {
    return [];
  }

  const operations = normalizedTrails.map(trail => ({
    updateOne: {
      filter: { url: trail.url },
      update: {
        $set: trail,
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      upsert: true
    }
  }));

  console.log(`Upserting ${operations.length} trails...`);

  const result = await trailsCollection.bulkWrite(operations, {
    ordered: false
  });

  console.log('Trail upsert result:', {
    inserted: result.upsertedCount,
    modified: result.modifiedCount,
    matched: result.matchedCount
  });

  return normalizedTrails;
}

async function getTrails() {
  const trailsCollection = await getCollection('trails');

  return trailsCollection
    .find({})
    .sort({ name: 1 })
    .toArray();
}

async function getTrailById(id) {
  const trailsCollection = await getCollection('trails');

  try {
    return await trailsCollection.findOne({ _id: new ObjectId(id) });
  } catch {
    return await trailsCollection.findOne({ name: id });
  }
}

module.exports = {
  normalizeTrail,
  upsertTrails,
  getTrails,
  getTrailById
};