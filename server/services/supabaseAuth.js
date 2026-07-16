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

/** קריאת משתמש Auth לפי מזהה (למטא־דאטה של קודי אימות) */
export async function getAuthUserById(userId) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.auth.admin.getUserById(String(userId || ''));
  if (error) throw error;
  return data?.user || null;
}

/**
 * שומר/מעדכן שדות אימות ב-user_metadata של Supabase Auth.
 * נחוץ כש-app_users בסכמה שטוחה בלי JSONB data – אחרת הקוד נשלח במייל אבל לא נשמר במסד.
 */
export async function patchAuthUserMetadata(userId, patch) {
  const id = String(userId || '');
  if (!id) return null;
  const sb = getSupabaseAdmin();
  const existing = await getAuthUserById(id);
  const prev =
    existing?.user_metadata && typeof existing.user_metadata === 'object' ? { ...existing.user_metadata } : {};
  const next = { ...prev, ...patch };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete next[k];
  }
  const { data, error } = await sb.auth.admin.updateUserById(id, { user_metadata: next });
  if (error) throw error;
  return data?.user || null;
}

export async function setEmailVerificationInAuthMeta(userId, { code, expires, verified }) {
  const patch = {};
  if (verified === true) {
    patch.appEmailVerified = true;
    patch.emailVerificationCode = null;
    patch.emailVerificationCodeExpires = null;
  } else if (verified === false) {
    patch.appEmailVerified = false;
  }
  if (code !== undefined) patch.emailVerificationCode = code == null ? null : String(code);
  if (expires !== undefined) patch.emailVerificationCodeExpires = expires == null ? null : String(expires);
  return patchAuthUserMetadata(userId, patch);
}

export async function getEmailVerificationFromAuthMeta(userId) {
  try {
    const user = await getAuthUserById(userId);
    const meta = user?.user_metadata && typeof user.user_metadata === 'object' ? user.user_metadata : {};
    return {
      appEmailVerified: meta.appEmailVerified,
      emailVerificationCode:
        meta.emailVerificationCode != null ? String(meta.emailVerificationCode).trim() : '',
      emailVerificationCodeExpires: meta.emailVerificationCodeExpires
        ? String(meta.emailVerificationCodeExpires)
        : '',
    };
  } catch (err) {
    console.error('[Auth] getEmailVerificationFromAuthMeta:', err?.message || err);
    return {
      appEmailVerified: undefined,
      emailVerificationCode: '',
      emailVerificationCodeExpires: '',
    };
  }
}

export async function setPasswordResetInAuthMeta(userId, { code, expires }) {
  return patchAuthUserMetadata(userId, {
    passwordResetCode: code == null ? null : String(code),
    passwordResetCodeExpires: expires == null ? null : String(expires),
  });
}

export async function getPasswordResetFromAuthMeta(userId) {
  try {
    const user = await getAuthUserById(userId);
    const meta = user?.user_metadata && typeof user.user_metadata === 'object' ? user.user_metadata : {};
    return {
      passwordResetCode: meta.passwordResetCode != null ? String(meta.passwordResetCode).trim() : '',
      passwordResetCodeExpires: meta.passwordResetCodeExpires
        ? String(meta.passwordResetCodeExpires)
        : '',
    };
  } catch (err) {
    console.error('[Auth] getPasswordResetFromAuthMeta:', err?.message || err);
    return { passwordResetCode: '', passwordResetCodeExpires: '' };
  }
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
