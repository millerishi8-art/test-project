import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { findUserByEmail, findUserById, createUser, sanitizeUser } from '../models/User.js';
import { ROLES, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../components/constants.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

const signToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });

/**
 * הרשמה
 */
export const register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.FIELDS_REQUIRED });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.USER_EXISTS });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: uuidv4(),
      name,
      email,
      phone,
      password: hashedPassword,
      role: ROLES.USER,
      createdAt: new Date().toISOString(),
    };

    await createUser(newUser);
    const token = signToken({ id: newUser.id, email: newUser.email, role: newUser.role });

    res.status(201).json({
      message: SUCCESS_MESSAGES.AUTH.REGISTRATION,
      token,
      user: sanitizeUser(newUser),
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: ERROR_MESSAGES.SERVER.REGISTRATION });
  }
};

/**
 * התחברות
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
      return res.status(401).json({ error: ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS });
    }

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
    res.status(500).json({ error: ERROR_MESSAGES.SERVER.LOGIN });
  }
};

/**
 * משתמש מחובר (me) – כולל isPrimaryAdmin רק למנהל whose email matches ADMIN_EMAIL
 */
export const getMe = async (req, res) => {
  const user = await findUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: ERROR_MESSAGES.AUTH.USER_NOT_FOUND });
  }
  const out = sanitizeUser(user);
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  out.isPrimaryAdmin = adminEmail !== '' && (user.email || '').trim().toLowerCase() === adminEmail;
  res.json(out);
};
