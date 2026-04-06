/**
 * מיילים שמורשים לגשת לנתיבי /admin (בנוסף ל-role=admin).
 *
 * - ADMIN_ALLOWED_EMAILS או ADMIN_EMAILS (מופרד בפסיקים) – רשימה מלאה; דורסת את שאר הכללים.
 * - אחרת: ADMIN_EMAIL (או ברירת DEFAULT_PRIMARY_ADMIN_EMAIL) + מנהלי משנה קבועים (lapid, shneortole257) – כדי שפריסה עם רק ADMIN_EMAIL
 *   ב-Vercel לא תחסום מנהל משנה.
 * - מנהל יחיד בלבד: הגדר ADMIN_ALLOWED_EMAILS עם מייל אחד בלבד.
 *
 * ניהול הורדת מנהלים: רק getSuperAdminEmail() – SUPER_ADMIN_EMAIL או ADMIN_EMAIL או ברירת המחדל למטה.
 */

/** מנהל-על ברירת מחדל (פאנל סופר-אדמין + התאמות seed/create-admin) */
export const DEFAULT_PRIMARY_ADMIN_EMAIL = 'millerbitoach@gmail.com';

/**
 * מנהלי משנה שתמיד מורשים ל-/admin (אותן הרשאות כמו lapid).
 * מנהל על: רק isSuperAdminEmail() — DEFAULT_PRIMARY_ADMIN_EMAIL אם אין SUPER_ADMIN_EMAIL / ADMIN_EMAIL.
 */
const ALWAYS_ALLOWED_WITH_PRIMARY = [
  'lapidwoldenberg@gmail.com',
  'shneortole257@gmail.com',
];

function normalizeList(str) {
  return str
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function getAllowedAdminEmails() {
  const multi = (process.env.ADMIN_ALLOWED_EMAILS || process.env.ADMIN_EMAILS || '').trim();
  if (multi) return normalizeList(multi);
  const primary = (process.env.ADMIN_EMAIL || DEFAULT_PRIMARY_ADMIN_EMAIL).trim().toLowerCase();
  const set = new Set([primary, ...ALWAYS_ALLOWED_WITH_PRIMARY]);
  return [...set];
}

export function isAllowedAdminEmail(email) {
  const e = String(email == null ? '' : email)
    .trim()
    .toLowerCase();
  if (!e) return false;
  return new Set(getAllowedAdminEmails()).has(e);
}

/** מייל מנהל-על: הורדת/ניהול מנהלים אחרים – רק הוא. SUPER_ADMIN_EMAIL או ADMIN_EMAIL או DEFAULT_PRIMARY_ADMIN_EMAIL */
export function getSuperAdminEmail() {
  const raw = process.env.SUPER_ADMIN_EMAIL || process.env.ADMIN_EMAIL || DEFAULT_PRIMARY_ADMIN_EMAIL;
  const s = typeof raw === 'string' ? raw : String(raw || '');
  return s.trim().toLowerCase();
}

export function isSuperAdminEmail(email) {
  const e = String(email == null ? '' : email)
    .trim()
    .toLowerCase();
  if (!e) return false;
  return e === getSuperAdminEmail();
}
