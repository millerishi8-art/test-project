import { v2 as cloudinary } from 'cloudinary';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

const isConfigured = Boolean(cloudName && apiKey && apiSecret);

if (isConfigured) {
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
}

/**
 * העלאת תמונה מקודדת base64 (data URL) ל-Cloudinary.
 * @param {string} dataUrl - מחרוזת מסוג data:image/...;base64,...
 * @param {string} [folder='cases'] - תיקייה ב-Cloudinary
 * @returns {Promise<string|null>} כתובת התמונה (secure_url) או null אם ההעלאה נכשלה / Cloudinary לא מוגדר
 */
export async function uploadBase64(dataUrl, folder = 'cases') {
  if (!isConfigured || !dataUrl || typeof dataUrl !== 'string') {
    return null;
  }
  const trimmed = dataUrl.trim();
  if (!trimmed.startsWith('data:image')) {
    return null;
  }
  try {
    const result = await cloudinary.uploader.upload(trimmed, {
      folder,
      resource_type: 'image',
    });
    return result?.secure_url || null;
  } catch (err) {
    console.error('Cloudinary upload error:', err?.message || err);
    return null;
  }
}

export { isConfigured as isCloudinaryConfigured };
