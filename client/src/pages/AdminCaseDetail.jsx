import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './AdminCaseDetail.css';

const benefitTitles = {
  family: 'משפחה (כולל הורה וילדים מתחת לגיל 18)',
  individual: 'בגיר מעל 21',
  minor: 'צעיר',
};

const STATUS_OPTIONS = [
  { value: 'submitted', label: 'נשלח' },
  { value: 'pending', label: 'בתהליך / ממתין לאישור' },
  { value: 'approved', label: 'אושר – מחכים לאישור הממשלה' },
  { value: 'rejected', label: 'נדחה / נסגר' },
  { value: 'closed', label: 'נסגר' },
];

const AdminCaseDetail = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [confirmingCompleted, setConfirmingCompleted] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchCase = async () => {
      try {
        const res = await axios.get(`/admin/cases/${caseId}`);
        if (!cancelled) setCaseData(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.status === 404 ? 'תיק לא נמצא' : 'שגיאה בטעינת התיק');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchCase();
    return () => { cancelled = true; };
  }, [caseId]);

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

  const handleStatusChange = async (e) => {
    const newStatus = e.target.value;
    if (newStatus === caseData.status) return;
    setStatusSaving(true);
    try {
      const res = await axios.patch(`/admin/cases/${caseId}`, { status: newStatus });
      setCaseData((prev) => (prev && res.data.case ? { ...prev, ...res.data.case } : res.data.case || prev));
    } catch (err) {
      console.error(err);
    } finally {
      setStatusSaving(false);
    }
  };

  const handleConfirmCompleted = async () => {
    setConfirmingCompleted(true);
    try {
      const res = await axios.patch(`/admin/cases/${caseId}/confirm-completed`);
      setCaseData((prev) => (prev ? { ...prev, ...res.data.case } : res.data.case));
    } catch (err) {
      console.error(err);
    } finally {
      setConfirmingCompleted(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-case-detail-loading">
        <div className="admin-case-detail-spinner">טוען פרטי טופס...</div>
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="admin-case-detail-container">
        <div className="admin-case-detail-card">
          <p className="admin-case-detail-error">{error || 'תיק לא נמצא'}</p>
          <button type="button" className="admin-case-detail-back" onClick={() => navigate('/admin')}>
            חזרה לפאנל הניהול
          </button>
        </div>
      </div>
    );
  }

  const c = caseData;

  return (
    <div className="admin-case-detail-container">
      {enlargedImage && (
        <div
          className="admin-case-detail-lightbox"
          onClick={() => setEnlargedImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="תצוגה מוגדלת של התמונה"
        >
          <button
            type="button"
            className="admin-case-detail-lightbox-close"
            onClick={() => setEnlargedImage(null)}
            aria-label="סגור"
          >
            ×
          </button>
          <img
            src={enlargedImage}
            alt="תצוגה מוגדלת"
            className="admin-case-detail-lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      <div className="admin-case-detail-card">
        <h1>פרטי טופס – תיק #{c.id.slice(0, 8)}</h1>
        <p className="admin-case-detail-sub">גישה כמנהל. כל הפרטים שנשלחו בטופס.</p>

        <section className="admin-case-detail-section">
          <h2>פרטי משלח</h2>
          <div className="admin-case-detail-grid">
            <div className="admin-case-detail-field">
              <span className="admin-case-detail-label">שם</span>
              <span className="admin-case-detail-value">{c.userName}</span>
            </div>
            <div className="admin-case-detail-field">
              <span className="admin-case-detail-label">אימייל</span>
              <span className="admin-case-detail-value">{c.userEmail}</span>
            </div>
            <div className="admin-case-detail-field">
              <span className="admin-case-detail-label">טלפון</span>
              <span className="admin-case-detail-value">{c.userPhone}</span>
            </div>
          </div>
        </section>

        <section className="admin-case-detail-section">
          <h2>סיכום תיק</h2>
          <div className="admin-case-detail-grid">
            <div className="admin-case-detail-field">
              <span className="admin-case-detail-label">סוג הטבה</span>
              <span className="admin-case-detail-value">{benefitTitles[c.benefitType] || c.benefitType}</span>
            </div>
            <div className="admin-case-detail-field">
              <span className="admin-case-detail-label">תאריך יצירה</span>
              <span className="admin-case-detail-value">{formatDate(c.createdAt)}</span>
            </div>
            <div className="admin-case-detail-field">
              <span className="admin-case-detail-label">תאריך חידוש</span>
              <span className="admin-case-detail-value">{formatDate(c.renewalDate)}</span>
            </div>
            <div className="admin-case-detail-field">
              <span className="admin-case-detail-label">סטטוס (מה הלקוח רואה)</span>
              <select
                className="admin-case-detail-status-select"
                value={c.status || 'submitted'}
                onChange={handleStatusChange}
                disabled={statusSaving}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {statusSaving && <span className="admin-case-detail-saving">שומר...</span>}
            </div>
            {c.adminConfirmedCompleted && (
              <div className="admin-case-detail-field">
                <span className="admin-case-detail-label">אושר הושלם</span>
                <span className="admin-case-detail-value">כן – הלקוח יראה "צריך חידוש" + תאריך</span>
              </div>
            )}
          </div>
        </section>

        <section className="admin-case-detail-section">
          <h2>תוכן הטופס</h2>
          <div className="admin-case-detail-field admin-case-detail-field-block">
            <span className="admin-case-detail-label">כתובת מגורים</span>
            <p className="admin-case-detail-value admin-case-detail-text">{c.address || '–'}</p>
          </div>
          {c.familyBackground != null && String(c.familyBackground).trim() !== '' && (
            <div className="admin-case-detail-field admin-case-detail-field-block">
              <span className="admin-case-detail-label">רקע משפחתי</span>
              <p className="admin-case-detail-value admin-case-detail-text">{c.familyBackground}</p>
            </div>
          )}
          <div className="admin-case-detail-field admin-case-detail-field-block">
            <span className="admin-case-detail-label">פרטים נוספים</span>
            <p className="admin-case-detail-value admin-case-detail-text">{c.personalDetails || '–'}</p>
          </div>

          {(c.idCardPhoto || c.idCardAnnex || (Array.isArray(c.attachments) && c.attachments.length > 0)) && (
            <>
              <h3 className="admin-case-detail-images-heading">תמונות ומסמכים שהלקוח העלה</h3>
              {c.idCardPhoto && (
                <div className="admin-case-detail-field admin-case-detail-field-block">
                  <span className="admin-case-detail-label">תמונת תעודת זהות / מסמך</span>
                  <div className="admin-case-detail-img-wrap admin-case-detail-img-clickable" onClick={() => setEnlargedImage(c.idCardPhoto)}>
                    <img src={c.idCardPhoto} alt="תעודת זהות / מסמך" className="admin-case-detail-uploaded-img" />
                  </div>
                </div>
              )}
              {c.idCardAnnex && (
                <div className="admin-case-detail-field admin-case-detail-field-block">
                  <span className="admin-case-detail-label">נספח למסמך</span>
                  <div className="admin-case-detail-img-wrap admin-case-detail-img-clickable" onClick={() => setEnlargedImage(c.idCardAnnex)}>
                    <img src={c.idCardAnnex} alt="נספח למסמך" className="admin-case-detail-uploaded-img" />
                  </div>
                </div>
              )}
              {Array.isArray(c.attachments) && c.attachments.length > 0 && (
                <div className="admin-case-detail-field admin-case-detail-field-block">
                  <span className="admin-case-detail-label">מסמכים מצורפים נוספים</span>
                  <div className="admin-case-detail-attachments">
                    {c.attachments.map((url, i) => (
                      <div key={i} className="admin-case-detail-img-wrap admin-case-detail-img-clickable" onClick={() => setEnlargedImage(url)}>
                        <img src={url} alt={`מסמך מצורף ${i + 1}`} className="admin-case-detail-uploaded-img" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {(c.signatoryName || c.signatureImage) && (
          <section className="admin-case-detail-section">
            <h2>אישור וחתימה</h2>
            {c.signatoryName && (
              <div className="admin-case-detail-field">
                <span className="admin-case-detail-label">שם החותם</span>
                <span className="admin-case-detail-value">{c.signatoryName}</span>
              </div>
            )}
            {c.signedAt && (
              <div className="admin-case-detail-field">
                <span className="admin-case-detail-label">תאריך חתימה</span>
                <span className="admin-case-detail-value">{formatDate(c.signedAt)}</span>
              </div>
            )}
            {c.signatureImage && (
              <div className="admin-case-detail-field admin-case-detail-field-block">
                <span className="admin-case-detail-label">חתימה (תמונה שהלקוח העלה)</span>
                <div className="admin-case-detail-signature-img-wrap admin-case-detail-img-clickable" onClick={() => setEnlargedImage(c.signatureImage)}>
                  <img src={c.signatureImage} alt="חתימה" className="admin-case-detail-signature-img" />
                </div>
              </div>
            )}
          </section>
        )}

        <div className="admin-case-detail-actions">
          {!c.adminConfirmedCompleted && (
            <button
              type="button"
              className="admin-confirm-completed-btn"
              onClick={handleConfirmCompleted}
              disabled={confirmingCompleted}
            >
              {confirmingCompleted ? 'מאשר...' : 'אישור הושלם (צריך חידוש בעוד חצי שנה)'}
            </button>
          )}
          <button type="button" className="admin-case-detail-back" onClick={() => navigate('/admin')}>
            חזרה לפאנל הניהול
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminCaseDetail;
