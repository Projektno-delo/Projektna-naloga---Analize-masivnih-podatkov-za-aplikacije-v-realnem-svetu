import { useState } from 'react';

function ScraperTest() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchScraperData = async () => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const response = await fetch('http://localhost:3000/scrape');
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1>ARSO Scraper Test</h1>
      <p>Click the button to load ARSO data from the backend scraper API.</p>
      <button onClick={fetchScraperData} style={{ padding: '0.75rem 1rem', fontSize: '1rem' }}>
        Load scraper data
      </button>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {data && (
        <div style={{ marginTop: '1.5rem', lineHeight: '1.6' }}>
          {Object.entries(data).map(([key, value]) => (
            <div key={key} style={{ marginBottom: '0.5rem' }}>
              <strong style={{ display: 'inline-block', width: '160px' }}>{key}</strong>
              {value}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ScraperTest;
