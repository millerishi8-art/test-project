/**
 * נוסח פתיחה להסכם עבודה.
 * ליאור: הנוסח החתום מתוך heskem-noam-lior.
 * מיכל: הנוסח הקיים, עדיין בלי חתימות.
 * מנחם ושאר העובדים: טיוטה שאפשר לערוך עד החתימה.
 */

function draftAgreement(email, name, roleLine, payLines) {
  return {
    employeeEmail: email,
    employeeName: name,
    employerName: 'נעם מילר',
    employerId: '',
    employeeId: '',
    title: 'הסכם שיתוף פעולה',
    kicker: 'הסכם עבודה',
    dateLabel: '',
    intro: `${name} ונעם מבקשים לעבוד יחד מתוך אמון, בהירות וכבוד הדדי. את השכר ואת הסעיפים אפשר לערוך לפני החתימה, וכל עובד רואה רק את ההסכם שלו.`,
    sections: [
      { title: 'תפקיד.', items: [roleLine] },
      { title: 'תמורה.', items: payLines },
      {
        title: 'עבודה דרך האתר.',
        items: ['כל העבודה לפי הסכם זה תיעשה דרך האתר, ולא בערוץ אחר.'],
      },
      {
        title: 'שמירה על מידע לקוחות.',
        items: ['העובד לא יעשה שימוש שלא כדין במידע של לקוחות, ולא ישתף אותו עם אף אדם.'],
      },
      {
        title: 'שינוי וחתימה.',
        items: [
          'לפני החתימה נעם יכול לערוך את השכר ואת הסעיפים. אחרי ששני הצדדים חתמו, ההסכם נשמר ואינו ניתן לעריכה, אלא במקרה חריג.',
        ],
      },
    ],
  };
}

const LIOR = {
  employeeEmail: 'lioranwork770@gmail.com',
  employeeName: 'ליאור הלוי',
  employerName: 'נעם מילר',
  employerId: '',
  employeeId: '',
  title: 'נועם וליאור הלוי',
  kicker: 'הסכם עבודה',
  dateLabel: '25 באוקטובר 2026',
  intro:
    'נועם וליאור מבקשים לעבוד יחד ברוגע ובבהירות. המסמך הזה מתאר את תפקידה של ליאור, את התמורה, ואת הדרך שבה שומרים על לקוחות.',
  sections: [
    {
      title: 'תפקיד.',
      items: ['תפקידה של ליאור הוא פתיחת מסמכים והגשת טפסים בלבד.'],
    },
    {
      title: 'תמורה.',
      items: [
        'התשלום לליאור הוא רק ורק עבור הגשת טפסים ופתיחת מסמכים, בתעריף של 20 דולר ארה״ב לשעה.',
        'אם ליאור מסיימת תיק מלא של הגשת טפסים, היא רשאית להגיש תיק נוסף באותה שעה, ולקבל 20 דולר ארה״ב לתיק.',
        'בין שני החישובים יחול הגבוה מביניהם: 20 דולר לשעה, או 20 דולר לתיק.',
      ],
    },
    {
      title: 'איסור עבודה מהצד.',
      items: [
        'ליאור לא תעבוד מהצד במקביל להסכם זה, ולא תרחיב את העבודה מעבר לפתיחת מסמכים או להגשת טפסים, בלי ראיונות ובלי פתיחת תיקים.',
        'לצד זאת, ליאור רשאית תמיד להביא לידים מהצד, כדי ליצור לקוחות באתר. הליד יכול להיות כל אדם אמריקאי. ליאור יכולה לפנות אליו ולומר לו למלא את פרטיו באתר. מכאן והלאה הדברים מתנהלים מעצמם, והצד של נועם יטפל בכך בהתאם.',
      ],
    },
    {
      title: 'שמירה על מידע לקוחות.',
      items: ['ליאור לא תעשה שימוש שלא כדין במידע של לקוחות, ולא תשתף אותו עם אף אדם.'],
    },
    {
      title: 'אחריות.',
      items: [
        'במקרה הבלתי סביר, ואנו מקווים כמובן שלא יקרה, אם ייגרם לנועם נזק עד סך של 30,000 דולר ארה״ב, יינקטו הליכים משפטיים נגד מי שיימצא אחראי. האחריות לא תעלה על סכום זה.',
      ],
    },
    {
      title: 'שינוי וחתימה.',
      items: ['שינוי בהסכם יהיה בכתב ובהסכמת שני הצדדים. כל צד קרא את ההסכם וחותם עליו מרצונו.'],
    },
  ],
  employerSignature: 'data:image/png;base64,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',
  employeeSignature: 'data:image/png;base64,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',
};

