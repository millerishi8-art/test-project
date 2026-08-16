import { useEffect, useState } from 'react';
import axios from 'axios';
import { LEGACY_HE_STAGE1, getCaseStageToneClass } from '../utils/caseProcessingStages';
import '../styles/caseStageTones.css';
import '../pages/AdminCaseProcessing.css';
import './CaseStatusModal.css';

export const CASE_PROCESSING_STAGES = [
  { stage: 1, label: 'נפתחה הבקשה באתר מחכה לראיון אישי', toneClass: 'stage-opening' },
  { stage: 2, label: 'נעשה ראיון מחכה להגשת טפסים', toneClass: 'stage-interview' },
  { stage: 3, label: 'הוגשו טפסים מחכה לאישור הממשלה', toneClass: 'stage-forms' },
  { stage: 4, label: 'הממשלה סגרה את הכייס', isRejection: true },
  { stage: 5, label: 'אושר על ידי הממשלה', isApproval: true },
];

function isStageActive(caseItem, stageNum, label) {
  const cur = (caseItem?.detailedAdminStatus || '').trim();
  return cur === label || (stageNum === 1 && cur === LEGACY_HE_STAGE1);
}

function currentStageLabel(c) {
  if (!c) return 'בתהליך';
  return (
    c.detailedAdminStatus ||
    (c.status === 'approved'
      ? 'אושר'
      : c.status === 'rejected' || c.status === 'closed'
        ? 'נסגר'
        : 'בתהליך')
  );
}

function benefitTitle(type) {
  const t = { family: 'משפחה', individual: 'בגיר מעל 21', minor: 'צעיר', card_order: 'הזמנת כרטיס' };
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
  const [benefits, setBenefits] = useState({
    rentAssistance: '',
    foodStamps: '',
    financialAid: '',
    totalDeposited: '',
  });

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
      setBenefits({ rentAssistance: '', foodStamps: '', financialAid: '', totalDeposited: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בעדכון הסטטוס');
    } finally {
      setUpdatingStage(null);
    }
  };

  const handleStageClick = (stageNum) => {
    const stageDef = CASE_PROCESSING_STAGES.find((s) => s.stage === stageNum);
    const active = stageDef ? isStageActive(caseItem, stageNum, stageDef.label) : false;
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
    const next = {
      rentAssistance: benefits.rentAssistance.trim(),
      foodStamps: benefits.foodStamps.trim(),
      financialAid: benefits.financialAid.trim(),
      totalDeposited: benefits.totalDeposited.trim(),
    };
    submitProcessing({ stage: 5, approvedBenefits: next });
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
                className="case-status-modal-reject-quick"
                onClick={() => {
                  setSubView('reject');
                  setError('');
                }}
                disabled={busy}
              >
                סגירת כייס
              </button>
              <button
                type="button"
                className="case-status-modal-approve-quick"
                onClick={() => {
                  setSubView('approve');
                  setError('');
                }}
                disabled={busy}
              >
                אישור כייס
              </button>
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
            <h3>הממשלה סגרה את הכייס – סיבת סגירה</h3>
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
            <h3>אושר על ידי הממשלה – פרטי הטבות</h3>
            <p className="admin-processing-modal-desc">
              הפרטים יוצגו ללקוח בדף סטטוס הכייס תחת שלב &quot;אושר על ידי הממשלה&quot;.
            </p>
            <div className="admin-processing-benefits-form">
              <label htmlFor="case-status-approval-rent">סיוע בשכר דירה (כן/לא או סכום)</label>
              <input
                id="case-status-approval-rent"
                type="text"
                className="admin-processing-modal-input"
                placeholder="למשל: כן / ₪500"
                dir="rtl"
                value={benefits.rentAssistance}
                onChange={(e) => setBenefits((b) => ({ ...b, rentAssistance: e.target.value }))}
                disabled={busy}
              />
              <label htmlFor="case-status-approval-food">תלושי מזון (כן/לא או סכום)</label>
              <input
                id="case-status-approval-food"
                type="text"
                className="admin-processing-modal-input"
                placeholder="למשל: כן / לא"
                dir="rtl"
                value={benefits.foodStamps}
                onChange={(e) => setBenefits((b) => ({ ...b, foodStamps: e.target.value }))}
                disabled={busy}
              />
              <label htmlFor="case-status-approval-financial">סיוע כלכלי (סכום)</label>
              <input
                id="case-status-approval-financial"
                type="text"
                className="admin-processing-modal-input"
                placeholder="1200 $"
                dir="rtl"
                value={benefits.financialAid}
                onChange={(e) => setBenefits((b) => ({ ...b, financialAid: e.target.value }))}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && !v.endsWith(' $')) {
                    setBenefits((b) => ({ ...b, financialAid: `${v} $` }));
                  }
                }}
                disabled={busy}
              />
              <label htmlFor="case-status-approval-total">סה״כ כסף שנכנס לחשבון</label>
              <input
                id="case-status-approval-total"
                type="text"
                className="admin-processing-modal-input"
                placeholder="2000 $"
                dir="rtl"
                value={benefits.totalDeposited}
                onChange={(e) => setBenefits((b) => ({ ...b, totalDeposited: e.target.value }))}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && !v.endsWith(' $')) {
                    setBenefits((b) => ({ ...b, totalDeposited: `${v} $` }));
                  }
                }}
                disabled={busy}
              />
            </div>
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
