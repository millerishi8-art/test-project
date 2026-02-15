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

/**
 * מחזיר משתמש לפי אימייל
 */
export async function findUserByEmail(email) {
  try {
    const collection = getCollection();
    return await collection.findOne({ email });
  } catch (error) {
    console.error('User findUserByEmail error:', error);
    return null;
  }
}

/**
 * יוצר משתמש חדש ב-MongoDB
 */
export async function createUser(userData) {
  const collection = getCollection();
  await collection.insertOne(userData);
  return userData;
}

/**
 * מסיר שדות רגישים (password) מהמשתמש
 */
export function sanitizeUser(user) {
  if (!user) return null;
  const { password, ...rest } = user;
  return rest;
}
