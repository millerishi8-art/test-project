import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { findUserByEmail, findUserById, createUser, updateUserById, sanitizeUser, serializeUserForClient } from '../models/User.js';
import { ROLES, ERROR_MESSAGES, SUCCESS_MESSAGES, isUserRoleAdmin, normalizeUserRole } from '../components/constants.js';
import { sendVerificationCodeEmail, sendPasswordResetCodeEmail } from '../services/email.js';
import { sendVerificationSms } from '../services/sms.js';
import { connectToDatabase, dbErrorMessageForClient } from '../db/database.js';
import { isSuperAdminEmail } from '../utils/adminEmails.js';
import { secureCompare } from '../utils/auth.js';
import {
  isSupabasePasswordAuthEnabled,
  registerAuthUserWithAdminApi,
  signInWithPassword,
  updateAuthUserPassword,
  deleteAuthUser,
  isSupabaseAuthUserExistsError,
  canSignInWithSupabasePassword,
} from '../services/supabaseAuth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const isDev = process.env.NODE_ENV !== 'production';

/**
 * מנהל־העל: מסנכרן role + אימייל ב-app_users לפי האימייל מהטוקן/טופס (חשוב כש-data.email ב-DB לא תואם ל-Supabase Auth).
 */
async function ensureSuperAdminRoleInDb(user, loginEmail) {
  if (!user?.id) return user;
  const canonical = String(loginEmail || user.email || '')
    .trim()
    .toLowerCase();
  if (!canonical || !isSuperAdminEmail(canonical)) return user;

  const needRole = !isUserRoleAdmin(user.role);
  const storedEmail = String(user.email || '').trim().toLowerCase();
  const needEmailFix = storedEmail !== canonical;
  if (!needRole && !needEmailFix) return user;

  try {
    const patch = {};
    if (needRole) patch.role = ROLES.ADMIN;
    if (needEmailFix) patch.email = canonical;
    const updated = await updateUserById(user.id, patch);
    return updated || user;
  } catch {
    return user;
  }
}

/** דגל פאנל ניהול בלקוח — תמיד לפי אימייל הכניסה המאומת, לא רק שדה ישן ב-JSON */
function computeIsPrimaryAdmin(role, canonicalEmail) {
  const e = String(canonicalEmail ?? '').trim().toLowerCase();
  return isUserRoleAdmin(role) && isSuperAdminEmail(e);
}

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

