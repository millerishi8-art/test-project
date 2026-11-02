import { readUsers, findUserByEmail, mergeUserExtraData } from '../models/User.js';
import {
  isSuperAdminEmail,
  getSecondaryAdminEmails,
  getSuperAdminEmail,
} from '../utils/adminEmails.js';
import { isUserRoleAdmin } from '../components/constants.js';
import { getInitials } from '../utils/initials.js';
import { buildStaffAgreementSeed } from '../data/staffAgreementSeeds.js';

const STAFF_DISPLAY_NAMES = {
  'abergelyuda7@gmail.com': 'יהודה אברגל',
  'lapidwoldenberg@gmail.com': 'לפיד וולדנברג',
  'lioranwork770@gmail.com': 'ליאור הלוי',
  'michalhezi2@gmail.com': 'מיכל',
  'workmiller770@gmail.com': 'מנחם פפר',
  'yudigruenberg@gmail.com': 'יוד גרונברג',
};

function staffDisplayName(email, fallbackName = '') {
  const key = String(email || '').trim().toLowerCase();
  if (STAFF_DISPLAY_NAMES[key]) return STAFF_DISPLAY_NAMES[key];
  return String(fallbackName || '').trim() || key;
}

function cleanText(value, max) {
  return String(value == null ? '' : value)
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, max);
}

function cleanSignature(value) {
  if (value == null || value === '') return '';
  const s = String(value);
  if (!s.startsWith('data:image/png;base64,')) {
    const err = new Error('BAD_SIGNATURE');
    err.code = 'BAD_SIGNATURE';
    throw err;
  }
  if (s.length > 700000) {
    const err = new Error('SIG_TOO_BIG');
    err.code = 'SIG_TOO_BIG';
    throw err;
  }
  return s;
}

function presentAgreement(raw, email, name) {
  const seed = buildStaffAgreementSeed(email, name);
  const source = raw && typeof raw === 'object' ? raw : seed;
  const employerSignature = cleanText(source.employerSignature, 700000);
  const employeeSignature = cleanText(source.employeeSignature, 700000);
  const sectionsIn = Array.isArray(source.sections) ? source.sections : seed.sections;
  const sections = sectionsIn.slice(0, 40).map((section) => ({
    title: cleanText(section?.title, 200),
    items: (Array.isArray(section?.items) ? section.items : [])
      .slice(0, 30)
      .map((item) => cleanText(item, 2000))
      .filter(Boolean),
  }));
  return {
    employeeEmail: email,
    employeeName: cleanText(source.employeeName, 80) || name,
    employerName: cleanText(source.employerName, 80) || 'נעם מילר',
    employerId: cleanText(source.employerId, 40),
    employeeId: cleanText(source.employeeId, 40),
    title: cleanText(source.title, 120) || seed.title,
    kicker: cleanText(source.kicker, 80) || 'הסכם עבודה',
    dateLabel: cleanText(source.dateLabel, 80),
    intro: cleanText(source.intro, 4000),
    sections,
    employerSignature,
    employeeSignature,
    employerSignedAt: cleanText(source.employerSignedAt, 40),
    employeeSignedAt: cleanText(source.employeeSignedAt, 40),
    locked: Boolean(employerSignature && employeeSignature),
    initials: getInitials(cleanText(source.employeeName, 80) || name),
  };
}

function applyText(existing, body) {
  const src = body?.agreement && typeof body.agreement === 'object' ? body.agreement : {};
  const sectionsIn = Array.isArray(src.sections) ? src.sections.slice(0, 40) : existing.sections;
  const sections = sectionsIn
    .map((section) => ({
      title: cleanText(section?.title, 200) || 'סעיף.',
      items: (Array.isArray(section?.items) ? section.items : [])
        .slice(0, 30)
        .map((item) => cleanText(item, 2000))
        .filter(Boolean),
    }))
    .filter((section) => section.title || section.items.length);
  return {
    ...existing,
    title: cleanText(src.title, 120) || existing.title,
    kicker: cleanText(src.kicker, 80) || existing.kicker,
    dateLabel: cleanText(src.dateLabel, 80),
    intro: cleanText(src.intro, 4000),
    employeeName: cleanText(src.employeeName, 80) || existing.employeeName,
    employerId: cleanText(src.employerId, 40),
    employeeId: cleanText(src.employeeId, 40),
    sections: sections.length ? sections : existing.sections,
  };
}

