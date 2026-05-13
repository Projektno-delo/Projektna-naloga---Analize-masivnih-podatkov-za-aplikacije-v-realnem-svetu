const axios = require('axios');
const cheerio = require('cheerio');
const { getCollection, connect } = require('./db');

const BASE_URL = 'https://www.hribi.net';

// Slovenian hiking regions
const REGIONS = [
  { name: 'Julijske Alpe', url: '/gorovje/julijske_alpe/1' },
  { name: 'Karavanke', url: '/gorovje/karavanke/11' },
  { name: 'Kamniško-Savinjske Alpe', url: '/gorovje/kamnisko_savinjske_alpe/3' },
  { name: 'Pohorje', url: '/gorovje/pohorje_dravinjske_gorice_in_haloze/4' },
];

async function scrapeAndSaveTrails() {
  try {
    await connect();
    const trailsCollection = await getCollection('trails');
    
    // Check if we already have trails to avoid re-scraping
    const count = await trailsCollection.countDocuments();
    if (count > 0) {
      console.log(`Database already contains ${count} trails. Skipping initial scrape.`);
      return [];
    }

    console.log('Starting trail scraping from hribi.net...');
    const allTrails = [];

    for (const region of REGIONS) {
      console.log(`\n--- Region: ${region.name} ---`);
      try {
        const response = await axios.get(`${BASE_URL}${region.url}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 10000
        });
        const $ = cheerio.load(response.data);
        
        // Find mountain links (vrhovi)
        const mountainLinks = [];
        $('a[href^="/gora/"]').each((idx, el) => {
          const href = $(el).attr('href');
          if (href && !mountainLinks.includes(href)) {
            mountainLinks.push(href);
          }
        });

        console.log(`Found ${mountainLinks.length} mountains in ${region.name}.`);

        // Process a subset of mountains (e.g., first 5-10 to be efficient)
        for (const mountainHref of mountainLinks.slice(0, 8)) {
          try {
            console.log(`  Scraping mountain: ${mountainHref}`);
            const mountainResponse = await axios.get(`${BASE_URL}${mountainHref}`, {
              headers: { 'User-Agent': 'Mozilla/5.0' },
              timeout: 10000
            });
            const $m = cheerio.load(mountainResponse.data);
            
            // Look for trails in the table
            const trailRows = $m('table tr').toArray();
            for (const tr of trailRows) {
              const trailLink = $m(tr).find('a[href^="/izlet/"]').first();
              if (trailLink.length > 0) {
                let name = trailLink.text().trim();
                const relativeUrl = trailLink.attr('href');
                const duration = $m(tr).find('td:nth-child(2)').text().trim();
                const difficulty = $m(tr).find('td:nth-child(3)').text().trim();
                
                // Clean name: if it contains duration or difficulty, strip them
                // Sometimes .text() captures child spans even if we don't want them
                if (duration && name.includes(duration)) {
                  name = name.split(duration)[0].trim();
                }

                if (name && relativeUrl) {
                  const trailUrl = `${BASE_URL}${relativeUrl}`;
                  console.log(`    Fetching details for: ${name}`);
                  
                  let elevation = '';
                  let distance = '';
                  
                  try {
                    const trailPageResponse = await axios.get(trailUrl, {
                      headers: { 'User-Agent': 'Mozilla/5.0' },
                      timeout: 10000
                    });
                    const $t = cheerio.load(trailPageResponse.data);
                    
                    const detailsText = $t('.naslov_desno').text() || $t('body').text();
                    
                    const elevMatch = detailsText.match(/Višinska razlika:\s*([\d\s]+)m/i) || detailsText.match(/(\d{3,4})\s*m/);
                    if (elevMatch) elevation = elevMatch[1].trim();
                    
                    const distMatch = detailsText.match(/Dolžina:\s*([\d,.]+)\s*km/i) || detailsText.match(/(\d+(?:[.,]\d+)?)\s*km/);
                    if (distMatch) distance = distMatch[1].trim();

                    if (!elevation) {
                       $t('table.izlet_podatki tr').each((i, row) => {
                         const label = $t(row).find('td').first().text();
                         if (label.includes('Višina cilja')) {
                           elevation = $t(row).find('td').last().text().trim();
                         }
                       });
                    }
                  } catch (e) {
                    console.error(`      Error fetching trail details: ${e.message}`);
                  }

                  const trailData = {
                    name: name,
                    url: trailUrl,
                    region: region.name,
                    mountain: $m('h1').first().text().trim(),
                    duration: duration || 'N/A',
                    difficulty: difficulty.toLowerCase() || 'srednje',
                    elevation: elevation,
                    distance: distance,
                    scrapedAt: new Date()
                  };
                  
                  allTrails.push(trailData);
                  await new Promise(resolve => setTimeout(resolve, 300));
                }
              }
              if (allTrails.length >= 50) break;
            }
            
            // Be nice to the server
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (err) {
            console.error(`  Error scraping mountain ${mountainHref}:`, err.message);
          }
          
          if (allTrails.length >= 50) break;
        }
      } catch (error) {
        console.error(`Error scraping region ${region.name}:`, error.message);
      }
      
      if (allTrails.length >= 100) break;
    }

    if (allTrails.length > 0) {
      console.log(`\nSaving ${allTrails.length} trails to database...`);
      // Use bulk insert for efficiency
      // First, filter out potential duplicates (though we checked count > 0 at start)
      await trailsCollection.insertMany(allTrails);
      console.log('✓ Successfully saved all trails!');
    }

    return allTrails;
  } catch (error) {
    console.error('Fatal error in scrapeAndSaveTrails:', error);
    throw error;
  }
}

module.exports = {
  scrapeAndSaveTrails
};

if (require.main === module) {
  scrapeAndSaveTrails()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

