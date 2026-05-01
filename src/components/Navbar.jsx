import { Link } from 'react-router-dom'

function Navbar() {
  return (
    <nav>
      <Link to="/">Hribovc</Link>
      <Link to="/trails">Poti</Link>
      <Link to="/weather">Vreme</Link>
      <Link to="/profile">Profil</Link>
    </nav>
  )
}

export default Navbar