import { readUsers, findUserById, updateUserById, deleteUserById } from '../models/User.js';
import { readCases, findCaseById, findCasesByUserId, updateCase, deleteCase, deleteCasesByIds } from '../models/Case.js';
import { readPayouts, createPayout } from '../models/Payout.js';
import { DEFAULT_UNKNOWN, CASE_STATUS } from '../components/constants.js';
import { isAnyAdminPanelEmail, isSuperAdminEmail } from '../utils/adminEmails.js';
import {
  sendDeferredPaymentApprovedToClient,
  sendDeferredPaymentRequestApprovedAwaitingDate,
  sendDeferredPaymentRequireEarlierDateEmail,
} from '../services/email.js';
import {
  parseYyyyMmDd,
  utcTodayYyyyMmDd,
  subtractOneDayYmd,
} from '../utils/deferredPaymentDates.js';
import { withSignedCaseMediaForAdmin } from '../utils/caseMediaUrls.js';

/**
 * קבלת תיק בודד לפי מזהה (מנהל בלבד) – כולל כל פרטי הטופס
 */
export const getCaseById = async (req, res) => {
  try {
    const { id } = req.params;
    const caseData = await findCaseById(id);
    if (!caseData) {
      return res.status(404).json({ error: 'תיק לא נמצא' });
    }
    const users = await readUsers();
    const user = users.find((u) => u.id === caseData.userId);
    const caseWithUrls = await withSignedCaseMediaForAdmin(caseData);
    res.json({
      ...caseWithUrls,
      userName: user?.name ?? DEFAULT_UNKNOWN,
      userEmail: user?.email ?? DEFAULT_UNKNOWN,
      userPhone: user?.phone ?? DEFAULT_UNKNOWN,
    });
  } catch (error) {
    res.status(500).json({ error: 'שגיאה בשליפת התיק' });
  }
};

/**
 * קבלת כל התיקים (עם פרטי משתמש) – נתונים מעושרים מ-models + components
 */
export const getAllCases = async (req, res) => {
  try {
    let cases = await readCases();
    const users = await readUsers();
    const userIdSet = new Set(users.map((u) => u.id));
    const orphanCaseIds = cases.filter((c) => c.userId && !userIdSet.has(c.userId)).map((c) => c.id);
    const actorEmail = (req.user?.email || '').trim().toLowerCase();
    if (orphanCaseIds.length > 0 && isSuperAdminEmail(actorEmail)) {
      await deleteCasesByIds(orphanCaseIds);
      cases = await readCases();
    }

    const enrichedCases = cases.map((c) => {
      const user = users.find((u) => u.id === c.userId);
      return {
        ...c,
        userName: user?.name ?? DEFAULT_UNKNOWN,
        userEmail: user?.email ?? DEFAULT_UNKNOWN,
        userPhone: user?.phone ?? DEFAULT_UNKNOWN,
      };
    });

    res.json(enrichedCases);
  } catch (error) {
    res.status(500).json({ error: 'שגיאה בשליפת התיקים' });
  }
};

/**
 * קבלת כל המשתמשים (עם מספר תיקים ותיקיהם) – נתונים מ-models
 */
export const getAllUsers = async (req, res) => {
  try {
    const users = await readUsers();
    
    // בגלל שזה במערך ולולאה, נעשה את זה בצורה אסינכרונית בטוחה
    const enrichedUsers = await Promise.all(users.map(async (user) => {
      const userCases = await findCasesByUserId(user.id);
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt,
        casesCount: userCases.length,
        cases: userCases,
        deferredPaymentRequestPending: !!user.deferredPaymentRequestPending,
        deferredPaymentApproved: !!user.deferredPaymentApproved,
        deferredPaymentDeadline: user.deferredPaymentDeadline || null,
        deferredPaymentRequestedAt: user.deferredPaymentRequestedAt || null,
        deferredPaymentAwaitingClientDate: !!user.deferredPaymentAwaitingClientDate,
        deferredPaymentRequestApprovedAt: user.deferredPaymentRequestApprovedAt || null,
        deferredPaymentProposedDeadline: user.deferredPaymentProposedDeadline || null,
        deferredPaymentProposalPending: !!user.deferredPaymentProposalPending,
        deferredPaymentProposalSubmittedAt: user.deferredPaymentProposalSubmittedAt || null,
        deferredPaymentDeadlineMustBeBeforeYmd: user.deferredPaymentDeadlineMustBeBeforeYmd || null,
      };
    }));

    res.json(enrichedUsers);
  } catch (error) {
    res.status(500).json({ error: 'שגיאה בשליפת המשתמשים' });
  }
};

