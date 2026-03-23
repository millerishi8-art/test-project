import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import { caseStatusTranslations } from '../translations/caseStatus';
import { getProcessingStageNumber } from '../utils/caseProcessingStages';
import './CaseStatus.css';

/**
 * חמשת שלבי התהליך כמו בעמוד ניהול – עם מצב completed / current / future / rejected / skipped
 */
function getTimelineSteps(c, t) {
  const labels = [t.processStep1, t.processStep2, t.processStep3, t.processStep4, t.processStep5];
  const stage = getProcessingStageNumber(c);
  const renewal = Boolean(c?.adminConfirmedCompleted);

  /** מסלול הצלחה מלא אחרי אישור מנהל "הושלם" */
  if (renewal) {
    return labels.map((title, i) => {
      const n = i + 1;
      let state = 'future';
      if (n <= 3) state = 'completed';
      else if (n === 4) state = 'skipped';
      else state = 'completed';
      return {
        key: String(n),
        title,
        desc: n === 4 ? t.processStepSkippedHint : '',
        state,
      };
    });
  }

  if (stage === 4) {
    return labels.map((title, i) => {
      const n = i + 1;
      let state = 'future';
      if (n <= 3) state = 'completed';
      else if (n === 4) state = 'rejected';
      return { key: String(n), title, desc: '', state };
    });
  }

  if (stage === 5) {
    return labels.map((title, i) => {
      const n = i + 1;
      let state = 'future';
      if (n <= 3) state = 'completed';
      else if (n === 4) state = 'skipped';
      else state = 'completed';
      return {
        key: String(n),
        title,
        desc: n === 4 ? t.processStepSkippedHint : '',
        state,
      };
    });
  }

  if (stage === 0) {
    return labels.map((title, i) => {
      const n = i + 1;
      const state = n === 1 ? 'current' : 'future';
      return { key: String(n), title, desc: '', state };
    });
  }

  return labels.map((title, i) => {
    const n = i + 1;
    let state = 'future';
    if (n < stage) state = 'completed';
    else if (n === stage) state = 'current';
    return { key: String(n), title, desc: '', state };
  });
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

  /** תווית סטטוס בראש הכרטיס – תואמת את השלב הנוכחי כמו במסך המנהל */
  const getClientStatusLabel = (c) => {
    if (!c) return t.processStep1;
    if (c.adminConfirmedCompleted) return t.statusNeedsRenewal;
    const st = getProcessingStageNumber(c);
    if (st === 4) return t.processStep4;
    if (st === 5) return t.processStep5;
    if (st === 0 || st === 1) return t.processStep1;
    if (st === 2) return t.processStep2;
    if (st === 3) return t.processStep3;
    return t.processStep1;
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
                            {step.desc ? <span className="timeline-desc">{step.desc}</span> : null}
                            {step.key === '5' && step.state === 'completed' && c.approvedBenefits && (
                              <div className="case-status-approved-benefits">
                                {c.approvedBenefits.rentAssistance != null && String(c.approvedBenefits.rentAssistance).trim() !== '' && (
                                  <div className="case-status-benefit-row">
                                    <span className="case-status-benefit-label">{t.benefitRentAssistance}:</span>
                                    <span className="case-status-benefit-value">{c.approvedBenefits.rentAssistance}</span>
                                  </div>
                                )}
                                {c.approvedBenefits.foodStamps != null && String(c.approvedBenefits.foodStamps).trim() !== '' && (
                                  <div className="case-status-benefit-row">
                                    <span className="case-status-benefit-label">{t.benefitFoodStamps}:</span>
                                    <span className="case-status-benefit-value">{c.approvedBenefits.foodStamps}</span>
                                  </div>
                                )}
                                {c.approvedBenefits.financialAid != null && String(c.approvedBenefits.financialAid).trim() !== '' && (
                                  <div className="case-status-benefit-row">
                                    <span className="case-status-benefit-label">{t.benefitFinancialAid}:</span>
                                    <span className="case-status-benefit-value">{c.approvedBenefits.financialAid}</span>
                                  </div>
                                )}
                                {c.approvedBenefits.totalDeposited != null && String(c.approvedBenefits.totalDeposited).trim() !== '' && (
                                  <div className="case-status-benefit-row">
                                    <span className="case-status-benefit-label">{t.benefitTotalDeposited}:</span>
                                    <span className="case-status-benefit-value">{c.approvedBenefits.totalDeposited}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                    {(c.status === 'rejected' || c.status === 'closed') && (
                      <div className="case-status-rejection-card" role="alert">
                        <h3 className="case-status-rejection-card-title">
                          <span aria-hidden>❌</span> {t.rejectionCardTitle}
                        </h3>
                        {c.rejectionReason && (
                          <p className="case-status-rejection-card-reason">{c.rejectionReason}</p>
                        )}
                      </div>
                    )}
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
