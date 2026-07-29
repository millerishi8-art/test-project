import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.jsx';
import './AdminPanel.css';
import './AdminEmployeeCases.css';

const CATEGORIES = [
  { value: 'ראיונות', label: 'ראיונות' },
  { value: 'הגשת טפסים', label: 'הגשת טפסים' },
];

const AdminEmployeeCases = () => {
  const { user: sessionUser } = useAuth();
  const isPrimaryAdmin = sessionUser?.isPrimaryAdmin === true;
  const navigate = useNavigate();

  const [managers, setManagers] = useState([]);
  const [totals, setTotals] = useState({ casesCount: 0, unpaidCount: 0, paidPendingArchive: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [resetting, setResetting] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [caseNumber, setCaseNumber] = useState('');
  const [category, setCategory] = useState('ראיונות');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const flashSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 4500);
  };

  const fetchData = useCallback(async () => {
    setLoadError('');
    try {
      const res = await axios.get('/admin/employee-cases');
      setManagers(res.data?.managers || []);
      setTotals(res.data?.totals || { casesCount: 0, unpaidCount: 0, paidPendingArchive: 0 });
    } catch (err) {
      console.error('Failed to fetch employee cases:', err);
      setLoadError(err.response?.data?.error || 'שגיאה בטעינת כייסי העובדים');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const openModal = () => {
    setCaseNumber('');
    setCategory('ראיונות');
    setFormError('');
    setShowModal(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const trimmed = caseNumber.trim();
    if (!trimmed) {
      setFormError('חובה להזין מספר כייס');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      await axios.post('/admin/employee-cases', { caseNumber: trimmed, category });
      setShowModal(false);
      await fetchData();
      flashSuccess('הכייס נרשם בהצלחה');
    } catch (err) {
      setFormError(err.response?.data?.error || 'שגיאה ברישום הכייס');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePaid = async (caseItem) => {
    if (!isPrimaryAdmin || busyId) return;
    const nextPaid = !caseItem.isPaid;
    const confirmText = nextPaid
      ? `לסמן את כייס ${caseItem.caseNumber} כשולם?`
      : `לבטל סימון תשלום עבור כייס ${caseItem.caseNumber}?`;
    if (!window.confirm(confirmText)) return;

    setBusyId(caseItem.id);
    try {
      await axios.patch(`/admin/employee-cases/${caseItem.id}/paid`, { isPaid: nextPaid });
      await fetchData();
      flashSuccess(nextPaid ? 'הכייס סומן כשולם' : 'סימון התשלום בוטל');
    } catch (err) {
      alert(err.response?.data?.error || 'שגיאה בעדכון סטטוס התשלום');
    } finally {
      setBusyId(null);
    }
  };

  const handleResetPaid = async () => {
    if (!isPrimaryAdmin || resetting) return;
    const count = totals.paidPendingArchive || 0;
    if (count === 0) {
      alert('אין כייסים ששולמו לאיפוס');
      return;
    }
    const ok = window.confirm(
      `לאפס/לארכב ${count} כייסים שסומנו כשולמו?\n\n` +
        'הם יוסרו מהרשימה הפעילה ויינעלו לצמיתות – לא ניתן יהיה לשנות או למחוק אותם.'
    );
    if (!ok) return;

    setResetting(true);
    try {
      const res = await axios.post('/admin/employee-cases/reset-paid');
      await fetchData();
      flashSuccess(res.data?.message || 'הכייסים ששולמו אופסו בהצלחה');
    } catch (err) {
      alert(err.response?.data?.error || 'שגיאה באיפוס הכייסים');
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">טוען מעקב כייסים...</div>
      </div>
    );
  }

  return (
    <div className="admin-panel-container emp-cases-page">
      <div className="admin-header">
        <h1>מעקב כייסים ותשלומים</h1>
        <p className="admin-welcome">
          רישום כייסים לפי מנהל — <strong>ראיונות</strong> ו<strong>הגשת טפסים</strong>.
          סימון תשלום ואיפוס — רק למנהל הראשי.
        </p>
        {!isPrimaryAdmin && (
          <p className="admin-secondary-notice" role="status">
            מנהל משנה: ניתן לרשום כייסים חדשים ולצפות בסטטוס. שינוי תשלום / איפוס — רק למנהל הראשי.
          </p>
        )}
        <div className="admin-header-actions">
          <button type="button" className="emp-cases-add-btn" onClick={openModal}>
            רישום כייס חדש
          </button>
          {isPrimaryAdmin && (
            <button
              type="button"
              className="emp-cases-reset-btn"
              onClick={handleResetPaid}
              disabled={resetting || (totals.paidPendingArchive || 0) === 0}
            >
              {resetting ? 'מאפס...' : 'איפוס / ארכוב כייסים ששולמו'}
            </button>
          )}
          <button
            type="button"
            className="admin-case-processing-btn"
            onClick={() => navigate('/admin')}
          >
            חזרה לפאנל הניהול
          </button>
        </div>
      </div>

      <div className="admin-stats payouts-stats-top">
        <div className="stat-card">
          <h3>מנהלים</h3>
          <p className="stat-number">{managers.length}</p>
        </div>
        <div className="stat-card stat-info">
          <h3>כייסים פעילים</h3>
          <p className="stat-number">{totals.casesCount}</p>
        </div>
        <div className="stat-card stat-warning">
          <h3>ממתינים לתשלום</h3>
          <p className="stat-number">{totals.unpaidCount}</p>
        </div>
        <div className="stat-card">
          <h3>שולמו (לפני איפוס)</h3>
          <p className="stat-number">{totals.paidPendingArchive}</p>
        </div>
      </div>

      {successMessage && (
        <div className="admin-success-message" role="alert">
          {successMessage}
        </div>
      )}
      {loadError && (
        <div className="emp-cases-error" role="alert">
          {loadError}
        </div>
      )}

      <div className="emp-managers-grid">
        {managers.length === 0 ? (
          <div className="emp-empty-state">אין מנהלים להצגה. ודא שמנהלי המשנה מוגדרים במערכת.</div>
        ) : (
          managers.map((manager) => (
            <section key={manager.id || manager.email} className="emp-manager-card">
              <header className="emp-manager-card-header">
                <div className="emp-manager-identity">
                  <span className="emp-initials-badge emp-initials-badge--lg" aria-hidden="true">
                    {manager.initials}
                  </span>
                  <div>
                    <h2 className="emp-manager-name">{manager.name || manager.email || 'מנהל'}</h2>
                    <p className="emp-manager-email">{manager.email}</p>
                  </div>
                </div>
                <div className="emp-manager-meta">
                  <span className="emp-meta-chip">{manager.casesCount} כייסים</span>
                  <span className="emp-meta-chip emp-meta-chip--warn">{manager.unpaidCount} לא שולם</span>
                </div>
              </header>

              <div className="emp-cases-list">
                {manager.cases.length === 0 ? (
                  <p className="emp-no-cases">אין כייסים פעילים</p>
                ) : (
                  manager.cases.map((c) => (
                    <article
                      key={c.id}
                      className={`emp-case-box ${c.isPaid ? 'emp-case-box--paid' : ''}`}
                    >
                      <div className="emp-case-box-main">
                        <span className="emp-initials-badge" title={c.userName || c.userEmail}>
                          {c.initials}
                        </span>
                        <div className="emp-case-details">
                          <div className="emp-case-number" dir="ltr">
                            {c.caseNumber}
                          </div>
                          <div className="emp-case-category">{c.category}</div>
                          <div className="emp-case-date">{formatDate(c.createdAt)}</div>
                        </div>
                      </div>

                      <div className="emp-case-box-status">
                        {c.isCompleted && (
                          <span className="emp-completed-mark" title="הושלם בהצלחה" aria-label="הושלם">
                            ✓
                          </span>
                        )}
                        <span
                          className={`emp-paid-badge ${c.isPaid ? 'emp-paid-badge--yes' : 'emp-paid-badge--no'}`}
                        >
                          שולם: {c.isPaid ? 'כן' : 'לא'}
                        </span>
                        {isPrimaryAdmin && (
                          <button
                            type="button"
                            className={`emp-pay-toggle ${c.isPaid ? 'emp-pay-toggle--undo' : ''}`}
                            onClick={() => handleTogglePaid(c)}
                            disabled={busyId === c.id}
                          >
                            {busyId === c.id
                              ? '...'
                              : c.isPaid
                                ? 'בטל תשלום'
                                : 'סמן כשולם'}
                          </button>
                        )}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          ))
        )}
      </div>

      {showModal && (
        <div
          className="emp-modal-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) setShowModal(false);
          }}
        >
          <div className="emp-modal" role="dialog" aria-modal="true" aria-labelledby="emp-modal-title">
            <h2 id="emp-modal-title">רישום כייס חדש</h2>
            <p className="emp-modal-sub">הכייס ישויך אליך ({sessionUser?.name || sessionUser?.email})</p>
            <form onSubmit={handleCreate}>
              <label className="emp-field">
                <span>מספר כייס</span>
                <input
                  type="text"
                  value={caseNumber}
                  onChange={(e) => setCaseNumber(e.target.value)}
                  placeholder="לדוגמה: 12345"
                  autoFocus
                  dir="ltr"
                />
              </label>
              <label className="emp-field">
                <span>קטגוריה</span>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              {formError && <p className="emp-form-error">{formError}</p>}
              <div className="emp-modal-actions">
                <button type="submit" className="emp-cases-add-btn" disabled={submitting}>
                  {submitting ? 'שומר...' : 'שמור כייס'}
                </button>
                <button
                  type="button"
                  className="emp-modal-cancel"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminEmployeeCases;
