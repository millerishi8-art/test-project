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
import { connectToMongoDB } from './db/mongodb.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// CORS – תצורה גמישה יותר (כולל Vercel) עם תמיכה ב-Credentials ו-Preflight
const corsOptions = {
  origin: ['https://test-project-tan-chi.vercel.app', 'http://localhost:3000', 'http://localhost:5000'], // אפשר להחליף לרשימה ספציפית אבל ב-Vercel חשוב לאפשר את הדומיין
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // טיפול בבקשות OPTIONS (Preflight)

// גודל body מוגדר להעלאת תמונות (חתימה וכו') כ-base64
app.use(express.json({ limit: '10mb' }));

// חיבור MongoDB גם בסביבת Serverless (Vercel) – רץ פעם אחת על cold start
// אנחנו מפעילים את זה רק אם אנחנו רצים ב-Vercel או בסביבת פרודקשן כדי למנוע כפילויות עם server.js
let dbPromise;
dbPromise = connectToMongoDB()
  .then(() => console.log('MongoDB: מחובר בהצלחה (serverless/Vercel)'))
  .catch(err => console.error('MongoDB: שגיאה בחיבור בסביבת serverless –', err?.message || err));

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
