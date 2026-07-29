/**
 * משתמש מנהל ראשי: ברירת מחדל millerbitoach@gmail.com + סיסמה מ-ADMIN_PASSWORD (או admin123).
 * הרצה מתוך server: node seed-user.js
 * - מעדכן role=admin, emailVerified, וסיסמה (ב-app_users וב-Supabase Auth כש-relevant).
 * - מחפש גם aliases חלופיים כדי לא לכפות הרשמה מחדש.
 */
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { connectToDatabase } from './db/database.js';
import { createUser, findUserByEmail, updateUserById } from './models/User.js';
import { ROLES } from './components/constants.js';
import { DEFAULT_PRIMARY_ADMIN_EMAIL, getSuperAdminEmailAliases } from './utils/adminEmails.js';
import {
  isSupabasePasswordAuthEnabled,
  registerAuthUserWithAdminApi,
  updateAuthUserPassword,
} from './services/supabaseAuth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const SEED_EMAIL = DEFAULT_PRIMARY_ADMIN_EMAIL;
const SEED_PASSWORD = String(process.env.ADMIN_PASSWORD || 'admin123').trim() || 'admin123';

async function run() {
  try {
    await connectToDatabase();
  } catch (err) {
    console.error('Failed to connect to database:', err.message);
    process.exit(1);
  }

  let existing;
  try {
    for (const email of getSuperAdminEmailAliases()) {
      existing = await findUserByEmail(email);
      if (existing) break;
    }
  } catch (err) {
    console.error('Failed to look up user:', err?.message || err);
    process.exit(1);
  }

  if (existing) {
    try {
      if (existing.authProvider === 'supabase' && isSupabasePasswordAuthEnabled()) {
        await updateAuthUserPassword(existing.id, SEED_PASSWORD);
        const updated = await updateUserById(existing.id, {
          emailVerified: true,
          role: ROLES.ADMIN,
        });
        if (!updated) throw new Error('updateUserById returned null');
      } else {
        const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 10);
        const updated = await updateUserById(existing.id, {
          password: hashedPassword,
          emailVerified: true,
          role: ROLES.ADMIN,
        });
        if (!updated) throw new Error('updateUserById returned null');
      }
      console.log('✅ משתמש מנהל עודכן.');
      console.log('   אימייל:', existing.email || SEED_EMAIL);
      console.log('   סיסמה:', SEED_PASSWORD);
      console.log('   role: admin — גישה לפאנל הניהולי ולפעולות מנהל באתר.');
      console.log('   (חשבון קיים – אין צורך בהרשמה מחדש)');
    } catch (e) {
      console.error('❌ עדכון נכשל:', e?.message || e);
      process.exit(1);
    }
    process.exit(0);
    return;
  }

  try {
    if (isSupabasePasswordAuthEnabled()) {
      const authUser = await registerAuthUserWithAdminApi({
        email: SEED_EMAIL.toLowerCase(),
        password: SEED_PASSWORD,
        name: 'מנהל מערכת',
        phone: '0500000000',
      });
      await createUser({
        id: authUser.id,
        name: 'מנהל מערכת',
        email: SEED_EMAIL.toLowerCase(),
        phone: '0500000000',
        role: ROLES.ADMIN,
        emailVerified: true,
        authProvider: 'supabase',
        createdAt: new Date().toISOString(),
      });
    } else {
      const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 10);
      await createUser({
        id: uuidv4(),
        name: 'מנהל מערכת',
        email: SEED_EMAIL.toLowerCase(),
        phone: '0500000000',
        password: hashedPassword,
        role: ROLES.ADMIN,
        emailVerified: true,
        createdAt: new Date().toISOString(),
      });
    }
    console.log('✅ משתמש מנהל נוצר.');
    console.log('   אימייל:', SEED_EMAIL);
    console.log('   סיסמה:', SEED_PASSWORD);
    console.log('   role: admin — גישה לפאנל הניהולי ולפעולות מנהל באתר.');
  } catch (err) {
    console.error('❌ יצירת משתמש נכשלה:', err?.message || err);
    process.exit(1);
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('Seed script error:', err);
  process.exit(1);
});
