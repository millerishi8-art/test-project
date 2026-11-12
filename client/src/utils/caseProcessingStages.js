/**
 * תואם ל־PROCESSING_STAGES בשרת (adminController) ול־AdminCaseProcessing.
 * שלב 0 = נשלח מהלקוח, עדיין לא עודכן שלב עיבוד במערכת הניהול.
 */
/** מספר שלב קבוע. 4 ו־5 נשארים סגירה ואישור. 6 הוא אימות מסמכים. */
export const STAGE_LABEL_BY_NUMBER = {
  1: 'נפתחה בקשה',
  2: 'הגשת טפסים',
  3: 'נעשה ראיון',
  4: 'הכייס סגור',
  5: 'הכייס אושר',
  6: 'אימות מסמכים',
};

/** סדר הכפתורים במסך העובדים */
export const PROCESSING_STAGE_OPTIONS = [
  { stage: 1, label: STAGE_LABEL_BY_NUMBER[1], toneClass: 'stage-opening' },
  { stage: 2, label: STAGE_LABEL_BY_NUMBER[2], toneClass: 'stage-forms' },
  { stage: 3, label: STAGE_LABEL_BY_NUMBER[3], toneClass: 'stage-interview' },
  { stage: 6, label: STAGE_LABEL_BY_NUMBER[6], toneClass: 'stage-forms' },
  { stage: 4, label: STAGE_LABEL_BY_NUMBER[4], isRejection: true },
  { stage: 5, label: STAGE_LABEL_BY_NUMBER[5], isApproval: true },
];

export const PROCESSING_STAGE_LABELS_HE = PROCESSING_STAGE_OPTIONS.map((s) => s.label);

/** ניסוחים ישנים שנשמרו בתיקים – ממופים לשלב הנכון אחרי שינוי הסדר */
export const LEGACY_STAGE_LABELS_HE = {
  'הוגשו טפסים': 2,
  'נפתחה הבקשה באתר מחכה לראיון אישי': 1,
  'נפתח הבקשה באתר מחכה לראיון אישי': 1,
  'נעשה ראיון מחכה להגשת טפסים': 3,
  'הוגשו טפסים מחכה לאישור הממשלה': 2,
  'הממשלה סגרה את הכייס': 4,
  'אושר על ידי הממשלה': 5,
};

/** גרסה ישנה לפני תיקון ניסוח (נפתח → נפתחה) */
export const LEGACY_HE_STAGE1 = 'נפתח הבקשה באתר מחכה לראיון אישי';

/** מספר שלב לפי הטקסט השמור, בלי לנחש מסטטוס כללי כמו «ממתין» */
export function explicitStageNumberFromLabel(label) {
  const d = String(label || '').trim();
  if (!d) return 0;
  for (const [num, text] of Object.entries(STAGE_LABEL_BY_NUMBER)) {
    if (d === text) return Number(num);
  }
  return LEGACY_STAGE_LABELS_HE[d] || 0;
}

/** הנוסח הקצר להצגה, גם אם בתיק שמור הנוסח הארוך הישן */
export function shortStageLabel(label) {
  const n = explicitStageNumberFromLabel(label);
  return n ? STAGE_LABEL_BY_NUMBER[n] || String(label || '').trim() : String(label || '').trim();
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
  const type = String(c.benefitType || '').toLowerCase();
  if (type === 'credit_agreement' || c.personalDetails?.form === 'credit_agreement') return false;
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
  if (type === 'card_order' || type === 'credit_agreement') return false;
  const status = String(c.status || '').toLowerCase();
  if (status === 'closed' || status === 'rejected' || status === 'approved') return false;
  const marked = explicitStageNumberFromLabel(c.detailedAdminStatus);
  if (marked === 4 || marked === 5) return false;
  return true;
}

/**
 * מחלקת צבע לפי שלב שסומן בפועל.
 * לחיצה שנייה מבטלת את השלב — בלי תווית אין צבע, והמסגרת חוזרת ללבן.
 * סטטוס «ממתין» לבדו לא צובע את התיק.
 */
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * טיימר העובדים. מתחיל רק אחרי לחיצה על «נפתחה בקשה», ונעצר ב«הגשת טפסים».
 * אחרי שבוע: כתום. אחרי שבועיים: אדום.
 */
const TIMER_STOP_STAGES = new Set([2, 3, 4, 5, 6]);

export function caseProcessingTimer(caseItem, now = Date.now()) {
  const start = new Date(caseItem?.processingTimerStartedAt || 0).getTime();
  if (!start || Number.isNaN(start)) return null;
  const stage = getProcessingStageNumber(caseItem);
  const stopped = TIMER_STOP_STAGES.has(stage);
  const storedStop = new Date(caseItem?.processingTimerStoppedAt || 0).getTime();
  const hasStoredStop = Boolean(storedStop) && !Number.isNaN(storedStop);
  const end = stopped ? (hasStoredStop ? storedStop : start) : now;
  const elapsed = Math.max(0, end - start);
  let tone = 'ok';
  if (!stopped || hasStoredStop) {
    if (elapsed >= 2 * WEEK_MS) tone = 'late';
    else if (elapsed >= WEEK_MS) tone = 'warn';
  }
  return { elapsed, tone, stopped, hasDuration: !stopped || hasStoredStop };
}

function hebrewCount(n, one, two, many) {
  if (n === 1) return one;
  if (n === 2) return two;
  return `${n} ${many}`;
}

export function formatProcessingElapsed(ms) {
  const totalMinutes = Math.max(0, Math.floor(Number(ms) / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes - days * 60 * 24) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days > 0) parts.push(hebrewCount(days, 'יום', 'יומיים', 'ימים'));
  if (hours > 0) parts.push(hebrewCount(hours, 'שעה', 'שעתיים', 'שעות'));
  if (minutes > 0 && days === 0) parts.push(hebrewCount(minutes, 'דקה', 'שתי דקות', 'דקות'));
  if (parts.length === 0) return 'פחות מדקה';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} ו־${parts[parts.length - 1]}`;
}

export function getCaseStageToneClass(c) {
  if (!c) return '';
  const d = (c.detailedAdminStatus || '').trim();
  if (!explicitStageNumberFromLabel(d)) return '';
  if (isCaseClosed(c)) return 'case-tone-closed';
  const n = getProcessingStageNumber(c);
  if (n === 5) return 'case-tone-approved';
  if (n === 2 || n === 6) return 'case-tone-stage-3';
  if (n === 3) return 'case-tone-stage-2';
  if (n === 1) return 'case-tone-stage-1';
  return '';
}
