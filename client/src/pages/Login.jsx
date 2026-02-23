import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

function logAuthError(location, err) {
  console.error('[Frontend]', location, ':', err?.message || String(err));
  if (err?.response?.status != null) console.error('[Frontend]', location, 'HTTP status:', err.response.status);
  if (err?.response?.data) console.error('[Frontend]', location, 'server payload:', err.response.data);
  if (import.meta.env.DEV && err?.stack) console.error('[Frontend]', location, 'stack:', err.stack);
}

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [phoneStep, setPhoneStep] = useState(null);
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneSendLoading, setPhoneSendLoading] = useState(false);
  const [phoneVerifyLoading, setPhoneVerifyLoading] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState('');
  const [loginErrorCode, setLoginErrorCode] = useState(null);
  const [emailCode, setEmailCode] = useState('');
  const [emailVerifyLoading, setEmailVerifyLoading] = useState(false);
  const [emailVerifySuccess, setEmailVerifySuccess] = useState('');
  const { login, requireEmailVerification, applySession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const showVerificationOptions = requireEmailVerification || (error && error.includes('לאמת')) || loginErrorCode === 'EMAIL_NOT_VERIFIED';
  const showEmailVerifyBlock = showVerificationOptions;

  useEffect(() => {
    const msg = location.state?.message;
    if (msg) setResendMessage(msg);
  }, [location.state?.message]);


  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
    setLoginErrorCode(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResendMessage('');
    setLoginErrorCode(null);
    setLoading(true);

    const result = await login(formData.email, formData.password);

    if (result.success) {
      navigate('/');
      setLoading(false);
      return;
    }
    if (result.code === 'EMAIL_NOT_VERIFIED') {
      navigate('/verify-email', { state: { email: formData.email.trim(), fromLogin: true } });
      setLoading(false);
      return;
    }
    setError(result.error || 'ההתחברות נכשלה.');
    setLoginErrorCode(result.code || null);
    setLoading(false);
  };

  const handleResendVerification = async () => {
    const email = (formData.email || '').trim();
    if (!email) {
      setError('הזן אימייל כדי לשלוח שוב אימייל אימות');
      return;
    }
    setResendLoading(true);
    setError('');
    setResendMessage('');
    setPhoneMessage('');
    try {
      const res = await axios.post('/resend-verification', { email });
      setResendMessage(res.data?.message || 'נשלח שוב אימייל אימות.');
    } catch (err) {
      logAuthError('Login resend verification', err);
      setError(err.response?.data?.error || 'שליחה חוזרת נכשלה.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleRequestPhoneCode = async () => {
    const email = (formData.email || '').trim();
    if (!email) {
      setError('הזן אימייל כדי לשלוח קוד לטלפון');
      return;
    }
    setPhoneSendLoading(true);
    setError('');
    setResendMessage('');
    setPhoneMessage('');
    try {
      const res = await axios.post('/request-phone-verification', { email });
      setPhoneMessage(res.data?.message || 'נשלח קוד למספר שנרשם.');
      setPhoneStep('sent');
      setPhoneCode('');
    } catch (err) {
      logAuthError('Login request phone verification', err);
      setError(err.response?.data?.error || 'שליחת קוד נכשלה.');
    } finally {
      setPhoneSendLoading(false);
    }
  };

  const handleVerifyPhoneCode = async (e) => {
    e.preventDefault();
    const email = (formData.email || '').trim();
    const code = (phoneCode || '').trim();
    if (!email || !code) {
      setError('הזן את הקוד שנשלח לטלפון');
      return;
    }
    setPhoneVerifyLoading(true);
    setError('');
    setPhoneMessage('');
    try {
      const res = await axios.post('/verify-phone', { email, code });
      applySession(res.data.token, res.data.user);
      navigate('/');
    } catch (err) {
      logAuthError('Login verify phone code', err);
      setError(err.response?.data?.error || 'קוד לא תקף או שפג תוקפו.');
    } finally {
      setPhoneVerifyLoading(false);
    }
  };

  const handleVerifyEmailCode = async (e) => {
    e.preventDefault();
    const email = (formData.email || '').trim();
    const code = (emailCode || '').replace(/\D/g, '').slice(0, 6);
    if (!email) {
      setError('הזן אימייל בשדה למעלה');
      return;
    }
    if (code.length !== 6) {
      setError('הקוד חייב להכיל 6 ספרות');
      return;
    }
    setEmailVerifyLoading(true);
    setError('');
    setEmailVerifySuccess('');
    try {
      const res = await axios.post('/verify-code', { email, code });
      setEmailVerifySuccess(res.data?.message || 'האימייל אומת בהצלחה. כעת ניתן להתחבר.');
      setEmailCode('');
      setLoginErrorCode(null);
    } catch (err) {
      logAuthError('Login verify email code', err);
      setError(err.response?.data?.error || 'הקוד לא תקף או שפג תוקפו.');
    } finally {
      setEmailVerifyLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>התחברות</h2>
          {requireEmailVerification && (
            <div className="verify-required-notice">
              הזן את קוד האימות בן 6 הספרות שנשלח לאימייל שלך (או אמת דרך הטלפון למטה).
            </div>
          )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>אימייל</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>סיסמה</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="password-input"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword((s) => !s)}
                title={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
              >
                {showPassword ? (
                  <span className="password-icon" aria-hidden>🙈</span>
                ) : (
                  <span className="password-icon" aria-hidden>👁</span>
                )}
              </button>
            </div>
          </div>
          {resendMessage && (
            <>
              <div className="success-message">{resendMessage}</div>
              <div className="check-spam-tip">
                💡 אם אינך מוצא את האימייל – בדוק בתיקיית <strong>דואר זבל (Spam/Junk)</strong> ובכל תיקיות תיבת הדואר.
              </div>
            </>
          )}
          {phoneMessage && <div className="success-message">{phoneMessage}</div>}
          {emailVerifySuccess && <div className="success-message">{emailVerifySuccess}</div>}
          {error && (
            <div className={loginErrorCode === 'EMAIL_NOT_VERIFIED' ? 'error-message error-message-verify' : 'error-message'}>
              {error}
            </div>
          )}
          {showEmailVerifyBlock && (
            <div className="verification-options verification-options-always">
              <p className="verification-intro">הזן את קוד האימות בן 6 הספרות שנשלח לאימייל שלך:</p>
              <form onSubmit={handleVerifyEmailCode} className="email-verify-code-form">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="phone-code-input email-code-input"
                  aria-label="קוד אימות 6 ספרות"
                />
                <button
                  type="submit"
                  className="resend-verification-btn"
                  disabled={emailVerifyLoading || emailCode.length !== 6}
                >
                  {emailVerifyLoading ? 'בודק...' : 'אמת קוד'}
                </button>
              </form>
              <p className="verification-or">לא קיבלת קוד? שליחת קוד חדש למייל:</p>
              <button
                type="button"
                className="resend-verification-btn resend-secondary"
                onClick={handleResendVerification}
                disabled={resendLoading}
              >
                {resendLoading ? 'שולח...' : 'שלח שוב אימייל אימות'}
              </button>
              <p className="verification-or">או אימות דרך הטלפון:</p>
              {!phoneStep ? (
                <button
                  type="button"
                  className="resend-verification-btn phone-btn"
                  onClick={handleRequestPhoneCode}
                  disabled={phoneSendLoading}
                >
                  {phoneSendLoading ? 'שולח...' : 'שלח קוד SMS למספר שנרשם'}
                </button>
              ) : (
                <form onSubmit={handleVerifyPhoneCode} className="phone-verify-form">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="הזן קוד 6 ספרות"
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="phone-code-input"
                  />
                  <button
                    type="submit"
                    className="resend-verification-btn phone-btn"
                    disabled={phoneVerifyLoading || phoneCode.length !== 6}
                  >
                    {phoneVerifyLoading ? 'מאמת...' : 'אמת והתחבר'}
                  </button>
                </form>
              )}
            </div>
          )}
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'מתחבר...' : 'התחבר'}
          </button>
        </form>
        <p className="auth-link">
          אין לך חשבון? <Link to="/register">הירשם כאן</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
