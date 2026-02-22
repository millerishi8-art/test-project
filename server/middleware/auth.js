import jwt from 'jsonwebtoken';
import { findUserById } from '../models/User.js';
import { ERROR_MESSAGES, ROLES } from '../components/constants.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

/**
 * Middleware - אימות טוקן JWT + וידוא שהאימייל מאומת (האתר מחכה לאימות)
 */
export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: ERROR_MESSAGES.AUTH.TOKEN_REQUIRED });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await findUserById(decoded.id);
    if (!user) {
      return res.status(403).json({ error: ERROR_MESSAGES.AUTH.TOKEN_INVALID });
    }
    if (user.emailVerified === false) {
      return res.status(403).json({
        error: ERROR_MESSAGES.AUTH.EMAIL_NOT_VERIFIED,
        code: 'EMAIL_NOT_VERIFIED',
      });
    }
    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch (err) {
    return res.status(403).json({ error: ERROR_MESSAGES.AUTH.TOKEN_INVALID });
  }
};

/** אימייל האדמין היחיד שיש לו גישה לפאנל – מסונכרן עם create-admin (השוואה לא רגישה לאותיות) */
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'millerbitoach@gmail.com').trim().toLowerCase();

/**
 * Middleware - בדיקה שהמשתמש הוא admin והאימייל הוא של האדמין המורשה בלבד
 */
export const isAdmin = (req, res, next) => {
  if (req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({ error: ERROR_MESSAGES.AUTH.ADMIN_REQUIRED });
  }
  const userEmail = (req.user.email || '').trim().toLowerCase();
  if (userEmail !== ADMIN_EMAIL) {
    return res.status(403).json({ error: ERROR_MESSAGES.AUTH.ADMIN_REQUIRED });
  }
  next();
};
