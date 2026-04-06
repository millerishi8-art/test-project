import { createClient } from '@supabase/supabase-js';

let adminClient = null;

/**
 * לקוח Supabase עם הרשאות service_role – לשימוש בשרת בלבד (עוקף RLS).
 */
export function getSupabaseAdmin() {
  if (adminClient) return adminClient;
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ''
  ).trim();
  if (!url || !key) {
    throw new Error(
      'חסרים SUPABASE_URL ו-SUPABASE_SERVICE_ROLE_KEY ב-.env (או NEXT_PUBLIC_SUPABASE_URL)'
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
