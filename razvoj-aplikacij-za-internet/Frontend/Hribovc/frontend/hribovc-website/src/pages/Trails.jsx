import './Trails.css'
import { useState } from 'react'
import { LuSearch, LuMapPin, LuClock, LuMountain, LuRoute, LuStar, LuFilter } from 'react-icons/lu'

import triglavImg from '../assets/triglav.jpg'
import kredaricaImg from '../assets/kredarica.png'
import skrlaticaImg from '../assets/skrlatica.png'
import stolImg from '../assets/stol.png'
import pecaImg from '../assets/peca.png'

const recommendedTrails = [
  { id: 1, name: 'Triglav (2864 m)', location: 'Vrata, Julijske Alpe', difficulty: 'Lahka', diffClass: 'easy', region: 'Julijske Alpe', time: '6h', elevation: '1500 m', distance: '12 km', score: 85, status: 'PRIPOROČENO', statusDesc: 'Pot je primerna za vašo pripravljenost in razmere.', statusClass: 'good', img: triglavImg },
  { id: 2, name: 'Kredarica (2514 m)', location: 'Kranjska Gora, Julijske Alpe', difficulty: 'Srednja', diffClass: 'medium', region: 'Julijske Alpe', time: '5h', elevation: '1100 m', distance: '9 km', score: 65, status: 'PREVIDNO', statusDesc: 'Mocan veter na vrhu. Priporocamo zgodnji start.', statusClass: 'warn', img: kredaricaImg },
  { id: 3, name: 'Škrlatica (2740 m)', location: 'Vršič, Julijske Alpe', difficulty: 'Težka', diffClass: 'hard', region: 'Julijske Alpe', time: '7h', elevation: '1600 m', distance: '14 km', score: 25, status: 'ODSVETOVANO', statusDesc: 'Slabe razmere na visoki nadmorski višini.', statusClass: 'bad', img: skrlaticaImg },
]

const allTrails = [
  { id: 4, name: 'Stol (2236 m)', location: 'Karavanke', difficulty: 'Lahka', diffClass: 'easy', region: 'Karavanke', time: '4h', elevation: '800 m', distance: '8 km', img: stolImg },
  { id: 5, name: 'Peca (2125 m)', location: 'Karavanke', difficulty: 'Srednja', diffClass: 'medium', region: 'Karavanke', time: '5h', elevation: '1000 m', distance: '9 km', img: pecaImg },
]

const scoreColor = (s) => s >= 70 ? '#4caf50' : s >= 40 ? '#ff9800' : '#f44336'

function Trails() {
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState('Vse težavnosti')
  const [region, setRegion] = useState('Vse regije')

  const filterTrails = (trails) => trails.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase())
    const matchDiff = difficulty === 'Vse težavnosti' || t.difficulty === difficulty
    const matchRegion = region === 'Vse regije' || t.region === region
    return matchSearch && matchDiff && matchRegion
  })

  const filteredRec = filterTrails(recommendedTrails)
  const filteredAll = filterTrails(allTrails)

  return (
    <div className="trails">
      <div className="trails-hero">
        <div className="trails-hero-content">
          <h1>Izberi pot</h1>
          <p>Načrtuj svoj vzpon glede na svojo pripravljenost in razmere.</p>
          <div className="trails-filters">
            <div className="search-box">
              <LuSearch size="1em" color="#888" />
              <input placeholder="Išči vrh ali pot..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="filter-select" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
              <option>Vse težavnosti</option>
              <option>Lahka</option>
              <option>Srednja</option>
              <option>Težka</option>
            </select>
            <select className="filter-select" value={region} onChange={e => setRegion(e.target.value)}>
              <option>Vse regije</option>
              <option>Julijske Alpe</option>
              <option>Karavanke</option>
              <option>Kamniško-Savinjske Alpe</option>
            </select>
            <button className="filter-btn"><LuFilter size="1em" /> Filtri</button>
          </div>
        </div>
      </div>

      <div className="trails-content">
        <div className="section-title"><LuStar size="1.1em" color="#4caf50" /><h2>Priporočene poti</h2></div>
        <div className="recommended-list">
          {filteredRec.length === 0 && <p style={{color:'#666'}}>Ni rezultatov.</p>}
          {filteredRec.map(trail => (
            <div key={trail.id} className={['trail-card', 'trail-' + trail.statusClass].join(' ')}>
              <img src={trail.img} alt={trail.name} className="trail-img" />
              
              <div className="trail-info">
                <span className={['diff-badge', 'diff-' + trail.diffClass].join(' ')}>
                  {trail.difficulty}
                </span>

                <div className="trail-header">
                  <div>
                    <h3>{trail.name}</h3>
                    <span className="trail-location"><LuMapPin size="0.8em" /> {trail.location}</span>
                  </div>
                </div>
                
                <div className="trail-stats">
                  <span><LuClock size="0.9em" /> {trail.time} Čas hoje</span>
                  <span><LuMountain size="0.9em" /> {trail.elevation} Višinska razlika</span>
                  <span><LuRoute size="0.9em" /> {trail.distance} Dolžina</span>
                </div>

                <button className="podrobnosti-btn">Podrobnosti &gt;</button>
              </div>

              <div className="trail-score-col">
                <div className="score-circle" style={{ borderColor: scoreColor(trail.score) }}>
                  <span style={{ color: scoreColor(trail.score) }}>{trail.score}</span>
                </div>
                
                <div className={['trail-status', 'status-' + trail.statusClass].join(' ')}>
                  <span className="status-label">{trail.status}</span>
                  <span className="status-desc">{trail.statusDesc}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="smart-tip">
          <div className="tip-icon">🧠</div>
          <div className="tip-text">
            <strong>Pametno priporočilo</strong>
            <p>Na podlagi vaših podatkov smo izbrali poti, ki so za vas trenutno najbolj varne.</p>
          </div>
          <button className="tip-btn">Posodobi podatke &gt;</button>
        </div>

        <div className="section-title" style={{ marginTop: '2rem' }}><span style={{color:'#4caf50'}}>☑</span><h2>Vse poti</h2></div>
        <div className="all-trails-grid">
          {filteredAll.map(trail => (
            <div key={trail.id} className="all-trail-card">
              <img src={trail.img} alt={trail.name} className="all-trail-img" />
              <div className="all-trail-info">
                <div className="all-trail-header">
                  <span className="all-trail-name">{trail.name}</span>
                  <span className={['diff-badge-small', 'diff-' + trail.diffClass].join(' ')}>{trail.difficulty}</span>
                </div>
                <span className="trail-location">{trail.location}</span>
                <div className="all-trail-stats">
                  <span><LuClock size="0.8em" /> {trail.time}</span>
                  <span><LuMountain size="0.8em" /> {trail.elevation}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Trails