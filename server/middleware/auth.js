import jwt from 'jsonwebtoken';
import { ERROR_MESSAGES, ROLES } from '../components/constants.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

/**
 * Middleware - אימות טוקן JWT
 */
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: ERROR_MESSAGES.AUTH.TOKEN_REQUIRED });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: ERROR_MESSAGES.AUTH.TOKEN_INVALID });
    }
    req.user = user;
    next();
  });
};

/** אימייל האדמין היחיד שיש לו גישה לפאנל – מסונכרן עם create-admin */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'millerbitoach@gmail.com';

/**
 * Middleware - בדיקה שהמשתמש הוא admin והאימייל הוא של האדמין המורשה בלבד
 */
export const isAdmin = (req, res, next) => {
  if (req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({ error: ERROR_MESSAGES.AUTH.ADMIN_REQUIRED });
  }
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: ERROR_MESSAGES.AUTH.ADMIN_REQUIRED });
  }
  next();
};
