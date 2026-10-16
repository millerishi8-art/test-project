import dns from 'dns/promises';

/** שגיאות כתיב נפוצות. שליחה לכתובת כזו חוזרת לתיבת השולח עם הקוד. */
const TYPO_DOMAINS = {
  'gimal.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.comm': 'gmail.com',
  'gmail.om': 'gmail.com',
  'gmaul.com': 'gmail.com',
  'gimail.com': 'gmail.com',
  'gemail.com': 'gmail.com',
  'gmil.com': 'gmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotmil.com': 'hotmail.com',
  'yahooo.com': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outlook.co': 'outlook.com',
  'icloud.co': 'icloud.com',
  'walla.co': 'walla.co.il',
};

export function mistypedEmailSuggestion(email) {
  const raw = String(email || '').trim().toLowerCase();
  const at = raw.lastIndexOf('@');
  if (at < 1) return null;
  const local = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  const fixed = TYPO_DOMAINS[domain];
  if (!fixed || !local) return null;
  return `${local}@${fixed}`;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve('timeout'), ms)),
  ]);
}

async function domainCanReceiveMail(domain) {
  const mx = await withTimeout(dns.resolveMx(domain).catch((err) => err), 2500);
  if (mx === 'timeout') return true;
  if (Array.isArray(mx) && mx.length > 0) return true;
  if (mx && mx.code && mx.code !== 'ENOTFOUND' && mx.code !== 'ENODATA') return true;

  const a = await withTimeout(dns.resolve4(domain).catch((err) => err), 2500);
  if (a === 'timeout') return true;
  if (Array.isArray(a) && a.length > 0) return true;
  if (a && a.code && a.code !== 'ENOTFOUND' && a.code !== 'ENODATA') return true;
  return false;
}

/**
 * אם אסור לשלוח — חוזרת סיבת הסירוב. אחרת null.
 * כתובת שלא קיימת מקפיצה את הקוד חזרה לתיבת Gmail של האתר.
 */
export async function recipientBounceRisk(email) {
  const raw = String(email || '').trim().toLowerCase();
  const suggestion = mistypedEmailSuggestion(raw);
  if (suggestion) {
    return {
      error: `יש טעות בכתיבת האימייל. כתבת ${raw}, והכתובת הזאת לא קיימת. לא נשלח קוד. כתוב במקום זה: ${suggestion}`,
      code: 'EMAIL_TYPO',
      suggestion,
    };
  }
  const domain = raw.split('@')[1] || '';
  if (!domain || !domain.includes('.')) {
    return {
      error: 'יש טעות בכתיבת האימייל. הכתובת לא תקינה, ולכן לא נשלח קוד אימות.',
      code: 'EMAIL_UNDELIVERABLE',
    };
  }
  const canReceive = await domainCanReceiveMail(domain);
  if (!canReceive) {
    return {
      error: `יש טעות בכתיבת האימייל. הכתובת ${raw} לא קיימת, ולכן לא נשלח קוד אימות. בדוק כל אות ונסה שוב.`,
      code: 'EMAIL_UNDELIVERABLE',
    };
  }
  return null;
}
