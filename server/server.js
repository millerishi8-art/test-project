/**
 * Local entry: Express + Supabase ping + listen. Vercel uses api/index.js (serverless) instead.
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
      console.log('[Supabase] Ready (local server)');
    } catch (err) {
      console.error('[Supabase] Startup connection check failed:', err?.message || err);
      console.warn('[Supabase] Server is up; API calls that need the DB may fail until env and schema are fixed.');
    }
  } else {
    console.warn(
      '[Supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — set them in server/.env or your host (e.g. Vercel env).'
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