/**
 * מנהל-על – זרימת תשלום מאוחר דו-שלבית.
 * Body: { approveRequest: true } | { approveDeadline: true } | { reject: true } | { rejectProposal: true } | { requireEarlierDate: true }
 */
export const patchUserDeferredPayment = async (req, res) => {
  try {
    const actorEmail = (req.user?.email || '').trim().toLowerCase();
    if (!isAnyAdminPanelEmail(actorEmail)) {
      return res.status(403).json({ error: 'נדרשת הרשאת מנהל' });
    }
    const { id } = req.params;
    const body = req.body || {};
    const user = await findUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'משתמש לא נמצא' });
    }

    const now = new Date().toISOString();

    if (body.reject === true) {
      if (user.deferredPaymentApproved) {
        return res.status(400).json({ error: 'כבר קיים אישור סופי; לא ניתן לבטל מכאן' });
      }
      const updated = await updateUserById(id, {
        deferredPaymentRequestPending: false,
        deferredPaymentAwaitingClientDate: false,
        deferredPaymentRequestApprovedAt: null,
        deferredPaymentProposedDeadline: null,
        deferredPaymentProposalPending: false,
        deferredPaymentProposalSubmittedAt: null,
        deferredPaymentWeeklyReminderLastAt: null,
        deferredPaymentDueDateWarningSentAt: null,
        deferredPaymentDeadlineMustBeBeforeYmd: null,
      });
      return res.json({
        ok: true,
        user: { id: updated?.id || id, cleared: true },
      });
    }

    if (body.rejectProposal === true) {
      if (!user.deferredPaymentProposalPending) {
        return res.status(400).json({ error: 'אין בקשה ממתינה לאישור תאריך' });
      }
      const updated = await updateUserById(id, {
        deferredPaymentProposalPending: false,
        deferredPaymentProposedDeadline: null,
        deferredPaymentProposalSubmittedAt: null,
        deferredPaymentAwaitingClientDate: true,
        deferredPaymentDeadlineMustBeBeforeYmd: null,
      });
      return res.json({ ok: true, user: { id: updated?.id || id } });
    }

    if (body.requireEarlierDate === true) {
      if (!user.deferredPaymentProposalPending || !user.deferredPaymentProposedDeadline) {
        return res.status(400).json({ error: 'אין תאריך ממתין לאישור מהלקוח' });
      }
      const rejected = parseYyyyMmDd(user.deferredPaymentProposedDeadline);
      if (!rejected) {
        return res.status(400).json({ error: 'תאריך לא תקין' });
      }
      const minY = utcTodayYyyyMmDd();
      const lastSelectable = subtractOneDayYmd(rejected);
      if (!lastSelectable || lastSelectable < minY) {
        return res.status(400).json({
          error:
            'לא ניתן לדרוש תאריך מוקדם יותר – אין תאריך חוקי לפני התאריך שהלקוח בחר (מול היום).',
        });
      }
      const updated = await updateUserById(id, {
        deferredPaymentProposalPending: false,
        deferredPaymentProposedDeadline: null,
        deferredPaymentProposalSubmittedAt: null,
        deferredPaymentAwaitingClientDate: true,
        deferredPaymentDeadlineMustBeBeforeYmd: rejected,
      });
      if (!updated) {
        return res.status(500).json({ error: 'שגיאה בעדכון המשתמש' });
      }
      await sendDeferredPaymentRequireEarlierDateEmail(user.email, user.name, rejected);
      return res.json({ ok: true, user: { id: updated.id, deferredPaymentAwaitingClientDate: true } });
    }

    if (body.approveRequest === true) {
      if (!user.deferredPaymentRequestPending) {
        return res.status(400).json({ error: 'אין בקשה חדשה ממתינה לאישור' });
      }
      const updated = await updateUserById(id, {
        deferredPaymentRequestPending: false,
        deferredPaymentAwaitingClientDate: true,
        deferredPaymentRequestApprovedAt: now,
        deferredPaymentProposedDeadline: null,
        deferredPaymentProposalPending: false,
        deferredPaymentProposalSubmittedAt: null,
        deferredPaymentDeadlineMustBeBeforeYmd: null,
      });
      if (!updated) {
        return res.status(500).json({ error: 'שגיאה בעדכון המשתמש' });
      }
      await sendDeferredPaymentRequestApprovedAwaitingDate(user.email, user.name);
      return res.json({
        ok: true,
        user: {
          id: updated.id,
          deferredPaymentAwaitingClientDate: true,
          deferredPaymentRequestApprovedAt: now,
        },
      });
    }

    if (body.approveDeadline === true) {
      if (!user.deferredPaymentProposalPending || !user.deferredPaymentProposedDeadline) {
        return res.status(400).json({ error: 'אין תאריך ממתין לאישור מהלקוח' });
      }
      const chosen = parseYyyyMmDd(user.deferredPaymentProposedDeadline);
      if (!chosen) {
        return res.status(400).json({ error: 'תאריך לא תקין' });
      }
      const anchor = user.deferredPaymentRequestApprovedAt;
      if (!anchor) {
        return res.status(400).json({ error: 'חסר מועד אישור ראשון' });
      }
      const minY = utcTodayYyyyMmDd();
      if (chosen < minY) {
        return res.status(400).json({ error: 'התאריך מחוץ לטווח המותר' });
      }
      const updated = await updateUserById(id, {
        deferredPaymentApproved: true,
        deferredPaymentApprovedAt: now,
        deferredPaymentDeadline: chosen,
        deferredPaymentProposalPending: false,
        deferredPaymentAwaitingClientDate: false,
        deferredPaymentProposedDeadline: null,
        deferredPaymentProposalSubmittedAt: null,
        deferredPaymentWeeklyReminderLastAt: null,
        deferredPaymentDueDateWarningSentAt: null,
        deferredPaymentDeadlineMustBeBeforeYmd: null,
      });
      if (!updated) {
        return res.status(500).json({ error: 'שגיאה בעדכון המשתמש' });
      }
      await sendDeferredPaymentApprovedToClient(user.email, user.name, chosen);
      return res.json({
        ok: true,
        user: {
          id: updated.id,
          deferredPaymentApproved: true,
          deferredPaymentDeadline: chosen,
        },
      });
    }

    return res.status(400).json({
      error:
        'נא לשלוח approveRequest, approveDeadline, reject, rejectProposal או requireEarlierDate',
    });
  } catch (error) {
    console.error('patchUserDeferredPayment error:', error);
    return res.status(500).json({ error: 'שגיאה בעדכון בקשת התשלום' });
  }
};

