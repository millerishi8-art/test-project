import crypto from 'crypto';
import { getSupabaseAdmin } from '../db/supabaseClient.js';

const TABLE = 'admin_notices';

function asStringArray(val) {
  if (Array.isArray(val)) return val.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean);
  return [];
}

function rowToNotice(row) {
  if (!row) return null;
  const fromData =
    row.data != null && typeof row.data === 'object' && !Array.isArray(row.data) ? { ...row.data } : {};
  const steps = Array.isArray(row.steps)
    ? row.steps
    : Array.isArray(fromData.steps)
      ? fromData.steps
      : [];
  return {
    id: String(row.id || fromData.id || ''),
    actorEmail: String(row.actor_email || fromData.actorEmail || '')
      .trim()
      .toLowerCase(),
    actorName: String(row.actor_name || fromData.actorName || '').trim(),
    caseId: String(row.case_id || fromData.caseId || ''),
    clientName: String(row.client_name || fromData.clientName || '').trim(),
    title: String(row.title || fromData.title || '').trim(),
    steps: steps.map((s) => String(s || '').trim()).filter(Boolean),
    seenBy: asStringArray(row.seen_by != null ? row.seen_by : fromData.seenBy),
    createdAt: row.created_at || fromData.createdAt || null,
  };
}

export async function createAdminNotice(payload) {
  const sb = getSupabaseAdmin();
  const id = crypto.randomUUID();
  const record = {
    id,
    actor_email: String(payload.actorEmail || '').trim().toLowerCase(),
    actor_name: String(payload.actorName || '').trim(),
    case_id: String(payload.caseId || ''),
    client_name: String(payload.clientName || '').trim(),
    title: String(payload.title || '').trim(),
    steps: Array.isArray(payload.steps) ? payload.steps : [],
    seen_by: [],
    created_at: new Date().toISOString(),
  };
  const { data, error } = await sb.from(TABLE).insert(record).select('*').single();
  if (error) {
    const nested = {
      id,
      data: {
        id,
        actorEmail: record.actor_email,
        actorName: record.actor_name,
        caseId: record.case_id,
        clientName: record.client_name,
        title: record.title,
        steps: record.steps,
        seenBy: [],
        createdAt: record.created_at,
      },
    };
    const r2 = await sb.from(TABLE).insert(nested).select('*').single();
    if (r2.error) throw r2.error;
    return rowToNotice(r2.data);
  }
  return rowToNotice(data);
}

export async function listUnseenAdminNotices(viewerEmail) {
  const email = String(viewerEmail || '').trim().toLowerCase();
  if (!email) return [];
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from(TABLE).select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return (data || [])
      .map(rowToNotice)
      .filter(Boolean)
      .filter((n) => n.actorEmail !== email)
      .filter((n) => !n.seenBy.includes(email))
      .filter((n) => n.steps.length > 0 || n.title);
  } catch (error) {
    console.error('AdminNotice listUnseen error:', error?.message || error);
    return [];
  }
}

export async function markAdminNoticeSeen(id, viewerEmail) {
  const email = String(viewerEmail || '').trim().toLowerCase();
  if (!id || !email) return null;
  const sb = getSupabaseAdmin();
  const { data: row, error: fetchErr } = await sb.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!row) return null;
  const current = rowToNotice(row);
  if (current.seenBy.includes(email)) return current;
  const seenBy = [...current.seenBy, email];
  let { data: out, error } = await sb.from(TABLE).update({ seen_by: seenBy }).eq('id', id).select('*').maybeSingle();
  if (error) {
    const prev =
      row.data != null && typeof row.data === 'object' && !Array.isArray(row.data) ? { ...row.data } : {};
    const r2 = await sb
      .from(TABLE)
      .update({ data: { ...prev, seenBy } })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    out = r2.data;
    error = r2.error;
  }
  if (error) throw error;
  return rowToNotice(out);
}
