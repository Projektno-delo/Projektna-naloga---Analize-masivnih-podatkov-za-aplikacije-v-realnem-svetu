import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import './Auth.css'
import heroImg from '../assets/hero.jpg'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    navigate('/')
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
          <div className="auth-form">
            <div className="auth-field">
              <label>Email</label>
              <input type="email" placeholder="vas@email.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="auth-field">
              <label>Geslo</label>
              <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <button className="auth-btn" onClick={handleSubmit}>Prijava</button>
          </div>
          <p className="auth-switch">Nimate računa? <Link to="/register">Registracija</Link></p>
        </div>
      </div>
    </div>
  )
}

export default Login