const ALLOWED_STATUSES = [CASE_STATUS.SUBMITTED, CASE_STATUS.PENDING, CASE_STATUS.APPROVED, CASE_STATUS.REJECTED, 'closed'];

/**
 * מנהל מעדכן סטטוס תיק (נשלח / בתהליך / אושר מחכים לממשלה)
 */
export const updateCaseStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'סטטוס לא תקין. אפשרויות: submitted, pending, approved, rejected, closed' });
    }
    const caseData = await findCaseById(id);
    if (!caseData) {
      return res.status(404).json({ error: 'תיק לא נמצא' });
    }
    const updated = await updateCase(id, { status });
    return res.json({ message: 'סטטוס התיק עודכן', case: updated });
  } catch (error) {
    console.error('updateCaseStatus error:', error);
    return res.status(500).json({ error: 'שגיאה בעדכון הסטטוס' });
  }
};

/**
 * מנהל מאשר שהקייס הושלם בהצלחה – אחרי זה הסטטוס "יחודש בעוד חצי שנה" יוצג.
 * נשמר גם מי העובד (המנהל) שאישר את הסיום – לצורך מעקב תשלומי עובדים (15$ לכייס).
 */
export const confirmCaseCompleted = async (req, res) => {
  try {
    const { id } = req.params;
    const caseData = await findCaseById(id);
    if (!caseData) {
      return res.status(404).json({ error: 'תיק לא נמצא' });
    }
    /* אידמפוטנטי: אישור חוזר לא דורס את שיוך העובד ולא מאפס תשלום ששולם */
    if (caseData.adminConfirmedCompleted === true) {
      return res.json({ message: 'הקייס כבר אושר כהושלם', case: caseData });
    }
    const actorEmail = (req.user?.email || '').trim().toLowerCase();
    const now = new Date().toISOString();
    const updated = await updateCase(id, {
      adminConfirmedCompleted: true,
      adminConfirmedAt: now,
      completedBy: actorEmail || null,
      completedAt: now,
      employeePaid: false,
    });
    return res.json({ message: 'הקייס אושר כהושלם בהצלחה', case: updated });
  } catch (error) {
    console.error('confirmCaseCompleted error:', error);
    return res.status(500).json({ error: 'שגיאה באישור הקייס' });
  }
};

