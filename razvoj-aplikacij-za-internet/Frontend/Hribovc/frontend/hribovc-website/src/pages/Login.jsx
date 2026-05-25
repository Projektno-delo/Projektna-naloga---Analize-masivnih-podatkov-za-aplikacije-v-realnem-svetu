import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import './Auth.css'
import heroImg from '../assets/hero.jpg'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [faceStatus, setFaceStatus] = useState('')
  const [pendingUser, setPendingUser] = useState(null)
  const navigate = useNavigate()

  const completeLogin = (user, message) => {
    localStorage.setItem('user', JSON.stringify(user))
    alert(message || `Dobrodosli nazaj, ${user.ime}!`)
    navigate('/')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFaceStatus('')
    setPendingUser(null)
    
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

      if (response.ok) {
        // Store user data in localStorage for session management
        const emailUsername = data.user.email.split('@')[0].toLowerCase()
        setFaceStatus('ORV face login: poglejte v kamero in pritisnite SPACE.')

        const faceResponse = await fetch('http://localhost:3000/face-login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            usernames: [data.user.ime, emailUsername, 'ziga'],
            threshold: 0.95,
          }),
        })

        const faceData = await faceResponse.json()

        if (!faceResponse.ok || !faceData.success) {
          setPendingUser(data.user)
          setFaceStatus(faceData.error || 'ORV face login ni uspel.')
          alert(faceData.error || 'Prijava z obrazom ni uspela')
          return
        }

        localStorage.setItem('user', JSON.stringify(data.user))
        alert(`Dobrodošli nazaj, ${data.user.ime}!`)
        navigate('/')
      } else {
        alert(data.error || 'Napaka pri prijavi')
      }
    } catch (error) {
      console.error('Login error:', error)
      alert('Napaka pri povezavi s strežnikom')
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
            <p>Pametno načrtuj poti, spremljaj vreme v realnem času in izboljšaj svojo pripravljenost z AI pomočjo.</p>
          </div>
          <div className="auth-features">
            <div className="auth-feature"><span className="feat-icon">△</span> Pametno načrtovanje poti</div>
            <div className="auth-feature"><span className="feat-icon">◎</span> Natančno vreme po višinah</div>
            <div className="auth-feature"><span className="feat-icon">♡</span> Prilagojeno tvoji pripravljenosti</div>
          </div>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-box">
          <h1>Dobrodošli nazaj</h1>
          <p className="auth-sub">Prijavite se v svoj račun</p>
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label>Email</label>
              <input type="email" placeholder="vas@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="auth-field">
              <label>Geslo</label>
              <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            {faceStatus && <p className="auth-face-status">{faceStatus}</p>}
            <button type="submit" className="auth-btn">Prijava</button>
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
          <p className="auth-switch">Nimate računa? <Link to="/register">Registracija</Link></p>
        </div>
      </div>
    </div>
  )
}

export default Login
