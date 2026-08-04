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
  const recipient = String(to || '').trim().toLowerCase();
  if (!recipient || !recipient.includes('@')) {
    console.error('[Email] Verification aborted: missing/invalid recipient. to=', to);
    return false;
  }
  console.log('[Email] Sending verification code to', recipient, '| from:', fromAddress);
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
    to: recipient,
    subject,
    text,
    html,
    envelope: {
      from: fromAddress,
      to: recipient,
    },
  };

  try {
    const info = await transport.sendMail(mailOptions);
    console.log('[Email] Verification code email sent successfully to', recipient, '| accepted:', info?.accepted);
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
 * נרמול כתובת נמען – חייבת להיות כתובת אמיתית של הלקוח, לא תיבת השליחה של המערכת.
 */
function normalizeRecipientEmail(to) {
  return String(to || '')
    .trim()
    .toLowerCase();
}

/**
 * Send 6-digit password reset code email.
 * Never throws – returns false on failure and logs errors.
 * חשוב: תמיד נשלח לכתובת שהלקוח הזין (to), עם envelope מפורש – לא לתיבת EMAIL_USER.
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

  const recipient = normalizeRecipientEmail(to);
  if (!recipient || !recipient.includes('@')) {
    console.error('[Email] Password reset aborted: missing/invalid recipient. to=', to);
    return false;
  }

  const systemMailbox = normalizeRecipientEmail(config.EMAIL_USER || config.SMTP_USER);
  if (systemMailbox && recipient === systemMailbox) {
    /* מותר רק אם הלקוח באמת ביקש איפוס לתיבה הזו (מנהל וכו') – לא חוסמים, רק מתריעים */
    console.warn('[Email] Password reset recipient equals system EMAIL_USER:', recipient);
  }

  const codeStr = String(code || '').trim().replace(/\D/g, '').slice(0, 6) || '000000';
  console.log('[Email] Sending password reset code to', recipient, '| from:', fromAddress);
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
    const info = await transport.sendMail({
      from: fromAddress,
      to: recipient,
      subject,
      text,
      html,
      /* envelope מפורש – מבטיח ש-SMTP ימסור לנמען הנכון ולא רק לתיבת השולח */
      envelope: {
        from: fromAddress,
        to: recipient,
      },
    });
    console.log('[Email] Password reset code sent to', recipient, '| accepted:', info?.accepted, '| rejected:', info?.rejected);
    if (Array.isArray(info?.rejected) && info.rejected.length > 0) {
      console.error('[Email] Password reset rejected recipients:', info.rejected);
      return false;
    }
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
      <p>יש לאשר בפאנל הניהול תחת <strong>מנהל ראשי (אישורים מיוחדים)</strong> אם הסכמת מראש.</p>
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
      <p>המנהל אישר את <strong>מועד התשלום</strong> שבחרת.</p>
      <p>כעת תוכל/י להגיש את טופס פתיחת התיק בלי להעלות אישור תשלום מיידי, לפי ההתחייבות לתאריך שלהלן.</p>
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

/**
 * לקוח קיבל אישור ראשון – צריך להזין תאריך יעד לתשלום (טווח התאריכים לפי החלטת המנהל בתצוגת האתר).
 */
