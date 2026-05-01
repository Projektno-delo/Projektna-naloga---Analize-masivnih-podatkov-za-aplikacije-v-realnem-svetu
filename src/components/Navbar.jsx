import { Link, NavLink } from 'react-router-dom'
import './Navbar.css'

function Navbar() {
  return (
    <nav className="navbar">
      <Link to="/" className="navbar-logo">
      Hribovc
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
    </nav>
  )
}

export default Navbar