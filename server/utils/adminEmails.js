/**
 * מיילים שמורשים לגשת לנתיבי /admin (בנוסף ל-role=admin).
 *
 * - ADMIN_ALLOWED_EMAILS או ADMIN_EMAILS (מופרד בפסיקים) – רשימה מלאה; דורסת את שאר הכללים.
 * - אחרת: ADMIN_EMAIL (או ברירת millerbitoach) + lapidwoldenberg תמיד – כדי שפריסה עם רק ADMIN_EMAIL
 *   ב-Vercel לא תחסום מנהל משנה.
 * - מנהל יחיד בלבד: הגדר ADMIN_ALLOWED_EMAILS עם מייל אחד בלבד.
 *
 * ניהול הורדת מנהלים: רק getSuperAdminEmail() – SUPER_ADMIN_EMAIL או ADMIN_EMAIL או ברירת millerbitoach.
 */

/** מנהלים נוספים שתמיד מסונכרנים עם המנהל הראשי כשלא משתמשים ב-ADMIN_ALLOWED_EMAILS */
const ALWAYS_ALLOWED_WITH_PRIMARY = ['lapidwoldenberg@gmail.com'];

function normalizeList(str) {
  return str
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function getAllowedAdminEmails() {
  const multi = (process.env.ADMIN_ALLOWED_EMAILS || process.env.ADMIN_EMAILS || '').trim();
  if (multi) return normalizeList(multi);
  const primary = (process.env.ADMIN_EMAIL || 'millerbitoach@gmail.com').trim().toLowerCase();
  const set = new Set([primary, ...ALWAYS_ALLOWED_WITH_PRIMARY]);
  return [...set];
}

export function isAllowedAdminEmail(email) {
  const e = (email || '').trim().toLowerCase();
  if (!e) return false;
  return new Set(getAllowedAdminEmails()).has(e);
}

/** מייל מנהל-על: הורדת/ניהול מנהלים אחרים – רק הוא (ברירת מחדל miller). SUPER_ADMIN_EMAIL או ADMIN_EMAIL */
export function getSuperAdminEmail() {
  return (process.env.SUPER_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'millerbitoach@gmail.com')
    .trim()
    .toLowerCase();
}

export function isSuperAdminEmail(email) {
  const e = (email || '').trim().toLowerCase();
  if (!e) return false;
  return e === getSuperAdminEmail();
}
