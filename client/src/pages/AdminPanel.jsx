import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './AdminPanel.css';

const RENEWAL_NEEDS_NOW = 'needs_renewal';
const RENEWAL_PENDING_CONFIRMATION = 'pending_confirmation';
const RENEWAL_IN_6_MONTHS = 'renewal_in_6_months';
const RENEWAL_OK = 'ok';
const RENEWAL_DONE = 'renewed';

const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

/** מחזיר מצב חידוש: "חידוש עתידי (חצי שנה)" רק אחרי שמנהל אישר שהקייס הושלם */
function getRenewalStatus(c) {
  if (!c.renewalDate) return RENEWAL_OK;
  const renewal = new Date(c.renewalDate).getTime();
  const now = Date.now();
  if (c.isRenewed) return RENEWAL_DONE;
  if (renewal <= now) return RENEWAL_NEEDS_NOW;
  if (renewal - now <= SIX_MONTHS_MS) {
    return c.adminConfirmedCompleted ? RENEWAL_IN_6_MONTHS : RENEWAL_PENDING_CONFIRMATION;
  }
  return RENEWAL_OK;
}

const AdminPanel = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const stateTab = location.state?.tab;
  const stateFilter = location.state?.filter;

  const [users, setUsers] = useState([]);
  const [cases, setCases] = useState([]);
  const [activeTab, setActiveTab] = useState(stateTab === 'cases' ? 'cases' : 'cases');
  const [casesFilter, setCasesFilter] = useState(
    (stateFilter === 'needs_renewal' || stateFilter === 'renewal_in_6_months') ? stateFilter : 'all'
  );
  const [loading, setLoading] = useState(true);
  const [demotingId, setDemotingId] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (stateTab === 'cases') setActiveTab('cases');
    if (stateFilter === 'needs_renewal' || stateFilter === 'renewal_in_6_months') setCasesFilter(stateFilter);
  }, [stateTab, stateFilter]);

  const fetchData = async () => {
    try {
      const [usersRes, casesRes] = await Promise.all([
        axios.get('/admin/users'),
        axios.get('/admin/cases')
      ]);
      setUsers(usersRes.data);
      setCases(casesRes.data);
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBenefitTitle = (type) => {
    const titles = {
      family: '  (כולל הורה וילדים מתחת לגיל 18) משפחה',
      individual: 'בגיר מעל 21',
      minor: 'בגיר מגיל 18-21 בלבד'
    };
    return titles[type] || type;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '–';
    return new Date(dateString).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renewalLabel = (status) => {
    const labels = {
      [RENEWAL_NEEDS_NOW]: 'צריך חידוש עכשיו',
      [RENEWAL_PENDING_CONFIRMATION]: 'מחכה לאישור השלמה',
      [RENEWAL_IN_6_MONTHS]: 'חידוש עתידי (חצי שנה)',
      [RENEWAL_OK]: 'בסדר',
      [RENEWAL_DONE]: 'חודש'
    };
    return labels[status] || status;
  };

  const handleConfirmCompleted = async (caseId) => {
    try {
      await axios.patch(`/admin/cases/${caseId}/confirm-completed`);
      await fetchData();
    } catch (err) {
      console.error('Failed to confirm case:', err);
    }
  };

  const handleDemoteAdmin = async (userId) => {
    if (!window.confirm('האם להוריד את המשתמש מגישת מנהל?')) return;
    setDemotingId(userId);
    setSuccessMessage('');
    try {
      await axios.patch(`/admin/users/${userId}/demote`);
      await fetchData();
      setSuccessMessage('המשתמש הורד מגישת מנהל בהצלחה.');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      console.error('Failed to demote admin:', err);
      const msg = err.response?.data?.error || 'שגיאה בהורדת המנהל';
      alert(msg);
    } finally {
      setDemotingId(null);
    }
  };

  const statusLabel = (s) => {
    const labels = { submitted: 'אושר/נשלח', pending: 'ממתין', approved: 'אושר', rejected: 'נדחה', closed: 'סגור' };
    return labels[s] || s;
  };

  const casesWithRenewal = cases.map((c) => ({ ...c, renewalStatus: getRenewalStatus(c) }));
  const filteredCases =
    casesFilter === 'all'
      ? casesWithRenewal
      : casesFilter === RENEWAL_NEEDS_NOW
        ? casesWithRenewal.filter((c) => c.renewalStatus === RENEWAL_NEEDS_NOW || c.renewalStatus === RENEWAL_PENDING_CONFIRMATION)
        : casesWithRenewal.filter((c) => c.renewalStatus === casesFilter);
  const sortedCases = [...filteredCases].sort((a, b) => {
    const order = { [RENEWAL_NEEDS_NOW]: 0, [RENEWAL_PENDING_CONFIRMATION]: 1, [RENEWAL_IN_6_MONTHS]: 2, [RENEWAL_OK]: 3, [RENEWAL_DONE]: 4 };
    const diff = (order[a.renewalStatus] ?? 2) - (order[b.renewalStatus] ?? 2);
    if (diff !== 0) return diff;
    return new Date(a.renewalDate || 0) - new Date(b.renewalDate || 0);
  });

  const countNeedsRenewal = cases.filter((c) => getRenewalStatus(c) === RENEWAL_NEEDS_NOW).length;
  const countPendingConfirmation = cases.filter((c) => getRenewalStatus(c) === RENEWAL_PENDING_CONFIRMATION).length;
  const countImmediateRenewal = countNeedsRenewal + countPendingConfirmation;
  const countIn6Months = cases.filter((c) => getRenewalStatus(c) === RENEWAL_IN_6_MONTHS).length;

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">טוען נתונים...</div>
      </div>
    );
  }

  return (
    <div className="admin-panel-container">
      <div className="admin-header">
        <h1>פאנל ניהול</h1>
        <p className="admin-welcome">
          כניסה כמנהל. כאן מופיעים <strong>כל הטפסים שאושרו ונשלחו</strong> וכן
          <strong>טפסים לחידוש עתידי (חצי שנה)</strong> — מסודרים במצב חידוש.
        </p>
        <p className="admin-sub">משתמשים וקייסים במערכת. גישה רק עם המייל המורשה למנהל.</p>
      </div>

      <div className="admin-tabs">
        <button
          className={activeTab === 'users' ? 'active' : ''}
          onClick={() => setActiveTab('users')}
        >
          גישת מנהלים ({users.length})
        </button>
        <button
          className={activeTab === 'cases' ? 'active' : ''}
          onClick={() => setActiveTab('cases')}
        >
          קייסים ({cases.length})
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="admin-table-container">
          {successMessage && (
            <div className="admin-success-message" role="alert">
              {successMessage}
            </div>
          )}
          <table className="admin-table">
            <thead>
              <tr>
                <th>שם</th>
                <th>אימייל</th>
                <th>טלפון</th>
                <th>תאריך הרשמה</th>
                <th>מספר קייסים</th>
                <th>סטטוס</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    אין משתמשים במערכת
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{user.phone}</td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td>{user.casesCount}</td>
                    <td>
                      <span className={`status-badge ${user.role}`}>
                        {user.role === 'admin' ? 'מנהל' : 'משתמש'}
                      </span>
                    </td>
                    <td>
                      {(user.role === 'admin' || user.role === 'Admin') && user.id !== currentUser?.id ? (
                        <button
                          type="button"
                          className="admin-demote-btn"
                          onClick={() => handleDemoteAdmin(user.id)}
                          disabled={demotingId === user.id}
                        >
                          {demotingId === user.id ? 'מוריד...' : 'הורד ממנהל'}
                        </button>
                      ) : (
                        <span className="admin-actions-empty">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'cases' && (
        <>
          <div className="admin-cases-filters">
            <button
              className={casesFilter === 'all' ? 'active' : ''}
              onClick={() => setCasesFilter('all')}
            >
              כל התיקים ({cases.length})
            </button>
            <button
              className={casesFilter === RENEWAL_NEEDS_NOW ? 'active' : ''}
              onClick={() => setCasesFilter(RENEWAL_NEEDS_NOW)}
            >
              טפסים לחידוש מיידי ({countImmediateRenewal})
            </button>
            <button
              className={casesFilter === RENEWAL_IN_6_MONTHS ? 'active' : ''}
              onClick={() => setCasesFilter(RENEWAL_IN_6_MONTHS)}
            >
              טפסים לחידוש עתידי (חצי שנה) ({countIn6Months})
            </button>
          </div>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>שם משתמש</th>
                  <th>אימייל</th>
                  <th>טלפון</th>
                  <th>סוג הטבה</th>
                  <th>תאריך יצירה</th>
                  <th>תאריך חידוש</th>
                  <th>מצב חידוש</th>
                  <th>סטטוס תיק</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {sortedCases.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="empty-state">
                      {cases.length === 0
                        ? 'אין קייסים במערכת. כל תיק שאושר (נשלח) יופיע כאן.'
                        : 'אין תיקים בקטגוריה זו'}
                    </td>
                  </tr>
                ) : (
                  sortedCases.map((caseItem) => (
                    <tr key={caseItem.id}>
                      <td>{caseItem.userName}</td>
                      <td>{caseItem.userEmail}</td>
                      <td>{caseItem.userPhone}</td>
                      <td>{getBenefitTitle(caseItem.benefitType)}</td>
                      <td>{formatDate(caseItem.createdAt)}</td>
                      <td>{formatDate(caseItem.renewalDate)}</td>
                      <td>
                        <span className={`status-badge renewal-${caseItem.renewalStatus}`}>
                          {renewalLabel(caseItem.renewalStatus)}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${caseItem.status}`}>
                          {statusLabel(caseItem.status)}
                        </span>
                      </td>
                      <td>
                        <div className="admin-actions-cell">
                          <button
                            type="button"
                            className="admin-view-form-btn"
                            onClick={() => navigate(`/admin/cases/${caseItem.id}`)}
                          >
                            צפה בטופס
                          </button>
                          {caseItem.renewalStatus === RENEWAL_PENDING_CONFIRMATION && (
                            <button
                              type="button"
                              className="admin-confirm-completed-btn"
                              onClick={() => handleConfirmCompleted(caseItem.id)}
                            >
                              אשר הושלם
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="admin-stats">
        <div className="stat-card">
          <h3>סה"כ משתמשים</h3>
          <p className="stat-number">{users.length}</p>
        </div>
        <div className="stat-card">
          <h3>כל התיקים שאושרו</h3>
          <p className="stat-number">{cases.length}</p>
        </div>
        <div className="stat-card stat-warning">
          <h3>טפסים לחידוש מיידי</h3>
          <p className="stat-number">{countImmediateRenewal}</p>
        </div>
        <div className="stat-card stat-info">
          <h3>טפסים לחידוש עתידי (חצי שנה)</h3>
          <p className="stat-number">{countIn6Months}</p>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
