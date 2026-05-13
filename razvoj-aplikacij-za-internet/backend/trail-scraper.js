const axios = require('axios');
const cheerio = require('cheerio');
const { getCollection, connect } = require('./db');

const BASE_URL = 'https://www.hribi.net';

// Scrape all trails from Hribi.net
async function scrapeTrails() {
  try {
    console.log('Starting trail scraping from hribi.net...');
    const trails = [];
    
    // Popular Slovenian hiking categories/regions
    const regions = [
      '/poti/slovenija/triglav',
      '/poti/slovenija/pohorje',
      '/poti/slovenija/karawanke',
      '/poti/slovenija/savinja-alps',
    ];

    for (const region of regions) {
      try {
        const response = await axios.get(`${BASE_URL}${region}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 10000
        });

        const $ = cheerio.load(response.data);
        
        // Scrape trail links
        $('a[href*="/pot/"]').each((idx, element) => {
          const href = $(element).attr('href');
          const name = $(element).text().trim();
          
          if (href && name && !trails.some(t => t.url === href)) {
            trails.push({
              name: name,
              url: `${BASE_URL}${href}`,
              region: region.split('/').pop(),
              scraped: false
            });
          }
        });

        console.log(`Found ${trails.length} trails so far...`);
      } catch (error) {
        console.error(`Error scraping region ${region}:`, error.message);
      }
    }

    return trails.slice(0, 50); // Limit to first 50 for testing
  } catch (error) {
    console.error('Error in scrapeTrails:', error.message);
    throw error;
  }
}

// Scrape individual trail details
async function scrapeTrailDetails(trailUrl) {
  try {
    const response = await axios.get(trailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    
    // Extract trail information
    const title = $('h1').first().text().trim();
    const description = $('meta[name="description"]').attr('content') || '';
    
    // Try to extract difficulty, elevation, duration
    let difficulty = 'srednje';
    let elevation = 0;
    let duration = '';
    let distance = 0;

    // Look for difficulty indicators
    const diffText = $('body').text();
    if (diffText.includes('lahka') || diffText.includes('easy')) difficulty = 'lahka';
    if (diffText.includes('zahtevna') || diffText.includes('hard')) difficulty = 'zahtevna';

    // Extract numeric data from page text
    const elevMatch = diffText.match(/(\d{3,4})\s*m/);
    if (elevMatch) elevation = parseInt(elevMatch[1]);

    const distMatch = diffText.match(/(\d+(?:\.\d+)?)\s*km/);
    if (distMatch) distance = parseFloat(distMatch[1]);

    const durationMatch = diffText.match(/(\d+)\s*h/);
    if (durationMatch) duration = `${durationMatch[1]}h`;

    return {
      name: title || 'Neznana pot',
      description: description,
      difficulty: difficulty,
      elevation: elevation,
      distance: distance,
      duration: duration,
      url: trailUrl,
      sourceWebsite: 'hribi.net',
      scrapedAt: new Date()
    };
  } catch (error) {
    console.error(`Error scraping trail details from ${trailUrl}:`, error.message);
    return null;
  }
}

// Main scrape and save function
async function scrapeAndSaveTrails() {
  try {
    await connect();
    
    console.log('Fetching trail listings...');
    const trailListings = await scrapeTrails();
    
    console.log(`Found ${trailListings.length} trails to process`);
    
    const trailsCollection = await getCollection('trails');
    const savedTrails = [];

    // Scrape details for each trail
    for (let i = 0; i < trailListings.length; i++) {
      console.log(`Processing trail ${i + 1}/${trailListings.length}: ${trailListings[i].name}`);
      
      const trailDetails = await scrapeTrailDetails(trailListings[i].url);
      
      if (trailDetails) {
        // Check if trail already exists
        const existing = await trailsCollection.findOne({ url: trailDetails.url });
        
        if (!existing) {
          await trailsCollection.insertOne(trailDetails);
          savedTrails.push(trailDetails);
          console.log(` Saved: ${trailDetails.name}`);
        } else {
          console.log(`- Already exists: ${trailDetails.name}`);
        }
      }
      
      // Be nice to the server - add delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n✓ Scraping complete! Saved ${savedTrails.length} new trails`);
    return savedTrails;
  } catch (error) {
    console.error('Fatal error in scrapeAndSaveTrails:', error);
    throw error;
  }
}

// Export for use as API endpoint or standalone script
module.exports = {
  scrapeTrails,
  scrapeTrailDetails,
  scrapeAndSaveTrails
};

// Run if called directly
if (require.main === module) {
  scrapeAndSaveTrails()
    .then(trails => {
      console.log('Done!');
      process.exit(0);
    })
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}
