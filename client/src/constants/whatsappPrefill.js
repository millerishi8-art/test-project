/** הודעה שממלאת אוטומטית בפתיחת צ'אט וואטסאפ מהאתר */
export const WHATSAPP_PREFILL_HE =
  'היי שלום הגעתי מהאתר פוד סטאמפס של נועם מילר אשמח לדעת אם אוכל לקבל עזרה בבירוקרטיה האמריקאית: של אזרחות / סושיאל / דרכון.';

/**
 * @param {string} phoneDigits מספר בלי + (למשל 19296518827 או 972586303063)
 * @param {string} [text]
 */
export function buildWhatsAppUrl(phoneDigits, text = WHATSAPP_PREFILL_HE) {
  const q = encodeURIComponent(text);
  return `https://wa.me/${phoneDigits}?text=${q}`;
}