export async function sendDeferredPaymentRequestApprovedAwaitingDate(to, name) {
  const config = getConfig();
  if (!config.isConfigured) {
    console.warn('[Email] Not configured. Cannot send awaiting-date email.');
    return false;
  }
  const transport = getTransporter();
  if (!transport) return false;

  const fromAddress = config.EMAIL_FROM || config.EMAIL_USER || config.SMTP_USER;
  if (!fromAddress || !(to || '').trim()) return false;

  const displayName = (name || '').trim() || 'משתמש';

  const subject = 'אושרה בקשתך – נא להזין מועד אחרון לתשלום';
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 520px;">
      <h2>שלום ${displayName},</h2>
      <p>בקשתך ל<strong>תשלום מאוחר</strong> בפתיחת התיק אושרה בשלב הראשון.</p>
      <p>היכנס/י לטופס פתיחת התיק באתר, ובחלק <strong>אישור תשלום</strong> הזינ/י את <strong>מועד היעד האחרון</strong> שאת/ה מתחייב/ת לשלם לסוכן, לפי האישור והלוח שמוצגים באתר.</p>
      <p>לאחר שתשלח/י את התאריך, המנהל הראשי יאשר אותו – ואז יוכלו להשלים את שליחת התיק בלי קובץ תשלום מיידי.</p>
      <hr style="border: none; border-top: 1px solid #eee;" />
      <p style="color: #888; font-size: 12px;">סוכן ביטוח</p>
    </div>
  `;
  const text = `שלום ${displayName},\nבקשת תשלום מאוחר אושרה בשלב ראשון. היכנסו לאתר לטופס פתיחת התיק והזינו מועד אחרון לתשלום.\nלאחר אישור המנהל לתאריך תוכלו להגיש את התיק.`;

  try {
    await transport.sendMail({ from: fromAddress, to: (to || '').trim(), subject, text, html });
    return true;
  } catch (err) {
    console.error('[Email] Awaiting date email failed:', err?.message || err);
    return false;
  }
}

/** המנהל דורש תאריך יעד מוקדם יותר מהתאריך שהלקוח הוציע */
export async function sendDeferredPaymentRequireEarlierDateEmail(to, name, rejectedProposedYmd) {
  const config = getConfig();
  if (!config.isConfigured) {
    console.warn('[Email] Not configured. Cannot send require-earlier-date email.');
    return false;
  }
  const transport = getTransporter();
  if (!transport) return false;

  const fromAddress = config.EMAIL_FROM || config.EMAIL_USER || config.SMTP_USER;
  if (!fromAddress || !(to || '').trim()) return false;

  const displayName = (name || '').trim() || 'משתמש';
  const dateStr = (rejectedProposedYmd || '').trim() || '—';

  const subject = 'נדרש תאריך תשלום מוקדם יותר';
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 520px;">
      <h2>שלום ${displayName},</h2>
      <p>המנהל בחן את מועד התשלום שהצעת (<strong>${dateStr}</strong>) ומבקש שתבחר/י <strong>תאריך מוקדם לפני</strong> מועד זה (לא כולל ${dateStr}).</p>
      <p>היכנס/י לטופס פתיחת התיק באתר, ושלח/י מחדש את תאריך היעד בעמוד אישור התשלום.</p>
      <hr style="border: none; border-top: 1px solid #eee;" />
      <p style="color: #888; font-size: 12px;">סוכן ביטוח</p>
    </div>
  `;
  const text = `שלום ${displayName},\nנדרש תאריך תשלום מוקדם יותר מהתאריך שהצעת (${dateStr}). היכנסו לאתר ובחרו תאריך לפני ${dateStr} (לא כולל).\n`;

  try {
    await transport.sendMail({ from: fromAddress, to: (to || '').trim(), subject, text, html });
    return true;
  } catch (err) {
    console.error('[Email] Require earlier date email failed:', err?.message || err);
    return false;
  }
}

