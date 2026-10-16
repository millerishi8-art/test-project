import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { authTranslations } from '../translations/auth';
import './Navbar.css';

const Navbar = () => {
  const { isAuthenticated, user, logout, isAdmin } = useAuth();
  const { language } = useLanguage();
  const t = authTranslations[language] || authTranslations.he;
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
    navigate('/');
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <nav className="navbar">
        <div className="navbar-container">
          <Link to={isAuthenticated ? '/dashboard' : '/'} className="navbar-logo" onClick={closeMenu}>
            {t.navBrand}
          </Link>

          <button
            type="button"
            className="navbar-burger"
            aria-expanded={menuOpen}
            aria-controls="navbar-mobile-menu"
            aria-label={menuOpen ? t.closeMenu : t.openMenu}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className={`navbar-burger-line ${menuOpen ? 'open' : ''}`} />
            <span className={`navbar-burger-line ${menuOpen ? 'open' : ''}`} />
            <span className={`navbar-burger-line ${menuOpen ? 'open' : ''}`} />
          </button>

          <div className="navbar-menu navbar-menu-desktop">
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="navbar-link">
                  {t.navHome}
                </Link>
                {isAdmin && (
                  <Link to="/admin" className="navbar-link">
                    {t.navAdmin}
                  </Link>
                )}
                <span className="navbar-user">{t.navHello}, {user?.name}</span>
                <button type="button" onClick={handleLogout} className="navbar-button">
                  {t.navLogout}
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="navbar-link">
                  {t.navLogin}
                </Link>
                <Link to="/register" className="navbar-link">
                  {t.navRegister}
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
        aria-label={t.navMenu}
      >
        <div className="navbar-drawer-inner">
          {isAuthenticated ? (
            <>
              <span className="navbar-drawer-user">{t.navHello}, {user?.name}</span>
              <Link to="/dashboard" className="navbar-drawer-link" onClick={closeMenu}>
                {t.navHome}
              </Link>
              {isAdmin && (
                <Link to="/admin" className="navbar-drawer-link" onClick={closeMenu}>
                  {t.navAdmin}
                </Link>
              )}
              <button type="button" onClick={handleLogout} className="navbar-drawer-button">
                {t.navLogout}
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="navbar-drawer-link" onClick={closeMenu}>
                {t.navLogin}
              </Link>
              <Link to="/register" className="navbar-drawer-link" onClick={closeMenu}>
                {t.navRegister}
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default Navbar;
