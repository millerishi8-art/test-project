/**
 * תואם ל־PROCESSING_STAGES בשרת (adminController) ול־AdminCaseProcessing.
 * שלב 0 = נשלח מהלקוח, עדיין לא עודכן שלב עיבוד במערכת הניהול.
 */
export const PROCESSING_STAGE_LABELS_HE = [
  'נפתחה בקשה',
  'נעשה ראיון',
  'הוגשו טפסים',
  'הכייס סגור',
  'הכייס אושר',
];

/** ניסוחים ארוכים שנשמרו בתיקים קיימים – עדיין מזוהים כאותו שלב */
export const LEGACY_STAGE_LABELS_HE = {
  'נפתחה הבקשה באתר מחכה לראיון אישי': 1,
  'נפתח הבקשה באתר מחכה לראיון אישי': 1,
  'נעשה ראיון מחכה להגשת טפסים': 2,
  'הוגשו טפסים מחכה לאישור הממשלה': 3,
  'הממשלה סגרה את הכייס': 4,
  'אושר על ידי הממשלה': 5,
};

/** גרסה ישנה לפני תיקון ניסוח (נפתח → נפתחה) */
export const LEGACY_HE_STAGE1 = 'נפתח הבקשה באתר מחכה לראיון אישי';

/** מספר שלב לפי הטקסט השמור, בלי לנחש מסטטוס כללי כמו «ממתין» */
export function explicitStageNumberFromLabel(label) {
  const d = String(label || '').trim();
  if (!d) return 0;
  const index = PROCESSING_STAGE_LABELS_HE.indexOf(d);
  if (index >= 0) return index + 1;
  return LEGACY_STAGE_LABELS_HE[d] || 0;
}

/** הנוסח הקצר להצגה, גם אם בתיק שמור הנוסח הארוך הישן */
export function shortStageLabel(label) {
  const n = explicitStageNumberFromLabel(label);
  return n ? PROCESSING_STAGE_LABELS_HE[n - 1] : String(label || '').trim();
}

/**
 * @returns {number} 0–5
 */
export function getProcessingStageNumber(c) {
  if (!c) return 0;
  const marked = explicitStageNumberFromLabel(c.detailedAdminStatus);
  if (marked) return marked;

  const s = (c.status || '').toLowerCase();
  if (s === 'approved') return 5;
  if (s === 'closed' || s === 'rejected') return 4;
  if (s === 'submitted') return 0;
  if (s === 'pending') return 1;
  return 0;
}

/** תיק שהגיע לאישור סופי או סומן כמוכן לחידוש — מתאים להצגת שירות משלים בסוף התהליך */
export function isCaseProcessingSuccessfulEnd(c) {
  if (!c) return false;
  if (c.adminConfirmedCompleted) return true;
  return getProcessingStageNumber(c) === 5;
}

/** תיק שנסגר (ממשלה / דחייה / סטטוס סגור) – למסגרת אדומה בפאנל ובסטטוס לקוח */
export function isCaseClosed(c) {
  if (!c) return false;
  const status = String(c.status || '').toLowerCase();
  if (status === 'closed' || status === 'rejected') return true;
  return getProcessingStageNumber(c) === 4;
}

/** אישור או סגירה של הממשלה – נכנס אוטומטית למסלול חידוש בעוד חצי שנה */
export function isGovernmentFinalDecision(c) {
  if (!c) return false;
  const n = getProcessingStageNumber(c);
  return n === 4 || n === 5;
}

/** יופיע ב«חידוש עתידי (חצי שנה)» עד מחיקת התיק */
export function isOnSixMonthRenewalTrack(c) {
  if (!c) return false;
  if (c.adminConfirmedCompleted) return true;
  return isGovernmentFinalDecision(c);
}

/**
 * האם הלקוח יכול לערוך תיק שכבר נשלח (דרך חשבון המשתמש).
 * נחסם אחרי סגירה / אישור ממשלה / סיום מנהל, ובהזמנת כרטיס.
 */
export function clientCanEditSubmittedCase(c) {
  if (!c) return false;
  if (c.adminConfirmedCompleted) return false;
  const type = String(c.benefitType || '').toLowerCase();
  if (type === 'card_order') return false;
  const status = String(c.status || '').toLowerCase();
  if (status === 'closed' || status === 'rejected' || status === 'approved') return false;
  const marked = explicitStageNumberFromLabel(c.detailedAdminStatus);
  if (marked >= 4) return false;
  return true;
}

/**
 * מחלקת צבע לפי שלב שסומן בפועל.
 * לחיצה שנייה מבטלת את השלב — בלי תווית אין צבע, והמסגרת חוזרת ללבן.
 * סטטוס «ממתין» לבדו לא צובע את התיק.
 */
export function getCaseStageToneClass(c) {
  if (!c) return '';
  const d = (c.detailedAdminStatus || '').trim();
  if (!explicitStageNumberFromLabel(d)) return '';
  if (isCaseClosed(c)) return 'case-tone-closed';
  const n = getProcessingStageNumber(c);
  if (n === 5) return 'case-tone-approved';
  if (n === 3) return 'case-tone-stage-3';
  if (n === 2) return 'case-tone-stage-2';
  if (n === 1) return 'case-tone-stage-1';
  return '';
}
