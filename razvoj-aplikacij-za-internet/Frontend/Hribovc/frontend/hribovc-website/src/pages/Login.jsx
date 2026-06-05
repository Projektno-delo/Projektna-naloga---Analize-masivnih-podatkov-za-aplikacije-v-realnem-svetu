import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import './Auth.css'
import heroImg from '../assets/hero.jpg'

const preferredFaceProfiles = ['ziga', 'anze', 'anja']
const defaultCameraMode = import.meta.env.VITE_ORV_DEFAULT_CAMERA_MODE === 'phone' ? 'phone' : 'pc'
const getApiBaseUrl = () => {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, '')
  }

  return `http://${window.location.hostname || 'localhost'}:3000`
}
const apiBaseUrl = getApiBaseUrl()
const apiUrl = (path) => `${apiBaseUrl}${path}`

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [faceStatus, setFaceStatus] = useState('')
  const [pendingUser, setPendingUser] = useState(null)
  const [cameraMode, setCameraMode] = useState(defaultCameraMode)
  const [faceProfiles, setFaceProfiles] = useState([])
  const [faceProfile, setFaceProfile] = useState('')
  const [loginPending, setLoginPending] = useState(false)
  const navigate = useNavigate()

  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

  useEffect(() => {
    let cancelled = false

    fetch(apiUrl('/orv-face-profiles'))
      .then(response => response.ok ? response.json() : { profiles: [] })
      .then(data => {
        if (cancelled) {
          return
        }

        const sortedProfiles = Array.isArray(data.profiles)
          ? [...data.profiles].sort((a, b) => {
              const aIndex = preferredFaceProfiles.indexOf(a)
              const bIndex = preferredFaceProfiles.indexOf(b)

              if (aIndex !== -1 || bIndex !== -1) {
                return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex)
              }

              return a.localeCompare(b)
            })
          : []
        const demoProfiles = sortedProfiles.filter(profile => preferredFaceProfiles.includes(profile))
        const profiles = demoProfiles.length > 0 ? demoProfiles : sortedProfiles
        setFaceProfiles(profiles)

        if (!faceProfile && profiles.length > 0) {
          const preferred = profiles.find(profile => profile === 'ziga') || profiles[0]
          setFaceProfile(preferred)
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [faceProfile])

  const completeLogin = (user, message) => {
    localStorage.setItem('user', JSON.stringify(user))
    alert(message || `Dobrodosli nazaj, ${user.ime}!`)
    navigate('/')
  }

  const pollPhoneChallenge = async (challengeId, user) => {
    for (let attempt = 0; attempt < 45; attempt += 1) {
      await wait(2000)

      const response = await fetch(
        apiUrl(`/orv-2fa/status?challengeId=${encodeURIComponent(challengeId)}`)
      )
      const data = await response.json()

      if (data.status === 'approved') {
        completeLogin(user, `Dobrodosli nazaj, ${user.ime}!`)
        return
      }

      if (data.status === 'rejected' || data.status === 'expired') {
        const message = data.result?.error || data.result?.message || 'ORV 2FA s telefonom ni uspel.'
        setPendingUser(user)
        setFaceStatus(message)
        alert(message)
        return
      }

      if (data.lastPreview?.faceDetected) {
        const probability = Math.round(Number(data.lastPreview.probability || 0) * 100)
        const threshold = Math.round(Number(data.lastPreview.threshold || 0.7) * 100)
        setFaceStatus(
          `Telefon: ${data.lastPreview.message || 'obraz zaznan'} (${probability}%, prag ${threshold}%).`
        )
      } else if (data.lastPreview) {
        setFaceStatus('Telefon: obraz ni zaznan, poravnaj kamero.')
      } else {
        setFaceStatus('Cakam potrditev na telefonu...')
      }
    }

    setPendingUser(user)
    setFaceStatus('ORV 2FA s telefonom je potekel.')
    alert('ORV 2FA s telefonom je potekel.')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFaceStatus('')
    setPendingUser(null)
    setLoginPending(true)

    try {
      const response = await fetch(apiUrl('/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Napaka pri prijavi')
        return
      }

      const emailUsername = data.user.email.split('@')[0].toLowerCase()
      const selectedProfile = faceProfile || emailUsername
      setFaceStatus(
        cameraMode === 'phone'
          ? 'ORV 2FA: zahteva se posilja na telefon.'
          : 'ORV face login: poglejte v kamero, night mode lahko vklopite v oknu kamere.'
      )

      const faceResponse = await fetch(apiUrl('/orv-2fa/start'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: selectedProfile,
          usernames: [selectedProfile],
          email: data.user.email,
          cameraMode,
          threshold: 0.6,
          frames: 9,
          minAgreement: 0.7,
          margin: 0.08,
        }),
      })

      const faceData = await faceResponse.json()

      if (cameraMode === 'phone' && faceResponse.status === 202 && faceData.pending) {
        setFaceStatus('Zahteva je poslana na telefon. Odpri mobilno aplikacijo in posnemi obraz.')
        await pollPhoneChallenge(faceData.challengeId, data.user)
        return
      }

      if (!faceResponse.ok || !faceData.success) {
        setPendingUser(data.user)
        setFaceStatus(faceData.error || 'ORV face login ni uspel.')
        alert(faceData.error || 'Prijava z obrazom ni uspela')
        return
      }

      completeLogin(data.user, `Dobrodosli nazaj, ${data.user.ime}!`)
    } catch (error) {
      console.error('Login error:', error)
      alert('Napaka pri povezavi s streznikom')
    } finally {
      setLoginPending(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-left">
        <img src={heroImg} alt="gore" className="auth-bg" />
        <div className="auth-overlay" />
        <div className="auth-left-content">
          <div className="auth-brand">HRIBOVC</div>
          <div className="auth-tagline">
            <h2>Tvoj partner<br />za <span className="auth-highlight">vsak vrh.</span></h2>
            <p>Pametno nacrtuj poti, spremljaj vreme v realnem casu in izboljsaj svojo pripravljenost z AI pomocjo.</p>
          </div>
          <div className="auth-features">
            <div className="auth-feature"><span className="feat-icon">^</span> Pametno nacrtovanje poti</div>
            <div className="auth-feature"><span className="feat-icon">o</span> Natancno vreme po visinah</div>
            <div className="auth-feature"><span className="feat-icon">&lt;3</span> Prilagojeno tvoji pripravljenosti</div>
          </div>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-box">
          <h1>Dobrodosli nazaj</h1>
          <p className="auth-sub">Prijavite se v svoj racun</p>
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label>Email</label>
              <input type="email" placeholder="vas@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="auth-field">
              <label>Geslo</label>
              <input type="password" placeholder="********" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <div className="auth-camera-mode">
              <button
                type="button"
                className={cameraMode === 'pc' ? 'auth-mode-btn active' : 'auth-mode-btn'}
                onClick={() => setCameraMode('pc')}
              >
                PC kamera
              </button>
              <button
                type="button"
                className={cameraMode === 'phone' ? 'auth-mode-btn active' : 'auth-mode-btn'}
                onClick={() => setCameraMode('phone')}
              >
                Telefon kamera
              </button>
            </div>
            <div className="auth-field">
              <label>ORV profil za obraz</label>
              <select value={faceProfile} onChange={e => setFaceProfile(e.target.value)}>
                {faceProfiles.length === 0 ? (
                  <option value="">Ni profilov v data/users</option>
                ) : (
                  faceProfiles.map(profile => (
                    <option key={profile} value={profile}>{profile}</option>
                  ))
                )}
              </select>
            </div>
            {faceStatus && <p className="auth-face-status">{faceStatus}</p>}
            <button type="submit" className="auth-btn" disabled={loginPending}>
              {loginPending ? 'Preverjam...' : 'Prijava'}
            </button>
            {pendingUser && (
              <button
                type="button"
                className="auth-btn auth-btn-secondary"
                onClick={() => completeLogin(pendingUser, '2FA preskocen za testiranje.')}
              >
                Preskoci 2FA za test
              </button>
            )}
          </form>
          <p className="auth-switch">Nimate racuna? <Link to="/register">Registracija</Link></p>
        </div>
      </div>
    </div>
  )
}

export default Login
