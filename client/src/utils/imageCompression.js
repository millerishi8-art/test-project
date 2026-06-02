/**
 * דחיסת תמונות בצד הלקוח לפני העלאה.
 *
 * רקע: טלפוני אפל (אייפון) מצלמים תמונות גדולות מאוד (לרוב HEIC/JPEG של כמה MB).
 * הטופס שולח את כל המסמכים יחד כ-base64 בגוף בקשה אחד. ללא דחיסה, גוף הבקשה
 * חורג ממגבלת הפלטפורמה (Vercel ~4.5MB) והקייס פשוט לא מגיע לשרת, ובמקביל
 * האייפון קורס למסך לבן בגלל צריכת זיכרון. דחיסה כאן פותרת את שתי הבעיות וגם
 * ממירה HEIC ל-JPEG כך שניתן לצפות במסמכים בכל מכשיר.
 */

const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_QUALITY = 0.72;
/** מעל גודל זה (בייטים של ה-data URL) ננסה להקטין עוד את האיכות. */
const TARGET_MAX_BYTES = 1_400_000;

/** קריאת קובץ כ-data URL (fallback וגם עבור PDF שלא נדחס). */
export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

/** אורך משוער בבייטים של מחרוזת base64 ב-data URL. */
function approxDataUrlBytes(dataUrl) {
  const commaIdx = dataUrl.indexOf(',');
  const b64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  return Math.floor((b64.length * 3) / 4);
}

/** טעינת קובץ תמונה לאלמנט שניתן לצייר על קנבס, תוך כיבוד אוריינטציית EXIF. */
async function loadDrawableImage(file) {
  // createImageBitmap עם imageOrientation מטפל ב-EXIF (סיבוב תמונות מהאייפון).
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (_) {
      // ספארי ישן עלול לא לתמוך באופציה – ננסה ללא אופציות.
      try {
        return await createImageBitmap(file);
      } catch (_) {
        /* נופלים ל-HTMLImageElement */
      }
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('image decode failed'));
      el.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function getDimensions(source) {
  const width = source.width || source.naturalWidth || 0;
  const height = source.height || source.naturalHeight || 0;
  return { width, height };
}

/**
 * דוחס קובץ תמונה אחד ל-data URL מסוג JPEG מוקטן.
 * עבור קבצים שאינם תמונה (למשל PDF) או אם הדחיסה נכשלת – מחזיר את הקובץ כפי שהוא.
 */
export async function compressImageFile(file, options = {}) {
  const maxDimension = options.maxDimension || DEFAULT_MAX_DIMENSION;
  const baseQuality = options.quality || DEFAULT_QUALITY;

  const isImage = file && typeof file.type === 'string' && file.type.startsWith('image/');
  if (!isImage) {
    // PDF וכל סוג אחר – נשלח כמו שהוא (ללא דחיסה).
    return readFileAsDataUrl(file);
  }

  let source;
  try {
    source = await loadDrawableImage(file);
  } catch (_) {
    return readFileAsDataUrl(file);
  }

  try {
    const { width, height } = getDimensions(source);
    if (!width || !height) {
      return readFileAsDataUrl(file);
    }

    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return readFileAsDataUrl(file);
    }
    // רקע לבן כדי שתמונות עם שקיפות (PNG) לא יהפכו לשחור ב-JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(source, 0, 0, targetW, targetH);

    let quality = baseQuality;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    // אם עדיין גדול מדי – מנסים להקטין איכות בכמה צעדים.
    for (let i = 0; i < 4 && approxDataUrlBytes(dataUrl) > TARGET_MAX_BYTES && quality > 0.4; i += 1) {
      quality -= 0.12;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }

    if (!dataUrl || dataUrl === 'data:,') {
      return readFileAsDataUrl(file);
    }
    return dataUrl;
  } catch (_) {
    return readFileAsDataUrl(file);
  } finally {
    if (source && typeof source.close === 'function') {
      try {
        source.close();
      } catch (_) {}
    }
  }
}

export { approxDataUrlBytes };
