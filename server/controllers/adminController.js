import { readUsers, findUserById, updateUserById } from '../models/User.js';
import { readCases, findCaseById, findCasesByUserId, updateCase, deleteCase } from '../models/Case.js';
import { DEFAULT_UNKNOWN, ROLES, CASE_STATUS } from '../components/constants.js';

/**
 * קבלת תיק בודד לפי מזהה (מנהל בלבד) – כולל כל פרטי הטופס
 */
export const getCaseById = async (req, res) => {
  const { id } = req.params;
  const caseData = findCaseById(id);
  if (!caseData) {
    return res.status(404).json({ error: 'תיק לא נמצא' });
  }
  const users = await readUsers();
  const user = users.find((u) => u.id === caseData.userId);
  res.json({
    ...caseData,
    userName: user?.name ?? DEFAULT_UNKNOWN,
    userEmail: user?.email ?? DEFAULT_UNKNOWN,
    userPhone: user?.phone ?? DEFAULT_UNKNOWN,
  });
};

/**
 * קבלת כל התיקים (עם פרטי משתמש) – נתונים מעושרים מ-models + components
 */
export const getAllCases = async (req, res) => {
  const cases = readCases();
  const users = await readUsers();

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
};

/**
 * קבלת כל המשתמשים (עם מספר תיקים ותיקיהם) – נתונים מ-models
 */
export const getAllUsers = async (req, res) => {
  const users = await readUsers();

  const enrichedUsers = users.map((user) => {
    const userCases = findCasesByUserId(user.id);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      createdAt: user.createdAt,
      casesCount: userCases.length,
      cases: userCases,
    };
  });

  res.json(enrichedUsers);
};

/**
 * מנהל מוריד משתמש אחר מגישת מנהל (משנה role ל-user)
 * אסור למנהל להוריד את עצמו.
 */
export const demoteAdmin = async (req, res) => {
  try {
    const { id: targetUserId } = req.params;
    const currentUserId = req.user?.id;
    const currentEmail = (req.user?.email || '').trim().toLowerCase();
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (adminEmail && currentEmail !== adminEmail) {
      return res.status(403).json({ error: 'רק המנהל הראשי (לפי ADMIN_EMAIL) יכול להוריד מנהלים' });
    }
    if (currentUserId === targetUserId) {
      return res.status(400).json({ error: 'לא ניתן להוריד את עצמך מגישת מנהל' });
    }
    const user = await findUserById(targetUserId);
    if (!user) {
      return res.status(404).json({ error: 'משתמש לא נמצא' });
    }
    if (user.role !== ROLES.ADMIN) {
      return res.status(400).json({ error: 'למשתמש זה אין גישת מנהל' });
    }
    const updated = await updateUserById(targetUserId, { role: ROLES.USER });
    if (!updated) {
      return res.status(500).json({ error: 'שגיאה בעדכון המשתמש' });
    }
    return res.json({ message: 'המשתמש הורד מגישת מנהל בהצלחה', user: { id: updated.id, email: updated.email, role: updated.role } });
  } catch (error) {
    console.error('demoteAdmin error:', error);
    return res.status(500).json({ error: 'שגיאה בהורדת המנהל' });
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
    const caseData = findCaseById(id);
    if (!caseData) {
      return res.status(404).json({ error: 'תיק לא נמצא' });
    }
    const updated = updateCase(id, { status });
    return res.json({ message: 'סטטוס התיק עודכן', case: updated });
  } catch (error) {
    console.error('updateCaseStatus error:', error);
    return res.status(500).json({ error: 'שגיאה בעדכון הסטטוס' });
  }
};

/**
 * מנהל מאשר שהקייס הושלם בהצלחה – אחרי זה הסטטוס "יחודש בעוד חצי שנה" יוצג
 */
export const confirmCaseCompleted = async (req, res) => {
  try {
    const { id } = req.params;
    const caseData = findCaseById(id);
    if (!caseData) {
      return res.status(404).json({ error: 'תיק לא נמצא' });
    }
    const updated = updateCase(id, {
      adminConfirmedCompleted: true,
      adminConfirmedAt: new Date().toISOString(),
    });
    return res.json({ message: 'הקייס אושר כהושלם בהצלחה', case: updated });
  } catch (error) {
    console.error('confirmCaseCompleted error:', error);
    return res.status(500).json({ error: 'שגיאה באישור הקייס' });
  }
};

/** שלבי עיבוד תיק – טקסט ל־detailedAdminStatus */
const PROCESSING_STAGES = {
  1: 'נפתח הבקשה באתר מחכה לראיון אישי',
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
    const caseData = findCaseById(id);
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
    const updated = updateCase(id, updates);
    return res.json({ message: 'סטטוס העיבוד עודכן', case: updated });
  } catch (error) {
    console.error('updateCaseProcessing error:', error);
    return res.status(500).json({ error: 'שגיאה בעדכון סטטוס העיבוד' });
  }
};

/**
 * מנהל מוחק תיק לצמיתות. דורש role admin (מוגן ע"י isAdmin middleware).
 */
export const deleteCasePermanent = async (req, res) => {
  try {
    const { id } = req.params;
    const caseData = findCaseById(id);
    if (!caseData) {
      return res.status(404).json({ error: 'תיק לא נמצא' });
    }
    const removed = deleteCase(id);
    if (!removed) {
      return res.status(500).json({ error: 'שגיאה במחיקת התיק' });
    }
    return res.json({ message: 'התיק הוסר לצמיתות', id });
  } catch (error) {
    console.error('deleteCasePermanent error:', error);
    return res.status(500).json({ error: 'שגיאה במחיקת התיק' });
  }
};
