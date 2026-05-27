import './Trails.css'
import { useState, useEffect, useRef } from 'react'
import { LuSearch, LuMapPin, LuClock, LuMountain, LuRoute, LuStar, LuFilter, LuHeartPulse } from 'react-icons/lu'

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

const parseNumber = (value) => {
  const number = parseFloat(String(value || '').replace(',', '.'))
  return Number.isFinite(number) ? number : null
}

const parseHours = (value) => {
  const text = String(value || '').toLowerCase().replace(',', '.')
  const hours = text.match(/(\d+(?:\.\d+)?)\s*h/)
  const minutes = text.match(/(\d+)\s*min/)

  if (hours) {
    return Number(hours[1]) + (minutes ? Number(minutes[1]) / 60 : 0)
  }

  return parseNumber(text)
}

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user')) || {}
  } catch {
    return {}
  }
}

const fieldValue = (value) => value ?? ''

const normalizeHealthProfile = (profile = {}, user = {}) => ({
  bmi: fieldValue(profile.bmi ?? user.bmi),
  age: fieldValue(profile.age ?? user.starost),
  height: fieldValue(profile.height ?? user.visina),
  weight: fieldValue(profile.weight ?? user.teza),
  smoker: profile.smoker ?? 'no',
  activity: profile.activity ?? 'medium',
  condition: profile.condition ?? 'none',
})

const readStoredHealthProfile = () => {
  const user = readStoredUser()

  try {
    const stored = JSON.parse(localStorage.getItem('healthProfile')) || {}
    return normalizeHealthProfile({ ...(user.healthProfile || {}), ...stored }, user)
  } catch {
    return normalizeHealthProfile(user.healthProfile, user)
  }
}

const calculateBmiValue = (height, weight) => {
  const heightCm = parseNumber(height)
  const weightKg = parseNumber(weight)

  if (!heightCm || !weightKg) {
    return null
  }

  const heightM = heightCm / 100
  return Number((weightKg / (heightM * heightM)).toFixed(1))
}

const buildRecommendationText = (reasons, statusClass) => {
  if (reasons.length > 0) {
    return reasons.slice(0, 2).join(' ')
  }

  if (statusClass === 'good') {
    return 'Pot ustreza vnesenim zdravstvenim podatkom.'
  }

  return 'Prilagodi tempo in preveri razmere pred odhodom.'
}

const getHealthRecommendation = (trail, healthProfile) => {
  const bmi = parseNumber(healthProfile.bmi)
  const age = parseNumber(healthProfile.age)
  const distanceKm = parseNumber(trail.distance)
  const elevationM = parseNumber(trail.elevation)
  const hours = parseHours(trail.time || trail.duration)
  const difficulty = String(trail.difficulty || '').toLowerCase()

  let penalty = 0
  const reasons = []

  if (difficulty.includes('zelo')) {
    penalty += 30
    reasons.push('Zelo zahtevna pot zahteva dobro pripravljenost.')
  } else if (difficulty.includes('zahtevna')) {
    penalty += 22
    reasons.push('Zahtevna pot poveca obremenitev.')
  } else if (difficulty.includes('sred')) {
    penalty += 10
  }

  if (distanceKm >= 14) {
    penalty += 14
    reasons.push('Dolga razdalja zahteva vec energije.')
  } else if (distanceKm >= 9) {
    penalty += 8
  }

  if (elevationM >= 1400) {
    penalty += 14
    reasons.push('Velika visinska razlika dodatno obremeni telo.')
  } else if (elevationM >= 900) {
    penalty += 8
  }

  if (hours >= 7) {
    penalty += 12
  } else if (hours >= 5) {
    penalty += 7
  }

  if (bmi !== null) {
    if (bmi >= 35) {
      penalty += 24
      reasons.push('Visok BMI pomeni vecjo obremenitev sklepov in srca.')
    } else if (bmi >= 30) {
      penalty += 16
      reasons.push('Visji BMI klice po zmernejsem tempu.')
    } else if (bmi >= 25 || bmi < 18.5) {
      penalty += 7
    }
  }

  if (age !== null) {
    if (age >= 70) {
      penalty += 18
      reasons.push('Pri visji starosti je priporocen krajsi vzpon.')
    } else if (age >= 60) {
      penalty += 10
    }
  }

  if (healthProfile.smoker === 'yes') {
    penalty += 12
    reasons.push('Kajenje lahko zmanjsa vzdrzljivost pri vzponu.')
  }

  if (healthProfile.condition === 'heart') {
    penalty += 28
    reasons.push('Pri srcno-zilnih tezavah izberi lazjo pot.')
  } else if (healthProfile.condition === 'lungs') {
    penalty += 22
    reasons.push('Dihalne tezave lahko otezijo vzpon.')
  } else if (healthProfile.condition === 'joints') {
    penalty += 16
    reasons.push('Tezave s sklepi so pomembne pri spustu.')
  }

  if (healthProfile.activity === 'low') {
    penalty += 18
    reasons.push('Nizka aktivnost pomeni vec postopnosti.')
  } else if (healthProfile.activity === 'high') {
    penalty -= 8
  }

  const score = Math.max(15, Math.min(95, Math.round(100 - penalty)))
  const statusClass = score >= 72 ? 'good' : score >= 45 ? 'warn' : 'bad'
  const status = statusClass === 'good' ? 'PRIPOROCENO' : statusClass === 'warn' ? 'PREVIDNO' : 'ODSVETOVANO'

  return {
    score,
    status,
    statusClass,
    statusDesc: buildRecommendationText(reasons, statusClass),
  }
}

