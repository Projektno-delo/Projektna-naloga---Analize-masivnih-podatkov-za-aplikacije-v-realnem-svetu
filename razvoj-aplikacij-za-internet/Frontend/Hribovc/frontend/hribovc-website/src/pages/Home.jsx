import heroImg from '../assets/hero.jpg'
import { useNavigate } from 'react-router-dom'
import './Home.css'
import { LuCloudSun, LuMap, LuActivity } from 'react-icons/lu'
import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Leaflet marker fix
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIconRetina,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

function ChangeView({ center, zoom }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

function Home() {
  const navigate = useNavigate()
  const [trails, setTrails] = useState([])
  const [selectedTrail, setSelectedTrail] = useState(null)
  const [mapCenter, setMapCenter] = useState([46.0569, 14.5058])

  const regionCoords = {
    'Julijske Alpe': [46.3783, 13.8367],
    'Kamniško-Savinjske Alpe': [46.36, 14.61],
    'Karavanke': [46.43, 14.17],
    'Pohorje': [46.5, 15.5],
    'Škofjeloško, Polhograjsko hribovje in Rovtarsko hribovje': [46.12, 14.21],
    'Dolenjska, Bela krajina in Posavje': [45.81, 15.12],
    'Zasavsko - Posavsko hribovje in Dolenjsko hribovje': [46.11, 15.08],
    'Primorska in Notranjska': [45.7, 14.0],
    'Goriško, Tolminsko in Idrijsko hribovje': [46.1, 13.8]
  }

  useEffect(() => {
    fetch('http://localhost:3000/trails')
      .then(res => res.json())
      .then(data => {
        setTrails(data)
        if (data.length > 0) {
          const first = data[0]
          setSelectedTrail(first)
          updateMap(first)
        }
      })
      .catch(err => console.error('Error fetching trails:', err))
  }, [])

  const updateMap = (trail) => {
    if (!trail) return
    let newCenter = [46.0569, 14.5058]
    if (trail.lat && trail.lon) {
      newCenter = [trail.lat, trail.lon]
    } else {
      // Find region in regionCoords
      const regionMatch = Object.keys(regionCoords).find(key => trail.region && trail.region.includes(key))
      if (regionMatch) {
        newCenter = regionCoords[regionMatch]
      }
    }
    setMapCenter(newCenter)
  }

  const handleTrailChange = (trailName) => {
    const trail = trails.find(t => t.name === trailName)
    setSelectedTrail(trail)
    updateMap(trail)
  }

  return (
    <div className="home">
      <section className="hero">
        <img src={heroImg} alt="Gorski pohod" className="hero-bg" />
        <div className="hero-content">
          <div className="hero-left">
            <h1>Hribovc</h1>
            <p>
              Inteligentni načrtovalec varnih in zdravih vzponov. 
              Implementirajte spletni vmesnik za vizualizacijo podatkov, ki ste jih zajeli v podatkovni bazi. 
              Za vizualizacijo lokacijskih podatkov uporabite OpenStreetMaps.
            </p>
            <button className="hero-btn" onClick={() => navigate('/login')}>Začni načrtovati</button>
          </div>

          <div className="hero-right">
            <div className="hero-trail-selector">
              <select 
                value={selectedTrail?.name || ''} 
                onChange={(e) => handleTrailChange(e.target.value)}
              >
                <option value="" disabled>Izberi pot za vizualizacijo...</option>
                {trails.map(trail => (
                  <option key={trail._id} value={trail.name}>{trail.name}</option>
                ))}
              </select>
            </div>

            <div className="hero-map-container">
              <MapContainer center={mapCenter} zoom={11} scrollWheelZoom={false}>
                <ChangeView center={mapCenter} zoom={11} />
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {selectedTrail && (
                  <Marker position={mapCenter}>
                    <Popup>
                      <strong>{selectedTrail.name}</strong><br />
                      {selectedTrail.region}
                    </Popup>
                  </Marker>
                )}
              </MapContainer>
            </div>

            {selectedTrail && (
              <div className="trail-info-overlay">
                <span>{selectedTrail.elevation}</span>
                <span>•</span>
                <span>{selectedTrail.duration}</span>
                <span>•</span>
                <span>{selectedTrail.difficulty}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="features">        
        <div className="feature-card" onClick={() => navigate('/vreme')}>
          <LuCloudSun className="feature-icon" />
          <h3>Preveri vreme</h3>
          <p>Vremenska napoved po višinah v realnem času</p>
        </div>

        <div className="feature-card" onClick={() => navigate('/poti')}>
          <LuMap className="feature-icon" />
          <h3>Izberi pot</h3>
          <p>Stotine označenih poti po vsej Sloveniji</p>
        </div>

        <div className="feature-card">
          <LuActivity className="feature-icon" />
          <h3>Oceni pripravljenost</h3>
          <p>Personalizirana ocena glede na tvojo kondicijo</p>
        </div>
      </section>
    </div>
  )
}

export default Home


