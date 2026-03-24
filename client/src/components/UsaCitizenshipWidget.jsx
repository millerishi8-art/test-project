import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { buildWhatsAppUrl } from '../constants/whatsappPrefill';
import './UsaCitizenshipWidget.css';

const WA_CITIZENSHIP_URL = buildWhatsAppUrl('972586303063');
const SESSION_KEY = 'usaCitizenshipWidgetDismissed';

const copy = {
  he: {
    title: 'ליווי מקצועי באזרחות אמריקאית',
    cta: 'צרו קשר ב-WhatsApp',
    reopen: 'שירות אזרחות אמריקאית',
    close: 'סגור',
  },
  en: {
    title: 'Professional U.S. citizenship support',
    cta: 'Contact on WhatsApp',
    reopen: 'U.S. citizenship help',
    close: 'Close',
  },
};

function HebrewServiceList() {
  return (
    <ul className="usa-widget-list">
      <li>
        בירור ואימות מספר ביטוח לאומי אמריקאי —{' '}
        <span className="usa-widget-nowrap">SSN (Social&nbsp;Security)</span>.
      </li>
      <li>הוצאה, חידוש וליווי בנוגע לדרכון אמריקאי.</li>
      <li>ליווי אישי ומסודר בתהליכי אזרחות, היתרים ומסמכים רשמיים.</li>
    </ul>
  );
}

function EnglishServiceList() {
  return (
    <ul className="usa-widget-list">
      <li>Review and verification of your U.S. Social Security number (SSN).</li>
      <li>U.S. passport issuance, renewal, and related guidance.</li>
      <li>Step-by-step support for citizenship procedures and official paperwork.</li>
    </ul>
  );
}

export default function UsaCitizenshipWidget() {
  const { language, isHebrew } = useLanguage();
  const t = copy[language] || copy.he;
  const dir = isHebrew ? 'rtl' : 'ltr';
  const textAlign = isHebrew ? 'right' : 'left';

  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {
      return false;
    }
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = () => {
      if (!mq.matches) setMobileOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const handleClose = useCallback(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {}
    setDismissed(true);
    setMobileOpen(false);
  }, []);

  const handleReopen = useCallback(() => {
    setDismissed(false);
    setMobileOpen(true);
  }, []);

  if (dismissed) {
    return (
      <button
        type="button"
        className="usa-widget-fab"
        onClick={handleReopen}
        aria-label={t.reopen}
        title={t.reopen}
      >
        <span className="usa-widget-fab-icon" aria-hidden>
          🇺🇸
        </span>
      </button>
    );
  }

  return (
    <>
      <aside
        className="usa-widget usa-widget--desktop usa-widget--with-flag"
        dir={dir}
        style={{ textAlign }}
        aria-label={t.title}
      >
        <div className="usa-widget-inner">
          <button
            type="button"
            className="usa-widget-close"
            onClick={handleClose}
            aria-label={t.close}
          >
            ×
          </button>
          <h4 className="usa-widget-title">{t.title}</h4>
          {isHebrew ? <HebrewServiceList /> : <EnglishServiceList />}
          <a
            href={WA_CITIZENSHIP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="usa-widget-wa"
          >
            {t.cta}
          </a>
        </div>
      </aside>

      <div className="usa-widget-mobile-wrap">
        {!mobileOpen ? (
          <div
            className="usa-widget usa-widget--mobile-bar usa-widget--with-flag"
            dir={dir}
            style={{ textAlign }}
          >
            <div className="usa-widget-inner">
              <div className="usa-widget-mobile-top">
                <p className="usa-widget-mobile-teaser">{t.title}</p>
                <button
                  type="button"
                  className="usa-widget-close usa-widget-close--inline"
                  onClick={handleClose}
                  aria-label={t.close}
                >
                  ×
                </button>
              </div>
              <div className="usa-widget-mobile-actions">
                <button
                  type="button"
                  className="usa-widget-expand"
                  onClick={() => setMobileOpen(true)}
                >
                  {isHebrew ? 'פרטים' : 'Details'}
                </button>
                <a
                  href={WA_CITIZENSHIP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="usa-widget-wa usa-widget-wa--compact"
                >
                  {t.cta}
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="usa-widget usa-widget--mobile-sheet usa-widget--with-flag"
            dir={dir}
            style={{ textAlign }}
          >
            <div className="usa-widget-inner">
              <button
                type="button"
                className="usa-widget-close"
                onClick={() => setMobileOpen(false)}
                aria-label={t.close}
              >
                ×
              </button>
              <h4 className="usa-widget-title">{t.title}</h4>
              {isHebrew ? <HebrewServiceList /> : <EnglishServiceList />}
              <a
                href={WA_CITIZENSHIP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="usa-widget-wa"
              >
                {t.cta}
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