function Trails() {
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState('Vse težavnosti')
  const [region, setRegion] = useState('Vse regije')
  const [trails, setTrails] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentUser, setCurrentUser] = useState(readStoredUser)
  const [healthProfile, setHealthProfile] = useState(readStoredHealthProfile)
  const [saveStatus, setSaveStatus] = useState('')
  const syncReady = useRef(false)

  useEffect(() => {
    localStorage.setItem('healthProfile', JSON.stringify(healthProfile))

    if (!syncReady.current || !currentUser?._id) {
      return
    }

    setSaveStatus('Shranjujem...')

    const timer = setTimeout(async () => {
      try {
        const response = await fetch('http://localhost:3000/health-profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: currentUser._id,
            healthProfile,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Napaka pri shranjevanju')
        }

        localStorage.setItem('healthProfile', JSON.stringify(data.healthProfile))

        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user))
          setCurrentUser(data.user)
        }

        setSaveStatus('Shranjeno')
      } catch (error) {
        console.error('Health profile save error:', error)
        setSaveStatus('Shranjeno lokalno')
      }
    }, 600)

    return () => clearTimeout(timer)
  }, [healthProfile, currentUser?._id])

  useEffect(() => {
    if (!currentUser?._id) {
      syncReady.current = true
      return
    }

    let isActive = true

    const fetchHealthProfile = async () => {
      try {
        const response = await fetch(`http://localhost:3000/health-profile?userId=${currentUser._id}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Napaka pri branju zdravstvenih podatkov')
        }

        if (!isActive) return

        const nextHealthProfile = normalizeHealthProfile(data.healthProfile, data.user)
        localStorage.setItem('healthProfile', JSON.stringify(nextHealthProfile))
        setHealthProfile(nextHealthProfile)

        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user))
          setCurrentUser(data.user)
        }
      } catch (error) {
        console.error('Health profile load error:', error)
      } finally {
        syncReady.current = true
      }
    }

    fetchHealthProfile()

    return () => {
      isActive = false
    }
  }, [currentUser?._id])

  const updateHealthProfile = (field, value) => {
    setHealthProfile(prev => {
      const next = {
        ...prev,
        [field]: value,
      }
      const calculatedBmi = calculateBmiValue(next.height, next.weight)

      if ((field === 'height' || field === 'weight') && calculatedBmi) {
        next.bmi = String(calculatedBmi)
      }

      return next
    })
  }

  const calculateBmi = () => {
    const calculatedBmi = calculateBmiValue(healthProfile.height, healthProfile.weight)

    if (calculatedBmi) {
      updateHealthProfile('bmi', String(calculatedBmi))
    }
  }

  // Fetch trails from API
  useEffect(() => {
    const fetchTrails = async () => {
      try {
        setLoading(true)
        const response = await fetch('http://localhost:3000/trails')
        if (!response.ok) throw new Error('Napaka pri pridobivanju poti')
        const data = await response.json()
        
        // Process trails and add default values
        const processedTrails = data.map((trail, idx) => {
          const rawDifficulty = trail.difficulty?.toLowerCase() || 'srednje';
          let difficulty = 'srednja';
          if (rawDifficulty.includes('lahka')) difficulty = 'lahka';
          if (rawDifficulty.includes('zahtevna')) difficulty = 'zahtevna';
          if (rawDifficulty.includes('zelo zahtevna')) difficulty = 'zelo zahtevna';

          return {
            ...trail,
            id: trail._id || idx,
            difficulty: difficulty,
            diffClass: getDifficultyClass(rawDifficulty),
            location: trail.mountain ? `${trail.mountain}, ${trail.region}` : trail.region || 'Slovenija',
            time: trail.duration || 'N/A',
            elevation: trail.elevation ? (trail.elevation.includes('m') ? trail.elevation : `${trail.elevation} m`) : 'N/A',
            distance: trail.distance ? (trail.distance.includes('km') ? trail.distance : `${trail.distance} km`) : 'N/A',
            img: getImageForTrail(trail),
            region: trail.region || 'Slovenija'
          };
        })
        
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

  const analyzedTrails = trails.map(trail => ({
    ...trail,
    ...getHealthRecommendation(trail, healthProfile),
  }))
  const filteredTrails = filterTrails(analyzedTrails)
  const recommendedTrails = [...filteredTrails]
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(3, filteredTrails.length))
  const recommendedIds = new Set(recommendedTrails.map(trail => trail.id))
  const allTrails = filteredTrails.filter(trail => !recommendedIds.has(trail.id))

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
        <section className="health-panel">
          <div className="health-panel-title">
            <LuHeartPulse size="1.2em" />
            <div>
              <h2>Zdravstveni podatki</h2>
              <p>{currentUser?._id ? (saveStatus || 'Shranjeno v profilu') : 'Shranjeno v brskalniku'}</p>
            </div>
          </div>

          <div className="health-fields">
            <label className="health-field">
              <span>Visina (cm)</span>
              <input
                type="number"
                min="80"
                max="230"
                placeholder="175"
                value={healthProfile.height}
                onChange={e => updateHealthProfile('height', e.target.value)}
              />
            </label>

            <label className="health-field">
              <span>Teza (kg)</span>
              <input
                type="number"
                min="25"
                max="250"
                placeholder="72"
                value={healthProfile.weight}
                onChange={e => updateHealthProfile('weight', e.target.value)}
              />
            </label>

            <label className="health-field">
              <span>BMI</span>
              <input
                type="number"
                step="0.1"
                min="10"
                max="60"
                placeholder="24.5"
                value={healthProfile.bmi}
                onChange={e => updateHealthProfile('bmi', e.target.value)}
              />
            </label>

            <button type="button" className="bmi-calc-btn" onClick={calculateBmi}>
              Izracunaj BMI
            </button>

            <label className="health-field">
              <span>Starost</span>
              <input
                type="number"
                min="1"
                max="120"
                placeholder="32"
                value={healthProfile.age}
                onChange={e => updateHealthProfile('age', e.target.value)}
              />
            </label>

            <label className="health-field">
              <span>Kajenje</span>
              <select value={healthProfile.smoker} onChange={e => updateHealthProfile('smoker', e.target.value)}>
                <option value="no">Ne</option>
                <option value="yes">Da</option>
              </select>
            </label>

            <label className="health-field">
              <span>Aktivnost</span>
              <select value={healthProfile.activity} onChange={e => updateHealthProfile('activity', e.target.value)}>
                <option value="medium">Srednja</option>
                <option value="low">Nizka</option>
                <option value="high">Visoka</option>
              </select>
            </label>

            <label className="health-field health-field-wide">
              <span>Zdravstveno opozorilo</span>
              <select value={healthProfile.condition} onChange={e => updateHealthProfile('condition', e.target.value)}>
                <option value="none">Brez posebnosti</option>
                <option value="heart">Srce in pritisk</option>
                <option value="lungs">Dihanje</option>
                <option value="joints">Sklepi</option>
              </select>
            </label>
          </div>
        </section>

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
              <div className="tip-icon"><LuHeartPulse size="1em" /></div>
              <div className="tip-text">
                <strong>Pametno priporočilo</strong>
                <p>Na podlagi BMI, kajenja, aktivnosti in zdravstvenih opozoril so najprimernejše poti prikazane na vrhu.</p>
              </div>
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
                    <div className={['all-trail-reco', 'status-' + trail.statusClass].join(' ')}>
                      <span>{trail.status}</span>
                      <strong style={{ color: scoreColor(trail.score) }}>{trail.score}</strong>
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
