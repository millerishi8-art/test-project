import { createClient } from '@supabase/supabase-js';

let adminClient = null;
let supabaseEnvLogged = false;

/** מרכאות/רווחים מסביב לערך מ-Vercel */
function stripEnv(val) {
  if (val == null) return '';
  return String(val).trim().replace(/^['"]|['"]$/g, '');
}

/** לוג בטוח ל-Vercel: רק 5 תווים ראשונים */
function preview5(label, value) {
  const s = value == null ? '' : String(value);
  if (!s) return `${label}: (empty)`;
  return `${label}: ${s.slice(0, 5)}… (len=${s.length})`;
}

/**
 * נירמול כתובת Supabase: trim, בלי סלאש בסוף, רק https.
 * השרת משתמש ב-SUPABASE_URL בלבד (ראה resolveSupabaseUrl).
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
      '[Supabase] SUPABASE_URL חייב להתחיל ב-https:// (לדוגמה https://xxxxx.supabase.co).'
    );
  }
  return u;
}

/** כתובת API לשרת — רק משתנה SUPABASE_URL */
export function resolveSupabaseUrl() {
  const raw = stripEnv(process.env.SUPABASE_URL || '');
  if (!raw) return '';
  return normalizeSupabaseProjectUrl(raw);
}

/** מפתח service_role לשרת — רק SUPABASE_SERVICE_ROLE_KEY */
export function resolveSupabaseServiceRoleKey() {
  return stripEnv(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
}

/** מפתח anon לשרת (AUTH_PROVIDER=supabase) — SUPABASE_ANON_KEY */
export function resolveSupabaseAnonKey() {
  return stripEnv(process.env.SUPABASE_ANON_KEY || '');
}

function logSupabaseEnvOnce(url, key) {
  if (supabaseEnvLogged) return;
  supabaseEnvLogged = true;
  console.log(
    '[Supabase]',
    preview5('SUPABASE_URL', url),
    '|',
    preview5('SUPABASE_SERVICE_ROLE_KEY', key)
  );
}

/**
 * לקוח Supabase service_role — משתמש ב-SUPABASE_URL וב-SUPABASE_SERVICE_ROLE_KEY בלבד.
 */
export function getSupabaseAdmin() {
  if (adminClient) return adminClient;
  const url = resolveSupabaseUrl();
  const key = resolveSupabaseServiceRoleKey();
  if (!url || !key) {
    throw new Error(
      'חסרים Supabase לשרת: הגדר SUPABASE_URL ו-SUPABASE_SERVICE_ROLE_KEY (מ-Supabase → Project Settings → API → service_role).'
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
