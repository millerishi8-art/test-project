import { readUsers } from '../models/User.js';
import { readCases, findCaseById, findCasesByUserId } from '../models/Case.js';
import { DEFAULT_UNKNOWN } from '../components/constants.js';

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
