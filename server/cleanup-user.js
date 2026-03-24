/**
 * Delete user(s) with email millerbitoach@gmail.com from MongoDB.
 * Run from project root: node server/cleanup-user.js
 * Use this to remove the test user so you can register again with a fresh bcrypt-hashed password.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectToMongoDB } from './db/mongodb.js';
import { deleteUserByEmail } from './models/User.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const EMAIL_TO_DELETE = 'millerbitoach@gmail.com';

async function run() {
  try {
    await connectToMongoDB();
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }

  const deletedCount = await deleteUserByEmail(EMAIL_TO_DELETE);
  if (deletedCount > 0) {
    console.log('✅ Deleted', deletedCount, 'user(s) with email:', EMAIL_TO_DELETE);
    console.log('   You can now register again with this email.');
  } else {
    console.log('   No user found with email:', EMAIL_TO_DELETE);
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('Cleanup script error:', err);
  process.exit(1);
});
