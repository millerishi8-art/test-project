import jwt from 'jsonwebtoken';
import { findUserById } from '../models/User.js';
import { ERROR_MESSAGES, ROLES, isUserRoleAdmin } from '../components/constants.js';
import { connectToDatabase } from '../db/database.js';
import { isSuperAdminEmail } from '../utils/adminEmails.js';
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
      const profileEmail = String(user.email || '').trim().toLowerCase();
      const authEmail = String(authUser.email || '').trim().toLowerCase();
      req.user = {
        id: user.id,
        email: authEmail || profileEmail,
        role: user.role,
      };
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
    const jwtEmail = String(decoded.email || '').trim().toLowerCase();
    const profileEmail = String(user.email || '').trim().toLowerCase();
    req.user = { id: user.id, email: jwtEmail || profileEmail, role: user.role };
    next();
  } catch (err) {
    return res.status(403).json({ error: ERROR_MESSAGES?.AUTH?.TOKEN_INVALID || 'טוקן לא תקין או שפג תוקפו' });
  }
};

/**
 * Middleware — גישה ל־/admin רק למנהל־העל (מייל יחיד מ־SUPER_ADMIN_EMAIL / ADMIN_EMAIL).
 */
export const isAdmin = (req, res, next) => {
  if (!isUserRoleAdmin(req.user?.role)) {
    return res.status(403).json({ error: ERROR_MESSAGES?.AUTH?.ADMIN_REQUIRED || 'נדרשת הרשאת מנהל מערכת' });
  }
  const userEmail = (req.user?.email || '').trim().toLowerCase();
  if (!isSuperAdminEmail(userEmail)) {
    return res.status(403).json({ error: ERROR_MESSAGES?.AUTH?.ADMIN_REQUIRED || 'נדרשת הרשאת מנהל מערכת' });
  }
  next();
};
