/**
 * Standalone script: set user by email to role "admin".
 * Loads MONGODB_URI from server/.env. Run: node make-admin.js [email]
 * Default email: millerbitoach@gmail.com
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const EMAIL = (process.argv[2] || 'millerbitoach@gmail.com').trim().toLowerCase();
const COLLECTION_NAME = 'users';
const DB_NAME = process.env.MONGODB_DB_NAME || 'insurance-agent';

async function main() {
  const uri = (process.env.MONGODB_URI || '').trim().replace(/^['"]|['"]$/g, '');
  if (!uri) {
    console.error('Error: MONGODB_URI is missing. Set it in server/.env');
    process.exit(1);
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });

  try {
    await client.connect();
    console.log('Connected to MongoDB.');
  } catch (err) {
    console.error('Database connection error:', err.message);
    if (err.code) console.error('Error code:', err.code);
    process.exit(1);
  }

  try {
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    const user = await collection.findOne({ email: EMAIL });
    if (!user) {
      console.error('User not found in the database. Please register this email first.');
      process.exit(1);
    }

    const result = await collection.findOneAndUpdate(
      { email: EMAIL },
      { $set: { role: 'admin' } },
      { returnDocument: 'after' }
    );

    const updated = result;
    if (!updated) {
      console.error('Update failed: user not found after update attempt.');
      process.exit(1);
    }

    console.log('Updated user:', JSON.stringify({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
    }, null, 2));
    console.log('Success: role set to "admin" for', EMAIL);
  } catch (err) {
    console.error('Database error:', err.message);
    if (err.code) console.error('Error code:', err.code);
    process.exit(1);
  } finally {
    await client.close();
    console.log('Connection closed.');
  }

  process.exit(0);
}

main();
