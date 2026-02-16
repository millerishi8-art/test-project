import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './AdminCaseDetail.css';

const benefitTitles = {
  family: 'משפחה (כולל הורה וילדים מתחת לגיל 18)',
  individual: 'בגיר מעל 21',
  minor: 'בגיר מגיל 18-21 בלבד',
};

const AdminCaseDetail = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
              <span className="admin-case-detail-label">סטטוס</span>
              <span className="admin-case-detail-value">{c.status}</span>
            </div>
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
                <span className="admin-case-detail-label">חתימה (תמונה)</span>
                <div className="admin-case-detail-signature-img-wrap">
                  <img src={c.signatureImage} alt="חתימה" className="admin-case-detail-signature-img" />
                </div>
              </div>
            )}
          </section>
        )}

        <div className="admin-case-detail-actions">
          <button type="button" className="admin-case-detail-back" onClick={() => navigate('/admin')}>
            חזרה לפאנל הניהול
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminCaseDetail;
