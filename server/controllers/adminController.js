import { readUsers, findUserById, findUserByEmail, updateUserById, deleteUserById } from '../models/User.js';
import { readCases, findCaseById, findCasesByUserId, updateCase, deleteCase, deleteCasesByIds } from '../models/Case.js';
import { readPayouts, createPayout } from '../models/Payout.js';
import { DEFAULT_UNKNOWN, CASE_STATUS } from '../components/constants.js';
import {
  isAnyAdminPanelEmail,
  isSuperAdminEmail,
  getSecondaryAdminEmails,
} from '../utils/adminEmails.js';
import {
  sendDeferredPaymentApprovedToClient,
  sendDeferredPaymentRequestApprovedAwaitingDate,
  sendDeferredPaymentRequireEarlierDateEmail,
  sendCaseStageUpdateEmail,
} from '../services/email.js';
import { sendWhatsAppMessage } from '../services/whatsapp.js';
import {
  parseYyyyMmDd,
  utcTodayYyyyMmDd,
  subtractOneDayYmd,
} from '../utils/deferredPaymentDates.js';
import { withSignedCaseMediaForAdmin } from '../utils/caseMediaUrls.js';
import crypto from 'crypto';

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

function isStoragePath(val) {
  const s = String(val || '').trim();
  if (!s) return false;
  if (/^https?:\/\//i.test(s) || /^data:/i.test(s)) return false;
  return true;
}

/**
 * מנהל שומר פרטי HRA לתיק: תמונה אחת, קובץ אחד, שם משתמש וסיסמה.
 * Body: { username?, password?, imagePath?, filePath?, fileName?, clearImage?, clearFile? }
 */
export const updateCaseHraDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const caseData = await findCaseById(id);
    if (!caseData) {
      return res.status(404).json({ error: 'תיק לא נמצא' });
    }

    const prev =
      caseData.hraDetails && typeof caseData.hraDetails === 'object' ? caseData.hraDetails : {};
    const {
      username,
      password,
      imagePath,
      filePath,
      fileName,
      clearImage,
      clearFile,
    } = req.body || {};

    const next = {
      username: username != null ? String(username).trim() : String(prev.username || ''),
      password: password != null ? String(password) : String(prev.password || ''),
      imagePath: prev.imagePath || null,
      filePath: prev.filePath || null,
      fileName: prev.fileName || null,
      updatedAt: new Date().toISOString(),
      updatedBy: (req.user?.email || '').trim().toLowerCase(),
    };

    if (clearImage === true) {
      next.imagePath = null;
    } else if (isStoragePath(imagePath)) {
      next.imagePath = String(imagePath).trim();
    }

    if (clearFile === true) {
      next.filePath = null;
      next.fileName = null;
    } else if (isStoragePath(filePath)) {
      next.filePath = String(filePath).trim();
      if (fileName != null) next.fileName = String(fileName).trim().slice(0, 180) || null;
    } else if (fileName != null && next.filePath) {
      next.fileName = String(fileName).trim().slice(0, 180) || next.fileName;
    }

    const updated = await updateCase(id, { hraDetails: next });
    const withUrls = await withSignedCaseMediaForAdmin(updated);
    return res.json({ message: 'פרטי HRA נשמרו', case: withUrls });
  } catch (error) {
    console.error('updateCaseHraDetails error:', error);
    return res.status(500).json({ error: 'שגיאה בשמירת פרטי HRA' });
  }
};

function normalizeInterimNotes(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((n) => n && typeof n === 'object' && String(n.text || '').trim())
    .map((n) => ({
      id: String(n.id || crypto.randomUUID()),
      text: String(n.text || '').trim(),
      createdAt: n.createdAt || null,
      updatedAt: n.updatedAt || null,
      editedByName: String(n.editedByName || '').trim(),
      editedByEmail: String(n.editedByEmail || '').trim().toLowerCase(),
      authorName: String(n.authorName || '').trim(),
      authorEmail: String(n.authorEmail || '').trim().toLowerCase(),
    }));
}

