import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import './Auth.css';

function logAuthError(location, err) {
  console.error('[Frontend]', location, ':', err?.message || String(err));
  if (err?.response?.status != null) console.error('[Frontend]', location, 'HTTP status:', err.response.status);
  if (err?.response?.data) console.error('[Frontend]', location, 'server payload:', err.response.data);
  if (import.meta.env.DEV && err?.stack) console.error('[Frontend]', location, 'stack:', err.stack);
}

const VerifyEmail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const emailFromState = location.state?.email || '';
  const emailSent = location.state?.emailSent ?? true;
  const devCode = location.state?.devCode ?? null;
  const fromLogin = location.state?.fromLogin ?? false;

  const [email, setEmail] = useState(emailFromState);
  const [code, setCode] = useState(devCode || '');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [status, setStatus] = useState(emailFromState ? 'form' : 'form'); // form | success | error
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const emailTrim = (emailFromState || email || '').trim().toLowerCase();
    const codeTrim = (code || '').replace(/\D/g, '').slice(0, 6);
    if (!emailTrim) {
      setMessage('הזן את כתובת האימייל.');
      setStatus('error');
      return;
    }
    if (codeTrim.length !== 6) {
      setMessage('הקוד חייב להכיל 6 ספרות.');
      setStatus('error');
      return;
    }
    setMessage('');
    setLoading(true);
    setStatus('form');
    try {
      const res = await axios.post('/verify-code', { email: emailTrim, code: codeTrim });
      setMessage(res.data?.message || 'האימייל אומת בהצלחה. כעת ניתן להתחבר.');
      setStatus('success');
    } catch (err) {
      logAuthError('VerifyEmail submit code', err);
      setMessage(err.response?.data?.error || 'הקוד לא תקף או שפג תוקפו. נסה שוב או בקש קוד חדש.');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    const emailTrim = (emailFromState || email || '').trim().toLowerCase();
    if (!emailTrim) {
      setMessage('הזן את כתובת האימייל.');
      setStatus('error');
      return;
    }
    setResendMessage('');
    setMessage('');
    setResendLoading(true);
    try {
      const res = await axios.post('/resend-verification', { email: emailTrim });
      setResendMessage(res.data?.message || 'נשלח קוד חדש לאימייל.');
    } catch (err) {
      logAuthError('VerifyEmail resend code', err);
      setResendMessage(err.response?.data?.error || 'שליחת קוד מחדש נכשלה.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card verify-email-card">
        <h2>אימות אימייל</h2>

        {status === 'success' ? (
          <>
            <p className="verify-message verify-success">{message}</p>
            <Link to="/login" className="auth-button verify-btn">
              מעבר להתחברות
            </Link>
          </>
        ) : (
          <>
            {!emailSent && (
              <p className="verify-message verify-warning">
                שליחת האימייל נכשלה. בדף ההתחברות השתמש ב&quot;שלח שוב אימייל אימות&quot; או בדוק את תיקיית Spam.
              </p>
            )}
            {devCode && (
              <p className="verify-message verify-dev-code">
                [פיתוח] הקוד שנשלח: <strong>{devCode}</strong>
              </p>
            )}
            {fromLogin && (
              <p className="verify-message verify-info">
                ההתחברות דורשת אימייל מאומת. הזן את הקוד שנשלח אליך.
              </p>
            )}
            <p className="verify-intro-text">
              הזן את קוד 6 הספרות שנשלח אליך באימייל.
            </p>
            <form onSubmit={handleSubmit} className="verify-code-form">
              {!emailFromState && (
                <div className="form-group">
                  <label>אימייל</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                  />
                </div>
              )}
              {emailFromState && (
                <p className="verify-email-display">אימייל: <strong>{emailFromState}</strong></p>
              )}
              <div className="form-group">
                <label>קוד אימות (6 ספרות)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="verify-code-input"
                  required
                />
              </div>
              {resendMessage && (
                <div className={resendMessage.includes('נכשלה') ? 'error-message' : 'success-message'}>
                  {resendMessage}
                </div>
              )}
              {message && status === 'error' && (
                <div className="error-message">{message}</div>
              )}
              <button type="submit" className="auth-button" disabled={loading}>
                {loading ? 'בודק...' : 'אמת'}
              </button>
            </form>
            <p className="verification-or">לא קיבלת קוד?</p>
            <button
              type="button"
              className="resend-verification-btn resend-secondary"
              onClick={handleResendCode}
              disabled={resendLoading}
            >
              {resendLoading ? 'שולח...' : 'שלח קוד מחדש לאימייל'}
            </button>
            <p className="auth-link">
              <Link to="/login">חזרה להתחברות</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
