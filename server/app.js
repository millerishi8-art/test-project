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

// CORS – נדרש כדי שהקליינט (localhost:3000 או Vercel) יוכל לשלוח בקשות ל-API
const allowedOrigins = [
  'https://project-client-sandy.vercel.app',
  'http://localhost:3000',
  'http://localhost:5000',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

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
