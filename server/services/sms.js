/**
 * שליחת קוד אימות ב-SMS.
 * אם מוגדר Twilio – שולח SMS אמיתי. אחרת (פיתוח) – מדפיס את הקוד ללוג.
 */

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_PHONE_NUMBER = (process.env.TWILIO_PHONE_NUMBER || '').trim();

const isConfigured = Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER);

async function getTwilioClient() {
  try {
    const twilio = await import('twilio');
    return twilio.default(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  } catch (err) {
    console.warn('Twilio not installed or failed to load:', err?.message);
    return null;
  }
}

/** מנרמל מספר טלפון לפורמט בינלאומי (למשל +972...) */
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 9 && (digits.startsWith('5') || digits.startsWith('4') || digits.startsWith('2') || digits.startsWith('3'))) {
    return '+972' + digits;
  }
  if (digits.length === 10 && digits.startsWith('0')) {
    return '+972' + digits.slice(1);
  }
  if (digits.length >= 10) {
    return digits.startsWith('972') ? '+' + digits : '+' + digits;
  }
  return '+' + digits;
}

/**
 * שולח קוד אימות ב-SMS
 * @param {string} phone - מספר טלפון (כפי שנרשם או בינלאומי)
 * @param {string} code - קוד 6 ספרות
 * @returns {Promise<boolean>}
 */
export async function sendVerificationSms(phone, code) {
  const to = normalizePhone(phone);
  if (!to) {
    console.warn('SMS: invalid phone number', phone);
    return false;
  }

  const body = `קוד אימות לאתר סוכן ביטוח: ${code}. התוקף 10 דקות.`;

  if (isConfigured) {
    const client = await getTwilioClient();
    if (client) {
      try {
        await client.messages.create({
          body,
          from: TWILIO_PHONE_NUMBER,
          to,
        });
        return true;
      } catch (err) {
        console.error('Twilio SMS error:', err?.message || err);
        return false;
      }
    }
  }

  console.log('[SMS not configured – code for', to, ']:', code);
  return true;
}

export { isConfigured as isSmsConfigured };
