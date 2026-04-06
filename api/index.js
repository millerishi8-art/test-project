/**
 * כניסת Serverless ב-Vercel – כל הבקשות ל-/api/* מנותבות לכאן.
 *
 * משתני סביבה לשרת (חובה):
 * - SUPABASE_URL — https://….supabase.co (בלי סלאש בסוף)
 * - SUPABASE_SERVICE_ROLE_KEY — service_role מ-Supabase → Settings → API
 * - JWT_SECRET
 * אם AUTH_PROVIDER=supabase: גם SUPABASE_ANON_KEY
 * הרץ server/db/supabase_schema.sql ב-Supabase.
 */
import app from '../server/app.js';

export default app;
