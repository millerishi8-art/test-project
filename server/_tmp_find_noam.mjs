import './loadEnv.js';
import { getSupabaseAdmin } from './db/supabaseClient.js';

function collectStrings(value, path, out, depth) {
  if (depth > 6 || value == null) return;
  if (typeof value === 'string') {
    if (/נועם|סטודנט|student/i.test(value) && value.length < 400 && !value.startsWith('data:')) {
      out.push(`${path}: ${value.slice(0, 180)}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => collectStrings(item, `${path}[${i}]`, out, depth + 1));
    return;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k === 'hraDetails' || k === 'password') continue;
      collectStrings(v, path ? `${path}.${k}` : k, out, depth + 1);
    }
  }
}

const sb = getSupabaseAdmin();
const { data, error } = await sb.from('app_cases').select('id,user_id,data');
if (error) {
  console.error('query failed', error.message);
  process.exit(1);
}

const hits = [];
for (const row of data || []) {
  const d = row.data && typeof row.data === 'object' ? row.data : {};
  const pd = d.personalDetails || {};
  const name = [pd.fullName, pd.firstName, pd.lastName, d.fullName, d.clientName]
    .filter(Boolean)
    .join(' ');
  const blob = JSON.stringify(d);
  if (!/נועם/.test(name) && !/נועם/.test(blob)) continue;
  const notes = [];
  collectStrings(d, '', notes, 0);
  const meta = Array.isArray(d.attachmentMeta) ? d.attachmentMeta : [];
  const files = meta.map((m) => ({
    category: m?.category || '',
    fileName: m?.fileName || m?.name || '',
    path: m?.storagePath || m?.path || m?.url || '',
  }));
  hits.push({
    id: row.id,
    userId: row.user_id,
    name: name || '(no name field)',
    benefit: d.benefitType || d.benefit || '',
    fileCount: files.length,
    files,
    notes: notes.slice(0, 40),
  });
}

console.log(JSON.stringify({ cases: (data || []).length, hits }, null, 2));