/** שלבי עיבוד תיק – טקסט ל־detailedAdminStatus */
const PROCESSING_STAGES = {
  1: 'נפתחה הבקשה באתר מחכה לראיון אישי',
  2: 'נעשה ראיון מחכה להגשת טפסים',
  3: 'הוגשו טפסים מחכה לאישור הממשלה',
  4: 'הממשלה סגרה את הכייס',
  5: 'אושר על ידי הממשלה',
};

/**
 * מנהל מעדכן שלב עיבוד תיק (עמוד "עובדים לך על הכייס")
 * Body: { stage: 1|2|3|4|5, rejectionReason?: string, approvedBenefits?: Object }
 * ב-stage 4 חובה rejectionReason. ב-stage 5 מומלץ approvedBenefits (מוצג ללקוח בשלב 3).
 */
export const updateCaseProcessing = async (req, res) => {
  try {
    const { id } = req.params;
    const { stage, rejectionReason, approvedBenefits: approvedBenefitsRaw } = req.body;
    const stageNum = typeof stage === 'string' ? parseInt(stage, 10) : stage;
    if (!Number.isInteger(stageNum) || stageNum < 1 || stageNum > 5) {
      return res.status(400).json({ error: 'סטטוס לא תקין. שלב חייב להיות 1–5.' });
    }
    const caseData = await findCaseById(id);
    if (!caseData) {
      return res.status(404).json({ error: 'תיק לא נמצא' });
    }
    const detailedAdminStatus = PROCESSING_STAGES[stageNum];
    const updates = { detailedAdminStatus };
    if (stageNum === 4) {
      const reason = (rejectionReason || '').trim();
      if (!reason) {
        return res.status(400).json({ error: 'בשלב "הממשלה סגרה את הכייס" חובה להזין סיבת סגירה.' });
      }
      updates.rejectionReason = reason;
      updates.status = 'closed';
      updates.approvedBenefits = null;
    } else if (stageNum === 5) {
      updates.status = CASE_STATUS.APPROVED;
      updates.rejectionReason = null;
      if (approvedBenefitsRaw && typeof approvedBenefitsRaw === 'object') {
        updates.approvedBenefits = {
          rentAssistance: approvedBenefitsRaw.rentAssistance != null ? String(approvedBenefitsRaw.rentAssistance).trim() : '',
          foodStamps: approvedBenefitsRaw.foodStamps != null ? String(approvedBenefitsRaw.foodStamps).trim() : '',
          financialAid: approvedBenefitsRaw.financialAid != null ? String(approvedBenefitsRaw.financialAid).trim() : '',
          totalDeposited: approvedBenefitsRaw.totalDeposited != null ? String(approvedBenefitsRaw.totalDeposited).trim() : '',
        };
      } else {
        updates.approvedBenefits = null;
      }
    } else {
      updates.status = CASE_STATUS.PENDING;
      if (stageNum !== 4) updates.rejectionReason = null;
      updates.approvedBenefits = null;
    }
    const updated = await updateCase(id, updates);
    return res.json({ message: 'סטטוס העיבוד עודכן', case: updated });
  } catch (error) {
    console.error('updateCaseProcessing error:', error);
    return res.status(500).json({ error: 'שגיאה בעדכון סטטוס העיבוד' });
  }
};

