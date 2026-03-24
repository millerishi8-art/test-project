import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { findUserByEmail, findUserById, createUser, updateUserById, sanitizeUser, serializeUserForClient } from '../models/User.js';
import { ROLES, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../components/constants.js';
import { sendVerificationCodeEmail, sendPasswordResetCodeEmail } from '../services/email.js';
import { sendVerificationSms } from '../services/sms.js';
import { connectToMongoDB } from '../db/mongodb.js';
import { isSuperAdminEmail } from '../utils/adminEmails.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const isDev = process.env.NODE_ENV !== 'production';

/** הודעת שגיאה כמחרוזת – למניעת .includes על ערך לא-מחרוזתי */
function errorMessageString(err) {
  if (err == null) return '';
  const m = err.message;
  if (typeof m === 'string') return m;
  if (m != null) return String(m);
  try {
    return String(err);
  } catch {
    return '';
  }
}

/** שגיאת תשתית (Mongo / רשת / URI) – להחזיר 503 במקום 500 כשהשירות לא זמין */
function isInfrastructureError(error) {
  const errMsg = errorMessageString(error).toLowerCase();
  const errCode = error?.code;
  if (error?.name === 'MongoServerSelectionError' || error?.name === 'MongoNetworkError') return true;
  if (
    errMsg.includes('mongodb') ||
    errMsg.includes('mongoserver') ||
    errMsg.includes('mongodb_uri') ||
    errMsg.includes('לא מחובר') ||
    errMsg.includes('e11000') ||
    errMsg.includes('duplicate key') ||
    errMsg.includes('getaddrinfo') ||
    errMsg.includes('timeout') ||
    errMsg.includes('server selection timed out')
  ) {
    return true;
  }
  if (errCode === 'ECONNREFUSED' || errCode === 'ETIMEDOUT' || errCode === 'ENOTFOUND') return true;
  return false;
}

/** Log auth error with location, root cause, optional status, and stack in dev */
function logAuthError(location, error, opts = {}) {
  const msg = errorMessageString(error);
  const code = error?.code;
  console.error(`[Backend] ${location}:`, msg, code != null ? `(code: ${code})` : '');
  if (opts.status != null) console.error(`[Backend] ${location} HTTP status:`, opts.status);
  if (opts.payload && Object.keys(opts.payload).length) console.error(`[Backend] ${location} response payload:`, opts.payload);
  if (isDev && error?.stack) console.error(`[Backend] ${location} stack:`, error.stack);
}

/** Mask email for logs: "ab***@domain.com" */
function maskEmail(email) {
  if (!email || typeof email !== 'string') return '***';
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 2) return local[0] + '***' + domain;
  return local.slice(0, 2) + '***' + domain;
}

const signToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });

function generateEmailVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function emailCodeExpiresAt() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 15);
  return d.toISOString();
}

function generatePhoneCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function phoneCodeExpiresAt() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 10);
  return d.toISOString();
}

/**
 * הרשמה – יוצר משתמש, שולח אימייל אימות, לא מחזיר טוקן (חייבים לאמת אימייל ואז להתחבר)
 */
