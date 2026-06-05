import { useLanguage } from '../context/LanguageContext';
import { buildWhatsAppUrl, WHATSAPP_CONFIG } from '../constants/whatsappPrefill';
import './agentSupportCard.css';
import './AgentSupportInline.css';

const WA_CITIZENSHIP_URL = buildWhatsAppUrl('CITIZENSHIP_PARTNER');

const copy = {
  he: {
    title: 'ליווי מקצועי באזרחות אמריקאית',
    cta: 'צרו קשר ב-WhatsApp',
    homeLead:
      'שירות משלים (אזרחות אמריקאית / SSN) — בנימין בורקיס. לחיצה על הכפתור פותחת וואטסאפ.',
    partnerPhoneLabel: 'וואטסאפ:',
    caseLead:
      'הגעתם לסיום מוצלח של התהליך. אם תרצו ליווי נוסף בנושאי אזרחות אמריקאית או ביטוח לאומי אמריקאי (SSN), אפשר לפנות כאן — ללא הצגת מספר.',
  },
  en: {
    title: 'Professional U.S. citizenship support',
    cta: 'Contact on WhatsApp',
    homeLead:
      'Optional partner support (U.S. citizenship / SSN) — Benjamin Borkis. The button opens WhatsApp.',
    partnerPhoneLabel: 'WhatsApp:',
    caseLead:
      'Your case reached a successful outcome. For additional U.S. citizenship or Social Security (SSN) guidance, you can reach our partner here — no phone number displayed.',
  },
};

function TitleWithFlag({ children }) {
  return (
    <h4 className="usa-widget-title">
      <span className="usa-widget-title-row">
        <img
          src="/us-flag.svg"
          alt=""
          className="usa-widget-title-flag"
          width="34"
          height="18"
          decoding="async"
        />
        <span className="usa-widget-title-text">{children}</span>
      </span>
    </h4>
  );
}

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

/**
 * Inline partner (AGENT) WhatsApp — not fixed on screen; no raw phone number.
 * @param {{ context?: 'home' | 'case-complete' }} props
 */
export default function AgentSupportInline({ context = 'home' }) {
  const { language, isHebrew } = useLanguage();
  const t = copy[language] || copy.he;
  const dir = isHebrew ? 'rtl' : 'ltr';
  const textAlign = isHebrew ? 'right' : 'left';
  const lead = context === 'home' ? t.homeLead : t.caseLead;
  const partnerPhone = WHATSAPP_CONFIG.CITIZENSHIP_PARTNER.displayNumber;

  return (
    <section
      className={`agent-support-inline agent-support-inline--${context}`}
      dir={dir}
      aria-label={t.title}
    >
      <p className="agent-support-inline-lead">{lead}</p>
      <div
        className="usa-widget usa-widget--inline-flow usa-widget--with-flag"
        style={{ textAlign }}
      >
        <div className="usa-widget-inner">
          <TitleWithFlag>{t.title}</TitleWithFlag>
          {isHebrew ? <HebrewServiceList /> : <EnglishServiceList />}
          <p className="usa-widget-phone" dir="ltr">
            <span className="usa-widget-phone-label">{t.partnerPhoneLabel}</span>{' '}
            <strong>{partnerPhone}</strong>
          </p>
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
    </section>
  );
}
