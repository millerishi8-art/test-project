import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import { confirmationTranslations } from '../translations/confirmation';
import './Confirmation.css';

const Confirmation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, toggleLanguage } = useLanguage();
  const t = confirmationTranslations[language];
  const [cases, setCases] = useState([]);

  useEffect(() => {
    fetchUserCases();
  }, []);

  const fetchUserCases = async () => {
    try {
      const response = await axios.get('/cases');
      setCases(response.data);
    } catch (error) {
      console.error('Failed to fetch cases:', error);
    }
  };

  const getBenefitTitle = (type) => {
    const key = (type || '').toLowerCase();
    return t.benefitTitles?.[key] || type;
  };

  const locale = language === 'he' ? 'he-IL' : 'en-US';
  const latestCase = cases.length > 0 ? cases[cases.length - 1] : null;
  const renewalDate = latestCase
    ? new Date(latestCase.renewalDate).toLocaleDateString(locale)
    : '';

  const getClientStatusLabel = (c) => {
    if (!c) return t.statusSubmitted;
    if (c.adminConfirmedCompleted) return t.statusNeedsRenewal;
    const s = (c.status || '').toLowerCase();
    if (s === 'approved') return t.statusApprovedWaitingGov;
    if (s === 'pending') return t.statusInProgress;
    return t.statusSubmitted;
  };

  return (
    <div className="confirmation-container" dir={language === 'he' ? 'rtl' : 'ltr'}>
      <button
        type="button"
        className="confirmation-translate-btn"
        onClick={toggleLanguage}
        title={language === 'he' ? 'Translate to English' : 'תרגם לעברית'}
        aria-label={language === 'he' ? 'Translate to English' : 'תרגם לעברית'}
      >
        {t.translateButton}
      </button>

      <div className="confirmation-card">
        <div className="success-icon">✅</div>
        <h1>{t.successTitle}</h1>
        <p className="confirmation-message">{t.confirmationMessage}</p>

        {latestCase && (
          <div className="case-summary">
            <h2>{t.caseSummary}</h2>
            <div className="summary-item">
              <span className="summary-label">{t.benefitType}</span>
              <span className="summary-value">{getBenefitTitle(latestCase.benefitType)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">{t.creationDate}</span>
              <span className="summary-value">
                {new Date(latestCase.createdAt).toLocaleDateString(locale)}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">{t.recommendedRenewal}</span>
              <span className="summary-value renewal-date">{renewalDate}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">{t.status}</span>
              <span className="summary-value status">{getClientStatusLabel(latestCase)}</span>
            </div>
          </div>
        )}

        <div className="alert-box">
          <h3>{t.alertTitle}</h3>
          <p>
            {t.alertText1} <strong>{renewalDate}</strong>
          </p>
          <p>{t.alertText2}</p>
        </div>

        <div className="confirmation-actions">
          <button onClick={() => navigate('/')} className="home-button">
            {t.backToHome}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Confirmation;
