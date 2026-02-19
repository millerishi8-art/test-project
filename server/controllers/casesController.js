import { v4 as uuidv4 } from 'uuid';
import {
  readCases,
  findCasesByUserId,
  createCase,
  updateCase,
} from '../models/Case.js';
import { CASE_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES, RENEWAL_MONTHS } from '../components/constants.js';
import { uploadBase64 } from '../services/cloudinary.js';

function isBase64DataUrl(str) {
  return typeof str === 'string' && str.trim().startsWith('data:image');
}

async function resolveImageField(value, folder = 'cases') {
  if (!value || typeof value !== 'string') return null;
  if (isBase64DataUrl(value)) {
    const url = await uploadBase64(value, folder);
    return url || value;
  }
  return value;
}

/**
 * שליחת תיק חדש
 */
export const submitCase = async (req, res) => {
  try {
    const { benefitType, address, familyBackground, personalDetails, signature, signatoryName, signatureImage, idCardPhoto, idCardAnnex } = req.body;

    if (!benefitType || !address || !personalDetails) {
      return res.status(400).json({ error: ERROR_MESSAGES.CASES.REQUIRED_FIELDS });
    }

    const renewalDate = new Date();
    renewalDate.setMonth(renewalDate.getMonth() + RENEWAL_MONTHS);
    const signedAt = new Date().toISOString();

    const [signatureImageUrl, idCardPhotoUrl, idCardAnnexUrl] = await Promise.all([
      resolveImageField(signatureImage, 'cases/signatures'),
      resolveImageField(idCardPhoto, 'cases/id-cards'),
      resolveImageField(idCardAnnex, 'cases/id-annex'),
    ]);

    const newCase = {
      id: uuidv4(),
      userId: req.user.id,
      benefitType,
      address,
      familyBackground: familyBackground || '',
      personalDetails,
      signature: signature || false,
      signatoryName: (signatoryName || '').trim() || null,
      signatureImage: signatureImageUrl || null,
      idCardPhoto: idCardPhotoUrl || null,
      idCardAnnex: idCardAnnexUrl || null,
      signedAt: (signatoryName && (signatoryName + '').trim()) || signatureImageUrl ? signedAt : null,
      status: CASE_STATUS.SUBMITTED,
      createdAt: new Date().toISOString(),
      renewalDate: renewalDate.toISOString(),
      isRenewed: false,
    };

    createCase(newCase);
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
export const getMyCases = (req, res) => {
  const userCases = findCasesByUserId(req.user.id);
  res.json(userCases);
};

/**
 * חידוש תיק
 */
export const renewCase = (req, res) => {
  try {
    const { caseId } = req.params;
    const cases = readCases();
    const caseIndex = cases.findIndex((c) => c.id === caseId && c.userId === req.user.id);

    if (caseIndex === -1) {
      return res.status(404).json({ error: ERROR_MESSAGES.CASES.CASE_NOT_FOUND });
    }

    const renewalDate = new Date();
    renewalDate.setMonth(renewalDate.getMonth() + RENEWAL_MONTHS);

    const updated = updateCase(caseId, {
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
