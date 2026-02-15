import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import routes from './routes/index.js';
import { connectToMongoDB, closeMongoDB } from './db/mongodb.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// וידוא שתיקיית data קיימת לשמירת קייסים (cases.json)
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('נוצרה תיקיית data לשמירת קייסים');
}

app.use('/api', routes);

let server;

async function start() {
  const hasMongoEnv = process.env.MONGODB_PASSWORD || process.env.MONGODB_URI;

  if (hasMongoEnv) {
    try {
      await connectToMongoDB();
      console.log('MongoDB: מחובר בהצלחה');
    } catch (err) {
      console.error('MongoDB: שגיאה בחיבור –', err.message);
      console.log('השרת ממשיך לרוץ בלי MongoDB');
    }
  } else {
    console.log('MongoDB: לא הוגדר (הוסף MONGODB_PASSWORD או MONGODB_URI ל-.env)');
  }

  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

function shutdown() {
  if (server) server.close();
  closeMongoDB().catch(() => {});
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
