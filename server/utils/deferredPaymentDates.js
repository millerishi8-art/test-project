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

/** לא יאוחר מחודש ממועד אישור הבקשה הראשון (על בסיס לוח שנה) */
export function maxProposedYyyyMmDdFromApprovedAt(approvedAtIso) {
  const d = new Date(approvedAtIso);
  if (Number.isNaN(d.getTime())) return null;
  const end = new Date(d);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return toYyyyMmDdUtc(end);
}

export function isYmdInRange(ymd, minYmd, maxYmd) {
  if (!ymd || !minYmd || !maxYmd) return false;
  return ymd >= minYmd && ymd <= maxYmd;
}
