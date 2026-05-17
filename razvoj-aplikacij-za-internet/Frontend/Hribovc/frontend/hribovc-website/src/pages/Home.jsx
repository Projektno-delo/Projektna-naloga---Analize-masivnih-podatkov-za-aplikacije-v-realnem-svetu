import React, { useState, useEffect } from 'react'
import heroImg from '../assets/hero.jpg'
import { useNavigate } from 'react-router-dom'
import './Home.css'
import 'leaflet/dist/leaflet.css'
import { 
  LuCloudSun, LuMap, LuNavigation, LuChevronRight, LuX, 
  LuUserPlus, LuLogIn, LuList 
} from 'react-icons/lu'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
})

function LocationMarker({ position, setPosition }) {
  const map = useMapEvents({
    click() { map.locate() },
    locationfound(e) {
      setPosition(e.latlng)
      map.flyTo(e.latlng, map.getZoom())
    }
  })
  return position === null ? null : (
    <Marker position={position}><Popup>Vaša lokacija</Popup></Marker>
  )
}

function Home() {
  const navigate = useNavigate()
  const [position, setPosition] = useState(null)
  const [activeStep, setActiveStep] = useState(null)
  const mapCenter = [46.1199, 14.4896]

  useEffect(() => {
    if (activeStep !== null) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [activeStep])

  const instructions = [
    {
      title: "Registracija",
      desc: "Ustvari si svoj brezplačen račun v nekaj sekundah. Registracija ti omogoča, da varno shranjuješ svoje poti, beležiš statistiko in zbiraš osvojene vrhove na svojem profilu.",
      icon: <LuUserPlus size={120} />,
      path: "/register"
    },
    {
      title: "Prijava",
      desc: "Prijavi se v svoj profil in dostopaj do vseh svojih shranjenih načrtov od koderkoli. Tvoji podatki so sinhronizirani, tako da lahko pot načrtuješ na računalniku, uporabiš pa na telefonu.",
      icon: <LuLogIn size={120} />,
      path: "/login"
    },
    {
      title: "Načrtuj pot",
      desc: "Uporabi naš pametni urejevalnik in si sam nariši svojo unikatno traso. Sistem ti bo sproti računal kilometre in ti pomagal predvideti časovni okvir tvojega pohoda.",
      icon: <LuMap size={120} />,
      path: "/profile"
    },
    {
      title: "Razišči poti",
      desc: "V zavihku 'Poti' najdeš stotine preverjenih planinskih poti po celotni Sloveniji. Preberi opise, preveri težavnost in izberi tisto, ki najbolj ustreza tvoji pripravljenosti.",
      icon: <LuList size={120} />,
      path: "/trails"
    },
    {
      title: "Preveri pogoje",
      desc: "Gore so nepredvidljive. Pred odhodom preveri natančno vremensko napoved za svojo ciljno višino. Naš sistem te bo opozoril na morebitne nevarne pogoje na poti.",
      icon: <LuCloudSun size={120} />,
      path: "/weather"
    },
    {
      title: "Osvoji vrh",
      desc: "Na koncu tvoji dosežki oživijo! Na silhuetah držav označi vrhove, ki si jih že osvojil, in zgradi svojo digitalno zbirko planinskih podvigov.",
      icon: <LuNavigation size={120} />,
      path: "/profile"
    }
  ]

  return (
    <div className="home">
      <section className="hero">
        {activeStep === null ? (
          <>
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
              <MapContainer center={mapCenter} zoom={10} className="small-map" zoomControl={false} attributionControl={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <LocationMarker position={position} setPosition={setPosition} />
              </MapContainer>
            </div>
          </>
        ) : (
          <div className="tutorial-view">
            <button className="close-tutorial" onClick={() => setActiveStep(null)}><LuX size={24} /> Nazaj na domov</button>
            <div className="tutorial-layout">
              <div className="tutorial-icon-side">{instructions[activeStep].icon}</div>
              <div className="tutorial-text-side">
                <h2>{instructions[activeStep].title}</h2>
                <p>{instructions[activeStep].desc}</p>
                <button className="hero-btn small" onClick={() => navigate(instructions[activeStep].path)}>Preizkusi zdaj</button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="workflow-section">
        <div className="workflow-header">
          <h2>Kako deluje HRIBOVC?</h2>
          <p>Klikni na spodnje ikone in poglej kaj vse lahko počneš na naši spletni strani</p>
        </div>

        <div className="workflow-nav">
          {instructions.map((instr, idx) => (
            <React.Fragment key={idx}>
              <div 
                className={`nav-item ${activeStep === idx ? 'active' : ''}`} 
                onClick={() => setActiveStep(idx)}
              >
                {idx === 0 && <LuUserPlus size={40} />}
                {idx === 1 && <LuLogIn size={40} />}
                {idx === 2 && <LuMap size={40} />}
                {idx === 3 && <LuList size={40} />}
                {idx === 4 && <LuCloudSun size={40} />}
                {idx === 5 && <LuNavigation size={40} />}
                <h3>{instr.title}</h3>
              </div>
              {idx < instructions.length - 1 && (
                <div className="workflow-arrow"><LuChevronRight size={30} /></div>
              )}
            </React.Fragment>
          ))}
        </div>
      </section>
    </div>
  )
}

export default Home