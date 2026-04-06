import { getSupabaseAdmin } from '../db/supabaseClient.js';

const TABLE = 'app_users';

function rowToUser(row) {
  if (!row || row.data == null) return null;
  const d = typeof row.data === 'object' && !Array.isArray(row.data) ? row.data : {};
  return { ...d, id: row.id };
}

function normalizeUserPayload(userData) {
  const copy = { ...userData };
  if (copy.email != null) copy.email = String(copy.email).trim().toLowerCase();
  return copy;
}

/**
 * מבנה משתמש – זהה לשהיה ב-MongoDB (אובייקט שטוח בתוך data JSONB)
 */
export async function readUsers() {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from(TABLE).select('id, data').order('id');
    if (error) throw error;
    return (data || []).map(rowToUser);
  } catch (error) {
    console.error('User readUsers error:', error);
    return [];
  }
}

export async function findUserById(id) {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from(TABLE).select('id, data').eq('id', id).maybeSingle();
    if (error) throw error;
    return rowToUser(data);
  } catch (error) {
    console.error('User findUserById error:', error);
    return null;
  }
}

function emailRegex(email) {
  const e = (email || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return e ? new RegExp(`^${e}$`, 'i') : null;
}

export async function findUserByEmail(email) {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return null;
  const sb = getSupabaseAdmin();
  try {
    const { data, error } = await sb.rpc('find_app_users_by_email_normalized', { e: normalized });
    if (!error) {
      const rows = Array.isArray(data) ? data : [];
      if (rows.length === 0) return null;
      const re = emailRegex(email);
      const match = rows.find((r) => re && re.test(String((r.data && r.data.email) || '').trim()));
      return rowToUser(match || rows[0]);
    }
  } catch (_) {
    /* RPC חסר – נופל לסריקה */
  }
  try {
    const { data: all, error } = await sb.from(TABLE).select('id, data');
    if (error) throw error;
    const re = emailRegex(email);
    const u = (all || []).map(rowToUser).find((x) => x && re && re.test(String(x.email || '').trim()));
    return u || null;
  } catch (err) {
    console.error('User findUserByEmail error:', err);
    throw err;
  }
}

export async function createUser(userData) {
  const sb = getSupabaseAdmin();
  const normalized = normalizeUserPayload(userData);
  const id = String(normalized.id || '');
  const data = { ...normalized, id };
  if (data.authProvider === 'supabase') {
    delete data.password;
  }
  const { error } = await sb.from(TABLE).insert({ id, data });
  if (error) {
    console.error('User createUser error:', error?.message || error);
    throw error;
  }
  return normalized;
}

export async function updateUserById(id, updateFields) {
  try {
    const sb = getSupabaseAdmin();
    const current = await findUserById(id);
    if (!current) return null;
    const { id: _id, ...allowed } = updateFields;
    const next = { ...current };
    const apply = (key, val) => {
      if (val !== undefined) next[key] = val;
    };
    apply('role', allowed.role);
    apply('password', allowed.password);
    apply('authProvider', allowed.authProvider);
    apply('name', allowed.name);
    apply('phone', allowed.phone);
    if (allowed.email !== undefined) next.email = String(allowed.email).trim().toLowerCase();
    apply('emailVerified', allowed.emailVerified);
    apply('emailVerificationCode', allowed.emailVerificationCode);
    apply('emailVerificationCodeExpires', allowed.emailVerificationCodeExpires);
    apply('phoneVerificationCode', allowed.phoneVerificationCode);
    apply('phoneVerificationCodeExpires', allowed.phoneVerificationCodeExpires);
    apply('passwordResetCode', allowed.passwordResetCode);
    apply('passwordResetCodeExpires', allowed.passwordResetCodeExpires);
    apply('deferredPaymentRequestPending', allowed.deferredPaymentRequestPending);
    apply('deferredPaymentRequestedAt', allowed.deferredPaymentRequestedAt);
    apply('deferredPaymentApproved', allowed.deferredPaymentApproved);
    apply('deferredPaymentApprovedAt', allowed.deferredPaymentApprovedAt);
    apply('deferredPaymentDeadline', allowed.deferredPaymentDeadline);
    apply('deferredPaymentAwaitingClientDate', allowed.deferredPaymentAwaitingClientDate);
    apply('deferredPaymentRequestApprovedAt', allowed.deferredPaymentRequestApprovedAt);
    apply('deferredPaymentProposedDeadline', allowed.deferredPaymentProposedDeadline);
    apply('deferredPaymentProposalPending', allowed.deferredPaymentProposalPending);
    apply('deferredPaymentProposalSubmittedAt', allowed.deferredPaymentProposalSubmittedAt);
    apply('deferredPaymentWeeklyReminderLastAt', allowed.deferredPaymentWeeklyReminderLastAt);
    apply('deferredPaymentDueDateWarningSentAt', allowed.deferredPaymentDueDateWarningSentAt);
    apply('deferredPaymentDeadlineMustBeBeforeYmd', allowed.deferredPaymentDeadlineMustBeBeforeYmd);

    const data = normalizeUserPayload(next);
    if (Object.keys(allowed).length === 0) return current;
    const { data: out, error } = await sb
      .from(TABLE)
      .update({ data })
      .eq('id', id)
      .select('id, data')
      .single();
    if (error) throw error;
    return rowToUser(out);
  } catch (error) {
    console.error('User updateUserById error:', error);
    return null;
  }
}

export async function updateUserByEmail(email, updateFields) {
  try {
    const sb = getSupabaseAdmin();
    const normalized = (email || '').trim().toLowerCase();
    if (!normalized) return null;
    let rows;
    const { data, error } = await sb.rpc('find_app_users_by_email_normalized', { e: normalized });
    if (error) throw error;
    rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) {
      const re = emailRegex(email);
      const { data: all, error: e2 } = await sb.from(TABLE).select('id, data');
      if (e2) throw e2;
      rows = (all || []).filter((r) => re && re.test((r.data?.email || '').trim()));
    }
    if (rows.length === 0) return null;
    const { id, ...allowed } = updateFields;
    if (Object.keys(allowed).length === 0) return rowToUser(rows[0]);
    for (const row of rows) {
      await updateUserById(row.id, allowed);
    }
    return findUserById(rows[0].id);
  } catch (error) {
    console.error('User updateUserByEmail error:', error);
    return null;
  }
}

