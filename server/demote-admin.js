/**
 * מסיר הרשאות מנהל ממשתמש (role → user).
 * שימוש: node demote-admin.js <email>
 */
import './loadEnv.js';
import { connectToDatabase } from './db/database.js';
import { findUserByEmail, updateUserByEmail } from './models/User.js';
import { ROLES, isUserRoleAdmin } from './components/constants.js';
import { isSuperAdminEmail } from './utils/adminEmails.js';

async function run() {
  try {
    await connectToDatabase();
  } catch (err) {
    console.error('שגיאה בחיבור למסד הנתונים:', err.message);
    process.exit(1);
  }

  const targetEmail = (process.argv[2] || '').trim().toLowerCase();
  if (!targetEmail) {
    console.error('חסר מייל. שימוש: node demote-admin.js <email>');
    process.exit(1);
  }
  if (isSuperAdminEmail(targetEmail)) {
    console.error('לא ניתן להסיר הרשאות ממנהל-העל.');
    process.exit(1);
  }

  const user = await findUserByEmail(targetEmail);
  if (!user) {
    console.log('לא נמצא משתמש עם האימייל:', targetEmail, '— אין מה להסיר.');
    process.exit(0);
  }

  if (!isUserRoleAdmin(user.role)) {
    console.log('המשתמש כבר אינו מנהל:', targetEmail);
    process.exit(0);
  }

  const updated = await updateUserByEmail(targetEmail, { role: ROLES.USER });
  if (!updated) {
    console.error('העדכון נכשל עבור:', targetEmail);
    process.exit(1);
  }
  if (isUserRoleAdmin(updated.role)) {
    console.error('התפקיד עדיין admin אחרי העדכון. בדוק אם יש עמודת role שטוחה במסד.');
    process.exit(1);
  }
  console.log('✅ הוסרו הרשאות מנהל מ:', targetEmail, '| role כעת:', updated.role);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
