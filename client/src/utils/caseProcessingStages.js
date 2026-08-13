/**
 * תואם ל־PROCESSING_STAGES בשרת (adminController) ול־AdminCaseProcessing.
 * שלב 0 = נשלח מהלקוח, עדיין לא עודכן שלב עיבוד במערכת הניהול.
 */
export const PROCESSING_STAGE_LABELS_HE = [
  'נפתחה הבקשה באתר מחכה לראיון אישי',
  'נעשה ראיון מחכה להגשת טפסים',
  'הוגשו טפסים מחכה לאישור הממשלה',
  'הממשלה סגרה את הכייס',
  'אושר על ידי הממשלה',
];

/** גרסה ישנה לפני תיקון ניסוח (נפתח → נפתחה) */
export const LEGACY_HE_STAGE1 = 'נפתח הבקשה באתר מחכה לראיון אישי';

/**
 * @returns {number} 0–5
 */
export function getProcessingStageNumber(c) {
  if (!c) return 0;
  const d = (c.detailedAdminStatus || '').trim();
  for (let i = 0; i < PROCESSING_STAGE_LABELS_HE.length; i++) {
    if (d === PROCESSING_STAGE_LABELS_HE[i]) return i + 1;
  }
  if (d === LEGACY_HE_STAGE1) return 1;

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

/**
 * מחלקת צבע לפי שלב עיבוד.
 * 1 צהוב (פתיחה) → 2 כתום (ראיון) → 3 כחול האתר (הגשה). ירוק/אדום שמורים לאישור/סגירה.
 */
export function getCaseStageToneClass(c) {
  if (!c) return '';
  if (isCaseClosed(c)) return 'case-tone-closed';
  const n = getProcessingStageNumber(c);
  if (n === 5) return 'case-tone-approved';
  if (n === 3) return 'case-tone-stage-3';
  if (n === 2) return 'case-tone-stage-2';
  if (n === 1) return 'case-tone-stage-1';
  return '';
}
