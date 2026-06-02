import { v4 as uuidv4 } from 'uuid';
import {
  readCases,
  findCasesByUserId,
  createCase,
  updateCase,
} from '../models/Case.js';
import {
  CASE_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  RENEWAL_MONTHS,
  FOOD_STAMPS_DECLARATIONS_HEBREW,
} from '../components/constants.js';
import { uploadToSupabase } from '../services/supabaseStorage.js';
import { connectToDatabase } from '../db/database.js';
import iso3166Alpha2Codes from '../data/countryCodes.js';
import { findUserById, updateUserById } from '../models/User.js';
import {
  sendDeferredPaymentRequestToAdmin,
  sendDeferredPaymentProposalSubmittedToAdmin,
} from '../services/email.js';
import { getSuperAdminEmail } from '../utils/adminEmails.js';
import {
  parseYyyyMmDd,
  utcTodayYyyyMmDd,
} from '../utils/deferredPaymentDates.js';

const EXTRA_CITIZENSHIP_CODES = new Set(iso3166Alpha2Codes.filter((c) => c !== 'US'));

function normalizeAdditionalCitizenshipCountry(additionalCitizenship, raw) {
  if (additionalCitizenship !== 'Yes') return '';
  const code = String(raw || '')
    .trim()
    .toUpperCase()
    .slice(0, 2);
  if (code.length !== 2 || !EXTRA_CITIZENSHIP_CODES.has(code)) return '';
  return code;
}

function isBase64DataUrl(str) {
  return typeof str === 'string' && /^data:[^;]+;base64,/i.test(str.trim());
}

function fileExtFromDataUrl(dataUrl) {
  const s = String(dataUrl || '').trim().toLowerCase();
  if (s.startsWith('data:application/pdf')) return 'pdf';
  if (s.startsWith('data:image/png')) return 'png';
  if (s.startsWith('data:image/webp')) return 'webp';
  return 'jpg';
}

async function resolveMediaField(value, folder = 'cases') {
  if (!value || typeof value !== 'string') return null;
  if (isBase64DataUrl(value)) {
    const baseName = (folder.split('/').pop() || 'file').replace(/\s+/g, '-');
    const isPdf = value.trim().toLowerCase().startsWith('data:application/pdf');
    const fileName = `${baseName}.${isPdf ? 'pdf' : 'png'}`;
    const path = await uploadToSupabase(value, fileName);
    return path || value;
  }
  return value;
}

export const uploadCaseAttachment = async (req, res) => {
  try {
    const rawData = req.body?.data;
    const rawCategory = String(req.body?.category || 'general');
    const rawFileName = String(req.body?.fileName || 'upload');
    if (!isBase64DataUrl(rawData)) {
      return res.status(400).json({ error: 'קובץ לא תקין להעלאה' });
    }

    const safeCategory = rawCategory.replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'general';
    const safeFileName = rawFileName.replace(/[^a-z0-9_.-]/gi, '').slice(0, 80) || 'upload';
    const ext = fileExtFromDataUrl(rawData);
    const stampedName = `${safeCategory}-${Date.now()}-${safeFileName}.${ext}`;

    const path = await uploadToSupabase(rawData, stampedName);
    if (!path) {
      return res.status(500).json({ error: 'העלאת קובץ נכשלה' });
    }
    return res.json({ ok: true, path, category: safeCategory });
  } catch (error) {
    console.error('uploadCaseAttachment error:', error);
    return res.status(500).json({ error: 'שגיאה בהעלאת קובץ' });
  }
};

function buildRentDeclarationFields(wantsRentAssistance, monthlyRentAmount, rentDeclarationOptedOut) {
  const optedOut =
    rentDeclarationOptedOut === true ||
    rentDeclarationOptedOut === 'true' ||
    wantsRentAssistance === false ||
    wantsRentAssistance === 'false';
  if (optedOut) {
    return {
      wantsRentAssistance: false,
      monthlyRentAmount: null,
      optedOut: true,
    };
  }
  const raw = String(monthlyRentAmount ?? '').trim();
  const parsed = raw === '' ? null : Number(raw);
  const amount =
    parsed != null && !Number.isNaN(parsed) && parsed > 0 ? Math.round(parsed) : null;
  return {
    wantsRentAssistance: true,
    monthlyRentAmount: amount,
    optedOut: false,
  };
}

/**
 * שליחת תיק חדש
 */