export const register = async (req, res) => {
  try {
    // בVercel, המשתנים לפעמים לא זמינים מיד או שהחיבור ל-DB לא הושלם. נוודא חיבור פה גם.
    await connectToMongoDB();

    if (!ROLES?.USER || !ERROR_MESSAGES?.AUTH?.FIELDS_REQUIRED) {
      console.error('[Backend] Registration: ROLES or ERROR_MESSAGES missing – check server/components/constants.js');
      return res.status(500).json({ error: ERROR_MESSAGES?.SERVER?.REGISTRATION || 'שגיאת שרת בהרשמה' });
    }
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.FIELDS_REQUIRED });
    }

    let existingUser = null;
    try {
      existingUser = await findUserByEmail(email);
    } catch (err) {
      logAuthError('Registration findUserByEmail', err, { status: 503 });
      return res.status(503).json({ error: ERROR_MESSAGES?.SERVER?.DB_UNAVAILABLE || 'מסד הנתונים לא זמין' });
    }
    if (existingUser) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.USER_EXISTS });
    }

    const passwordStr = typeof password === 'string' ? password : String(password || '');
    let hashedPassword;
    try {
      hashedPassword = await bcrypt.hash(passwordStr, 10);
    } catch (hashErr) {
      logAuthError('Registration bcrypt.hash', hashErr, { status: 500 });
      return res.status(500).json({ error: ERROR_MESSAGES?.SERVER?.REGISTRATION || 'שגיאת שרת בהרשמה' });
    }
    if (!hashedPassword || typeof hashedPassword !== 'string' || !hashedPassword.startsWith('$2')) {
      console.error('[Backend] Registration: bcrypt.hash did not return a valid hash – refusing to save');
      return res.status(500).json({ error: ERROR_MESSAGES?.SERVER?.REGISTRATION || 'שגיאת שרת בהרשמה' });
    }
    const verificationCode = generateEmailVerificationCode();
    const newUser = {
      id: uuidv4(),
      name,
      email: (email + '').trim().toLowerCase(),
      phone,
      password: hashedPassword,
      role: ROLES.USER,
      emailVerified: false,
      emailVerificationCode: verificationCode,
      emailVerificationCodeExpires: emailCodeExpiresAt(),
      createdAt: new Date().toISOString(),
    };

    try {
      await createUser(newUser);
    } catch (err) {
      const msg = errorMessageString(err);
      const code = err?.code;
      const isDuplicate = msg.includes('E11000') || msg.includes('duplicate key');
      logAuthError('Registration createUser', err, { status: isDuplicate ? 400 : 503, payload: isDuplicate ? { reason: 'duplicate_key' } : {} });
      if (isDuplicate) {
        return res.status(400).json({ error: ERROR_MESSAGES.AUTH.USER_EXISTS });
      }
      return res.status(503).json({ error: ERROR_MESSAGES?.SERVER?.DB_UNAVAILABLE || 'מסד הנתונים לא זמין' });
    }
    console.log('[Auth] Registration: user created', newUser.id, newUser.email);

    let emailSent = false;
    try {
      emailSent = await sendVerificationCodeEmail(newUser.email, newUser.name, verificationCode);
    } catch (emailErr) {
      logAuthError('Registration sendVerificationCodeEmail', emailErr);
    }
    if (!emailSent) {
      console.warn('[Auth] Registration: verification email was NOT sent to', newUser.email, '- check EMAIL_USER/EMAIL_PASS in server/.env');
    } else {
      console.log('[Auth] Registration: verification email sent to', newUser.email);
    }

    const message = emailSent
      ? (SUCCESS_MESSAGES?.AUTH?.REGISTRATION) || 'ההרשמה בוצעה בהצלחה. נשלח אליך אימייל לאימות.'
      : (SUCCESS_MESSAGES?.AUTH?.REGISTRATION_EMAIL_FAILED) || 'ההרשמה בוצעה בהצלחה, אך שליחת אימייל האימות נכשלה.';

    let userSafe = null;
    try {
      userSafe = sanitizeUser(newUser);
    } catch (sanitizeErr) {
      console.error('[Backend] Registration sanitizeUser:', sanitizeErr?.message || sanitizeErr);
      userSafe = { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role };
    }
    return res.status(201).json({
      message,
      emailSent,
      user: userSafe,
    });
  } catch (error) {
    const errMsg = errorMessageString(error);
    const isDbError = isInfrastructureError(error);
    const status = isDbError ? 503 : 500;
    console.error('[Backend] Registration (outer catch) – root cause of 500:', errMsg);
    if (isDev && error?.stack) console.error('[Backend] Registration stack:', error.stack);
    logAuthError('Registration (outer catch)', error, { status, payload: { reason: isDbError ? 'db_unavailable' : 'unexpected' } });
    const genericMessage = (ERROR_MESSAGES?.SERVER?.REGISTRATION) || 'שגיאת שרת בהרשמה';
    const message = isDbError ? (ERROR_MESSAGES?.SERVER?.DB_UNAVAILABLE ?? genericMessage) : genericMessage;
    try {
      const payload = { error: message };
      if (isDev && !isDbError) payload.debug = errMsg;
      return res.status(status).json(payload);
    } catch (sendErr) {
      console.error('[Backend] Registration: failed to send error response:', sendErr?.message);
      try { res.status(status).json({ error: message }); } catch (_) {}
    }
  }
};

