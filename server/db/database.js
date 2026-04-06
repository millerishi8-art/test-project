/**
 * אתחול חיבור למסד: Supabase (PostgreSQL) בלבד.
 */
import { getSupabaseAdmin, isSupabaseInvalidApiKeyError } from './supabaseClient.js';

let dbReady = false;

export async function connectToDatabase() {
  if (dbReady) return true;
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('app_users').select('id').limit(1);
  if (error) {
    if (isSupabaseInvalidApiKeyError(error)) {
      throw new Error(
        '[DB] מפתח API של Supabase לא תקין או לא מתאים לפרויקט. ב-Vercel: וודא ש-SUPABASE_SERVICE_ROLE_KEY ' +
          '(או SUPABASE_SECRET_KEY) הוא מפתח **service_role** מ-Project Settings → API, לא מפתח anon/publishable.'
      );
    }
    const hint =
      error.code === '42P01' ||
      (error.message && /relation|does not exist|schema cache/i.test(error.message));
    if (hint) {
      throw new Error(
        '[DB] טבלאות חסרות. הרץ את server/db/supabase_schema.sql ב-Supabase SQL Editor.'
      );
    }
    throw error;
  }
  dbReady = true;
  console.log('[DB] Supabase מוכן');
  return true;
}

/**
 * הוסר – הנתונים דרך models/User.js ו-models/Case.js בלבד.
 */
export function getDb() {
  throw new Error('getDb() אינו נתמך עם Supabase. השתמש במודלים User / Case.');
}

export function closeDatabaseConnection() {
  dbReady = false;
}

export default { connectToDatabase, getDb, closeDatabaseConnection };
