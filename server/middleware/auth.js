import jwt from 'jsonwebtoken';
import { findUserById } from '../models/User.js';
import { ERROR_MESSAGES, ROLES } from '../components/constants.js';
import { connectToDatabase } from '../db/database.js';
import { isAllowedAdminEmail } from '../utils/adminEmails.js';
import { getSupabaseAdmin } from '../db/supabaseClient.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

/**
 * Middleware - אימות טוקן JWT + וידוא שהאימייל מאומת (האתר מחכה לאימות)
 */
export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: ERROR_MESSAGES?.AUTH?.TOKEN_REQUIRED || 'נדרש טוקן גישה' });
  }

  try {
    await connectToDatabase();
    const sb = getSupabaseAdmin();
    const { data: got, error: authErr } = await sb.auth.getUser(token);
    if (!authErr && got?.user) {
      const authUser = got.user;
      const user = await findUserById(authUser.id);
      if (!user) {
        return res.status(403).json({ error: ERROR_MESSAGES?.AUTH?.TOKEN_INVALID || 'טוקן לא תקין או שפג תוקפו' });
      }
      const confirmed = !!authUser.email_confirmed_at;
      if (!confirmed && user.emailVerified === false) {
        return res.status(403).json({
          error: ERROR_MESSAGES?.AUTH?.EMAIL_NOT_VERIFIED || 'נא לאמת את כתובת האימייל',
          code: 'EMAIL_NOT_VERIFIED',
        });
      }
      req.user = { id: user.id, email: user.email, role: user.role };
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await findUserById(decoded.id);
    if (!user) {
      return res.status(403).json({ error: ERROR_MESSAGES?.AUTH?.TOKEN_INVALID || 'טוקן לא תקין או שפג תוקפו' });
    }
    if (user.emailVerified === false) {
      return res.status(403).json({
        error: ERROR_MESSAGES?.AUTH?.EMAIL_NOT_VERIFIED || 'נא לאמת את כתובת האימייל',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }
    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch (err) {
    return res.status(403).json({ error: ERROR_MESSAGES?.AUTH?.TOKEN_INVALID || 'טוקן לא תקין או שפג תוקפו' });
  }
};

/**
 * Middleware - בדיקה שהמשתמש הוא admin והאימייל ברשימת המורשים (ADMIN_ALLOWED_EMAILS / ADMIN_EMAIL)
 */
export const isAdmin = (req, res, next) => {
  if (req.user?.role !== ROLES?.ADMIN) {
    return res.status(403).json({ error: ERROR_MESSAGES?.AUTH?.ADMIN_REQUIRED || 'נדרשת הרשאת מנהל' });
  }
  const userEmail = (req.user?.email || '').trim().toLowerCase();
  if (!isAllowedAdminEmail(userEmail)) {
    return res.status(403).json({ error: ERROR_MESSAGES?.AUTH?.ADMIN_REQUIRED || 'נדרשת הרשאת מנהל' });
  }
  next();
};
