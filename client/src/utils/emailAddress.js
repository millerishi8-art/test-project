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

export function mistypedEmailMessage(email, language = 'he') {
  const typed = String(email || '').trim();
  const suggestion = mistypedEmailSuggestion(email);
  if (!suggestion) return '';
  if (language === 'en') {
    return `There is a mistake in the email. You wrote ${typed}. That address does not exist, so no code was sent. Write this instead: ${suggestion}`;
  }
  return `יש טעות בכתיבת האימייל. כתבת ${typed}, והכתובת הזאת לא קיימת. לא נשלח קוד. כתוב במקום זה: ${suggestion}`;
}

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
