/**
 * אפליקציית Express משותפת – לשימוש מקומי (server.js) ולפונקציות Serverless ב-Vercel (api/index.js).
 * ללא listen() – אתחול חיבור Supabase ל-serverless (לא חוסם אם נכשל).
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

function buildAllowedOrigins() {
  const set = new Set([
    'https://test-project-tan-chi.vercel.app',
    'https://original-project-tan-chi.vercel.app',
    'http://localhost:3000',
    'http://localhost:5000',
  ]);
  (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((o) => set.add(o));
  const vu = (process.env.VERCEL_URL || '').trim();
  if (vu) set.add(`https://${vu}`);
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

// חיבור למסד (Supabase) ב-serverless – רץ פעם אחת על cold start
let dbPromise;
dbPromise = connectToDatabase()
  .then(() => console.log('[DB] Supabase מוכן (serverless/Vercel)'))
  .catch((err) => console.error('[DB] שגיאת חיבור ב-serverless –', err?.message || err));

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