async function resolveActorName(req) {
  const authorEmail = (req.user?.email || '').trim().toLowerCase();
  let authorName = String(req.user?.name || '').trim();
  if (!authorName && req.user?.id) {
    try {
      const actor = await findUserById(req.user.id);
      authorName = String(actor?.name || '').trim();
    } catch {
      /* ignore */
    }
  }
  if (!authorName) authorName = authorEmail || 'מנהל';
  return { authorEmail, authorName };
}

/**
 * הוספת הערת ביניים לתיק (צוות בלבד).
 * POST /admin/cases/:id/notes  Body: { text: string }
 */
export const addCaseInterimNote = async (req, res) => {
  try {
    const { id } = req.params;
    const text = String(req.body?.text || '').trim();
    if (!text) {
      return res.status(400).json({ error: 'נא להזין טקסט להערה' });
    }
    if (text.length > 4000) {
      return res.status(400).json({ error: 'ההערה ארוכה מדי (מקסימום 4000 תווים)' });
    }

    const caseData = await findCaseById(id);
    if (!caseData) {
      return res.status(404).json({ error: 'תיק לא נמצא' });
    }

    const { authorEmail, authorName } = await resolveActorName(req);

    const note = {
      id: crypto.randomUUID(),
      text,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      authorName,
      authorEmail,
    };

    const prev = normalizeInterimNotes(caseData.interimNotes);
    /* הערה חדשה בראש הרשימה (האחרונה קודם) */
    const interimNotes = [note, ...prev];
    const updated = await updateCase(id, { interimNotes });

    return res.status(201).json({
      message: 'ההערה נוספה',
      note,
      interimNotes: normalizeInterimNotes(updated?.interimNotes),
      case: updated,
    });
  } catch (error) {
    console.error('addCaseInterimNote error:', error);
    return res.status(500).json({ error: 'שגיאה בהוספת הערה' });
  }
};

/**
 * עריכת הערת ביניים קיימת (כל מנהל בפאנל).
 * PATCH /admin/cases/:id/notes/:noteId  Body: { text: string }
 */
export const updateCaseInterimNote = async (req, res) => {
  try {
    const { id, noteId } = req.params;
    const text = String(req.body?.text || '').trim();
    if (!text) {
      return res.status(400).json({ error: 'נא להזין טקסט להערה' });
    }
    if (text.length > 4000) {
      return res.status(400).json({ error: 'ההערה ארוכה מדי (מקסימום 4000 תווים)' });
    }
    if (!noteId) {
      return res.status(400).json({ error: 'חסר מזהה הערה' });
    }

    const caseData = await findCaseById(id);
    if (!caseData) {
      return res.status(404).json({ error: 'תיק לא נמצא' });
    }

    const prev = normalizeInterimNotes(caseData.interimNotes);
    const idx = prev.findIndex((n) => String(n.id) === String(noteId));
    if (idx < 0) {
      return res.status(404).json({ error: 'הערה לא נמצאה' });
    }

    const { authorEmail, authorName } = await resolveActorName(req);
    const existing = prev[idx];
    const updatedNote = {
      ...existing,
      text,
      updatedAt: new Date().toISOString(),
      editedByName: authorName,
      editedByEmail: authorEmail,
    };
    const interimNotes = prev.map((n, i) => (i === idx ? updatedNote : n));
    const updated = await updateCase(id, { interimNotes });

    return res.json({
      message: 'ההערה עודכנה',
      note: updatedNote,
      interimNotes: normalizeInterimNotes(updated?.interimNotes),
      case: updated,
    });
  } catch (error) {
    console.error('updateCaseInterimNote error:', error);
    return res.status(500).json({ error: 'שגיאה בעדכון ההערה' });
  }
};

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

