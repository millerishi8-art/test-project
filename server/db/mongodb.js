import { MongoClient } from 'mongodb';

const DB_NAME = process.env.MONGODB_DB_NAME || 'insurance-agent';

let client = null;
let db = null;

function getConnectionUri() {
  const uri = process.env.MONGODB_URI;
  if (!uri || !uri.trim()) {
    throw new Error(
      'MONGODB_URI חסר. הגדר ב-.env את מחרוזת החיבור ל-MongoDB (כולל משתמש וסיסמה).'
    );
  }
  return uri.trim();
}
/**
 * מתחבר ל-MongoDB Atlas ומחזיר את ה-DB.
 * חובה: MONGODB_URI ב-.env. אופציונלי: MONGODB_DB_NAME.
 */
export async function connectToMongoDB() {
  if (db) return db;

  const uri = getConnectionUri();
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
