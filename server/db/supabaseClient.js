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

/** דחיית מפתח ריק, placeholder או מפתח publishable בטעות בשדה service */
export function assertSupabaseServiceCredentials() {
  const url = resolveSupabaseUrl();
  const key = resolveSupabaseServiceRoleKey();
  if (!url || !key) {
    throw new Error(
      '[Supabase] Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server env). This project uses Supabase only.'
    );
  }
  const k = key;
  if (k.length < 32) {
    throw new Error(
      '[Supabase] SUPABASE_SERVICE_ROLE_KEY is too short or was trimmed away — paste the full service_role secret from Supabase → Settings → API.'
    );
  }
  const low = k.toLowerCase();
  if (
    low.includes('placeholder') ||
    low.includes('your-service-role') ||
    low.includes('your_service_role') ||
    low === 'service_role' ||
    /^<[^>]+>$/.test(k.trim())
  ) {
    throw new Error(
      '[Supabase] SUPABASE_SERVICE_ROLE_KEY looks like a placeholder. Use the real service_role JWT (eyJ…) or sb_secret_… from the Supabase dashboard.'
    );
  }
  if (k.startsWith('sb_publishable_')) {
    throw new Error(
      '[Supabase] Use the service secret in SUPABASE_SERVICE_ROLE_KEY, not sb_publishable_ (that belongs in SUPABASE_ANON_KEY).'
    );
  }
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
  assertSupabaseServiceCredentials();
  const url = resolveSupabaseUrl();
  const key = resolveSupabaseServiceRoleKey();
  logSupabaseEnvOnce(url, key);
  try {
    adminClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch (err) {
    const msg = err?.message ? String(err.message) : String(err);
    throw new Error(
      `[Supabase] Failed to initialize client (check SUPABASE_URL and service key format): ${msg}`
    );
  }
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
