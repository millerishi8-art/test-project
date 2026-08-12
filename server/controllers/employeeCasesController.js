import { readUsers, findUserById, findUserByEmail } from '../models/User.js';
import {
  readEmployeeCases,
  findEmployeeCaseById,
  createEmployeeCase,
  updateEmployeeCasePaid,
  archivePaidEmployeeCases,
  normalizeEmployeeCaseCategory,
} from '../models/EmployeeCase.js';
import {
  isSuperAdminEmail,
  isSecondaryAdminEmail,
  getSecondaryAdminEmails,
} from '../utils/adminEmails.js';
import { getInitials } from '../utils/initials.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function looksLikeUuid(value) {
  return UUID_RE.test(String(value || '').trim());
}

/** שמות תצוגה קבועים לעובדים (לא כולל מנהל ראשי) */
const STAFF_DISPLAY_NAMES = {
  'abergelyuda7@gmail.com': 'יהודה אברגל',
  'lapidwoldenberg@gmail.com': 'לפיד וולדנברג',
  'shneortole257@gmail.com': 'שניאור טולדנו',
};

function staffDisplayName(email, fallbackName = '') {
  const e = String(email || '').trim().toLowerCase();
  if (STAFF_DISPLAY_NAMES[e]) return STAFF_DISPLAY_NAMES[e];
  return String(fallbackName || '').trim() || e;
}

function isLockedCase(employeeCase) {
  return employeeCase?.isArchived === true;
}

function enrichCase(employeeCase, user) {
  const email = user?.email || '';
  const name = staffDisplayName(email, user?.name || '');
  return {
    ...employeeCase,
    userName: name || email || '',
    userEmail: email || '',
    initials: getInitials(name || email || ''),
  };
}

/**
 * רשימת מנהלי משנה בלבד (בלי המנהל הראשי) עם הכייסים הפעילים שלהם.
 * GET /admin/employee-cases
 */
export const listEmployeeCases = async (req, res) => {
  try {
    const [cases, users] = await Promise.all([readEmployeeCases({ includeArchived: false }), readUsers()]);
    const userById = new Map(users.map((u) => [String(u.id), u]));
    const userByEmail = new Map(
      users.map((u) => [String(u.email || '').trim().toLowerCase(), u])
    );

    /* רק שלושת העובדים – לא מציגים את כרטיס המנהל הראשי */
    const managers = getSecondaryAdminEmails().map((email) => {
      const u = userByEmail.get(email);
      const name = staffDisplayName(email, u?.name || '');
      const userId = u?.id != null ? String(u.id) : null;
      return {
        /* לעולם לא מחזירים מייל כ-id (user_id הוא UUID) */
        id: userId,
        name,
        email,
        initials: getInitials(name || email),
        isPrimaryAdmin: false,
        userAccountMissing: !userId,
        cases: [],
      };
    });

    const managerByUserId = new Map();
    const managerByEmail = new Map();
    for (const m of managers) {
      managerByEmail.set(String(m.email).toLowerCase(), m);
      if (m.id && looksLikeUuid(m.id)) managerByUserId.set(String(m.id), m);
    }

    for (const c of cases) {
      const user = userById.get(String(c.userId));
      const email = String(user?.email || '').trim().toLowerCase();
      /* כייסים של המנהל הראשי לא מוצגים במעקב תשלומים לעובדים */
      if (isSuperAdminEmail(email)) continue;

      const enriched = enrichCase(c, user);
      const manager =
        managerByUserId.get(String(c.userId)) ||
        (email ? managerByEmail.get(email) : null);

      if (manager) {
        manager.cases.push(enriched);
      } else if (isSecondaryAdminEmail(email)) {
        /* fallback – לא אמור לקרות אם המייל ברשימה */
        const name = staffDisplayName(email, enriched.userName);
        const orphan = {
          id: c.userId,
          name,
          email,
          initials: getInitials(name),
          isPrimaryAdmin: false,
          cases: [enriched],
        };
        managers.push(orphan);
        managerByUserId.set(String(c.userId), orphan);
        managerByEmail.set(email, orphan);
      }
    }

    for (const m of managers) {
      m.cases.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      m.unpaidCount = m.cases.filter((c) => !c.isPaid).length;
      m.paidCount = m.cases.filter((c) => c.isPaid).length;
      m.casesCount = m.cases.length;
    }

    managers.sort((a, b) => {
      if (b.casesCount !== a.casesCount) return b.casesCount - a.casesCount;
      return String(a.name || a.email).localeCompare(String(b.name || b.email), 'he');
    });

    /* סיכומים רק לפי כייסים שמוצגים (עובדים) – בלי כייסי המנהל הראשי */
    const visibleCases = managers.flatMap((m) => m.cases);
    const unpaidTotal = visibleCases.filter((c) => !c.isPaid).length;
    const paidPendingArchive = visibleCases.filter((c) => c.isPaid).length;

    return res.json({
      managers,
      totals: {
        casesCount: visibleCases.length,
        unpaidCount: unpaidTotal,
        paidPendingArchive,
      },
      canManagePayouts: isSuperAdminEmail(req.user?.email),
    });
  } catch (error) {
    console.error('listEmployeeCases error:', error);
    const msg = String(error?.message || '');
    if (msg.includes('employee_cases') || error?.code === '42P01' || error?.code === 'PGRST205') {
      return res.status(503).json({
        error: 'טבלת employee_cases עדיין לא קיימת. הרץ את server/db/employee_cases_schema.sql ב-Supabase.',
        code: 'TABLE_MISSING',
      });
    }
    return res.status(500).json({ error: 'שגיאה בשליפת כייסי העובדים' });
  }
};