const MICHAL = {
  employeeEmail: 'michalhezi2@gmail.com',
  employeeName: 'מיכל',
  employerName: 'נעם מילר',
  employerId: '',
  employeeId: '',
  title: 'הסכם שיתוף פעולה',
  kicker: 'הסכם עבודה',
  dateLabel: '25 באוקטובר 2026',
  intro:
    'מיכל ונעם מבקשים לעבוד יחד מתוך אמון, בהירות וכבוד הדדי. הסכם זה קובע מראש, ובשפה פשוטה, את דרך העבודה ואת התמורה, כדי ששני הצדדים יידעו בדיוק על מה הוסכם.',
  sections: [
    {
      title: 'מטרת ההסכם.',
      items: [
        'ההסכם מסדיר את עבודתה של מיכל עם נעם: פתיחת תיקים, קיום ראיונות, הכנת מסמכים, וטיפול בלידים שמיכל מביאה מצדה.',
      ],
    },
    {
      title: 'פתיחת תיק.',
      items: [
        'עבור כל פתיחת תיק ישולם למיכל 15 דולר ארה״ב לתיק.',
        'זהו תשלום קבוע, והוא חל על כל פתיחת תיק.',
        'אם פתיחת התיק נמשכת פחות משעה, התשלום נשאר 15 דולר לתיק. במצב זה התעריף בפועל לשעה גבוה מ־15 דולר לשעה.',
      ],
    },
    {
      title: 'ראיונות.',
      items: [
        'ראיון יחויב בתעריף של 20 דולר ארה״ב לשעה.',
        'גם אם הראיון נמשך מעבר לשעה, התעריף נשאר 20 דולר לשעה, ללא תוספת.',
      ],
    },
    {
      title: 'הכנת מסמכים.',
      items: ['הכנת מסמכים תחויב בתעריף של 20 דולר ארה״ב לשעה.'],
    },
    {
      title: 'לידים שמיכל מביאה.',
      items: [
        'בתיק שמקורו בליד שמיכל הביאה מצדה, רווח התיק יחולק שווה בשווה: מחצית למיכל ומחצית לנעם.',
        'את התיקים האלה מיכל פותחת בעצמה, בזמנה הפרטי, וללא תשלום מנעם עבור הפתיחה. זה חלק מהסדר הלידים.',
        'תעריף 15 הדולר לפתיחת תיק, הקבוע בסעיף פתיחת תיק, אינו חל על פתיחת תיק ליד.',
      ],
    },
    {
      title: 'עבודה דרך האתר.',
      items: ['כל העבודה לפי הסכם זה תיעשה דרך האתר, ולא בערוץ אחר.'],
    },
    {
      title: 'עבודה במקביל ולקוחות.',
      items: ['מיכל לא תפתח תיקים בצד, במקביל לעבודה לפי הסכם זה, ולא תיקח אליה את לקוחותיו של נעם.'],
    },
    {
      title: 'כללי.',
      items: [
        'שינוי בהסכם ייעשה בכתב ובהסכמת שני הצדדים.',
        'כל צד קרא את ההסכם, הבין את תנאיו, וחותם עליו מרצונו החופשי.',
      ],
    },
  ],
};

const NAMED = {
  'lioranwork770@gmail.com': LIOR,
  'michalhezi2@gmail.com': MICHAL,
  'workmiller770@gmail.com': draftAgreement(
    'workmiller770@gmail.com',
    'מנחם פפר',
    'תפקידו של מנחם הוא קיום ראיונות.',
    [
      'ראיון יחויב בתעריף של 20 דולר ארה״ב לשעה.',
      'את התעריף ואת שאר הסעיפים אפשר לערוך לפני ששני הצדדים חותמים.',
    ]
  ),
};

export function buildStaffAgreementSeed(email, name) {
  const key = String(email || '').trim().toLowerCase();
  if (NAMED[key]) {
    return {
      ...NAMED[key],
      employeeEmail: key,
      sections: NAMED[key].sections.map((section) => ({
        title: section.title,
        items: [...section.items],
      })),
    };
  }
  const displayName = String(name || '').trim() || key;
  return draftAgreement(
    key,
    displayName,
    'תפקיד העובד יוגדר כאן.',
    ['השכר יוגדר כאן, לפי שעה או לפי תיק.']
  );
}
