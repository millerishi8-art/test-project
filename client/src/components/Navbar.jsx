import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { isAuthenticated, user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 900) setMenuOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate('/login');
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <nav className="navbar">
        <div className="navbar-container">
          <Link to="/" className="navbar-logo" onClick={closeMenu}>
            סוכן ביטוח
          </Link>

          <button
            type="button"
            className="navbar-burger"
            aria-expanded={menuOpen}
            aria-controls="navbar-mobile-menu"
            aria-label={menuOpen ? 'סגור תפריט' : 'פתח תפריט'}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className={`navbar-burger-line ${menuOpen ? 'open' : ''}`} />
            <span className={`navbar-burger-line ${menuOpen ? 'open' : ''}`} />
            <span className={`navbar-burger-line ${menuOpen ? 'open' : ''}`} />
          </button>

          <div className="navbar-menu navbar-menu-desktop">
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
                <button type="button" onClick={handleLogout} className="navbar-button">
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

      <div
        className={`navbar-overlay ${menuOpen ? 'visible' : ''}`}
        aria-hidden={!menuOpen}
        onClick={closeMenu}
      />

      <div
        id="navbar-mobile-menu"
        className={`navbar-drawer ${menuOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="תפריט ניווט"
      >
        <div className="navbar-drawer-inner">
          {isAuthenticated ? (
            <>
              <span className="navbar-drawer-user">שלום, {user?.name}</span>
              <Link to="/" className="navbar-drawer-link" onClick={closeMenu}>
                בית
              </Link>
              {isAdmin && (
                <Link to="/admin" className="navbar-drawer-link" onClick={closeMenu}>
                  פאנל ניהול
                </Link>
              )}
              <button type="button" onClick={handleLogout} className="navbar-drawer-button">
                התנתק
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="navbar-drawer-link" onClick={closeMenu}>
                התחבר
              </Link>
              <Link to="/register" className="navbar-drawer-link" onClick={closeMenu}>
                הרשם
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default Navbar;