/** תעריף לעובד עבור כל כייס שהושלם (בדולרים) */
const EMPLOYEE_RATE_PER_CASE_USD = 15;

/** כייס שנספר לתשלום עובד: הושלם, משויך לעובד, וטרם שולם עליו */
function isUnpaidCompletedCase(c) {
  return c.adminConfirmedCompleted === true && !!c.completedBy && c.employeePaid !== true;
}

/**
 * מעקב תשלומי עובדים – סיכום כייסים שהושלמו וטרם שולמו, מקובץ לפי עובד,
 * כולל היסטוריית תשלומים. נגיש לכל מנהלי הפאנל (ראשי + משנה).
 */
export const getEmployeePayouts = async (req, res) => {
  try {
    const [cases, users, history] = await Promise.all([readCases(), readUsers(), readPayouts()]);

    const nameByEmail = new Map();
    for (const u of users) {
      const e = String(u.email || '').trim().toLowerCase();
      if (e && u.name) nameByEmail.set(e, u.name);
    }

    const byEmployee = new Map();
    for (const c of cases) {
      if (!isUnpaidCompletedCase(c)) continue;
      const email = String(c.completedBy).trim().toLowerCase();
      if (!byEmployee.has(email)) {
        byEmployee.set(email, {
          email,
          name: nameByEmail.get(email) || '',
          cases: [],
        });
      }
      byEmployee.get(email).cases.push({
        id: c.id,
        completedAt: c.completedAt || c.adminConfirmedAt || null,
        benefitType: c.benefitType || null,
      });
    }

    const employees = [...byEmployee.values()]
      .map((emp) => ({
        ...emp,
        cases: emp.cases.sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0)),
        casesCount: emp.cases.length,
        totalDue: emp.cases.length * EMPLOYEE_RATE_PER_CASE_USD,
      }))
      .sort((a, b) => b.casesCount - a.casesCount);

    return res.json({
      ratePerCase: EMPLOYEE_RATE_PER_CASE_USD,
      employees,
      totals: {
        casesCount: employees.reduce((sum, e) => sum + e.casesCount, 0),
        amountDue: employees.reduce((sum, e) => sum + e.totalDue, 0),
      },
      history,
    });
  } catch (error) {
    console.error('getEmployeePayouts error:', error);
    return res.status(500).json({ error: 'שגיאה בשליפת תשלומי העובדים' });
  }
};

/**
 * מנהל-על מאשר ששילם לעובד – מסמן את כל הכייסים הפתוחים של העובד כשולמו
 * (זה האיפוס החודשי) ושומר רשומה בהיסטוריית התשלומים.
 */