/**
 * התחברות – משתמשים עם אימייל מאומת (או legacy בלי השדה) יכולים להתחבר
 */
export const login = async (req, res) => {
  try {
    // בVercel, המשתנים לפעמים לא זמינים מיד או שהחיבור ל-DB לא הושלם. נוודא חיבור פה גם.
    await connectToMongoDB();
    if (!ERROR_MESSAGES?.AUTH?.EMAIL_PASSWORD_REQUIRED) {
      console.error('[Backend] Login: ERROR_MESSAGES missing – check server/components/constants.js');
      return res.status(500).json({ error: 'שגיאת שרת בהתחברות' });
    }
    const rawEmail = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password;

    if (!rawEmail || !password) {
      return res.status(400).json({ error: ERROR_MESSAGES?.AUTH?.EMAIL_PASSWORD_REQUIRED || 'אימייל וסיסמה חובה' });
    }

    let user;
    try {
      user = await findUserByEmail(rawEmail);
    } catch (dbErr) {
      logAuthError('Login findUserByEmail', dbErr, { status: 503 });
      const msg = (ERROR_MESSAGES?.SERVER?.DB_UNAVAILABLE) || 'מסד הנתונים לא זמין';
      return res.status(503).json({ error: msg });
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Backend] Login: user', user ? 'found' : 'NOT found', '| email:', maskEmail(rawEmail));
    }
    if (!user) {
      console.log('[Backend] Login: user not found, returning 401. email:', maskEmail(rawEmail));
      return res.status(401).json({ error: ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS });
    }

    const plainPassword = typeof password === 'string' ? password : String(password ?? '');
    const storedHash = user.password;
    const hasValidHash = storedHash && typeof storedHash === 'string' && storedHash.startsWith('$2');

    let isValidPassword = false;
    if (hasValidHash && plainPassword.length > 0) {
      try {
        isValidPassword = await bcrypt.compare(plainPassword, storedHash);
      } catch (compareErr) {
        console.error('[Backend] Login bcrypt.compare threw – exact error:', compareErr?.message ?? String(compareErr));
        console.error('[Backend] Login bcrypt.compare stack:', compareErr?.stack);
        logAuthError('Login bcrypt.compare', compareErr, { status: 500 });
        return res.status(500).json({ error: ERROR_MESSAGES?.SERVER?.LOGIN || 'שגיאת שרת בהתחברות' });
      }
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Backend] Login: password field valid?', hasValidHash, '| bcrypt.compare result:', isValidPassword);
    }
    if (!isValidPassword) {
      console.log('[Backend] Login: invalid password, returning 401. email:', maskEmail(rawEmail));
      return res.status(401).json({ error: ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS });
    }

    // Legacy users (no emailVerified field) are allowed. Only block when explicitly false.
    const isVerified = user.emailVerified !== false;
    if (!isVerified) {
      console.log('[Backend] Login: email not verified, returning 403. email:', maskEmail(rawEmail));
      return res.status(403).json({
        error: ERROR_MESSAGES.AUTH.EMAIL_NOT_VERIFIED,
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    console.log('[Backend] Login success for', maskEmail(rawEmail));
    let token;
    let userOut;
    try {
      token = signToken({ id: user.id, email: user.email, role: user.role });
      userOut = serializeUserForClient(user);
    } catch (signErr) {
      logAuthError('Login signToken/sanitizeUser', signErr, { status: 500 });
      return res.status(500).json({ error: ERROR_MESSAGES?.SERVER?.LOGIN || 'שגיאת שרת בהתחברות' });
    }
    if (!userOut) {
      return res.status(500).json({ error: ERROR_MESSAGES?.SERVER?.LOGIN || 'שגיאת שרת בהתחברות' });
    }
    userOut.isPrimaryAdmin = user.role === ROLES.ADMIN && isSuperAdminEmail(user.email);
    res.json({
      message: (SUCCESS_MESSAGES?.AUTH?.LOGIN) || 'ההתחברות בוצעה בהצלחה',
      token,
      user: userOut,
    });
  } catch (error) {
    const errMsg = errorMessageString(error);
    const isDbError = isInfrastructureError(error);
    const status = isDbError ? 503 : 500;
    console.error('[Backend] Login (outer catch) – root cause of 500:', errMsg);
    logAuthError('Login controller', error, {
      status,
      payload: { error: error?.message },
    });
    const genericMessage = (ERROR_MESSAGES?.SERVER?.LOGIN) || 'שגיאת שרת בהתחברות';
    const message = isDbError ? (ERROR_MESSAGES?.SERVER?.DB_UNAVAILABLE ?? genericMessage) : genericMessage;
    const payload = { error: message };
    if (isDev && !isDbError) payload.debug = errMsg;
    res.status(status).json(payload);
  }
};

/**
 * משתמש מחובר (me) – isPrimaryAdmin רק למנהל-העל (ניהול מנהלים אחרים)
 */
export const getMe = async (req, res) => {
  try {
    await connectToMongoDB();
    if (!req.user?.id) {
      return res.status(401).json({ error: ERROR_MESSAGES?.AUTH?.TOKEN_INVALID || 'טוקן לא תקין' });
    }
    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: ERROR_MESSAGES?.AUTH?.USER_NOT_FOUND || 'משתמש לא נמצא' });
    }
    let out = serializeUserForClient(user);
    if (!out) {
      out = { id: String(user.id), name: String(user.name || ''), email: String(user.email || ''), role: String(user.role || 'user') };
    }
    out.isPrimaryAdmin = user.role === ROLES.ADMIN && isSuperAdminEmail(user.email);
    res.json(out);
  } catch (error) {
    const errMsg = errorMessageString(error);
    const isDbError = isInfrastructureError(error);
    const status = isDbError ? 503 : 500;
    console.error('[Backend] getMe – root cause:', errMsg);
    logAuthError('getMe', error, { status });
    const msg = isDbError
      ? (ERROR_MESSAGES?.SERVER?.DB_UNAVAILABLE || 'מסד הנתונים לא זמין')
      : (ERROR_MESSAGES?.SERVER?.LOGIN || 'שגיאת שרת');
    res.status(status).json({ error: msg });
  }
};

