/**
 * מנהל מערכת יחיד (סופר־אדמין): מייל אחד מהסביבה + אותו חשבון בהתחברות.
 *
 * משתנים: SUPER_ADMIN_EMAIL (מועדף) או ADMIN_EMAIL, אחרת ברירת מחדל בקוד.
 * אין רשימת מנהלים משנה ואין ADMIN_ALLOWED_EMAILS — גישה ל־/admin רק למייל הזה.
 */

export const DEFAULT_PRIMARY_ADMIN_EMAIL = 'millerbitoach@gmail.com';

/** מייל מנהל־העל — מקור אמת יחיד לניהול */
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

/** לתאימות קוד ישן — תמיד מחזיר לכל היותר מייל אחד */
export function getAllowedAdminEmails() {
  const e = getSuperAdminEmail();
  return e ? [e] : [];
}

/** מזהה כמו isSuperAdminEmail */
export function isAllowedAdminEmail(email) {
  return isSuperAdminEmail(email);
}
