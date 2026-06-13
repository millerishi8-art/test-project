import crypto from 'crypto';
import { getSupabaseAdmin } from '../db/supabaseClient.js';

const TABLE = 'app_payouts';

/**
 * היסטוריית תשלומים לעובדים – כל רשומה היא סגירת חשבון חודשית לעובד
 * (כמה כייסים שולמו, סכום, מתי ועל ידי מי).
 */
function rowToPayout(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    employeeEmail: row.employee_email || '',
    employeeName: row.employee_name || '',
    casesCount: Number(row.cases_count) || 0,
    amount: Number(row.amount) || 0,
    caseIds: Array.isArray(row.case_ids) ? row.case_ids : [],
    paidBy: row.paid_by || '',
    paidAt: row.paid_at || null,
  };
}

export const readPayouts = async () => {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from(TABLE)
      .select('*')
      .order('paid_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToPayout);
  } catch (error) {
    console.error('Error reading payouts from DB:', error);
    return [];
  }
};

export const createPayout = async ({ employeeEmail, employeeName, casesCount, amount, caseIds, paidBy }) => {
  const sb = getSupabaseAdmin();
  const record = {
    id: crypto.randomUUID(),
    employee_email: String(employeeEmail || '').trim().toLowerCase(),
    employee_name: employeeName || '',
    cases_count: casesCount,
    amount,
    case_ids: Array.isArray(caseIds) ? caseIds : [],
    paid_by: String(paidBy || '').trim().toLowerCase(),
    paid_at: new Date().toISOString(),
  };
  const { data, error } = await sb.from(TABLE).insert(record).select('*').single();
  if (error) throw error;
  return rowToPayout(data);
};
