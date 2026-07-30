/**
 * בודק אם טבלת employee_cases קיימת; אם לא – מנסה ליצור אותה דרך Postgres אם יש DATABASE_URL.
 * לא מדפיס סודות.
 */
import './loadEnv.js';
import { getSupabaseAdmin } from './db/supabaseClient.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function tableExists() {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('employee_cases').select('id').limit(1);
  if (!error) return true;
  const msg = String(error.message || '');
  const code = String(error.code || '');
  if (code === 'PGRST205' || code === '42P01' || msg.includes('employee_cases') || msg.includes('schema cache')) {
    return false;
  }
  // שגיאות אחרות (הרשאות וכו') – נניח שהטבלה קיימת אבל יש בעיה אחרת
  console.log('בדיקה החזירה שגיאה לא-ברורה:', code || msg.slice(0, 120));
  return null;
}

async function tryCreateViaPg() {
  const url =
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL ||
    process.env.DIRECT_URL ||
    '';
  if (!url) {
    console.log('אין DATABASE_URL / SUPABASE_DB_URL – לא ניתן ליצור טבלה אוטומטית מכאן.');
    return false;
  }
  let pg;
  try {
    pg = await import('pg');
  } catch {
    console.log('חבילת pg לא מותקנת – מדלג על יצירה אוטומטית.');
    return false;
  }
  const sqlPath = path.join(__dirname, 'db', 'employee_cases_schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new pg.default.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log('✅ טבלת employee_cases נוצרה בהצלחה.');
    return true;
  } finally {
    await client.end();
  }
}

async function main() {
  const exists = await tableExists();
  if (exists === true) {
    console.log('✅ טבלת employee_cases כבר קיימת ב-Supabase.');
    process.exit(0);
  }
  if (exists === false) {
    console.log('❌ טבלת employee_cases חסרה.');
    const created = await tryCreateViaPg();
    if (!created) {
      console.log('');
      console.log('פעולה נדרשת: Supabase → SQL Editor → הרץ את הקובץ:');
      console.log('  server/db/employee_cases_schema.sql');
      process.exit(2);
    }
    const again = await tableExists();
    process.exit(again ? 0 : 2);
  }
  process.exit(1);
}

main().catch((e) => {
  console.error('שגיאה:', e?.message || e);
  process.exit(1);
});
