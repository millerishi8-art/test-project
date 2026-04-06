/**
 * הרמת הרשאות: מגדיר למשתמש לפי אימייל את התפקיד admin.
 * נטען מ-server/.env (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 * הרצה: node make-admin.js [email]
 * ברירת מחדל: millerbitoach@gmail.com
 */

import './loadEnv.js';
import { connectToMongoDB } from './db/mongodb.js';
import { findUserByEmail, updateUserByEmail } from './models/User.js';
import { ROLES } from './components/constants.js';

const EMAIL = (process.argv[2] || 'millerbitoach@gmail.com').trim().toLowerCase();

async function main() {
  try {
    await connectToMongoDB();
  } catch (err) {
    console.error('Database connection error:', err.message);
    process.exit(1);
  }

  try {
    const user = await findUserByEmail(EMAIL);
    if (!user) {
      console.error('User not found. Register this email first (or run create-admin.js to create an admin user).');
      process.exit(1);
    }

    const updated = await updateUserByEmail(EMAIL, { role: ROLES.ADMIN });
    if (!updated || updated.role !== ROLES.ADMIN) {
      console.error('Update failed: could not set role to admin.');
      process.exit(1);
    }

    console.log(
      'Updated user:',
      JSON.stringify({ id: updated.id, email: updated.email, name: updated.name, role: updated.role }, null, 2)
    );
    console.log('Success: role set to "admin" for', EMAIL);
  } catch (err) {
    console.error('Database error:', err.message);
    if (err.code) console.error('Error code:', err.code);
    process.exit(1);
  }

  process.exit(0);
}

main();