function normalizePersonalDetails(body) {
  let { personalDetails, address, fullName } = body;
  if (personalDetails && typeof personalDetails === 'object' && !Array.isArray(personalDetails)) {
    return { personalDetails, address: address || personalDetails.address };
  }
  if (fullName && body.dob) {
    const {
      fullName: fn,
      dob,
      birthPlace,
      fatherName,
      motherName,
      maritalStatus,
      dependentsCount,
      additionalCitizenship,
      additionalCitizenshipCountry,
      previousCase,
      activeCase,
      caseEmail,
      casePassword,
      dec1,
      dec2,
      dec3,
      dec4,
      signatureLink,
      familyChildrenDetails,
      spouseIncluded,
      spouseHealthStatus,
      wantsRentAssistance,
      monthlyRentAmount,
      rentDeclarationOptedOut,
    } = body;

    let familyChildren = [];
    if (Array.isArray(familyChildrenDetails)) {
      familyChildren = familyChildrenDetails.map((c) => ({
        id: String(c?.id || '')
          .replace(/[^a-zA-Z0-9_-]/g, '')
          .slice(0, 80),
        age: String(c?.age ?? '').slice(0, 20),
        dob: String(c?.dob ?? '').slice(0, 32),
        schoolClass: String(c?.schoolClass ?? '').slice(0, 500),
        medicalIssues: String(c?.medicalIssues ?? '').slice(0, 2000),
      }));
    }

    return {
      address,
      personalDetails: {
        form: 'food_stamps_eligibility',
        fullName: fn,
        dob,
        birthPlace,
        fatherName,
        motherName,
        maritalStatus,
        dependentsCount,
        additionalCitizenship,
        additionalCitizenshipCountry: normalizeAdditionalCitizenshipCountry(
          additionalCitizenship,
          additionalCitizenshipCountry
        ),
        previousCase,
        activeCase,
        caseEmail: caseEmail || '',
        casePassword: casePassword || '',
        declarationsAccepted: { dec1, dec2, dec3, dec4 },
        signatureLink: typeof signatureLink === 'string' ? signatureLink.trim() : '',
        ...(familyChildren.length ? { familyChildren } : {}),
        ...(spouseIncluded
          ? {
              spouse: {
                passportAndSsnSubmitted: true,
                healthStatus: String(spouseHealthStatus ?? '').slice(0, 2000),
              },
            }
          : {}),
        rentDeclaration: buildRentDeclarationFields(
          wantsRentAssistance,
          monthlyRentAmount,
          rentDeclarationOptedOut
        ),
      },
    };
  }
  if (typeof personalDetails === 'string' && personalDetails.trim()) {
    return { personalDetails, address };
  }
  return { personalDetails: null, address };
}

