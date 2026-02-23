import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

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

    const result = await register(
      formData.name,
      formData.email,
      formData.phone,
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
          devCode: result.devCode ?? null,
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
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>מספר טלפון</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
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
