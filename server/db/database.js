/**
 * אתחול חיבור למסד: Supabase (PostgreSQL) בלבד.
 */
import { getDbUnavailableMessage } from '../components/constants.js';
import {
  getSupabaseAdmin,
  isSupabaseInvalidApiKeyError,
} from './supabaseClient.js';

let dbReady = false;

/**
 * הודעת שגיאת DB ללקוח: מעדיפה פירוט מהשרת (כשבטוח) על פני 503 גנרי.
 */
export function dbErrorMessageForClient(err) {
  if (err == null) return getDbUnavailableMessage();
  const m = String(err.message ?? err);
  if (m.startsWith('[DB]') || m.startsWith('[Supabase]')) return m;
  const low = m.toLowerCase();
  const hints = [
    'invalid api key',
    'invalid jwt',
    'fetch failed',
    'pgrst',
    'econnrefused',
    'enotfound',
    'getaddrinfo',
    'certificate',
    'socket',
    'network',
    'timeout',
    'חסרים משתני supabase',
    'fetch',
    'und_err',
  ];
  if (hints.some((h) => low.includes(h))) {
    return m.length > 450 ? `${m.slice(0, 450)}…` : m;
  }
  return getDbUnavailableMessage();
}

function enrichFetchOrNetworkError(error) {
  const msg = String(error?.message || error || '');
  const low = msg.toLowerCase();
  const cause = error?.cause;
  const causeCode = cause?.code || cause?.errno;
  if (low.includes('fetch failed') || causeCode === 'ENOTFOUND' || causeCode === 'ECONNREFUSED') {
    return new Error(
      '[DB] לא ניתן להגיע לשרת Supabase (רשת/DNS). בדוק ש-SUPABASE_URL תואם לפרויקט (https://…supabase.co ללא / בסוף), ' +
        'שהפרויקט לא הושבת, ושאין חסימת רשת ב-Vercel. פירוט: ' +
        (msg || causeCode || 'fetch failed')
    );
  }
  return error;
}

export async function connectToDatabase() {
  if (dbReady) return true;
  let sb;
  try {
    sb = getSupabaseAdmin();
  } catch (configErr) {
    throw configErr;
  }
  const { error } = await sb.from('app_users').select('id').limit(1);
  if (error) {
    if (isSupabaseInvalidApiKeyError(error)) {
      throw new Error(
        '[DB] מפתח API של Supabase לא תקין או לא שייך לפרויקט הזה. ב-Vercel: הדבק את **service_role** ' +
          '(מ-Supabase → Project Settings → API) ב-SUPABASE_SERVICE_ROLE_KEY — לא את מפתח ה-anon/publishable.'
      );
    }
    const wrapped = enrichFetchOrNetworkError(error);
    if (wrapped !== error) throw wrapped;
    const hint =
      error.code === '42P01' ||
      (error.message && /relation|does not exist|schema cache/i.test(error.message));
    if (hint) {
      throw new Error(
        '[DB] טבלאות חסרות. הרץ את server/db/supabase_schema.sql ב-Supabase SQL Editor.'
      );
    }
    throw new Error(
      `[DB] שגיאת Supabase/PostgREST: ${error.message || error.code || 'unknown'}`
    );
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

export default { connectToDatabase, getDb, closeDatabaseConnection, dbErrorMessageForClient };
