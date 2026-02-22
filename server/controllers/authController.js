import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { findUserByEmail, findUserById, createUser, updateUserById, sanitizeUser } from '../models/User.js';
import { ROLES, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../components/constants.js';
import { sendVerificationCodeEmail } from '../services/email.js';
import { sendVerificationSms } from '../services/sms.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

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
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.FIELDS_REQUIRED });
    }

    let existingUser = null;
    try {
      existingUser = await findUserByEmail(email);
    } catch (err) {
      console.error('[Auth] Registration: findUserByEmail error', err?.message || err);
      return res.status(503).json({ error: ERROR_MESSAGES.SERVER.DB_UNAVAILABLE });
    }
    if (existingUser) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.USER_EXISTS });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
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
      console.error('[Auth] Registration: createUser error', err?.message || err);
      return res.status(503).json({ error: ERROR_MESSAGES.SERVER.DB_UNAVAILABLE });
    }
    console.log('[Auth] Registration: user created', newUser.id, newUser.email);

    let emailSent = false;
    try {
      emailSent = await sendVerificationCodeEmail(newUser.email, newUser.name, verificationCode);
    } catch (emailErr) {
      console.error('[Auth] Registration: verification code email threw:', emailErr?.message || emailErr);
    }
    if (!emailSent) {
      console.warn('[Auth] Registration: verification email was NOT sent to', newUser.email, '- check EMAIL_USER/EMAIL_PASS in server/.env');
    } else {
      console.log('[Auth] Registration: verification email sent to', newUser.email);
    }

    const message = emailSent
      ? SUCCESS_MESSAGES.AUTH.REGISTRATION
      : SUCCESS_MESSAGES.AUTH.REGISTRATION_EMAIL_FAILED;

    return res.status(201).json({
      message,
      emailSent,
      user: sanitizeUser(newUser),
    });
  } catch (error) {
    console.error('[Auth] Registration error:', error?.message || error);
    console.error('[Auth] Registration stack:', error?.stack);
    const isDbError = error?.message && (error.message.includes('MongoDB') || error.message.includes('לא מחובר'));
    const status = isDbError ? 503 : 500;
    const message = isDbError ? ERROR_MESSAGES.SERVER.DB_UNAVAILABLE : ERROR_MESSAGES.SERVER.REGISTRATION;
    return res.status(status).json({ error: message });
  }
};

/**
 * התחברות – משתמשים עם אימייל מאומת (או legacy בלי השדה) יכולים להתחבר
 */
export const login = async (req, res) => {
  try {
    const rawEmail = (req.body.email || '').trim();
    const password = req.body.password;

    if (!rawEmail || !password) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.EMAIL_PASSWORD_REQUIRED });
    }

    const user = await findUserByEmail(rawEmail);
    if (!user) {
      console.log('[Auth] Login failed: user not found for email', rawEmail);
      return res.status(401).json({ error: ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      console.log('[Auth] Login failed: invalid password for', rawEmail);
      return res.status(401).json({ error: ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS });
    }

    // Legacy users (no emailVerified field) are allowed. Only block when explicitly false.
    const isVerified = user.emailVerified !== false;
    if (!isVerified) {
      console.log('[Auth] Login blocked: email not verified for', rawEmail);
      return res.status(403).json({
        error: ERROR_MESSAGES.AUTH.EMAIL_NOT_VERIFIED,
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    console.log('[Auth] Login success for', rawEmail);
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    const userOut = sanitizeUser(user);
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    userOut.isPrimaryAdmin = adminEmail !== '' && (user.email || '').trim().toLowerCase() === adminEmail;
    res.json({
      message: SUCCESS_MESSAGES.AUTH.LOGIN,
      token,
      user: userOut,
    });
  } catch (error) {
    console.error('Login error:', error);
    const isDbError = error?.message && (error.message.includes('MongoDB') || error.message.includes('לא מחובר'));
    const status = isDbError ? 503 : 500;
    const message = isDbError ? ERROR_MESSAGES.SERVER.DB_UNAVAILABLE : ERROR_MESSAGES.SERVER.LOGIN;
    res.status(status).json({ error: message });
  }
};

/**
 * משתמש מחובר (me) – כולל isPrimaryAdmin רק למנהל whose email matches ADMIN_EMAIL
 */
export const getMe = async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: ERROR_MESSAGES.AUTH.USER_NOT_FOUND });
    }
    const out = sanitizeUser(user);
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    out.isPrimaryAdmin = adminEmail !== '' && (user.email || '').trim().toLowerCase() === adminEmail;
    res.json(out);
  } catch (error) {
    console.error('getMe error:', error);
    const isDbError = error?.message && (error.message.includes('MongoDB') || error.message.includes('לא מחובר'));
    res.status(isDbError ? 503 : 500).json({ error: isDbError ? ERROR_MESSAGES.SERVER.DB_UNAVAILABLE : ERROR_MESSAGES.SERVER.LOGIN });
  }
};