/**
 * מנהל רושם כייס חדש (שם בעל הכייס + קטגוריה).
 * POST /admin/employee-cases  body: { ownerName | caseNumber, category }
 */
export const createEmployeeCaseEntry = async (req, res) => {
  try {
    const actorId = req.user?.id;
    if (!actorId) {
      return res.status(401).json({ error: 'משתמש לא מאומת' });
    }

    const caseNumber = String(req.body?.ownerName || req.body?.caseNumber || '').trim();
    const category = normalizeEmployeeCaseCategory(req.body?.category);
    if (!caseNumber) {
      return res.status(400).json({ error: 'חובה להזין שם בעל הכייס' });
    }
    if (!category) {
      return res.status(400).json({
        error: 'קטגוריה לא תקינה. בחר: פתיחת כייס, ראיונות או הגשת טפסים',
      });
    }

    const created = await createEmployeeCase({
      userId: actorId,
      caseNumber,
      category,
      isCompleted: true,
    });

    const user = await findUserById(actorId);
    return res.status(201).json({
      message: 'הכייס נרשם בהצלחה',
      case: enrichCase(created, user),
    });
  } catch (error) {
    console.error('createEmployeeCaseEntry error:', error);
    if (error?.message === 'INVALID_CATEGORY') {
      return res.status(400).json({ error: 'קטגוריה לא תקינה' });
    }
    if (error?.message === 'MISSING_CASE_NUMBER') {
      return res.status(400).json({ error: 'חובה להזין שם בעל הכייס' });
    }
    const msg = String(error?.message || '');
    if (msg.includes('employee_cases') || error?.code === '42P01' || error?.code === 'PGRST205') {
      return res.status(503).json({
        error: 'טבלת employee_cases עדיין לא קיימת. הרץ את server/db/employee_cases_schema.sql ב-Supabase.',
        code: 'TABLE_MISSING',
      });
    }
    return res.status(500).json({ error: 'שגיאה ברישום הכייס' });
  }
};

/**
 * מנהל-על מסמן כייס כשולם / לא שולם (רק לפני ארכוב).
 * PATCH /admin/employee-cases/:id/paid  body: { isPaid: boolean }
 */
