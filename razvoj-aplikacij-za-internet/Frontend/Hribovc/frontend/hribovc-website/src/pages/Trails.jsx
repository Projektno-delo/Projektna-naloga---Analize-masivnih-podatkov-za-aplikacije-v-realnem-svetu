import './Trails.css'
import { useState, useEffect } from 'react'
import { LuSearch, LuMapPin, LuClock, LuMountain, LuRoute, LuStar, LuFilter } from 'react-icons/lu'

import triglavImg from '../assets/triglav.jpg'
import kredaricaImg from '../assets/kredarica.png'
import skrlaticaImg from '../assets/skrlatica.png'
import stolImg from '../assets/stol.png'
import pecaImg from '../assets/peca.png'

// Fallback images mapping
const imageMap = {
  'triglav': triglavImg,
  'kredarica': kredaricaImg,
  'škrlatica': skrlaticaImg,
  'skrlatica': skrlaticaImg,
  'stol': stolImg,
  'peca': pecaImg,
}

const getDifficultyClass = (difficulty) => {
  const diff = difficulty?.toLowerCase() || 'srednje'
  if (diff.includes('lahka') || diff.includes('easy')) return 'easy'
  if (diff.includes('zahtevna') || diff.includes('hard')) return 'hard'
  return 'medium'
}

const getImageForTrail = (trail) => {
  const name = trail.name?.toLowerCase() || ''
  for (const [key, img] of Object.entries(imageMap)) {
    if (name.includes(key)) return img
  }
  return triglavImg
}

const scoreColor = (s) => s >= 70 ? '#4caf50' : s >= 40 ? '#ff9800' : '#f44336'

function Trails() {
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState('Vse težavnosti')
  const [region, setRegion] = useState('Vse regije')
  const [trails, setTrails] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch trails from API
  useEffect(() => {
    const fetchTrails = async () => {
      try {
        setLoading(true)
        const response = await fetch('http://localhost:3000/trails')
        if (!response.ok) throw new Error('Napaka pri pridobivanju poti')
        const data = await response.json()
        
        // Process trails and add default values
        const processedTrails = data.map((trail, idx) => ({
          ...trail,
          id: trail._id || idx,
          difficulty: trail.difficulty || 'srednje',
          diffClass: getDifficultyClass(trail.difficulty),
          location: trail.region || 'Slovenija',
          time: trail.duration || '5h',
          elevation: trail.elevation ? `${trail.elevation} m` : '1000 m',
          distance: trail.distance ? `${trail.distance} km` : '10 km',
          score: 70,
          status: 'DOSTOPNO',
          statusDesc: 'Pot je dostopna',
          statusClass: 'good',
          img: getImageForTrail(trail),
          region: trail.region || 'Slovenija'
        }))
        
        setTrails(processedTrails)
        setError(null)
      } catch (err) {
        console.error('Error fetching trails:', err)
        setError(err.message)
        // Show fallback data if fetch fails
        setTrails([
          {
            id: 1,
            name: 'Triglav (2864 m)',
            location: 'Vrata, Julijske Alpe',
            difficulty: 'lahka',
            diffClass: 'easy',
            region: 'Julijske Alpe',
            time: '6h',
            elevation: '1500 m',
            distance: '12 km',
            score: 85,
            status: 'PRIPOROČENO',
            statusDesc: 'Pot je primerna za vašo pripravljenost in razmere.',
            statusClass: 'good',
            img: triglavImg
          },
          {
            id: 2,
            name: 'Kredarica (2514 m)',
            location: 'Kranjska Gora, Julijske Alpe',
            difficulty: 'srednja',
            diffClass: 'medium',
            region: 'Julijske Alpe',
            time: '5h',
            elevation: '1100 m',
            distance: '9 km',
            score: 65,
            status: 'PREVIDNO',
            statusDesc: 'Mocan veter na vrhu. Priporocamo zgodnji start.',
            statusClass: 'warn',
            img: kredaricaImg
          },
          {
            id: 3,
            name: 'Škrlatica (2740 m)',
            location: 'Vršič, Julijske Alpe',
            difficulty: 'zahtevna',
            diffClass: 'hard',
            region: 'Julijske Alpe',
            time: '7h',
            elevation: '1600 m',
            distance: '14 km',
            score: 25,
            status: 'ODSVETOVANO',
            statusDesc: 'Slabe razmere na visoki nadmorski višini.',
            statusClass: 'bad',
            img: skrlaticaImg
          }
        ])
      } finally {
        setLoading(false)
      }
    }

    fetchTrails()
  }, [])

  const filterTrails = (trailsList) => trailsList.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase())
    const matchDiff = difficulty === 'Vse težavnosti' || t.difficulty === difficulty
    const matchRegion = region === 'Vse regije' || t.region === region
    return matchSearch && matchDiff && matchRegion
  })

  const filteredTrails = filterTrails(trails)
  const recommendedTrails = filteredTrails.slice(0, Math.max(3, Math.floor(filteredTrails.length / 2)))
  const allTrails = filteredTrails.slice(recommendedTrails.length)

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
              <option>lahka</option>
              <option>srednja</option>
              <option>zahtevna</option>
            </select>
            <select className="filter-select" value={region} onChange={e => setRegion(e.target.value)}>
              <option>Vse regije</option>
              <option>Julijske Alpe</option>
              <option>Karavanke</option>
              <option>Kamniško-Savinjske Alpe</option>
              <option>Pohorje</option>
            </select>
            <button className="filter-btn"><LuFilter size="1em" /> Filtri</button>
          </div>
        </div>
      </div>

      <div className="trails-content">
        {loading && <p style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>Nalagam poti...</p>}
        {error && <p style={{ textAlign: 'center', color: '#f44336', padding: '2rem' }}>Napaka: {error}</p>}

        {!loading && (
          <>
            <div className="section-title"><LuStar size="1.1em" color="#8FA998;" /><h2>Priporočene poti</h2></div>
            <div className="recommended-list">
              {recommendedTrails.length === 0 && <p style={{color:'#666'}}>Ni rezultatov.</p>}
              {recommendedTrails.map(trail => (
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

            <div className="section-title" style={{ marginTop: '2rem' }}><span style={{color:'#4caf50'}}>☑</span><h2>Vse poti ({allTrails.length})</h2></div>
            <div className="all-trails-grid">
              {allTrails.length === 0 && <p style={{color:'#666', gridColumn: '1/-1'}}>Ni drugih poti za prikaz.</p>}
              {allTrails.map(trail => (
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
          </>
        )}
      </div>
    </div>
  )
}

export default Trails