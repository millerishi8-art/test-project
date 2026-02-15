import { MongoClient } from 'mongodb';

const DEFAULT_URI =
'mongodb+srv://david:123456@cluster0.rwg4ui6.mongodb.net/?appName=Cluster0'

const DB_NAME = process.env.MONGODB_DB_NAME || 'insurance-agent';

let client = null;
let db = null;

function getConnectionUri() {
  const base = process.env.MONGODB_URI || DEFAULT_URI;
  const password = process.env.MONGODB_PASSWORD || '';
  return base.replace('<db_password>', password);
}

/**
 * מתחבר ל-MongoDB Atlas ומחזיר את ה-DB
 * יש להגדיר ב-.env:
 *   MONGODB_PASSWORD=הסיסמה_שלך
 * או מחרוזת מלאה:
 *   MONGODB_URI=mongodb+srv://david:YOUR_PASSWORD@cluster0.rwg4ui6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
 *   MONGODB_DB_NAME=insurance-agent (אופציונלי)
 */
export async function connectToMongoDB() {
  if (db) return db;

  const uri = getConnectionUri();

  if (uri.includes('123456')) {
    throw new Error('הגדר MONGODB_PASSWORD ב-.env או MONGODB_URI מלא עם סיסמה');
  }

  client = new MongoClient(uri, { serverSelectionTimeoutMS: 20000 });

  try {
    await client.connect();
    db = client.db(DB_NAME);
    console.log('MongoDB: חיבור ל-DB הצליח');
    return db;
  } catch (err) {
    console.error('MongoDB: שגיאה בחיבור', err.message);
    throw err;
  }
}

/**
 * מחזיר את ה-DB (רק אחרי connectToMongoDB)
 */
export function getDb() {
  if (!db) throw new Error('MongoDB: לא מחובר. קרא ל-connectToMongoDB() קודם.');
  return db;
}

/**
 * סוגר את החיבור
 */
export async function closeMongoDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('MongoDB: חיבור נסגר');
  }
}

export default { connectToMongoDB, getDb, closeMongoDB };
