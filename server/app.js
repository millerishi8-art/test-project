/**
 * Shared Express app — local (server.js) and Vercel serverless (api/index.js).
 * No listen(). Supabase-only; cold-start ping is best-effort and never falls back to another DB.
 */
import './loadEnv.js';

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import routes from './routes/index.js';
import { connectToDatabase } from './db/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

function addOriginWithWwwVariants(set, rawOrigin) {
  const origin = String(rawOrigin || '').trim();
  if (!origin) return;
  set.add(origin);
  try {
    const url = new URL(origin);
    if (url.hostname.startsWith('www.')) {
      const noWww = new URL(origin);
      noWww.hostname = url.hostname.replace(/^www\./, '');
      set.add(noWww.toString().replace(/\/$/, ''));
      return;
    }
    // לדומיינים ציבוריים נוסיף גם www כדי למנוע חסימות מיותרות בין וריאציות.
    if (!url.hostname.includes('localhost') && !url.hostname.endsWith('.vercel.app')) {
      const withWww = new URL(origin);
      withWww.hostname = `www.${url.hostname}`;
      set.add(withWww.toString().replace(/\/$/, ''));
    }
  } catch (_) {
    // אם זה לא URL תקין נשאיר את הערך המקורי בלבד.
  }
}

function buildAllowedOrigins() {
  const set = new Set();
  [
    'https://test-project-tan-chi.vercel.app',
    'https://original-project-tan-chi.vercel.app',
    'http://localhost:3000',
    'http://localhost:5000',
  ].forEach((o) => addOriginWithWwwVariants(set, o));
  (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((o) => addOriginWithWwwVariants(set, o));
  const vu = (process.env.VERCEL_URL || '').trim();
  if (vu) addOriginWithWwwVariants(set, `https://${vu}`);
  return [...set];
}

// CORS – כולל דומיין הפרודקשן בפועל + VERCEL_URL + ALLOWED_ORIGINS (מופרד בפסיקים)
const allowedOrigins = buildAllowedOrigins();
const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn('[CORS] חסום:', origin);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // טיפול בבקשות OPTIONS (Preflight)

// גודל body מוגדר להעלאת תמונות (חתימה וכו') כ-base64
app.use(express.json({ limit: '10mb' }));

// Supabase ping once per serverless cold start (non-blocking)
connectToDatabase()
  .then(() => console.log('[Supabase] Connection check passed (serverless)'))
  .catch((err) => console.error('[Supabase] Cold-start connection check failed:', err?.message || err));

// וידוא שתיקיית data קיימת (להרצה מקומית; ב-Vercel אין filesystem מתמשך)
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch (_) {}
}

// כל ה-API תחת /api
app.use('/api', routes);

// תפיסת שגיאות גלובלית
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: err?.message || 'שגיאת שרת' });
});

export default app;
