/**
 * כניסת Serverless ב-Vercel – כל הבקשות ל-/api/* מנותבות לכאן.
 * טוען את אפליקציית Express מהשרת (server/app.js) ומעביר אליה את הבקשה.
 * CORS מטופל בתוך האפליקציה.
 *
 * משתני סביבה חובה ב-Vercel Dashboard (Settings → Environment Variables):
 * - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * - MONGODB_URI (מחרוזת מלאה; הקוד לא בונה URI מ-MONGODB_PASSWORD בלבד)
 * - MONGODB_DB_NAME (אופציונלי; ברירת מחדל insurance-agent — חייב להתאים למסד שבו נמצאת collection users)
 * - JWT_SECRET
 * - ADMIN_EMAIL (ובהתאם ADMIN_PASSWORD)
 * - EMAIL_USER, EMAIL_PASS (או SMTP/שירות מייל אחר)
 * - CRON_SECRET – מחרוזת אקראית; Vercel Cron שולח Authorization: Bearer <CRON_SECRET> לנתיב
 *   GET /api/cron/deferred-payment-reminders (תזכורות תשלום מאוחר). ללא שרת שרץ 24/7 נדרש Cron ב-Vercel או שירות חיצוני.
 */
import app from '../server/app.js';

export default app;
