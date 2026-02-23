import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { homeTranslations } from '../translations/home';
import './Home.css';

const Home = () => {
  const [benefits, setBenefits] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { language, toggleLanguage } = useLanguage();
  const { isAdmin } = useAuth();
  const t = homeTranslations[language];

  useEffect(() => {
    fetchBenefits();
  }, []);

  const fetchBenefits = async () => {
    try {
      const response = await fetch('/api/benefits');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      if (data && (data.family || data.individual || data.minor)) {
        setBenefits(data);
      } else {
        setBenefits(null);
      }
    } catch (error) {
      console.error('Failed to fetch benefits:', error);
      setBenefits(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCubeClick = (type) => {
    navigate(`/benefit/${type}`);
  };

  const handleAdminCubeClick = (filter) => {
    navigate('/admin', { state: { tab: 'cases', filter: filter || 'all' } });
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">{t.loading}</div>
      </div>
    );
  }

  if (!benefits) {
    return <div className="error-container">{t.errorLoading}</div>;
  }

  return (
    <div className="home-container" dir={language === 'he' ? 'rtl' : 'ltr'}>
      <button
        type="button"
        className="home-translate-btn"
        onClick={toggleLanguage}
        title={language === 'he' ? 'Translate to English' : 'תרגם לעברית'}
        aria-label={language === 'he' ? 'Translate to English' : 'תרגם לעברית'}
      >
        {t.translateButton}
      </button>

      <div className="home-header">
        <h1>{t.pageTitle}</h1>
        <p>{t.pageSubtitle}</p>
        <button
          type="button"
          className="home-case-status-btn"
          onClick={() => navigate('/case-status')}
        >
          {t.caseStatusButton}
        </button>
      </div>

      <div className="benefits-grid">
        <div
          className="benefit-cube"
          onClick={() => handleCubeClick('family')}
        >
          <div className="cube-icon">👨‍👩‍👧‍👦</div>
          <h2>{language === 'he' ? benefits.family.title : t.family}</h2>
          <p className="cube-description">{language === 'he' ? benefits.family.description : t.familyDesc}</p>
          <div className="cube-price">
            <span>${benefits.family.price.usd}</span>
            <span>₪{benefits.family.price.ils}</span>
          </div>
        </div>

        <div
          className="benefit-cube"
          onClick={() => handleCubeClick('individual')}
        >
          <div className="cube-icon">👤</div>
          <h2>{language === 'he' ? benefits.individual.title : t.individual}</h2>
          <p className="cube-description">{language === 'he' ? benefits.individual.description : t.individualDesc}</p>
          <div className="cube-price">
            <span>${benefits.individual.price.usd}</span>
            <span>₪{benefits.individual.price.ils}</span>
          </div>
        </div>

        <div
          className="benefit-cube"
          onClick={() => handleCubeClick('minor')}
        >
          <div className="cube-icon">🧒</div>
          <h2>{t.minor}</h2>
          <p className="cube-description">{t.minorDesc}</p>
          <div className="cube-price">
            <span>${benefits.minor.price.usd}</span>
            <span>₪{benefits.minor.price.ils}</span>
          </div>
        </div>

        {isAdmin && (
          <div
            className="benefit-cube admin-cube admin-cube-all"
            onClick={() => handleAdminCubeClick('all')}
          >
            <div className="cube-icon">📋</div>
            <h2>כל הטפסים שאושרו</h2>
            <p className="cube-description">גישה לכל הטפסים שאנשים אישרו ונשלחו</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