/**
 * אימות אימייל לפי קוד 6 ספרות – POST /verify-code
 */
export const verifyCode = async (req, res) => {
  try {
    await connectToMongoDB();
    const email = (req.body.email || '').trim().toLowerCase();
    const code = (req.body.code || '').trim().replace(/\D/g, '').slice(0, 6);

    if (!email || !code || code.length !== 6) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.VERIFICATION_CODE_INVALID });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      console.log('[Backend] Verify code: user not found, returning 400. email:', maskEmail(email));
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.VERIFICATION_CODE_INVALID });
    }

    const now = new Date().toISOString();
    const storedCode = (user.emailVerificationCode || '').toString().trim();
    const expires = user.emailVerificationCodeExpires || '';

    if (storedCode !== code) {
      console.log('[Backend] Verify code: code mismatch, returning 400. email:', maskEmail(email));
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.VERIFICATION_CODE_INVALID });
    }
    if (expires < now) {
      console.log('[Backend] Verify code: code expired, returning 400. email:', maskEmail(email));
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.VERIFICATION_CODE_EXPIRED });
    }

    const updated = await updateUserById(user.id, {
      emailVerified: true,
      emailVerificationCode: null,
      emailVerificationCodeExpires: null,
    });
    if (!updated) {
      console.error('[Backend] Verify code: updateUserById returned null, returning 500. user.id:', user.id);
      return res.status(500).json({ error: ERROR_MESSAGES.AUTH.VERIFICATION_CODE_INVALID });
    }

    console.log('[Backend] Verify code success for', maskEmail(email));
    return res.json({ message: SUCCESS_MESSAGES.AUTH.EMAIL_VERIFIED });
  } catch (error) {
    const isDbError = isInfrastructureError(error);
    const status = isDbError ? 503 : 500;
    logAuthError('Verify code controller', error, { status });
    const message = isDbError ? ERROR_MESSAGES.SERVER.DB_UNAVAILABLE : ERROR_MESSAGES.AUTH.VERIFICATION_CODE_INVALID;
    return res.status(status).json({ error: message });
  }
};

