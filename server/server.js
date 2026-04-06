/**
 * כניסה להרצה מקומית – טוען את אפליקציית Express, מתחבר ל-Supabase ומאזין על הפורט.
 * ב-Vercel משתמשים ב-api/index.js (Serverless) ללא קובץ זה.
 */
import app from './app.js';
import { connectToDatabase, closeDatabaseConnection } from './db/database.js';
import { resolveSupabaseUrl, resolveSupabaseServiceRoleKey } from './db/supabaseClient.js';
import { scheduleDeferredPaymentReminders } from './jobs/deferredPaymentReminders.js';

const PORT = process.env.PORT || 5000;
let server;

function hasSupabaseEnv() {
  return !!(resolveSupabaseUrl() && resolveSupabaseServiceRoleKey());
}

async function start() {
  if (hasSupabaseEnv()) {
    try {
      await connectToDatabase();
      console.log('Database: Supabase מחובר');
    } catch (err) {
      console.error('Database: שגיאת חיבור –', err.message);
      console.log('השרת ממשיך לרוץ – בקשות ל-DB עלולות להיכשל עד שתתקן את ההגדרות או את הטבלאות');
    }
  } else {
    console.log(
      'Database: חסרים משתני Supabase (URL + service role). ראה SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL / VITE_SUPABASE_URL ו-SUPABASE_SERVICE_ROLE_KEY ב-server/.env או ב-Vercel.'
    );
  }

  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    const hasEmail = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
    console.log(hasEmail ? '[Email] מוגדר' : '[Email] לא מוגדר – הגדר EMAIL_USER ו-EMAIL_PASS ב-server/.env');

    if ((process.env.DISABLE_DEFERRED_REMINDER_CRON || '').trim() !== '1') {
      try {
        scheduleDeferredPaymentReminders();
      } catch (e) {
        console.error('[DeferredPaymentReminders] failed to schedule:', e?.message || e);
      }
    } else {
      console.log('[DeferredPaymentReminders] disabled via DISABLE_DEFERRED_REMINDER_CRON=1');
    }
  });
}

function shutdown() {
  if (server) server.close();
  closeDatabaseConnection();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
