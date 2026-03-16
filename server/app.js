/**
 * אפליקציית Express משותפת – לשימוש מקומי (server.js) ולפונקציות Serverless ב-Vercel (api/index.js).
 * ללא listen() וחיבור MongoDB – אלה נשארים ב-server.js להרצה מקומית.
 */
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import routes from './routes/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// CORS – תצורה גמישה יותר (כולל Vercel) עם תמיכה ב-Credentials ו-Preflight
const corsOptions = {
  origin: true, // מאפשר כל origin (בשלב בדיקות; ניתן להחליף לרשימה מצומצמת בהמשך)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // טיפול בבקשות OPTIONS (Preflight)

// גודל body מוגדר להעלאת תמונות (חתימה וכו') כ-base64
app.use(express.json({ limit: '10mb' }));

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