function textKey(agreement) {
  return JSON.stringify({
    title: agreement.title,
    kicker: agreement.kicker,
    dateLabel: agreement.dateLabel,
    intro: agreement.intro,
    employeeName: agreement.employeeName,
    employerId: agreement.employerId,
    employeeId: agreement.employeeId,
    sections: agreement.sections,
  });
}

function toStored(agreement) {
  return {
    employeeEmail: agreement.employeeEmail,
    employeeName: agreement.employeeName,
    employerName: agreement.employerName,
    employerId: agreement.employerId,
    employeeId: agreement.employeeId,
    title: agreement.title,
    kicker: agreement.kicker,
    dateLabel: agreement.dateLabel,
    intro: agreement.intro,
    sections: agreement.sections,
    employerSignature: agreement.employerSignature,
    employeeSignature: agreement.employeeSignature,
    employerSignedAt: agreement.employerSignedAt,
    employeeSignedAt: agreement.employeeSignedAt,
  };
}

async function persistAgreement(email, agreement) {
  const stored = toStored(agreement);
  const user = await findUserByEmail(email);
  if (user?.id) {
    await mergeUserExtraData(user.id, { staffAgreement: stored });
    await clearVaultKey(email);
    return;
  }
  const primary = await findUserByEmail(getSuperAdminEmail());
  if (!primary?.id) {
    const err = new Error('NO_PRIMARY');
    err.code = 'NO_PRIMARY';
    throw err;
  }
  const vault = { ...(primary.staffAgreementVault || {}) };
  vault[email] = stored;
  await mergeUserExtraData(primary.id, { staffAgreementVault: vault });
}

async function clearVaultKey(email) {
  const primary = await findUserByEmail(getSuperAdminEmail());
  if (!primary?.id || !primary.staffAgreementVault || !primary.staffAgreementVault[email]) return;
  const vault = { ...primary.staffAgreementVault };
  delete vault[email];
  await mergeUserExtraData(primary.id, { staffAgreementVault: vault });
}

function rosterFrom(users) {
  const byEmail = new Map(
    users.map((user) => [String(user.email || '').trim().toLowerCase(), user])
  );
  const people = [];
  const seen = new Set();
  const add = (email, user) => {
    const key = String(email || '').trim().toLowerCase();
    if (!key || seen.has(key) || isSuperAdminEmail(key)) return;
    seen.add(key);
    const account = user || byEmail.get(key) || null;
    people.push({
      email: key,
      name: staffDisplayName(key, account?.name || ''),
      account,
    });
  };
  for (const email of getSecondaryAdminEmails()) add(email, byEmail.get(email));
  for (const user of users) {
    if (!isUserRoleAdmin(user?.role)) continue;
    add(user?.email, user);
  }
  people.sort((a, b) => String(a.name).localeCompare(String(b.name), 'he'));
  return { people, byEmail };
}

function storedRaw(email, account, primary) {
  if (account?.staffAgreement && typeof account.staffAgreement === 'object') {
    return account.staffAgreement;
  }
  const vault = primary?.staffAgreementVault;
  if (vault && vault[email] && typeof vault[email] === 'object') return vault[email];
  return null;
}

/**
 * מנהל ראשי רואה את כל ההסכמים. מנהל משנה רואה רק את שלו.
 * GET /admin/staff-agreements
 */
export const listStaffAgreements = async (req, res) => {
  try {
    const viewer = String(req.user?.email || '').trim().toLowerCase();
    const isPrimary = isSuperAdminEmail(viewer);
    const users = await readUsers();
    const primary = users.find((user) => isSuperAdminEmail(user?.email)) || null;
    const { people } = rosterFrom(users);
    const visible = isPrimary ? people : people.filter((person) => person.email === viewer);
    const agreements = visible.map((person) =>
      presentAgreement(storedRaw(person.email, person.account, primary), person.email, person.name)
    );
    return res.json({ canEditText: isPrimary, viewerEmail: viewer, agreements });
  } catch (error) {
    console.error('listStaffAgreements error:', error);
    return res.status(500).json({ error: 'שגיאה בשליפת הסכמי העובדים' });
  }
};

