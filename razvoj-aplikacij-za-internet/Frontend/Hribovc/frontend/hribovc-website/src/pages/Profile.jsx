import React, { useState, useEffect } from 'react';
import './Profile.css';

import { 
  LuMountain, LuList, LuPlus, LuTrendingUp, 
  LuClock, LuChevronRight, LuCircleCheck, LuTriangleAlert
} from 'react-icons/lu';

const Profil = () => {
  const [activeTab, setActiveTab] = useState('pregled');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const nedavniPohodi = [
    {
      id: 1,
      ime: "Triglav (2864 m)",
      datum: "14. 5. 2024",
      cas: "6h 12m",
      vzpon: "1.854 m",
      status: "Uspešno zaključen",
      tip: "success",
      slika: "https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?auto=format&fit=crop&w=150&q=80"
    },
    {
      id: 2,
      ime: "Kredarica (2514 m)",
      datum: "5. 5. 2024",
      cas: "3h 45m",
      vzpon: "912 m",
      status: "Prekinjeno",
      tip: "warning",
      slika: "https://images.unsplash.com/photo-1549880338-65ddcdfd017b?auto=format&fit=crop&w=150&q=80"
    },
    {
      id: 3,
      ime: "Šmarna gora (669 m)",
      datum: "28. 4. 2024",
      cas: "1h 20m",
      vzpon: "350 m",
      status: "Uspešno zaključen",
      tip: "success",
      slika: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=150&q=80"
    }
  ];

  return (
    <div className="profile-page">
      <div className="profile-hero">
        <div className="hero-text-container">
          <h1>MOJ PROFIL</h1>
          <p>Upravljaj svoje podatke in spremljaj svoj napredek.</p>
        </div>
      </div>

      <div className="profile-layout-container">
        <aside className="profile-sidebar">
          <div className="sidebar-content-wrapper">
            <div className="avatar-circle-huge">
              <LuMountain size={100} color="#ff6b35" />
            </div>

            <div className="user-basic-info">
              <h2>{user ? user.ime : 'User name'}</h2>
              <p className="location-text">{user ? user.email : 'Njegovo prebivalisce'}</p>
              <p className="member-since">Član od {user ? new Date(user.createdAt).toLocaleDateString('sl-SI') : 'kdaj'}</p>
            </div>

            <nav className="sidebar-nav">
              <button 
                className={`nav-btn ${activeTab === 'pregled' ? 'active' : ''}`}
                onClick={() => setActiveTab('pregled')}
              >
                <LuTrendingUp size={20} /> Statistika
              </button>
              <button 
                className={`nav-btn ${activeTab === 'seznami' ? 'active' : ''}`}
                onClick={() => setActiveTab('seznami')}
              >
                <LuList size={20} /> Seznami
              </button>
              <button className="nav-btn">
                <LuPlus size={20} /> Dodaj pot
              </button>
            </nav>
          </div>
        </aside>

        <main className="profile-main-content">
          {activeTab === 'pregled' && (
            <div className="dashboard-view">
              <div className="dashboard-content-grid">
                
                <div className="recent-hikes-section">
                  <div className="section-header">
                    <div className="title-with-icon">
                      <LuMountain color="#8FA998" />
                      <h3>Nedavni pohodi</h3>
                    </div>
                    <a href="#" className="view-all-link">
                      Prikaži vse <LuChevronRight size={16} />
                    </a>
                  </div>

                  <div className="hikes-list">
                    {nedavniPohodi.map(pohod => (
                      <div key={pohod.id} className="hike-item">
                        <img src={pohod.slika} alt={pohod.ime} className="hike-thumb" />
                        <div className="hike-main-info">
                          <h4>{pohod.ime}</h4>
                          <span>{pohod.datum}</span>
                        </div>
                        <div className="hike-stats">
                          <div className="stat">
                            <LuClock size={16} /> {pohod.cas}
                          </div>
                        </div>
                        <div className={`status-badge ${pohod.tip}`}>
                          {pohod.tip === 'success' ? <LuCircleCheck size={14} /> : <LuTriangleAlert size={14} />}
                          {pohod.status}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="map-section">
                  <div className="section-header">
                    <div className="title-with-icon">
                      <LuMountain color="#8FA998" />
                      <h3>Zemljevid vzponov</h3>
                      <br></br>
                      <p>(Tukaj so prikazani tvoji trenutno doseženi vrhovi)</p>
                    </div>
                  </div>
                  
                  <div className="map-viz-container">
                    <div className="map-placeholder">
                      <LuMountain size={80} color="#8FA998" />
                      <p>Zemljevid bo kmalu dostopen</p>
                    </div>
                    
                    <div className="map-overlay">
                      <div className="marker" style={{ top: '35%', left: '30%' }}>
                        <div className="marker-pulse"></div>
                      </div>
                      <div className="marker" style={{ top: '45%', left: '55%' }}>
                        <div className="marker-pulse"></div>
                      </div>
                      <div className="marker" style={{ top: '65%', left: '45%' }}>
                        <div className="marker-pulse"></div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Profil;