/**
 * אימות אימייל לפי קוד 6 ספרות – POST /verify-code
 */
export const verifyCode = async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const code = (req.body.code || '').trim().replace(/\D/g, '').slice(0, 6);

    if (!email || !code || code.length !== 6) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.VERIFICATION_CODE_INVALID });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      console.log('[Auth] Verify code: user not found for', email);
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.VERIFICATION_CODE_INVALID });
    }

    const now = new Date().toISOString();
    const storedCode = (user.emailVerificationCode || '').toString().trim();
    const expires = user.emailVerificationCodeExpires || '';

    if (storedCode !== code) {
      console.log('[Auth] Verify code: code mismatch for', email);
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.VERIFICATION_CODE_INVALID });
    }
    if (expires < now) {
      console.log('[Auth] Verify code: code expired for', email);
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.VERIFICATION_CODE_EXPIRED });
    }

    const updated = await updateUserById(user.id, {
      emailVerified: true,
      emailVerificationCode: null,
      emailVerificationCodeExpires: null,
    });
    if (!updated) {
      console.error('[Auth] Verify code: updateUserById returned null for', user.id);
      return res.status(500).json({ error: ERROR_MESSAGES.AUTH.VERIFICATION_CODE_INVALID });
    }

    console.log('[Auth] Verify code: success for', user.email);
    return res.json({ message: SUCCESS_MESSAGES.AUTH.EMAIL_VERIFIED });
  } catch (error) {
    console.error('[Auth] Verify code error:', error?.message || error);
    const isDbError = error?.message && (error.message.includes('MongoDB') || error.message.includes('לא מחובר'));
    const status = isDbError ? 503 : 500;
    const message = isDbError ? ERROR_MESSAGES.SERVER.DB_UNAVAILABLE : ERROR_MESSAGES.AUTH.VERIFICATION_CODE_INVALID;
    return res.status(status).json({ error: message });
  }
};

/**
 * שליחה חוזרת של אימייל אימות (למשתמש שעדיין לא אימת)
 */
export const resendVerificationEmail = async (req, res) => {
  try {
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
      console.error('Resend verification: email send threw:', emailErr?.message || emailErr);
    }
    const resendFailMessage = 'שליחת האימייל נכשלה (בדוק לוגים בשרת). השתמש באימות דרך הטלפון למטה, או וודא ש-SMTP מוגדר ב-server/.env (ל-Gmail: סיסמאת אפליקציה). בכל מקרה – בדוק דואר זבל (Spam) וכל התיקיות.';
    res.json({
      message: sent ? SUCCESS_MESSAGES.AUTH.VERIFICATION_EMAIL_SENT : resendFailMessage,
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    const isDbError = error?.message && (error.message.includes('MongoDB') || error.message.includes('לא מחובר'));
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
    console.error('Request phone verification error:', error);
    const isDbError = error?.message && (error.message.includes('MongoDB') || error.message.includes('לא מחובר'));
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
    const userOut = sanitizeUser({ ...user, emailVerified: true });
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    userOut.isPrimaryAdmin = adminEmail !== '' && (user.email || '').trim().toLowerCase() === adminEmail;
    res.json({
      message: SUCCESS_MESSAGES.AUTH.PHONE_VERIFIED,
      token,
      user: userOut,
    });
  } catch (error) {
    console.error('Verify phone error:', error);
    const isDbError = error?.message && (error.message.includes('MongoDB') || error.message.includes('לא מחובר'));
    const status = isDbError ? 503 : 500;
    const message = isDbError ? ERROR_MESSAGES.SERVER.DB_UNAVAILABLE : ERROR_MESSAGES.AUTH.PHONE_CODE_INVALID;
    res.status(status).json({ error: message });
  }
};
