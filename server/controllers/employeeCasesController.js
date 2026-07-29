import { readUsers, findUserById } from '../models/User.js';
import {
  readEmployeeCases,
  findEmployeeCaseById,
  createEmployeeCase,
  updateEmployeeCasePaid,
  archivePaidEmployeeCases,
  normalizeEmployeeCaseCategory,
} from '../models/EmployeeCase.js';
import { isSuperAdminEmail, isAnyAdminPanelEmail } from '../utils/adminEmails.js';
import { getInitials } from '../utils/initials.js';
import { isUserRoleAdmin } from '../components/constants.js';

function isLockedCase(employeeCase) {
  return employeeCase?.isArchived === true;
}

function enrichCase(employeeCase, user) {
  const name = user?.name || '';
  return {
    ...employeeCase,
    userName: name || user?.email || '',
    userEmail: user?.email || '',
    initials: getInitials(name || user?.email || ''),
  };
}

/**
 * רשימת מנהלים (ראשי + משנה) עם הכייסים הפעילים שלהם.
 * GET /admin/employee-cases
 */
export const listEmployeeCases = async (req, res) => {
  try {
    const [cases, users] = await Promise.all([readEmployeeCases({ includeArchived: false }), readUsers()]);
    const userById = new Map(users.map((u) => [String(u.id), u]));

    const managers = users
      .filter((u) => isUserRoleAdmin(u.role) && isAnyAdminPanelEmail(u.email))
      .map((u) => ({
        id: u.id,
        name: u.name || '',
        email: u.email || '',
        initials: getInitials(u.name || u.email || ''),
        isPrimaryAdmin: isSuperAdminEmail(u.email),
        cases: [],
      }));

    const managerByUserId = new Map(managers.map((m) => [String(m.id), m]));

    for (const c of cases) {
      const user = userById.get(String(c.userId));
      const enriched = enrichCase(c, user);
      const manager = managerByUserId.get(String(c.userId));
      if (manager) {
        manager.cases.push(enriched);
      } else {
        /* כייס של משתמש שלא ברשימת המנהלים הנוכחית – מוצג תחת קבוצה נפרדת */
        const orphanKey = `orphan:${c.userId}`;
        if (!managerByUserId.has(orphanKey)) {
          const orphan = {
            id: c.userId,
            name: enriched.userName || 'לא ידוע',
            email: enriched.userEmail || '',
            initials: enriched.initials,
            isPrimaryAdmin: false,
            cases: [],
          };
          managers.push(orphan);
          managerByUserId.set(orphanKey, orphan);
          managerByUserId.set(String(c.userId), orphan);
        }
        managerByUserId.get(String(c.userId)).cases.push(enriched);
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

    const unpaidTotal = cases.filter((c) => !c.isPaid).length;
    const paidPendingArchive = cases.filter((c) => c.isPaid).length;

    return res.json({
      managers,
      totals: {
        casesCount: cases.length,
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
 * מנהל רושם כייס חדש (מספר + קטגוריה).
 * POST /admin/employee-cases  body: { caseNumber, category }
 */
export const createEmployeeCaseEntry = async (req, res) => {
  try {
    const actorId = req.user?.id;
    if (!actorId) {
      return res.status(401).json({ error: 'משתמש לא מאומת' });
    }

    const caseNumber = String(req.body?.caseNumber || '').trim();
    const category = normalizeEmployeeCaseCategory(req.body?.category);
    if (!caseNumber) {
      return res.status(400).json({ error: 'חובה להזין מספר כייס' });
    }
    if (!category) {
      return res.status(400).json({
        error: 'קטגוריה לא תקינה. בחר: ראיונות או הגשת טפסים',
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
      return res.status(400).json({ error: 'חובה להזין מספר כייס' });
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
 * מנהל-על מאפס/מארכב את כל הכייסים שסומנו כשולמו – מוציא אותם מהרשימה הפעילה ונועל אותם.
 * POST /admin/employee-cases/reset-paid
 */
export const resetPaidEmployeeCases = async (req, res) => {
  try {
    const actorEmail = (req.user?.email || '').trim().toLowerCase();
    if (!isSuperAdminEmail(actorEmail)) {
      return res.status(403).json({
        error: 'רק מנהל המערכת הראשי יכול לאפס/לארכב כייסים ששולמו',
      });
    }

    const archived = await archivePaidEmployeeCases();
    return res.json({
      message:
        archived.length === 0
          ? 'אין כייסים ששולמו לאיפוס'
          : `${archived.length} כייסים ששולמו הועברו לארכיון וננעלו`,
      archivedCount: archived.length,
      archivedIds: archived.map((c) => c.id),
    });
  } catch (error) {
    console.error('resetPaidEmployeeCases error:', error);
    return res.status(500).json({ error: 'שגיאה באיפוס הכייסים ששולמו' });
  }
};
