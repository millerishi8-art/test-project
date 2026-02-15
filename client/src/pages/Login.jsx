import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
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

    const result = await login(formData.email, formData.password);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>התחברות</h2>
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
          {error && <div className="error-message">{error}</div>}
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
