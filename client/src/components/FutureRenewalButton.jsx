import { useState } from 'react';
import axios from 'axios';

function pad(n) {
  return String(n).padStart(2, '0');
}

function toYmd(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function shiftFromToday(days = 0, months = 0) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  if (months) date.setMonth(date.getMonth() + months);
  if (days) date.setDate(date.getDate() + days);
  return toYmd(date);
}

function formatYmd(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ''))) return '';
  const [year, month, day] = ymd.split('-');
  return `${day}.${month}.${year}`;
}

const QUICK_CHOICES = [
  { id: '2w', label: 'שבועיים', renewOn: () => shiftFromToday(14, 0) },
  { id: '1m', label: 'חודש', renewOn: () => shiftFromToday(0, 1) },
  { id: '3m', label: '3 חודשים', renewOn: () => shiftFromToday(0, 3) },
  { id: '6m', label: 'חצי שנה', renewOn: () => shiftFromToday(0, 6) },
  { id: '1y', label: 'שנה', renewOn: () => shiftFromToday(0, 12) },
];

export default function FutureRenewalButton({ caseId, caseLabel = '', renewalDate = '', onScheduled }) {
  const [open, setOpen] = useState(false);
  const [renewOn, setRenewOn] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const minDate = shiftFromToday(1, 0);

  const openModal = () => {
    const existing = renewalDate ? String(renewalDate).slice(0, 10) : '';
    setRenewOn(/^\d{4}-\d{2}-\d{2}$/.test(existing) && existing > minDate ? existing : '');
    setError('');
    setOpen(true);
  };

  const save = async () => {
    if (!renewOn || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await axios.patch(`/admin/cases/${caseId}/future-renewal`, { renewOn });
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
      onScheduled?.(res.data?.case);
      setOpen(false);
    } catch (err) {
      setError(err.response?.data?.error || 'שמירת החידוש נכשלה. נסו שוב.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button type="button" className="admin-future-renewal-btn" onClick={openModal}>
        חידוש עתידי
      </button>
      {open ? (
        <div className="future-renewal-backdrop" onClick={() => (saving ? null : setOpen(false))} role="presentation">
          <div
            className="future-renewal-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="future-renewal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="future-renewal-title">לעוד כמה זמן תרצה לחדש את הכייס?</h3>
            {caseLabel ? <p className="future-renewal-case">{caseLabel}</p> : null}
            <div className="future-renewal-choices">
              {QUICK_CHOICES.map((choice) => {
                const value = choice.renewOn();
                return (
                  <button
                    key={choice.id}
                    type="button"
                    className={renewOn === value ? 'is-selected' : ''}
                    onClick={() => setRenewOn(value)}
                  >
                    {choice.label}
                  </button>
                );
              })}
            </div>
            <label className="future-renewal-date-label" htmlFor={`future-renewal-${caseId}`}>
              או בחירת תאריך
            </label>
            <input
              id={`future-renewal-${caseId}`}
              type="date"
              min={minDate}
              value={renewOn}
              onChange={(event) => setRenewOn(event.target.value)}
            />
            {renewOn ? (
              <p className="future-renewal-result">תאריך החידוש: {formatYmd(renewOn)}</p>
            ) : (
              <p className="future-renewal-result">בחרו כמה זמן קדימה, או תאריך מדויק.</p>
            )}
            <p className="future-renewal-hint">שבוע לפני התאריך תיפתח התראה במחשב.</p>
            {error ? <p className="future-renewal-error">{error}</p> : null}
            <div className="future-renewal-actions">
              <button type="button" className="future-renewal-save" onClick={save} disabled={!renewOn || saving}>
                {saving ? 'שומר...' : 'קביעת החידוש'}
              </button>
              <button type="button" className="future-renewal-cancel" onClick={() => setOpen(false)} disabled={saving}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
