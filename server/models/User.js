import { getSupabaseAdmin } from '../db/supabaseClient.js';
import { normalizeUserRole, ROLES } from '../components/constants.js';

const TABLE = 'app_users';

let usersTableHasDataColumn = null;

function isMissingColumnError(error, column) {
  const msg = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '');
  return (
    code === 'PGRST204' ||
    code === '42703' ||
    msg.includes(`'${column}' column`) ||
    msg.includes(`app_users.${column}`) ||
    msg.includes(`.${column} does not exist`)
  );
}

/** האם לטבלה יש עמודת data JSONB (סכמה מלאה) או רק עמודות שטוחות (id/email/full_name/role) */
async function usersTableUsesJsonbData(sb) {
  if (usersTableHasDataColumn !== null) return usersTableHasDataColumn;
  const { error } = await sb.from(TABLE).select('data').limit(0);
  usersTableHasDataColumn = !isMissingColumnError(error, 'data');
  return usersTableHasDataColumn;
}

/** מיפוי שדות טיפוסי עמודת-DB לשמות בשימוש האפליקציה */
function mapFlatColumnToAppFields(flat) {
  const o = { ...flat };
  if ('full_name' in o && o.name === undefined) {
    o.name = o.full_name;
    delete o.full_name;
  }
  if ('email_verified' in o && o.emailVerified === undefined) {
    o.emailVerified = !!o.email_verified;
    delete o.email_verified;
  }
  if ('auth_provider' in o && o.authProvider === undefined) {
    o.authProvider = o.auth_provider;
    delete o.auth_provider;
  }
  if ('created_at' in o && o.createdAt === undefined) {
    o.createdAt = o.created_at;
    delete o.created_at;
  }
  if ('updated_at' in o && o.updatedAt === undefined) {
    o.updatedAt = o.updated_at;
    delete o.updated_at;
  }
  return o;
}

/**
 * איחוד שורה: תחילה data JSONB, ואז ערכים משדות טבלה (לא-null) — עמודות דורסות, כדי לאפשר אימייל/מטא בעמודה בלי JSON stale.
 */
function rowToUser(row) {
  if (!row) return null;
  const fromData =
    row.data != null && typeof row.data === 'object' && !Array.isArray(row.data) ? { ...row.data } : {};
  const fromRow = {};
  for (const key of Object.keys(row)) {
    if (key === 'id' || key === 'data') continue;
    const val = row[key];
    if (val !== undefined && val !== null) {
      fromRow[key] = val;
    }
  }
  const mappedFlat = mapFlatColumnToAppFields(fromRow);
  const merged = { ...fromData, ...mappedFlat, id: row.id != null ? String(row.id) : '' };
  /* role נשמר ב־JSON; אם יש עמודת role ישנה — לא לדרוס admin ב־data */
  const roleFromJson = fromData.role;
  const roleFromCol = mappedFlat.role;
  if (normalizeUserRole(roleFromJson) === ROLES.ADMIN || normalizeUserRole(roleFromCol) === ROLES.ADMIN) {
    merged.role = ROLES.ADMIN;
  }
  if (!merged.authProvider && row.data == null && Object.keys(fromRow).length > 0) {
    merged.authProvider = 'supabase';
  }
  if (merged.emailVerified === undefined && merged.authProvider === 'supabase') {
    merged.emailVerified = true;
  }
  return merged;
}

function flatRowFromUser(normalized) {
  const row = { id: String(normalized.id || '') };
  if (normalized.email) row.email = normalized.email;
  if (normalized.name != null) row.full_name = String(normalized.name);
  if (normalized.role != null) row.role = normalizeUserRole(normalized.role);
  return row;
}

function normalizeUserPayload(userData) {
  const copy = { ...userData };
  if (copy.email != null) copy.email = String(copy.email).trim().toLowerCase();
  return copy;
}

/**
 * מבנה משתמש – אובייקט שטוח ב-data JSONB ו/או עמודות טבלה
 */
