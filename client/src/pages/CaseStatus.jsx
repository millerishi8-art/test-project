import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import { caseStatusTranslations } from '../translations/caseStatus';
import './CaseStatus.css';

/** Backend status values */
const STATUS = {
  SUBMITTED: 'submitted',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CLOSED: 'closed',
};

/**
 * Returns timeline steps for one case. Each step has: key, title, desc, state.
 * state: 'completed' (green) | 'current' (yellow) | 'future' (gray) | 'rejected' (red)
 */
function getTimelineSteps(c, t) {
  const s = (c?.status || STATUS.SUBMITTED).toLowerCase();
  const isRejectedOrClosed = s === STATUS.REJECTED || s === STATUS.CLOSED;
  const steps = [
    { key: '1', title: t.timelineStep1, desc: t.timelineStep1Desc },
    { key: '2', title: t.timelineStep2, desc: t.timelineStep2Desc },
    { key: '3', title: t.timelineStep3, desc: t.timelineStep3Desc },
    { key: '4', title: t.timelineStep4, desc: t.timelineStep4Desc },
  ];
  let step1 = 'completed';
  let step2 = s === STATUS.SUBMITTED ? 'current' : 'completed';
  let step3 = s === STATUS.PENDING ? 'current' : (s === STATUS.APPROVED || c?.adminConfirmedCompleted || isRejectedOrClosed ? 'completed' : 'future');
  let step4 = isRejectedOrClosed ? 'rejected' : 'future';
  const states = [step1, step2, step3, step4];
  return steps.map((step, i) => ({ ...step, state: states[i] }));
}

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
    const s = (c.status || '').toLowerCase();
    if (s === STATUS.REJECTED || s === STATUS.CLOSED) return t.statusClosedRejected;
    if (c.adminConfirmedCompleted) return t.statusNeedsRenewal;
    if (s === STATUS.APPROVED) return t.statusApprovedWaitingGov;
    if (s === STATUS.PENDING) return t.statusInProgress;
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

        <section className="case-status-list-section">
          <h2>{t.yourCases}</h2>
          {loading ? (
            <p className="case-status-loading">{language === 'he' ? 'טוען...' : 'Loading...'}</p>
          ) : cases.length === 0 ? (
            <p className="case-status-empty">{t.noCases}</p>
          ) : (
            <div className="case-status-list">
              {cases.map((c) => {
                const steps = getTimelineSteps(c, t);
                return (
                  <div key={c.id} className="case-status-item">
                    <div className="case-status-item-header">
                      <span className="case-status-item-value case-status-badge">
                        {getClientStatusLabel(c)}
                      </span>
                      <span className="case-status-item-value">{getBenefitTitle(c.benefitType)}</span>
                      <span className="case-status-item-value">
                        {new Date(c.createdAt).toLocaleDateString(locale)}
                      </span>
                    </div>
                    <ul className="case-status-timeline">
                      {steps.map((step, index) => (
                        <li
                          key={step.key}
                          className={`timeline-step timeline-step-${step.state} ${index < steps.length - 1 ? 'has-line' : ''}`}
                        >
                          <span className="timeline-bullet" aria-hidden />
                          <div className="timeline-content">
                            <strong>{step.title}</strong>
                            <span className="timeline-desc">{step.desc}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                    {c.renewalDate && (
                      <div className="case-status-item-row renewal-row">
                        <span className="case-status-item-label">{t.renewalDate}:</span>
                        <span className="case-status-item-value renewal-date">
                          {new Date(c.renewalDate).toLocaleDateString(locale)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
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