/** מנהלי ראיונות – מקבלים מייל כשתיק ממתין לראיון אישי */
const INTERVIEW_STAFF_EMAILS = ['lapidwoldenberg@gmail.com', 'abergelyuda7@gmail.com'];
/** מנהל טפסים – מקבל מייל אחרי שנעשה ראיון ומחכים להגשת טפסים */
const FORMS_STAFF_EMAILS = ['shneortole257@gmail.com'];

/** טלפונים ישראליים של העובדים להתראות SMS (ניתן לדרוס ב-STAFF_PHONE_OVERRIDES) */
const DEFAULT_STAFF_PHONES = {
  'abergelyuda7@gmail.com': '0515770516', // יהודה אברגל
  'lapidwoldenberg@gmail.com': '0545882718', // לפיד וולדנברג
  'shneortole257@gmail.com': '0586770584', // שניאור טולדנו
};

/** ניסוח ישן לפני תיקון (נפתח → נפתחה) – עדיין קיים בתיקים ישנים */
const LEGACY_STAGE1_LABEL = 'נפתח הבקשה באתר מחכה לראיון אישי';

/**
 * מחזיר את מספר שלב העיבוד הנוכחי (1–5) או 0 אם אין שלב.
 * מזהה גם את תווית השלב הקנונית וגם את הניסוח הישן של שלב 1.
 */
function previousProcessingStageNumber(caseData) {
  const d = String(caseData?.detailedAdminStatus || '').trim();
  if (!d) return 0;
  for (const [num, label] of Object.entries(PROCESSING_STAGES)) {
    if (d === label) return Number(num);
  }
  /* תאימות לאחור: תיקים שנשמרו עם "נפתח" במקום "נפתחה" */
  if (d === LEGACY_STAGE1_LABEL) return 1;
  return 0;
}

function benefitTypeLabelHe(type) {
  const map = {
    family: 'משפחה',
    individual: 'בגיר מעל 21',
    minor: 'צעיר',
    card_order: 'הזמנת כרטיס',
  };
  return map[type] || type || '—';
}

/**
 * טלפון לעובד: STAFF_PHONE_OVERRIDES → ברירת מחדל בקוד → פרופיל משתמש.
 * STAFF_PHONE_OVERRIDES=email:+9725...,email2:05...
 */
function getStaffPhoneOverrides() {
  const map = new Map(Object.entries(DEFAULT_STAFF_PHONES));
  const raw = process.env.STAFF_PHONE_OVERRIDES || '';
  for (const part of String(raw).split(',')) {
    const idx = part.indexOf(':');
    if (idx <= 0) continue;
    const email = part.slice(0, idx).trim().toLowerCase();
    const phone = part.slice(idx + 1).trim();
    if (email && phone) map.set(email, phone);
  }
  return map;
}

function staffActionNoteFor(stageNum, email) {
  const e = String(email || '').trim().toLowerCase();
  if (stageNum === 1 && INTERVIEW_STAFF_EMAILS.includes(e)) {
    return 'נא לתאם ולבצע ראיון אישי עם הלקוח.';
  }
  if (stageNum === 2 && FORMS_STAFF_EMAILS.includes(e)) {
    return 'נא להשלים מילוי והגשת טפסים מול הלקוח.';
  }
  return '';
}

/**
 * מייל + WhatsApp אישי לכל עובד במעבר שלב.
 */
