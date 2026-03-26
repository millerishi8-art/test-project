import nodemailer from 'nodemailer';

/** Uses process.env.EMAIL_USER and process.env.EMAIL_PASS for Gmail; or SMTP_* for custom SMTP. */
function getConfig() {
  const EMAIL_USER = (process.env.EMAIL_USER || '').trim();
  const EMAIL_PASS = (process.env.EMAIL_PASS || '').trim();
  const SMTP_HOST = (process.env.SMTP_HOST || '').trim();
  const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
  const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
  const SMTP_USER = (process.env.SMTP_USER || '').trim();
  const SMTP_PASS = (process.env.SMTP_PASS || '').trim();
  const EMAIL_FROM = (process.env.EMAIL_FROM || '').trim() || EMAIL_USER || SMTP_USER;
  const APP_BASE_URL = (process.env.APP_BASE_URL || '').trim() || 'http://localhost:3000';

  const useGmail = Boolean(EMAIL_USER && EMAIL_PASS);
  const useSmtp = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
  const isConfigured = useGmail || useSmtp;

  return {
    EMAIL_USER,
    EMAIL_PASS,
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
    EMAIL_FROM,
    APP_BASE_URL,
    isConfigured,
    useGmail,
    useSmtp,
  };
}

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const config = getConfig();
  if (!config.isConfigured) return null;

  try {
    if (config.useGmail) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: config.EMAIL_USER,
          pass: config.EMAIL_PASS,
        },
      });
    } else {
      transporter = nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_SECURE,
        auth: {
          user: config.SMTP_USER,
          pass: config.SMTP_PASS,
        },
      });
    }
    return transporter;
  } catch (err) {
    console.error('[Email] Failed to create transporter:', err?.message || err);
    return null;
  }
}

export function isEmailConfigured() {
  const config = getConfig();
  if (!config.isConfigured) return false;
  return getTransporter() !== null;
}

/**
 * Send 6-digit verification code email (no link).
 * Never throws – returns false on failure and logs errors.
 */
export async function sendVerificationCodeEmail(to, name, code) {



  const config = getConfig();
  if (!config.isConfigured) {

    console.warn('[Email] Not configured. Set EMAIL_USER and EMAIL_PASS (for Gmail) in server/.env.');
    return false;
  }

  const transport = getTransporter();
  if (!transport) {
    console.error('[Email] Transporter not available.');
    return false;
  }

  const fromAddress = config.EMAIL_FROM || config.EMAIL_USER || config.SMTP_USER;
  if (!fromAddress) {
    console.error('[Email] No from address (EMAIL_USER or SMTP_USER).');
    return false;
  }

  const codeStr = String(code || '').trim().replace(/\D/g, '').slice(0, 6) || '000000';
  console.log('[Email] Sending verification code to', (to || '').trim(), '| from:', fromAddress);
  const subject = 'קוד אימות – סוכן ביטוח';
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px;">
      <h2>שלום ${name || 'משתמש'},</h2>
      <p>קוד האימות שלך הוא:</p>
      <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${codeStr}</p>
      <p>הזן את הקוד באתר כדי לאמת את כתובת האימייל.</p>
      <p>הקוד תקף ל-15 דקות.</p>
      <hr style="border: none; border-top: 1px solid #eee;" />
      <p style="color: #888; font-size: 12px;">סוכן ביטוח</p>
    </div>
  `;
  const text = `שלום ${name || 'משתמש'},\n\nקוד האימות שלך: ${codeStr}\n\nהזן את הקוד באתר. הקוד תקף ל-15 דקות.`;

  const mailOptions = {
    from: fromAddress,
    to: (to || '').trim(),
    subject,
    text,
    html,
  };

  try {
    await transport.sendMail(mailOptions);
    console.log('[Email] Verification code email sent successfully to', (to || '').trim());
    return true;
  } catch (err) {
    const msg = err?.message || String(err);
    const errCode = err?.code || err?.responseCode;
    console.error('[Email] Send verification code failed – full error for Vercel/debug:', {
      message: msg,
      code: errCode,
      response: err?.response,
      responseCode: err?.responseCode,
      command: err?.command,
      stack: err?.stack,
    });
    if (errCode) console.error('[Email] Error code:', errCode);
    if (err?.response) console.error('[Email] SMTP response:', err.response);
    if (errCode === 534 || msg.includes('Application-specific password') || msg.includes('app password') || msg.includes('Authentication')) {
      console.error('[Email] Gmail requires an App Password (EMAIL_PASS). Use process.env.EMAIL_USER and process.env.EMAIL_PASS.');
    }
    return false;
  }
}

/**
 * Send 6-digit password reset code email.
 * Never throws – returns false on failure and logs errors.
 */
export async function sendPasswordResetCodeEmail(to, name, code) {
  const config = getConfig();
  if (!config.isConfigured) {
    console.warn('[Email] Not configured. Cannot send password reset code.');
    return false;
  }

  const transport = getTransporter();
  if (!transport) return false;

  const fromAddress = config.EMAIL_FROM || config.EMAIL_USER || config.SMTP_USER;
  if (!fromAddress) return false;

  const codeStr = String(code || '').trim().replace(/\D/g, '').slice(0, 6) || '000000';
  console.log('[Email] Sending password reset code to', (to || '').trim());
  const subject = 'קוד איפוס סיסמה – סוכן ביטוח';
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px;">
      <h2>שלום ${name || 'משתמש'},</h2>
      <p>קוד איפוס הסיסמה שלך הוא:</p>
      <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${codeStr}</p>
      <p>הזן את הקוד בדף ההתחברות ובחר סיסמה חדשה.</p>
      <p>הקוד תקף ל-15 דקות.</p>
      <hr style="border: none; border-top: 1px solid #eee;" />
      <p style="color: #888; font-size: 12px;">סוכן ביטוח</p>
    </div>
  `;
  const text = `שלום ${name || 'משתמש'},\n\nקוד איפוס הסיסמה: ${codeStr}\n\nהזן את הקוד באתר ובחר סיסמה חדשה. הקוד תקף ל-15 דקות.`;

  try {
    await transport.sendMail({
      from: fromAddress,
      to: (to || '').trim(),
      subject,
      text,
      html,
    });
    console.log('[Email] Password reset code sent to', (to || '').trim());
    return true;
  } catch (err) {
    console.error('[Email] Send password reset code failed:', err?.message || err);
    return false;
  }
}

