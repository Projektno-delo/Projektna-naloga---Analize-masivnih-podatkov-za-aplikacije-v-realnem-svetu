import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import './Auth.css'
import heroImg from '../assets/hero.jpg'

function Register() {
  const [ime, setIme] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [starost, setStarost] = useState('')
  const [visina, setVisina] = useState('')
  const [teza, setTeza] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      const response = await fetch('http://localhost:3000/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ime,
          email,
          password,
          starost: parseInt(starost) || null,
          visina: parseInt(visina) || null,
          teza: parseInt(teza) || null,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        alert('Registracija uspešna! Sedaj se lahko prijavite.')
        navigate('/login')
      } else {
        alert(data.error || 'Napaka pri registraciji')
      }
    } catch (error) {
      console.error('Registration error:', error)
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
          <h1>Ustvarite račun</h1>
          <p className="auth-sub">Začnite z varnim načrtovanjem vzponov</p>
          
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label>Ime in priimek</label>
              <input 
                type="text" 
                placeholder="Ana Grudnik" 
                value={ime} 
                onChange={e => setIme(e.target.value)} 
                required 
              />
            </div>

            <div className="auth-field">
              <label>Email naslov</label>
              <input 
                type="email" 
                placeholder="vas@email.com" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
              />
            </div>

            <div className="auth-field">
              <label>Geslo</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
              />
            </div>

            <div className="auth-row">
              <div className="auth-field">
                <label>Starost</label>
                <input 
                  type="number" 
                  placeholder="25" 
                  min="1"        
                  max="120" 
                  value={starost} 
                  onChange={e => setStarost(e.target.value)} 
                />
              </div>
              <div className="auth-field">
                <label>Višina (cm)</label>
                <input 
                  type="number" 
                  placeholder="170" 
                  value={visina} 
                  onChange={e => setVisina(e.target.value)} 
                />
              </div>
              <div className="auth-field">
                <label>Teža (kg)</label>
                <input 
                  type="number" 
                  placeholder="65" 
                  value={teza} 
                  onChange={e => setTeza(e.target.value)} 
                />
              </div>
            </div>

            <button type="submit" className="auth-btn">Ustvari račun</button>
          </form>

          <p className="auth-switch">
            Že imate račun? <Link to="/login">Prijava</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Register