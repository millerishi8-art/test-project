import { createClient } from '@supabase/supabase-js';

let adminClient = null;
let supabaseEnvLogged = false;

/** מרכאות/רווחים מסביב לערך מ-Vercel */
function stripEnv(val) {
  if (val == null) return '';
  return String(val).trim().replace(/^['"]|['"]$/g, '');
}

/** לוג בטוח ל-Vercel: רק 5 תווים ראשונים (לא לחשוף URL/מפתח מלא) */
function preview5(label, value) {
  const s = value == null ? '' : String(value);
  if (!s) return `${label}: (empty)`;
  return `${label}: ${s.slice(0, 5)}… (len=${s.length})`;
}

/**
 * כתובת ה-API של Supabase: חייבת להתחיל ב-https:// וללא סלאש בסוף.
 */
export function normalizeSupabaseProjectUrl(raw) {
  let u = stripEnv(raw);
  if (!u) return '';
  u = u.replace(/\/+$/g, '');
  if (u.startsWith('http://')) {
    u = `https://${u.slice('http://'.length)}`;
  }
  if (!u.startsWith('https://')) {
    throw new Error(
      '[Supabase] כתובת הפרויקט חייבת להתחיל ב-https:// (בדוק SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL).'
    );
  }
  return u;
}

/**
 * כתובת פרויקט Supabase — סדר עדיפות כמו ב-Vercel.
 */
export function resolveSupabaseUrl() {
  const raw = stripEnv(
    process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      ''
  );
  if (!raw) return '';
  return normalizeSupabaseProjectUrl(raw);
}

/**
 * מפתח service_role בלבד (לא anon/publishable) — PostgREST דורש אותו לשרת.
 */
export function resolveSupabaseServiceRoleKey() {
  return stripEnv(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SERVICE_ROLE_KEY ||
      ''
  );
}

export function resolveSupabaseAnonKey() {
  return stripEnv(
    process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      ''
  );
}

function logSupabaseEnvOnce(url, key) {
  if (supabaseEnvLogged) return;
  supabaseEnvLogged = true;
  console.log('[Supabase]', preview5('SUPABASE_URL (first 5)', url), '|', preview5('SERVICE_ROLE_KEY (first 5)', key));
}

/**
 * לקוח Supabase עם הרשאות service_role — לשרת בלבד (עוקף RLS).
 * משתמש רק בערכים מ-resolveSupabaseUrl() ו-resolveSupabaseServiceRoleKey() (כולל נירמול URL).
 */
export function getSupabaseAdmin() {
  if (adminClient) return adminClient;
  const url = resolveSupabaseUrl();
  const key = resolveSupabaseServiceRoleKey();
  if (!url || !key) {
    throw new Error(
      'חסרים משתני Supabase לשרת: הגדר SUPABASE_URL (או NEXT_PUBLIC_SUPABASE_URL / VITE_SUPABASE_URL) ' +
        'ו-SUPABASE_SERVICE_ROLE_KEY (או SUPABASE_SECRET_KEY / SERVICE_ROLE_KEY) — ערך service_role מ-Supabase → Project Settings → API.'
    );
  }
  logSupabaseEnvOnce(url, key);
  adminClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

export function resetSupabaseAdminForTests() {
  adminClient = null;
  supabaseEnvLogged = false;
}

/** הודעה ידידותית כש-PostgREST מחזיר מפתח שגוי */
export function isSupabaseInvalidApiKeyError(error) {
  const msg = String(error?.message || error || '').toLowerCase();
  const code = error?.code;
  return (
    msg.includes('invalid api key') ||
    msg.includes('invalid jwt') ||
    code === 'PGRST301' ||
    msg.includes('jwt expired')
  );
}
