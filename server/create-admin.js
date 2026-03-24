import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { connectToMongoDB } from './db/mongodb.js';
import { createUser, findUserByEmail, updateUserByEmail } from './models/User.js';
import { ROLES } from './components/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

async function run() {
  try {
    await connectToMongoDB();
  } catch (err) {
    console.error('שגיאה בחיבור ל-MongoDB:', err.message);
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
      updates.password = await bcrypt.hash(cliPassword, 10);
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
