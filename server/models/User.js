import { getDb } from '../db/mongodb.js';

const COLLECTION_NAME = 'users';
function getCollection() {
  return getDb().collection(COLLECTION_NAME);
}

/**
 * מבנה משתמש (User)
 * @typedef {Object} User
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {string} phone
 * @property {string} password - מוצפן (hash)
 * @property {'user'|'admin'} role
 * @property {string} createdAt - ISO date
 * @property {boolean} [emailVerified]
 * @property {string} [emailVerificationCode] - קוד 6 ספרות לאימות אימייל
 * @property {string} [emailVerificationCodeExpires] - ISO date
 * @property {string} [phoneVerificationCode] - קוד 6 ספרות
 * @property {string} [phoneVerificationCodeExpires] - ISO date
 */

/**
 * מחזיר את כל המשתמשים (MongoDB)
 */
export async function readUsers() {
  try {
    const collection = getCollection();
    const users = await collection.find({}).toArray();
    return users;
  } catch (error) {
    console.error('User readUsers error:', error);
    return [];
  }
}

/**
 * מחזיר משתמש לפי id
 */
export async function findUserById(id) {
  try {
    const collection = getCollection();
    return await collection.findOne({ id });
  } catch (error) {
    console.error('User findUserById error:', error);
    return null;
  }
}

/** חיפוש אימייל לא רגיש לאותיות גדולות/קטנות */
function emailRegex(email) {
  const e = (email || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return e ? new RegExp(`^${e}$`, 'i') : null;
}

/**
 * מחזיר משתמש לפי אימייל (חיפוש לא רגיש לאותיות גדולות/קטנות)
 */
export async function findUserByEmail(email) {
  try {
    const collection = getCollection();
    const re = emailRegex(email);
    if (!re) return null;
    return await collection.findOne({ email: re });
  } catch (error) {
    console.error('User findUserByEmail error:', error);
    return null;
  }
}

/**
 * יוצר משתמש חדש ב-MongoDB
 */
export async function createUser(userData) {
  try {
    const collection = getCollection();
    await collection.insertOne(userData);
    return userData;
  } catch (error) {
    console.error('User createUser error:', error?.message || error);
    throw error;
  }
}

/**
 * מעדכן משתמש לפי id (למשל הורדת מנהל ל-user)
 */
export async function updateUserById(id, updateFields) {
  try {
    const collection = getCollection();
    const { id: _id, ...allowed } = updateFields;
    const set = {};
    if (allowed.role !== undefined) set.role = allowed.role;
    if (allowed.password !== undefined) set.password = allowed.password;
    if (allowed.name !== undefined) set.name = allowed.name;
    if (allowed.phone !== undefined) set.phone = allowed.phone;
    if (allowed.email !== undefined) set.email = (allowed.email + '').trim().toLowerCase();
    if (allowed.emailVerified !== undefined) set.emailVerified = !!allowed.emailVerified;
    if (allowed.emailVerificationCode !== undefined) set.emailVerificationCode = allowed.emailVerificationCode;
    if (allowed.emailVerificationCodeExpires !== undefined) set.emailVerificationCodeExpires = allowed.emailVerificationCodeExpires;
    if (allowed.phoneVerificationCode !== undefined) set.phoneVerificationCode = allowed.phoneVerificationCode;
    if (allowed.phoneVerificationCodeExpires !== undefined) set.phoneVerificationCodeExpires = allowed.phoneVerificationCodeExpires;
    if (Object.keys(set).length === 0) return await findUserById(id);
    const result = await collection.findOneAndUpdate(
      { id },
      { $set: set },
      { returnDocument: 'after' }
    );
    return result || null;
  } catch (error) {
    console.error('User updateUserById error:', error);
    return null;
  }
}

/**
 * מעדכן כל המשתמשים עם אימייל תואם (לא רגיש לאותיות) – role, password, email
 * חשוב: מעדכן את כל הרשומות עם אותו אימייל כדי שההתחברות תעבוד תמיד
 */
export async function updateUserByEmail(email, updateFields) {
  try {
    const collection = getCollection();
    const re = emailRegex(email);
    if (!re) return null;
    const users = await collection.find({ email: re }).toArray();
    if (users.length === 0) return null;
    const { id, ...allowed } = updateFields;
    const set = {};
    if (allowed.role !== undefined) set.role = allowed.role;
    if (allowed.password !== undefined) set.password = allowed.password;
    if (allowed.name !== undefined) set.name = allowed.name;
    if (allowed.phone !== undefined) set.phone = allowed.phone;
    if (allowed.email !== undefined) set.email = (allowed.email + '').trim().toLowerCase();
    if (allowed.emailVerified !== undefined) set.emailVerified = !!allowed.emailVerified;
    if (allowed.emailVerificationCode !== undefined) set.emailVerificationCode = allowed.emailVerificationCode;
    if (allowed.emailVerificationCodeExpires !== undefined) set.emailVerificationCodeExpires = allowed.emailVerificationCodeExpires;
    if (allowed.phoneVerificationCode !== undefined) set.phoneVerificationCode = allowed.phoneVerificationCode;
    if (allowed.phoneVerificationCodeExpires !== undefined) set.phoneVerificationCodeExpires = allowed.phoneVerificationCodeExpires;
    if (Object.keys(set).length === 0) return users[0];
    const ids = users.map((u) => u.id);
    await collection.updateMany({ id: { $in: ids } }, { $set: set });
    return await findUserById(users[0].id);
  } catch (error) {
    console.error('User updateUserByEmail error:', error);
    return null;
  }
}

/**
 * מחזיר משתמש לפי טוקן אימות אימייל (ותוקף לא פג)
 */
export async function findUserByVerificationToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const collection = getCollection();
    const expires = new Date().toISOString();
    return await collection.findOne({
      emailVerificationToken: token,
      emailVerificationTokenExpires: { $gt: expires },
    });
  } catch (error) {
    console.error('User findUserByVerificationToken error:', error);
    return null;
  }
}

/**
 * מסיר שדות רגישים (password, tokens) מהמשתמש
 */
export function sanitizeUser(user) {
  if (!user) return null;
  const { password, emailVerificationToken, emailVerificationTokenExpires, emailVerificationCode, emailVerificationCodeExpires, phoneVerificationCode, phoneVerificationCodeExpires, ...rest } = user;
  return rest;
}
