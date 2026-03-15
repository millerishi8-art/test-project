import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phonePrefix: '050',
    phoneBody: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleEmailChange = (e) => {
    // Restrict input to English letters, numbers, and allowed symbols
    const val = e.target.value;
    const sanitized = val.replace(/[^a-zA-Z0-9@._-]/g, '');
    setFormData({ ...formData, email: sanitized });
    setError('');
    setEmailError('');
  };

  const handleEmailBlur = async () => {
    const { email } = formData;
    if (!email) return;
    
    // Strict Regex for valid email format
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    if (!emailRegex.test(email)) {
      setEmailError('פורמט אימייל לא חוקי. אנא הזן כתובת תקינה.');
      return;
    }

    // Placeholder for API check (e.g. checking if email exists/valid in DB or via external service)
    try {
      // Simulate an API call
      // const response = await fetch(`/api/check-email?email=${email}`);
      // const data = await response.json();
      // if (!data.isValid) { setEmailError('כתובת האימייל אינה תקינה או לא קיימת.'); }
      setEmailError(''); // Clear error if all good
    } catch (err) {
      console.error('Email validation check failed', err);
    }
  };

  const handlePhoneBodyChange = (e) => {
    // Only allow up to 7 digits
    const val = e.target.value.replace(/\D/g, '').slice(0, 7);
    setFormData({ ...formData, phoneBody: val });
    setError('');
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
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

    if (formData.phoneBody.length < 7) {
      setError('מספר טלפון חייב להכיל בדיוק 7 ספרות (ללא הקידומת)');
      setLoading(false);
      return;
    }
    
    if (emailError) {
      setError('אנא תקן את שגיאות האימייל לפני ההרשמה');
      setLoading(false);
      return;
    }

    const fullPhone = `${formData.phonePrefix}${formData.phoneBody}`;

    const result = await register(
      formData.name,
      formData.email,
      fullPhone,
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
            {emailError && <div className="field-error-message" style={{ color: '#d32f2f', fontSize: '0.85rem', marginTop: '0.3rem' }}>{emailError}</div>}
          </div>
          <div className="form-group">
            <label>מספר טלפון</label>
            <div className="phone-input-group" style={{ display: 'flex', gap: '0.5rem', direction: 'ltr' }}>
              <select 
                name="phonePrefix" 
                value={formData.phonePrefix} 
                onChange={handleChange}
                className="phone-prefix"
                style={{ width: '90px', padding: '0.75rem', borderRadius: '8px', border: '2px solid #e0e0e0', fontSize: '1rem' }}
              >
                <option value="050">050</option>
                <option value="052">052</option>
                <option value="053">053</option>
                <option value="054">054</option>
                <option value="055">055</option>
                <option value="058">058</option>
              </select>
              <input
                type="tel"
                name="phoneBody"
                value={formData.phoneBody}
                onChange={handlePhoneBodyChange}
                placeholder="1234567"
                required
                style={{ flex: 1 }}
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
                <span className="password-icon" aria-hidden>{showPassword ? '🙈' : '👁'}</span>
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
                <span className="password-icon" aria-hidden>{showConfirmPassword ? '🙈' : '👁'}</span>
              </button>
            </div>
          </div>
          {error && <div className="error-message">{error}</div>}
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
