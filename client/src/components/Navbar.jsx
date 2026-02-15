import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { isAuthenticated, user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          סוכן ביטוח
        </Link>
        <div className="navbar-menu">
          {isAuthenticated ? (
            <>
              <Link to="/" className="navbar-link">
                בית
              </Link>
              {isAdmin && (
                <Link to="/admin" className="navbar-link">
                  פאנל ניהול
                </Link>
              )}
              <span className="navbar-user">שלום, {user?.name}</span>
              <button onClick={handleLogout} className="navbar-button">
                התנתק
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="navbar-link">
                התחבר
              </Link>
              <Link to="/register" className="navbar-link">
                הרשם
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
