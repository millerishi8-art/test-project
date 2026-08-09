/**
 * שליחת WhatsApp דרך Twilio (WhatsApp Business API).
 *
 * דורש:
 * - TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
 * - TWILIO_WHATSAPP_FROM=whatsapp:+14155238886  (Sandbox) או מספר עסקי מאושר
 *
 * להתראות יזומות מחוץ לחלון 24 שעות נדרש תבנית מאושרת:
 * - TWILIO_WHATSAPP_CONTENT_SID=HXxxxx
 * - משתני התבנית: {{1}}=שם לקוח, {{2}}=שם שלב, {{3}}=הערת פעולה (אופציונלי)
 */

import { normalizePhone } from './sms.js';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_WHATSAPP_FROM = (process.env.TWILIO_WHATSAPP_FROM || '').trim();
const TWILIO_WHATSAPP_CONTENT_SID = (process.env.TWILIO_WHATSAPP_CONTENT_SID || '').trim();

const isConfigured = Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_FROM);

function toWhatsAppAddress(phoneOrAddr) {
  const raw = String(phoneOrAddr || '').trim();
  if (!raw) return '';
  if (raw.toLowerCase().startsWith('whatsapp:')) return raw;
  const e164 = normalizePhone(raw);
  return e164 ? `whatsapp:${e164}` : '';
}

async function getTwilioClient() {
  try {
    const twilio = await import('twilio');
    return twilio.default(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  } catch (err) {
    console.warn('Twilio not installed or failed to load:', err?.message);
    return null;
  }
}

/**
 * שליחת הודעת WhatsApp לעובד.
 * @param {string} phone - מספר ישראלי / בינלאומי
 * @param {string} message - טקסט חופשי (Sandbox / חלון שיחה 24ש')
 * @param {{ clientName?: string, stageLabel?: string, actionNote?: string }} [vars] - לתבנית מאושרת
 * @returns {Promise<boolean>}
 */
export async function sendWhatsAppMessage(phone, message, vars = {}) {
  const to = toWhatsAppAddress(phone);
  const from = toWhatsAppAddress(TWILIO_WHATSAPP_FROM);
  const body = String(message || '').trim();
  if (!to || (!body && !TWILIO_WHATSAPP_CONTENT_SID)) {
    console.warn('[WhatsApp] missing phone or message');
    return false;
  }

  if (!isConfigured) {
    console.log('[WhatsApp not configured – message for', to, ']:', body || vars);
    return false;
  }

  const client = await getTwilioClient();
  if (!client) return false;

  try {
    const payload = { from, to };

    if (TWILIO_WHATSAPP_CONTENT_SID) {
      payload.contentSid = TWILIO_WHATSAPP_CONTENT_SID;
      payload.contentVariables = JSON.stringify({
        '1': String(vars.clientName || '').trim() || 'לקוח',
        '2': String(vars.stageLabel || '').trim() || '—',
        '3': String(vars.actionNote || '').trim() || '—',
      });
    } else {
      payload.body = body;
    }

    await client.messages.create(payload);
    console.log('[WhatsApp] Sent to', to);
    return true;
  } catch (err) {
    console.error('[WhatsApp] Twilio error:', err?.message || err);
    return false;
  }
}

export { isConfigured as isWhatsAppConfigured };
