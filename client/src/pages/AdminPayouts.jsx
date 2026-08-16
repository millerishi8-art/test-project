import { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.jsx';
import './AdminPanel.css';
import './AdminPayouts.css';

/** התאריך הקרוב של ה-10 לחודש (יום התשלום לעובדים) */
function getNextPayDate() {
  const now = new Date();
  const payDate = new Date(now.getFullYear(), now.getMonth(), 10);
  if (now.getDate() > 10) {
    payDate.setMonth(payDate.getMonth() + 1);
  }
  return payDate;
}

const AdminPayouts = () => {
  const { user: sessionUser } = useAuth();
  const isPrimaryAdmin = sessionUser?.isPrimaryAdmin === true;
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [settlingEmail, setSettlingEmail] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [expandedEmail, setExpandedEmail] = useState(null);

  useEffect(() => {
    fetchPayouts();
  }, []);

  const fetchPayouts = async () => {
    setLoadError('');
    try {
      const res = await axios.get('/admin/payouts');
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch payouts:', err);
      setLoadError(err.response?.data?.error || 'שגיאה בטעינת נתוני התשלומים');
    } finally {
      setLoading(false);
    }
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

  const getBenefitTitle = (type) => {
    const titles = {
      family: 'משפחה',
      individual: 'בגיר מעל 21',
      minor: 'צעיר',
      card_order: 'הזמנת כרטיס',
    };
    return titles[type] || type || '–';
  };

  const handleSettle = async (employee) => {
    const confirmText =
      `לאשר תשלום לעובד?\n\n` +
      `עובד: ${employee.name ? `${employee.name} (${employee.email})` : employee.email}\n` +
      `כייסים: ${employee.casesCount}\n` +
      `סכום לתשלום: $${employee.totalDue}\n\n` +
      `לאחר האישור המונה של העובד יתאפס והתשלום יישמר בהיסטוריה.`;
    if (!window.confirm(confirmText)) return;
    if (settlingEmail) return;

    setSettlingEmail(employee.email);
    setSuccessMessage('');
    try {
      const res = await axios.post('/admin/payouts/settle', { employeeEmail: employee.email });
      await fetchPayouts();
      setExpandedEmail(null);
      setSuccessMessage(
        res.data?.message || `התשלום לעובד ${employee.email} אושר והמונה אופס.`
      );
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Failed to settle payout:', err);
      alert(err.response?.data?.error || 'שגיאה באישור התשלום');
    } finally {
      setSettlingEmail(null);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">טוען נתוני תשלומים...</div>
      </div>
    );
  }

  const ratePerCase = data?.ratePerCase ?? 15;
  const employees = data?.employees ?? [];
  const totals = data?.totals ?? { casesCount: 0, amountDue: 0 };
  const history = data?.history ?? [];
  const nextPayDate = getNextPayDate().toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="admin-panel-container">
      <div className="admin-header">
        <h1>תשלומי עובדים</h1>
        <p className="admin-welcome">
          מעקב אחרי <strong>כייסים שהושלמו</strong> על ידי כל עובד — <strong>${ratePerCase} לכייס</strong>.
          ביום התשלום מאשרים את התשלום והמונה של העובד מתאפס.
        </p>
        <p className="admin-sub">יום התשלום הקרוב: {nextPayDate}</p>
        {!isPrimaryAdmin && (
          <p className="admin-secondary-notice" role="status">
            מנהל משנה: צפייה בלבד. <strong>אישור תשלום ואיפוס המונה</strong> — רק למנהל הראשי.
          </p>
        )}
        <div className="admin-header-actions">
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
          <h3>עובדים ממתינים לתשלום</h3>
          <p className="stat-number">{employees.length}</p>
        </div>
        <div className="stat-card stat-info">
          <h3>כייסים שטרם שולמו</h3>
          <p className="stat-number">{totals.casesCount}</p>
        </div>
        <div className="stat-card stat-warning">
          <h3>סה"כ לתשלום</h3>
          <p className="stat-number">${totals.amountDue}</p>
        </div>
      </div>

      <div className="admin-table-container">
        {successMessage && (
          <div className="admin-success-message" role="alert">
            {successMessage}
          </div>
        )}
        {loadError && (
          <div className="payouts-error-message" role="alert">
            {loadError}
          </div>
        )}

        <h2 className="payouts-section-title">ממתינים לתשלום</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>עובד</th>
              <th>אימייל</th>
              <th>כייסים שהושלמו</th>
              <th>סכום לתשלום</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan="5" className="empty-state">
                  אין כרגע כייסים שממתינים לתשלום. כל כייס שעובד יאשר כהושלם יופיע כאן.
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <Fragment key={emp.email}>
                  <tr>
                    <td data-label="עובד">{emp.name || '–'}</td>
                    <td data-label="אימייל">{emp.email}</td>
                    <td data-label="כייסים שהושלמו">
                      <span className="status-badge payouts-count-badge">{emp.casesCount}</span>
                    </td>
                    <td data-label="סכום לתשלום">
                      <span className="payouts-amount">${emp.totalDue}</span>
                    </td>
                    <td data-label="פעולות">
                      <div className="admin-actions-cell">
                        <button
                          type="button"
                          className="admin-view-form-btn"
                          onClick={() =>
                            setExpandedEmail(expandedEmail === emp.email ? null : emp.email)
                          }
                        >
                          {expandedEmail === emp.email ? 'סגור פירוט' : 'פירוט כייסים'}
                        </button>
                        {isPrimaryAdmin && (
                          <button
                            type="button"
                            className="payouts-settle-btn"
                            onClick={() => handleSettle(emp)}
                            disabled={settlingEmail !== null}
                          >
                            {settlingEmail === emp.email ? 'מעדכן...' : 'אשר תשלום'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedEmail === emp.email && (
                    <tr className="admin-user-cases-expand-row">
                      <td colSpan={5}>
                        <div className="admin-user-cases-panel">
                          <p className="admin-user-cases-panel-title">
                            כייסים של {emp.name || emp.email} שממתינים לתשלום
                          </p>
                          <table className="admin-user-cases-inner-table">
                            <thead>
                              <tr>
                                <th>מזהה כייס</th>
                                <th>סוג הטבה</th>
                                <th>תאריך השלמה</th>
                                <th>תשלום לעובד</th>
                              </tr>
                            </thead>
                            <tbody>
                              {emp.cases.map((c) => (
                                <tr key={c.id}>
                                  <td className="payouts-case-id" data-label="מזהה כייס">{c.id}</td>
                                  <td data-label="סוג הטבה">{getBenefitTitle(c.benefitType)}</td>
                                  <td data-label="תאריך השלמה">{formatDate(c.completedAt)}</td>
                                  <td data-label="תשלום לעובד">${ratePerCase}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-table-container payouts-history-container">
        <h2 className="payouts-section-title">היסטוריית תשלומים</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>תאריך תשלום</th>
              <th>עובד</th>
              <th>אימייל</th>
              <th>כייסים</th>
              <th>סכום ששולם</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan="5" className="empty-state">
                  עדיין לא בוצעו תשלומים. כל אישור תשלום יישמר כאן לתיעוד.
                </td>
              </tr>
            ) : (
              history.map((p) => (
                <tr key={p.id}>
                  <td data-label="תאריך תשלום">{formatDate(p.paidAt)}</td>
                  <td data-label="עובד">{p.employeeName || '–'}</td>
                  <td data-label="אימייל">{p.employeeEmail}</td>
                  <td data-label="כייסים">{p.casesCount}</td>
                  <td data-label="סכום ששולם">
                    <span className="payouts-amount payouts-amount-paid">${p.amount}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminPayouts;
