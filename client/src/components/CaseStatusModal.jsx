import { useEffect, useState } from 'react';
import axios from 'axios';
import { explicitStageNumberFromLabel, getCaseStageToneClass, PROCESSING_STAGE_OPTIONS, shortStageLabel } from '../utils/caseProcessingStages';
import CaseProcessingTimer from './CaseProcessingTimer';
import CaseApprovalFields from './CaseApprovalFields';
import '../styles/caseStageTones.css';
import '../pages/AdminCaseProcessing.css';
import './CaseStatusModal.css';

export const CASE_PROCESSING_STAGES = PROCESSING_STAGE_OPTIONS;

function isStageActive(caseItem, stageNum) {
  return explicitStageNumberFromLabel(caseItem?.detailedAdminStatus) === stageNum;
}

function currentStageLabel(c) {
  if (!c) return 'בתהליך';
  const short = shortStageLabel(c.detailedAdminStatus);
  if (short) return short;
  return (
    c.status === 'approved'
      ? 'הכייס אושר'
      : c.status === 'rejected' || c.status === 'closed'
        ? 'הכייס סגור'
        : 'בתהליך'
  );
}

function benefitTitle(type) {
  const t = {
    family: 'משפחה',
    individual: 'בגיר מעל 21',
    minor: 'צעיר',
    card_order: 'הזמנת כרטיס',
    credit_agreement: 'הטבה לשימוש מסגרת האשראי',
  };
  return t[(type || '').toLowerCase()] || type || '–';
}

/**
 * חלון מרחף לעדכון שלבי כייס – אותה לוגיקה כמו "עובדים לך על הכייס"
 * (מיילים / WhatsApp לעובדים דרך PATCH /admin/cases/:id/processing).
 */
