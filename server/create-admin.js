import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { connectToMongoDB } from './db/mongodb.js';
import { readUsers, createUser, findUserByEmail, updateUserByEmail } from './models/User.js';
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
  const adminPassword = process.argv[3] || 'admin123';

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const existingByEmail = await findUserByEmail(adminEmail);
  if (existingByEmail) {
    if (existingByEmail.role === ROLES.ADMIN) {
      console.log('משתמש מנהל כבר קיים עם אימייל זה:', existingByEmail.email);
      console.log('אימייל:', adminEmail);
      console.log('סיסמה:', adminPassword);
      process.exit(0);
      return;
    }
    await updateUserByEmail(adminEmail, { role: ROLES.ADMIN, password: hashedPassword, email: adminEmail });
    console.log('✅ חשבון קיים עודכן למנהל בהצלחה!');
    console.log('אימייל:', adminEmail);
    console.log('סיסמה:', adminPassword);
    console.log('\n⚠️  חשוב לשנות את הסיסמה לאחר ההתחברות הראשונה!');
    process.exit(0);
    return;
  }

  const users = await readUsers();
  const existingAdmin = users.find((u) => u.role === ROLES.ADMIN);
  if (existingAdmin) {
    console.log('משתמש מנהל כבר קיים (אימייל אחר):', existingAdmin.email);
    process.exit(0);
    return;
  }

  const admin = {
    id: uuidv4(),
    name: 'מנהל מערכת',
    email: adminEmail,
    phone: '0500000000',
    password: hashedPassword,
    role: ROLES.ADMIN,
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
