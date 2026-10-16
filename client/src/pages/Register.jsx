import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { authTranslations, localizeAuthError } from '../translations/auth';
import {
  PHONE_COUNTRIES,
  phoneCountryLabel,
  sanitizePhoneDigits,
  validatePhoneInput,
  getPhonePlaceholder,
} from '../utils/phoneInput';
import './Auth.css';

const Register = () => {
  const location = useLocation();
  const prefilledEmail = typeof location.state?.email === 'string' ? location.state.email : '';
  const [formData, setFormData] = useState({
    name: '',
    email: prefilledEmail,
    phoneCountry: 'IL',
    phoneCustomDial: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const t = authTranslations[language] || authTranslations.he;
  const show = (text) => localizeAuthError(text, language);
  const navigate = useNavigate();
  const looksLikeExistingEmailError =
    typeof error === 'string' &&
    /כבר קיים|already exists|already registered|already been registered|email_exists/i.test(error);

  const handleEmailChange = (e) => {
    const val = e.target.value;
    const sanitized = val.replace(/[^a-zA-Z0-9@._-]/g, '');
    setFormData({ ...formData, email: sanitized });
    setError('');
    setEmailError('');
  };

  const handleEmailBlur = async () => {
    const { email } = formData;
    if (!email) return;

    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    if (!emailRegex.test(email)) {
      setEmailError('פורמט אימייל לא חוקי. אנא הזן כתובת תקינה.');
      return;
    }

    try {
      setEmailError('');
    } catch (err) {
      console.error('Email validation check failed', err);
    }
  };

  const handlePhoneNumberChange = (e) => {
    const maxLen = formData.phoneCountry === 'US' ? 11 : 15;
    const val = sanitizePhoneDigits(e.target.value, maxLen);
    setFormData({ ...formData, phoneNumber: val });
    setError('');
  };

  const handlePhoneCustomDialChange = (e) => {
    const val = sanitizePhoneDigits(e.target.value, 4);
    setFormData({ ...formData, phoneCustomDial: val });
    setError('');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phoneCountry') {
      setFormData({
        ...formData,
        phoneCountry: value,
        phoneNumber: '',
        phoneCustomDial: value === 'OTHER' ? formData.phoneCustomDial : '',
      });
    } else {
      setFormData({ ...formData, [name]: value });
    }
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (formData.password !== formData.confirmPassword) {
      setError('הסיסמאות אינן תואמות');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('הסיסמה חייבת להכיל לפחות 6 תווים');
      setLoading(false);
      return;
    }

    const phoneCheck = validatePhoneInput(
      formData.phoneCountry,
      formData.phoneNumber,
      formData.phoneCustomDial
    );
    if (!phoneCheck.ok) {
      setError(phoneCheck.error);
      setLoading(false);
      return;
    }

    if (emailError) {
      setError('אנא תקן את שגיאות האימייל לפני ההרשמה');
      setLoading(false);
      return;
    }

    const result = await register(
      formData.name,
      formData.email,
      phoneCheck.e164,
      formData.password
    );

    if (result.success) {
      setError('');
      setLoading(false);
      navigate('/login', {
        state: {
          email: formData.email,
          message: result.emailSent
            ? 'ההרשמה בוצעה ונשלח קוד אימות למייל. הזן את הקוד כאן, ואז התחבר.'
            : result.message || 'ההרשמה בוצעה. עכשיו אפשר להתחבר.',
          showVerification: !!result.emailSent,
        },
      });
      return;
    }
    console.error('[Frontend] Register submit: server returned error:', result.error);
    setError(result.error);
    setLoading(false);
  };

  const isOtherCountry = formData.phoneCountry === 'OTHER';

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
        <h2>{t.registerTitle}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{t.fullName}</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>{t.email}</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleEmailChange}
              onBlur={handleEmailBlur}
              required
              dir="ltr"
              placeholder="example@mail.com"
            />
            {emailError && (
              <div className="field-error-message">{show(emailError)}</div>
            )}
          </div>
          <div className="form-group">
            <label>{t.phone}</label>
            <p className="phone-input-hint">{t.phoneHint}</p>
            <div className="phone-input-group" dir="ltr">
              <select
                name="phoneCountry"
                value={formData.phoneCountry}
                onChange={handleChange}
                className="phone-country-select"
                aria-label={t.country}
              >
                {PHONE_COUNTRIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {phoneCountryLabel(c, language)}
                  </option>
                ))}
              </select>
              {isOtherCountry ? (
                <input
                  type="tel"
                  name="phoneCustomDial"
                  value={formData.phoneCustomDial}
                  onChange={handlePhoneCustomDialChange}
                  className="phone-custom-dial"
                  placeholder={t.dialPlaceholder}
                  inputMode="numeric"
                  aria-label={t.dialCode}
                  required
                />
              ) : null}
              <input
                type="tel"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handlePhoneNumberChange}
                className="phone-number-input"
                placeholder={getPhonePlaceholder(formData.phoneCountry, language)}
                inputMode="numeric"
                required
                aria-label={t.phone}
              />
            </div>
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
                <span className="password-icon" aria-hidden>
                  {showPassword ? '🙈' : '👁'}
                </span>
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>{t.confirmPassword}</label>
            <div className="password-input-wrapper">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className="password-input"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowConfirmPassword((s) => !s)}
                title={showConfirmPassword ? t.hidePassword : t.showPassword}
                aria-label={showConfirmPassword ? t.hidePassword : t.showPassword}
              >
                <span className="password-icon" aria-hidden>
                  {showConfirmPassword ? '🙈' : '👁'}
                </span>
              </button>
            </div>
          </div>
          {error && <div className="error-message">{show(error)}</div>}
          {looksLikeExistingEmailError ? (
            <div className="auth-link auth-link--tight">
              <Link to="/login">{t.emailExistsLogin}</Link>
              {' · '}
              <Link to="/login">{t.emailExistsReset}</Link>
            </div>
          ) : null}
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? t.registering : t.register}
          </button>
        </form>
        <p className="auth-link">
          {t.hasAccount} <Link to="/login">{t.loginHere}</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
