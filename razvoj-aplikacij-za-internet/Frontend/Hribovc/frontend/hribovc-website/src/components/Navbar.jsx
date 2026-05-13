import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import './Navbar.css'

function Navbar() {
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('user')
    setUser(null)
    navigate('/')
  }

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-logo">
        HRIBOVC
      </Link>
      <div className="navbar-links">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
          Domov
        </NavLink>
        <NavLink to="/trails" className={({ isActive }) => isActive ? 'active' : ''}>
          Poti
        </NavLink>
        <NavLink to="/weather" className={({ isActive }) => isActive ? 'active' : ''}>
          Vreme
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => isActive ? 'active' : ''}>
          Profil
        </NavLink>
      </div>
      <div className="navbar-auth">
        {user ? (
          <div className="user-menu">
            <span className="user-name">Pozdravljen, {user.ime.split(' ')[0]}</span>
            <button className="logout-btn" onClick={handleLogout}>Odjava</button>
          </div>
        ) : (
          <div className="auth-buttons">
            <Link to="/login" className="login-btn">Prijava</Link>
            <Link to="/register" className="register-btn">Registracija</Link>
          </div>
        )}
      </div>
    </nav>
  )
}

export default Navbar
