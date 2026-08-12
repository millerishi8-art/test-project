/**
 * מריץ את עדכון CHECK לקטגוריית "פתיחת כייס" ב-Supabase.
 * דורש SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY ב-.env
 * או DATABASE_URL / SUPABASE_DB_URL לחיבור Postgres ישיר.
 *
 *   node run-employee-cases-category-migration.js
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, 'db', 'employee_cases_rename_opening_category.sql');
const sql = readFileSync(sqlPath, 'utf8');

async function runViaPg(connectionString) {
  const pg = await import('pg');
  const client = new pg.default.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(sql);
    console.log('OK: employee_cases category CHECK updated (via Postgres).');
  } finally {
    await client.end();
  }
}

async function runViaSupabaseRpc() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  /* ניסיון דרך SQL אם קיים endpoint מותאם – בדרך כלל צריך Postgres ישיר */
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(url, key, { auth: { persistSession: false } });

  /* בדיקה שהטבלה קיימת */
  const { error: probeErr } = await sb.from('employee_cases').select('id').limit(1);
  if (probeErr && (probeErr.code === 'PGRST205' || /does not exist/i.test(probeErr.message || ''))) {
    throw new Error(`טבלת employee_cases לא נמצאה: ${probeErr.message}`);
  }

  /* Supabase JS לא מריץ DDL – חייבים DATABASE_URL */
  throw new Error(
    'אין DATABASE_URL/SUPABASE_DB_URL. הוסף connection string מ-Supabase → Settings → Database, או הרץ את SQL ידנית ב-SQL Editor.'
  );
}

async function main() {
  const dbUrl =
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL ||
    '';

  if (dbUrl) {
    await runViaPg(dbUrl);
    return;
  }

  await runViaSupabaseRpc();
}

main().catch((err) => {
  console.error('FAILED:', err?.message || err);
  process.exit(1);
});
