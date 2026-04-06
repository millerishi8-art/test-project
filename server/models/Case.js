import { getSupabaseAdmin } from '../db/supabaseClient.js';

const TABLE = 'app_cases';

/** JSONB `data` first, then non-null table columns (same idea as app_users). */
function rowToCase(row) {
  if (!row) return null;
  const fromData =
    row.data != null && typeof row.data === 'object' && !Array.isArray(row.data) ? { ...row.data } : {};
  const fromRow = {};
  for (const key of Object.keys(row)) {
    if (key === 'id' || key === 'data') continue;
    const val = row[key];
    if (val !== undefined && val !== null) fromRow[key] = val;
  }
  const out = { ...fromData, ...fromRow, id: row.id != null ? String(row.id) : '' };
  const uid = out.user_id ?? out.userId;
  out.userId = uid != null ? String(uid) : '';
  delete out.user_id;
  return out;
}

export const readCases = async () => {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from(TABLE).select('*').order('id');
    if (error) throw error;
    return (data || []).map(rowToCase);
  } catch (error) {
    console.error('Error reading cases from DB:', error);
    return [];
  }
};

export const findCaseById = async (id) => {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from(TABLE).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return rowToCase(data);
  } catch (error) {
    return null;
  }
};

export const findCasesByUserId = async (userId) => {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from(TABLE).select('*').eq('user_id', userId);
    if (error) throw error;
    return (data || []).map(rowToCase);
  } catch (error) {
    return [];
  }
};

export const createCase = async (caseData) => {
  const sb = getSupabaseAdmin();
  const id = String(caseData.id);
  const userId = String(caseData.userId || '');
  const data = { ...caseData, id, userId };
  const { error } = await sb.from(TABLE).insert({ id, user_id: userId, data });
  if (error) throw error;
  return caseData;
};

export const updateCase = async (caseId, updates) => {
  const sb = getSupabaseAdmin();
  const current = await findCaseById(caseId);
  if (!current) return null;
  const merged = { ...current, ...updates };
  const userId = String(merged.userId || '');
  const data = { ...merged, id: caseId, userId };
  const { data: out, error } = await sb
    .from(TABLE)
    .update({ user_id: userId, data })
    .eq('id', caseId)
    .select('*')
    .single();
  if (error) throw error;
  return rowToCase(out);
};

export const deleteCase = async (caseId) => {
  const sb = getSupabaseAdmin();
  const existing = await findCaseById(caseId);
  const { data, error } = await sb.from(TABLE).delete().eq('id', caseId).select('*').maybeSingle();
  if (error) throw error;
  return existing || (data ? rowToCase(data) : null);
};

export const deleteCasesByIds = async (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from(TABLE).delete().in('id', ids).select('id');
  if (error) throw error;
  return Array.isArray(data) ? data.length : 0;
};