export const settleEmployeePayout = async (req, res) => {
  try {
    const actorEmail = (req.user?.email || '').trim().toLowerCase();
    if (!isSuperAdminEmail(actorEmail)) {
      return res.status(403).json({ error: 'רק מנהל המערכת הראשי יכול לאשר תשלום לעובד' });
    }

    const employeeEmail = String(req.body?.employeeEmail || '').trim().toLowerCase();
    if (!employeeEmail) {
      return res.status(400).json({ error: 'חסר אימייל של העובד' });
    }

    const cases = await readCases();
    const toSettle = cases.filter(
      (c) => isUnpaidCompletedCase(c) && String(c.completedBy).trim().toLowerCase() === employeeEmail
    );
    if (toSettle.length === 0) {
      return res.status(400).json({ error: 'אין כייסים שממתינים לתשלום עבור עובד זה' });
    }

    const now = new Date().toISOString();
    for (const c of toSettle) {
      await updateCase(c.id, {
        employeePaid: true,
        employeePaidAt: now,
        employeePaidBy: actorEmail,
      });
    }

    const casesCount = toSettle.length;
    const amount = casesCount * EMPLOYEE_RATE_PER_CASE_USD;

    /* ההיסטוריה משנית – אם הכתיבה אליה נכשלת (למשל טבלה חסרה) התשלום עצמו כבר נרשם על הכייסים */
    let historySaved = true;
    try {
      const users = await readUsers();
      const employeeUser = users.find(
        (u) => String(u.email || '').trim().toLowerCase() === employeeEmail
      );
      await createPayout({
        employeeEmail,
        employeeName: employeeUser?.name || '',
        casesCount,
        amount,
        caseIds: toSettle.map((c) => c.id),
        paidBy: actorEmail,
      });
    } catch (historyError) {
      historySaved = false;
      console.error('settleEmployeePayout history error:', historyError);
    }

    return res.json({
      message: `התשלום אושר – ${casesCount} כייסים בסך $${amount} סומנו כשולמו`,
      employeeEmail,
      casesCount,
      amount,
      historySaved,
    });
  } catch (error) {
    console.error('settleEmployeePayout error:', error);
    return res.status(500).json({ error: 'שגיאה באישור התשלום לעובד' });
  }
};

/**
 * מנהל-על מוחק תיק לצמיתות (מנהל משנה לא יכול).
 */
export const deleteCasePermanent = async (req, res) => {
  try {
    const actorEmail = (req.user?.email || '').trim().toLowerCase();
    if (!isSuperAdminEmail(actorEmail)) {
      return res.status(403).json({ error: 'רק מנהל המערכת הראשי יכול להסיר תיקים' });
    }
    const { id } = req.params;
    /** מחיקה אידמפוטנטית – אם התיק כבר לא קיים, עדיין 200 כדי שלא ייתקעו הלקוח / לחיצה כפולה */
    const removed = await deleteCase(id);
    if (!removed) {
      return res.json({
        message: 'התיק כבר לא היה במערכת',
        id,
        alreadyRemoved: true,
      });
    }

    const userId = removed.userId;
    let userDeleted = false;
    if (userId) {
      const user = await findUserById(userId);
      const isAdmin = user && String(user.role || '').toLowerCase() === 'admin';
      /** לא מוחקים מנהלים; אם נשארו תיקים לאותו משתמש – לא מוחקים את המשתמש */
      if (user && !isAdmin) {
        const remainingCases = await findCasesByUserId(userId);
        if (remainingCases.length === 0) {
          userDeleted = await deleteUserById(userId);
        }
      }
    }

    return res.json({
      message: userDeleted ? 'התיק והמשתמש הוסרו מהמערכת' : 'התיק הוסר לצמיתות',
      id,
      userDeleted,
    });
  } catch (error) {
    console.error('deleteCasePermanent error:', error);
    return res.status(500).json({ error: 'שגיאה במחיקת התיק' });
  }
};
