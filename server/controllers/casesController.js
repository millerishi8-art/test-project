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
import { connectToMongoDB } from '../db/mongodb.js';
import { ISO_3166_1_ALPHA2 } from '../data/iso3166.js';

const EXTRA_CITIZENSHIP_CODES = new Set(ISO_3166_1_ALPHA2.filter((c) => c !== 'US'));

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
    await connectToMongoDB();
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
 * קבלת תיקים של המשתמש המחובר
 */
export const getMyCases = async (req, res) => {
  try {
    await connectToMongoDB();
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
    await connectToMongoDB();
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
