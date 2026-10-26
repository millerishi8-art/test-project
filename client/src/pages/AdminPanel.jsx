import { useState, useEffect, Fragment } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.jsx';
import HraDetailsModal, { hasHraContent } from '../components/HraDetailsModal.jsx';
import { CaseInterimNotesButton } from '../components/CaseInterimNotes.jsx';
import CaseStatusModal from '../components/CaseStatusModal.jsx';
import {
  getCaseStageToneClass,
  isOnSixMonthRenewalTrack,
  PROCESSING_STAGE_LABELS_HE,
  LEGACY_STAGE_LABELS_HE,
  explicitStageNumberFromLabel,
} from '../utils/caseProcessingStages';
import '../styles/caseStageTones.css';
import './AdminPanel.css';

const RENEWAL_NEEDS_NOW = 'needs_renewal';
const RENEWAL_PENDING_CONFIRMATION = 'pending_confirmation';
const RENEWAL_IN_6_MONTHS = 'renewal_in_6_months';
const RENEWAL_OK = 'ok';
const RENEWAL_DONE = 'renewed';

const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

function caseMatchesSearch(c, query) {
  if (!query) return true;
  const compact = query.replace(/[\s#]/g, '');
  const accountName = String(c.userName || '').trim();
  const formName = String(c.personalDetails?.fullName || c.fullName || '').trim();
  const nameParts = `${accountName} ${formName}`.split(/\s+/).filter(Boolean);
  const firstName = (nameParts[0] || '').toLowerCase();
  const lastName = (nameParts.length > 1 ? nameParts[nameParts.length - 1] : '').toLowerCase();
  const email = String(c.userEmail || '').toLowerCase();
  const id = String(c.id || '').toLowerCase();
  const shortId = id.slice(0, 8);
  const haystack = `${accountName} ${formName}`.toLowerCase();
  return (
    firstName.includes(query) ||
    lastName.includes(query) ||
    haystack.includes(query) ||
    email.includes(query) ||
    id.includes(compact) ||
    shortId.includes(compact)
  );
}

/** מחזיר מצב חידוש: אישור/סגירה של הממשלה נכנסים אוטומטית לחידוש בעוד חצי שנה (ביטול רק במחיקה) */
function getRenewalStatus(c) {
  if (c.isRenewed) return RENEWAL_DONE;
  const onTrack = isOnSixMonthRenewalTrack(c);
  if (!c.renewalDate) return onTrack ? RENEWAL_IN_6_MONTHS : RENEWAL_OK;
  const renewal = new Date(c.renewalDate).getTime();
  const now = Date.now();
  if (Number.isNaN(renewal)) return onTrack ? RENEWAL_IN_6_MONTHS : RENEWAL_OK;
  if (renewal <= now) return RENEWAL_NEEDS_NOW;
  if (onTrack) return RENEWAL_IN_6_MONTHS;
  if (renewal - now <= SIX_MONTHS_MS) return RENEWAL_PENDING_CONFIRMATION;
  return RENEWAL_OK;
}

const AdminPanel = () => {
  const { user: sessionUser } = useAuth();
  const canDeleteCases = sessionUser?.canDeleteCases === true;
  const location = useLocation();
  const navigate = useNavigate();
  const stateTab = location.state?.tab;
  const stateFilter = location.state?.filter;

  const [users, setUsers] = useState([]);
  const [cases, setCases] = useState([]);
  const [mainSection, setMainSection] = useState(
    stateTab === 'users' ? 'users' : 'cases'
  );
  const [casesFilter, setCasesFilter] = useState(
    stateFilter === 'renewal_in_6_months' ? stateFilter : 'all'
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [deletingCaseId, setDeletingCaseId] = useState(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [casesPanelUserId, setCasesPanelUserId] = useState(null);
  const [hraModalCase, setHraModalCase] = useState(null);
  const [statusModalCase, setStatusModalCase] = useState(null);
  const [caseSearch, setCaseSearch] = useState('');
  const [caseStatusFilter, setCaseStatusFilter] = useState('all');
  const [caseSortOrder, setCaseSortOrder] = useState('newest');

  const handleInterimNotesChange = (caseId, interimNotes) => {
    setCases((prev) =>
      prev.map((c) => (c.id === caseId ? { ...c, interimNotes } : c))
    );
    setUsers((prev) =>
      prev.map((u) => ({
        ...u,
        cases: Array.isArray(u.cases)
          ? u.cases.map((c) => (c.id === caseId ? { ...c, interimNotes } : c))
          : u.cases,
      }))
    );
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (stateTab === 'cases') setMainSection('cases');
    if (stateTab === 'users') setMainSection('users');
    if (stateFilter === 'renewal_in_6_months') setCasesFilter(stateFilter);
    if (stateFilter === 'needs_renewal') setCasesFilter('all');
  }, [stateTab, stateFilter]);

  const fetchData = async () => {
    setLoadError('');
    const usersReq = axios.get('/admin/users').catch((error) => {
      console.error('Failed to fetch admin users:', error);
      return { data: null, error };
    });
    const casesReq = axios.get('/admin/cases').catch((error) => {
      console.error('Failed to fetch admin cases:', error);
      return { data: null, error };
    });
    const [usersRes, casesRes] = await Promise.all([usersReq, casesReq]);
    const nextUsers = Array.isArray(usersRes.data) ? usersRes.data : [];
    const nextCases = Array.isArray(casesRes.data) ? casesRes.data : [];
    setUsers(nextUsers);
    setCases(nextCases);
    const failed = [usersRes.error, casesRes.error].filter(Boolean);
    if (failed.length > 0) {
      const msg =
        failed[0].response?.data?.error ||
        (failed[0].response?.status === 403
          ? 'אין הרשאה לטעון תיקים. התנתק והתחבר מחדש עם חשבון המנהל.'
          : 'שגיאה בטעינת נתוני הניהול');
      setLoadError(msg);
    }
    setLoading(false);
    return { users: nextUsers, cases: nextCases };
  };

  const getBenefitTitle = (type) => {
    const titles = {
      family: '  (כולל הורה וילדים מתחת לגיל 18) משפחה',
      individual: 'בגיר מעל 21',
      card_order: 'הזמנת כרטיס',
      minor: 'צעיר'
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

  const handleRemoveCase = async (caseItem) => {
    if (
      !window.confirm(
        'להסיר את התיק מהמערכת לצמיתות?\n\nפעולה זו למנהל ראשי בלבד. אם זה התיק היחיד של הלקוח, חשבון המשתמש יימחק גם הוא.'
      )
    ) {
      return;
    }
    if (deletingCaseId) return;
    const expandedForUser = casesPanelUserId;
    setDeletingCaseId(caseItem.id);
    setSuccessMessage('');
    try {
      const res = await axios.delete(`/admin/cases/${caseItem.id}`);
      const fresh = await fetchData();
      if (expandedForUser && fresh?.users) {
        const u = fresh.users.find((x) => x.id === expandedForUser);
        if (!u?.cases?.length) setCasesPanelUserId(null);
      }
      if (res.data?.alreadyRemoved) {
        setSuccessMessage('התיק כבר לא היה במערכת. הרשימה עודכנה.');
      } else if (res.data?.userDeleted) {
        setSuccessMessage('התיק והמשתמש ששייכו אליו הוסרו מהמערכת.');
      } else {
        setSuccessMessage('התיק הוסר לצמיתות.');
      }
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      console.error('Failed to delete case:', err);
      const status = err.response?.status;
      if (status === 404) {
        await fetchData();
        setSuccessMessage('התיק לא נמצא (אולי כבר נמחק). הרשימה סונכרנה מחדש.');
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        const msg = err.response?.data?.error || 'שגיאה במחיקת התיק';
        alert(msg);
      }
    } finally {
      setDeletingCaseId(null);
    }
  };

  const handleUpdateCaseStatus = async (caseItem, newStatus) => {
    setStatusUpdatingId(caseItem.id);
    setSuccessMessage('');
    try {
      const res = await axios.patch(`/admin/cases/${caseItem.id}`, { status: newStatus });
      setCases((prev) =>
        prev.map((c) => (c.id === caseItem.id ? { ...c, status: res.data?.case?.status ?? newStatus } : c))
      );
      setSuccessMessage(newStatus === 'approved' ? 'התיק אושר.' : 'סטטוס התיק עודכן.');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      console.error('Failed to update case status:', err);
      alert(err.response?.data?.error || 'שגיאה בעדכון הסטטוס');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const statusLabel = (s) => {
    const labels = { submitted: 'אושר/נשלח', pending: 'ממתין', approved: 'אושר', rejected: 'נדחה', closed: 'סגור' };
    return labels[s] || s;
  };

  const casesWithRenewal = cases.map((c) => ({ ...c, renewalStatus: getRenewalStatus(c) }));
  const caseSearchQuery = caseSearch.trim().toLowerCase();
  const statusFilterOptions = (() => {
    const options = PROCESSING_STAGE_LABELS_HE.map((label, index) => ({
      value: `stage:${index + 1}`,
      label,
    }));
    const knownStages = new Set([
      ...PROCESSING_STAGE_LABELS_HE,
      ...Object.keys(LEGACY_STAGE_LABELS_HE),
    ]);
    const extraStages = new Set();
    const baseStatuses = new Set();
    for (const c of casesWithRenewal) {
      const detailed = String(c.detailedAdminStatus || '').trim();
      if (detailed && !knownStages.has(detailed)) extraStages.add(detailed);
      const base = String(c.status || '').trim().toLowerCase();
      if (base) baseStatuses.add(base);
    }
    for (const label of extraStages) {
      options.push({ value: `extra:${label}`, label });
    }
    for (const base of ['rejected', 'closed']) {
      if (baseStatuses.has(base)) options.push({ value: `status:${base}`, label: statusLabel(base) });
    }
    return options;
  })();
  const caseMatchesStatus = (c) => {
    if (caseStatusFilter === 'all') return true;
    const detailed = String(c.detailedAdminStatus || '').trim();
    if (caseStatusFilter.startsWith('stage:')) {
      return explicitStageNumberFromLabel(detailed) === Number(caseStatusFilter.slice(6));
    }
    if (caseStatusFilter.startsWith('extra:')) return detailed === caseStatusFilter.slice(6);
    if (caseStatusFilter.startsWith('status:')) {
      return String(c.status || '').toLowerCase() === caseStatusFilter.slice(7);
    }
    return true;
  };
  const filteredCases = (
    casesFilter === 'all'
      ? casesWithRenewal
      : casesWithRenewal.filter((c) => c.renewalStatus === casesFilter)
  ).filter((c) => caseMatchesSearch(c, caseSearchQuery) && caseMatchesStatus(c));
  const sortedCases = [...filteredCases].sort((a, b) => {
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    const aMs = Number.isNaN(aTime) ? 0 : aTime;
    const bMs = Number.isNaN(bTime) ? 0 : bTime;
    return caseSortOrder === 'oldest' ? aMs - bMs : bMs - aMs;
  });
  const hasCaseQuery = Boolean(caseSearchQuery) || caseStatusFilter !== 'all';

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
          כניסה כמנהל. כאן מופיעים <strong>כל התיקים</strong> וכן
          <strong> טפסים לחידוש עתידי (חצי שנה)</strong>.
        </p>
        <p className="admin-sub">משתמשים ותיקים במערכת — מנהל ראשי או מנהל משנה.</p>
        {sessionUser?.isSecondaryAdmin && (
          <p className="admin-secondary-notice" role="status">
            מנהל משנה: ניהול מלא של תיקים ואישורים; <strong>מחיקת תיק</strong> מהמערכת — רק למנהל הראשי.
          </p>
        )}
        <div className="admin-header-actions">
          <button
            type="button"
            className="admin-case-processing-btn"
            onClick={() => navigate('/admin/case-processing')}
            title="רשימה מרוכזת – אפשר גם לעדכן סטטוס מכל תיק בכפתור סטטוס הכייס"
          >
            עובדים לך על הכייס
          </button>
          <button
            type="button"
            className="admin-employee-cases-nav-btn"
            onClick={() => navigate('/admin/employee-cases')}
          >
            מעקב כייסים ותשלומים
          </button>
        </div>
      </div>

      {loadError && (
        <div className="admin-load-error" role="alert">
          {loadError}
        </div>
      )}

      <div className="admin-tabs">
        <div className="admin-tabs-main">
          <button
            className={mainSection === 'cases' ? 'active' : ''}
            onClick={() => setMainSection('cases')}
          >
            קייסים ({cases.length})
          </button>
          <button
            className={mainSection === 'users' ? 'active' : ''}
            onClick={() => setMainSection('users')}
          >
            משתמשים ({users.length})
          </button>
        </div>
        {mainSection === 'cases' && (
          <div className="admin-cases-filters admin-cases-filters-inline">
            <button
              type="button"
              className={casesFilter === 'all' ? 'active' : ''}
              onClick={() => setCasesFilter('all')}
            >
              כל התיקים ({cases.length})
            </button>
            <button
              type="button"
              className={casesFilter === RENEWAL_IN_6_MONTHS ? 'active' : ''}
              onClick={() => setCasesFilter(RENEWAL_IN_6_MONTHS)}
            >
              טפסים לחידוש עתידי (חצי שנה) ({countIn6Months})
            </button>
          </div>
        )}
      </div>

      {mainSection === 'users' && (
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
                <th>תשלום מאוחר</th>
                <th>סטטוס</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-state">
                    אין משתמשים במערכת.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <Fragment key={user.id}>
                    <tr>
                      <td data-label="שם">{user.name}</td>
                      <td data-label="אימייל">{user.email}</td>
                      <td data-label="טלפון">{user.phone}</td>
                      <td data-label="תאריך הרשמה">{formatDate(user.createdAt)}</td>
                      <td data-label="מספר קייסים">{user.casesCount}</td>
                      <td data-label="תשלום מאוחר">
                        {user.role === 'admin' || user.role === 'Admin' ? (
                          <span className="admin-actions-empty">—</span>
                        ) : user.deferredPaymentApproved ? (
                          <span className="status-badge renewal-ok" title={user.deferredPaymentDeadline || ''}>
                            אושר עד {formatDate(user.deferredPaymentDeadline)}
                          </span>
                        ) : user.deferredPaymentProposalPending ? (
                          <span className="status-badge renewal-pending_confirmation">ממתין לאישור תאריך</span>
                        ) : user.deferredPaymentAwaitingClientDate ? (
                          <span className="status-badge renewal-renewal_in_6_months">ממתין לתאריך מלקוח</span>
                        ) : user.deferredPaymentRequestPending ? (
                          <span className="status-badge renewal-pending_confirmation">ממתין למנהל ראשי</span>
                        ) : (
                          <span className="admin-actions-empty">—</span>
                        )}
                      </td>
                      <td data-label="סטטוס">
                        <span className={`status-badge ${user.role}`}>
                          {(user.role || '').toLowerCase() === 'admin' ? 'מנהל מערכת' : 'משתמש'}
                        </span>
                      </td>
                      <td data-label="פעולות">
                        <div className="admin-user-actions-stack">
                          {(user.role || '').toLowerCase() !== 'admin' &&
                          Array.isArray(user.cases) &&
                          user.cases.length > 0 ? (
                            <button
                              type="button"
                              className="admin-user-cases-toggle-btn"
                              onClick={() =>
                                setCasesPanelUserId(casesPanelUserId === user.id ? null : user.id)
                              }
                            >
                              {casesPanelUserId === user.id
                                ? 'סגור תיקים'
                                : `ניהול תיקים (${user.cases.length})`}
                            </button>
                          ) : (
                            <span className="admin-actions-empty">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {casesPanelUserId === user.id &&
                    (user.role || '').toLowerCase() !== 'admin' &&
                    Array.isArray(user.cases) &&
                    user.cases.length > 0 ? (
                      <tr className="admin-user-cases-expand-row">
                        <td colSpan={8}>
                          <div className="admin-user-cases-panel">
                            <p className="admin-user-cases-panel-title">
                              תיקים של {user.name}
                              {canDeleteCases ? ' – הסרת תיקים לא רלוונטיים' : ''}
                            </p>
                            <table className="admin-user-cases-inner-table">
                              <thead>
                                <tr>
                                  <th>סוג הטבה</th>
                                  <th>תאריך יצירה</th>
                                  <th>סטטוס</th>
                                  <th>פעולות</th>
                                </tr>
                              </thead>
                              <tbody>
                                {user.cases.map((caseItem) => (
                                  <tr
                                    key={caseItem.id}
                                    className={getCaseStageToneClass(caseItem) || undefined}
                                  >
                                    <td data-label="סוג הטבה">{getBenefitTitle(caseItem.benefitType)}</td>
                                    <td data-label="תאריך יצירה">{formatDate(caseItem.createdAt)}</td>
                                    <td data-label="סטטוס">
                                      <span className={`status-badge ${caseItem.status || ''}`}>
                                        {statusLabel(caseItem.status)}
                                      </span>
                                    </td>
                                    <td data-label="פעולות">
                                      <div className="admin-actions-cell">
                                        <button
                                          type="button"
                                          className="admin-view-form-btn"
                                          onClick={() => navigate(`/admin/cases/${caseItem.id}`)}
                                        >
                                          צפה בטופס
                                        </button>
                                        <button
                                          type="button"
                                          className="admin-case-status-btn"
                                          onClick={() =>
                                            setStatusModalCase({
                                              ...caseItem,
                                              userName: caseItem.userName || user.name,
                                              userEmail: caseItem.userEmail || user.email,
                                              userPhone: caseItem.userPhone || user.phone,
                                            })
                                          }
                                        >
                                          סטטוס הכייס
                                        </button>
                                        <CaseInterimNotesButton
                                          caseId={caseItem.id}
                                          caseLabel={`${user.name || ''} · ${getBenefitTitle(caseItem.benefitType)}`}
                                          notes={caseItem.interimNotes}
                                          onNotesChange={handleInterimNotesChange}
                                        />
                                        <button
                                          type="button"
                                          className={`admin-hra-btn${hasHraContent(caseItem.hraDetails) ? ' is-filled' : ''}`}
                                          onClick={() =>
                                            setHraModalCase({
                                              id: caseItem.id,
                                              label: `${user.name || ''} · ${getBenefitTitle(caseItem.benefitType)}`,
                                            })
                                          }
                                        >
                                          {hasHraContent(caseItem.hraDetails)
                                            ? 'פרטים מהאתר HRA לכייס'
                                            : 'העלת פרטים לכייס'}
                                        </button>
                                        {canDeleteCases ? (
                                          <button
                                            type="button"
                                            className="admin-remove-btn"
                                            onClick={() => handleRemoveCase(caseItem)}
                                            disabled={deletingCaseId !== null}
                                          >
                                            {deletingCaseId === caseItem.id ? 'מוחק...' : 'הסר תיק'}
                                          </button>
                                        ) : null}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {mainSection === 'cases' && (
        <>
          <form
            className="admin-case-search"
            onSubmit={(e) => e.preventDefault()}
            role="search"
          >
            <input
              type="search"
              value={caseSearch}
              onChange={(e) => setCaseSearch(e.target.value)}
              placeholder="חיפוש לפי שם פרטי, שם משפחה, אימייל או מספר תיק"
              aria-label="חיפוש תיקים לפי שם, אימייל או מספר תיק"
            />
            <select
              className="admin-case-status-filter"
              value={caseStatusFilter}
              onChange={(e) => setCaseStatusFilter(e.target.value)}
              aria-label="סינון לפי סטטוס התיק"
            >
              <option value="all">כל הסטטוסים</option>
              {statusFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="admin-case-sort-btn"
              onClick={() => setCaseSortOrder((current) => (current === 'newest' ? 'oldest' : 'newest'))}
              aria-label="החלפת סדר התיקים לפי תאריך יצירה"
            >
              {caseSortOrder === 'newest' ? 'מהחדש לישן' : 'מהישן לחדש'}
            </button>
            <button type="submit">חיפוש</button>
            {hasCaseQuery ? (
              <button
                type="button"
                className="admin-case-search-clear"
                onClick={() => {
                  setCaseSearch('');
                  setCaseStatusFilter('all');
                }}
              >
                נקה
              </button>
            ) : null}
          </form>
          <div className="admin-table-container">
            <table className="admin-table admin-table-cards">
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
                        : hasCaseQuery
                          ? 'לא נמצא תיק לפי החיפוש או הסטטוס. נסה שם, מספר תיק או סטטוס אחר.'
                          : 'אין תיקים בקטגוריה זו'}
                    </td>
                  </tr>
                ) : (
                  sortedCases.map((caseItem) => (
                    <tr
                      key={caseItem.id}
                      className={getCaseStageToneClass(caseItem) || undefined}
                    >
                      <td data-label="שם משתמש">{caseItem.userName}</td>
                      <td data-label="אימייל">{caseItem.userEmail}</td>
                      <td data-label="טלפון">{caseItem.userPhone}</td>
                      <td data-label="סוג הטבה">{getBenefitTitle(caseItem.benefitType)}</td>
                      <td data-label="תאריך יצירה">{formatDate(caseItem.createdAt)}</td>
                      <td data-label="תאריך חידוש">{formatDate(caseItem.renewalDate)}</td>
                      <td data-label="מצב חידוש">
                        <span className={`status-badge renewal-${caseItem.renewalStatus}`}>
                          {renewalLabel(caseItem.renewalStatus)}
                        </span>
                      </td>
                      <td data-label="סטטוס תיק">
                        <span className={`status-badge ${caseItem.status}`}>
                          {statusLabel(caseItem.status)}
                        </span>
                      </td>
                      <td data-label="פעולות">
                        <div className="admin-actions-cell">
                          <button
                            type="button"
                            className="admin-view-form-btn"
                            onClick={() => navigate(`/admin/cases/${caseItem.id}`)}
                          >
                            צפה בטופס
                          </button>
                          <button
                            type="button"
                            className="admin-case-status-btn"
                            onClick={() => setStatusModalCase(caseItem)}
                          >
                            סטטוס הכייס
                          </button>
                          <CaseInterimNotesButton
                            caseId={caseItem.id}
                            caseLabel={`${caseItem.userName || ''} · ${getBenefitTitle(caseItem.benefitType)}`}
                            notes={caseItem.interimNotes}
                            onNotesChange={handleInterimNotesChange}
                          />
                          <button
                            type="button"
                            className={`admin-hra-btn${hasHraContent(caseItem.hraDetails) ? ' is-filled' : ''}`}
                            onClick={() =>
                              setHraModalCase({
                                id: caseItem.id,
                                label: `${caseItem.userName || ''} · ${getBenefitTitle(caseItem.benefitType)}`,
                              })
                            }
                          >
                            {hasHraContent(caseItem.hraDetails)
                              ? 'פרטים מהאתר HRA לכייס'
                              : 'העלת פרטים לכייס'}
                          </button>
                          {canDeleteCases ? (
                            <button
                              type="button"
                              className="admin-remove-btn"
                              onClick={() => handleRemoveCase(caseItem)}
                              disabled={deletingCaseId !== null}
                            >
                              {deletingCaseId === caseItem.id ? 'מוחק...' : 'הסר'}
                            </button>
                          ) : null}
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

      {hraModalCase ? (
        <HraDetailsModal
          caseId={hraModalCase.id}
          caseLabel={hraModalCase.label}
          onClose={() => setHraModalCase(null)}
          onSaved={async () => {
            setSuccessMessage('פרטי HRA נשמרו לתיק');
            await fetchData();
          }}
        />
      ) : null}

      {statusModalCase ? (
        <CaseStatusModal
          caseItem={statusModalCase}
          onClose={() => setStatusModalCase(null)}
          onUpdated={async (updated) => {
            if (updated) {
              setCases((prev) =>
                prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
              );
              setUsers((prev) =>
                prev.map((u) => ({
                  ...u,
                  cases: Array.isArray(u.cases)
                    ? u.cases.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
                    : u.cases,
                }))
              );
            }
            setSuccessMessage('סטטוס הכייס עודכן');
            await fetchData();
          }}
        />
      ) : null}

      <div className="admin-stats">
        <div className="stat-card">
          <h3>סה"כ משתמשים</h3>
          <p className="stat-number">{users.length}</p>
        </div>
        <div className="stat-card">
          <h3>כל התיקים</h3>
          <p className="stat-number">{cases.length}</p>
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