/** שגיאת תשתית (DB / רשת) – להחזיר 503 במקום 500 כשהשירות לא זמין */
function isInfrastructureError(error) {
  const errMsg = errorMessageString(error).toLowerCase();
  const errCode = error?.code;
  const codeStr = errCode != null ? String(errCode).toLowerCase() : '';
  if (codeStr === '42p01' || codeStr === '08006' || codeStr === '08001') return true;
  if (
    errMsg.includes('[db]') ||
    errMsg.includes('supabase') ||
    errMsg.includes('pgrst') ||
    errMsg.includes('postgrest') ||
    errMsg.includes('טבלאות חסרות') ||
    errMsg.includes('[supabase]') ||
    errMsg.includes('supabase_schema.sql') ||
    errMsg.includes('relation') ||
    errMsg.includes('schema cache') ||
    errMsg.includes('does not exist') ||
    errMsg.includes('service_role') ||
    errMsg.includes('invalid api key') ||
    errMsg.includes('invalid jwt') ||
    errMsg.includes('מפתח api') ||
    errMsg.includes('חסרים משתני supabase') ||
    errMsg.includes('fetch failed') ||
    errMsg.includes('לא מחובר') ||
    errMsg.includes('e11000') ||
    errMsg.includes('duplicate key') ||
    errMsg.includes('getaddrinfo') ||
    errMsg.includes('timeout') ||
    errMsg.includes('server selection timed out') ||
    errMsg.includes('atlas') ||
    errMsg.includes('ssl') ||
    errMsg.includes('tls') ||
    errMsg.includes('ephemeral') ||
    errMsg.includes('econnreset')
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
    await connectToDatabase();

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
      return res.status(503).json({ error: dbErrorMessageForClient(err) });
    }
    if (existingUser) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.USER_EXISTS });
    }

    if (isSupabasePasswordAuthEnabled()) {
      const passwordStr0 = typeof password === 'string' ? password : String(password || '');
      let authUser;
      try {
        authUser = await registerAuthUserWithAdminApi({
          email: (email + '').trim().toLowerCase(),
          password: passwordStr0,
          name,
          phone,
        });
      } catch (authErr) {
        logAuthError('Registration Supabase admin.createUser', authErr, { status: 400 });
        if (isSupabaseAuthUserExistsError(authErr)) {
          return res.status(400).json({ error: ERROR_MESSAGES.AUTH.USER_EXISTS });
        }
        if (isInfrastructureError(authErr)) {
          return res.status(503).json({ error: dbErrorMessageForClient(authErr) });
        }
        const hint = errorMessageString(authErr);
        return res.status(400).json({
          error: hint || ERROR_MESSAGES?.SERVER?.REGISTRATION || 'שגיאת שרת בהרשמה',
        });
      }
      try {
        await createUser({
          id: authUser.id,
          name,
          email: (email + '').trim().toLowerCase(),
          phone,
          role: ROLES.USER,
          emailVerified: true,
          authProvider: 'supabase',
          createdAt: new Date().toISOString(),
        });
      } catch (dbErr) {
        try {
          await deleteAuthUser(authUser.id);
        } catch (_) {}
        const msg = errorMessageString(dbErr);
        const isDuplicate = msg.includes('duplicate key') || dbErr?.code === '23505';
        logAuthError('Registration createUser (Supabase)', dbErr, {
          status: isDuplicate ? 400 : 503,
        });
        if (isDuplicate) {
          return res.status(400).json({ error: ERROR_MESSAGES.AUTH.USER_EXISTS });
        }
        return res.status(503).json({ error: dbErrorMessageForClient(dbErr) });
      }
      const row = await findUserById(authUser.id);
      let userSafe = null;
      try {
        userSafe = row ? sanitizeUser(row) : null;
      } catch (sanitizeErr) {
        console.error('[Backend] Registration sanitizeUser:', sanitizeErr?.message || sanitizeErr);
        userSafe = row
          ? { id: row.id, name: row.name, email: row.email, role: row.role }
          : null;
      }
      return res.status(201).json({
        message: 'ההרשמה בוצעה בהצלחה. ניתן להתחבר עם האימייל והסיסמה.',
        emailSent: false,
        user: userSafe,
      });
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
      return res.status(503).json({ error: dbErrorMessageForClient(err) });
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
    const message = isDbError ? dbErrorMessageForClient(error) : genericMessage;
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
    await connectToDatabase();
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
      return res.status(503).json({ error: dbErrorMessageForClient(dbErr) });
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Backend] Login: user', user ? 'found' : 'NOT found', '| email:', maskEmail(rawEmail));
    }
    if (!user) {
      console.log('[Backend] Login: user not found, returning 401. email:', maskEmail(rawEmail));
      return res.status(401).json({
        error: ERROR_MESSAGES?.AUTH?.INVALID_CREDENTIALS || 'פרטי התחברות לא תקינים',
      });
    }

    const plainPassword = typeof password === 'string' ? password : String(password ?? '');

    if (user.authProvider === 'supabase') {
      if (!canSignInWithSupabasePassword()) {
        return res.status(503).json({
          error: 'השרת לא מוגדר להתחברות Supabase Auth. הוסף SUPABASE_ANON_KEY ל-server/.env (ו-AUTH_PROVIDER=supabase).',
        });
      }
      try {
        const session = await signInWithPassword({ email: rawEmail, password: plainPassword });
        let u = await findUserById(session.user.id);
        if (!u) {
          return res.status(401).json({
            error: ERROR_MESSAGES?.AUTH?.INVALID_CREDENTIALS || 'פרטי התחברות לא תקינים',
          });
        }
        const confirmed = !!session.user?.email_confirmed_at;
        if (!confirmed && u.emailVerified === false) {
          return res.status(403).json({
            error:
              ERROR_MESSAGES?.AUTH?.EMAIL_NOT_VERIFIED ||
              'נא לאמת את כתובת האימייל לפני ההתחברות.',
            code: 'EMAIL_NOT_VERIFIED',
          });
        }
        const loginCanon = String(session.user?.email || rawEmail || u.email || '')
          .trim()
          .toLowerCase();
        u = await ensureSuperAdminRoleInDb(u, loginCanon);
        const userOut = serializeUserForClient(u);
        if (!userOut) {
          return res.status(500).json({ error: ERROR_MESSAGES?.SERVER?.LOGIN || 'שגיאת שרת בהתחברות' });
        }
        if (loginCanon && computeIsPrimaryAdmin(u.role, loginCanon)) {
          userOut.email = loginCanon;
        }
        userOut.isPrimaryAdmin = computeIsPrimaryAdmin(u.role, loginCanon);
        return res.json({
          message: (SUCCESS_MESSAGES?.AUTH?.LOGIN) || 'ההתחברות בוצעה בהצלחה',
          token: session.access_token,
          user: userOut,
        });
      } catch {
        return res.status(401).json({
          error: ERROR_MESSAGES?.AUTH?.INVALID_CREDENTIALS || 'פרטי התחברות לא תקינים',
        });
      }
    }

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
      return res.status(401).json({
        error: ERROR_MESSAGES?.AUTH?.INVALID_CREDENTIALS || 'פרטי התחברות לא תקינים',
      });
    }

    // Legacy users (no emailVerified field) are allowed. Only block when explicitly false.
    const isVerified = user.emailVerified !== false;
    if (!isVerified) {
      console.log('[Backend] Login: email not verified, returning 403. email:', maskEmail(rawEmail));
      return res.status(403).json({
        error: ERROR_MESSAGES?.AUTH?.EMAIL_NOT_VERIFIED || 'נא לאמת את כתובת האימייל לפני ההתחברות.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    user = await ensureSuperAdminRoleInDb(user, rawEmail);

    console.log('[Backend] Login success for', maskEmail(rawEmail));
    let token;
    let userOut;
    try {
      const emailForJwt =
        typeof user.email === 'string' ? user.email : String(user.email ?? '');
      token = signToken({
        id: user.id != null ? String(user.id) : '',
        email: emailForJwt,
        role: normalizeUserRole(user.role),
      });
      userOut = serializeUserForClient(user);
    } catch (signErr) {
      logAuthError('Login signToken/sanitizeUser', signErr, { status: 500 });
      return res.status(500).json({ error: ERROR_MESSAGES?.SERVER?.LOGIN || 'שגיאת שרת בהתחברות' });
    }
    if (!userOut) {
      return res.status(500).json({ error: ERROR_MESSAGES?.SERVER?.LOGIN || 'שגיאת שרת בהתחברות' });
    }
    const loginCanonBcrypt = String(rawEmail || user.email || '')
      .trim()
      .toLowerCase();
    if (loginCanonBcrypt && computeIsPrimaryAdmin(user.role, loginCanonBcrypt)) {
      userOut.email = loginCanonBcrypt;
    }
    userOut.isPrimaryAdmin = computeIsPrimaryAdmin(user.role, loginCanonBcrypt);
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
    const message = isDbError ? dbErrorMessageForClient(error) : genericMessage;
    const payload = { error: message };
    if (isDev && !isDbError) payload.debug = errMsg;
    res.status(status).json(payload);
  }
};

/**
 * משתמש מחובר (me) – isPrimaryAdmin רק למנהל המערכת היחיד (מייל + role admin)
 */
export const getMe = async (req, res) => {
  try {
    await connectToDatabase();
    if (!req.user?.id) {
      return res.status(401).json({ error: ERROR_MESSAGES?.AUTH?.TOKEN_INVALID || 'טוקן לא תקין' });
    }
    let user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: ERROR_MESSAGES?.AUTH?.USER_NOT_FOUND || 'משתמש לא נמצא' });
    }
    const meCanon = String(req.user?.email || user.email || '')
      .trim()
      .toLowerCase();
    user = await ensureSuperAdminRoleInDb(user, meCanon);
    let out = serializeUserForClient(user);
    if (!out) {
      out = {
        id: String(user.id),
        name: String(user.name || ''),
        email: String(user.email || ''),
        role: normalizeUserRole(user.role),
      };
    }
    if (meCanon && computeIsPrimaryAdmin(user.role, meCanon)) {
      out.email = meCanon;
    }
    out.isPrimaryAdmin = computeIsPrimaryAdmin(user.role, meCanon);
    res.json(out);
  } catch (error) {
    const errMsg = errorMessageString(error);
    const isDbError = isInfrastructureError(error);
    const status = isDbError ? 503 : 500;
    console.error('[Backend] getMe – root cause:', errMsg);
    logAuthError('getMe', error, { status });
    const msg = isDbError
      ? dbErrorMessageForClient(error)
      : (ERROR_MESSAGES?.SERVER?.LOGIN || 'שגיאת שרת');
    res.status(status).json({ error: msg });
  }
};