/**
 * שליחה חוזרת של אימייל אימות (למשתמש שעדיין לא אימת)
 */
export const resendVerificationEmail = async (req, res) => {
  try {
    await connectToMongoDB();
    const email = (req.body.email || '').trim();
    if (!email) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.EMAIL_PASSWORD_REQUIRED });
    }
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS });
    }
    if (user.emailVerified) {
      return res.status(400).json({ error: 'האימייל כבר אומת. ניתן להתחבר.' });
    }
    const verificationCode = generateEmailVerificationCode();
    const expires = emailCodeExpiresAt();
    await updateUserById(user.id, {
      emailVerificationCode: verificationCode,
      emailVerificationCodeExpires: expires,
    });
    let sent = false;
    try {
      sent = await sendVerificationCodeEmail(user.email, user.name, verificationCode);
    } catch (emailErr) {
      logAuthError('Resend verification sendVerificationCodeEmail', emailErr);
    }
    const resendFailMessage = 'שליחת האימייל נכשלה (בדוק לוגים בשרת). השתמש באימות דרך הטלפון למטה, או וודא ש-SMTP מוגדר ב-server/.env (ל-Gmail: סיסמאת אפליקציה). בכל מקרה – בדוק דואר זבל (Spam) וכל התיקיות.';
    res.json({
      message: sent ? SUCCESS_MESSAGES.AUTH.VERIFICATION_EMAIL_SENT : resendFailMessage,
    });
  } catch (error) {
    logAuthError('Resend verification controller', error, {
      status: isInfrastructureError(error) ? 503 : 500,
    });
    const isDbError = isInfrastructureError(error);
    const status = isDbError ? 503 : 500;
    const message = isDbError ? ERROR_MESSAGES.SERVER.DB_UNAVAILABLE : ERROR_MESSAGES.SERVER.REGISTRATION;
    res.status(status).json({ error: message });
  }
};

/**
 * בקשת קוד אימות לטלפון – שולח SMS למספר שנרשם אצל המשתמש
 */
export const requestPhoneVerification = async (req, res) => {
  try {
    await connectToMongoDB();
    const email = (req.body.email || '').trim();
    if (!email) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.EMAIL_PASSWORD_REQUIRED });
    }
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS });
    }
    if (user.emailVerified) {
      return res.status(400).json({ error: 'האימייל כבר אומת. ניתן להתחבר.' });
    }
    const phone = (user.phone || '').trim();
    if (!phone) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.PHONE_REQUIRED });
    }
    const code = generatePhoneCode();
    const expires = phoneCodeExpiresAt();
    await updateUserById(user.id, {
      phoneVerificationCode: code,
      phoneVerificationCodeExpires: expires,
    });
    const sent = await sendVerificationSms(phone, code);
    res.json({
      message: sent ? SUCCESS_MESSAGES.AUTH.PHONE_CODE_SENT : 'קוד האימות: ' + code + ' (SMS לא מוגדר – ראה לוג בשרת).',
    });
  } catch (error) {
    logAuthError('Request phone verification controller', error, {
      status: isInfrastructureError(error) ? 503 : 500,
    });
    const isDbError = isInfrastructureError(error);
    const status = isDbError ? 503 : 500;
    const message = isDbError ? ERROR_MESSAGES.SERVER.DB_UNAVAILABLE : ERROR_MESSAGES.SERVER.REGISTRATION;
    res.status(status).json({ error: message });
  }
};

/**
 * אימות קוד SMS – מסמן את המשתמש כמאומת ומחזיר טוקן (התחברות אוטומטית)
 */
