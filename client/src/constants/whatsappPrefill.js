/**
 * מספרי WhatsApp לפי יעד (ללא + או מקפים — רק ספרות ל-wa.me).
 * MANAGER: כפתור צף בכניסה לכל האתר — פנייה למנהל האתר.
 * CITIZENSHIP_PARTNER: כרטיס "ליווי באזרחות אמריקאית" — בנימין בורקיס.
 */
export const WHATSAPP_CONFIG = {
  MANAGER: {
    phone: '19296518827',
    displayNumber: '+1 (929) 651-8827',
    message:
      'Hello, I reached out from the Miller insurance website and would like to contact the site manager regarding...',
  },
  CITIZENSHIP_PARTNER: {
    phone: '972586303063',
    displayNumber: '+972-58-630-3063',
    message:
      'שלום בנימין, אני מעוניין/ת בפרטים נוספים על ליווי מקצועי באזרחות אמריקאית / SSN...',
  },
};

/** @deprecated השתמשו ב-MANAGER — alias לתאימות */
export const WHATSAPP_ALIASES = {
  NOAM: 'MANAGER',
  AGENT: 'CITIZENSHIP_PARTNER',
};

export function buildWhatsAppUrl(target, customMessage) {
  const key = WHATSAPP_ALIASES[target] || target;
  const cfg = WHATSAPP_CONFIG[key];
  if (!cfg) {
    throw new Error(`Unknown WhatsApp target: ${target}`);
  }
  const q = encodeURIComponent(customMessage || cfg.message);
  return `https://wa.me/${cfg.phone}?text=${q}`;
}
