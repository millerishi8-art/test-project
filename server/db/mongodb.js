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
  let uri = (
    process.env.MONGODB_URI ||
    process.env.DATABASE_URL ||
    process.env.MONGO_URI ||
    ''
  ).trim();
  if (!uri) {
    throw new Error(
      'MONGODB_URI חסר. הגדר MONGODB_URI (או DATABASE_URL) – מקומית ב-server/.env, ב-Vercel ב-Environment Variables.'
    );
  }
  uri = uri.replace(/^['"]|['"]$/g, '');
  return uri;
}

function isLikelyNetworkTimeout(err) {
  const code = err?.code;
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    err?.name === 'MongoServerSelectionError' ||
    err?.name === 'MongoNetworkError' ||
    msg.includes('timed out') ||
    msg.includes('server selection') ||
    msg.includes('econnreset')
  );
}

async function connectMongoClient(uri, useFamily4) {
  const c = new MongoClient(uri, {
    serverSelectionTimeoutMS: 45_000,
    connectTimeoutMS: 45_000,
    maxPoolSize: 10,
    ...(useFamily4 ? { family: 4 } : {}),
  });
  await c.connect();
  return c;
}

function logMongoTimeoutHints() {
  console.error(`[MongoDB] timeout – בדוק: קלסטר Running ב-Atlas; Network Access (IP / 0.0.0.0/0); VPN/אנטיוירוס; נסה ב-server/.env:
  MONGODB_FORCE_IPV4=1
אימות: mongosh "<MONGODB_URI>"`);
}

/**
 * מתחבר ל-MongoDB Atlas ומחזיר את ה-DB.
 * חובה: MONGODB_URI ב-.env. אופציונלי: MONGODB_DB_NAME, MONGODB_FORCE_IPV4=1
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
      const forceIpv4Env = (process.env.MONGODB_FORCE_IPV4 || '').trim() === '1';
      const attempts = forceIpv4Env ? [true] : [false, true];
      let lastErr = null;

      for (let i = 0; i < attempts.length; i++) {
        const useFamily4 = attempts[i];
        try {
          if (i === 1) {
            console.warn(
              '[MongoDB] ניסיון שני: חיבור עם IPv4 בלבד (family: 4) — נפוץ אחרי ETIMEDOUT ב-Windows מול Atlas.'
            );
          }
          client = await connectMongoClient(uri, useFamily4);
          db = client.db(DB_NAME);
          if (i === 1 && !forceIpv4Env) {
            console.warn('[MongoDB] טיפ: להימנע מניסיון כפול, הוסף ל-server/.env: MONGODB_FORCE_IPV4=1');
          }
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
          lastErr = err;
          if (client) {
            try {
              await client.close();
            } catch (_) {}
            client = null;
          }
          const canRetrySecondIpv4 =
            !forceIpv4Env && i === 0 && attempts.length > 1 && isLikelyNetworkTimeout(err);
          if (!canRetrySecondIpv4) {
            break;
          }
        }
      }

      isConnecting = false;
      connectionPromise = null;
      console.error('[MongoDB] שגיאת חיבור:', lastErr?.name, lastErr?.code || '', lastErr?.message || lastErr);
      if (lastErr?.stack) console.error('[MongoDB] stack:', lastErr.stack);
      if (lastErr && isLikelyNetworkTimeout(lastErr)) {
        logMongoTimeoutHints();
      }
      throw lastErr;
    } catch (err) {
      isConnecting = false;
      connectionPromise = null;
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
