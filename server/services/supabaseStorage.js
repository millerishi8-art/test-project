import { createClient } from '@supabase/supabase-js';

const BUCKET_NAME = 'private-cases';

/**
 * מחזיר את הגדרות Supabase מ־environment
 */
function getConfig() {
  const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
  const supabaseServiceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return { supabaseUrl, supabaseServiceRoleKey };
}

/**
 * מפיק את סוג ה־content type מתגית data URL (למשל data:image/png;base64,...)
 */
function getContentTypeFromDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return 'image/png';
  const match = dataUrl.match(/^data:([^;]+);/);
  if (match && match[1]) return match[1].trim().toLowerCase();
  return 'image/png';
}

/**
 * מעלה קובץ מתגית base64 (data URL) ל־Supabase Storage.
 * מחזיר את ה-path בתוך ה-bucket בהצלחה, או null בשגיאה.
 *
 * @param {string} base64DataUrl - מחרוזת בתבנית data:image/...;base64,...
 * @param {string} fileName - שם הקובץ (למשל signature.png)
 * @returns {Promise<string|null>} path בהצלחה, null בשגיאה או כש-Supabase לא מוגדר
 */
export async function uploadToSupabase(base64DataUrl, fileName) {
  const { supabaseUrl, supabaseServiceRoleKey } = getConfig();
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.warn('[Supabase] SUPABASE_URL או SUPABASE_SERVICE_ROLE_KEY חסרים – דילוג על העלאה');
    return null;
  }

  try {
    // הסרת כותרת ה-data URL (data:image/png;base64,) והמרה ל־Buffer
    const base64Match = (base64DataUrl || '').match(/^data:[^;]+;base64,(.+)$/);
    const base64String = base64Match ? base64Match[1].trim() : String(base64DataUrl).replace(/^[^,]+,/, '').trim();
    if (!base64String) {
      console.error('[Supabase] לא נמצא תוכן base64 תקין');
      return null;
    }
    const buffer = Buffer.from(base64String, 'base64');

    // נתיב ייחודי בתוך ה-bucket: uploads/טיימסטאמפ_שםקובץ
    const filePath = `uploads/${Date.now()}_${fileName || 'image.png'}`;
    const contentType = getContentTypeFromDataUrl(base64DataUrl);

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      console.error('[Supabase] שגיאה בהעלאה:', error.message);
      return null;
    }

    return data?.path ?? null;
  } catch (err) {
    console.error('[Supabase] uploadToSupabase:', err?.message || err);
    return null;
  }
}

/**
 * יוצר קישור זמני לצפייה בתמונה פרטית
 * @param {string} filePath - הנתיב שקיבלת מהעלאה (למשל 'uploads/123_image.png')
 * @returns {Promise<string|null>} - לינק זמני לצפייה או null
 */
export async function getSignedUrl(filePath) {
  const { supabaseUrl, supabaseServiceRoleKey } = getConfig();
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.warn('[Supabase] SUPABASE_URL או SUPABASE_SERVICE_ROLE_KEY חסרים – לא ניתן ליצור קישור');
    return null;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, 600); // הלינק יהיה תקף ל-600 שניות (10 דקות)

    if (error) throw error;
    return data?.signedUrl ?? null;
  } catch (err) {
    console.error('[Supabase] שגיאה ביצירת קישור זמני:', err?.message || err);
    return null;
  }
}