/**
 * מייל למנהל – לקוח ביקש להמשיך בפתיחת תיק בלי אישור תשלום מיידי.
 * Never throws – returns false on failure.
 */
export async function sendDeferredPaymentRequestToAdmin(adminEmail, { clientName, clientEmail, clientId }) {
  const config = getConfig();
  if (!config.isConfigured) {
    console.warn('[Email] Not configured. Cannot send deferred payment request.');
    return false;
  }
  const transport = getTransporter();
  if (!transport) return false;

  const fromAddress = config.EMAIL_FROM || config.EMAIL_USER || config.SMTP_USER;
  if (!fromAddress || !(adminEmail || '').trim()) return false;

  const to = (adminEmail || '').trim();
  const name = (clientName || '').trim() || 'לקוח';
  const email = (clientEmail || '').trim() || '—';
  const id = (clientId || '').trim() || '—';

  const subject = 'בקשה לאישור תשלום מאוחר – פתיחת תיק (פוד סטאמפס)';
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 560px;">
      <h2>בקשה לאישור מנהל</h2>
      <p>לקוח ביקש <strong>להגיש את התיק ולשלם במועד מאוחר יותר</strong> (ללא העלאת אישור תשלום מיידי).</p>
      <ul style="padding-right: 20px;">
        <li><strong>שם:</strong> ${name}</li>
        <li><strong>אימייל:</strong> ${email}</li>
        <li><strong>מזהה משתמש:</strong> ${id}</li>
      </ul>
      <p>יש לאשר בפאנל הניהול (משתמשים) אם הסכמת מראש – לאחר האישור הלקוח יוכל לשלוח את הטופס בלי קובץ תשלום ויקבל התחייבות לתאריך יעד.</p>
      <hr style="border: none; border-top: 1px solid #eee;" />
      <p style="color: #888; font-size: 12px;">סוכן ביטוח – הודעה אוטומטית</p>
    </div>
  `;
  const text = `בקשה לתשלום מאוחר\nשם: ${name}\nאימייל: ${email}\nמזהה: ${id}\n\nאשר בפאנל הניהול אם רלוונטי.`;

  try {
    await transport.sendMail({ from: fromAddress, to, subject, text, html });
    console.log('[Email] Deferred payment request sent to admin', to);
    return true;
  } catch (err) {
    console.error('[Email] Deferred payment request failed:', err?.message || err);
    return false;
  }
}

/**
 * מייל ללקוח – אושר תשלום מאוחר עם מועד יעד.
 */
export async function sendDeferredPaymentApprovedToClient(to, name, deadlineIso) {
  const config = getConfig();
  if (!config.isConfigured) {
    console.warn('[Email] Not configured. Cannot send deferred payment approved email.');
    return false;
  }
  const transport = getTransporter();
  if (!transport) return false;

  const fromAddress = config.EMAIL_FROM || config.EMAIL_USER || config.SMTP_USER;
  if (!fromAddress || !(to || '').trim()) return false;

  const deadlineStr = deadlineIso ? String(deadlineIso) : '';
  const displayName = (name || '').trim() || 'משתמש';

  const subject = 'אושר: תשלום מאוחר לפתיחת התיק';
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 520px;">
      <h2>שלום ${displayName},</h2>
      <p>בקשתך ל<strong>תשלום מאוחר</strong> אושרה על ידי המנהל.</p>
      <p>כעת תוכל/י להגיש את טופס פתיחת התיק בלי להעלות אישור תשלום מיידי.</p>
      <p><strong>מועד יעד להשלמת התשלום לסוכן:</strong> ${deadlineStr}</p>
      <p style="color: #444;">יש להשלים את התשלום עד לתאריך זה (או לפי הסכם שעודכן עם המנהל).</p>
      <hr style="border: none; border-top: 1px solid #eee;" />
      <p style="color: #888; font-size: 12px;">סוכן ביטוח</p>
    </div>
  `;
  const text = `שלום ${displayName},\nאושר תשלום מאוחר. מועד יעד להשלמת התשלום: ${deadlineStr}\nהגש את הטופס באתר ללא אישור תשלום מיידי.`;

  try {
    await transport.sendMail({ from: fromAddress, to: (to || '').trim(), subject, text, html });
    return true;
  } catch (err) {
    console.error('[Email] Deferred payment approved email failed:', err?.message || err);
    return false;
  }
}
