const { getCollection } = require('../db');

const SENSOR_READINGS_COLLECTION = 'mobileSensorReadings';

function groupWeatherRisk(latestWeather) {
  const stations = latestWeather?.stations || [];
  const riskMap = new Map();

  for (const station of stations) {
    const risk = station.risk || 'unknown';
    const riskLabel = station.riskLabel || 'Ni podatkov';
    const key = `${risk}-${riskLabel}`;

    if (!riskMap.has(key)) {
      riskMap.set(key, {
        risk,
        riskLabel,
        count: 0
      });
    }

    riskMap.get(key).count += 1;
  }

  return Array.from(riskMap.values());
}

async function getStats({
  usersCollection,
  weatherCollection,
  trailsCollection,
  riskAnalysesCollection,
  sensorReadingsCollection
}) {
  const usersCount = await usersCollection.countDocuments();
  const weatherCount = await weatherCollection.countDocuments();
  const trailsCount = await trailsCollection.countDocuments();
  const riskAnalysesCount = await riskAnalysesCollection.countDocuments();
  const sensorReadingsCount = await sensorReadingsCollection.countDocuments();

  const latestWeather = await weatherCollection
    .find({})
    .sort({ scrapedAt: -1 })
    .limit(1)
    .toArray();

  return {
    usersCount,
    weatherCount,
    trailsCount,
    riskAnalysesCount,
    sensorReadingsCount,
    lastWeatherScrape: latestWeather[0]?.scrapedAt || null
  };
}

async function getTrailsByRegion(trailsCollection) {
  return trailsCollection
    .aggregate([
      {
        $group: {
          _id: {
            $ifNull: ['$region', 'Neznano']
          },
          count: {
            $sum: 1
          }
        }
      },
      {
        $project: {
          _id: 0,
          region: '$_id',
          count: 1
        }
      },
      {
        $sort: {
          count: -1,
          region: 1
        }
      }
    ])
    .toArray();
}

async function getTrailsByDifficulty(trailsCollection) {
  return trailsCollection
    .aggregate([
      {
        $group: {
          _id: {
            $ifNull: ['$difficulty', 'Neznano']
          },
          count: {
            $sum: 1
          }
        }
      },
      {
        $project: {
          _id: 0,
          difficulty: '$_id',
          count: 1
        }
      },
      {
        $sort: {
          count: -1,
          difficulty: 1
        }
      }
    ])
    .toArray();
}

async function getRiskAnalysesByRecommendation(riskAnalysesCollection) {
  return riskAnalysesCollection
    .aggregate([
      {
        $match: {
          recommendation: {
            $exists: true,
            $ne: null
          }
        }
      },
      {
        $group: {
          _id: '$recommendation',
          count: {
            $sum: 1
          }
        }
      },
      {
        $project: {
          _id: 0,
          recommendation: '$_id',
          count: 1
        }
      },
      {
        $sort: {
          count: -1,
          recommendation: 1
        }
      }
    ])
    .toArray();
}

async function getRiskAnalysesByType(riskAnalysesCollection) {
  return riskAnalysesCollection
    .aggregate([
      {
        $group: {
          _id: {
            $ifNull: ['$type', 'basicAnalysis']
          },
          count: {
            $sum: 1
          }
        }
      },
      {
        $project: {
          _id: 0,
          type: '$_id',
          count: 1
        }
      },
      {
        $sort: {
          count: -1,
          type: 1
        }
      }
    ])
    .toArray();
}

async function getLatestWeather(weatherCollection) {
  const latestWeather = await weatherCollection
    .find({})
    .sort({ scrapedAt: -1 })
    .limit(1)
    .toArray();

  return latestWeather[0] || null;
}

async function getLatestSensorReadings(sensorReadingsCollection) {
  return sensorReadingsCollection
    .find({})
    .sort({ receivedAt: -1 })
    .limit(10)
    .toArray();
}

async function getVisualizationData() {
  const usersCollection = await getCollection('users');
  const weatherCollection = await getCollection('weather');
  const trailsCollection = await getCollection('trails');
  const riskAnalysesCollection = await getCollection('riskAnalyses');
  const sensorReadingsCollection = await getCollection(SENSOR_READINGS_COLLECTION);

  const [
    stats,
    trailsByRegion,
    trailsByDifficulty,
    riskAnalysesByRecommendation,
    riskAnalysesByType,
    latestWeather,
    latestSensorReadings
  ] = await Promise.all([
    getStats({
      usersCollection,
      weatherCollection,
      trailsCollection,
      riskAnalysesCollection,
      sensorReadingsCollection
    }),
    getTrailsByRegion(trailsCollection),
    getTrailsByDifficulty(trailsCollection),
    getRiskAnalysesByRecommendation(riskAnalysesCollection),
    getRiskAnalysesByType(riskAnalysesCollection),
    getLatestWeather(weatherCollection),
    getLatestSensorReadings(sensorReadingsCollection)
  ]);

  return {
    stats,
    trailsByRegion,
    trailsByDifficulty,
    riskAnalysesByRecommendation,
    riskAnalysesByType,
    latestWeatherRisk: groupWeatherRisk(latestWeather),
    latestWeather,
    latestSensorReadings
  };
}

module.exports = {
  getVisualizationData
};