/**
 * אימות אימייל לפי קוד 6 ספרות – POST /verify-code
 */
export const verifyCode = async (req, res) => {
  try {
    await connectToDatabase();
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

    if (!secureCompare(storedCode, code)) {
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
    const message = isDbError ? dbErrorMessageForClient(error) : ERROR_MESSAGES.AUTH.VERIFICATION_CODE_INVALID;
    return res.status(status).json({ error: message });
  }
};

/**
 * שליחה חוזרת של אימייל אימות (למשתמש שעדיין לא אימת)
 */
export const resendVerificationEmail = async (req, res) => {
  try {
    await connectToDatabase();
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
    const message = isDbError ? dbErrorMessageForClient(error) : ERROR_MESSAGES.SERVER.REGISTRATION;
    res.status(status).json({ error: message });
  }
};

/**
 * בקשת קוד אימות לטלפון – שולח SMS למספר שנרשם אצל המשתמש
 */
export const requestPhoneVerification = async (req, res) => {
  try {
    await connectToDatabase();
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
    const message = isDbError ? dbErrorMessageForClient(error) : ERROR_MESSAGES.SERVER.REGISTRATION;
    res.status(status).json({ error: message });
  }
};

/**
 * אימות קוד SMS – מסמן את המשתמש כמאומת ומחזיר טוקן (התחברות אוטומטית)
 */
export const verifyPhone = async (req, res) => {
  try {
    await connectToDatabase();
    const email = (req.body.email || '').trim().toLowerCase();
    const code = (req.body.code || '').trim();
    if (!email || !code) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.PHONE_CODE_INVALID });
    }
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS });
    }
    const now = new Date().toISOString();
    const storedPhoneCode = (user.phoneVerificationCode || '').toString().trim();
    const providedPhoneCode = (code || '').toString().trim();
    const phoneCodeOk = secureCompare(storedPhoneCode, providedPhoneCode);
    const phoneTimeOk =
      user.phoneVerificationCodeExpires && user.phoneVerificationCodeExpires >= now;
    if (!phoneCodeOk || !phoneTimeOk) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.PHONE_CODE_INVALID });
    }
    await updateUserById(user.id, {
      emailVerified: true,
      phoneVerificationCode: null,
      phoneVerificationCodeExpires: null,
    });
    let refreshed = await findUserById(user.id);
    if (!refreshed) {
      return res.status(500).json({ error: ERROR_MESSAGES?.SERVER?.LOGIN || 'שגיאת שרת בהתחברות' });
    }
    refreshed = await ensureSuperAdminRoleInDb(refreshed, email);
    const token = signToken({
      id: refreshed.id,
      email: refreshed.email,
      role: normalizeUserRole(refreshed.role),
    });
    const userOut = serializeUserForClient({ ...refreshed, emailVerified: true });
    if (!userOut) {
      return res.status(500).json({ error: ERROR_MESSAGES?.SERVER?.LOGIN || 'שגיאת שרת בהתחברות' });
    }
    if (email && computeIsPrimaryAdmin(refreshed.role, email)) {
      userOut.email = email;
    }
    userOut.isPrimaryAdmin = computeIsPrimaryAdmin(refreshed.role, email);
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
    const message = isDbError ? dbErrorMessageForClient(error) : ERROR_MESSAGES.AUTH.PHONE_CODE_INVALID;
    res.status(status).json({ error: message });
  }
};