export const submitCase = async (req, res) => {
  try {
    await connectToDatabase();
    const {
      familyBackground,
      signature,
      signatoryName,
      signatureImage,
      idCardPhoto,
      idCardAnnex,
      attachments: attachmentsRaw,
      documentType,
    } = req.body;

    const { personalDetails: pdNorm, address: addrNorm } = normalizePersonalDetails(req.body);
    const benefitType = req.body.benefitType;
    const address = addrNorm || req.body.address;

    if (!benefitType || !address || !pdNorm) {
      return res.status(400).json({ error: ERROR_MESSAGES.CASES.REQUIRED_FIELDS });
    }

    if (
      pdNorm.form === 'food_stamps_eligibility' &&
      pdNorm.additionalCitizenship === 'Yes' &&
      !pdNorm.additionalCitizenshipCountry
    ) {
      return res.status(400).json({
        error: ERROR_MESSAGES.CASES.CITIZENSHIP_COUNTRY_REQUIRED,
        code: 'CITIZENSHIP_COUNTRY_REQUIRED',
      });
    }

    const renewalDate = new Date();
    renewalDate.setMonth(renewalDate.getMonth() + RENEWAL_MONTHS);
    const signedAt = new Date().toISOString();

    const attachmentsArray = Array.isArray(attachmentsRaw) ? attachmentsRaw : [];
    const attachmentPromises = attachmentsArray.map((item) => {
      const raw = typeof item === 'string' ? item : item?.data;
      const cat = typeof item === 'object' && item?.category ? String(item.category) : 'general';
      const safeCat = cat.replace(/[^a-z0-9_-]/gi, '') || 'general';
      return resolveMediaField(raw, `cases/attachments/${safeCat}`);
    });

    const [signatureImageUrl, idCardPhotoUrl, idCardAnnexUrl, ...attachmentUrls] = await Promise.all([
      resolveMediaField(signatureImage, 'cases/signatures'),
      resolveMediaField(idCardPhoto, 'cases/id-cards'),
      resolveMediaField(idCardAnnex, 'cases/id-annex'),
      ...attachmentPromises,
    ]);

    const metaWithPaths = attachmentsArray.map((item, i) => ({
      category: typeof item === 'object' && item?.category ? String(item.category) : 'general',
      path: attachmentUrls[i] || null,
    }));
    const hasPaymentAttachment = metaWithPaths.some((m) => m.category === 'payment' && m.path);

    const submittingUser = await findUserById(req.user.id);
    const deferredPaymentOk = submittingUser?.deferredPaymentApproved === true;
    if (!deferredPaymentOk && !hasPaymentAttachment) {
      return res.status(400).json({
        error: ERROR_MESSAGES.CASES.PAYMENT_PROOF_REQUIRED,
        code: 'PAYMENT_PROOF_REQUIRED',
      });
    }

    const declarationsHebrew =
      pdNorm && pdNorm.form === 'food_stamps_eligibility' ? { ...FOOD_STAMPS_DECLARATIONS_HEBREW } : null;

    const newCase = {
      id: uuidv4(),
      userId: req.user.id,
      benefitType,
      address,
      familyBackground: familyBackground || '',
      personalDetails: pdNorm,
      declarationsHebrew,
      signature: signature || false,
      signatoryName: (signatoryName || '').trim() || null,
      signatureImage: signatureImageUrl || null,
      idCardPhoto: idCardPhotoUrl || null,
      idCardAnnex: idCardAnnexUrl || null,
      attachments: attachmentUrls.filter(Boolean),
      attachmentMeta: attachmentsArray.map((item, i) => ({
        category: typeof item === 'object' && item?.category ? item.category : 'general',
        path: attachmentUrls[i] || null,
      })),
      documentType: documentType === 'license' || documentType === 'passport' ? documentType : 'id',
      signedAt: (signatoryName && (signatoryName + '').trim()) || signatureImageUrl ? signedAt : null,
      status: CASE_STATUS.SUBMITTED,
      createdAt: new Date().toISOString(),
      renewalDate: renewalDate.toISOString(),
      isRenewed: false,
    };

    await createCase(newCase);
    res.status(201).json({
      message: SUCCESS_MESSAGES.CASES.SUBMITTED,
      case: newCase,
    });
  } catch (error) {
    console.error('Case submission error:', error);
    res.status(500).json({ error: ERROR_MESSAGES.SERVER.CASE_SUBMIT });
  }
};

/**
 * לקוח מבקש אישור מנהל לפתיחת תיק בלי אישור תשלום מיידי – נשלח מייל למנהל-העל.
 */
export const requestDeferredPayment = async (req, res) => {
  try {
    await connectToDatabase();
    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: ERROR_MESSAGES.AUTH.USER_NOT_FOUND });
    }
    if (user.deferredPaymentApproved) {
      return res.status(400).json({ error: 'כבר קיים אישור תשלום מאוחר לחשבון זה.' });
    }
    if (user.deferredPaymentAwaitingClientDate || user.deferredPaymentProposalPending) {
      return res.status(400).json({
        error: 'כבר בתהליך תשלום מאוחר. השלימו את השלבים בטופס או המתינו לאישור.',
      });
    }
    if (user.deferredPaymentRequestPending) {
      return res.json({
        ok: true,
        pending: true,
        message: 'הבקשה כבר ממתינה לאישור המנהל.',
      });
    }

    const updated = await updateUserById(req.user.id, {
      deferredPaymentRequestPending: true,
      deferredPaymentRequestedAt: new Date().toISOString(),
    });
    if (!updated) {
      return res.status(500).json({ error: 'שגיאה בשמירת הבקשה' });
    }

    const adminTo = getSuperAdminEmail();
    const emailSent = await sendDeferredPaymentRequestToAdmin(adminTo, {
      clientName: user.name,
      clientEmail: user.email,
      clientId: user.id,
    });

    return res.json({
      ok: true,
      pending: true,
      emailSent,
      message: emailSent ? 'הבקשה נשלחה למנהל.' : 'הבקשה נרשמה; שליחת המייל נכשלה.',
    });
  } catch (error) {
    console.error('requestDeferredPayment error:', error);
    res.status(500).json({ error: 'שגיאה בשליחת הבקשה' });
  }
};

/**
 * לקוח שולח תאריך יעד לתשלום (אחרי אישור בשלב ראשון). גבול עליון לפי החלטת המנהל;
 * אם נדרש תאריך מוקדם יותר – התאריך חייב להיות לפני הפסקה שעל המנהל.
 */
