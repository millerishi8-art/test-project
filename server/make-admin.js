/**
 * מגדיר role=admin רק למנהל המערכת היחיד (SUPER_ADMIN_EMAIL / ADMIN_EMAIL).
 * הרצה: node make-admin.js
 * (ארגומנט מייל מתעלמים ממנו — תמיד משתמשים ב-getSuperAdminEmail())
 */

import './loadEnv.js';
import { connectToDatabase } from './db/database.js';
import { findUserByEmail, updateUserByEmail } from './models/User.js';
import { ROLES, isUserRoleAdmin } from './components/constants.js';
import { getSuperAdminEmail } from './utils/adminEmails.js';

const EMAIL = getSuperAdminEmail();

async function main() {
  if (!EMAIL) {
    console.error('Missing SUPER_ADMIN_EMAIL / ADMIN_EMAIL in env.');
    process.exit(1);
  }

  const arg = (process.argv[2] || '').trim().toLowerCase();
  if (arg && arg !== EMAIL) {
    console.error(`רק מנהל מערכת אחד (${EMAIL}). לא ניתן להגדיר מייל אחר.`);
    process.exit(1);
  }

  try {
    await connectToDatabase();
  } catch (err) {
    console.error('Database connection error:', err.message);
    process.exit(1);
  }

  try {
    const user = await findUserByEmail(EMAIL);
    if (!user) {
      console.error('User not found for', EMAIL, '- register or run create-admin.js first.');
      process.exit(1);
    }

    const updated = await updateUserByEmail(EMAIL, { role: ROLES.ADMIN });
    if (!updated || !isUserRoleAdmin(updated.role)) {
      console.error('Update failed: could not set role to admin.');
      process.exit(1);
    }

    console.log(
      'Updated user:',
      JSON.stringify({ id: updated.id, email: updated.email, name: updated.name, role: updated.role }, null, 2)
    );
    console.log('Success: sole super admin role for', EMAIL);
  } catch (err) {
    console.error('Database error:', err.message);
    if (err.code) console.error('Error code:', err.code);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