export const verifyPhone = async (req, res) => {
  try {
    await connectToMongoDB();
    const email = (req.body.email || '').trim();
    const code = (req.body.code || '').trim();
    if (!email || !code) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.PHONE_CODE_INVALID });
    }
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS });
    }
    const now = new Date().toISOString();
    if (user.phoneVerificationCode !== code || !user.phoneVerificationCodeExpires || user.phoneVerificationCodeExpires < now) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.PHONE_CODE_INVALID });
    }
    await updateUserById(user.id, {
      emailVerified: true,
      phoneVerificationCode: null,
      phoneVerificationCodeExpires: null,
    });
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    const userOut = serializeUserForClient({ ...user, emailVerified: true });
    if (!userOut) {
      return res.status(500).json({ error: ERROR_MESSAGES?.SERVER?.LOGIN || 'שגיאת שרת בהתחברות' });
    }
    userOut.isPrimaryAdmin = user.role === ROLES.ADMIN && isSuperAdminEmail(user.email);
    res.json({
      message: SUCCESS_MESSAGES.AUTH.PHONE_VERIFIED,
      token,
      user: userOut,
    });
  } catch (error) {
    logAuthError('Verify phone controller', error, {
      status: isInfrastructureError(error) ? 503 : 500,
    });
    const isDbError = isInfrastructureError(error);
    const status = isDbError ? 503 : 500;
    const message = isDbError ? ERROR_MESSAGES.SERVER.DB_UNAVAILABLE : ERROR_MESSAGES.AUTH.PHONE_CODE_INVALID;
    res.status(status).json({ error: message });
  }
};

/**
 * בקשת קוד איפוס סיסמה – שולח קוד 6 ספרות למייל (תוקף 15 דקות)
 * מחזיר תמיד הודעה זהה (מטעמי אבטחה) גם אם האימייל לא קיים.
 */
export const requestPasswordReset = async (req, res) => {
  try {
    await connectToMongoDB();
    const email = (req.body.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.EMAIL_PASSWORD_REQUIRED });
    }
    const user = await findUserByEmail(email);
    if (user) {
      const code = generateEmailVerificationCode();
      const expires = emailCodeExpiresAt();
      await updateUserById(user.id, {
        passwordResetCode: code,
        passwordResetCodeExpires: expires,
      });
      const sent = await sendPasswordResetCodeEmail(user.email, user.name, code);
      if (process.env.NODE_ENV !== 'production' && !sent) {
        console.log('[Backend] Password reset code (email not sent):', code);
      }
    }
    const message = SUCCESS_MESSAGES.AUTH.PASSWORD_RESET_SENT || 'אם הכתובת קיימת במערכת, נשלח אליך קוד איפוס סיסמה. בדוק דואר זבל.';
    return res.json({ message });
  } catch (error) {
    logAuthError('Request password reset', error, { status: 500 });
    return res.status(500).json({ error: ERROR_MESSAGES?.SERVER?.LOGIN || 'שגיאת שרת' });
  }
};

/**
 * איפוס סיסמה – אימות קוד והגדרת סיסמה חדשה
 */
export const resetPassword = async (req, res) => {
  try {
    await connectToMongoDB();
    const email = (req.body.email || '').trim().toLowerCase();
    const code = (req.body.code || '').trim().replace(/\D/g, '').slice(0, 6);
    const newPassword = req.body.newPassword;

    if (!email || !code || code.length !== 6) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.PASSWORD_RESET_CODE_INVALID });
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.PASSWORD_REQUIRED });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.PASSWORD_RESET_CODE_INVALID });
    }

    const now = new Date().toISOString();
    const storedCode = (user.passwordResetCode || '').toString().trim();
    const expires = user.passwordResetCodeExpires || '';

    if (storedCode !== code || expires < now) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.PASSWORD_RESET_CODE_INVALID });
    }

    const hashedPassword = await bcrypt.hash(String(newPassword), 10);
    await updateUserById(user.id, {
      password: hashedPassword,
      passwordResetCode: null,
      passwordResetCodeExpires: null,
    });

    const message = SUCCESS_MESSAGES.AUTH.PASSWORD_RESET_SUCCESS || 'הסיסמה עודכנה בהצלחה. התחבר עם הסיסמה החדשה.';
    return res.json({ message });
  } catch (error) {
    logAuthError('Reset password', error, { status: 500 });
    return res.status(500).json({ error: ERROR_MESSAGES?.SERVER?.LOGIN || 'שגיאת שרת' });
  }
};