export async function findUserByVerificationToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const sb = getSupabaseAdmin();
    const now = new Date().toISOString();
    const { data, error } = await sb
      .from(TABLE)
      .select('id, data')
      .eq('data->>emailVerificationToken', token.trim())
      .gt('data->>emailVerificationTokenExpires', now)
      .maybeSingle();
    if (error) throw error;
    return rowToUser(data);
  } catch (error) {
    console.error('User findUserByVerificationToken error:', error);
    return null;
  }
}

export async function deleteUserById(id) {
  if (!id || typeof id !== 'string') return false;
  try {
    const sb = getSupabaseAdmin();
    const { data: deleted, error } = await sb.from(TABLE).delete().eq('id', id).select('id');
    if (error) throw error;
    return Array.isArray(deleted) && deleted.length === 1;
  } catch (error) {
    console.error('User deleteUserById error:', error);
    return false;
  }
}

export async function deleteUserByEmail(email) {
  try {
    const sb = getSupabaseAdmin();
    const normalized = (email || '').trim().toLowerCase();
    if (!normalized) return 0;
    const { data, error } = await sb.rpc('find_app_users_by_email_normalized', { e: normalized });
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    let n = 0;
    for (const row of rows) {
      const ok = await deleteUserById(row.id);
      if (ok) n += 1;
    }
    return n;
  } catch (error) {
    console.error('User deleteUserByEmail error:', error);
    return 0;
  }
}

export function sanitizeUser(user) {
  if (!user) return null;
  const {
    password,
    emailVerificationToken,
    emailVerificationTokenExpires,
    emailVerificationCode,
    emailVerificationCodeExpires,
    phoneVerificationCode,
    phoneVerificationCodeExpires,
    ...rest
  } = user;
  return rest;
}

function safeCreatedAtIso(user) {
  if (user?.createdAt == null) return undefined;
  const v = user.createdAt;
  if (typeof v === 'string') return v;
  try {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  } catch {
    return undefined;
  }
}

export function serializeUserForClient(user) {
  if (!user || typeof user !== 'object') return null;
  const emailRaw = user.email;
  let email = '';
  if (typeof emailRaw === 'string') email = emailRaw;
  else if (emailRaw != null && typeof emailRaw.toString === 'function') email = String(emailRaw);

  const out = {
    id: user.id != null ? String(user.id) : '',
    name: user.name != null ? String(user.name) : '',
    email,
    phone: user.phone != null ? String(user.phone) : '',
    role: user.role != null ? String(user.role) : 'user',
  };
  const createdIso = safeCreatedAtIso(user);
  if (createdIso !== undefined) out.createdAt = createdIso;
  if (user.emailVerified !== undefined) out.emailVerified = !!user.emailVerified;
  if (user.deferredPaymentRequestPending !== undefined)
    out.deferredPaymentRequestPending = !!user.deferredPaymentRequestPending;
  if (user.deferredPaymentRequestedAt != null) out.deferredPaymentRequestedAt = String(user.deferredPaymentRequestedAt);
  if (user.deferredPaymentApproved !== undefined) out.deferredPaymentApproved = !!user.deferredPaymentApproved;
  if (user.deferredPaymentApprovedAt != null) out.deferredPaymentApprovedAt = String(user.deferredPaymentApprovedAt);
  if (user.deferredPaymentDeadline != null) out.deferredPaymentDeadline = String(user.deferredPaymentDeadline);
  if (user.deferredPaymentAwaitingClientDate !== undefined)
    out.deferredPaymentAwaitingClientDate = !!user.deferredPaymentAwaitingClientDate;
  if (user.deferredPaymentRequestApprovedAt != null) {
    out.deferredPaymentRequestApprovedAt = String(user.deferredPaymentRequestApprovedAt);
  }
  if (user.deferredPaymentProposedDeadline != null) {
    out.deferredPaymentProposedDeadline = String(user.deferredPaymentProposedDeadline);
  }
  if (user.deferredPaymentProposalPending !== undefined) {
    out.deferredPaymentProposalPending = !!user.deferredPaymentProposalPending;
  }
  if (user.deferredPaymentProposalSubmittedAt != null) {
    out.deferredPaymentProposalSubmittedAt = String(user.deferredPaymentProposalSubmittedAt);
  }
  if (user.deferredPaymentDeadlineMustBeBeforeYmd != null) {
    out.deferredPaymentDeadlineMustBeBeforeYmd = String(user.deferredPaymentDeadlineMustBeBeforeYmd);
  }
  return out;
}
