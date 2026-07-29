/**
 * מנהל ראשי (סופר־אדמין) + מנהלי משנה.
 *
 * מנהל ראשי: SUPER_ADMIN_EMAIL / ADMIN_EMAIL / ברירת מחדל.
 * מנהלי משנה: SECONDARY_ADMIN_EMAILS (מופרד בפסיקים). אם לא הוגדר — ברירת מחדל בקוד.
 * מנהל משנה: אותן הרשאות בפאנל למעט מחיקת תיקים (ותיקי יתום בשרת) — רק הראשי.
 */

/** מייל מנהל־העל הקנוני */
export const DEFAULT_PRIMARY_ADMIN_EMAIL = 'millerbitoach@gmail.com';

/**
 * כתיבים חלופיים שנחשבים גם הם מנהל־על
 * (למשל טעות כתיב) — כדי לא לכפות הרשמה מחדש.
 */
export const SUPER_ADMIN_EMAIL_ALIASES = ['millerbituach@gmail.com'];

/** ברירת מחדל כשלא מוגדר SECONDARY_ADMIN_EMAILS */
export const DEFAULT_SECONDARY_ADMIN_EMAILS = [
  'abergelyuda7@gmail.com',
  'shneortole257@gmail.com',
];

function normalizeEmail(email) {
  return String(email == null ? '' : email)
    .trim()
    .toLowerCase();
}

/** מייל מנהל־העל הקנוני — מקור אמת לפעולות רגישות (מחיקת תיקים וכו') */
export function getSuperAdminEmail() {
  const raw = process.env.SUPER_ADMIN_EMAIL || process.env.ADMIN_EMAIL || DEFAULT_PRIMARY_ADMIN_EMAIL;
  const s = typeof raw === 'string' ? raw : String(raw || '');
  return s.trim().toLowerCase();
}

/** כל המיילים שנחשבים מנהל־על (קנוני + aliases + ברירת מחדל) */
export function getSuperAdminEmailAliases() {
  const primary = getSuperAdminEmail();
  const extras = [DEFAULT_PRIMARY_ADMIN_EMAIL, ...SUPER_ADMIN_EMAIL_ALIASES]
    .map(normalizeEmail)
    .filter(Boolean);
  return [...new Set([primary, ...extras].filter(Boolean))];
}

export function isSuperAdminEmail(email) {
  const e = normalizeEmail(email);
  if (!e) return false;
  return getSuperAdminEmailAliases().includes(e);
}

/** רשימת מיילים של מנהלי משנה (בלי המנהל הראשי) */
export function getSecondaryAdminEmails() {
  const raw = process.env.SECONDARY_ADMIN_EMAILS;
  if (raw != null && String(raw).trim() !== '') {
    const list = String(raw)
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return [...new Set(list)];
  }
  return [...DEFAULT_SECONDARY_ADMIN_EMAILS];
}

export function isSecondaryAdminEmail(email) {
  const e = normalizeEmail(email);
  if (!e || isSuperAdminEmail(e)) return false;
  return getSecondaryAdminEmails().includes(e);
}

/** גישה לפאנל /api/admin — מנהל ראשי או משנה */
export function isAnyAdminPanelEmail(email) {
  return isSuperAdminEmail(email) || isSecondaryAdminEmail(email);
}

/** לתאימות קוד ישן — כל מי שמורשה בפאנל הניהול */
export function getAllowedAdminEmails() {
  const primaryAliases = getSuperAdminEmailAliases();
  const sec = getSecondaryAdminEmails();
  const all = [...primaryAliases, ...sec];
  return [...new Set(all)];
}

/** מורשה בפאנל ניהול */
export function isAllowedAdminEmail(email) {
  return isAnyAdminPanelEmail(email);
}
