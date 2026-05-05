import heroImg from '../assets/hero.jpg'
import './Home.css'
import { LuCloudSun, LuMap, LuActivity } from 'react-icons/lu'

function Home() {
  return (
    <div className="home">
      <section className="hero">
        <img src={heroImg} alt="Gorski pohod" className="hero-bg" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <h1>Hribovc</h1>
          <p>Inteligentni načrtovalec varnih in zdravih vzponov</p>
          <button className="hero-btn">Začni načrtovati</button>
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

      <a href="/scraper-test.html">
        <button type="button">Open scraper test page</button>
      </a>
    </div>
  )
}

export default Home
