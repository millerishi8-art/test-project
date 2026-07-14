/**
 * יוצר/מעדכן משתמש מנהל משנה (רשימת מיילים ב-adminEmails.js או SECONDARY_ADMIN_EMAILS).
 * הרשאות כמו מנהל ראשי למעט מחיקת תיקים.
 *
 * שימוש:
 *   node create-secondary-admin.js <email> <password>
 * דוגמה:
 *   node create-secondary-admin.js abergelyuda7@gmail.com 'Abergel770!'
 */
import './loadEnv.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { connectToDatabase } from './db/database.js';
import { getSupabaseAdmin } from './db/supabaseClient.js';
import { createUser, findUserByEmail, updateUserByEmail } from './models/User.js';
import { ROLES, isUserRoleAdmin } from './components/constants.js';
import {
  isSupabasePasswordAuthEnabled,
  registerAuthUserWithAdminApi,
  updateAuthUserPassword,
  isSupabaseAuthUserExistsError,
} from './services/supabaseAuth.js';
import { getSecondaryAdminEmails, getSuperAdminEmail } from './utils/adminEmails.js';

async function run() {
  try {
    await connectToDatabase();
  } catch (err) {
    console.error('שגיאה בחיבור למסד הנתונים:', err.message);
    process.exit(1);
  }

  const allowed = getSecondaryAdminEmails();
  const superEmail = getSuperAdminEmail();
  const argEmail = (process.argv[2] || '').trim().toLowerCase();
  const targetEmail = argEmail || allowed[0];

  if (!targetEmail) {
    console.error('חסר מייל. עבור: node create-secondary-admin.js <email> <password>');
    process.exit(1);
  }
  if (targetEmail === superEmail) {
    console.error('מייל המנהל הראשי אינו מנהל משנה. השתמש ב-create-admin.js');
    process.exit(1);
  }
  if (!allowed.includes(targetEmail)) {
    console.error(
      `המייל ${targetEmail} לא ברשימת מנהלי המשנה. מורשים כרגע: ${allowed.join(', ')}\n` +
        'הוסף ל־SECONDARY_ADMIN_EMAILS ב-.env או עדכן DEFAULT_SECONDARY_ADMIN_EMAILS ב-adminEmails.js'
    );
    process.exit(1);
  }

  const cliPassword = process.argv[3];
  if (!cliPassword || String(cliPassword).length < 6) {
    console.error('חובה סיסמה כארגומן שני (לפחות 6 תווים).');
    process.exit(1);
  }

  let existingByEmail;
  try {
    existingByEmail = await findUserByEmail(targetEmail);
  } catch (err) {
    console.error('שגיאה בחיפוש משתמש:', err?.message || err);
    process.exit(1);
  }

  if (existingByEmail) {
    if (isUserRoleAdmin(existingByEmail.role)) {
      console.log('משתמש מנהל כבר קיים עם אימייל זה:', existingByEmail.email);
    }
    const updates = {
      role: ROLES.ADMIN,
      email: targetEmail,
      emailVerified: true,
    };
    if (existingByEmail.authProvider === 'supabase') {
      await updateAuthUserPassword(existingByEmail.id, cliPassword);
    } else {
      updates.password = await bcrypt.hash(cliPassword, 10);
    }
    await updateUserByEmail(targetEmail, updates);
    console.log('✅ חשבון מנהל משנה עודכן.');
    console.log('אימייל:', targetEmail);
    console.log('סיסמה: עודכנה לפי הארגומנט (שמור בסוד).');
    process.exit(0);
    return;
  }

  if (isSupabasePasswordAuthEnabled()) {
    let authUser;
    try {
      authUser = await registerAuthUserWithAdminApi({
        email: targetEmail,
        password: cliPassword,
        name: 'מנהל משנה',
        phone: '0500000001',
      });
    } catch (authErr) {
      if (!isSupabaseAuthUserExistsError(authErr)) throw authErr;
      const sb = getSupabaseAdmin();
      const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) throw error;
      const match = (data?.users || []).find(
        (u) => String(u.email || '').trim().toLowerCase() === targetEmail
      );
      if (!match) throw authErr;
      await updateAuthUserPassword(match.id, cliPassword);
      authUser = match;
      console.log('משתמש כבר קיים ב-Supabase Auth – מעדכן סיסמה ויוצר/משחזר פרופיל ב-app_users.');
    }
    const profile = await findUserByEmail(targetEmail);
    if (profile) {
      await updateUserByEmail(targetEmail, {
        role: ROLES.ADMIN,
        email: targetEmail,
        emailVerified: true,
        authProvider: 'supabase',
      });
    } else {
      await createUser({
        id: authUser.id,
        name: 'מנהל משנה',
        email: targetEmail,
        phone: '0500000001',
        role: ROLES.ADMIN,
        emailVerified: true,
        authProvider: 'supabase',
        createdAt: new Date().toISOString(),
      });
    }
  } else {
    const hashedPassword = await bcrypt.hash(cliPassword, 10);
    await createUser({
      id: uuidv4(),
      name: 'מנהל משנה',
      email: targetEmail,
      phone: '0500000001',
      password: hashedPassword,
      role: ROLES.ADMIN,
      emailVerified: true,
      createdAt: new Date().toISOString(),
    });
  }

  console.log('✅ משתמש מנהל משנה נוצר.');
  console.log('אימייל:', targetEmail);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
