import heroImg from '../assets/hero.jpg'
import { useNavigate } from 'react-router-dom'
import './Home.css'
import 'leaflet/dist/leaflet.css'
import { LuCloudSun, LuMap, LuActivity } from 'react-icons/lu'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import { useState, useEffect } from 'react'
import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
})

function LocationMarker({ position, setPosition }) {
  const map = useMapEvents({
    click() {
      map.locate()
    },
    locationfound(e) {
      setPosition(e.latlng)
      map.flyTo(e.latlng, map.getZoom())
    }
  })

  return position === null ? null : (
    <Marker position={position}>
      <Popup>Vaša lokacija</Popup>
    </Marker>
  )
}

function Home() {
  const navigate = useNavigate()
  const [position, setPosition] = useState(null)
  const mapCenter = [46.1199, 14.4896]

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPosition([pos.coords.latitude, pos.coords.longitude])
        },
        (err) => console.log(err)
      )
    }
  }, [])

  return (
    <div className="home">
      <section className="hero">
        <img src={heroImg} alt="Gorski pohod" className="hero-bg" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <h1>Hribovc</h1>
          <p>Inteligentni načrtovalec varnih in zdravih vzponov</p>
          <button className="hero-btn" onClick={() => navigate('/login')}>
            Začni načrtovati
          </button>
        </div>

        <div className="hero-map-small">
          <MapContainer
            center={mapCenter}
            zoom={10}
            className="small-map"
            zoomControl={false}
            attributionControl={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <LocationMarker position={position} setPosition={setPosition} />
          </MapContainer>
        </div>
      </section>

      <section className="features">
        <div className="feature-card">
          <LuCloudSun size="4em" color="#ff6b35" />
          <h3>Preveri vreme</h3>
          <p>Vremenska napoved po višinah v realnem času</p>
        </div>
        <div className="feature-card">
          <LuMap size="4em" color="#ff6b35" />
          <h3>Izberi pot</h3>
          <p>Stotine označenih poti po vsej Sloveniji</p>
        </div>
        <div className="feature-card">
          <LuActivity size="4em" color="#ff6b35" />
          <h3>Oceni pripravljenost</h3>
          <p>Personalizirana ocena glede na tvojo kondicijo</p>
        </div>
      </section>
    </div>
  )
}

export default Home