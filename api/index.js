/**
 * כניסת Serverless ב-Vercel – כל הבקשות ל-/api/* מנותבות לכאן.
 * טוען את אפליקציית Express מהשרת (server/app.js) ומעביר אליה את הבקשה.
 * CORS מטופל בתוך האפליקציה.
 *
 * משתני סביבה חובה ב-Vercel (Settings → Environment Variables) — לסמן Production + Preview:
 * - כתובת פרויקט: SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL / VITE_SUPABASE_URL (אחד עם אותו ערך)
 * - service_role: SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY / SERVICE_ROLE_KEY (לא anon)
 * - JWT_SECRET
 * - אם AUTH_PROVIDER=supabase: גם SUPABASE_ANON_KEY (להתחברות signInWithPassword מהשרת).
 * הרץ ב-Supabase SQL Editor את server/db/supabase_schema.sql (app_users, app_cases).
 * - ADMIN_EMAIL (ובהתאם ADMIN_PASSWORD)
 * - EMAIL_USER, EMAIL_PASS (או SMTP/שירות מייל אחר)
 * - CRON_SECRET – מחרוזת אקראית; Vercel Cron שולח Authorization: Bearer <CRON_SECRET> לנתיב
 *   GET /api/cron/deferred-payment-reminders (תזכורות תשלום מאוחר). ללא שרת שרץ 24/7 נדרש Cron ב-Vercel או שירות חיצוני.
 */
import app from '../server/app.js';

export default app;
