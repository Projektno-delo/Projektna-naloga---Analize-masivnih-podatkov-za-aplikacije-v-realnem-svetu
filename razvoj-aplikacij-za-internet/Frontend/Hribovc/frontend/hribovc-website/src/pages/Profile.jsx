import React from 'react';
import './Profile.css';
import profileBg from '../assets/ozadje_za_vreme_sreen.png';
import { 
  LuActivity, LuCircleCheck, LuTriangleAlert, LuFlame,
  LuClock, LuMountain, LuUser, LuTrendingUp, LuDroplets, LuSun
} from 'react-icons/lu';

const Profil = () => {
  return (
    <div className="profile-page">
      {/* Hero sekcija z naslovom */}
      <div className="profile-hero">
        <div className="hero-text-container">
          <h1>Moj profil</h1>
          <p>Upravljaj svoje podatke in spremljaj svoj napredek.</p>
        </div>
      </div>

      <div className="profile-container">
        
        {/* Zgornja vrstica: Glavna kartica in Pripravljenost */}
        <div className="profile-header-flex">
          <div className="main-profile-card">
            {/* LEVI DEL: Avatar in Podatki */}
            <div className="profile-main-info">
              <div className="avatar-wrapper">
                <div className="avatar-circle">
                  <LuMountain size={40} color="#666" /> 
                </div>
                <div className="camera-badge-orange">
                  <LuSun size={12} color="white" />
                </div>
              </div>

              <div className="profile-details">
                <h2>Anja Novak</h2>
                <div className="meta-info-block">
                  <div className="meta-line">
                    <span>Starost: <strong>24 let</strong></span>
                    <span className="dot">•</span>
                    <span>Ženski</span>
                  </div>
                  <div className="meta-line">
                    <span>BMI: 22.4 (Normalno)</span>
                  </div>
                </div>
                <span className="fitness-pill">DOBRA PRIPRAVLJENOST</span>
              </div>
            </div>

            {/* DESNI DEL: Pripravljenost (ločen s črto) */}
            <div className="readiness-divider-section">
              <div className="readiness-content-row">
                <div className="circular-progress-v2">
                  <div className="inner-circle">
                    78<span>%</span>
                  </div>
                </div>
                <div className="readiness-text-v2">
                  <h3>Pripravljenost</h3>
                  <p>Primerno za srednje zahtevne poti</p>
                  <a href="#" className="analysis-yellow-link">Podrobna analiza &gt;</a>
                </div>
              </div>
            </div>
          </div>
        </div> {/* TUKAJ JE BIL MANJKAJOČI DIV */}

        {/* Mreža s statistikami (4 kartice) */}
        <div className="stats-grid">
          <div className="stat-card">
            <LuMountain className="stat-icon green" />
            <div className="stat-val">12.450 m</div>
            <div className="stat-label">Skupni vzpon</div>
            <div className="trend-badge positive">+850 m ta mesec</div>
          </div>
          <div className="stat-card">
            <LuTrendingUp className="stat-icon green" />
            <div className="stat-val">24</div>
            <div className="stat-label">Opravljeni pohodi</div>
            <div className="trend-badge positive">+3 ta mesec</div>
          </div>
          <div className="stat-card">
            <LuClock className="stat-icon blue" />
            <div className="stat-val">80 h</div>
            <div className="stat-label">Skupni čas hoje</div>
            <div className="trend-badge positive">+8 h ta mesec</div>
          </div>
          <div className="stat-card">
            <LuFlame className="stat-icon orange" />
            <div className="stat-val">2.340 kcal</div>
            <div className="stat-label">Porabljene kalorije</div>
            <div className="trend-badge positive">+210 kcal ta mesec</div>
          </div>
        </div>

        {/* Srednji del: Aktivnost in AI priporočila */}
        <div className="main-content-grid">
          <div className="activity-section">
            <div className="section-header">
              <h3>Nedavna aktivnost</h3>
              <a href="#" className="view-all">Prikaži vse</a>
            </div>
            <div className="activity-list">
              <div className="activity-item">
                <LuCircleCheck className="status-icon success" />
                <div className="act-info">
                  <strong>Triglav (2864 m)</strong>
                  <span className="act-status">Uspešno zaključen</span>
                </div>
                <div className="act-meta">
                  <div className="time">6h 12m</div>
                  <div className="date">14. 5. 2024</div>
                </div>
              </div>
              <div className="activity-item">
                <LuTriangleAlert className="status-icon warning" />
                <div className="act-info">
                  <strong>Kredarica (2514 m)</strong>
                  <span className="act-status">Prekinjeno (slabo vreme)</span>
                </div>
                <div className="act-meta">
                  <div className="time">3h 45m</div>
                  <div className="date">5. 5. 2024</div>
                </div>
              </div>
              <div className="activity-item">
                <LuCircleCheck className="status-icon success" />
                <div className="act-info">
                  <strong>Šmarna gora (669 m)</strong>
                  <span className="act-status">Uspešno zaključen</span>
                </div>
                <div className="act-meta">
                  <div className="time">1h 20m</div>
                  <div className="date">28. 4. 2024</div>
                </div>
              </div>
            </div>
          </div>

          <div className="ai-section">
            <div className="section-header">
              <div className="ai-title-group">
                <LuActivity className="ai-main-icon" />
                <h3>AI priporočila</h3>
              </div>
            </div>
            <div className="ai-list">
              <div className="ai-item">
                <div className="ai-icon-box purple"><LuTrendingUp /></div>
                <div className="ai-text">
                  <h4>Izboljšajte vzdržljivost</h4>
                  <p>Priporočamo več kardio aktivnosti za lažje vzpone.</p>
                </div>
              </div>
              <div className="ai-item">
                <div className="ai-icon-box blue"><LuSun /></div>
                <div className="ai-text">
                  <h4>Pazite na vreme</h4>
                  <p>V vetrovnih dneh se izogibajte visokogorskih tur.</p>
                </div>
              </div>
              <div className="ai-item">
                <div className="ai-icon-box cyan"><LuDroplets /></div>
                <div className="ai-text">
                  <h4>Hidratacija</h4>
                  <p>Ne pozabite na zadosten vnos tekočine med pohodi.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SPODNJI DEL: GRAF NAPREDKA */}
        <div className="progress-section">
          <div className="chart-wrapper">
            <div className="chart-header-row">
              <div className="chart-icon-small">
                <LuTrendingUp size={16} />
              </div>
              <h3>Vaša pot napredka</h3>
            </div>

            <div className="chart-body">
              <div className="y-axis-labels">
                <span>15k m</span>
                <span>10k</span>
                <span>5k</span>
                <span>0</span>
              </div>

              <div className="chart-visual">
                <div className="svg-container">
                  <svg viewBox="0 0 500 150" preserveAspectRatio="none" className="graph-svg">
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4ade80" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0,130 Q50,120 100,115 T200,95 T300,75 T400,55 T500,20 V150 H0 Z" fill="url(#chartGradient)" />
                    <path d="M0,130 Q50,120 100,115 T200,95 T300,75 T400,55 T500,20" fill="none" stroke="#4ade80" strokeWidth="3" />
                    <circle cx="500" cy="20" r="4" fill="#4ade80" />
                  </svg>
                </div>
                
                <div className="x-axis-months">
                  <span>Dec</span><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>Maj</span>
                </div>
              </div>
            </div>
          </div>

          <div className="next-goal-card">
            <h4>Naslednji cilj</h4>
            <div className="goal-big-number">15.000 m</div>
            <p className="goal-subtext">Do cilja še: <span className="highlight-yellow">2.550 m</span></p>
            
            <div className="goal-progress-row">
              <div className="goal-bar-track">
                <div className="goal-bar-fill" style={{ width: '83%' }}></div>
              </div>
              <span className="goal-percentage-text">83%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profil;