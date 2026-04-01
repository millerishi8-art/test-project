import { MongoClient } from 'mongodb';

const DB_NAME = process.env.MONGODB_DB_NAME || 'insurance-agent';

let client = null;
let db = null;

/**
 * שם DB שמופיע אחרי ה-host ב-URI (אם יש). ב-Atlas לעיתים יש /שם-מסד לפני ?.
 * הקוד תמיד משתמש ב-client.db(MONGODB_DB_NAME) — אם זה לא תואם ל-URI, הנתונים "נעלמים".
 */
function databaseNameFromUri(uri) {
  if (!uri || typeof uri !== 'string') return '';
  const withoutQuery = uri.replace(/\?.*$/, '');
  const at = withoutQuery.lastIndexOf('@');
  const hostAndPath =
    at >= 0
      ? withoutQuery.slice(at + 1)
      : withoutQuery.replace(/^mongodb(\+srv)?:\/\//i, '');
  const slash = hostAndPath.indexOf('/');
  if (slash < 0 || slash === hostAndPath.length - 1) return '';
  const raw = hostAndPath.slice(slash + 1).replace(/\/+$/, '');
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

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
      const uriDbHint = databaseNameFromUri(uri);
      if (uriDbHint && uriDbHint !== DB_NAME) {
        console.warn(
          '[MongoDB] אזהרה: ב-URI מופיע שם מסד',
          JSON.stringify(uriDbHint),
          'אבל האפליקציה משתמשת ב-',
          JSON.stringify(DB_NAME),
          '(MONGODB_DB_NAME). אם הטבלאות נמצאות תחת השם ב-URI, הגדר MONGODB_DB_NAME בהתאם או הסר את נתיב ה-DB מה-URI.'
        );
      }
      const forceIpv4 = (process.env.MONGODB_FORCE_IPV4 || '').trim() === '1';
      // Atlas + רשת איטית / IPv6 תקול ב-Windows: העלה timeout; אופציונלית IPv4 בלבד
      client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 45_000,
        connectTimeoutMS: 45_000,
        maxPoolSize: 10,
        ...(forceIpv4 ? { family: 4 } : {}),
      });

      await client.connect();
      db = client.db(DB_NAME);
      console.log(
        '[MongoDB] חיבור הצליח | מסד פעיל:',
        DB_NAME,
        '| NODE_ENV:',
        process.env.NODE_ENV || '(לא מוגדר)',
        '| VERCEL:',
        process.env.VERCEL ? '1' : '0'
      );
      isConnecting = false;
      return db;
    } catch (err) {
      isConnecting = false;
      connectionPromise = null;
      console.error('[MongoDB] שגיאת חיבור:', err?.name, err?.code || '', err?.message || err);
      if (err?.stack) console.error('[MongoDB] stack:', err.stack);

      const msg = String(err?.message || '');
      const isSelection =
        err?.name === 'MongoServerSelectionError' ||
        msg.includes('timed out') ||
        msg.includes('Server selection');
      if (isSelection) {
        console.error(`[MongoDB] timeout – בדוק: קלסטר Running ב-Atlas; VPN/אנטיוירוס; נסה ב-server/.env שורה:
  MONGODB_FORCE_IPV4=1
(עוזר כש-IPv6 ברשת לא עובד). אימות: mongosh "<MONGODB_URI>"`);
      }
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
