/**
 * קבועים ומשתני נתונים למערכת סוכן ביטוח
 */

/** תפקידי משתמש */
export const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
};

/** סטטוסי תיק */
export const CASE_STATUS = {
  SUBMITTED: 'submitted',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

/** סוגי הטבות (מזהה) */
export const BENEFIT_TYPES = {
  FAMILY: 'family',
  INDIVIDUAL: 'individual',
  MINOR: 'minor',
};

/** הודעות שגיאה (עברית) */
export const ERROR_MESSAGES = {
  AUTH: {
    FIELDS_REQUIRED: 'כל השדות חובה',
    EMAIL_PASSWORD_REQUIRED: 'אימייל וסיסמה חובה',
    USER_EXISTS: 'משתמש עם אימייל זה כבר קיים',
    INVALID_CREDENTIALS: 'פרטי התחברות לא תקינים',
    TOKEN_REQUIRED: 'נדרש טוקן גישה',
    TOKEN_INVALID: 'טוקן לא תקין או שפג תוקפו',
    ADMIN_REQUIRED: 'נדרשת הרשאת מנהל',
    USER_NOT_FOUND: 'משתמש לא נמצא',
  },
  CASES: {
    REQUIRED_FIELDS: 'חסרים שדות חובה',
    CASE_NOT_FOUND: 'תיק לא נמצא',
  },
  SERVER: {
    REGISTRATION: 'שגיאת שרת בהרשמה',
    LOGIN: 'שגיאת שרת בהתחברות',
    CASE_SUBMIT: 'שגיאת שרת בשליחת תיק',
    CASE_RENEW: 'שגיאת שרת בחידוש תיק',
  },
};

/** הודעות הצלחה (עברית) */
export const SUCCESS_MESSAGES = {
  AUTH: {
    REGISTRATION: 'ההרשמה בוצעה בהצלחה',
    LOGIN: 'ההתחברות בוצעה בהצלחה',
  },
  CASES: {
    SUBMITTED: 'התיק נשלח בהצלחה',
    RENEWED: 'התיק חודש בהצלחה',
  },
};

/** ברירת מחדל לחידוש תיק (חודשים) */
export const RENEWAL_MONTHS = 6;

/** ברירת מחדל כשמשתמש לא נמצא (תצוגת אדמין) */
export const DEFAULT_UNKNOWN = 'לא ידוע';
