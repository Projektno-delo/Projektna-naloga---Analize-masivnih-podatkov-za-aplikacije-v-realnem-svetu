import React, { useState, useEffect, useRef } from 'react';
import './Profile.css';
import sloveniaMap from '../assets/Slovenia_silhouette.png';
import italiaMap from '../assets/italia_silhueta.png';
import hungaryMap from '../assets/hungary-map-silhouette.png';
import austriaMap from '../assets/austria_silhuete.png';
import { LuMountain, LuList, LuPlus, LuTrendingUp, LuX, LuTrash2, LuPencil, LuCheck, LuChevronLeft, LuChevronRight, LuFootprints, LuBike, LuMapPin, LuRefreshCw } from 'react-icons/lu';
import { MapContainer, TileLayer, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const API_BASE_URL = 'http://localhost:3000';

const readStoredList = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch {
    localStorage.removeItem(key);
    return [];
  }
};

const isValidCoordinate = (lat, lon) => (
  Number.isFinite(lat)
  && Number.isFinite(lon)
  && lat >= -90
  && lat <= 90
  && lon >= -180
  && lon <= 180
);

const cleanPeak = (vrh) => {
  const lat = Number(vrh?.lat);
  const lon = Number(vrh?.lon);

  if (!isValidCoordinate(lat, lon)) {
    return null;
  }

  return {
    ...vrh,
    id: vrh.id || Date.now(),
    ime: vrh.ime || 'Vrh',
    countryKey: vrh.countryKey || 'si',
    lat,
    lon,
  };
};

const cleanRoute = (route) => {
  const coordinates = Array.isArray(route?.koordinate)
    ? route.koordinate
        .map(point => [Number(point?.[0]), Number(point?.[1])])
        .filter(point => isValidCoordinate(point[0], point[1]))
    : [];

  if (coordinates.length === 0) {
    return null;
  }

  return {
    ...route,
    id: route.id || Date.now(),
    ime: route.ime || 'Shranjena pot',
    datum: route.datum || '',
    razdalja: route.razdalja || '0',
    slika: route.slika || '',
    koordinate: coordinates,
    mode: route.mode || 'foot',
  };
};

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user'));
  } catch {
    localStorage.removeItem('user');
    return null;
  }
};

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const getUserEmail = (user) => normalizeEmail(user?.email || user?.userEmail);

const parseSensorLocation = (location) => {
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);

  if (!isValidCoordinate(latitude, longitude)) {
    return null;
  }

  return {
    lat: latitude,
    lng: longitude,
  };
};

const getReadingTimestamp = (reading) => {
  const value = reading?.receivedAt || reading?.deviceTimestamp || reading?.timestamp;
  const time = value ? new Date(value).getTime() : 0;

  return Number.isFinite(time) ? time : 0;
};

const findLatestSensorLocation = (readings = [], user) => {
  const userEmail = getUserEmail(user);

  const validReadings = readings
    .map(reading => ({
      reading,
      point: parseSensorLocation(reading?.location),
      time: getReadingTimestamp(reading),
    }))
    .filter(item => item.point)
    .sort((a, b) => b.time - a.time);

  if (userEmail) {
    const ownReading = validReadings.find(item => normalizeEmail(item.reading?.userEmail) === userEmail);

    if (ownReading) {
      return ownReading;
    }
  }

  return validReadings[0] || null;
};

const geocodeLocationQuery = async (query) => {
  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
  const data = await response.json();

  if (!data?.[0]) {
    return null;
  }

  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
  };
};

const normalizeRoutePoint = (point) => {
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);

  if (!isValidCoordinate(lat, lng)) {
    return null;
  }

  return { lat, lng };
};

const PeakMarkers = ({ vrhovi, onDelete }) => {
  const map = useMap();

  useEffect(() => {
    const markers = [];

    vrhovi.map(cleanPeak).filter(Boolean).forEach(vrh => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;background:#ff6b35;border-radius:50%;box-shadow:0 0 10px rgba(255,255,255,0.3);position:relative;cursor:grab;">
          <div style="position:absolute;top:0;left:0;width:14px;height:14px;background:#ff6b35;border-radius:50%;z-index:-1;animation:pulse-ring 2s infinite;"></div>
        </div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const marker = L.marker([vrh.lat, vrh.lon], { icon })
        .addTo(map)
        .bindTooltip(vrh.ime, { permanent: true, className: 'peak-tooltip', offset: [0, 10] });

      marker.on('click', () => onDelete(vrh));
      markers.push(marker);
    });

    return () => markers.forEach(m => m.remove());
  }, [vrhovi, map, onDelete]);

  return null;
};

