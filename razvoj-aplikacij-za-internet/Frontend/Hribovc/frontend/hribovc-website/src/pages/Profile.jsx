import React, { useState, useEffect, useRef } from 'react';
import './Profile.css';

import sloveniaMap from '../assets/Slovenia_silhouette.png'; 
import italiaMap from '../assets/italia_silhueta.png';
import hungaryMap from '../assets/hungary-map-silhouette.png'; 
import austriaMap from '../assets/austria_silhuete.png'; 

import { 
  LuMountain, LuList, LuPlus, LuTrendingUp, LuClock, 
  LuChevronRight, LuChevronLeft, LuCircleCheck, LuTriangleAlert, LuX,
  LuTrash2, LuPencil, LuCheck
} from 'react-icons/lu';

import { MapContainer, TileLayer, Marker, useMap, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const ChangeView = ({ center, zoom = 13 }) => {
  const map = useMap();
  map.setView(center, zoom);
  return null;
};

const MapEvents = ({ isDrawing, setPathPoints }) => {
  useMapEvents({
    click(e) {
      if (isDrawing) {
        const { lat, lng } = e.latlng;
        setPathPoints(prev => [...prev, [lat, lng]]);
      }
    },
  });
  return null;
};

const Profil = () => {
  const [activeTab, setActiveTab] = useState('pregled');
  const [searchQuery, setSearchQuery] = useState('');
  const [mapCenter, setMapCenter] = useState([46.1512, 14.9955]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [pathPoints, setPathPoints] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [tempName, setTempName] = useState("");
  const [draggingPinId, setDraggingPinId] = useState(null);
  const mapRef = useRef(null);

  const [currentCountryIdx, setCurrentCountryIdx] = useState(0);
  const countries = [
    { name: "Slovenija", img: sloveniaMap, key: 'si' },
    { name: "Italija", img: italiaMap, key: 'it' },
    { name: "Avstrija", img: austriaMap, key: 'at' },
    { name: "Madžarska", img: hungaryMap, key: 'hu' }
  ];

  const nextCountry = () => setCurrentCountryIdx((prev) => (prev + 1) % countries.length);
  const prevCountry = () => setCurrentCountryIdx((prev) => (prev - 1 + countries.length) % countries.length);

  const [dosezeniVrhovi, setDosezeniVrhovi] = useState(() => {
    const saved = localStorage.getItem('pini_silhuete');
    return saved ? JSON.parse(saved) : [];
  });

  const [vsiPohodi, setVsiPohodi] = useState(() => {
    const saved = localStorage.getItem('moje_poti');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('moje_poti', JSON.stringify(vsiPohodi));
    localStorage.setItem('pini_silhuete', JSON.stringify(dosezeniVrhovi));
  }, [vsiPohodi, dosezeniVrhovi]);

  const handleAddPin = (e) => {
    if (draggingPinId !== null) return;
    const rect = e.target.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const ime = window.prompt("Ime doseženega vrha:");
    if (ime) {
      setDosezeniVrhovi([...dosezeniVrhovi, { id: Date.now(), countryKey: countries[currentCountryIdx].key, x, y, ime }]);
    }
  };

  const removePin = (e, id) => {
    e.stopPropagation();
    setDosezeniVrhovi(dosezeniVrhovi.filter(v => v.id !== id));
  };

  const handleMouseDown = (e, id) => {
    e.stopPropagation();
    setDraggingPinId(id);
  };

  const handleMouseMove = (e) => {
    if (draggingPinId === null || !mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));
    setDosezeniVrhovi(prev => prev.map(v => v.id === draggingPinId ? { ...v, x, y } : v));
  };

  const handleMouseUp = () => {
    setDraggingPinId(null);
  };

  const handleSearch = async (e) => {
    if (e.key === 'Enter' && searchQuery) {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${searchQuery}`);
        const data = await res.json();
        if (data && data.length > 0) {
          const newPos = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
          setMapCenter(newPos);
        }
      } catch (err) { console.error(err); }
    }
  };

  const handleSaveRoute = () => {
    if (pathPoints.length === 0) return;
    const novPohod = {
      id: Date.now(),
      ime: searchQuery || "Nova pot",
      datum: new Date().toLocaleDateString('sl-SI'),
      cas: "Neznano",
      status: "Načrtovano",
      tip: "success",
      slika: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=150&q=80",
      koordinate: pathPoints
    };
    setVsiPohodi([novPohod, ...vsiPohodi]);
    setPathPoints([]);
    setIsDrawing(false);
    setActiveTab('seznami');
  };

  return (
    <div className="profile-page" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      {selectedRoute && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: '#fff', width: '90%', height: '80vh', borderRadius: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <button onClick={() => setSelectedRoute(null)} style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10001, background: '#111', color: '#fff', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer' }}><LuX size={24} /></button>
            <div style={{ padding: '25px', color: '#111' }}><h2>{selectedRoute.ime}</h2></div>
            <div style={{ flex: 1 }}>
              <MapContainer center={selectedRoute.koordinate[0]} zoom={12} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Polyline positions={selectedRoute.koordinate} color="#ff6b35" weight={6} />
                <ChangeView center={selectedRoute.koordinate[0]} />
              </MapContainer>
            </div>
          </div>
        </div>
      )}

      <div className="profile-hero">
        <div className="hero-text-container">
          <h1>MOJ PROFIL</h1>
          <p>Upravljaj svoje podatke in spremljaj svoj napredek.</p>
        </div>
      </div>

      <div className="profile-layout-container">
        <aside className="profile-sidebar">
          <div className="sidebar-content-wrapper">
            <div className="avatar-circle-huge"><LuMountain size={100} color="#ff6b35" /></div>
            <div className="user-basic-info">
              <h2>User name</h2>
              <p className="location-text">Njegovo prebivalisce</p>
              <p className="member-since">Od kdaj je član</p>
            </div>
            <nav className="sidebar-nav">
              <button className={`nav-btn ${activeTab === 'pregled' ? 'active' : ''}`} onClick={() => setActiveTab('pregled')}><LuTrendingUp size={20} /> Statistika</button>
              <button className={`nav-btn ${activeTab === 'seznami' ? 'active' : ''}`} onClick={() => setActiveTab('seznami')}><LuList size={20} /> Seznami</button>
              <button className={`nav-btn ${activeTab === 'dodaj' ? 'active' : ''}`} onClick={() => setActiveTab('dodaj')}><LuPlus size={20} /> Dodaj pot</button>
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
                     <button onClick={() => setActiveTab('seznami')} className="view-all-link" style={{background:'none', border:'none', cursor:'pointer'}}>Prikaži vse <LuChevronRight size={16} /></button>
                   </div>
                   <div className="hikes-list">
                    {vsiPohodi.slice(0, 3).map(p => (
                      <div key={p.id} className="hike-item" onClick={() => setSelectedRoute(p)} style={{cursor:'pointer'}}>
                        <img src={p.slika} className="hike-thumb" />
                        <div className="hike-main-info"><h4>{p.ime}</h4><span>{p.datum}</span></div>
                        <div className="hike-stats"><div className="stat"><LuClock size={16} /> {p.cas}</div></div>
                        <div className={`status-badge success`}>{p.status}</div>
                      </div>
                    ))}
                   </div>
                </div>

                <div className="map-section">
                  <div className="section-header">
                    <div className="title-with-icon">
                      <LuMountain color="#8FA998" />
                      <h3>Zemljevid vzponov</h3>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '30px', margin: '20px 0' }}>
                    <LuChevronLeft size={35} cursor="pointer" color="#ff6b35" onClick={prevCountry} />
                    <h4 style={{ minWidth: '120px', textAlign: 'center', fontSize: '1.2rem' }}>{countries[currentCountryIdx].name}</h4>
                    <LuChevronRight size={35} cursor="pointer" color="#ff6b35" onClick={nextCountry} />
                  </div>
                  
                  <div className="map-viz-container" ref={mapRef} style={{ position: 'relative', userSelect: 'none' }}>
                    <img 
                      src={countries[currentCountryIdx].img} 
                      alt="Zemljevid" 
                      className="slovenia-map-img" 
                      onClick={handleAddPin}
                      onDragStart={(e) => e.preventDefault()}
                      style={{ 
                        cursor: 'crosshair', 
                        filter: 'brightness(0) saturate(100%) invert(73%) sepia(9%) saturate(543%) hue-rotate(85deg) brightness(91%) contrast(85%)'
                      }} 
                    />
                    <div className="map-overlay">
                      {dosezeniVrhovi
                        .filter(v => v.countryKey === countries[currentCountryIdx].key)
                        .map(vrh => (
                          <div 
                            key={vrh.id} 
                            className="marker-static" 
                            style={{ 
                              top: `${vrh.y}%`, 
                              left: `${vrh.x}%`, 
                              pointerEvents: 'auto',
                              position: 'absolute',
                              transform: 'translate(-50%, -50%)',
                              cursor: draggingPinId === vrh.id ? 'grabbing' : 'grab'
                            }}
                            onMouseDown={(e) => handleMouseDown(e, vrh.id)}
                            onContextMenu={(e) => { e.preventDefault(); removePin(e, vrh.id); }}
                          >
                            <div className="marker" style={{ width: '12px', height: '12px', background: '#ff6b35', borderRadius: '50%', boxShadow: '0 0 10px #ff6b35' }}>
                              <div className="marker-pulse"></div>
                            </div>
                            <span style={{ position: 'absolute', top: '15px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.8)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', whiteSpace: 'nowrap', border: '1px solid #ff6b35', color: '#fff', pointerEvents: 'none' }}>
                              {vrh.ime}
                            </span>
                          </div>
                      ))}
                    </div>
                  </div>
                  <p style={{textAlign:'center', color:'#888', fontSize:'0.8rem', marginTop:'15px'}}>Klikni za dodajanje vrha. Povleci pin za prestavljanje. Desni klik za brisanje.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'seznami' && (
            <div className="dashboard-view">
              <div className="recent-hikes-section">
                <div className="section-header">
                  <div className="title-with-icon"><LuList color="#8FA998" size={24} /><h3>Moji seznami / Vse poti</h3></div>
                </div>
                <div className="hikes-list">
                  {vsiPohodi.map(p => (
                    <div key={p.id} className="hike-item" onClick={() => setSelectedRoute(p)} style={{cursor: 'pointer'}}>
                      <img src={p.slika} className="hike-thumb" />
                      <div className="hike-main-info">
                        {editingId === p.id ? (
                          <div onClick={e => e.stopPropagation()} style={{display:'flex', gap:'5px'}}>
                            <input autoFocus value={tempName} onChange={e=>setTempName(e.target.value)} style={{background:'#222', color:'#fff', border:'1px solid #ff6b35', borderRadius:'5px'}} />
                            <button onClick={(e) => { e.stopPropagation(); setVsiPohodi(vsiPohodi.map(x => x.id === p.id ? {...x, ime: tempName} : x)); setEditingId(null); }} style={{background:'#ff6b35', border:'none', borderRadius:'5px'}}><LuCheck/></button>
                          </div>
                        ) : ( <h4>{p.ime}</h4> )}
                        <span>{p.datum}</span>
                      </div>
                      <div className="hike-stats">
                        <LuPencil onClick={(e) => { e.stopPropagation(); setEditingId(p.id); setTempName(p.ime); }} style={{marginRight:'15px', cursor:'pointer'}} />
                        <LuTrash2 color="#ff4d4d" onClick={(e) => { e.stopPropagation(); if(window.confirm("Izbrišem?")) setVsiPohodi(vsiPohodi.filter(x => x.id !== p.id)); }} style={{cursor:'pointer'}} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'dodaj' && (
            <div className="map-editor-container">
              <div className="editor-sidebar">
                <div className="editor-group">
                  <h3>Find the starting location</h3>
                  <input className="editor-input" placeholder="Vnesi kraj ali koordinate..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} onKeyDown={handleSearch} />
                </div>
                <div className="editor-group">
                  <h3>Draw the route</h3>
                  <div className="btn-row">
                    <button className="editor-small-btn" onClick={() => setPathPoints([])}>Reset</button>
                    <button className={`editor-small-btn ${isDrawing ? 'active-draw' : ''}`} onClick={() => setIsDrawing(!isDrawing)}>{isDrawing ? "Zaključi" : "Riši"}</button>
                  </div>
                </div>
                <div className="editor-footer">
                   <div className="footer-btns">
                      <button className="cancel-btn" onClick={() => setActiveTab('pregled')}>Prekliči</button>
                      <button className="save-btn" onClick={handleSaveRoute}>Shrani</button>
                   </div>
                </div>
              </div>
              <div className="editor-map-area">
                <MapContainer center={mapCenter} zoom={8} style={{ height: '100%', width: '100%' }}>
                  <ChangeView center={mapCenter} zoom={13} />
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapEvents isDrawing={isDrawing} setPathPoints={setPathPoints} />
                  <Polyline positions={pathPoints} color="#ff6b35" weight={5} />
                  {pathPoints.map((pos, idx) => <Marker key={`path-${idx}`} position={pos} />)}

                </MapContainer>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Profil;
