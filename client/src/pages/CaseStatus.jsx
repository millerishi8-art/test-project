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
 * Returns timeline steps. When rejected/closed: only 2 steps (timeline ends at step 2).
 * When approved or in progress: 3 steps. Each step has: key, title, desc, state.
 */
function getTimelineSteps(c, t) {
  const s = (c?.status || STATUS.SUBMITTED).toLowerCase();
  const isRejectedOrClosed = s === STATUS.REJECTED || s === STATUS.CLOSED;
  const isApproved = s === STATUS.APPROVED || (c?.detailedAdminStatus || '').includes('אושר על ידי הממשלה');
  const step1 = s === STATUS.SUBMITTED ? 'current' : 'completed';
  const step2 = s === STATUS.SUBMITTED ? 'future' : (s === STATUS.PENDING || (c?.detailedAdminStatus || '').includes('הוגשו טפסים')) ? 'current' : 'completed';
  const step3 = isApproved ? 'completed' : 'future';

  if (isRejectedOrClosed) {
    return [
      { key: '1', title: t.timelineStep1, desc: t.timelineStep1Desc, state: 'completed' },
      { key: '2', title: t.timelineStep2, desc: t.timelineStep2Desc, state: 'completed' },
    ];
  }
  return [
    { key: '1', title: t.timelineStep1, desc: t.timelineStep1Desc, state: step1 },
    { key: '2', title: t.timelineStep2, desc: t.timelineStep2Desc, state: step2 },
    { key: '3', title: t.timelineStep3, desc: t.timelineStep3Desc, state: step3 },
  ];
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

  /** Client visibility: map admin processing stages to what the client sees */
  const getClientStatusLabel = (c) => {
    if (!c) return t.statusSubmitted;
    const s = (c.status || '').toLowerCase();
    const detailed = (c.detailedAdminStatus || '').trim();

    if (s === STATUS.REJECTED || s === STATUS.CLOSED) return t.statusClosedRejected;
    if (c.adminConfirmedCompleted) return t.statusNeedsRenewal;
    if (detailed === 'הוגשו טפסים מחכה לאישור הממשלה') return t.statusFormsSubmittedWaitingGov;
    if (detailed === 'נפתח הבקשה באתר מחכה לראיון אישי' || detailed === 'נעשה ראיון מחכה להגשת טפסים') return t.statusCaseInApprovalProcess;
    if (s === STATUS.APPROVED || detailed === 'אושר על ידי הממשלה') return t.statusApprovedWaitingGov;
    if (s === STATUS.PENDING) return t.statusInProgress;
    return t.statusCaseInApprovalProcess;
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
                            {step.key === '3' && step.state === 'completed' && c.approvedBenefits && (
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
