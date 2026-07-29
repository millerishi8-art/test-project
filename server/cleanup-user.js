/**
 * Delete super-admin user(s) from Supabase app_users (canonical + aliases).
 * Run from project root: node server/cleanup-user.js
 * Use this to remove the test user so you can register again with a fresh bcrypt-hashed password.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectToDatabase } from './db/database.js';
import { deleteUserByEmail } from './models/User.js';
import { getSuperAdminEmailAliases } from './utils/adminEmails.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const EMAILS_TO_DELETE = getSuperAdminEmailAliases();

async function run() {
  try {
    await connectToDatabase();
  } catch (err) {
    console.error('Failed to connect to database:', err.message);
    process.exit(1);
  }

  let deletedTotal = 0;
  for (const email of EMAILS_TO_DELETE) {
    const deletedCount = await deleteUserByEmail(email);
    if (deletedCount > 0) {
      deletedTotal += deletedCount;
      console.log('✅ Deleted', deletedCount, 'user(s) with email:', email);
    }
  }
  if (deletedTotal > 0) {
    console.log('   You can now register again with this email.');
  } else {
    console.log('   No user found with email(s):', EMAILS_TO_DELETE.join(', '));
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('Cleanup script error:', err);
  process.exit(1);
});
