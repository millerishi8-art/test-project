import { readUsers, findUserById, updateUserById } from '../models/User.js';
import { readCases, findCaseById, findCasesByUserId, updateCase } from '../models/Case.js';
import { DEFAULT_UNKNOWN, ROLES } from '../components/constants.js';

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
