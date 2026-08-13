import { findUserById } from '../models/User.js';
import { createAdminNotice } from '../models/AdminNotice.js';

const STAGE_MEANING = {
  1: 'הכייס נפתח באתר ומחכה לראיון אישי. צריך לתאם ראיון עם הלקוח.',
  2: 'הראיון בוצע. עכשיו צריך להשלים מילוי והגשת טפסים מול הלקוח.',
  3: 'הטפסים הוגשו. ממתינים לאישור הממשלה.',
  4: 'הממשלה סגרה את הכייס. יש לבדוק את סיבת הסגירה מול הלקוח.',
  5: 'הממשלה אישרה את הכייס. אפשר להציג ללקוח את פרטי ההטבות.',
};

const STATUS_HE = {
  submitted: 'נשלח',
  pending: 'בתהליך',
  approved: 'אושר',
  rejected: 'נדחה',
  closed: 'נסגר',
};

export function benefitTypeLabelHe(type) {
  const map = {
    family: 'משפחה',
    individual: 'בגיר מעל 21',
    minor: 'צעיר',
    card_order: 'הזמנת כרטיס',
  };
  return map[type] || type || '—';
}

export async function resolveCaseClientName(caseData) {
  const fromForm = String(caseData?.personalDetails?.fullName || '').trim();
  if (fromForm) return fromForm;
  if (caseData?.userId) {
    try {
      const user = await findUserById(caseData.userId);
      const name = String(user?.name || '').trim();
      if (name) return name;
    } catch {
      /* ignore */
    }
  }
  return 'לקוח';
}

export async function recordAdminCaseChange({
  req,
  caseData,
  title,
  steps,
  actorName: actorNameOverride,
}) {
  try {
    const actorEmail = String(req?.user?.email || '').trim().toLowerCase();
    if (!actorEmail || !caseData?.id) return;
    const actorName =
      String(actorNameOverride || req?.user?.name || '').trim() || actorEmail;
    const clientName = await resolveCaseClientName(caseData);
    await createAdminNotice({
      actorEmail,
      actorName,
      caseId: String(caseData.id),
      clientName,
      title,
      steps: (steps || []).map((s) => String(s || '').trim()).filter(Boolean),
    });
  } catch (err) {
    console.error('[AdminNotice] record failed:', err?.message || err);
  }
}

export function processingChangeSteps({
  actorName,
  clientName,
  benefitType,
  prevLabel,
  nextLabel,
  stageNum,
  cleared,
  rejectionReason,
  approvedBenefits,
}) {
  const steps = [
    `מי עדכן: ${actorName || 'מנהל'}`,
    `כייס של: ${clientName || 'לקוח'} (${benefitTypeLabelHe(benefitType)})`,
  ];
  if (cleared) {
    steps.push(`מה היה קודם: ${prevLabel || 'שלב עיבוד פעיל'}`);
    steps.push('מה השתנה: שלב העיבוד בוטל. הכייס חזר למצב המתנה.');
    steps.push('מה לעשות: לא צריך להמשיך לפי השלב הקודם עד שיעודכן שלב חדש.');
    return steps;
  }
  steps.push(`שלב קודם: ${prevLabel || 'טרם עודכן שלב עיבוד'}`);
  steps.push(`שלב חדש: ${nextLabel}`);
  const meaning = STAGE_MEANING[stageNum];
  if (meaning) steps.push(`מה זה אומר: ${meaning}`);
  if (stageNum === 4 && rejectionReason) {
    steps.push(`סיבת הסגירה: ${rejectionReason}`);
  }
  if (stageNum === 5 && approvedBenefits && typeof approvedBenefits === 'object') {
    const bits = [];
    if (approvedBenefits.rentAssistance) bits.push(`שכר דירה: ${approvedBenefits.rentAssistance}`);
    if (approvedBenefits.foodStamps) bits.push(`תלושי מזון: ${approvedBenefits.foodStamps}`);
    if (approvedBenefits.financialAid) bits.push(`סיוע כלכלי: ${approvedBenefits.financialAid}`);
    if (approvedBenefits.totalDeposited) bits.push(`סה״כ שהופקד: ${approvedBenefits.totalDeposited}`);
    if (bits.length) steps.push(`פרטי אישור: ${bits.join(' · ')}`);
  }
  return steps;
}

export function statusChangeSteps({ actorName, clientName, benefitType, prevStatus, nextStatus }) {
  return [
    `מי עדכן: ${actorName || 'מנהל'}`,
    `כייס של: ${clientName || 'לקוח'} (${benefitTypeLabelHe(benefitType)})`,
    `סטטוס קודם: ${STATUS_HE[prevStatus] || prevStatus || '—'}`,
    `סטטוס חדש: ${STATUS_HE[nextStatus] || nextStatus}`,
    'מה לעשות: בדקו את הכייס בפאנל ועדכנו את הלקוח אם צריך.',
  ];
}