/**
 * בקשת קוד איפוס סיסמה – שולח קוד 6 ספרות למייל (תוקף 15 דקות)
 * מחזיר תמיד הודעה זהה (מטעמי אבטחה) גם אם האימייל לא קיים.
 */
export const requestPasswordReset = async (req, res) => {
  try {
    await connectToDatabase();
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
    await connectToDatabase();
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

    if (!secureCompare(storedCode, code) || expires < now) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.PASSWORD_RESET_CODE_INVALID });
    }

    if (user.authProvider === 'supabase') {
      if (!canSignInWithSupabasePassword()) {
        return res.status(503).json({
          error:
            'השרת לא מוגדר לעדכון סיסמת Supabase. וודא SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ו-SUPABASE_ANON_KEY.',
        });
      }
      try {
        await updateAuthUserPassword(user.id, String(newPassword));
      } catch (e) {
        logAuthError('Reset password Supabase updateUserById', e, { status: 500 });
        return res.status(500).json({ error: ERROR_MESSAGES?.SERVER?.LOGIN || 'שגיאת שרת' });
      }
      await updateUserById(user.id, {
        passwordResetCode: null,
        passwordResetCodeExpires: null,
      });
    } else {
      const hashedPassword = await bcrypt.hash(String(newPassword), 10);
      await updateUserById(user.id, {
        password: hashedPassword,
        passwordResetCode: null,
        passwordResetCodeExpires: null,
      });
    }

    const message = SUCCESS_MESSAGES.AUTH.PASSWORD_RESET_SUCCESS || 'הסיסמה עודכנה בהצלחה. התחבר עם הסיסמה החדשה.';
    return res.json({ message });
  } catch (error) {
    logAuthError('Reset password', error, { status: 500 });
    return res.status(500).json({ error: ERROR_MESSAGES?.SERVER?.LOGIN || 'שגיאת שרת' });
  }
};
