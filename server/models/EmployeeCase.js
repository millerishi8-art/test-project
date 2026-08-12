import crypto from 'crypto';
import { getSupabaseAdmin } from '../db/supabaseClient.js';

const TABLE = 'employee_cases';

export const EMPLOYEE_CASE_CATEGORIES = Object.freeze({
  OPENING_PAYMENT_HE: 'פתיחת כייס',
  INTERVIEWS_HE: 'ראיונות',
  FORMS_HE: 'הגשת טפסים',
  OPENING_PAYMENT_EN: 'Case Opening',
  INTERVIEWS_EN: 'Interviews',
  FORMS_EN: 'Form Submissions',
});

const ALLOWED_CATEGORIES = new Set(Object.values(EMPLOYEE_CASE_CATEGORIES));

/** מנרמל קטגוריה לערך עברי קנוני */
export function normalizeEmployeeCaseCategory(raw) {
  const s = String(raw || '').trim();
  /* תאימות לאחור לשם הישן */
  if (
    s === 'תשלום על פתיחת כייס' ||
    s === 'Case Opening Payment' ||
    s === EMPLOYEE_CASE_CATEGORIES.OPENING_PAYMENT_EN ||
    s === EMPLOYEE_CASE_CATEGORIES.OPENING_PAYMENT_HE
  ) {
    return EMPLOYEE_CASE_CATEGORIES.OPENING_PAYMENT_HE;
  }
  if (s === EMPLOYEE_CASE_CATEGORIES.INTERVIEWS_EN || s === EMPLOYEE_CASE_CATEGORIES.INTERVIEWS_HE) {
    return EMPLOYEE_CASE_CATEGORIES.INTERVIEWS_HE;
  }
  if (s === EMPLOYEE_CASE_CATEGORIES.FORMS_EN || s === EMPLOYEE_CASE_CATEGORIES.FORMS_HE) {
    return EMPLOYEE_CASE_CATEGORIES.FORMS_HE;
  }
  if (ALLOWED_CATEGORIES.has(s)) return s;
  return null;
}

function rowToEmployeeCase(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : null,
    caseNumber: row.case_number || '',
    category: row.category || '',
    isCompleted: row.is_completed !== false,
    isPaid: row.is_paid === true,
    isArchived: row.is_archived === true,
    createdAt: row.created_at || null,
    paidAt: row.paid_at || null,
    archivedAt: row.archived_at || null,
  };
}

export const readEmployeeCases = async ({ includeArchived = false } = {}) => {
  try {
    const sb = getSupabaseAdmin();
    let query = sb.from(TABLE).select('*').order('created_at', { ascending: false });
    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(rowToEmployeeCase);
  } catch (error) {
    console.error('Error reading employee_cases from DB:', error);
    throw error;
  }
};

export const findEmployeeCaseById = async (id) => {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from(TABLE).select('*').eq('id', String(id)).maybeSingle();
  if (error) throw error;
  return rowToEmployeeCase(data);
};

export const createEmployeeCase = async ({ userId, caseNumber, category, isCompleted = true }) => {
  const sb = getSupabaseAdmin();
  const normalizedCategory = normalizeEmployeeCaseCategory(category);
  if (!normalizedCategory) {
    throw new Error('INVALID_CATEGORY');
  }
  const record = {
    id: crypto.randomUUID(),
    user_id: String(userId),
    case_number: String(caseNumber || '').trim(),
    category: normalizedCategory,
    is_completed: isCompleted !== false,
    is_paid: false,
    is_archived: false,
    created_at: new Date().toISOString(),
    paid_at: null,
    archived_at: null,
  };
  if (!record.case_number) {
    throw new Error('MISSING_CASE_NUMBER');
  }
  const { data, error } = await sb.from(TABLE).insert(record).select('*').single();
  if (error) throw error;
  return rowToEmployeeCase(data);
};

export const updateEmployeeCasePaid = async (id, { isPaid, paidAt = null }) => {
  const sb = getSupabaseAdmin();
  const patch = {
    is_paid: !!isPaid,
    paid_at: isPaid ? paidAt || new Date().toISOString() : null,
  };
  const { data, error } = await sb
    .from(TABLE)
    .update(patch)
    .eq('id', String(id))
    .select('*')
    .single();
  if (error) throw error;
  return rowToEmployeeCase(data);
};

/**
 * ארכוב כייסים ששולמו ועדיין פעילים – אחרי זה הרשומות נעולות (is_archived).
 * @param {{ userId?: string }} [opts] – אם מועבר userId, מאפס רק את הכייסים של אותו מנהל.
 */
export const archivePaidEmployeeCases = async ({ userId } = {}) => {
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();
  let query = sb
    .from(TABLE)
    .update({ is_archived: true, archived_at: now })
    .eq('is_paid', true)
    .eq('is_archived', false);
  if (userId) {
    query = query.eq('user_id', String(userId));
  }
  const { data, error } = await query.select('*');
  if (error) throw error;
  return (data || []).map(rowToEmployeeCase);
};
