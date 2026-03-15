import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// בפיתוח: /api עובר דרך ה-proxy של Vite (vite.config.js) ל-backend. ב-production: /api על אותו דומיין (Vercel).
const getApiUrl = () => {
  const url = import.meta.env.VITE_API_URL || '/api';
  return url.replace(/\/+$/, '');
};

const API_URL = getApiUrl();
const isDev = import.meta.env.DEV;

/** Log auth error with location, server payload, status, and optional stack in dev */
function logAuthError(location, error, opts = {}) {
  const status = error.response?.status;
  const data = error.response?.data;
  console.error(`[Frontend] ${location}:`, error?.message || String(error));
  if (status != null) console.error(`[Frontend] ${location} HTTP status:`, status);
  if (data && typeof data === 'object') {
    console.error(`[Frontend] ${location} server payload:`, { error: data.error, code: data.code, message: data.message });
  }
  if (isDev && error?.stack) console.error(`[Frontend] ${location} stack:`, error.stack);
}

axios.defaults.baseURL = API_URL;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [requireEmailVerification, setRequireEmailVerification] = useState(false);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await axios.get('/me');
      setUser(response.data);
      setRequireEmailVerification(false);
    } catch (error) {
      logAuthError('fetchUser /me', error);
      const code = error.response?.data?.code;
      const isEmailNotVerified = code === 'EMAIL_NOT_VERIFIED';
      if (isEmailNotVerified) {
        setRequireEmailVerification(true);
      }
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post('/login', { email, password });
      const { token: newToken, user: userData } = response.data;
      setRequireEmailVerification(false);
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('token', newToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      return { success: true };
    } catch (error) {
      logAuthError('Login request failed', error);
      const data = error.response?.data;
      const message = data?.error || 'Login failed';
      const debugMsg = data?.debug;
      const code = data?.code;
      return {
        success: false,
        error: debugMsg ? `${message}: ${debugMsg}` : message,
        code: code || null,
      };
    }
  };

  const register = async (name, email, phone, password) => {
    try {
      const response = await axios.post('/register', {
        name,
        email,
        phone,
        password
      });
      const { message, emailSent } = response.data;
      return {
        success: true,
        message: message || (emailSent ? 'נשלח קוד אימות לאימייל.' : 'הרשמה בוצעה. שליחת הקוד נכשלה – השתמש ב"שלח שוב אימייל אימות" בדף ההתחברות.'),
        emailSent: !!emailSent,
      };
    } catch (error) {
      logAuthError('Register request failed', error);
      const data = error.response?.data;
      const serverError = (data && typeof data === 'object' && data.error) || 'Registration failed';
      const debugMsg = data && typeof data === 'object' ? data.debug : undefined;
      if (data && typeof data === 'object') {
        console.error('[Frontend] Register server response:', data);
      }
      return {
        success: false,
        error: debugMsg ? `${serverError}: ${debugMsg}` : serverError
      };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
  };

  const applySession = (newToken, userData) => {
    setRequireEmailVerification(false);
    setToken(newToken);
    setUser(userData);
    localStorage.setItem('token', newToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    applySession,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    requireEmailVerification,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
