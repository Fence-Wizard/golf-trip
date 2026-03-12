import { Link, NavLink } from 'react-router-dom';
import './Navbar.css';

function Navbar() {
  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        ⛳ Golf Trip
      </Link>
      <ul className="navbar-links">
        <li>
          <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
            Home
          </NavLink>
        </li>
        <li>
          <NavLink to="/trips" className={({ isActive }) => isActive ? 'active' : ''}>
            Trips
          </NavLink>
        </li>
        <li>
          <NavLink to="/leaderboard" className={({ isActive }) => isActive ? 'active' : ''}>
            Leaderboard
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}

export default Navbar;
