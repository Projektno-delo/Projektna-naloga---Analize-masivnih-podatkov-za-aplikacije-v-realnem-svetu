const { ObjectId } = require('mongodb');
const { getCollection } = require('../db');

function getHighestWeatherRisk(weather) {
  const stations = weather?.stations || [];

  if (stations.some(station => station.risk === 'extreme')) {
    return { risk: 'extreme', riskLabel: 'Ekstremno' };
  }

  if (stations.some(station => station.risk === 'high')) {
    return { risk: 'high', riskLabel: 'Nevarno' };
  }

  if (stations.some(station => station.risk === 'medium')) {
    return { risk: 'medium', riskLabel: 'Previdno' };
  }

  if (stations.some(station => station.risk === 'low')) {
    return { risk: 'low', riskLabel: 'Varno' };
  }

  return { risk: 'unknown', riskLabel: 'Ni podatkov' };
}

function createRecommendation({ user, trail, weatherRisk }) {
  const bmi = Number(user.bmi);
  const difficulty = String(trail.difficulty || '').toLowerCase();
  const risk = weatherRisk.risk;

  let recommendation = 'PRIPOROČENO';
  let reason = 'Pot je primerna glede na trenutno vreme in osnovne podatke uporabnika.';

  if (risk === 'extreme') {
    recommendation = 'ODSVETOVANO';
    reason = 'Vzpon je odsvetovan zaradi ekstremnih vremenskih razmer.';
  } else if (risk === 'high') {
    recommendation = 'ODSVETOVANO';
    reason = 'Vzpon je odsvetovan zaradi nevarnih vremenskih razmer.';
  } else if (risk === 'medium') {
    recommendation = 'PREVIDNO';
    reason = 'Pot je možna, vendar je zaradi vremenskih razmer priporočena dodatna previdnost.';
  }

  if (difficulty.includes('zelo zahtevna')) {
    if (recommendation === 'PRIPOROČENO') {
      recommendation = 'PREVIDNO';
      reason = 'Pot je zelo zahtevna, zato je priporočena dodatna previdnost.';
    }
  }

  if (bmi >= 30) {
    if (recommendation === 'PRIPOROČENO') {
      recommendation = 'PREVIDNO';
      reason = 'Zaradi višjega BMI je priporočena dodatna previdnost pri izbiri poti.';
    }
  }

  return {
    recommendation,
    reason
  };
}

async function analyzeTrail({ userId, trailId }) {
  const usersCollection = await getCollection('users');
  const trailsCollection = await getCollection('trails');
  const weatherCollection = await getCollection('weather');
  const riskAnalysesCollection = await getCollection('riskAnalyses');

  const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

  if (!user) {
    throw new Error('User not found');
  }

  const trail = await trailsCollection.findOne({ _id: new ObjectId(trailId) });

  if (!trail) {
    throw new Error('Trail not found');
  }

  const latestWeather = await weatherCollection
    .find({})
    .sort({ scrapedAt: -1 })
    .limit(1)
    .toArray();

  const weather = latestWeather[0];

  if (!weather) {
    throw new Error('Weather data not found');
  }

  const weatherRisk = getHighestWeatherRisk(weather);
  const result = createRecommendation({ user, trail, weatherRisk });

  const analysis = {
    userId: user._id,
    trailId: trail._id,
    weatherId: weather._id,

    userSnapshot: {
      starost: user.starost,
      bmi: user.bmi
    },

    trailSnapshot: {
      name: trail.name,
      difficulty: trail.difficulty,
      elevation: trail.elevation,
      distance: trail.distance
    },

    weatherSnapshot: {
      risk: weatherRisk.risk,
      riskLabel: weatherRisk.riskLabel
    },

    recommendation: result.recommendation,
    reason: result.reason,

    createdAt: new Date()
  };

  const insertResult = await riskAnalysesCollection.insertOne(analysis);

  return {
    _id: insertResult.insertedId,
    ...analysis
  };
}

module.exports = {
  analyzeTrail
};