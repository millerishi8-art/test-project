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
