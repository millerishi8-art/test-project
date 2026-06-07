import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  PHONE_COUNTRIES,
  sanitizePhoneDigits,
  validatePhoneInput,
  getPhonePlaceholder,
} from '../utils/phoneInput';
import './Auth.css';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
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
      navigate('/verify-email', {
        state: {
          email: formData.email,
          message: result.message,
          emailSent: result.emailSent,
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
    <div className="auth-container">
      <div className="auth-card">
        <h2>הרשמה</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>שם מלא</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>אימייל</label>
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
              <div className="field-error-message">{emailError}</div>
            )}
          </div>
          <div className="form-group">
            <label>מספר טלפון</label>
            <p className="phone-input-hint">
              ניתן להירשם עם מספר ישראלי, אמריקאי או בינלאומי
            </p>
            <div className="phone-input-group" dir="ltr">
              <select
                name="phoneCountry"
                value={formData.phoneCountry}
                onChange={handleChange}
                className="phone-country-select"
                aria-label="מדינה"
              >
                {PHONE_COUNTRIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
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
                  placeholder="קידומת"
                  inputMode="numeric"
                  aria-label="קידומת מדינה"
                  required
                />
              ) : null}
              <input
                type="tel"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handlePhoneNumberChange}
                className="phone-number-input"
                placeholder={getPhonePlaceholder(formData.phoneCountry)}
                inputMode="numeric"
                required
                aria-label="מספר טלפון"
              />
            </div>
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
                <span className="password-icon" aria-hidden>
                  {showPassword ? '🙈' : '👁'}
                </span>
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>אישור סיסמה</label>
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
                title={showConfirmPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                aria-label={showConfirmPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
              >
                <span className="password-icon" aria-hidden>
                  {showConfirmPassword ? '🙈' : '👁'}
                </span>
              </button>
            </div>
          </div>
          {error && <div className="error-message">{error}</div>}
          {looksLikeExistingEmailError ? (
            <div className="auth-link auth-link--tight">
              <Link to="/login">האימייל כבר רשום? התחבר כאן</Link>
              {' · '}
              <Link to="/login">
                שכחת סיסמה? עבור למסך ההתחברות ובחר &quot;שכחתי סיסמה&quot;
              </Link>
            </div>
          ) : null}
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'נרשם...' : 'הרשם'}
          </button>
        </form>
        <p className="auth-link">
          כבר יש לך חשבון? <Link to="/login">התחבר כאן</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
