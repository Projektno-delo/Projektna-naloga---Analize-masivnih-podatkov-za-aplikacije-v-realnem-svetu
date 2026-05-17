import React, { useState, useEffect, useRef } from 'react';
import './Profile.css';

import sloveniaMap from '../assets/Slovenia_silhouette.png'; 
import italiaMap from '../assets/italia_silhueta.png';
import hungaryMap from '../assets/hungary-map-silhouette.png'; 
import austriaMap from '../assets/austria_silhuete.png'; 

import { 
  LuMountain, LuList, LuPlus, LuTrendingUp, LuClock, 
  LuChevronRight, LuChevronLeft, LuX,
  LuTrash2, LuPencil, LuCheck, LuNavigation, LuNavigation2
} from 'react-icons/lu';

import { MapContainer, TileLayer, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';

const ChangeView = ({ center, zoom = 13 }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

const GeomanController = ({ isDrawing, onRouteCreated }) => {
  const map = useMap();
  useEffect(() => {
    if (!map.pm) return;
    map.pm.setGlobalOptions({ 
      snappable: true, 
      snapDistance: 20,
      pathOptions: { color: '#ff6b35', weight: 5 }
    });
    map.on('pm:create', (e) => {
      if (e.shape === 'Line') {
        e.layer.pm.enable();
        onRouteCreated(e.layer);
      }
    });
    return () => map.off('pm:create');
  }, [map, onRouteCreated]);

  useEffect(() => {
    if (isDrawing) map.pm.enableDraw('Line');
    else map.pm.disableDraw();
  }, [isDrawing, map]);

  return null;
};

const Profil = () => {
  const [activeTab, setActiveTab] = useState('pregled');
  const [searchQuery, setSearchQuery] = useState('');
  const [mapCenter, setMapCenter] = useState([46.1512, 14.9955]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeLayer, setActiveLayer] = useState(null);
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

  const [dosezeniVrhovi, setDosezeniVrhovi] = useState(() => JSON.parse(localStorage.getItem('pini_silhuete')) || []);
  const [vsiPohodi, setVsiPohodi] = useState(() => JSON.parse(localStorage.getItem('moje_poti')) || []);

  useEffect(() => {
    localStorage.setItem('moje_poti', JSON.stringify(vsiPohodi));
    localStorage.setItem('pini_silhuete', JSON.stringify(dosezeniVrhovi));
  }, [vsiPohodi, dosezeniVrhovi]);

  const calculateDistance = (coords) => {
    let total = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      total += L.latLng(coords[i]).distanceTo(L.latLng(coords[i+1]));
    }
    return (total / 1000).toFixed(2);
  };

  const openInGoogleMaps = (route) => {
    const coords = route.koordinate;
    const origin = `${coords[0][0]},${coords[0][1]}`;
    const destination = `${coords[coords.length-1][0]},${coords[coords.length-1][1]}`;
    const waypoints = coords.slice(1, -1).map(c => `${c[0]},${c[1]}`).join('|');
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=walking`;
    window.open(url, '_blank');
  };

  const handleSaveRoute = () => {
    if (!activeLayer) return;
    const coords = activeLayer.getLatLngs().map(ll => [ll.lat, ll.lng]);
    const dist = calculateDistance(coords);
    const novPohod = {
      id: Date.now(),
      ime: searchQuery || "Nova pot",
      datum: new Date().toLocaleDateString('sl-SI'),
      razdalja: dist,
      slika: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=150&q=80",
      koordinate: coords
    };
    setVsiPohodi([novPohod, ...vsiPohodi]);
    activeLayer.remove();
    setActiveLayer(null);
    setIsDrawing(false);
    setActiveTab('seznami');
  };

  const handleSearch = async (e) => {
    if (e.key === 'Enter' && searchQuery) {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${searchQuery}`);
      const data = await res.json();
      if (data?.[0]) setMapCenter([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
    }
  };

  return (
    <div className="profile-page" onMouseMove={(e) => {
      if (draggingPinId && mapRef.current) {
        const rect = mapRef.current.getBoundingClientRect();
        let x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        let y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
        setDosezeniVrhovi(prev => prev.map(v => v.id === draggingPinId ? { ...v, x, y } : v));
      }
    }} onMouseUp={() => setDraggingPinId(null)}>
      
      {selectedRoute && (
        <div className="route-modal-overlay">
          <div className="route-modal">
            <button className="close-modal" onClick={() => setSelectedRoute(null)}><LuX size={24} /></button>
            <div className="modal-header">
              <h2>{selectedRoute.ime}</h2>
              <div className="modal-stats">
                <span><LuTrendingUp size={16}/> {selectedRoute.razdalja} km</span>
                <button className="nav-google-btn" onClick={() => openInGoogleMaps(selectedRoute)}>
                  <LuNavigation size={18} /> Navigiraj (GPS)
                </button>
              </div>
            </div>
            <div className="modal-map-container">
              <MapContainer center={selectedRoute.koordinate[0]} zoom={14} style={{ height: '100%', width: '100%' }}>
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
          <p>Sledi svojim potem in razdaljam.</p>
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
                   <div className="section-header"><h3>Nedavni pohodi</h3></div>
                   <div className="hikes-list">
                    {vsiPohodi.slice(0, 3).map(p => (
                      <div key={p.id} className="hike-item" onClick={() => setSelectedRoute(p)}>
                        <img src={p.slika} alt="" className="hike-thumb" />
                        <div className="hike-main-info"><h4>{p.ime}</h4><span>{p.datum}</span></div>
                        <div className="hike-stats"><div className="stat"><LuTrendingUp size={16} /> {p.razdalja} km</div></div>
                        <div className="status-badge success">Shranjeno</div>
                      </div>
                    ))}
                   </div>
                </div>

                <div className="map-section">
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '30px', margin: '20px 0' }}>
                    <LuChevronLeft size={35} cursor="pointer" color="#ff6b35" onClick={prevCountry} />
                    <h4>{countries[currentCountryIdx].name}</h4>
                    <LuChevronRight size={35} cursor="pointer" color="#ff6b35" onClick={nextCountry} />
                  </div>
                  <div className="map-viz-container" ref={mapRef}>
                    <img src={countries[currentCountryIdx].img} alt="" className="slovenia-map-img" onClick={(e) => {
                       const rect = e.target.getBoundingClientRect();
                       const x = ((e.clientX - rect.left) / rect.width) * 100;
                       const y = ((e.clientY - rect.top) / rect.height) * 100;
                       const ime = window.prompt("Ime vrha:");
                       if (ime) setDosezeniVrhovi([...dosezeniVrhovi, { id: Date.now(), countryKey: countries[currentCountryIdx].key, x, y, ime }]);
                    }} style={{ cursor: 'crosshair', filter: 'brightness(0) saturate(100%) invert(73%) sepia(9%) saturate(543%) hue-rotate(85deg) brightness(91%) contrast(85%)' }} />
                    <div className="map-overlay">
                      {dosezeniVrhovi.filter(v => v.countryKey === countries[currentCountryIdx].key).map(vrh => (
                        <div key={vrh.id} className="marker-static" style={{ top: `${vrh.y}%`, left: `${vrh.x}%`, position: 'absolute', transform: 'translate(-50%, -50%)' }} onMouseDown={() => setDraggingPinId(vrh.id)} onContextMenu={(e) => { e.preventDefault(); setDosezeniVrhovi(dosezeniVrhovi.filter(v => v.id !== vrh.id)); }}>
                          <div className="marker"><div className="marker-pulse"></div></div>
                          <span className="marker-label">{vrh.ime}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'seznami' && (
            <div className="recent-hikes-section">
              <div className="hikes-list">
                {vsiPohodi.map(p => (
                  <div key={p.id} className="hike-item" onClick={() => setSelectedRoute(p)}>
                    <img src={p.slika} alt="" className="hike-thumb" />
                    <div className="hike-main-info"><h4>{p.ime}</h4><span>{p.datum} - {p.razdalja} km</span></div>
                    <div className="hike-stats">
                      <LuTrash2 color="#ff4d4d" onClick={(e) => { e.stopPropagation(); if(window.confirm("Izbrišem?")) setVsiPohodi(vsiPohodi.filter(x => x.id !== p.id)); }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'dodaj' && (
            <div className="map-editor-container">
              <div className="editor-sidebar">
                <h3>Išči lokacijo</h3>
                <input className="editor-input" placeholder="Vnesi kraj..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} onKeyDown={handleSearch} />
                <h3>Nariši pot</h3>
                <div className="btn-row">
                  <button className="editor-small-btn" onClick={() => { if(activeLayer) activeLayer.remove(); setActiveLayer(null); }}>Reset</button>
                  <button className={`editor-small-btn ${isDrawing ? 'active-draw' : ''}`} onClick={() => setIsDrawing(!isDrawing)}>{isDrawing ? "Končaj" : "Začni risati"}</button>
                </div>
                <div className="editor-footer"><button className="save-btn" onClick={handleSaveRoute}>Shrani pot</button></div>
              </div>
              <div className="editor-map-area">
                <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
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
