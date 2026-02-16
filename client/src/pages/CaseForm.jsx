import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { caseFormTranslations } from '../translations/caseForm';
import './CaseForm.css';

const SIGNATURE_PAD_WIDTH = 400;
const SIGNATURE_PAD_HEIGHT = 160;

const CaseForm = () => {
  const { type } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const t = caseFormTranslations[language];
  const canvasRef = useRef(null);
  const [formData, setFormData] = useState({
    address: '',
    familyBackground: '',
    personalDetails: '',
    signature: false,
    signatoryName: '',
    signatureImage: ''
  });
  const [isDrawing, setIsDrawing] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingBenefit, setLoadingBenefit] = useState(true);
  const [benefit, setBenefit] = useState(null);

  useEffect(() => {
    fetchBenefit();
  }, [type]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIGNATURE_PAD_WIDTH * dpr;
    canvas.height = SIGNATURE_PAD_HEIGHT * dpr;
    canvas.style.width = `${SIGNATURE_PAD_WIDTH}px`;
    canvas.style.height = `${SIGNATURE_PAD_HEIGHT}px`;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, SIGNATURE_PAD_WIDTH, SIGNATURE_PAD_HEIGHT);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  }, []);

  const getPoint = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * SIGNATURE_PAD_WIDTH,
      y: ((clientY - rect.top) / rect.height) * SIGNATURE_PAD_HEIGHT
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const p = getPoint(e);
    if (!p) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const p = getPoint(e);
    if (!p) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };

  const stopDrawing = (e) => {
    e.preventDefault();
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      if (canvas) {
        try {
          const dataUrl = canvas.toDataURL('image/png', 0.85);
          setFormData((prev) => ({ ...prev, signatureImage: dataUrl }));
        } catch (_) {}
      }
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, SIGNATURE_PAD_WIDTH, SIGNATURE_PAD_HEIGHT);
    setFormData((prev) => ({ ...prev, signatureImage: '' }));
    setError('');
  };

  const fetchBenefit = async () => {
    try {
      const response = await axios.get('/benefits');
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
      setError(t.errorFillRequired);
      setLoading(false);
      return;
    }

    if (!formData.signature) {
      setError(t.errorConfirmSignature);
      setLoading(false);
      return;
    }

    if (!(formData.signatureImage || '').trim()) {
      setError(t.errorDrawSignature);
      setLoading(false);
      return;
    }

    if (!token) {
      setError(t.errorLoginRequired);
      setLoading(false);
      return;
    }

    try {
      await axios.post(
        '/cases',
        {
          benefitType: type,
          ...formData,
          signatoryName: (formData.signatoryName || '').trim() || undefined,
          signatureImage: formData.signatureImage || undefined
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      navigate('/confirmation', { state: { benefitType: type } });
    } catch (error) {
      const status = error.response?.status;
      const msg = error.response?.data?.error;
      if (status === 401) {
        setError(t.errorSessionExpired);
      } else if (status === 403) {
        setError(msg || t.errorNoPermission);
      } else if (!error.response) {
        setError(t.errorServerDown);
      } else if (status >= 500 || msg) {
        setError(msg || t.errorServerError);
      } else {
        setError(msg || t.errorSubmit);
      }
    } finally {
      setLoading(false);
    }
  };

  const benefitTitle =
    type && t.benefitTitles?.[type] ? t.benefitTitles[type] : benefit?.title;

  if (loadingBenefit) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">{t.loading}</div>
      </div>
    );
  }

  return (
    <div className="case-form-container" dir={language === 'he' ? 'rtl' : 'ltr'}>
      <button
        type="button"
        className="case-form-translate-btn"
        onClick={toggleLanguage}
        title={language === 'he' ? 'Translate to English' : 'תרגם לעברית'}
        aria-label={language === 'he' ? 'Translate to English' : 'תרגם לעברית'}
      >
        {t.translateButton}
      </button>

      <div className="case-form-card">
        <h1>{t.pageTitle} – {benefitTitle}</h1>
        <p className="form-subtitle">{t.formSubtitle}</p>

        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h2>{t.sectionPersonal}</h2>
            <div className="form-group">
              <label>{t.labelAddress}</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows="3"
                required
                placeholder={t.placeholderAddress}
              />
            </div>

            <div className="form-group">
              <label>{t.labelFamilyBackground}</label>
              <textarea
                name="familyBackground"
                value={formData.familyBackground}
                onChange={handleChange}
                rows="4"
                placeholder={t.placeholderFamilyBackground}
              />
            </div>

            <div className="form-group">
              <label>{t.labelPersonalDetails}</label>
              <textarea
                name="personalDetails"
                value={formData.personalDetails}
                onChange={handleChange}
                rows="6"
                required
                placeholder={t.placeholderPersonalDetails}
              />
            </div>
          </div>

          <div className="form-section signature-section">
            <h2>{t.sectionSignature}</h2>
            <div className="checkbox-group">
              <input
                type="checkbox"
                id="signature"
                name="signature"
                checked={formData.signature}
                onChange={handleChange}
                required
              />
              <label htmlFor="signature">{t.checkboxLabel}</label>
            </div>
            <div className="signature-block">
              <p className="signature-pad-hint">{t.signaturePadHint}</p>
              <div
                className="signature-pad-wrap"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                onTouchCancel={stopDrawing}
              >
                <canvas
                  ref={canvasRef}
                  className="signature-pad-canvas"
                  width={SIGNATURE_PAD_WIDTH}
                  height={SIGNATURE_PAD_HEIGHT}
                />
              </div>
              <button type="button" className="clear-signature-btn" onClick={clearSignature}>
                {t.clearSignature}
              </button>
              <div className="form-group signatory-name-optional">
                <label htmlFor="signatoryName">{t.labelSignatoryName.replace(' *', '')}</label>
                <input
                  type="text"
                  id="signatoryName"
                  name="signatoryName"
                  value={formData.signatoryName}
                  onChange={handleChange}
                  placeholder={t.placeholderSignatoryName}
                  className="signatory-input"
                />
              </div>
              <div className="signatory-date-row">
                <span className="signatory-date-label">{t.labelSignatoryDate}</span>
                <span className="signatory-date-value">
                  {new Date().toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  })}
                </span>
              </div>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="cancel-button"
            >
              {t.cancel}
            </button>
            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? t.submitLoading : t.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CaseForm;
