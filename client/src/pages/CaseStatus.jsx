import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { caseStatusTranslations } from '../translations/caseStatus';
import {
  getProcessingStageNumber,
  isCaseProcessingSuccessfulEnd,
  getCaseStageToneClass,
  clientCanEditSubmittedCase,
} from '../utils/caseProcessingStages';
import AgentSupportInline from '../components/AgentSupportInline';
import '../styles/caseStageTones.css';
import './CaseStatus.css';

/**
 * חמשת שלבי התהליך כמו בעמוד ניהול – עם מצב completed / current / future / rejected / skipped
 */
function getTimelineSteps(c, t) {
  const flow = [
    { id: 1, title: t.processStep1 },
    { id: 2, title: t.processStep2 },
    { id: 3, title: t.processStep3 },
    { id: 6, title: t.processStepDocs },
    { id: 4, title: t.processStep4 },
    { id: 5, title: t.processStep5 },
  ];
  const stage = getProcessingStageNumber(c);
  const renewal = Boolean(c?.adminConfirmedCompleted);
  const order = flow.map((step) => step.id);
  const at = order.indexOf(stage);

  return flow.map((step) => {
    const i = order.indexOf(step.id);
    let state = 'future';
    let desc = '';
    if (renewal || stage === 5) {
      if (step.id === 4) {
        state = 'skipped';
        desc = t.processStepSkippedHint;
      } else state = 'completed';
    } else if (stage === 4) {
      if (step.id === 4) state = 'rejected';
      else if (i < order.indexOf(4)) state = 'completed';
    } else if (stage === 0) {
      state = step.id === 1 ? 'current' : 'future';
    } else if (at >= 0) {
      if (i < at) state = 'completed';
      else if (i === at) state = 'current';
    }
    return { key: String(step.id), title: step.title, desc, state };
  });
}

const CaseStatus = () => {
  const navigate = useNavigate();
  const { language, toggleLanguage } = useLanguage();
  const { user } = useAuth();
  const canAccessClientCases = user?.canAccessClientCases === true;
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
    if (st === 6) return t.processStepDocs;
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
        {canAccessClientCases && (
          <p className="case-status-admin-hint">
            {language === 'he'
              ? 'מחובר כמנהל — כל התיקים מופיעים בניהול תיקי לקוחות.'
              : 'Signed in as admin — all cases are in client-case management.'}{' '}
            <button type="button" className="case-status-admin-link" onClick={() => navigate('/admin')}>
              {language === 'he' ? 'מעבר לניהול תיקי לקוחות' : 'Open client cases'}
            </button>
          </p>
        )}

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
                  <div
                    key={c.id}
                    className={`case-status-item ${getCaseStageToneClass(c)}`.trim()}
                  >
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
                                {c.approvedBenefits.renewalDate ? (
                                  <div className="case-status-benefit-row">
                                    <span className="case-status-benefit-label">{t.benefitExactRenewal}:</span>
                                    <span className="case-status-benefit-value">
                                      {new Date(`${c.approvedBenefits.renewalDate}T12:00:00.000Z`).toLocaleDateString(locale, { timeZone: 'UTC' })}
                                    </span>
                                  </div>
                                ) : null}
                                {c.approvedBenefits.amountImageUrl ? (
                                  <div className="case-status-benefit-row">
                                    <span className="case-status-benefit-label">{t.benefitApprovedAmount}:</span>
                                    <img
                                      src={c.approvedBenefits.amountImageUrl}
                                      alt={t.benefitApprovedAmount}
                                      className="case-status-approved-image"
                                    />
                                  </div>
                                ) : null}
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
                    {String(c.benefitType || '').toLowerCase() === 'credit_agreement' ? (
                      <div className="case-status-edit-row">
                        <button
                          type="button"
                          className="case-status-edit-btn"
                          onClick={() => navigate(`/credit-agreement/print/${c.id}`)}
                        >
                          {t.printAgreement}
                        </button>
                      </div>
                    ) : null}
                    {clientCanEditSubmittedCase(c) ? (
                      <div className="case-status-edit-row">
                        <button
                          type="button"
                          className="case-status-edit-btn"
                          onClick={() =>
                            navigate(`/case-form/${c.benefitType}?edit=${encodeURIComponent(c.id)}`)
                          }
                        >
                          {t.editCase}
                        </button>
                        <p className="case-status-edit-hint">{t.editCaseHint}</p>
                      </div>
                    ) : null}
                    {isCaseProcessingSuccessfulEnd(c) && (
                      <AgentSupportInline context="case-complete" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="case-status-actions">
          <button type="button" className="case-status-back-btn" onClick={() => navigate('/dashboard')}>
            {t.backToHome}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CaseStatus;
