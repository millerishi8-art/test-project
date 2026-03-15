import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './AdminCaseProcessing.css';

const STAGES = [
  { stage: 1, label: 'נפתח הבקשה באתר מחכה לראיון אישי' },
  { stage: 2, label: 'נעשה ראיון מחכה להגשת טפסים' },
  { stage: 3, label: 'הוגשו טפסים מחכה לאישור הממשלה' },
  { stage: 4, label: 'הממשלה סגרה את הכייס', isRejection: true },
  { stage: 5, label: 'אושר על ידי הממשלה', isApproval: true },
];

const AdminCaseProcessing = () => {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [rejectionModal, setRejectionModal] = useState(null);
  const [approvalModal, setApprovalModal] = useState(null);

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    try {
      const res = await axios.get('/admin/cases');
      setCases(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch cases:', err);
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  const getBenefitTitle = (type) => {
    const t = { family: 'משפחה', individual: 'בגיר מעל 21', minor: 'צעיר' };
    return t[(type || '').toLowerCase()] || type;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '–';
    return new Date(dateString).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleStageClick = (caseItem, stageNum) => {
    if (stageNum === 4) {
      setRejectionModal({ caseItem, stage: 4 });
      return;
    }
    if (stageNum === 5) {
      setApprovalModal({ caseItem, stage: 5 });
      return;
    }
    submitProcessing(caseItem.id, stageNum);
  };

  const submitProcessing = async (caseId, stage, rejectionReason = '', approvedBenefits = null) => {
    setUpdatingId(caseId);
    setSuccessMessage('');
    try {
      await axios.patch(`/admin/cases/${caseId}/processing`, {
        stage,
        ...(rejectionReason ? { rejectionReason } : {}),
        ...(approvedBenefits && typeof approvedBenefits === 'object' ? { approvedBenefits } : {}),
      });
      await fetchCases();
      setSuccessMessage('סטטוס העיבוד עודכן בהצלחה.');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      const msg = err.response?.data?.error || 'שגיאה בעדכון הסטטוס';
      alert(msg);
    } finally {
      setUpdatingId(null);
      setRejectionModal(null);
      setApprovalModal(null);
    }
  };

  const handleApprovalSubmit = () => {
    if (!approvalModal?.caseItem?.id) return;
    const benefits = {
      rentAssistance: (document.getElementById('approval-rent')?.value ?? '').trim(),
      foodStamps: (document.getElementById('approval-food')?.value ?? '').trim(),
      financialAid: (document.getElementById('approval-financial')?.value ?? '').trim(),
      totalDeposited: (document.getElementById('approval-total')?.value ?? '').trim(),
    };
    submitProcessing(approvalModal.caseItem.id, 5, '', benefits);
  };

  const handleRejectionSubmit = () => {
    const reason = (document.getElementById('rejection-reason-input')?.value || '').trim();
    if (!reason) {
      alert('נא להזין סיבת סגירה.');
      return;
    }
    if (!rejectionModal?.caseItem?.id) return;
    submitProcessing(rejectionModal.caseItem.id, 4, reason);
  };

  const currentStageLabel = (c) => c.detailedAdminStatus || (c.status === 'approved' ? 'אושר' : c.status === 'rejected' || c.status === 'closed' ? 'נסגר' : 'בתהליך');

  if (loading) {
    return (
      <div className="admin-processing-loading">
        <div className="admin-processing-spinner">טוען נתונים...</div>
      </div>
    );
  }

  return (
    <div className="admin-case-processing-container">
      <div className="admin-case-processing-header">
        <h1>עובדים לך על הכייס</h1>
        <p className="admin-case-processing-sub">עדכון שלבי עיבוד לכל תיק. הלקוח רואה סטטוס בהתאם לשלב שנבחר.</p>
        <button
          type="button"
          className="admin-case-processing-back"
          onClick={() => navigate('/admin')}
        >
          ← חזרה לפאנל ניהול
        </button>
      </div>

      {successMessage && (
        <div className="admin-success-message" role="alert">
          {successMessage}
        </div>
      )}

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>שם משתמש</th>
              <th>אימייל</th>
              <th>טלפון</th>
              <th>סוג הטבה</th>
              <th>תאריך יצירה</th>
              <th>סטטוס נוכחי</th>
              <th>שלבי עיבוד</th>
            </tr>
          </thead>
          <tbody>
            {cases.length === 0 ? (
              <tr>
                <td colSpan="7" className="empty-state">
                  אין תיקים במערכת.
                </td>
              </tr>
            ) : (
              cases.map((caseItem) => (
                <tr key={caseItem.id}>
                  <td>{caseItem.userName}</td>
                  <td>{caseItem.userEmail}</td>
                  <td>{caseItem.userPhone}</td>
                  <td>{getBenefitTitle(caseItem.benefitType)}</td>
                  <td>{formatDate(caseItem.createdAt)}</td>
                  <td>
                    <span className="admin-processing-current-status">
                      {currentStageLabel(caseItem)}
                    </span>
                  </td>
                  <td>
                    <div className="admin-processing-buttons">
                      {STAGES.map(({ stage, label, isRejection, isApproval }) => {
                        const isActive = caseItem.processingStage === stage;
                        return (
                          <button
                            key={stage}
                            type="button"
                            className={`admin-processing-stage-btn ${isActive ? 'active-stage' : ''} ${isRejection ? 'stage-rejection' : ''} ${isApproval ? 'stage-approval' : ''}`}
                            onClick={() => handleStageClick(caseItem, stage)}
                            disabled={updatingId === caseItem.id}
                            title={label}
                          >
                            {updatingId === caseItem.id && isActive ? '...' : label}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {rejectionModal && (
        <div className="admin-processing-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="rejection-modal-title">
          <div className="admin-processing-modal">
            <h2 id="rejection-modal-title">הממשלה סגרה את הכייס – סיבת סגירה</h2>
            <p className="admin-processing-modal-desc">סיבת הסגירה תוצג ללקוח בדף סטטוס הכייס.</p>
            <textarea
              id="rejection-reason-input"
              className="admin-processing-modal-input"
              rows={4}
              placeholder="הזן סיבת סגירה..."
              dir="rtl"
            />
            <div className="admin-processing-modal-actions">
              <button
                type="button"
                className="admin-processing-modal-cancel"
                onClick={() => setRejectionModal(null)}
              >
                ביטול
              </button>
              <button
                type="button"
                className="admin-processing-modal-submit"
                onClick={handleRejectionSubmit}
              >
                שמור וסגור תיק
              </button>
            </div>
          </div>
        </div>
      )}

      {approvalModal && (
        <div className="admin-processing-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="approval-modal-title">
          <div className="admin-processing-modal admin-processing-modal-benefits">
            <h2 id="approval-modal-title">אושר על ידי הממשלה – פרטי הטבות</h2>
            <p className="admin-processing-modal-desc">הפרטים יוצגו ללקוח בדף סטטוס הכייס תחת שלב 3.</p>
            <div className="admin-processing-benefits-form">
              <label htmlFor="approval-rent">סיוע בשכר דירה (כן/לא או סכום)</label>
              <input type="text" id="approval-rent" className="admin-processing-modal-input" placeholder="למשל: כן / ₪500" dir="rtl" />
              <label htmlFor="approval-food">תלושי מזון (כן/לא או סכום)</label>
              <input type="text" id="approval-food" className="admin-processing-modal-input" placeholder="למשל: כן / לא" dir="rtl" />
              <label htmlFor="approval-financial">סיוע כלכלי (סכום)</label>
              <input
                type="text"
                id="approval-financial"
                className="admin-processing-modal-input"
                placeholder="1200 $"
                dir="rtl"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && !v.endsWith(' $')) e.target.value = v + ' $';
                }}
              />
              <label htmlFor="approval-total">סה״כ כסף שנכנס לחשבון</label>
              <input
                type="text"
                id="approval-total"
                className="admin-processing-modal-input"
                placeholder="2000 $"
                dir="rtl"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && !v.endsWith(' $')) e.target.value = v + ' $';
                }}
              />
            </div>
            <div className="admin-processing-modal-actions">
              <button
                type="button"
                className="admin-processing-modal-cancel"
                onClick={() => setApprovalModal(null)}
              >
                ביטול
              </button>
              <button
                type="button"
                className="admin-processing-modal-approve"
                onClick={handleApprovalSubmit}
              >
                שמור ושלח ללקוח
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCaseProcessing;