async function notifyStaffOnCaseStageChange({ stageNum, stageLabel, caseInfo }) {
  const staffEmails = getSecondaryAdminEmails();
  if (staffEmails.length === 0) return;

  const phoneOverrides = getStaffPhoneOverrides();
  const clientName = (caseInfo.clientName || '').trim() || 'לקוח';
  const waBase = `סוכן ביטוח: תיק של ${clientName} עבר לשלב "${stageLabel}".`;

  for (const email of staffEmails) {
    const actionNote = staffActionNoteFor(stageNum, email);
    try {
      await sendCaseStageUpdateEmail([email], caseInfo, {
        stageNum,
        stageLabel,
        actionNote,
      });
    } catch (err) {
      console.error('notifyStaff email error for', email, err?.message || err);
    }

    try {
      let phone = phoneOverrides.get(email) || '';
      if (!phone) {
        const staffUser = await findUserByEmail(email);
        phone = (staffUser?.phone || '').trim();
      }
      if (phone) {
        const waBody = actionNote ? `${waBase} ${actionNote}` : waBase;
        await sendWhatsAppMessage(phone, waBody, {
          clientName,
          stageLabel,
          actionNote,
        });
      } else {
        console.warn('[WhatsApp] No phone for staff', email, '– skipped');
      }
    } catch (err) {
      console.error('notifyStaff WhatsApp error for', email, err?.message || err);
    }
  }
}

/**
 * מנהל מעדכן שלב עיבוד תיק (עמוד "עובדים לך על הכייס")
 * Body: { stage: 1|2|3|4|5 | null, clearStage?: boolean, rejectionReason?, approvedBenefits? }
 * לחיצה שנייה על אותו שלב / clearStage:true – מבטל את השלב לגמרי (בלי מייל).
 * בכל מעבר לשלב חדש נשלחים מייל ו-WhatsApp לעובדים.
 */
export const updateCaseProcessing = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      stage,
      clearStage,
      rejectionReason,
      approvedBenefits: approvedBenefitsRaw,
    } = req.body || {};
    const caseData = await findCaseById(id);
    if (!caseData) {
      return res.status(404).json({ error: 'תיק לא נמצא' });
    }

    const prevStage = previousProcessingStageNumber(caseData);
    const wantsClear =
      clearStage === true ||
      stage === null ||
      stage === '' ||
      stage === 0 ||
      stage === '0' ||
      String(stage || '').toLowerCase() === 'clear';

    /* ביטול שלב פעיל – ללא שליחת מייל/התראה */
    if (wantsClear) {
      const updated = await updateCase(id, {
        detailedAdminStatus: null,
        rejectionReason: null,
        approvedBenefits: null,
        status: CASE_STATUS.PENDING,
      });
      return res.json({ message: 'שלב העיבוד בוטל', case: updated, cleared: true });
    }

    const stageNum = typeof stage === 'string' ? parseInt(stage, 10) : stage;
    if (!Number.isInteger(stageNum) || stageNum < 1 || stageNum > 5) {
      return res.status(400).json({ error: 'סטטוס לא תקין. שלב חייב להיות 1–5.' });
    }

    /* לחיצה שנייה על אותו שלב פעיל – ביטול מלא בלי מייל */
    if (stageNum === prevStage) {
      const updated = await updateCase(id, {
        detailedAdminStatus: null,
        rejectionReason: null,
        approvedBenefits: null,
        status: CASE_STATUS.PENDING,
      });
      return res.json({ message: 'שלב העיבוד בוטל', case: updated, cleared: true });
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
      updates.rejectionReason = null;
      updates.approvedBenefits = null;
    }
    const updated = await updateCase(id, updates);

    /* התראות רק במעבר לשלב חדש (לא בביטול) */
    try {
      const user = caseData.userId ? await findUserById(caseData.userId) : null;
      const caseInfo = {
        caseId: id,
        clientName: user?.name || caseData.personalDetails?.fullName || '',
        clientEmail: user?.email || '',
        clientPhone: user?.phone || caseData.personalDetails?.phone || '',
        benefitType: benefitTypeLabelHe(caseData.benefitType),
      };
      await notifyStaffOnCaseStageChange({
        stageNum,
        stageLabel: detailedAdminStatus,
        caseInfo,
      });
    } catch (notifyErr) {
      console.error('updateCaseProcessing staff notify error:', notifyErr?.message || notifyErr);
    }

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