export const setEmployeeCasePaid = async (req, res) => {
  try {
    const actorEmail = (req.user?.email || '').trim().toLowerCase();
    if (!isSuperAdminEmail(actorEmail)) {
      return res.status(403).json({ error: 'רק מנהל המערכת הראשי יכול לשנות סטטוס תשלום' });
    }

    const { id } = req.params;
    const existing = await findEmployeeCaseById(id);
    if (!existing) {
      return res.status(404).json({ error: 'כייס לא נמצא' });
    }
    if (isLockedCase(existing)) {
      return res.status(403).json({
        error: 'הכייס נעול לאחר ארכוב – לא ניתן לשנות או למחוק אותו',
        code: 'CASE_LOCKED',
      });
    }

    const isPaid = req.body?.isPaid === true || req.body?.isPaid === 'true';
    const updated = await updateEmployeeCasePaid(id, {
      isPaid,
      paidAt: isPaid ? new Date().toISOString() : null,
    });

    const user = await findUserById(updated.userId);
    return res.json({
      message: isPaid ? 'הכייס סומן כשולם' : 'סימון התשלום בוטל',
      case: enrichCase(updated, user),
    });
  } catch (error) {
    console.error('setEmployeeCasePaid error:', error);
    return res.status(500).json({ error: 'שגיאה בעדכון סטטוס התשלום' });
  }
};

/**
 * מנהל-על מאפס/מארכב כייסים ששולמו של מנהל ספציפי (לא את כולם יחד).
 * POST /admin/employee-cases/reset-paid
 * Body: { userId: UUID } או { managerEmail } – חובה משתמש קיים ב-DB.
 */
export const resetPaidEmployeeCases = async (req, res) => {
  try {
    const actorEmail = (req.user?.email || '').trim().toLowerCase();
    if (!isSuperAdminEmail(actorEmail)) {
      return res.status(403).json({
        error: 'רק מנהל המערכת הראשי יכול לאפס/לארכב כייסים ששולמו',
      });
    }

    let userId = String(req.body?.userId || '').trim();
    const managerEmail = String(req.body?.managerEmail || '').trim().toLowerCase();

    /* אם נשלח מייל בטעות כ-userId – מנסים לפתור למשתמש; אחרת שגיאה ברורה */
    if (userId && !looksLikeUuid(userId)) {
      const maybeEmail = userId.includes('@') ? userId.toLowerCase() : '';
      const emailToResolve = managerEmail || maybeEmail;
      if (!emailToResolve) {
        return res.status(400).json({
          error: 'מזהה מנהל לא תקין. נדרש userId מסוג UUID.',
          code: 'INVALID_USER_ID',
        });
      }
      const byEmail = await findUserByEmail(emailToResolve);
      if (!byEmail?.id) {
        return res.status(400).json({
          error: `לא נמצא חשבון משתמש למנהל ${emailToResolve}. יש ליצור את המשתמש לפני איפוס.`,
          code: 'MANAGER_USER_MISSING',
        });
      }
      userId = String(byEmail.id);
    } else if (!userId && managerEmail) {
      const byEmail = await findUserByEmail(managerEmail);
      if (!byEmail?.id) {
        return res.status(400).json({
          error: `לא נמצא חשבון משתמש למנהל ${managerEmail}. יש ליצור את המשתמש לפני איפוס.`,
          code: 'MANAGER_USER_MISSING',
        });
      }
      userId = String(byEmail.id);
    }

    if (!userId || !looksLikeUuid(userId)) {
      return res.status(400).json({
        error: 'חובה לבחור מנהל לאיפוס עם userId תקין (UUID).',
        code: 'INVALID_USER_ID',
      });
    }

    const managerUser = await findUserById(userId);
    if (!managerUser) {
      return res.status(400).json({
        error: 'לא נמצא חשבון משתמש למנהל זה במערכת. יש ליצור/לקשר את המשתמש לפני איפוס.',
        code: 'MANAGER_USER_MISSING',
      });
    }

    const archived = await archivePaidEmployeeCases({ userId });
    return res.json({
      message:
        archived.length === 0
          ? 'אין כייסים ששולמו לאיפוס עבור מנהל זה'
          : `${archived.length} כייסים ששולמו של המנהל הועברו לארכיון וננעלו`,
      archivedCount: archived.length,
      archivedIds: archived.map((c) => c.id),
      userId,
    });
  } catch (error) {
    console.error('resetPaidEmployeeCases error:', error);
    return res.status(500).json({ error: 'שגיאה באיפוס הכייסים ששולמו' });
  }
};
