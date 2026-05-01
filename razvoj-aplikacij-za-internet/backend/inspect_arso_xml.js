const axios = require('axios');
(async () => {
  try {
    const url = 'https://meteo.arso.gov.si/uploads/probase/www/observ/surface/text/sl/observation_LJUBL-ANA_BEZIGRAD_latest.xml';
    const resp = await axios.get(url);
    const data = resp.data;

    console.log(data.slice(0, 5000));
  } 
  catch (err) 
  {
    console.error(err.message);
  }
})();
