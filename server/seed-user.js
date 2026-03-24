/**
 * Seed (or fix) test user: millerbitoach@gmail.com / Noam5770
 * Run from project root: node server/seed-user.js
 * Creates the user with a correctly bcrypt-hashed password if missing,
 * or updates password and emailVerified if the user already exists.
 */
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { connectToMongoDB } from './db/mongodb.js';
import { createUser, findUserByEmail, updateUserById } from './models/User.js';
import { ROLES } from './components/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const SEED_EMAIL = 'millerbitoach@gmail.com';
const SEED_PASSWORD = 'Noam5770';

async function run() {
  try {
    await connectToMongoDB();
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 10);
  let existing;
  try {
    existing = await findUserByEmail(SEED_EMAIL);
  } catch (err) {
    console.error('Failed to look up user:', err?.message || err);
    process.exit(1);
  }

  if (existing) {
    const updated = await updateUserById(existing.id, {
      password: hashedPassword,
      emailVerified: true,
    });
    if (updated) {
      console.log('✅ Seed user updated successfully.');
      console.log('   Email:', SEED_EMAIL);
      console.log('   Password:', SEED_PASSWORD);
      console.log('   emailVerified set to true. You can log in now.');
    } else {
      console.error('❌ Failed to update user (updateUserById returned null).');
      process.exit(1);
    }
  } else {
    const newUser = {
      id: uuidv4(),
      name: 'מנהל מערכת',
      email: SEED_EMAIL.toLowerCase(),
      phone: '0500000000',
      password: hashedPassword,
      role: ROLES.ADMIN,
      emailVerified: true,
      createdAt: new Date().toISOString(),
    };
    await createUser(newUser);
    console.log('✅ Seed user created successfully.');
    console.log('   Email:', SEED_EMAIL);
    console.log('   Password:', SEED_PASSWORD);
    console.log('   You can log in now.');
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('Seed script error:', err);
  process.exit(1);
});