const ChangeView = ({ center, zoom = 13 }) => {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }
  }, [center, zoom, map]);

  return null;
};

const ClickController = ({ onPointsSet, active, fixedStartPoint = null }) => {
  const map = useMap();
  const points = useRef([]);
  const markers = useRef([]);

  useEffect(() => {
    if (!active) return;

    const handleClick = (e) => {
      const normalizedFixedStart = normalizeRoutePoint(fixedStartPoint);

      if (normalizedFixedStart) {
        markers.current.forEach(m => m.remove());
        markers.current = [];
        points.current = [];
      }

      const marker = L.circleMarker(e.latlng, {
        radius: 8,
        color: '#ff6b35',
        fillColor: '#ff6b35',
        fillOpacity: 1,
      }).addTo(map);

      markers.current.push(marker);

      if (normalizedFixedStart) {
        onPointsSet(normalizedFixedStart, e.latlng);
        return;
      }

      points.current.push(e.latlng);

      if (points.current.length === 2) {
        onPointsSet(points.current[0], points.current[1]);
        points.current = [];
      }
    };

    map.on('click', handleClick);

    return () => {
      map.off('click', handleClick);
      markers.current.forEach(m => m.remove());
      markers.current = [];
      points.current = [];
    };
  }, [map, onPointsSet, active, fixedStartPoint]);

  return null;
};

