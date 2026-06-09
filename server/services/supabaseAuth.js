import { createClient } from '@supabase/supabase-js';
import {
  getSupabaseAdmin,
  resolveSupabaseUrl,
  resolveSupabaseAnonKey,
  resolveSupabaseServiceRoleKey,
} from '../db/supabaseClient.js';

let anonClient = null;

/** AUTH_PROVIDER=supabase + URL + anon + service – סיסמאות דרך GoTrue, פרופיל ב-app_users */
export function isSupabasePasswordAuthEnabled() {
  const ap = (process.env.AUTH_PROVIDER || '').trim().toLowerCase();
  if (ap !== 'supabase') return false;
  const url = resolveSupabaseUrl();
  const anon = resolveSupabaseAnonKey();
  const service = resolveSupabaseServiceRoleKey();
  return !!(url && anon && service);
}

/** נדרש להתחברות משתמשים עם authProvider=supabase גם כשההרשמה הייתה בזרימה החדשה */
export function canSignInWithSupabasePassword() {
  return !!(resolveSupabaseUrl() && resolveSupabaseAnonKey());
}

export function getSupabaseAnon() {
  if (anonClient) return anonClient;
  const url = resolveSupabaseUrl();
  const anon = resolveSupabaseAnonKey();
  if (!url || !anon) {
    throw new Error('חסרים SUPABASE_URL ו-SUPABASE_ANON_KEY בשרת כש-AUTH_PROVIDER=supabase');
  }
  anonClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return anonClient;
}

export function resetSupabaseAnonForTests() {
  anonClient = null;
}

/**
 * הרשמת משתמש ב-GoTrue (מקביל ל-signUp) — שירות בלבד.
 * email_confirm: true כדי לאפשר התחברות מיידית בדומה לזרימת קוד האימות הקיימת.
 */
export async function registerAuthUserWithAdminApi({ email, password, name, phone }) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.auth.admin.createUser({
    email: String(email || '').trim().toLowerCase(),
    password: String(password || ''),
    email_confirm: true,
    user_metadata: { name: name || '', phone: phone || '' },
  });
  if (error) throw error;
  return data.user;
}

export async function signInWithPassword({ email, password }) {
  const anon = getSupabaseAnon();
  const { data, error } = await anon.auth.signInWithPassword({
    email: String(email || '').trim().toLowerCase(),
    password: String(password || ''),
  });
  if (error) throw error;
  return data.session;
}

/**
 * מסווג שגיאת התחברות Supabase – להחזרת קוד HTTP והודעה נכונים ללקוח
 * @returns {{ kind: 'invalid_credentials' | 'email_not_confirmed' | 'infrastructure' | 'unknown', message: string }}
 */
export function classifySupabaseAuthError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  const code = String(err?.code || err?.status || '').toLowerCase();

  if (
    msg.includes('email not confirmed') ||
    msg.includes('email_not_confirmed') ||
    code === 'email_not_confirmed'
  ) {
    return { kind: 'email_not_confirmed', message: String(err?.message || 'Email not confirmed') };
  }

  if (
    msg.includes('invalid login credentials') ||
    msg.includes('invalid credentials') ||
    code === 'invalid_credentials' ||
    code === '400'
  ) {
    return { kind: 'invalid_credentials', message: String(err?.message || 'Invalid credentials') };
  }

  if (
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    code === '503'
  ) {
    return { kind: 'infrastructure', message: String(err?.message || 'Auth service unavailable') };
  }

  return { kind: 'unknown', message: String(err?.message || err || 'Unknown auth error') };
}

export async function updateAuthUserPassword(userId, newPassword) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.auth.admin.updateUserById(userId, {
    password: String(newPassword || ''),
  });
  if (error) throw error;
  return data?.user;
}

export async function deleteAuthUser(userId) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.auth.admin.deleteUser(userId);
  if (error) throw error;
}

/** הודעת שגיאה מ-goTrue – לזיהוי כפילות אימייל */
export function isSupabaseAuthUserExistsError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    msg.includes('already been registered') ||
    msg.includes('already registered') ||
    msg.includes('user already registered') ||
    err?.code === 'email_exists'
  );
}