export default function CaseStatusModal({ caseItem: initialCase, onClose, onUpdated }) {
  const [caseItem, setCaseItem] = useState(initialCase);
  const [updatingStage, setUpdatingStage] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [subView, setSubView] = useState(null); // null | 'reject' | 'approve'
  const [rejectionReason, setRejectionReason] = useState('');
  const [renewalDate, setRenewalDate] = useState('');
  const [amountImagePath, setAmountImagePath] = useState('');
  const [amountPreview, setAmountPreview] = useState('');

  useEffect(() => {
    setCaseItem(initialCase);
  }, [initialCase]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const busy = updatingStage != null;
  const toneClass = getCaseStageToneClass(caseItem) || '';

  const applyUpdatedCase = (updated) => {
    if (updated && typeof updated === 'object') {
      setCaseItem((prev) => ({ ...prev, ...updated }));
    }
    if (typeof onUpdated === 'function') onUpdated(updated);
  };

  const submitProcessing = async ({
    stage = null,
    clearStage = false,
    rejectionReason: reason = '',
    approvedBenefits = null,
  } = {}) => {
    if (!caseItem?.id || busy) return;
    setUpdatingStage(clearStage ? 'clear' : stage);
    setError('');
    setMessage('');
    try {
      const res = await axios.patch(`/admin/cases/${caseItem.id}/processing`, {
        ...(clearStage ? { clearStage: true, stage: null } : { stage }),
        ...(reason ? { rejectionReason: reason } : {}),
        ...(approvedBenefits && typeof approvedBenefits === 'object' ? { approvedBenefits } : {}),
      });
      applyUpdatedCase(res.data?.case);
      setMessage(res.data?.cleared ? 'שלב העיבוד בוטל.' : 'סטטוס העיבוד עודכן בהצלחה.');
      setSubView(null);
      setRejectionReason('');
      setRenewalDate('');
      setAmountImagePath('');
      setAmountPreview('');
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בעדכון הסטטוס');
    } finally {
      setUpdatingStage(null);
    }
  };

  const handleStageClick = (stageNum) => {
    const stageDef = CASE_PROCESSING_STAGES.find((s) => s.stage === stageNum);
    const active = stageDef ? isStageActive(caseItem, stageNum) : false;
    if (active) {
      submitProcessing({ clearStage: true });
      return;
    }
    if (stageNum === 4) {
      setSubView('reject');
      setError('');
      return;
    }
    if (stageNum === 5) {
      setSubView('approve');
      setError('');
      return;
    }
    submitProcessing({ stage: stageNum });
  };

  const handleRejectionSubmit = () => {
    const reason = rejectionReason.trim();
    if (!reason) {
      setError('נא להזין סיבת סגירה.');
      return;
    }
    submitProcessing({ stage: 4, rejectionReason: reason });
  };

  const handleApprovalSubmit = () => {
    if (!renewalDate) {
      setError('נא לבחור מועד מדויק לחידוש הכייס.');
      return;
    }
    if (!amountImagePath) {
      setError('נא להעלות תמונה של הסכום שאושר לכייס.');
      return;
    }
    submitProcessing({
      stage: 5,
      approvedBenefits: { renewalDate, amountImagePath },
    });
  };

  const onOverlayClick = (e) => {
    if (e.target === e.currentTarget && !busy) onClose?.();
  };

  return (
    <div
      className="case-status-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="case-status-modal-title"
      onClick={onOverlayClick}
    >
      <div className={`case-status-modal ${toneClass}`}>
        <div className="case-status-modal-header">
          <div>
            <p className="case-status-modal-kicker">עדכון שלבי עיבוד</p>
            <h2 id="case-status-modal-title">סטטוס הכייס</h2>
            <p className="case-status-modal-meta">
              {[caseItem?.userName, benefitTitle(caseItem?.benefitType)].filter(Boolean).join(' · ') ||
                'תיק'}
            </p>
          </div>
          <button
            type="button"
            className="case-status-modal-close"
            onClick={onClose}
            disabled={busy}
            aria-label="סגור"
          >
            ×
          </button>
        </div>

        {message ? (
          <div className="admin-success-message" role="status">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="case-status-modal-error" role="alert">
            {error}
          </div>
        ) : null}

        {subView === null && (
          <>
            <div className="case-status-modal-current">
              <span className="case-status-modal-current-label">סטטוס נוכחי</span>
              <strong className="case-status-modal-current-value">{currentStageLabel(caseItem)}</strong>
            </div>

            <CaseProcessingTimer caseItem={caseItem} />

            <p className="case-status-modal-hint">
              לחיצה על שלב מעדכנת את הסטטוס ושולחת התראות לעובדים. לחיצה שנייה על שלב פעיל מבטלת
              אותו (בלי מייל).
            </p>

            <div className="admin-processing-buttons case-status-modal-stages">
              {CASE_PROCESSING_STAGES.map(({ stage, label, isRejection, isApproval, toneClass: tc }) => {
                const isActive = isStageActive(caseItem, stage, label);
                const stageBusy =
                  updatingStage === stage || (updatingStage === 'clear' && isActive);
                return (
                  <button
                    key={stage}
                    type="button"
                    className={`admin-processing-stage-btn ${isActive ? 'active-stage' : ''} ${tc || ''} ${isRejection ? 'stage-rejection' : ''} ${isApproval ? 'stage-approval' : ''}`}
                    onClick={() => handleStageClick(stage)}
                    disabled={busy}
                    title={isActive ? `${label} (לחיצה לביטול)` : label}
                  >
                    {stageBusy ? '...' : label}
                  </button>
                );
              })}
            </div>

            <div className="case-status-modal-footer">
              <button
                type="button"
                className="case-status-modal-done"
                onClick={onClose}
                disabled={busy}
              >
                סיום
              </button>
            </div>
          </>
        )}

        {subView === 'reject' && (
          <div className="case-status-modal-sub">
            <h3>הכייס סגור – סיבת סגירה</h3>
            <p className="admin-processing-modal-desc">סיבת הסגירה תוצג ללקוח בדף סטטוס הכייס.</p>
            <textarea
              className="admin-processing-modal-input"
              rows={4}
              placeholder="הזן סיבת סגירה..."
              dir="rtl"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              disabled={busy}
            />
            <div className="admin-processing-modal-actions">
              <button
                type="button"
                className="admin-processing-modal-cancel"
                onClick={() => {
                  setSubView(null);
                  setError('');
                }}
                disabled={busy}
              >
                חזרה
              </button>
              <button
                type="button"
                className="admin-processing-modal-submit"
                onClick={handleRejectionSubmit}
                disabled={busy}
              >
                {busy ? 'שומר...' : 'שמור וסגור תיק'}
              </button>
            </div>
          </div>
        )}

        {subView === 'approve' && (
          <div className="case-status-modal-sub">
            <h3>הכייס אושר</h3>
            <p className="admin-processing-modal-desc">
              המועד והתמונה יוצגו ללקוח בדף סטטוס הכייס תחת שלב &quot;הכייס אושר&quot;.
            </p>
            <CaseApprovalFields
              idPrefix="case-status-approval"
              renewalDate={renewalDate}
              onRenewalDateChange={setRenewalDate}
              amountPreview={amountPreview}
              onAmountImagePath={(path, preview) => {
                setAmountImagePath(path);
                setAmountPreview(preview || '');
              }}
              disabled={busy}
            />
            <div className="admin-processing-modal-actions">
              <button
                type="button"
                className="admin-processing-modal-cancel"
                onClick={() => {
                  setSubView(null);
                  setError('');
                }}
                disabled={busy}
              >
                חזרה
              </button>
              <button
                type="button"
                className="admin-processing-modal-approve"
                onClick={handleApprovalSubmit}
                disabled={busy}
              >
                {busy ? 'שומר...' : 'שמור ושלח ללקוח'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