export const submitDeferredPaymentProposedDeadline = async (req, res) => {
  try {
    await connectToDatabase();
    const raw = req.body?.deadline ?? req.body?.proposedDeadline;
    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: ERROR_MESSAGES.AUTH.USER_NOT_FOUND });
    }
    if (user.deferredPaymentApproved) {
      return res.status(400).json({ error: 'כבר קיים אישור סופי' });
    }
    if (!user.deferredPaymentAwaitingClientDate) {
      return res.status(400).json({ error: 'אין שלב פתוח להזנת תאריך' });
    }
    if (user.deferredPaymentProposalPending) {
      return res.status(400).json({ error: 'כבר נשלח תאריך; ממתינים לאישור המנהל' });
    }
    const anchor = user.deferredPaymentRequestApprovedAt;
    if (!anchor) {
      return res.status(400).json({ error: 'חסר מועד אישור ראשון' });
    }

    const chosen = parseYyyyMmDd(raw);
    if (!chosen) {
      return res.status(400).json({
        error: ERROR_MESSAGES.CASES.DEFERRED_DEADLINE_INVALID,
        code: 'DEFERRED_DEADLINE_INVALID',
      });
    }
    const minY = utcTodayYyyyMmDd();
    if (chosen < minY) {
      return res.status(400).json({
        error: ERROR_MESSAGES.CASES.DEFERRED_DEADLINE_INVALID,
        code: 'DEFERRED_DEADLINE_INVALID',
      });
    }
    const exclusiveUpper = user.deferredPaymentDeadlineMustBeBeforeYmd
      ? parseYyyyMmDd(user.deferredPaymentDeadlineMustBeBeforeYmd)
      : null;
    if (exclusiveUpper && !(chosen < exclusiveUpper)) {
      return res.status(400).json({
        error: ERROR_MESSAGES.CASES.DEFERRED_DEADLINE_INVALID,
        code: 'DEFERRED_DEADLINE_INVALID',
      });
    }

    const updated = await updateUserById(req.user.id, {
      deferredPaymentProposedDeadline: chosen,
      deferredPaymentProposalPending: true,
      deferredPaymentProposalSubmittedAt: new Date().toISOString(),
      deferredPaymentAwaitingClientDate: false,
      deferredPaymentDeadlineMustBeBeforeYmd: null,
    });
    if (!updated) {
      return res.status(500).json({ error: 'שגיאה בשמירת התאריך' });
    }

    const adminTo = getSuperAdminEmail();
    const emailSent = await sendDeferredPaymentProposalSubmittedToAdmin(adminTo, {
      clientName: user.name,
      clientEmail: user.email,
      clientId: user.id,
      proposedYmd: chosen,
    });

    return res.json({
      ok: true,
      proposedDeadline: chosen,
      emailSent,
      message: emailSent ? 'התאריך נשלח לאישור המנהל.' : 'התאריך נשלח; מייל למנהל נכשל.',
    });
  } catch (error) {
    console.error('submitDeferredPaymentProposedDeadline error:', error);
    res.status(500).json({ error: 'שגיאה בשמירת התאריך' });
  }
};

/**
 * קבלת תיקים של המשתמש המחובר
 */
export const getMyCases = async (req, res) => {
  try {
    await connectToDatabase();
    const userCases = await findCasesByUserId(req.user.id);
    res.json(userCases);
  } catch (error) {
    console.error('Error fetching user cases:', error);
    res.status(500).json({ error: 'שגיאה בשליפת התיקים' });
  }
};

/**
 * חידוש תיק
 */
export const renewCase = async (req, res) => {
  try {
    await connectToDatabase();
    const { caseId } = req.params;
    const cases = await readCases();
    const caseIndex = cases.findIndex((c) => c.id === caseId && c.userId === req.user.id);

    if (caseIndex === -1) {
      return res.status(404).json({ error: ERROR_MESSAGES.CASES.CASE_NOT_FOUND });
    }

    const renewalDate = new Date();
    renewalDate.setMonth(renewalDate.getMonth() + RENEWAL_MONTHS);

    const updated = await updateCase(caseId, {
      renewalDate: renewalDate.toISOString(),
      isRenewed: true,
      lastRenewedAt: new Date().toISOString(),
    });

    res.json({
      message: SUCCESS_MESSAGES.CASES.RENEWED,
      case: updated,
    });
  } catch (error) {
    console.error('Case renewal error:', error);
    res.status(500).json({ error: ERROR_MESSAGES.SERVER.CASE_RENEW });
  }
};