/** לקוח שלח תאריך לתשלום – המנהל צריך לאשר */
export async function sendDeferredPaymentProposalSubmittedToAdmin(adminEmail, { clientName, clientEmail, clientId, proposedYmd }) {
  const config = getConfig();
  if (!config.isConfigured) {
    console.warn('[Email] Not configured. Cannot notify admin of proposal.');
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
  const dateStr = (proposedYmd || '').trim() || '—';

  const subject = 'תאריך תשלום הוצע על ידי לקוח – לאישור מנהל ראשי';
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 560px;">
      <h2>לקוח בחר מועד תשלום</h2>
      <p>יש לאשר או לדחות את התאריך ב<strong>פאנל מנהל ראשי → אישורים מיוחדים</strong>.</p>
      <ul style="padding-right: 20px;">
        <li><strong>שם:</strong> ${name}</li>
        <li><strong>אימייל:</strong> ${email}</li>
        <li><strong>מזהה:</strong> ${id}</li>
        <li><strong>תאריך שהוצע:</strong> ${dateStr}</li>
      </ul>
    </div>
  `;
  const text = `לקוח הציע תאריך תשלום: ${dateStr}\nשם: ${name}\nאימייל: ${email}\nמזהה: ${id}`;

  try {
    await transport.sendMail({ from: fromAddress, to, subject, text, html });
    return true;
  } catch (err) {
    console.error('[Email] Proposal to admin failed:', err?.message || err);
    return false;
  }
}

/**
 * תזכורת שבועית – אל תשכחו לשלם עד מועד הפירעון (תשלום מאוחר מאושר).
 */
export async function sendDeferredPaymentWeeklyReminderEmail(to, name, deadlineYmd) {
  const config = getConfig();
  if (!config.isConfigured) return false;
  const transport = getTransporter();
  if (!transport) return false;

  const fromAddress = config.EMAIL_FROM || config.EMAIL_USER || config.SMTP_USER;
  if (!fromAddress || !(to || '').trim()) return false;

  const displayName = (name || '').trim() || 'משתמש';
  const dateStr = (deadlineYmd || '').trim() || '—';

  const subject = 'תזכורת שבועית: מועד התשלום לסוכן עדיין פתוח';
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 520px;">
      <h2>שלום ${displayName},</h2>
      <p>זוהי <strong>תזכורת שבועית</strong> בנוגע להתחייבות התשלום לסוכן על פתיחת התיק.</p>
      <p><strong>מועד הפירעון שנקבע:</strong> ${dateStr}</p>
      <p>נא <strong>לא לשכוח להשלים את התשלום</strong> עד למועד זה. היעדר תשלום במועד עלול לעכב את הטיפול בתיק.</p>
      <p style="color: #555;">אם כבר שילמתם – אפשר להתעלם מהודעה זו.</p>
      <hr style="border: none; border-top: 1px solid #eee;" />
      <p style="color: #888; font-size: 12px;">סוכן ביטוח – הודעה אוטומטית</p>
    </div>
  `;
  const text = `שלום ${displayName},\nתזכורת שבועית: מועד התשלום לסוכן הוא ${dateStr}. נא לא לשכוח להשלים את התשלום עד למועד.\nאם כבר שילמתם – ניתן להתעלם.`;

  try {
    await transport.sendMail({
      from: fromAddress,
      to: (to || '').trim(),
      subject,
      text,
      html,
    });
    return true;
  } catch (err) {
    console.error('[Email] Weekly deferred reminder failed:', err?.message || err);
    return false;
  }
}

/**
 * יום הפירעון – אזהרה שהיום היום האחרון + השלכות אפשריות.
 */
export async function sendDeferredPaymentDueDateFinalWarningEmail(to, name, deadlineYmd) {
  const config = getConfig();
  if (!config.isConfigured) return false;
  const transport = getTransporter();
  if (!transport) return false;

  const fromAddress = config.EMAIL_FROM || config.EMAIL_USER || config.SMTP_USER;
  if (!fromAddress || !(to || '').trim()) return false;

  const displayName = (name || '').trim() || 'משתמש';
  const dateStr = (deadlineYmd || '').trim() || '—';

  const subject = 'אזהרה: היום האחרון לתשלום לסוכן לפי ההתחייבות';
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 540px;">
      <h2 style="color: #b71c1c;">שלום ${displayName},</h2>
      <p><strong>היום (${dateStr}) הוא יום הפירעון האחרון</strong> שקבעתם להשלמת התשלום לסוכן על פתיחת התיק, לפי האישור במערכת.</p>
      <p>נא <strong>להשלים את התשלום היום</strong>. אי־עמידה במועד עלולה, לפי נהלי העבודה, להוביל <strong>לסגירת או עצירת תהליך התיק</strong> ול<strong>השלכות שליליות</strong> נוספות.</p>
      <p>אם נדרש סידור או הבהרה – צרו קשר מיידי עם הסוכן.</p>
      <hr style="border: none; border-top: 1px solid #eee;" />
      <p style="color: #888; font-size: 12px;">סוכן ביטוח – הודעה אוטומטית</p>
    </div>
  `;
  const text = `שלום ${displayName},\nהיום (${dateStr}) הוא יום הפירעון האחרון לתשלום לסוכן. נא להשלים היום.\nאי-תשלום עלול להוביל לסגירת התיק והשלכות שליליות.\nצרו קשר עם הסוכן במידת הצורך.`;

  try {
    await transport.sendMail({
      from: fromAddress,
      to: (to || '').trim(),
      subject,
      text,
      html,
    });
    return true;
  } catch (err) {
    console.error('[Email] Due-date final warning failed:', err?.message || err);
    return false;
  }
}

async function sendStaffCaseStageEmail(toList, { subject, title, bodyHtml, bodyText, caseInfo }) {
  const config = getConfig();
  if (!config.isConfigured) {
    console.warn('[Email] Not configured. Cannot send case-stage staff email.');
    return false;
  }
  const transport = getTransporter();
  if (!transport) return false;
  const fromAddress = config.EMAIL_FROM || config.EMAIL_USER || config.SMTP_USER;
  const recipients = [...new Set((toList || []).map((e) => String(e || '').trim().toLowerCase()).filter(Boolean))];
  if (!fromAddress || recipients.length === 0) return false;

  const clientName = (caseInfo?.clientName || '').trim() || 'לקוח';
  const clientEmail = (caseInfo?.clientEmail || '').trim() || '—';
  const clientPhone = (caseInfo?.clientPhone || '').trim() || '—';
  const caseId = (caseInfo?.caseId || '').trim() || '—';
  const benefitType = (caseInfo?.benefitType || '').trim() || '—';
  const panelUrl = `${config.APP_BASE_URL.replace(/\/+$/, '')}/admin/case-processing`;

  const detailsHtml = `
    <ul style="padding-right: 20px;">
      <li><strong>שם לקוח:</strong> ${clientName}</li>
      <li><strong>אימייל לקוח:</strong> ${clientEmail}</li>
      <li><strong>טלפון:</strong> ${clientPhone}</li>
      <li><strong>סוג תיק:</strong> ${benefitType}</li>
      <li><strong>מזהה תיק:</strong> ${caseId}</li>
    </ul>
  `;
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 560px;">
      <h2>${title}</h2>
      ${bodyHtml}
      ${detailsHtml}
      <p><a href="${panelUrl}" style="display:inline-block;padding:10px 16px;background:#1e6bb8;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">לפאנל עיבוד תיקים</a></p>
      <hr style="border: none; border-top: 1px solid #eee;" />
      <p style="color: #888; font-size: 12px;">סוכן ביטוח – הודעה אוטומטית</p>
    </div>
  `;
  const text = `${title}\n\n${bodyText}\n\nשם: ${clientName}\nאימייל: ${clientEmail}\nטלפון: ${clientPhone}\nסוג: ${benefitType}\nמזהה: ${caseId}\n\n${panelUrl}`;

  try {
    await transport.sendMail({
      from: fromAddress,
      to: recipients.join(', '),
      subject,
      text,
      html,
    });
    console.log('[Email] Case-stage staff email sent to', recipients.join(', '));
    return true;
  } catch (err) {
    console.error('[Email] Case-stage staff email failed:', err?.message || err);
    return false;
  }
}

/**
 * שלב 1 – מחכה לראיון אישי → מייל ללפיד ויהודה.
 */
export async function sendAwaitingInterviewEmail(toList, caseInfo) {
  return sendStaffCaseStageEmail(toList, {
    subject: 'תיק ממתין לראיון אישי',
    title: 'תיק ממתין לראיון אישי',
    bodyHtml:
      '<p>התיק התקדם לשלב <strong>מחכה לראיון אישי</strong>.</p><p>נא לתאם ולבצע ראיון אישי עם הלקוח.</p>',
    bodyText: 'התיק ממתין לראיון אישי. נא לתאם ולבצע ראיון עם הלקוח.',
    caseInfo,
  });
}

/**
 * שלב 2 – נעשה ראיון, מחכה להגשת טפסים → מייל לשנאור.
 */
export async function sendAwaitingFormsEmail(toList, caseInfo) {
  return sendStaffCaseStageEmail(toList, {
    subject: 'תיק ממתין להגשת טפסים',
    title: 'נעשה ראיון – יש למלא / להגיש טפסים',
    bodyHtml:
      '<p>עודכן שבוצע <strong>ראיון אישי</strong>.</p><p>התיק ממתין כעת ל<strong>הגשת טפסים</strong> – נא להשלים את מילוי והגשת הטפסים מול הלקוח.</p>',
    bodyText: 'נעשה ראיון. התיק ממתין להגשת טפסים – נא להשלים מילוי והגשה מול הלקוח.',
    caseInfo,
  });
}
