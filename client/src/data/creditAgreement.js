/** נוסח הסכם מסגרת האשראי — זהה למסמך שנמסר לחתימה. */
export const CREDIT_AGREEMENT_TYPE = 'credit_agreement';

export const AGENT_SIGNATURE_SRC = '/signatures/yod-grunberg-signature.png';

export const CREDIT_AGREEMENT = {
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
};

export const ID_DOC_TYPES = [
  { value: 'passport', he: 'דרכון', en: 'Passport' },
  { value: 'us_license', he: 'רישיון נהיגה אמריקאי', en: 'U.S. driver license' },
  { value: 'us_id', he: 'תעודת זהות אמריקאית', en: 'U.S. ID card' },
];

export function idDocLabel(type, language = 'he') {
  const row = ID_DOC_TYPES.find((item) => item.value === type);
  if (!row) return type || '';
  return language === 'en' ? row.en : row.he;
}

export function localTodayYyyyMmDd() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function formatSignDate(iso) {
  const str = String(iso || '').trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return str;
  return `${match[3]}/${match[2]}/${match[1]}`;
}