/**
 * עריכת נוסח (רק נועם, ורק כל עוד לא חתום), חתימה, או פתיחה חריגה.
 * PUT /admin/staff-agreements/:email
 */
export const updateStaffAgreement = async (req, res) => {
  try {
    const viewer = String(req.user?.email || '').trim().toLowerCase();
    const isPrimary = isSuperAdminEmail(viewer);
    const email = decodeURIComponent(String(req.params.email || ''))
      .trim()
      .toLowerCase();
    const users = await readUsers();
    const primary = users.find((user) => isSuperAdminEmail(user?.email)) || null;
    const { people } = rosterFrom(users);
    const person = people.find((item) => item.email === email);
    if (!person) return res.status(404).json({ error: 'העובד לא נמצא ברשימת העובדים' });
    if (!isPrimary && viewer !== email) {
      return res.status(403).json({ error: 'אפשר לראות ולחתום רק על ההסכם שלך' });
    }

    const current = presentAgreement(storedRaw(email, person.account, primary), email, person.name);
    const action = String(req.body?.action || '');
    let next = current;

    if (action === 'save-text') {
      if (!isPrimary) return res.status(403).json({ error: 'רק נעם יכול לערוך את נוסח ההסכם' });
      if (current.locked) {
        return res.status(409).json({
          error: 'ההסכם כבר נחתם על ידי שני הצדדים ונעול. לעריכה צריך לפתוח אותו במקרה חריג.',
        });
      }
      next = applyText(current, req.body);
      if (textKey(next) !== textKey(current) && (current.employerSignature || current.employeeSignature)) {
        next.employerSignature = '';
        next.employeeSignature = '';
        next.employerSignedAt = '';
        next.employeeSignedAt = '';
      }
    } else if (action === 'exceptional-edit') {
      if (!isPrimary) return res.status(403).json({ error: 'רק נעם יכול לפתוח הסכם חתום במקרה חריג' });
      next = applyText(current, req.body);
      next.employerSignature = '';
      next.employeeSignature = '';
      next.employerSignedAt = '';
      next.employeeSignedAt = '';
    } else if (action === 'sign-employer') {
      if (!isPrimary) return res.status(403).json({ error: 'רק נעם חותם כמעסיק' });
      if (current.locked) return res.status(409).json({ error: 'ההסכם כבר נעול' });
      const signature = cleanSignature(req.body?.signature);
      if (!signature) return res.status(400).json({ error: 'חסרה חתימה' });
      next = {
        ...current,
        employerSignature: signature,
        employerSignedAt: new Date().toISOString(),
      };
    } else if (action === 'sign-employee') {
      if (viewer !== email) return res.status(403).json({ error: 'רק העובד עצמו חותם על הצד שלו' });
      if (current.locked) return res.status(409).json({ error: 'ההסכם כבר נעול' });
      const signature = cleanSignature(req.body?.signature);
      if (!signature) return res.status(400).json({ error: 'חסרה חתימה' });
      next = {
        ...current,
        employeeSignature: signature,
        employeeSignedAt: new Date().toISOString(),
      };
    } else {
      return res.status(400).json({ error: 'פעולה לא מוכרת' });
    }

    await persistAgreement(email, next);
    const saved = presentAgreement(toStored(next), email, person.name);
    return res.json({ agreement: saved });
  } catch (error) {
    console.error('updateStaffAgreement error:', error);
    if (error?.code === 'BAD_SIGNATURE') {
      return res.status(400).json({ error: 'החתימה לא תקינה' });
    }
    if (error?.code === 'SIG_TOO_BIG') {
      return res.status(400).json({ error: 'החתימה גדולה מדי' });
    }
    if (error?.code === 'NO_JSONB' || error?.code === 'NO_PRIMARY') {
      return res.status(503).json({ error: 'אי אפשר לשמור את ההסכם בחשבון כרגע' });
    }
    return res.status(500).json({ error: 'שגיאה בשמירת ההסכם' });
  }
};
