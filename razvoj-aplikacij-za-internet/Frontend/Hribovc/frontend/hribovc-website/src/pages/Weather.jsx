import './Weather.css'
import goraImg from '../assets/gora.png'
import weatherHero from '../assets/ozadje_za_vreme_sreen.png'
import { LuShieldCheck } from 'react-icons/lu' 
import { useState, useEffect } from 'react'
import { LuChevronDown, LuChevronUp, LuWind, LuDroplets, LuEye, LuGauge } from 'react-icons/lu'

const riskColors = { low: '#4caf50', medium: '#ff9800', high: '#f44336', extreme: '#9c27b0' }

function WeatherIcon({ risk }) {
  if (risk === 'low') return (
    <svg width="36" height="36" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="9" fill="#FFB74D" />
      <line x1="18" y1="3" x2="18" y2="1" stroke="#FFB74D" strokeWidth="2" strokeLinecap="round"/>
      <line x1="18" y1="35" x2="18" y2="33" stroke="#FFB74D" strokeWidth="2" strokeLinecap="round"/>
      <line x1="3" y1="18" x2="1" y2="18" stroke="#FFB74D" strokeWidth="2" strokeLinecap="round"/>
      <line x1="35" y1="18" x2="33" y2="18" stroke="#FFB74D" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
  if (risk === 'medium') return (
    <svg width="36" height="36" viewBox="0 0 36 36">
      <circle cx="14" cy="16" r="7" fill="#FFB74D" opacity="0.9"/>
      <ellipse cx="20" cy="23" rx="11" ry="6" fill="#aaa"/>
      <ellipse cx="12" cy="25" rx="7" ry="5" fill="#ccc"/>
    </svg>
  )
  if (risk === 'high') return (
    <svg width="36" height="36" viewBox="0 0 36 36">
      <ellipse cx="18" cy="16" rx="13" ry="8" fill="#666"/>
      <line x1="16" y1="24" x2="12" y2="34" stroke="#ff9800" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="20" y1="23" x2="18" y2="31" stroke="#ff9800" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
  return (
    <svg width="36" height="36" viewBox="0 0 36 36">
      <ellipse cx="18" cy="15" rx="13" ry="8" fill="#555"/>
      <line x1="14" y1="23" x2="9" y2="34" stroke="#9c27b0" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="19" y1="23" x2="16" y2="32" stroke="#9c27b0" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="24" y1="22" x2="22" y2="31" stroke="#9c27b0" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}

function Weather() {
  const [expanded, setExpanded] = useState(null)
  const [weatherData, setWeatherData] = useState([])
  const [lastUpdate, setLastUpdate] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const toggle = (i) => setExpanded(expanded === i ? null : i)

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setLoading(true)
        // First, check if we have recent data
        const response = await fetch('http://localhost:3000/weather')
        const data = await response.json()

        const now = new Date()
        const scrapedAt = data.scrapedAt ? new Date(data.scrapedAt) : null
        
        // If data is older than 30 mins or doesn't exist, trigger a fresh scrape
        if (!scrapedAt || (now - scrapedAt) > 30 * 60 * 1000) {
          console.log('Weather data is old or missing, scraping fresh data...')
          const scrapeResponse = await fetch('http://localhost:3000/scrape')
          const freshData = await scrapeResponse.json()
          setWeatherData(freshData)
          setLastUpdate(new Date().toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' }))
        } else {
          setWeatherData(data.stations || [])
          setLastUpdate(scrapedAt.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' }))
        }
      } catch (err) {
        console.error('Error fetching weather:', err)
        setError('Nismo mogli pridobiti vremenskih podatkov.')
      } finally {
        setLoading(false)
      }
    }

    fetchWeather()
  }, [])

  const overallStatus = weatherData.some(w => w.risk === 'high' || w.risk === 'extreme') ? 'SLABI' : 'DOBRI'
  const overallClass = overallStatus === 'DOBRI' ? 'status-green' : 'status-red'

  return (
    <div className="weather">
      <div className="weather-hero" style={{ backgroundImage: 'url(' + weatherHero + ')' }}>
        <div className="hero-content">
          <h1 style={{ textAlign: 'left' }}>Vremenska napoved</h1>
          <p>Podatki po višinah za varno načrtovanje vzpona</p>
          <div className="hero-status">
            <div className="status-badge-main">
              <LuShieldCheck className="icon-check" size="1.2em" />
              <span>Pogoji na gori: <span className={overallClass}>{overallStatus}</span></span>
            </div>
            <span className="status-time">Posodobljeno: danes ob {lastUpdate || '--:--'}</span>
          </div>
        </div>
      </div>

      <div className="weather-list">
        {loading && <p style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>Nalagam vremenske podatke...</p>}
        {error && <p style={{ textAlign: 'center', color: '#f44336', padding: '2rem' }}>{error}</p>}
        
        {!loading && !error && weatherData.map((item, i) => (
          <div key={item.altitude} className={['weather-card', 'card-' + item.risk].join(' ')}>
            <div className="card-top" onClick={() => toggle(i)}>
              
              <div className="card-altitude-col">
                <div className="card-alt-header">
                <span className="card-alt-icon">△</span>
                <span className="card-alt-num" style={{ color: '#FF6B35' }}>
                  {item.altitude}
                </span>
              </div>
                <div className="card-alt-loc">{item.location.toUpperCase()}</div>
                <img src={goraImg} alt="gora" className="card-gora-img" />
              </div>

              <div className="card-temp-col">
                <div className="card-temp">{item.temp}</div>
                <div className="card-feels">Občuteno {item.feelsLike}</div>
                <div className="card-wind-pill">
                  <LuWind size="0.85em" /> {item.wind} vetra &nbsp; {item.windDir}
                </div>
              </div>

              <div className="card-desc-col">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <WeatherIcon risk={item.risk} />
                    <div>
                        <div className="card-desc-title">{item.descTitle}</div>
                        <div className="card-desc-sub">{item.descSub}</div>
                    </div>
                </div>
              </div>

              <div className="card-right">
                <span className={['card-badge', 'badge-' + item.risk].join(' ')}>
                    {item.riskLabel.toUpperCase()}
                </span>
                {expanded === i ? <LuChevronUp size="1.2em" color="#888" /> : <LuChevronDown size="1.2em" color="#888" />}
              </div>
            </div>

            {expanded === i && (
              <div className="card-expanded">
                <div className="exp-grid">
                  <div className="exp-item">
                  <LuDroplets size="1.5em" className="weather-stat-icon" />
                  <span className="exp-label">VLAŽNOST</span>
                  <span className="exp-value">{item.humidity}%</span>
                  <div className="exp-bar">
                    <div className="exp-fill" style={{ width: item.humidity + '%', background: '#8FA998' }}></div>
                  </div>
                </div>

                <div className="exp-item">
                  <LuWind size="1.5em" className="weather-stat-icon" />
                  <span className="exp-label">VETER</span>
                  <span className="exp-value">{item.wind}</span>
                  <div className="exp-bar">
                    <div className="exp-fill" style={{ width: '45%', background: '#8FA998' }}></div>
                  </div>
                </div>

                <div className="exp-item">
                  <LuEye size="1.5em" className="weather-stat-icon" />
                  <span className="exp-label">VIDLJIVOST</span>
                  <span className="exp-value">{item.visibility}</span>
                  <div className="exp-bar">
                    <div className="exp-fill" style={{ width: '70%', background: '#8FA998' }}></div>
                  </div>
                </div>

                <div className="exp-item">
                  <LuGauge size="1.5em" className="weather-stat-icon" />
                  <span className="exp-label">TLAK</span>
                  <span className="exp-value">{item.pressure}</span>
                  <div className="exp-bar">
                    <div className="exp-fill" style={{ width: '85%', background: '#8FA998' }}></div>
                  </div>
                </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="weather-footer">
        <span>Vremenske razmere se hitro spreminjajo. Redno preverjajte napoved pred vsakim vzponom.</span>
        <span className="footer-source">Vir podatkov: ARSO</span>
      </div>
    </div>
  )
}

export default Weather