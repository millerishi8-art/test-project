/**
 * כניסת Serverless ב-Vercel – כל הבקשות ל-/api/* מנותבות לכאן.
 * טוען את אפליקציית Express מהשרת (server/app.js) ומעביר אליה את הבקשה.
 * CORS מטופל בתוך האפליקציה.
 *
 * משתני סביבה חובה ב-Vercel Dashboard (Settings → Environment Variables):
 * - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * - MONGODB_URI (או MONGODB_PASSWORD + connection string)
 * - JWT_SECRET
 * - ADMIN_EMAIL (ובהתאם ADMIN_PASSWORD)
 * - EMAIL_USER, EMAIL_PASS (או SMTP/שירות מייל אחר)
 */
import app from '../server/app.js';

export default app;
