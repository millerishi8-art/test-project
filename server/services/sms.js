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

/** מנרמל מספר טלפון לפורמט בינלאומי E.164 (למשל +972…, +1…) */
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';

  // כבר בפורמט בינלאומי (+972… / +1…)
  if (trimmed.startsWith('+') && digits.length >= 8) {
    return '+' + digits;
  }

  // ישראל: 0501234567 (10 ספרות)
  if (digits.length === 10 && digits.startsWith('0')) {
    return '+972' + digits.slice(1);
  }
  // ישראל: לעיתים מוקלד עם ספרה עודפת (11 ספרות שמתחילות ב-05) – לוקחים 10 הראשונות
  if (digits.length === 11 && digits.startsWith('05')) {
    return '+972' + digits.slice(1, 10);
  }
  // ישראל: 501234567
  if (digits.length === 9 && /^[5-9]/.test(digits)) {
    return '+972' + digits;
  }
  // ישראל: 972501234567
  if (digits.startsWith('972') && digits.length >= 11) {
    return '+' + digits;
  }

  // ארה"ב/קנדה: 19296518827
  if (digits.length === 11 && digits.startsWith('1')) {
    return '+' + digits;
  }
  // ארה"ב/קנדה: 9296518827 (10 ספרות, אזור לא מתחיל ב-0/1)
  if (digits.length === 10 && /^[2-9]/.test(digits)) {
    return '+1' + digits;
  }

  if (digits.length >= 10) {
    return '+' + digits;
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

/**
 * שליחת SMS כללי (התראות לעובדים וכו').
 * @returns {Promise<boolean>}
 */
export async function sendSmsMessage(phone, message) {
  const to = normalizePhone(phone);
  const body = String(message || '').trim();
  if (!to || !body) {
    console.warn('SMS: missing phone or message');
    return false;
  }

  if (isConfigured) {
    const client = await getTwilioClient();
    if (client) {
      try {
        await client.messages.create({
          body,
          from: TWILIO_PHONE_NUMBER,
          to,
        });
        console.log('[SMS] Sent to', to);
        return true;
      } catch (err) {
        console.error('Twilio SMS error:', err?.message || err);
        return false;
      }
    }
  }

  console.log('[SMS not configured – message for', to, ']:', body);
  return false;
}

export { isConfigured as isSmsConfigured, normalizePhone };
