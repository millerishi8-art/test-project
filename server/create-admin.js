import './loadEnv.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { connectToMongoDB } from './db/mongodb.js';
import { createUser, findUserByEmail, updateUserByEmail } from './models/User.js';
import { ROLES } from './components/constants.js';
import {
  isSupabasePasswordAuthEnabled,
  registerAuthUserWithAdminApi,
  updateAuthUserPassword,
} from './services/supabaseAuth.js';

async function run() {
  try {
    await connectToMongoDB();
  } catch (err) {
    console.error('שגיאה בחיבור למסד הנתונים:', err.message);
    process.exit(1);
  }

  const adminEmailRaw = process.argv[2] || process.env.ADMIN_EMAIL || 'millerbitoach@gmail.com';
  const adminEmail = adminEmailRaw.trim().toLowerCase();
  const cliPassword = process.argv[3];

  let existingByEmail;
  try {
    existingByEmail = await findUserByEmail(adminEmail);
  } catch (err) {
    console.error('שגיאה בחיפוש משתמש:', err?.message || err);
    process.exit(1);
  }
  if (existingByEmail) {
    if (existingByEmail.role === ROLES.ADMIN) {
      console.log('משתמש מנהל כבר קיים עם אימייל זה:', existingByEmail.email);
      console.log('אימייל:', adminEmail);
      process.exit(0);
      return;
    }
    const updates = {
      role: ROLES.ADMIN,
      email: adminEmail,
      emailVerified: true,
    };
    if (cliPassword) {
      if (existingByEmail.authProvider === 'supabase') {
        await updateAuthUserPassword(existingByEmail.id, cliPassword);
      } else {
        updates.password = await bcrypt.hash(cliPassword, 10);
      }
    }
    await updateUserByEmail(adminEmail, updates);
    console.log('✅ חשבון קיים עודכן למנהל בהצלחה!');
    console.log('אימייל:', adminEmail);
    if (cliPassword) {
      console.log('סיסמה: עודכנה לפי הארגומנט בשורת הפקודה.');
      console.log('\n⚠️  חשוב לשנות את הסיסמה לאחר ההתחברות הראשונה!');
    } else {
      console.log('הסיסמה הקיימת במסד לא שונתה – התחבר עם הסיסמה שכבר הייתה לחשבון.');
    }
    process.exit(0);
    return;
  }

  const adminPassword = cliPassword || process.env.ADMIN_PASSWORD || 'admin123';

  if (isSupabasePasswordAuthEnabled()) {
    const authUser = await registerAuthUserWithAdminApi({
      email: adminEmail,
      password: adminPassword,
      name: 'מנהל מערכת',
      phone: '0500000000',
    });
    await createUser({
      id: authUser.id,
      name: 'מנהל מערכת',
      email: adminEmail,
      phone: '0500000000',
      role: ROLES.ADMIN,
      emailVerified: true,
      authProvider: 'supabase',
      createdAt: new Date().toISOString(),
    });
  } else {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const admin = {
      id: uuidv4(),
      name: 'מנהל מערכת',
      email: adminEmail,
      phone: '0500000000',
      password: hashedPassword,
      role: ROLES.ADMIN,
      emailVerified: true,
      createdAt: new Date().toISOString(),
    };
    await createUser(admin);
  }

  console.log('✅ משתמש מנהל נוצר בהצלחה!');
  console.log('אימייל:', adminEmail);
  console.log('סיסמה:', adminPassword);
  console.log('\n⚠️  חשוב לשנות את הסיסמה לאחר ההתחברות הראשונה!');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
