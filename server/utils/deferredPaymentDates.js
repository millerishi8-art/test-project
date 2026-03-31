/** YYYY-MM-DD בזמן UTC מתאריך */
export function toYyyyMmDdUtc(isoOrDate) {
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** תוקף מחרוזת תאריך YYYY-MM-DD */
export function parseYyyyMmDd(raw) {
  const str = String(raw || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const d = new Date(`${str}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return str;
}

export function utcTodayYyyyMmDd() {
  return toYyyyMmDdUtc(new Date());
}

export function isYmdInRange(ymd, minYmd, maxYmd) {
  if (!ymd || !minYmd || !maxYmd) return false;
  return ymd >= minYmd && ymd <= maxYmd;
}

/** תאריך היום בלוח שנה ישראלי (YYYY-MM-DD) */
export function todayIsraelYyyyMmDd() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
}

/** הפרש ימים בין שני תאריכי YYYY-MM-DD (toY - fromY) */
export function daysBetweenYmd(fromYmd, toYmd) {
  const a = new Date(`${fromYmd}T12:00:00Z`).getTime();
  const b = new Date(`${toYmd}T12:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

/** יום אחד לפני ymd (למגבלת date input כשחייבים תאריך לפני exclusive) */
export function subtractOneDayYmd(ymd) {
  const d = new Date(`${ymd}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() - 1);
  return toYyyyMmDdUtc(d);
}
