import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './AdminChangeNoticeModal.css';

const SEEN_KEY = 'adminNoticeSeenIds';

function readLocalSeen() {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

function addLocalSeen(id) {
  const next = [...new Set([...readLocalSeen(), String(id)])];
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(next.slice(-80)));
  } catch {
    /* ignore */
  }
}

const AdminChangeNoticeModal = () => {
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const [notice, setNotice] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [acking, setAcking] = useState(false);

  const loadUnseen = useCallback(async () => {
    if (!isAdmin || !user?.email) return;
    try {
      const res = await axios.get('/admin/notices/unseen');
      const list = Array.isArray(res.data?.notices) ? res.data.notices : [];
      const localSeen = new Set(readLocalSeen());
      const unseen = list.filter((n) => n?.id && !localSeen.has(String(n.id)));
      setNotice(unseen[0] || null);
      setRemaining(unseen.length);
    } catch {
      /* הטבלה עדיין לא הוגדרה / אין הרשאה */
    }
  }, [isAdmin, user?.email]);

  useEffect(() => {
    loadUnseen();
    const t = setInterval(loadUnseen, 45000);
    const onFocus = () => loadUnseen();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadUnseen]);

  const handleAck = async () => {
    if (!notice?.id || acking) return;
    setAcking(true);
    addLocalSeen(notice.id);
    try {
      try {
        await axios.post(`/admin/notices/${notice.id}/ack`);
      } catch {
        /* גם בלי שרת – לא יוצג שוב בדפדפן הזה */
      }
      await loadUnseen();
    } finally {
      setAcking(false);
    }
  };

  const openCase = () => {
    if (!notice?.caseId) return;
    navigate(`/admin/cases/${notice.caseId}`);
  };

  if (!isAdmin || !notice) return null;

  const steps = Array.isArray(notice.steps) ? notice.steps : [];

  return (
    <div className="admin-notice-overlay" role="dialog" aria-modal="true" aria-labelledby="admin-notice-title">
      <div className="admin-notice-modal">
        <p className="admin-notice-kicker">עדכון לצוות המנהלים</p>
        <h2 id="admin-notice-title">{notice.title || 'שינוי בכייס'}</h2>
        {notice.clientName ? (
          <p className="admin-notice-client">כייס של {notice.clientName}</p>
        ) : null}
        {remaining > 1 ? (
          <p className="admin-notice-count">עדכון 1 מתוך {remaining}</p>
        ) : null}
        <ol className="admin-notice-steps">
          {steps.map((step, i) => (
            <li key={i}>
              <span className="admin-notice-step-num">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <div className="admin-notice-actions">
          {notice.caseId ? (
            <button type="button" className="admin-notice-secondary" onClick={openCase}>
              פתיחת הכייס
            </button>
          ) : null}
          <button type="button" className="admin-notice-primary" onClick={handleAck} disabled={acking}>
            {acking ? 'שומר...' : remaining > 1 ? 'הבנתי, הבא' : 'הבנתי'}
          </button>
        </div>
        <p className="admin-notice-once">החלון יופיע פעם אחת בלבד לכל עדכון.</p>
      </div>
    </div>
  );
};

export default AdminChangeNoticeModal;
