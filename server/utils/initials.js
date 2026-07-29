/**
 * מיפוי אות עברית ראשונה לאות לטינית (קירוב מקובל לשמות).
 * לדוגמה: יצחק → Y, פז → P.
 */
const HEBREW_TO_LATIN = {
  א: 'A',
  ב: 'B',
  ג: 'G',
  ד: 'D',
  ה: 'H',
  ו: 'V',
  ז: 'Z',
  ח: 'H',
  ט: 'T',
  י: 'Y',
  כ: 'K',
  ך: 'K',
  ל: 'L',
  מ: 'M',
  ם: 'M',
  נ: 'N',
  ן: 'N',
  ס: 'S',
  ע: 'A',
  פ: 'P',
  ף: 'P',
  צ: 'Z',
  ץ: 'Z',
  ק: 'K',
  ר: 'R',
  ש: 'S',
  ת: 'T',
};

function firstLatinFromToken(token) {
  const t = String(token || '').trim();
  if (!t) return '';
  for (const ch of t) {
    if (/[A-Za-z]/.test(ch)) return ch.toUpperCase();
    if (HEBREW_TO_LATIN[ch]) return HEBREW_TO_LATIN[ch];
  }
  return '';
}

function latinLettersFromToken(token) {
  const out = [];
  for (const ch of String(token || '')) {
    if (/[A-Za-z]/.test(ch)) out.push(ch.toUpperCase());
    else if (HEBREW_TO_LATIN[ch]) out.push(HEBREW_TO_LATIN[ch]);
  }
  return out;
}

/**
 * מחלץ ראשי תיבות באורך 2 אותיות לטיניות גדולות משם מלא.
 * דוגמאות: "יצחק פז" → "YP", "Yehuda Cohen" → "YC", "יהודה" → "YH"
 */
export function getInitials(fullName) {
  const cleaned = String(fullName || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!cleaned) return '??';

  const parts = cleaned.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    const a = firstLatinFromToken(parts[0]);
    const b = firstLatinFromToken(parts[parts.length - 1]);
    const pair = `${a}${b}`;
    if (pair.length === 2) return pair;
  }

  const letters = latinLettersFromToken(parts[0] || cleaned);
  if (letters.length >= 2) return `${letters[0]}${letters[1]}`;
  if (letters.length === 1) return `${letters[0]}${letters[0]}`;
  return '??';
}
