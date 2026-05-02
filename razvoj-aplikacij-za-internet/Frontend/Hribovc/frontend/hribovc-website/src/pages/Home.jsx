import heroImg from '../assets/hero.jpg'
import './Home.css'

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
      <a href="/scraper-test.html">
          <section className="features">
      <div className="feature-card">
        <span className="feature-icon">⛅</span>
        <h3>Preveri vreme</h3>
        <p>Vremenska napoved po višinah v realnem času</p>
      </div>
      <div className="feature-card">
        <span className="feature-icon">🗺️</span>
        <h3>Izberi pot</h3>
        <p>Stotine označenih poti po vsej Sloveniji</p>
      </div>
      <div className="feature-card">
        <span className="feature-icon">💪</span>
        <h3>Oceni pripravljenost</h3>
        <p>Personalizirana ocena glede na tvojo kondicijo</p>
      </div>
    </section>
        <button type="button">Open scraper test page</button>
      </a>
    </div>
  )
}

export default Home