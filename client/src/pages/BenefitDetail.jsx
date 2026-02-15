import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import { productDescriptionTranslations } from '../translations/productDescription';
import { BENEFITS_FALLBACK } from '../data/benefitsFallback';
import './BenefitDetail.css';

const BenefitDetail = () => {
  const { type } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = productDescriptionTranslations[language];
  const [benefit, setBenefit] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBenefit();
  }, [type]);

  const fetchBenefit = async () => {
    const key = (type || '').toLowerCase();
    const validKeys = ['family', 'individual', 'minor'];
    const fallback = validKeys.includes(key) ? BENEFITS_FALLBACK[key] : null;

    try {
      const response = await axios.get('/api/benefits');
      const data = response.data;
      if (data && validKeys.includes(key) && data[key]) {
        setBenefit(data[key]);
      } else if (fallback) {
        setBenefit(fallback);
      } else {
        setBenefit(null);
      }
    } catch (error) {
      console.warn('Benefit from server failed, using fallback:', error?.message);
      setBenefit(fallback ?? null);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCalendar = () => {
    const renewalDate = new Date();
    renewalDate.setMonth(renewalDate.getMonth() + 6);

    const year = renewalDate.getFullYear();
    const month = String(renewalDate.getMonth() + 1).padStart(2, '0');
    const day = String(renewalDate.getDate()).padStart(2, '0');
    const hours = String(renewalDate.getHours()).padStart(2, '0');
    const minutes = String(renewalDate.getMinutes()).padStart(2, '0');

    const startDate = `${year}${month}${day}T${hours}${minutes}00`;
    const endDate = `${year}${month}${day}T${parseInt(hours) + 1}${minutes}00`;

    const title = encodeURIComponent(language === 'he' ? 'חידוש קייס - אל תשכח!' : 'Case renewal - Don\'t forget!');
    const details = encodeURIComponent(t.alertText);
    const location = encodeURIComponent(language === 'he' ? 'מערכת סוכן ביטוח' : 'Insurance Agent System');

    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${details}&location=${location}`;

    window.open(googleCalendarUrl, '_blank');
  };

  const handleContinue = () => {
    navigate(`/case-form/${type}`);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">{t.loading}</div>
      </div>
    );
  }

  if (!benefit) {
    return (
      <div className="error-container">
        <p className="error-title">{t.notFound}</p>
        <p className="error-hint">{t.notFoundHint}</p>
        <button type="button" className="btn-back-home" onClick={() => navigate('/')}>
          {t.backToHome}
        </button>
      </div>
    );
  }

  const explanationSections = benefit.fullExplanation || [];

  return (
    <div className="benefit-detail-container" dir={language === 'he' ? 'rtl' : 'ltr'}>
      <div className="benefit-detail-card">
        {/* תיאור המוצר – פרטי הקייס (הועבר מדף הבית) */}
        <section className="benefit-product-description">
          <h2 className="product-description-title">{t.productTitle}</h2>
          <p className="product-intro">{t.productIntro}</p>

          <div className="product-block">
            <h3>{t.productCostTitle}</h3>
            <p>{t.productCost}</p>
          </div>

          <div className="product-block">
            <h3>{t.productPhasesTitle}</h3>
            <p className="product-list">{t.productPhases}</p>
          </div>

          <div className="product-block">
            <h3>{t.productHowTitle}</h3>
            <p>{t.productHow}</p>
          </div>

          <div className="product-block">
            <h3>{t.productTimeTitle}</h3>
            <p>{t.productTime}</p>
          </div>

          <div className="product-block product-block-important">
            <h3>{t.productImportantTitle}</h3>
            <p>{t.productImportant}</p>
          </div>

          <div className="product-block">
            <h3>{t.productCardTitle}</h3>
            <p>{t.productCard}</p>
          </div>

          <div className="product-block">
            <h3>{t.productRenewalTitle}</h3>
            <p>{t.productRenewal}</p>
          </div>

          <div className="product-block product-block-contact">
            <h3>{t.productContactTitle}</h3>
            <p>{t.productContact}</p>
          </div>
        </section>

        {/* פרטי ההטבה לפי סוג (משפחה / יחיד / קטין) */}
        <h1>{benefit.title}</h1>
        <p className="benefit-description">{benefit.description}</p>

        {explanationSections.length > 0 && (
          <div className="benefit-explanation-block">
            <h2 className="explanation-block-title">{t.explanationBlockTitle}</h2>
            {explanationSections.map((section, index) => (
              <div key={index} className="explanation-section">
                <h3>{section.heading}</h3>
                <p>{section.text}</p>
              </div>
            ))}
          </div>
        )}

        <div className="benefit-section">
          <h2>{t.criteria}</h2>
          <p>{benefit.criteria}</p>
        </div>

        <div className="benefit-section">
          <h2>{t.instructions}</h2>
          <p>{benefit.instructions}</p>
        </div>

        <div className="benefit-section">
          <h2>{t.estimatedTime}</h2>
          <p className="estimated-time">{benefit.estimatedTime}</p>
        </div>

        <div className="benefit-section">
          <h2>{t.details}</h2>
          <p>{benefit.details}</p>
        </div>

        <div className="benefit-section">
          <h2>{t.price}</h2>
          <div className="price-display">
            <span className="price-item">${benefit.price.usd} USD</span>
            <span className="price-item">₪{benefit.price.ils} ILS</span>
          </div>
        </div>

        <div className="alert-box">
          <h3>{t.alertTitle}</h3>
          <p>{t.alertText}</p>
          <button onClick={handleAddToCalendar} className="calendar-button">
            {t.addToCalendar}
          </button>
        </div>

        <div className="action-buttons">
          <button onClick={() => navigate('/')} className="back-button">
            {t.back}
          </button>
          <button onClick={handleContinue} className="continue-button">
            {t.continue}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BenefitDetail;
