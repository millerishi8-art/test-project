import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/** נוסח שנשמר עם כל חתימה, זהה למסמך ולנוסח בצד הלקוח. */
export const CREDIT_AGREEMENT_TYPE = 'credit_agreement';

export const CREDIT_ID_DOC_TYPES = new Set(['passport', 'us_license', 'us_id']);

export const CREDIT_AGREEMENT_TEXT = {
  kicker: 'הסכם פרטי',
  title: 'הסכם מסגרת אשראי',
  sub: 'בין הלקוח לבין יוד גרונברג. זהו הסכם בין הצדדים, לא מסמך של חברת אשראי.',
  lead: 'הצדדים קובעים כאן, בכתב, את אופן השימוש במסגרת האשראי של הלקוח, את תקופת ההגבלה, ואת תנאי ההטבה.',
  sections: [
    {
      title: 'הפרטים והשימוש במסגרת האשראי.',
      items: [
        'ההסכם עוסק במסגרת האשראי של הלקוח ששמו נקוב בראש המסמך.',
        'יוד גרונברג ישתמש במסגרת האשראי של הלקוח, לפי תנאי הסכם זה.',
        'במשך חמש שנים מיום החתימה הלקוח לא ישתמש במסגרת האשראי שלו.',
        'הלקוח מצהיר כי בתקופה זו אין לו צורך באשראי אמריקאי.',
      ],
    },
    {
      title: 'איסור פתיחת אשראי אמריקאי, וההטבה.',
      items: [
        'במשך אותן חמש שנים אסור ללקוח לפתוח אשראי אמריקאי.',
        'פתיחת אשראי אמריקאי בתקופה זו תמנע מהלקוח את הזכאות להטבה.',
        'ההטבה היא 1,000 דולר ארה״ב, בסוף השנה הקלנדרית 2027, נכון למועד חתימת הסכם זה.',
        'אם הלקוח יפר אחד מתנאי ההסכם, לא יהיה זכאי להטבה זו.',
      ],
    },
    {
      title: 'חריגה ממסגרת האשראי.',
      items: [
        'אם תהיה חריגה מתשלום מסגרת האשראי, החשבון ייסגר למשך שנתיים.',
        'במקרה כזה הלקוח יוכל לקבל הטבה של 1,000 דולר ארה״ב.',
        'רק לאחר שנתיים יוכל הלקוח לפתוח מחדש את מסגרת האשראי.',
      ],
    },
  ],
  signatureTitle: 'חתימה.',
  signatureClause:
    'כל צד קרא את ההסכם, הבין אותו, וחותם עליו מרצונו. חתימה על המסך, באצבע או בעכבר, היא חתימת הצד על הסכם זה.',
  agentName: 'יוד גרונברג',
};

const signaturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../assets/yod-grunberg-signature.png'
);

let cachedAgentSignature = null;

export function getAgentSignatureDataUrl() {
  if (cachedAgentSignature) return cachedAgentSignature;
  const raw = fs.readFileSync(signaturePath);
  cachedAgentSignature = `data:image/png;base64,${raw.toString('base64')}`;
  return cachedAgentSignature;
}

/** מחזיר XXX-XX-XXXX או null אם אין 9 ספרות. */
export function normalizeSsn(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length !== 9) return null;
  if (/^0+$/.test(digits)) return null;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}
