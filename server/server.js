/**
 * כניסה להרצה מקומית – טוען את אפליקציית Express, מתחבר ל-MongoDB ומאזין על הפורט.
 * ב-Vercel משתמשים ב-api/index.js (Serverless) ללא קובץ זה.
 */
import app from './app.js';
import { connectToMongoDB, closeMongoDB } from './db/mongodb.js';

const PORT = process.env.PORT || 5000;
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
    const hasEmail = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
    console.log(hasEmail ? '[Email] מוגדר' : '[Email] לא מוגדר – הגדר EMAIL_USER ו-EMAIL_PASS ב-server/.env');
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
