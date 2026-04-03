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
    MONGODB_URI: Boolean(process.env.MONGODB_URI?.trim()),
    JWT_SECRET: Boolean(process.env.JWT_SECRET?.trim()),
    ADMIN_EMAIL: Boolean(process.env.ADMIN_EMAIL?.trim()),
    SUPABASE_URL_OR_PUBLIC: Boolean(
      (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
    ),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    EMAIL_USER: Boolean(process.env.EMAIL_USER?.trim()),
  };
  console.log('[Env] Loaded server environment (secrets not printed):', summary);
  if (result.error && result.error.code !== 'ENOENT') {
    console.warn('[Env] dotenv message:', result.error.message);
  }
}

const hasMongoUri = Boolean(
  (process.env.MONGODB_URI || process.env.DATABASE_URL || process.env.MONGO_URI || '').trim()
);
if (process.env.VERCEL && !hasMongoUri) {
  console.error(
    '[Env] Vercel: חסר MONGODB_URI / DATABASE_URL. הגדר ב-Project → Settings → Environment Variables והרץ Redeploy.'
  );
}
