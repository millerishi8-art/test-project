import { MongoClient } from 'mongodb';

const DB_NAME = process.env.MONGODB_DB_NAME || 'insurance-agent';

let client = null;
let db = null;

function getConnectionUri() {
  let uri = (process.env.MONGODB_URI || '').trim();
  if (!uri) {
    throw new Error(
      'MONGODB_URI חסר. הגדר ב-.env את מחרוזת החיבור ל-MongoDB (כולל משתמש וסיסמה).'
    );
  }
  uri = uri.replace(/^['"]|['"]$/g, '');
  return uri;
}
/**
 * מתחבר ל-MongoDB Atlas ומחזיר את ה-DB.
 * חובה: MONGODB_URI ב-.env. אופציונלי: MONGODB_DB_NAME.
 */
let isConnecting = false;
let connectionPromise = null;

export async function connectToMongoDB() {
  if (db) return db;
  
  if (isConnecting && connectionPromise) {
    return connectionPromise;
  }
  
  isConnecting = true;
  connectionPromise = (async () => {
    try {
      const uri = getConnectionUri();
      client = new MongoClient(uri, { 
        serverSelectionTimeoutMS: 5000, // הקטנתי ל-5 שניות לזיהוי מהיר יותר ב-Vercel
        connectTimeoutMS: 10000
      });
      
      await client.connect();
      db = client.db(DB_NAME);
      console.log('MongoDB: חיבור ל-DB הצליח');
      isConnecting = false;
      return db;
    } catch (err) {
      isConnecting = false;
      connectionPromise = null;
      console.error('MongoDB: שגיאה בחיבור', err.message);
      throw err;
    }
  })();
  
  return connectionPromise;
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
