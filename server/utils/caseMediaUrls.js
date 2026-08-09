import { getSignedUrl } from '../services/supabaseStorage.js';

/** TTL לצפייה במסמכים בממשק המנהל (רענון הדף מפיק קישורים חדשים) */
const ADMIN_MEDIA_SIGNED_TTL_SEC = 60 * 60 * 8; // 8 שעות

function alreadyPublicOrInline(val) {
  if (!val || typeof val !== 'string') return true;
  const t = val.trim();
  if (!t) return true;
  if (/^https?:\/\//i.test(t)) return true;
  if (/^data:/i.test(t)) return true;
  return false;
}

export async function signMediaIfStoragePath(val, expiresSec = ADMIN_MEDIA_SIGNED_TTL_SEC) {
  if (alreadyPublicOrInline(val)) return val;
  const signed = await getSignedUrl(String(val).trim(), expiresSec);
  return signed || val;
}

/**
 * ממיר נתיבי Supabase Storage (bucket פרטי) ל-signed URLs עבור תצוגת מנהל.
 * לא משנה מסמכים שכבר data:/http(s):.
 */
export async function withSignedCaseMediaForAdmin(caseData, expiresSec = ADMIN_MEDIA_SIGNED_TTL_SEC) {
  if (!caseData || typeof caseData !== 'object') return caseData;

  const out = { ...caseData };

  const [signatureImage, idCardPhoto, idCardAnnex] = await Promise.all([
    signMediaIfStoragePath(caseData.signatureImage, expiresSec),
    signMediaIfStoragePath(caseData.idCardPhoto, expiresSec),
    signMediaIfStoragePath(caseData.idCardAnnex, expiresSec),
  ]);
  out.signatureImage = signatureImage;
  out.idCardPhoto = idCardPhoto;
  out.idCardAnnex = idCardAnnex;

  if (Array.isArray(caseData.attachments)) {
    out.attachments = await Promise.all(
      caseData.attachments.map(async (item) => {
        if (typeof item === 'string') return signMediaIfStoragePath(item, expiresSec);
        if (item && typeof item === 'object') {
          const p = item.path || item.url;
          if (typeof p === 'string') {
            const signed = await signMediaIfStoragePath(p, expiresSec);
            return signed;
          }
        }
        return item;
      })
    );
  }

  if (Array.isArray(caseData.attachmentMeta)) {
    out.attachmentMeta = await Promise.all(
      caseData.attachmentMeta.map(async (m) => {
        if (!m || typeof m !== 'object') return m;
        const p = m.path;
        if (typeof p !== 'string') return m;
        const signed = await signMediaIfStoragePath(p, expiresSec);
        return { ...m, path: signed };
      })
    );
  }

  /* פרטי HRA – נתיבי storage נשארים; imageUrl/fileUrl לחתימה זמנית לתצוגה */
  if (caseData.hraDetails && typeof caseData.hraDetails === 'object') {
    const h = caseData.hraDetails;
    const [imageUrl, fileUrl] = await Promise.all([
      h.imagePath ? signMediaIfStoragePath(h.imagePath, expiresSec) : Promise.resolve(null),
      h.filePath ? signMediaIfStoragePath(h.filePath, expiresSec) : Promise.resolve(null),
    ]);
    out.hraDetails = {
      ...h,
      imageUrl: imageUrl || null,
      fileUrl: fileUrl || null,
    };
  }

  return out;
}
