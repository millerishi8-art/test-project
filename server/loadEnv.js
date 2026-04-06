/**
 * חייב להיות ה-import הראשון מ-app.js (ובסקריפטים: לפני כל שימוש ב-process.env).
 * טוען server/.env בנתיב מפורש כדי שלא יישברו כשנקודת העבודה היא תיקיית השורש.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env');
const result = dotenv.config({ path: envPath });

const isNonProd = process.env.NODE_ENV !== 'production';

if (isNonProd) {
  const summary = {
    envPath,
    dotenvOk: !result.error,
    JWT_SECRET: Boolean(process.env.JWT_SECRET?.trim()),
    ADMIN_EMAIL: Boolean(process.env.ADMIN_EMAIL?.trim()),
    SUPABASE_URL_SET: Boolean(process.env.SUPABASE_URL?.trim()),
    SUPABASE_SERVICE_ROLE_SET: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    EMAIL_USER: Boolean(process.env.EMAIL_USER?.trim()),
  };
  console.log('[Env] Loaded server environment (secrets not printed):', summary);
  if (result.error && result.error.code !== 'ENOENT') {
    console.warn('[Env] dotenv message:', result.error.message);
  }
}