const Profil = () => {
  const [activeTab, setActiveTab] = useState('pregled');
  const [searchQuery, setSearchQuery] = useState('');
  const [mapCenter, setMapCenter] = useState([46.1512, 14.9955]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [tempName, setTempName] = useState('');
  const [draggingPinId, setDraggingPinId] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [peakSearch, setPeakSearch] = useState('');
  const [isDraggingActive, setIsDraggingActive] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [routeToDelete, setRouteToDelete] = useState(null);
  const [suggestedRoutes, setSuggestedRoutes] = useState([]);
  const [selectedPreviewIdx, setSelectedPreviewIdx] = useState(0);
  const [travelMode, setTravelMode] = useState('foot');
  const [pace, setPace] = useState('average');
  const [isLoading, setIsLoading] = useState(false);
  const [startQuery, setStartQuery] = useState('');
  const [endQuery, setEndQuery] = useState('');
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [latestSensorGps, setLatestSensorGps] = useState(null);
  const [sensorGpsStatus, setSensorGpsStatus] = useState('GPS iz senzorjev se ni uporabljen.');
  const [isSensorGpsLoading, setIsSensorGpsLoading] = useState(false);
  const [user] = useState(readStoredUser);

  const isDraggingInternal = useRef(false);
  const mapRef = useRef(null);

  const countries = [
    { name: 'Slovenija', img: sloveniaMap, key: 'si', center: [46.12, 14.82], zoom: 8 },
    { name: 'Italija', img: italiaMap, key: 'it', center: [42.5, 12.5], zoom: 6 },
    { name: 'Avstrija', img: austriaMap, key: 'at', center: [47.5, 14.0], zoom: 7 },
    { name: 'Madzarska', img: hungaryMap, key: 'hu', center: [47.0, 19.5], zoom: 7 },
  ];

  const [currentCountryIdx, setCurrentCountryIdx] = useState(0);
  const [dosezeniVrhovi, setDosezeniVrhovi] = useState(() => readStoredList('pini_silhuete').map(cleanPeak).filter(Boolean));
  const [vsiPohodi, setVsiPohodi] = useState(() => readStoredList('moje_poti').map(cleanRoute).filter(Boolean));

  const isUsingSensorGpsStart = Boolean(
    latestSensorGps
    && startPoint
    && startPoint.lat === latestSensorGps.lat
    && startPoint.lng === latestSensorGps.lng
  );

  useEffect(() => {
    localStorage.setItem('moje_poti', JSON.stringify(vsiPohodi));
    localStorage.setItem('pini_silhuete', JSON.stringify(dosezeniVrhovi));
  }, [vsiPohodi, dosezeniVrhovi]);

  const handlePeakSearch = async (e) => {
    if (e.key === 'Enter' && peakSearch) {
      try {
        const countryName = countries[currentCountryIdx].name;
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${peakSearch}, ${countryName}`)}`);
        const data = await res.json();

        if (data && data[0]) {
          const lat = parseFloat(data[0].lat);
          const lon = parseFloat(data[0].lon);

          setDosezeniVrhovi([
            ...dosezeniVrhovi,
            {
              id: Date.now(),
              countryKey: countries[currentCountryIdx].key,
              lat,
              lon,
              ime: peakSearch,
              type: 'peak',
            },
          ]);

          setIsSearchOpen(false);
          setPeakSearch('');
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const executeDelete = () => {
    if (!deleteConfirm) return;

    setDosezeniVrhovi(dosezeniVrhovi.filter(v => v.id !== deleteConfirm.id));
    setDeleteConfirm(null);
  };

  const executeDeleteRoute = () => {
    if (routeToDelete) {
      setVsiPohodi(vsiPohodi.filter(p => p.id !== routeToDelete.id));
      setRouteToDelete(null);
    }
  };

  const applySensorGpsToRouteStart = async () => {
    setIsSensorGpsLoading(true);
    setSensorGpsStatus('Berem zadnje GPS podatke iz senzorjev...');

    try {
      const response = await fetch(`${API_BASE_URL}/sensor-readings?limit=100`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'GPS podatkov ni bilo mogoce prebrati.');
      }

      const match = findLatestSensorLocation(data.readings || [], user);

      if (!match) {
        throw new Error('Ni najdene senzorske meritve z GPS lokacijo.');
      }

      const point = match.point;
      const reading = match.reading;

      setLatestSensorGps({
        ...point,
        userEmail: reading.userEmail || 'unknown',
        readingAt: reading.receivedAt || reading.deviceTimestamp || null,
      });
      setStartPoint(point);
      setStartQuery('Zadnja GPS lokacija iz senzorjev');
      setMapCenter([point.lat, point.lng]);
      setIsDrawing(true);
      setSensorGpsStatus(`Start poti nastavljen na GPS ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}. Klikni cilj na zemljevidu ali vpisi konec poti.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'GPS podatkov ni bilo mogoce uporabiti.';
      setSensorGpsStatus(message);
    } finally {
      setIsSensorGpsLoading(false);
    }
  };

  const findRouteFromInputs = async () => {
    if ((!startQuery && !startPoint) || !endQuery) {
      return;
    }

    try {
      const resolvedStart = startPoint || await geocodeLocationQuery(startQuery);
      const resolvedEnd = await geocodeLocationQuery(endQuery);

      if (!resolvedStart || !resolvedEnd) {
        return;
      }

      setStartPoint(resolvedStart);
      setEndPoint(resolvedEnd);
      setMapCenter([resolvedStart.lat, resolvedStart.lng]);
    } catch (error) {
      console.error(error);
    }
  };

  const handleMapPointsSet = (start, end) => {
    const normalizedStart = normalizeRoutePoint(start);
    const normalizedEnd = normalizeRoutePoint(end);

    if (!normalizedStart || !normalizedEnd) {
      return;
    }

    setStartPoint(normalizedStart);
    setEndPoint(normalizedEnd);
    setEndQuery('Cilj iz zemljevida');
    setMapCenter([normalizedStart.lat, normalizedStart.lng]);
    setIsDrawing(false);

    if (!isUsingSensorGpsStart) {
      setStartQuery('Zacetek iz zemljevida');
    }
  };

  const resetRoutePlanner = () => {
    setSuggestedRoutes([]);
    setIsDrawing(false);
    setStartPoint(null);
    setEndPoint(null);
    setLatestSensorGps(null);
    setStartQuery('');
    setEndQuery('');
    setSensorGpsStatus('GPS iz senzorjev se ni uporabljen.');
  };

  const fetchRouteOptions = async (start, end) => {
    setIsLoading(true);

    const coordStr = `${start.lng},${start.lat};${end.lng},${end.lat}`;
    const serverUrls = {
      car: 'https://router.project-osrm.org/route/v1/driving/',
      bike: 'https://router.project-osrm.org/route/v1/cycling/',
      foot: 'https://router.project-osrm.org/route/v1/walking/',
    };

    const speedSettings = {
      foot: { slow: 3.2, average: 4.5, fast: 6.5 },
      bike: { slow: 12, average: 18, fast: 28 },
      car: { slow: 40, average: 60, fast: 90 },
    };

    try {
      const res = await fetch(`${serverUrls[travelMode]}${coordStr}?overview=full&geometries=geojson&alternatives=true`);
      const data = await res.json();

      if (data.routes && data.routes.length > 0) {
        const paths = data.routes.map(r => {
          const distKm = r.distance / 1000;
          const currentSpeed = speedSettings[travelMode][pace];
          const duration = Math.round((distKm / currentSpeed) * 60);

          return {
            distance: distKm.toFixed(2),
            coordinates: r.geometry.coordinates.map(c => [c[1], c[0]]),
            duration,
          };
        });

        setSuggestedRoutes(paths);
        setSelectedPreviewIdx(0);

        if (paths[0].coordinates.length > 0) {
          setMapCenter(paths[0].coordinates[0]);
        }
      }
    } catch (err) {
      console.error(err);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    if (startPoint && endPoint) {
      fetchRouteOptions(startPoint, endPoint);
    }
  }, [startPoint, endPoint, travelMode, pace]);

  const handleSaveRoute = () => {
    if (suggestedRoutes.length === 0) return;

    const chosen = suggestedRoutes[selectedPreviewIdx];
    const novPohod = {
      id: Date.now(),
      ime: searchQuery || 'Nova pot',
      datum: new Date().toLocaleDateString('sl-SI'),
      razdalja: chosen.distance,
      slika: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=150&q=80',
      koordinate: chosen.coordinates,
      type: 'route',
      mode: travelMode,
    };

    setVsiPohodi([novPohod, ...vsiPohodi]);
    setSuggestedRoutes([]);
    setActiveTab('seznami');
    setSearchQuery('');
  };

  return (
    <div
      className="profile-page"
      onMouseMove={(e) => {
        if (draggingPinId && mapRef.current) {
          isDraggingInternal.current = true;
          setIsDraggingActive(true);

          const rect = mapRef.current.getBoundingClientRect();
          const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
          const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

          setDosezeniVrhovi(prev => prev.map(v => v.id === draggingPinId ? { ...v, x, y } : v));
        }
      }}
      onMouseUp={() => {
        setIsDraggingActive(false);
        setDraggingPinId(null);
        setTimeout(() => {
          isDraggingInternal.current = false;
        }, 100);
      }}
    >
      <div className={`peak-search-overlay ${isSearchOpen ? 'open' : ''}`}>
        <div className="peak-search-box">
          <h2>Vpisi osvojen vrh</h2>
          <input
            autoFocus={isSearchOpen}
            placeholder="npr. Triglav..."
            value={peakSearch}
            onChange={e => setPeakSearch(e.target.value)}
            onKeyDown={handlePeakSearch}
          />
          <button className="close-search-btn" onClick={() => setIsSearchOpen(false)}>
            <LuX size={30} />
          </button>
        </div>
      </div>

      <div className={`delete-confirm-overlay ${deleteConfirm ? 'open' : ''}`}>
        <div className="peak-search-box">
          <h2>Izbrisem {deleteConfirm?.ime}?</h2>
          <div className="confirm-btns">
            <button className="confirm-yes" onClick={executeDelete}>IZBRISI</button>
            <button className="confirm-no" onClick={() => setDeleteConfirm(null)}>PREKLICI</button>
          </div>
          <button className="close-search-btn" onClick={() => setDeleteConfirm(null)}>
            <LuX size={30} />
          </button>
        </div>
      </div>

      <div className={`delete-confirm-overlay ${routeToDelete ? 'open' : ''}`}>
        <div className="peak-search-box">
          <h2>Izbrisem pot: {routeToDelete?.ime}?</h2>
          <div className="confirm-btns">
            <button className="confirm-yes" onClick={executeDeleteRoute}>IZBRISI</button>
            <button className="confirm-no" onClick={() => setRouteToDelete(null)}>PREKLICI</button>
          </div>
          <button className="close-search-btn" onClick={() => setRouteToDelete(null)}>
            <LuX size={30} />
          </button>
        </div>
      </div>

      {selectedRoute && selectedRoute.koordinate?.length > 0 && (
        <div className="route-modal-overlay">
          <div className="route-modal">
            <button className="close-modal" onClick={() => setSelectedRoute(null)}>
              <LuX size={24} />
            </button>
            <div className="modal-header">
              <h2>{selectedRoute.ime}</h2>
              <div className="modal-stats">
                <span>
                  <LuTrendingUp size={16} /> {selectedRoute.razdalja} km ({selectedRoute.mode === 'car' ? 'Avto' : selectedRoute.mode === 'bike' ? 'Kolo' : 'Pes'})
                </span>
                <button
                  className="nav-google-btn"
                  onClick={() => {
                    const coords = selectedRoute.koordinate;
                    window.open(`https://www.google.com/maps/dir/?api=1&origin=${coords[0][0]},${coords[0][1]}&destination=${coords[coords.length - 1][0]},${coords[coords.length - 1][1]}&travelmode=${selectedRoute.mode === 'car' ? 'driving' : 'walking'}`, '_blank');
                  }}
                >
                  Navigiraj
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
          <p>Tvoji planinski vrhovi na enem mestu.</p>
        </div>
      </div>

      <div className="profile-layout-container">
        <aside className="profile-sidebar">
          <div className="sidebar-content-wrapper">
            <div className="avatar-circle-huge">
              <LuMountain size={100} color="#ff6b35" />
            </div>
            <div className="user-basic-info">
              <h2>{user?.ime || 'Uporabnik'}</h2>
              <p className="location-text">Slovenija</p>
            </div>
            <nav className="sidebar-nav">
              <button className={`nav-btn ${activeTab === 'pregled' ? 'active' : ''}`} onClick={() => setActiveTab('pregled')}>
                <LuTrendingUp size={20} /> Statistika
              </button>
              <button className={`nav-btn ${activeTab === 'seznami' ? 'active' : ''}`} onClick={() => setActiveTab('seznami')}>
                <LuList size={20} /> Seznami
              </button>
              <button className={`nav-btn ${activeTab === 'dodaj' ? 'active' : ''}`} onClick={() => setActiveTab('dodaj')}>
                <LuPlus size={20} /> Dodaj pot
              </button>
            </nav>
          </div>
        </aside>

        <main className="profile-main-content">
          {activeTab === 'pregled' && (
            <div className="dashboard-view">
              <div className="recent-hikes-section">
                <div className="section-header">
                  <h3>Nedavni pohodi</h3>
                </div>
                <div className="hikes-list">
                  {vsiPohodi.slice(0, 3).map(p => (
                    <div key={p.id} className="hike-item" onClick={() => setSelectedRoute(p)}>
                      <img src={p.slika} alt="" className="hike-thumb" />
                      <div className="hike-main-info">
                        <h4>{p.ime}</h4>
                        <span>{p.datum}</span>
                      </div>
                      <div className="hike-stats">
                        <div className="stat">
                          <LuTrendingUp size={16} /> {p.razdalja} km
                        </div>
                      </div>
                      <div className="status-badge success">Shranjeno</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="map-section">
                <div className="country-nav" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '30px', margin: '20px 0', color: '#ff6b35', cursor: 'pointer' }}>
                  <LuChevronLeft size={35} onClick={() => setCurrentCountryIdx((prev) => (prev - 1 + countries.length) % countries.length)} />
                  <h4 style={{ minWidth: '120px', textAlign: 'center', fontSize: '1.2rem' }}>{countries[currentCountryIdx].name}</h4>
                  <LuChevronRight size={35} onClick={() => setCurrentCountryIdx((prev) => (prev + 1) % countries.length)} />
                </div>

                <div
                  className={`map-viz-container ${isDraggingActive ? 'is-dragging' : ''} ${isSearchOpen || deleteConfirm ? 'is-searching' : ''}`}
                  ref={mapRef}
                  onClick={() => {
                    if (!isDraggingInternal.current && !deleteConfirm) setIsSearchOpen(true);
                  }}
                >
                  <div
                    className="masked-map-layer"
                    style={{
                      maskImage: `url(${countries[currentCountryIdx].img})`,
                      WebkitMaskImage: `url(${countries[currentCountryIdx].img})`,
                    }}
                  >
                    <MapContainer
                      center={countries[currentCountryIdx].center}
                      zoom={countries[currentCountryIdx].zoom}
                      zoomControl={false}
                      dragging={false}
                      scrollWheelZoom={false}
                      doubleClickZoom={false}
                      style={{ height: '550px', width: '800px' }}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <ChangeView center={countries[currentCountryIdx].center} zoom={countries[currentCountryIdx].zoom} />
                      <PeakMarkers
                        vrhovi={dosezeniVrhovi.filter(v => v.countryKey === countries[currentCountryIdx].key)}
                        onDelete={(vrh) => {
                          if (!isDraggingInternal.current) setDeleteConfirm(vrh);
                        }}
                      />
                    </MapContainer>
                  </div>
                </div>
                <p className="map-hint">
                  Klikni na zemljevid za dodajanje vrha. Klikni na pin za brisanje.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'seznami' && (
            <div className="recent-hikes-section">
              <div className="hikes-list">
                {vsiPohodi.map(p => (
                  <div key={p.id} className="hike-item" onClick={() => setSelectedRoute(p)} style={{ cursor: 'pointer' }}>
                    <img src={p.slika} alt="" className="hike-thumb" />
                    <div className="hike-main-info">
                      {editingId === p.id ? (
                        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '5px' }}>
                          <input
                            autoFocus
                            value={tempName}
                            onChange={e => setTempName(e.target.value)}
                            style={{ background: '#222', color: '#fff', border: '1px solid #ff6b35', borderRadius: '5px', padding: '2px 5px' }}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setVsiPohodi(vsiPohodi.map(x => x.id === p.id ? { ...x, ime: tempName } : x));
                              setEditingId(null);
                            }}
                            style={{ background: '#ff6b35', border: 'none', borderRadius: '5px', cursor: 'pointer', color: 'white' }}
                          >
                            <LuCheck size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <h4>{p.ime}</h4>
                          <span>{p.datum} - {p.razdalja} km</span>
                        </>
                      )}
                    </div>
                    <div className="hike-stats" style={{ display: 'flex', gap: '10px' }}>
                      <LuPencil
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(p.id);
                          setTempName(p.ime);
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                      <LuTrash2
                        color="#ff4d4d"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRouteToDelete(p);
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'dodaj' && (
            <div className="map-editor-container">
              <div className="editor-sidebar">
                <h3>Nacrtuj pot</h3>

                <input
                  className="editor-input"
                  placeholder="Vnesi ime poti..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px' }}>
                  <input
                    className="editor-input"
                    placeholder="Zacetek poti (npr. Bled)..."
                    value={startQuery}
                    onChange={e => {
                      setStartQuery(e.target.value);
                      setStartPoint(null);
                      setLatestSensorGps(null);
                      setSensorGpsStatus('GPS iz senzorjev se ni uporabljen.');
                    }}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && startQuery) {
                        const point = await geocodeLocationQuery(startQuery);

                        if (point) {
                          setStartPoint(point);
                        }
                      }
                    }}
                  />

                  <input
                    className="editor-input"
                    placeholder="Konec poti (npr. Triglav)..."
                    value={endQuery}
                    onChange={e => setEndQuery(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && endQuery) {
                        const point = await geocodeLocationQuery(endQuery);

                        if (point) {
                          setEndPoint(point);
                        }
                      }
                    }}
                  />
                </div>

                <div className="sensor-gps-route-panel">
                  <div className="sensor-gps-route-text">
                    <strong>GPS iz senzorjev</strong>
                    <span>{sensorGpsStatus}</span>
                    {latestSensorGps && (
                      <small>
                        {latestSensorGps.lat.toFixed(5)}, {latestSensorGps.lng.toFixed(5)}
                      </small>
                    )}
                  </div>

                  <button
                    type="button"
                    className="sensor-gps-route-btn"
                    onClick={applySensorGpsToRouteStart}
                    disabled={isSensorGpsLoading}
                  >
                    {isSensorGpsLoading ? <LuRefreshCw size={18} /> : <LuMapPin size={18} />}
                    {isSensorGpsLoading ? 'Berem...' : 'Uporabi GPS'}
                  </button>
                </div>

                <button
                  className="search-route-btn"
                  onClick={findRouteFromInputs}
                >
                  Isci pot
                </button>

                <div className="mode-selector">
                  <button className={`mode-btn ${travelMode === 'foot' ? 'active' : ''}`} onClick={() => setTravelMode('foot')}>
                    <LuFootprints size={20} />
                  </button>
                  <button className={`mode-btn ${travelMode === 'bike' ? 'active' : ''}`} onClick={() => setTravelMode('bike')}>
                    <LuBike size={20} />
                  </button>
                </div>

                <div className="pace-selector">
                  <button className={`pace-btn ${pace === 'slow' ? 'active' : ''}`} onClick={() => setPace('slow')}>Pocasno</button>
                  <button className={`pace-btn ${pace === 'average' ? 'active' : ''}`} onClick={() => setPace('average')}>Srednje</button>
                  <button className={`pace-btn ${pace === 'fast' ? 'active' : ''}`} onClick={() => setPace('fast')}>Hitro</button>
                </div>

                <div className="btn-row">
                  <button className="editor-small-btn" onClick={resetRoutePlanner}>
                    Reset
                  </button>
                  <button
                    className={`editor-small-btn ${isDrawing ? 'active-draw' : ''}`}
                    onClick={() => {
                      setIsDrawing(!isDrawing);
                      setSuggestedRoutes([]);
                    }}
                  >
                    {isDrawing ? 'Preklici' : isUsingSensorGpsStart ? 'Izberi cilj' : 'Izberi tocki'}
                  </button>
                </div>

                {isDrawing && !isLoading && (
                  <p className="map-hint-text">
                    {isUsingSensorGpsStart ? 'Klikni cilj poti na zemljevidu.' : 'Klikni zacetek poti, nato konec poti na zemljevidu.'}
                  </p>
                )}

                {isLoading && (
                  <p className="map-hint-text">Iscem pot...</p>
                )}

                {suggestedRoutes.length > 0 && (
                  <div className="route-options-selector">
                    <p>Izberi zeleno traso:</p>
                    <div className="options-list-wrapper">
                      {suggestedRoutes.map((route, idx) => (
                        <div
                          key={idx}
                          className={`route-option-card ${selectedPreviewIdx === idx ? 'selected' : ''}`}
                          onClick={() => setSelectedPreviewIdx(idx)}
                        >
                          <div className="option-info">
                            <span className="option-name">Moznost {idx + 1}</span>
                            <span className="option-dist">{route.distance} km</span>
                          </div>
                          <small>{route.duration} min ({travelMode === 'bike' ? 's kolesom' : 'pes'})</small>
                        </div>
                      ))}
                    </div>
                    <button className="save-btn" onClick={handleSaveRoute} style={{ marginTop: '20px', width: '100%' }}>
                      Shrani izbrano
                    </button>
                  </div>
                )}
              </div>

              <div className="editor-map-area">
                <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <ChangeView center={mapCenter} />
                  <ClickController
                    onPointsSet={handleMapPointsSet}
                    active={isDrawing}
                    fixedStartPoint={isUsingSensorGpsStart ? startPoint : null}
                  />
                  {suggestedRoutes.map((route, idx) => (
                    <Polyline
                      key={idx}
                      positions={route.coordinates}
                      color={selectedPreviewIdx === idx ? '#ff6b35' : '#999'}
                      weight={selectedPreviewIdx === idx ? 6 : 4}
                      opacity={selectedPreviewIdx === idx ? 1 : 0.5}
                      eventHandlers={{ click: () => setSelectedPreviewIdx(idx) }}
                    />
                  ))}
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