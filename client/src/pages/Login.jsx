import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { authTranslations, localizeAuthError } from '../translations/auth';
import { mistypedEmailMessage } from '../utils/emailAddress';
import './Auth.css';

function logAuthError(location, err) {
  console.error('[Frontend]', location, ':', err?.message || String(err));
  if (err?.response?.status != null) console.error('[Frontend]', location, 'HTTP status:', err.response.status);
  if (err?.response?.data) console.error('[Frontend]', location, 'server payload:', err.response.data);
  if (import.meta.env.DEV && err?.stack) console.error('[Frontend]', location, 'stack:', err.stack);
}

/** תגובת API עלולה להחזיר error כאובייקט – חובה לפני .includes / תצוגה */
function apiErrorToString(val, fallback = '') {
  if (val == null || val === '') return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null) {
    if (typeof val.message === 'string') return val.message;
    if (typeof val.error === 'string') return val.error;
  }
  try {
    return String(val);
  } catch {
    return fallback;
  }
}

/** כש-VITE_SUPABASE_URL מוגדר בלקוח — הימנע מהודעת "מסד לא מחובר" המרתיעה אם הבעיה בשרת/Vercel */
function displayLoginError(errorState) {
  const t = apiErrorToString(errorState, '');
  if (!t) return '';
  const looksSupabaseInfra =
    /מסד הנתונים לא מחובר|מסד הנתונים לא זמין|לא ניתן להתחבר ל-Supabase|לא ניתן להשלים את הפעולה מול Supabase|חסרים Supabase|חסרים משתני Supabase|\[DB\]|\[Supabase\]/i.test(
      t
    );
  if (looksSupabaseInfra && import.meta.env.VITE_SUPABASE_URL?.trim()) {
    return 'ההתחברות נכשלה בצד השרת (API). בלקוח כבר יש Supabase — וודא שב-Vercel מוגדרים SUPABASE_URL ו-SUPABASE_SERVICE_ROLE_KEY, שהרצת את , וביצעת Redeploy.';
  }
  return t;
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
  const [loginErrorHint, setLoginErrorHint] = useState(null);
  const [emailCode, setEmailCode] = useState('');
  const [emailFieldError, setEmailFieldError] = useState('');
  const [codeAlreadyActive, setCodeAlreadyActive] = useState(false);
  const [emailVerifyLoading, setEmailVerifyLoading] = useState(false);
  const [emailVerifySuccess, setEmailVerifySuccess] = useState('');
  const [resetStep, setResetStep] = useState(null);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetSendLoading, setResetSendLoading] = useState(false);
  const [resetSubmitLoading, setResetSubmitLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const { login, requireEmailVerification, applySession } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const t = authTranslations[language] || authTranslations.he;
  const show = (text) => localizeAuthError(text, language);
  const navigate = useNavigate();
  const location = useLocation();

  const errorStr = apiErrorToString(error);
  const errorDisplay = displayLoginError(error);
  const showVerificationOptions =
    requireEmailVerification ||
    loginErrorCode === 'EMAIL_NOT_VERIFIED' ||
    loginErrorHint === 'EMAIL_VERIFICATION_MAY_BE_REQUIRED';
  const showEmailVerifyBlock = showVerificationOptions && loginErrorCode !== 'USER_NOT_FOUND';

  useEffect(() => {
    const msg = location.state?.message;
    if (msg) setResendMessage(msg);
    if (location.state?.email) {
      setFormData((prev) => ({ ...prev, email: location.state.email }));
    }
    if (location.state?.showVerification) {
      setLoginErrorCode('EMAIL_NOT_VERIFIED');
    }
  }, [location.state]);


  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
    setEmailFieldError('');
    setLoginErrorCode(null);
    setLoginErrorHint(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResendMessage('');
    setResetMessage('');
    setLoginErrorCode(null);
    setLoginErrorHint(null);
    setLoading(true);

    const typoMessage = mistypedEmailMessage(formData.email, language);
    if (typoMessage) {
      setError(typoMessage);
      setEmailFieldError(typoMessage);
      setLoading(false);
      return;
    }

    const pendingCode = (emailCode || '').replace(/\D/g, '').slice(0, 6);
    if (pendingCode.length === 6) {
      try {
        await axios.post('/verify-code', {
          email: (formData.email || '').trim(),
          code: pendingCode,
        });
        setEmailCode('');
        setCodeAlreadyActive(false);
      } catch (err) {
        logAuthError('Login verify email code before sign-in', err);
        setError(apiErrorToString(err.response?.data?.error, 'הקוד שהוזן שגוי או לא תקף.'));
        setLoginErrorCode('EMAIL_NOT_VERIFIED');
        setResendMessage('הקוד שהוזן לא תואם את המייל האחרון. לא נשלח קוד חדש.');
        setLoading(false);
        return;
      }
    }

    const result = await login(formData.email, formData.password);

    if (result.success) {
      navigate('/dashboard');
      setLoading(false);
      return;
    }
    if (result.code === 'EMAIL_TYPO' || result.code === 'EMAIL_UNDELIVERABLE') {
      const msg = apiErrorToString(result.error, 'יש טעות בכתיבת האימייל. הכתובת לא קיימת, ולכן לא נשלח קוד.');
      setError(msg);
      setEmailFieldError(msg);
      setResendMessage('');
      setLoading(false);
      return;
    }
    if (result.code === 'USER_NOT_FOUND') {
      setError(apiErrorToString(result.error, 'אין חשבון עם האימייל הזה. יש להירשם מחדש.'));
      setLoginErrorCode('USER_NOT_FOUND');
      setLoading(false);
      return;
    }
    if (result.code === 'EMAIL_NOT_VERIFIED') {
      setError(apiErrorToString(result.error, 'נא לאמת את כתובת האימייל.'));
      setLoginErrorCode('EMAIL_NOT_VERIFIED');
      setCodeAlreadyActive(!!result.codeAlreadyActive);
      setResendMessage(
        result.emailSent
          ? 'נשלח קוד אימות למייל. הזן אותו ולחץ על "אמת קוד".'
          : result.codeAlreadyActive
            ? 'הקוד שכבר נשלח למייל עדיין בתוקף. הזן אותו ולחץ על "אמת קוד". לא נשלח קוד חדש.'
            : 'לא הצלחנו לשלוח קוד למייל. לחץ על "שלח שוב אימייל אימות".'
      );
      setLoading(false);
      return;
    }
    setError(apiErrorToString(result.error, 'ההתחברות נכשלה.'));
    setLoginErrorCode(result.code || null);
    setLoginErrorHint(result.hint || null);
    setLoading(false);
  };

  const handleResendVerification = async () => {
    const email = (formData.email || '').trim();
    if (!email) {
      setError('הזן אימייל כדי לשלוח שוב אימייל אימות');
      return;
    }
    const typoMessage = mistypedEmailMessage(email, language);
    if (typoMessage) {
      setError(typoMessage);
      setEmailFieldError(typoMessage);
      setResendMessage('');
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
      const code = err.response?.data?.code;
      if (code === 'USER_NOT_FOUND') {
        setLoginErrorCode('USER_NOT_FOUND');
      }
      const msg = apiErrorToString(err.response?.data?.error, 'שליחה חוזרת נכשלה.');
      setError(msg);
      if (code === 'EMAIL_TYPO' || code === 'EMAIL_UNDELIVERABLE') {
        setEmailFieldError(msg);
        setResendMessage('');
      }
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
      setError(apiErrorToString(err.response?.data?.error, 'שליחת קוד נכשלה.'));
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
      navigate('/dashboard');
    } catch (err) {
      logAuthError('Login verify phone code', err);
      setError(apiErrorToString(err.response?.data?.error, 'הקוד שהוזן שגוי או לא תקף.'));
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
      setCodeAlreadyActive(false);
      if ((formData.password || '').length > 0) {
        const result = await login(email, formData.password);
        if (result.success) {
          navigate('/dashboard');
          return;
        }
        setEmailVerifySuccess('');
        setError(apiErrorToString(result.error, 'האימייל אומת, אבל ההתחברות נכשלה. בדוק את הסיסמה.'));
        setLoginErrorCode(result.code || null);
        setCodeAlreadyActive(!!result.codeAlreadyActive);
      }
    } catch (err) {
      logAuthError('Login verify email code', err);
      setError(apiErrorToString(err.response?.data?.error, 'הקוד שהוזן שגוי או לא תקף.'));
    } finally {
      setEmailVerifyLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setResetStep(null);
    setResetEmail('');
    setResetCode('');
    setResetNewPassword('');
    setResetConfirmPassword('');
    setResetMessage('');
    setResetError('');
  };

  const handleRequestPasswordReset = async (e) => {
    e.preventDefault();
    const email = (resetEmail || '').trim().toLowerCase();
    if (!email) {
      setResetError('הזן את כתובת האימייל');
      return;
    }
    const typoMessage = mistypedEmailMessage(email, language);
    if (typoMessage) {
      setResetError(typoMessage);
      return;
    }
    setResetSendLoading(true);
    setResetError('');
    setResetMessage('');
    try {
      const res = await axios.post('/request-password-reset', { email });
      setResetMessage(res.data?.message || 'אם הכתובת קיימת במערכת, נשלח אליך קוד איפוס סיסמה. בדוק דואר זבל.');
      setResetStep('code');
    } catch (err) {
      logAuthError('Request password reset', err);
      setResetError(apiErrorToString(err.response?.data?.error, 'שליחת הקוד נכשלה.'));
    } finally {
      setResetSendLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    const email = (resetEmail || '').trim().toLowerCase();
    const code = (resetCode || '').replace(/\D/g, '').slice(0, 6);
    if (!email || code.length !== 6) {
      setResetError('הזן אימייל וקוד בן 6 ספרות');
      return;
    }
    if (!resetNewPassword || resetNewPassword.length < 6) {
      setResetError('הסיסמה חייבת להכיל לפחות 6 תווים');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetError('הסיסמאות לא תואמות');
      return;
    }
    setResetSubmitLoading(true);
    setResetError('');
    setResetMessage('');
    try {
      const res = await axios.post('/reset-password', { email, code, newPassword: resetNewPassword });
      setResetMessage(res.data?.message || 'הסיסמה עודכנה בהצלחה. התחבר עם הסיסמה החדשה.');
      setResetStep(null);
      setResetCode('');
      setResetNewPassword('');
      setResetConfirmPassword('');
      setFormData((prev) => ({ ...prev, email }));
    } catch (err) {
      logAuthError('Reset password', err);
      const serverCode = err.response?.data?.code;
      const fallback =
        serverCode === 'CODE_EXPIRED'
          ? 'תוקף הקוד פג. בקש קוד חדש.'
          : 'הקוד שהוזן שגוי או לא תקף.';
      setResetError(apiErrorToString(err.response?.data?.error, fallback));
    } finally {
      setResetSubmitLoading(false);
    }
  };

  if (resetStep === 'email' || resetStep === 'code') {
    return (
      <div className="auth-container" dir={language === 'he' ? 'rtl' : 'ltr'}>
        <button
          type="button"
          className="auth-translate-btn"
          onClick={toggleLanguage}
          title={language === 'he' ? 'Translate to English' : 'תרגם לעברית'}
          aria-label={language === 'he' ? 'Translate to English' : 'תרגם לעברית'}
        >
          {t.translateButton}
        </button>
        <div className="auth-card">
          <h2>{t.resetTitle}</h2>
          {resetStep === 'email' && (
            <form onSubmit={handleRequestPasswordReset}>
              <div className="form-group">
                <label>{t.email}</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => { setResetEmail(e.target.value); setResetError(''); }}
                  placeholder={t.emailPlaceholder}
                  autoFocus
                />
              </div>
              {resetError && <div className="error-message">{show(resetError)}</div>}
              {resetMessage && <div className="success-message">{show(resetMessage)}</div>}
              <button type="submit" className="auth-button" disabled={resetSendLoading}>
                {resetSendLoading ? t.sending : t.sendResetCode}
              </button>
              <button type="button" className="auth-link-button" onClick={handleBackToLogin}>
                {t.backToLogin}
              </button>
            </form>
          )}
          {resetStep === 'code' && (
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label>{t.email}</label>
                <input type="email" value={resetEmail} readOnly className="input-readonly" />
              </div>
              <div className="form-group">
                <label>{t.resetCode}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="phone-code-input"
                />
              </div>
              <div className="form-group">
                <label>{t.newPassword}</label>
                <input
                  type="password"
                  value={resetNewPassword}
                  onChange={(e) => { setResetNewPassword(e.target.value); setResetError(''); }}
                  placeholder={t.newPasswordPlaceholder}
                  minLength={6}
                />
              </div>
              <div className="form-group">
                <label>{t.confirmNewPassword}</label>
                <input
                  type="password"
                  value={resetConfirmPassword}
                  onChange={(e) => { setResetConfirmPassword(e.target.value); setResetError(''); }}
                  placeholder={t.confirmNewPasswordPlaceholder}
                />
              </div>
              {resetError && <div className="error-message">{show(resetError)}</div>}
              {resetMessage && <div className="success-message">{show(resetMessage)}</div>}
              <button type="submit" className="auth-button" disabled={resetSubmitLoading}>
                {resetSubmitLoading ? t.resetting : t.resetPassword}
              </button>
              <button type="button" className="auth-link-button" onClick={handleBackToLogin}>
                {t.backToLogin}
              </button>
            </form>
          )}
          <p className="auth-link">
            {t.noAccount} <Link to="/register">{t.registerHere}</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container" dir={language === 'he' ? 'rtl' : 'ltr'}>
      <button
        type="button"
        className="auth-translate-btn"
        onClick={toggleLanguage}
        title={language === 'he' ? 'Translate to English' : 'תרגם לעברית'}
        aria-label={language === 'he' ? 'Translate to English' : 'תרגם לעברית'}
      >
        {t.translateButton}
      </button>
      <div className="auth-card">
        <h2>{t.loginTitle}</h2>
          {requireEmailVerification && (
            <div className="verify-required-notice">
              {t.verifyNotice}
            </div>
          )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{t.email}</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              onBlur={() => {
                const msg = mistypedEmailMessage(formData.email, language);
                setEmailFieldError(msg);
                if (msg) setError(msg);
              }}
              required
            />
            {emailFieldError && <div className="field-error-message">{show(emailFieldError)}</div>}
          </div>
          <div className="form-group">
            <label>{t.password}</label>
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
                title={showPassword ? t.hidePassword : t.showPassword}
                aria-label={showPassword ? t.hidePassword : t.showPassword}
              >
                {showPassword ? (
                  <span className="password-icon" aria-hidden>🙈</span>
                ) : (
                  <span className="password-icon" aria-hidden>👁</span>
                )}
              </button>
            </div>
          </div>
          {resetMessage && <div className="success-message">{show(resetMessage)}</div>}
          {resendMessage && (
            <>
              <div className="success-message">{show(resendMessage)}</div>
              <div className="check-spam-tip">
                💡 {t.spamTip}
              </div>
            </>
          )}
          {phoneMessage && <div className="success-message">{show(phoneMessage)}</div>}
          {emailVerifySuccess && <div className="success-message">{show(emailVerifySuccess)}</div>}
          {errorDisplay && (
            <div className={loginErrorCode === 'EMAIL_NOT_VERIFIED' ? 'error-message error-message-verify' : 'error-message'}>
              {show(errorDisplay)}
              {loginErrorCode === 'EMAIL_NOT_VERIFIED' ? (
                <p className="error-hint">
                  {codeAlreadyActive ? t.hintActiveCode : t.hintNeedCode}
                </p>
              ) : loginErrorCode === 'USER_NOT_FOUND' ? (
                <p className="error-hint">{t.hintNoUser}</p>
              ) : (
                (errorStr === 'פרטי התחברות לא תקינים' ||
                  errorStr === 'Invalid credentials' ||
                  errorStr.includes('Login failed')) && (
                  <p className="error-hint">{t.hintBadPassword}</p>
                )
              )}
            </div>
          )}
          {showEmailVerifyBlock && (
            <div className="verification-options verification-options-always">
              <p className="verification-intro">{t.codeIntro}</p>
              <div className="email-verify-code-form">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleVerifyEmailCode(e);
                    }
                  }}
                  className="phone-code-input email-code-input"
                  aria-label={t.codeLabel}
                />
                <button
                  type="button"
                  className="resend-verification-btn"
                  disabled={emailVerifyLoading || emailCode.length !== 6}
                  onClick={handleVerifyEmailCode}
                >
                  {emailVerifyLoading ? t.checking : t.verifyCode}
                </button>
              </div>
              <p className="verification-or">{t.noCode}</p>
              <button
                type="button"
                className="resend-verification-btn resend-secondary"
                onClick={handleResendVerification}
                disabled={resendLoading}
              >
                {resendLoading ? t.sending : t.resendEmail}
              </button>
              <p className="verification-or">{t.orPhone}</p>
              {!phoneStep ? (
                <button
                  type="button"
                  className="resend-verification-btn phone-btn"
                  onClick={handleRequestPhoneCode}
                  disabled={phoneSendLoading}
                >
                  {phoneSendLoading ? t.sending : t.sendSms}
                </button>
              ) : (
                <div className="phone-verify-form">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder={t.phoneCodePlaceholder}
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleVerifyPhoneCode(e);
                      }
                    }}
                    className="phone-code-input"
                  />
                  <button
                    type="button"
                    className="resend-verification-btn phone-btn"
                    disabled={phoneVerifyLoading || phoneCode.length !== 6}
                    onClick={handleVerifyPhoneCode}
                  >
                    {phoneVerifyLoading ? t.verifying : t.verifyAndLogin}
                  </button>
                </div>
              )}
            </div>
          )}
          {loginErrorCode === 'USER_NOT_FOUND' && (
            <button
              type="button"
              className="auth-button"
              onClick={() =>
                navigate('/register', { state: { email: formData.email.trim() } })
              }
            >
              {t.registerAgain}
            </button>
          )}
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? t.loggingIn : t.login}
          </button>
          <p className="auth-link auth-link-forgot">
            <button
              type="button"
              className="auth-link-button"
              onClick={() => {
                setResetStep('email');
                setResetEmail(formData.email || '');
                setResetError('');
                setResetMessage('');
                setResetCode('');
                setResetNewPassword('');
                setResetConfirmPassword('');
              }}
            >
              {t.forgotPassword}
            </button>
          </p>
        </form>
        <p className="auth-link">
          {t.noAccount} <Link to="/register">{t.registerHere}</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
