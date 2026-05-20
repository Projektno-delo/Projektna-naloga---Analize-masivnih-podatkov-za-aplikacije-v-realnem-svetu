import React, { useState, useEffect } from 'react'
import heroImg from '../assets/hero.jpg'
import { useNavigate } from 'react-router-dom'
import './Home.css'
import { 
  LuCloudSun, LuMap, LuNavigation, LuChevronRight, LuX, 
  LuUserPlus, LuLogIn, LuList 
} from 'react-icons/lu'

function Home() {
  const navigate = useNavigate()
  const [activeStep, setActiveStep] = useState(null)

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
      desc: "V zavihku 'Dodaj pot' s preprostim klikanjem na zemljevid izriši svojo traso. Mi ti sproti izračunamo kilometre, ti pa svojo novo avanturo le še shraniš v osebni seznam.",
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
      desc: "Pred odhodom preveri vremensko napoved za točno določeno lokacijo. Naša inteligentna napoved upošteva nadmorsko višino in ti svetuje o primernosti vzpona glede na trenutne razmere.",
      icon: <LuCloudSun size={120} />,
      path: "/weather"
    },
    {
      title: "Osvoji vrh",
      desc: "V zavihku 'Statistika' tvoji dosežki oživijo. Na silhuetah držav s klikom dodajaj oznake za vrhove, ki si jih že osvojil, in spremljaj svojo rastočo zbirko gorskih podvigov.",
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
            {/* Tukaj je bil hero-map-small, ki smo ga odstranili */}
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