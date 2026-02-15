import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './CaseForm.css';

const CaseForm = () => {
  const { type } = useParams();
  const navigate = useNavigate();
  const [benefit, setBenefit] = useState(null);
  const [formData, setFormData] = useState({
    address: '',
    familyBackground: '',
    personalDetails: '',
    signature: false
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingBenefit, setLoadingBenefit] = useState(true);

  useEffect(() => {
    fetchBenefit();
  }, [type]);

  const fetchBenefit = async () => {
    try {
      const response = await axios.get('/api/benefits');
      setBenefit(response.data[type]);
    } catch (error) {
      console.error('Failed to fetch benefit:', error);
    } finally {
      setLoadingBenefit(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!formData.address || !formData.personalDetails) {
      setError('אנא מלא את כל השדות הנדרשים');
      setLoading(false);
      return;
    }

    if (!formData.signature) {
      setError('אנא אשר את החתימה');
      setLoading(false);
      return;
    }

    try {
      await axios.post('/api/cases', {
        benefitType: type,
        ...formData
      });

      navigate('/confirmation', { state: { benefitType: type } });
    } catch (error) {
      const status = error.response?.status;
      const msg = error.response?.data?.error;
      if (status === 401) {
        setError('נא להתחבר מחדש כדי לשלוח את הטופס.');
      } else if (status === 403) {
        setError(msg || 'אין הרשאה לשלוח תיק.');
      } else if (status >= 500 || msg) {
        setError(msg || 'שגיאת שרת. נסה שוב או בדוק את הטרמינל של השרת.');
      } else if (!error.response) {
        setError('לא ניתן להתחבר לשרת. וודא שהשרת רץ (פורט 5000) ומתיקיית שורש: npm run dev');
      } else {
        setError(msg || 'שגיאה בשליחת הטופס.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loadingBenefit) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">טוען...</div>
      </div>
    );
  }

  return (
    <div className="case-form-container">
      <div className="case-form-card">
        <h1>מילוי פרטים - {benefit?.title}</h1>
        <p className="form-subtitle">אנא מלא את כל הפרטים הנדרשים</p>

        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h2>פרטים אישיים</h2>
            <div className="form-group">
              <label>כתובת מגורים *</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows="3"
                required
                placeholder="הזן כתובת מלאה"
              />
            </div>

            <div className="form-group">
              <label>רקע משפחתי</label>
              <textarea
                name="familyBackground"
                value={formData.familyBackground}
                onChange={handleChange}
                rows="4"
                placeholder="פרטים על הרקע המשפחתי (אופציונלי)"
              />
            </div>

            <div className="form-group">
              <label>פרטים נוספים *</label>
              <textarea
                name="personalDetails"
                value={formData.personalDetails}
                onChange={handleChange}
                rows="6"
                required
                placeholder="פרטים נוספים על הבן אדם שמבקש את ההטבה"
              />
            </div>
          </div>

          <div className="form-section">
            <div className="checkbox-group">
              <input
                type="checkbox"
                id="signature"
                name="signature"
                checked={formData.signature}
                onChange={handleChange}
                required
              />
              <label htmlFor="signature">
                אני מאשר את כל הפרטים ומאשר לסגור את הקייס *
              </label>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="cancel-button"
            >
              ביטול
            </button>
            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? 'שולח...' : 'שלח וסגור קייס'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CaseForm;
