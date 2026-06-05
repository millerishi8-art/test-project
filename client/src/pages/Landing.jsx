import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { landingTranslations } from '../translations/landing';
import { BENEFITS_FALLBACK } from '../data/benefitsFallback';
import { buildWhatsAppUrl, WHATSAPP_CONFIG } from '../constants/whatsappPrefill';
import './Landing.css';

const TYPE_META = {
  family: { icon: '👨‍👩‍👧‍👦', potentialKey: 'familyPotential' },
  individual: { icon: '👤', potentialKey: 'individualPotential' },
  minor: { icon: '🧒', potentialKey: 'minorPotential' },
};

const LANDING_WA_MESSAGE =
  'שלום, אני מתעניין/ת באתר מילר ביטוח לפני ההרשמה. יש לי שאלה לגבי...';

const Landing = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const t = landingTranslations[language];
  const [benefits, setBenefits] = useState(BENEFITS_FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get('/benefits')
      .then((res) => {
        const data = res.data;
        if (data?.family && data?.individual && data?.minor) {
          setBenefits(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (authLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">טוען...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const managerWaUrl = buildWhatsAppUrl('MANAGER', LANDING_WA_MESSAGE);
  const types = ['family', 'individual', 'minor'];

  return (
    <div className="landing-page" dir={language === 'he' ? 'rtl' : 'ltr'}>
      <button
        type="button"
        className="landing-translate-btn"
        onClick={toggleLanguage}
        aria-label={language === 'he' ? 'Translate to English' : 'תרגם לעברית'}
      >
        {t.translateButton}
      </button>

      <header className="landing-hero">
        <h1>{t.heroTitle}</h1>
        <p>{t.heroSubtitle}</p>
        <div className="landing-hero-actions">
          <Link to="/register" className="landing-btn landing-btn-primary">
            {t.heroCtaRegister}
          </Link>
          <Link to="/login" className="landing-btn landing-btn-secondary">
            {t.heroCtaLogin}
          </Link>
        </div>
      </header>

      <section className="landing-section">
        <h2>{t.whatTitle}</h2>
        <p>{t.whatBody}</p>
      </section>

      <section className="landing-section">
        <h2>{t.whyTitle}</h2>
        <ul className="landing-list">
          {t.whyItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="landing-section">
        <h2>{t.typesTitle}</h2>
        <p className="landing-hint">{t.typesHint}</p>
        <div className="landing-types-grid">
          {types.map((key) => {
            const b = benefits[key];
            const meta = TYPE_META[key];
            if (!b) return null;
            return (
              <article key={key} className="landing-type-card">
                <div className="landing-type-icon">{meta.icon}</div>
                <h3>{b.title}</h3>
                <p>{b.criteria}</p>
                <div className="landing-type-meta">
                  <span>
                    {t.timeLabel}: <strong>{b.estimatedTime}</strong>
                  </span>
                  <span>
                    ${b.price.usd} / ₪{b.price.ils}
                  </span>
                  <strong>{t[meta.potentialKey]}</strong>
                </div>
              </article>
            );
          })}
        </div>
        {loading && <p className="landing-hint">טוען מחירים...</p>}
      </section>

      <section className="landing-section">
        <h2>{t.processTitle}</h2>
        <div className="landing-process">
          {t.processSteps.map((step) => (
            <div key={step.n} className="landing-step">
              <span className="landing-step-n">{step.n}</span>
              <div>
                <h4>{step.title}</h4>
                <p>{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <h2>{t.pricingTitle}</h2>
        <div className="landing-pricing-box">
          <div className="landing-pricing-row">
            <span>{t.openingFeeLabel}</span>
            <strong>{t.openingFeeValue}</strong>
          </div>
          <p className="landing-pricing-note">{t.openingFeeNote}</p>
          <div className="landing-pricing-row" style={{ marginTop: '1rem' }}>
            <span>{t.monthlyLabel}</span>
          </div>
          <ul className="landing-list" style={{ marginTop: '0.5rem' }}>
            <li>{t.familyPotential}</li>
            <li>{t.individualPotential}</li>
            <li>{t.minorPotential}</li>
          </ul>
          <p className="landing-pricing-note">{t.monthlyDisclaimer}</p>
        </div>
      </section>

      <section className="landing-section landing-contact">
        <h2>{t.contactTitle}</h2>
        <p>{t.contactBody}</p>
        <p className="landing-contact-phone">{WHATSAPP_CONFIG.MANAGER.displayNumber}</p>
        <a
          href={managerWaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="landing-wa-btn"
        >
          {t.contactCta}
        </a>
      </section>

      <section className="landing-final-cta">
        <p>{t.finalCta}</p>
        <Link to="/register" className="landing-btn landing-btn-primary">
          {t.heroCtaRegister}
        </Link>
      </section>
    </div>
  );
};

export default Landing;
