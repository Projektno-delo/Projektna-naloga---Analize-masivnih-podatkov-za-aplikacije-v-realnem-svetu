import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import './Auth.css'
import heroImg from '../assets/hero.jpg'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [faceStatus, setFaceStatus] = useState('')
  const [pendingUser, setPendingUser] = useState(null)
  const [cameraMode, setCameraMode] = useState('pc')
  const [loginPending, setLoginPending] = useState(false)
  const navigate = useNavigate()

  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

  const completeLogin = (user, message) => {
    localStorage.setItem('user', JSON.stringify(user))
    alert(message || `Dobrodosli nazaj, ${user.ime}!`)
    navigate('/')
  }

  const pollPhoneChallenge = async (challengeId, user) => {
    for (let attempt = 0; attempt < 45; attempt += 1) {
      await wait(2000)

      const response = await fetch(
        `http://localhost:3000/orv-2fa/status?challengeId=${encodeURIComponent(challengeId)}`
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

      setFaceStatus('Cakam potrditev na telefonu...')
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
      const response = await fetch('http://localhost:3000/login', {
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
      setFaceStatus(
        cameraMode === 'phone'
          ? 'ORV 2FA: zahteva se posilja na telefon.'
          : 'ORV face login: poglejte v kamero, night mode lahko vklopite v oknu kamere.'
      )

      const faceResponse = await fetch('http://localhost:3000/orv-2fa/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          usernames: [data.user.ime, emailUsername, 'ziga'],
          email: data.user.email,
          cameraMode,
          threshold: 0.62,
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
