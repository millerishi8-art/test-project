import { createClient } from '@supabase/supabase-js';

let adminClient = null;

/** מרכאות/רווחים מסביב לערך מ-Vercel */
function stripEnv(val) {
  if (val == null) return '';
  return String(val).trim().replace(/^['"]|['"]$/g, '');
}

/**
 * כתובת פרויקט Supabase — אותם שמות ש-Vercel/OpenAPI נותנים בדרך כלל.
 * סדר עדיפות: משתנה ספציפי לשרת, ואז ציבורי (אותו ערך מומלץ ב-Vercel).
 */
export function resolveSupabaseUrl() {
  return stripEnv(
    process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      ''
  );
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

/**
 * לקוח Supabase עם הרשאות service_role — לשרת בלבד (עוקף RLS).
 * אין תלות ב-MongoDB או ב-MONGODB_URI.
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
  adminClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

export function resetSupabaseAdminForTests() {
  adminClient = null;
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