export async function readUsers() {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from(TABLE).select('*').order('id');
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
    const { data, error } = await sb.from(TABLE).select('*').eq('id', id).maybeSingle();
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

async function findUserByEmailColumn(sb, normalized) {
  try {
    const { data, error } = await sb.from(TABLE).select('*').eq('email', normalized).maybeSingle();
    if (error) return null;
    return rowToUser(data);
  } catch {
    return null;
  }
}

export async function findUserByEmail(email) {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return null;
  const sb = getSupabaseAdmin();
  const byColumn = await findUserByEmailColumn(sb, normalized);
  if (byColumn) return byColumn;

  try {
    const { data, error } = await sb.rpc('find_app_users_by_email_normalized', { e: normalized });
    if (!error) {
      const rows = Array.isArray(data) ? data : [];
      if (rows.length > 0) {
        const re = emailRegex(email);
        const hydrated = rows.map((r) => rowToUser(r)).filter(Boolean);
        /* רק התאמה מדויקת לאימייל – לעולם לא מחזירים hydrated[0] "במקרה" (עלול לשלוח מייל למשתמש אחר) */
        const match = hydrated.find((u) => {
          const uEmail = String(u.email || '').trim().toLowerCase();
          return uEmail === normalized || (re && re.test(String(u.email || '').trim()));
        });
        if (match) {
          /* מבטיחים שהאימייל שיוחזר הוא זה שחיפשו (לא עמודה ישנה/שגויה) */
          return { ...match, email: normalized };
        }
        /* RPC מצא שורה לפי data/עמודה אבל אחרי מיזוג אין התאמה – עדיין מחזירים עם האימייל המבוקש */
        if (hydrated[0]) {
          return { ...hydrated[0], email: normalized };
        }
      }
    }
  } catch (_) {
    /* RPC חסר – נופל לסריקה */
  }
  try {
    const { data: all, error } = await sb.from(TABLE).select('*');
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
  const usesJsonb = await usersTableUsesJsonbData(sb);

  if (!usesJsonb) {
    const row = flatRowFromUser(normalized);
    const { error } = await sb.from(TABLE).insert(row);
    if (error) {
      console.error('User createUser error:', error?.message || error);
      throw error;
    }
    return normalized;
  }

  const data = { ...normalized, id };
  if (data.authProvider === 'supabase') {
    delete data.password;
  }
  const withColumns = {
    id,
    data,
    ...(normalized.email ? { email: normalized.email } : {}),
    ...(normalized.name != null ? { name: normalized.name } : {}),
    ...(normalized.phone != null ? { phone: normalized.phone } : {}),
  };
  let { error } = await sb.from(TABLE).insert(withColumns);
  if (error) {
    const { error: err2 } = await sb.from(TABLE).insert({ id, data });
    if (err2) {
      console.error('User createUser error:', err2?.message || err2);
      throw err2;
    }
  }
  return normalized;
}

/**
 * קידום סופר־אדמין כש־updateUserById נכשל — ממזג לתוך data + מעדכן עמודת email.
 */
export async function promoteToSuperAdminById(id, canonicalEmail) {
  const canonical = String(canonicalEmail || '').trim().toLowerCase();
  if (!id || !canonical) return null;
  try {
    const sb = getSupabaseAdmin();
    const { data: row, error: fetchErr } = await sb.from(TABLE).select('*').eq('id', id).maybeSingle();
    if (fetchErr || !row) return null;
    const usesJsonb = await usersTableUsesJsonbData(sb);
    if (!usesJsonb) {
      const { data: out, error } = await sb
        .from(TABLE)
        .update({ role: ROLES.ADMIN, email: canonical })
        .eq('id', id)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return rowToUser(out);
    }
    const prev =
      row.data != null && typeof row.data === 'object' && !Array.isArray(row.data) ? { ...row.data } : {};
    const merged = normalizeUserPayload({
      ...prev,
      role: ROLES.ADMIN,
      email: canonical,
    });
    const patch = { data: merged, email: canonical };
    let { data: out, error } = await sb.from(TABLE).update(patch).eq('id', id).select('*').maybeSingle();
    if (error) {
      const r2 = await sb.from(TABLE).update({ data: merged }).eq('id', id).select('*').maybeSingle();
      out = r2.data;
      error = r2.error;
    }
    if (error) throw error;
    return rowToUser(out);
  } catch (error) {
    console.error('User promoteToSuperAdminById error:', error?.message || error);
    return null;
  }
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
    const usesJsonb = await usersTableUsesJsonbData(sb);
    let out;
    let error;
    if (!usesJsonb) {
      const patch = {};
      if (next.email) patch.email = next.email;
      if (next.name != null) patch.full_name = String(next.name);
      if (next.role != null) patch.role = normalizeUserRole(next.role);
      ({ data: out, error } = await sb.from(TABLE).update(patch).eq('id', id).select('*').single());
    } else {
      const patch = {
        data,
        ...(next.email ? { email: next.email } : {}),
        ...(next.name != null ? { name: next.name } : {}),
        ...(next.phone != null ? { phone: next.phone } : {}),
      };
      ({ data: out, error } = await sb.from(TABLE).update(patch).eq('id', id).select('*').single());
      if (error) {
        const r2 = await sb.from(TABLE).update({ data }).eq('id', id).select('*').single();
        out = r2.data;
        error = r2.error;
      }
      /* אם קיימת עמודת role שטוחה – מעדכנים גם אותה (אחרת rowToUser ישאיר admin) */
      if (!error && next.role != null) {
        const rolePatch = await sb
          .from(TABLE)
          .update({ role: normalizeUserRole(next.role) })
          .eq('id', id)
          .select('*')
          .maybeSingle();
        if (!rolePatch.error && rolePatch.data) {
          out = rolePatch.data;
        }
      }
    }
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
    let rows = [];
    const { data, error } = await sb.rpc('find_app_users_by_email_normalized', { e: normalized });
    if (!error) {
      rows = Array.isArray(data) ? data : [];
    } else {
      /* RPC חסר (PGRST202 וכו') – נופלים לחיפוש רגיל כמו findUserByEmail */
      console.warn('User updateUserByEmail: RPC unavailable, falling back. ', error?.message || error);
    }
    if (rows.length === 0) {
      const byColumn = await findUserByEmailColumn(sb, normalized);
      if (byColumn) {
        rows = [{ id: byColumn.id }];
      }
    }
    if (rows.length === 0) {
      const re = emailRegex(email);
      const { data: all, error: e2 } = await sb.from(TABLE).select('*');
      if (e2) throw e2;
      rows = (all || []).filter((r) => {
        const u = rowToUser(r);
        return u && (String(u.email || '').trim().toLowerCase() === normalized || (re && re.test(String(u.email || '').trim())));
      });
    }
    if (rows.length === 0) return null;
    const { id, ...allowed } = updateFields;
    if (Object.keys(allowed).length === 0) return rowToUser(rows[0]);
    let last = null;
    for (const row of rows) {
      last = await updateUserById(row.id, allowed);
    }
    return last || findUserById(rows[0].id);
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
      .select('*')
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
    const ids = new Set();
    const colUser = await findUserByEmailColumn(sb, normalized);
    if (colUser?.id) ids.add(colUser.id);
    try {
      const { data, error } = await sb.rpc('find_app_users_by_email_normalized', { e: normalized });
      if (!error) {
        for (const row of Array.isArray(data) ? data : []) {
          if (row?.id) ids.add(row.id);
        }
      }
    } catch (_) {
      /* RPC חסר */
    }
    if (ids.size === 0) {
      const u = await findUserByEmail(email);
      if (u?.id) ids.add(u.id);
    }
    let n = 0;
    for (const id of ids) {
      const ok = await deleteUserById(id);
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
    role: normalizeUserRole(user.role),
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
