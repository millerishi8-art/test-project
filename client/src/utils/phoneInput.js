/**
 * קלט מספר טלפון בינלאומי – הרשמה ואימות
 */

export const PHONE_COUNTRIES = [
  { id: 'IL', dial: '972', label: 'ישראל (+972)' },
  { id: 'US', dial: '1', label: 'ארה"ב / קנדה (+1)' },
  { id: 'GB', dial: '44', label: 'בריטניה (+44)' },
  { id: 'FR', dial: '33', label: 'צרפת (+33)' },
  { id: 'DE', dial: '49', label: 'גרמניה (+49)' },
  { id: 'AU', dial: '61', label: 'אוסטרליה (+61)' },
  { id: 'OTHER', dial: '', label: 'מדינה אחרת…' },
];

export function sanitizePhoneDigits(value, maxLen = 15) {
  return String(value || '')
    .replace(/\D/g, '')
    .slice(0, maxLen);
}

/** מסיר 0 מוביל במספר ישראלי (050… → 50…) */
export function normalizeNationalNumber(countryId, digits) {
  let d = sanitizePhoneDigits(digits);
  if (countryId === 'IL' && d.startsWith('0')) {
    d = d.slice(1);
  }
  return d;
}

export function getDialCode(countryId, customDial) {
  if (countryId === 'OTHER') {
    const d = sanitizePhoneDigits(customDial, 4);
    return d || null;
  }
  const row = PHONE_COUNTRIES.find((c) => c.id === countryId);
  return row?.dial || null;
}

export function getPhonePlaceholder(countryId) {
  switch (countryId) {
    case 'IL':
      return '501234567';
    case 'US':
      return '9296518827';
    case 'GB':
      return '7911123456';
    case 'FR':
      return '612345678';
    default:
      return 'מספר ללא קידומת';
  }
}

/**
 * @returns {{ ok: true, e164: string } | { ok: false, error: string }}
 */
export function validatePhoneInput(countryId, nationalDigits, customDial) {
  const dial = getDialCode(countryId, customDial);
  if (!dial) {
    return { ok: false, error: 'הזן קידומת מדינה (למשל 1 לארה"ב, 44 לבריטניה)' };
  }

  const national = normalizeNationalNumber(countryId, nationalDigits);
  if (!national) {
    return { ok: false, error: 'הזן מספר טלפון' };
  }

  if (countryId === 'IL') {
    if (national.length !== 9 || !/^[5-9]/.test(national)) {
      return {
        ok: false,
        error: 'מספר ישראלי: 9 ספרות (למשל 501234567). אפשר גם עם 0 בהתחלה.',
      };
    }
  } else if (countryId === 'US') {
    if (national.length !== 10 || national[0] === '0' || national[0] === '1') {
      return {
        ok: false,
        error: 'מספר אמריקאי: 10 ספרות כולל אזור (למשל 9296518827)',
      };
    }
  } else if (national.length < 7 || national.length > 14) {
    return { ok: false, error: 'מספר טלפון: בין 7 ל-14 ספרות (ללא קידומת המדינה)' };
  }

  return { ok: true, e164: `+${dial}${national}` };
}
