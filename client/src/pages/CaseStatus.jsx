import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import { caseStatusTranslations } from '../translations/caseStatus';
import './CaseStatus.css';

const CaseStatus = () => {
  const navigate = useNavigate();
  const { language, toggleLanguage } = useLanguage();
  const t = caseStatusTranslations[language];
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    try {
      const res = await axios.get('/cases');
      setCases(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch cases:', err);
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  const getBenefitTitle = (type) => {
    const key = (type || '').toLowerCase();
    return t.benefitTitles?.[key] || type;
  };

  const getClientStatusLabel = (c) => {
    if (!c) return t.statusSubmitted;
    if (c.adminConfirmedCompleted) return t.statusNeedsRenewal;
    const s = (c.status || '').toLowerCase();
    if (s === 'approved') return t.statusApprovedWaitingGov;
    if (s === 'pending') return t.statusInProgress;
    return t.statusSubmitted;
  };

  const locale = language === 'he' ? 'he-IL' : 'en-US';

  return (
    <div className="case-status-container" dir={language === 'he' ? 'rtl' : 'ltr'}>
      <button
        type="button"
        className="case-status-translate-btn"
        onClick={toggleLanguage}
        title={language === 'he' ? 'Translate to English' : 'תרגם לעברית'}
        aria-label={language === 'he' ? 'Translate to English' : 'תרגם לעברית'}
      >
        {t.translateButton}
      </button>

      <div className="case-status-card">
        <h1>{t.pageTitle}</h1>
        <p className="case-status-subtitle">{t.pageSubtitle}</p>

        <section className="case-status-stages">
          <h2>{t.stagesTitle}</h2>
          <ul className="stages-list">
            <li>
              <strong>{t.stage1Title}</strong> – {t.stage1Desc}
            </li>
            <li>
              <strong>{t.stage2Title}</strong> – {t.stage2Desc}
            </li>
            <li>
              <strong>{t.stage3Title}</strong> – {t.stage3Desc}
            </li>
            <li>
              <strong>{t.stage4Title}</strong> – {t.stage4Desc}
            </li>
          </ul>
        </section>

        <section className="case-status-list-section">
          <h2>{t.yourCases}</h2>
          {loading ? (
            <p className="case-status-loading">{language === 'he' ? 'טוען...' : 'Loading...'}</p>
          ) : cases.length === 0 ? (
            <p className="case-status-empty">{t.noCases}</p>
          ) : (
            <div className="case-status-list">
              {cases.map((c) => (
                <div key={c.id} className="case-status-item">
                  <div className="case-status-item-row">
                    <span className="case-status-item-label">{t.benefitType}:</span>
                    <span className="case-status-item-value">{getBenefitTitle(c.benefitType)}</span>
                  </div>
                  <div className="case-status-item-row">
                    <span className="case-status-item-label">{t.creationDate}:</span>
                    <span className="case-status-item-value">
                      {new Date(c.createdAt).toLocaleDateString(locale)}
                    </span>
                  </div>
                  <div className="case-status-item-row">
                    <span className="case-status-item-label">{t.status}:</span>
                    <span className="case-status-item-value case-status-badge">
                      {getClientStatusLabel(c)}
                    </span>
                  </div>
                  {c.renewalDate && (
                    <div className="case-status-item-row">
                      <span className="case-status-item-label">{t.renewalDate}:</span>
                      <span className="case-status-item-value renewal-date">
                        {new Date(c.renewalDate).toLocaleDateString(locale)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="case-status-actions">
          <button type="button" className="case-status-back-btn" onClick={() => navigate('/')}>
            {t.backToHome}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CaseStatus;
