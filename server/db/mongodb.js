/**
 * חיבור למסד נתונים: Supabase (PostgreSQL) דרך PostgREST.
 * שם הקובץ נשמר לתאימות עם import קיים: connectToMongoDB / closeMongoDB
 */
import { getSupabaseAdmin } from './supabaseClient.js';

let dbReady = false;

export async function connectToMongoDB() {
  if (dbReady) return true;
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('app_users').select('id').limit(1);
  if (error) {
    const hint =
      error.code === '42P01' ||
      (error.message && /relation|does not exist/i.test(error.message));
    if (hint) {
      throw new Error(
        '[DB] טבלאות חסרות. הרץ את server/db/supabase_schema.sql ב-Supabase SQL Editor.'
      );
    }
    throw error;
  }
  dbReady = true;
  console.log('[DB] Supabase PostgreSQL מוכן');
  return true;
}

/**
 * הוסר – הנתונים דרך models/User.js ו-models/Case.js בלבד.
 */
export function getDb() {
  throw new Error(
    'getDb() אינו נתמך עם Supabase. השתמש במודלים User / Case.'
  );
}

export async function closeMongoDB() {
  dbReady = false;
}

export default { connectToMongoDB, getDb, closeMongoDB };
