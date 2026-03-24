import { ISO_3166_1_ALPHA2 } from '../data/iso3166Alpha2Codes.js';

/**
 * אפשרויות למפתח select: { value: קוד ISO2, label: שם מוצג לפי שפה }
 * ארה״ב לא מוצגת – האזרחות הנוספת היא מלבד האמריקאית.
 */
export function buildCountrySelectOptions(locale) {
  const lang = locale === 'he' ? 'he-IL' : 'en-US';
  const codes = ISO_3166_1_ALPHA2.filter((c) => c !== 'US');
  let dn;
  try {
    dn = new Intl.DisplayNames([lang], { type: 'region' });
  } catch {
    dn = null;
  }
  const opts = codes.map((code) => {
    let label = code;
    if (dn) {
      try {
        label = dn.of(code) || code;
      } catch {
        label = code;
      }
    }
    return { value: code, label };
  });
  opts.sort((a, b) => a.label.localeCompare(b.label, lang, { sensitivity: 'base' }));
  return opts;
}
