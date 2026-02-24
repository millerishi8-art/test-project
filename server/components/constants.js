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
    EMAIL_NOT_VERIFIED: 'נא לאמת את כתובת האימייל לפני ההתחברות. בדוק את תיבת הדואר (כולל דואר זבל) ולחץ על הקישור שנשלח.',
    TOKEN_REQUIRED: 'נדרש טוקן גישה',
    TOKEN_INVALID: 'טוקן לא תקין או שפג תוקפו',
    ADMIN_REQUIRED: 'נדרשת הרשאת מנהל',
    USER_NOT_FOUND: 'משתמש לא נמצא',
    VERIFICATION_TOKEN_INVALID: 'קישור האימות לא תקף או שפג תוקפו.',
    VERIFICATION_CODE_INVALID: 'הקוד לא תקף. בדוק שהזנת 6 ספרות נכונות.',
    VERIFICATION_CODE_EXPIRED: 'תוקף הקוד פג. בקש קוד חדש (שלח שוב אימייל אימות).',
    PHONE_CODE_INVALID: 'קוד האימות לא תקף או שפג תוקפו. בקש קוד חדש.',
    PHONE_REQUIRED: 'לא נמצא מספר טלפון. הזן אימייל של חשבון שנרשם עם טלפון.',
    PASSWORD_RESET_CODE_INVALID: 'הקוד לא תקף או שפג תוקפו. בקש קוד חדש.',
    PASSWORD_REQUIRED: 'נא להזין סיסמה חדשה.',
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
    DB_UNAVAILABLE: 'מסד הנתונים לא זמין. וודא שהשרת רץ ו-MongoDB מחובר (MONGODB_URI ב-server/.env).',
  },
};

/** הודעות הצלחה (עברית) */
export const SUCCESS_MESSAGES = {
  AUTH: {
    REGISTRATION: 'ההרשמה בוצעה בהצלחה. נשלח אליך אימייל לאימות – אנא לחץ על הקישור באימייל ואז התחבר. אם אינך מוצא את האימייל – בדוק בתיקיית דואר זבל (Spam/Junk) ובכל תיקיות תיבת הדואר.',
    REGISTRATION_EMAIL_FAILED: 'ההרשמה בוצעה בהצלחה, אך שליחת אימייל האימות נכשלה. השתמש בלחצן "שלח שוב אימייל אימות" בדף ההתחברות. כמו כן בדוק דואר זבל (Spam) ותיקיות אחרות.',
    LOGIN: 'ההתחברות בוצעה בהצלחה',
    EMAIL_VERIFIED: 'האימייל אומת בהצלחה. כעת ניתן להתחבר.',
    VERIFICATION_EMAIL_SENT: 'נשלח שוב אימייל אימות לכתובת שלך. אם אינך מוצא – בדוק דואר זבל (Spam/Junk) וכל התיקיות.',
    PHONE_CODE_SENT: 'נשלח קוד אימות למספר הטלפון שנרשם. התוקף 10 דקות.',
    PHONE_VERIFIED: 'האימות הושלם. כעת ניתן להתחבר.',
    PASSWORD_RESET_SENT: 'אם הכתובת קיימת במערכת, נשלח אליך קוד איפוס סיסמה. בדוק את תיבת הדואר (כולל דואר זבל).',
    PASSWORD_RESET_SUCCESS: 'הסיסמה עודכנה בהצלחה. כעת ניתן להתחבר עם הסיסמה החדשה.',
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
