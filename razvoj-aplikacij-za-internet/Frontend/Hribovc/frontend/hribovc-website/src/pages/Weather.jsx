import './Weather.css'
import weatherHero from '../assets/hero_z.jpg'

const weatherData = [
  { altitude: '500 m', location: 'Dolina', temp: '18°C', wind: '12 km/h', risk: 'low', riskLabel: 'Varno', storm: '5%' },
  { altitude: '1000 m', location: 'Sredogorje', temp: '12°C', wind: '28 km/h', risk: 'medium', riskLabel: 'Previdno', storm: '25%' },
  { altitude: '1500 m', location: 'Visokogorje', temp: '6°C', wind: '52 km/h', risk: 'high', riskLabel: 'Nevarno', storm: '65%' },
  { altitude: '2000 m+', location: 'Alpski svet', temp: '1°C', wind: '78 km/h', risk: 'extreme', riskLabel: 'Ekstremno', storm: '85%' },
]

function Weather() {
  return (
    <div className="weather">
      <div className="weather-hero" style={{ backgroundImage: url(+weatherHero+) }}>
        <h1>Vremenska napoved</h1>
        <p>Podatki po višinah za varno načrtovanje vzpona</p>
      </div>
      <div className="weather-list">
        {weatherData.map((item) => (
          <div key={item.altitude} className={['weather-row', 'risk-border-' + item.risk].join(' ')}>
            <div className="row-top">
              <span className="row-altitude">{item.altitude} — {item.location.toUpperCase()}</span>
              <span className={['row-badge', 'badge-' + item.risk].join(' ')}>{item.riskLabel}</span>
            </div>
            <div className="row-temp">{item.temp}</div>
            <div className="row-details">
              <span>{item.wind} vetra</span>
              <span>{item.storm} nevihta</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Weather
