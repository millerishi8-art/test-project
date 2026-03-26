/**
 * תרגומי דף טופס מילוי פרטים (case-form)
 */
export const caseFormTranslations = {
  he: {
    pageTitle: 'מילוי פרטים',
    formSubtitle: 'אנא מלא את כל הפרטים הנדרשים',
    formSubtitleFoodStamps:
      'טופס זכאות לפוד סטאמפס (Food Stamps) – לכל סוגי הקייסים; כל השדות הנדרשים בשתי השפות; שדות בפרק הראשון באנגלית בלבד.',
    
    // Section 1: Personal Information & Identification
    sectionPersonal: 'פרטים אישיים וזיהוי',
    labelFullName: 'שם מלא *',
    placeholderFullName: 'הזן שם מלא (באנגלית בלבד)',
    labelDob: 'תאריך לידה (לועזי) *',
    labelBirthPlace: 'מקום לידה *',
    birthPlaceIsrael: 'ישראל',
    birthPlaceNY: 'ניו יורק',
    birthPlaceOther: 'אחר',
    labelAddress: 'כתובת מגורים למשלוח הכרטיס *',
    placeholderAddress: 'כולל רחוב, מספר בית, מיקוד, אזור ועיר (באנגלית בלבד)',
    labelParentalDetails: 'פרטי הורים',
    labelFatherName: 'שם האב מלא *',
    placeholderFatherName: 'הזן שם אב מלא (באנגלית בלבד)',
    labelMotherName: 'שם האם מלא (כולל שם משפחה של האם לפני נישואים) *',
    placeholderMotherName: 'הזן שם אם מלא (באנגלית בלבד)',

    // Section 2: Family Status & Citizenship
    sectionFamily: 'מצב משפחתי ואזרחות',
    labelMaritalStatus: 'מצב משפחתי *',
    maritalSingle: 'רווק/ה',
    maritalMarriedSpouse: 'נשוי גר עם אשתי',
    maritalMarriedChildren: 'נשוי גר עם אישה וילדים',
    labelDependents: 'מספר נפשות ב"קייס" *',
    placeholderDependents: 'כמה אנשים אתה רוצה לרשום תחת השם שלך (ילדים מתחת לגיל 18 שאתה האפוטרופוס שלהם)',
    labelAdditionalCitizenship: 'אזרחות נוספת *',
    citizenshipYes: 'כן',
    citizenshipNo: 'לא',
    citizenshipQuestion: 'האם יש לך אזרחות נוספת מלבד האזרחות האמריקאית?',
    labelCitizenshipCountrySelect: 'מדינת האזרחות הנוספת *',
    placeholderCitizenshipCountrySelect: 'בחר מדינה מהרשימה',
    errorCitizenshipCountryRequired: 'נא לבחור מדינה מהרשימה',

    // Section 3: Food Stamps History
    sectionHistory: 'היסטוריה עם "פוד סטאמפס"',
    labelPreviousCase: 'האם היה לך "קייס" בעבר?',
    labelActiveCase: 'האם יש לך חשבון פעיל כרגע?',
    labelAccessCredentials: 'פרטי גישה (במידה ויש חשבון)',
    labelCaseEmail: 'מייל של הקייס',
    placeholderCaseEmail: 'הזן את המייל של הקייס',
    labelCasePassword: 'סיסמה',
    placeholderCasePassword: 'הזן סיסמה',

    // Section 4: Required Documents
    sectionImages: 'מסמכים ואישורים נדרשים (להעלאה)',
    sectionImagesHint: 'העלה את המסמכים הנדרשים. בחר קבצים מהמכשיר.',
    labelBirthCertificates: 'תעודות לידה (רשות — מומלץ לצרף)',
    hintBirthCertificates:
      'ניתן לשלוח את התיק גם בלי תעודות לידה; מומלץ לצרף — קייסים שכוללים תעודת לידה מתבדקים ומאושרים לרוב מהר יותר.',
    birthCertSubmitRecommendation:
      'לא צירפת תעודות לידה.\n\nהמלצה: קייסים שכוללים תעודת לידה מאושרים בדרך כלל מהר יותר.\n\nהאם להמשיך בשליחת הטופס בכל זאת?',
    labelSSN: 'סושיאל סקיוריטי נאמבר (SSN) *',
    hintSSN: 'צילום כרטיס Social Security או מסמך המעיד על מספר ה-SSN שלך.',
    labelPassport: 'דרכון *',
    hintPassport: 'צילום דרכון בתוקף (עמוד פרטים עם תמונה).',
    labelAmericanMarriageCertificate: 'תעודת נשואים אמריקאית *',
    hintAmericanMarriageCertificate:
      'בקייס משפחה בלבד: יש להעלות תעודת נשואים אמריקאית (במידה ואין אמריקאית — אפשרי תעודה ישראלית).',
    labelProofOfPayment: 'אישור תשלום *',
    hintProofOfPayment: 'צילום מסך או הוכחה ששילמת לסוכן על פתיחת התיק.',
    labelProofOfPaymentOptional: 'אישור תשלום (לא חובה – אושר תשלום מאוחר)',
    hintProofOfPaymentDeferred:
      'לאחר אישור המנהל אין חובה לצרף קובץ; ניתן עדיין להעלות הוכחת תשלום אם תרצו.',
    deferPaymentCommitmentTitle: 'אושר תשלום מאוחר – התחייבות',
    deferPaymentCommitment:
      'התחייבות להשלים את התשלום לסוכן עד ליום {{date}}, לפי אישור המנהל (בדרך כלל עד חודש ממועד האישור או מועד אחר שסוכם עם המנהל).',
    deferPaymentCommitmentFallback:
      'התחייבות להשלים את התשלום לסוכן במועד שסוכם עם המנהל – לפרטים מדויקים בדקו את המייל מאת האתר או צרו קשר עם המנהל.',
    deferPaymentPendingNote:
      'בקשתך נשלחה למנהל הראשי. לאחר אישור הבקשה תתבקשו להזין מועד תשלום, ורק אחרי אישור המועד תוכלו לשלוח את התיק בלי אישור תשלום מיידי.',
    deferPaymentStage1Title: 'הבקשה אושרה – שלב הבא: מועד תשלום',
    deferPaymentStage1Body:
      'נא לבחור את המועד האחרון שבו אתם מתחייבים לשלם לסוכן על פתיחת התיק. המועד לא יאוחר מחודש ממועד אישור הבקשה.',
    deferClientMaxLabel: 'תאריך אחרון מותר',
    deferClientDeadlineLabel: 'תאריך יעד לתשלום (התחייבות) *',
    deferClientDeadlineHint:
      'יש לבחור תאריך מהיום ועד התאריך האחרון המותר. לאחר השליחה המנהל הראשי יאשר את התאריך, ואז יופעל אישור תשלום מיוחד לשליחת הטופס.',
    deferClientDeadlineSubmit: 'שליחת התאריך לאישור המנהל',
    deferClientDeadlineSending: 'שולח…',
    deferClientDeadlineRequired: 'נא לבחור תאריך יעד.',
    deferClientDeadlineSent: 'התאריך נשלח. ממתינים לאישור המנהל.',
    deferPaymentProposalPendingNote:
      'שלחתם תאריך תשלום; ממתינים לאישור המנהל הראשי. לאחר האישור תוצג כאן ההתחייבות ותוכלו להשלים את הטופס בלי הוכחת תשלום מיידי.',
    errorDeferredDeadlineInvalid:
      'התאריך חייב להיות מהיום ועד חודש ממועד אישור הבקשה. בחרו תאריך חוקי.',
    deferPaymentButton: 'קשה לי לשלם כרגע',
    deferPaymentPreSubmitConfirm:
      'בקשה לתשלום בהמשך – פנייה למנהל\n\n' +
      'לאחר שליחת הבקשה לא תוכלו להשלים את שליחת הטופס עם אישור תשלום מיידי, עד שהמנהל הראשי יאשר את הבקשה.\n' +
      'התהליך עם המנהל הראשי: אישור הבקשה ← הזנת תאריך יעד לתשלום (עד חודש) ← אישור המנהל לתאריך ← ואז ניתן יהיה לשלוח את התיק בלי הוכחת תשלום מיידית.\n\n' +
      'האם לשלוח כעת את הבקשה למנהל הראשי?',
    deferPaymentSending: 'שולח…',
    deferPaymentRequestSent: 'הבקשה נשלחה למנהל. עדכון יופיע כאן לאחר האישור.',
    deferPaymentEmailFailed:
      'הבקשה נרשמה במערכת, אך שליחת המייל למנהל נכשלה – מומלץ ליצור קשר עם המנהל.',
    deferPaymentRequestError: 'שגיאה בשליחת הבקשה. נסו שוב מאוחר יותר.',
    labelDigitalSignatureBlock: 'חתימה דיגיטלית *',
    hintDigitalSignature:
      'חובה לחתום בתיבה למטה בעכבר או במגע. השתמש ב"נקה חתימה" אם תרצה להתחיל מחדש.',
    uploadFromDevice: 'בחירה מהמכשיר',
    removeImage: 'הסר',

    // Family case: additional children (above declarations)
    sectionFamilyChildren: 'ילדים נוספים במשפחה',
    familyChildrenIntro:
      'למשפחות: ניתן להוסיף כרטיסיה לכל ילד נוסף – צירוף דרכון, SSN, גיל, תאריך לידה, כיתה/גן, ופרטי בריאות במידת הצורך.',
    addAnotherChild: '+ הוסף ילד נוסף',
    removeChild: 'הסר ילד',
    childNumberLabel: 'ילד/ה מס׳',
    labelChildPassport: 'תצלום דרכון *',
    hintChildPassport: 'עמוד זיהוי עם תמונה.',
    labelChildSSN: 'תצלום Social Security (SSN) *',
    hintChildSSN: 'כרטיס או מסמך המציג את מספר ה-SSN.',
    labelChildAge: 'גיל הילד *',
    placeholderChildAge: 'למשל 7',
    labelChildDob: 'תאריך לידה *',
    labelChildSchoolClass: 'באיזו כיתה / גן הילד לומד? *',
    placeholderChildSchoolClass: 'למשל: גן חובה עירוני / כיתה ב׳',
    labelChildMedicalIssues: 'בעיות רפואיות (אם יש)',
    placeholderChildMedicalIssues: 'פרט בעיות רפואיות, אבחונים או טיפולים רלוונטיים',
    labelChildMedicalForms: 'תצלום טפסים רפואיים',
    hintChildMedicalForms: 'חובה אם מילאת בעיות רפואיות – צירוף מסמכים המאמתים.',
    errorChildIncomplete: 'בכל ילד שנוסף: חובה דרכון, SSN, גיל, תאריך לידה וכיתה/גן.',
    errorChildMedicalDocs: 'אם ציינת בעיות רפואיות לילד – חובה להעלות תצלום טפסים המאמתים.',
    childFileUploaded: 'קובץ הועלה',

    sectionSpouseDocuments: 'מסמכי בן / בת זוג',
    spouseDocumentsIntro:
      'ניתן להוסיף מסמכי זיהות נפרדים לבן/בת הזוג: דרכון ו-Social Security (SSN).',
    addSpouseDocumentsBtn: '+ הוסף מסמכי בן/בת זוג (דרכון ו-SSN)',
    removeSpouseSection: 'הסר מקטע',
    spouseCardTitle: 'בן / בת זוג',
    labelSpousePassport: 'תצלום דרכון (בן/בת זוג) *',
    hintSpousePassport: 'עמוד זיהוי עם תמונה.',
    labelSpouseSSN: 'תצלום Social Security – SSN (בן/בת זוג) *',
    hintSpouseSSN: 'כרטיס או מסמך המציג את מספר ה-SSN.',
    labelSpouseHealth: 'מצב בריאותי של בן/בת הזוג *',
    hintSpouseHealth:
      'פרט מצב בריאותי, אבחונים או טיפולים רלוונטיים. אם אין בעיות – כתוב ״אין״.',
    placeholderSpouseHealth: 'למשל: אין / או פירוט קצר של מצב רפואי',
    errorSpouseIncomplete: 'לאחר הוספת מסמכי בן/בת זוג – חובה להעלות גם דרכון וגם SSN.',
    errorSpouseHealthRequired: 'חובה למלא את שדה המצב הבריאותי של בן/בת הזוג (ניתן לכתוב ״אין״).',

    // Section 5: Declarations
    sectionDeclarations: 'הצהרות וייפוי כוח',
    dec1: 'הסכמה לכך שהמידע ישמש לקידום הזכאות.',
    dec2: 'הצהרה שכל הפרטים נכונים ומדויקים.',
    dec3: 'ייפוי כוח: מתן אישור לסוכן (נועם) לפעול בשמך מול הרשויות, לקבל פרטים (כמו Social Security, דרכון וכו\') ולאמת אותם.',
    dec4: 'התחייבות לשלם את הסכום שסוכם עם הסוכן.',

    sectionRenewal: 'קביעת מועד לחידוש',
    renewalHint: 'אפשר להוסיף את תאריך החידוש ל-Google Calendar כדי לא לשכוח. חובה להוסיף תאריך חידוש ללוח השנה לפני שליחת הטופס.',
    addToGoogleCalendar: 'הוסף תאריך חידוש ל-Google Calendar 🗓️',
    renewalAddedLabel: 'תאריך החידוש נוסף ללוח השנה',
    renewalRequiredFirst: 'חובה להוסיף תאריך חידוש ללוח השנה לפני שליחת הטופס.',
    renewalAlertBody:
      'חשוב לזכור לחדש את הקייס בזמן שהוקצב לך. אם לא תחדש בזמן, הקייס עלול להיסגר ויהיו עלויות נוספות לפתיחה מחדש.',
    renewalAlertTitle: 'אל תשכח לחדש את הקייס',
    renewalAlertConfirm: 'אישור',
    reminderBannerTitle: '⚠️ תזכורת חשובה',
    reminderBannerText: 'אל תשכח לחדש את הקייס בזמן שהוקצב לך. במידה ולא תחדש את הקייס בזמן, הקייס עלול להיסגר ויהיו עלויות נוספות לפתיחת קייס מחדש. עליך האחריות לזכור לחדש את הקייס.',
    reminderBannerButton: 'שמור תאריך חידוש בלוח שנה 🗓️',

    sectionSignature: 'אישור סופי לפני שליחה',
    sectionSignatureIntro: 'אשר את ההצהרות והחתימה לפני השליחה.',
    checkboxLabel:
      'אני מאשר את כל הפרטים, את כל ההצהרות לעיל, ומסכים לסגירת התיק לאחר השליחה *',
    labelSignatoryName: 'שם מלא כחתימה *',
    placeholderSignatoryName: 'הזן את שמך המלא לאישור התנאים',
    labelSignatoryDate: 'תאריך:',
    signaturePadHint: 'חתום בתיבה למטה (גרור עם העכבר או המגע).',
    clearSignature: 'נקה חתימה',
    
    cancel: 'ביטול',
    submit: 'שלח וסגור קייס',
    submitLoading: 'שולח...',
    translateButton: 'English',
    loading: 'טוען...',
    errorFillRequired: 'אנא מלא את כל השדות הנדרשים',
    errorFieldRequired: 'שדה חובה – נא למלא.',
    errorUploadRequired: 'חובה להעלות קובץ.',
    errorFormHasFieldErrors: 'יש שגיאות בטופס. השדות הבעייתיים מסומנים באדום.',
    errorConfirmSignature: 'אנא אשר את ההצהרות ואת החתימה',
    errorDrawSignature: 'אנא חתום בתיבה עם העכבר או המגע.',
    errorLoginRequired: 'נא להתחבר כדי לשלוח את הטופס.',
    errorSessionExpired: 'ההתחברות פגה. נא להתחבר מחדש ולשלוח שוב.',
    errorNoPermission: 'אין הרשאה לשלוח תיק.',
    errorServerDown: 'השרת לא פועל. הרץ מתיקיית הפרויקט: npm run dev (כדי להפעיל שרת + קליינט) ואז נסה שוב.',
    errorServerError: 'שגיאת שרת. נסה שוב או בדוק את הטרמינל של השרת.',
    errorSubmit: 'שגיאה בשליחת הטופס.',
    errorEnglishOnly: 'אנא השתמש באותיות באנגלית בלבד בשדה זה.',
    errorMissingBirthCerts: 'תעודות לידה אינן חובה; ניתן להחמיץ ולקבל המלצה בשליחה.',
    errorMissingSSN: 'חובה להעלות צילום כרטיס סושיאל סקיוריטי (SSN) או מסמך מקביל.',
    errorMissingPassport: 'חובה להעלות צילום דרכון.',
    errorMissingAmericanMarriageCertificate:
      'בקייס משפחה חובה להעלות תעודת נשואים אמריקאית או תעודה ישראלית (אם אין תעודה אמריקאית).',
    errorMissingPayment: 'חובה להעלות אישור תשלום לסוכן (צילום מסך או הוכחת תשלום).',
    errorPaymentProofRequired:
      'נדרש להעלות אישור תשלום או לקבל אישור מנהל לתשלום מאוחר לפני שליחת התיק.',
    errorCaseEmailInvalid: 'נא להזין כתובת מייל תקינה לחשבון הקייס.',
    errorCasePasswordRequired: 'נא להזין סיסמה לחשבון הקייס (כשסימנת קייס בעבר או קייס פעיל).',
    benefitTitles: {
      family: 'משפחה',
      individual: 'בן אדם יחיד',
      minor: 'צעיר',
    },

    // Simple form (family / minor)
    simpleFormSubtitle: 'אנא מלא את הפרטים הנדרשים',
    simpleLabelAddress: 'כתובת מגורים *',
    simplePlaceholderAddress: 'הזן כתובת מלאה',
    simpleSectionPersonal: 'פרטים אישיים',
    simpleLabelFamilyBackground: 'רקע משפחתי',
    simplePlaceholderFamilyBackground: 'פרטים על הרקע המשפחתי (אופציונלי)',
    simpleLabelPersonalDetails: 'פרטים נוספים *',
    simplePlaceholderPersonalDetails: 'פרטים נוספים על מבקש ההטבה',
    simpleSectionId: 'מסמך מזהה',
    simpleSectionIdHint: 'העלה צילום של המסמך. ניתן לבחור מספר תמונות מהמכשיר.',
    labelDocumentType: 'סוג המסמך',
    docTypeId: 'תעודת זהות',
    docTypeLicense: 'רישיון נהיגה',
    docTypePassport: 'דרכון',
  },
  en: {
    pageTitle: 'Fill in details',
    formSubtitle: 'Please fill in all required details',
    formSubtitleFoodStamps:
      'Food Stamps eligibility form – for all case types; required fields in both languages; Section 1 inputs must be in English only.',
    
    // Section 1: Personal Information & Identification
    sectionPersonal: 'Personal Information & Identification',
    labelFullName: 'Full Name *',
    placeholderFullName: 'Enter full name',
    labelDob: 'Date of Birth (Gregorian) *',
    labelBirthPlace: 'Place of Birth *',
    birthPlaceIsrael: 'Israel',
    birthPlaceNY: 'New York',
    birthPlaceOther: 'Other',
    labelAddress: 'Mailing Address for Card Delivery *',
    placeholderAddress: 'Include Street, House No., ZIP, Area, and City',
    labelParentalDetails: 'Parental Details',
    labelFatherName: 'Father\'s Full Name *',
    placeholderFatherName: 'Enter father\'s full name',
    labelMotherName: 'Mother\'s Full Name (including mother\'s family name before marriage) *',
    placeholderMotherName: 'Enter mother\'s full name (English letters only)',

    // Section 2: Family Status & Citizenship
    sectionFamily: 'Family Status & Citizenship',
    labelMaritalStatus: 'Marital Status *',
    maritalSingle: 'Single',
    maritalMarriedSpouse: 'Married living with spouse',
    maritalMarriedChildren: 'Married living with spouse & children',
    labelDependents: 'Number of Dependents in Case *',
    placeholderDependents: 'Children under 18 under legal guardianship',
    labelAdditionalCitizenship: 'Additional Citizenship *',
    citizenshipYes: 'Yes',
    citizenshipNo: 'No',
    citizenshipQuestion: 'Do you have any citizenship in addition to your US citizenship?',
    labelCitizenshipCountrySelect: 'Country of your additional citizenship *',
    placeholderCitizenshipCountrySelect: 'Select a country from the list',
    errorCitizenshipCountryRequired: 'Please select a country from the list',

    // Section 3: Food Stamps History
    sectionHistory: 'Food Stamps History',
    labelPreviousCase: 'Have you had a case in the past?',
    labelActiveCase: 'Do you have an active case now?',
    labelAccessCredentials: 'Access Credentials (If existing case)',
    labelCaseEmail: 'Email for the case',
    placeholderCaseEmail: 'Enter case email',
    labelCasePassword: 'Password',
    placeholderCasePassword: 'Enter password',

    // Section 4: Required Documents
    sectionImages: 'Required Documents (File Uploads)',
    sectionImagesHint: 'Upload the required documents. Choose files from your device.',
    labelBirthCertificates: 'Birth certificates (optional — recommended)',
    hintBirthCertificates:
      'You may submit the case without birth certificates; attaching them is recommended—cases that include a birth certificate are usually reviewed and approved faster.',
    birthCertSubmitRecommendation:
      'You did not attach birth certificates.\n\nRecommendation: cases with birth certificates are typically approved faster.\n\nContinue and submit anyway?',
    labelSSN: 'Social Security Number (SSN) *',
    hintSSN: 'Photo of your Social Security card or document showing your SSN.',
    labelPassport: 'Passport *',
    hintPassport: 'Photo of a valid passport (photo ID page).',
    labelAmericanMarriageCertificate: 'U.S. marriage certificate *',
    hintAmericanMarriageCertificate:
      'Family cases only: upload a U.S. marriage certificate (if unavailable, an Israeli marriage certificate is acceptable).',
    labelProofOfPayment: 'Proof of payment *',
    hintProofOfPayment: 'Screenshot or proof that you paid the agent to open the case.',
    labelProofOfPaymentOptional: 'Proof of payment (optional – deferred payment approved)',
    hintProofOfPaymentDeferred:
      'After manager approval, uploading payment proof is optional; you may still attach a file if you wish.',
    deferPaymentCommitmentTitle: 'Deferred payment approved – your commitment',
    deferPaymentCommitment:
      'You commit to complete payment to the agent by {{date}}, per the manager’s approval (typically within one month of approval or another agreed date).',
    deferPaymentCommitmentFallback:
      'Complete payment to the agent by the deadline agreed with the manager—check your email or contact support for the exact date.',
    deferPaymentPendingNote:
      'Your request was sent to the primary admin. After the request is approved you will enter a payment date; only after that date is approved can you submit the case without immediate payment proof.',
    deferPaymentStage1Title: 'Request approved – next: payment date',
    deferPaymentStage1Body:
      'Choose the latest date by which you commit to pay the agent for opening the case. It must be no later than one month from when your request was approved.',
    deferClientMaxLabel: 'Latest allowed date',
    deferClientDeadlineLabel: 'Payment due date (your commitment) *',
    deferClientDeadlineHint:
      'Pick a date from today through the latest allowed date. The primary admin must then approve it before you can submit the form without immediate payment proof.',
    deferClientDeadlineSubmit: 'Submit date for approval',
    deferClientDeadlineSending: 'Sending…',
    deferClientDeadlineRequired: 'Please select a date.',
    deferClientDeadlineSent: 'Date submitted. Waiting for admin approval.',
    deferPaymentProposalPendingNote:
      'You submitted a payment date; waiting for the primary admin to approve it. After approval, your commitment will show here and you can complete the form without immediate payment proof.',
    errorDeferredDeadlineInvalid:
      'The date must be between today and one month from request approval. Choose a valid date.',
    deferPaymentButton: 'Cannot pay right now',
    deferPaymentPreSubmitConfirm:
      'Deferred payment – request to the primary admin\n\n' +
      'After you send this request, you will not be able to submit the form with immediate payment proof until the primary admin approves it.\n' +
      'The process: request approval → you enter a payment due date (within one month) → admin approves the date → you can then submit without immediate payment proof.\n\n' +
      'Send the request to the primary admin now?',
    deferPaymentSending: 'Sending…',
    deferPaymentRequestSent: 'Your request was sent. This page will update after approval.',
    deferPaymentEmailFailed:
      'Your request was saved, but the email to the manager could not be sent—please contact the manager directly.',
    deferPaymentRequestError: 'Could not send the request. Please try again later.',
    labelDigitalSignatureBlock: 'Digital signature *',
    hintDigitalSignature:
      'You must sign in the box below using your mouse or touch. Use "Clear signature" if you need to start over.',
    uploadFromDevice: 'Choose from device',
    removeImage: 'Remove',

    sectionFamilyChildren: 'Additional children in the family',
    familyChildrenIntro:
      'For family cases: add a card per child – passport, SSN, age, date of birth, kindergarten/class, and medical details if applicable.',
    addAnotherChild: '+ Add another child',
    removeChild: 'Remove child',
    childNumberLabel: 'Child',
    labelChildPassport: 'Passport photo *',
    hintChildPassport: 'ID page with photo.',
    labelChildSSN: 'Social Security (SSN) photo *',
    hintChildSSN: 'Card or document showing the SSN.',
    labelChildAge: 'Child\'s age *',
    placeholderChildAge: 'e.g. 7',
    labelChildDob: 'Date of birth *',
    labelChildSchoolClass: 'Which kindergarten / class does the child attend? *',
    placeholderChildSchoolClass: 'e.g. municipal kindergarten / 2nd grade',
    labelChildMedicalIssues: 'Medical issues (if any)',
    placeholderChildMedicalIssues: 'Describe medical conditions, diagnoses, or treatments',
    labelChildMedicalForms: 'Photo of medical forms',
    hintChildMedicalForms: 'Required if you entered medical issues – upload supporting documents.',
    errorChildIncomplete: 'For each added child: passport, SSN, age, date of birth, and class/kindergarten are required.',
    errorChildMedicalDocs: 'If you listed medical issues for a child, you must upload photos of the supporting forms.',
    childFileUploaded: 'File uploaded',

    sectionSpouseDocuments: 'Spouse / partner documents',
    spouseDocumentsIntro:
      'You can add separate ID documents for your spouse or partner: passport and Social Security (SSN).',
    addSpouseDocumentsBtn: '+ Add spouse/partner documents (passport & SSN)',
    removeSpouseSection: 'Remove this section',
    spouseCardTitle: 'Spouse / partner',
    labelSpousePassport: 'Passport photo (spouse) *',
    hintSpousePassport: 'ID page with photo.',
    labelSpouseSSN: 'Social Security (SSN) photo (spouse) *',
    hintSpouseSSN: 'Card or document showing the SSN.',
    labelSpouseHealth: 'Spouse / partner health status *',
    hintSpouseHealth:
      'Describe relevant health conditions, diagnoses, or treatments. If none, write "None".',
    placeholderSpouseHealth: 'e.g. None, or a brief medical summary',
    errorSpouseIncomplete: 'After adding spouse documents, both passport and SSN uploads are required.',
    errorSpouseHealthRequired:
      'Please fill in the spouse/partner health field (you may write "None").',

    // Section 5: Declarations
    sectionDeclarations: 'Declarations & Power of Attorney',
    dec1: 'I agree that the information provided will be used to promote eligibility.',
    dec2: 'I declare that all details are correct and accurate.',
    dec3: 'Power of Attorney: I authorize the agent (Noam) to act on my behalf before the authorities, receive and verify identification details (SSN, Passport, etc.).',
    dec4: 'I commit to paying the agreed-upon fee to the agent.',

    sectionRenewal: 'Set renewal date',
    renewalHint: 'You can add the renewal date to Google Calendar so you don\'t forget. You must add the renewal date to the calendar before submitting the form.',
    addToGoogleCalendar: 'Add renewal date to Google Calendar 🗓️',
    renewalAddedLabel: 'Renewal date added to calendar',
    renewalRequiredFirst: 'You must add the renewal date to the calendar before submitting the form.',
    renewalAlertBody:
      'Remember to renew your case on time. If you miss the deadline, the case may close and reopening may cost extra.',
    renewalAlertTitle: 'Don\'t forget to renew your case',
    renewalAlertConfirm: 'OK',
    reminderBannerTitle: '⚠️ Important reminder',
    reminderBannerText: 'Do not forget to renew the case within the time allotted to you. If you do not renew on time, the case may be closed and there will be additional costs to reopen it. You are responsible for remembering to renew the case.',
    reminderBannerButton: 'Save renewal date to calendar 🗓️',

    sectionSignature: 'Final confirmation before submit',
    sectionSignatureIntro: 'Confirm the declarations and signature before sending.',
    checkboxLabel:
      'I confirm all details, all declarations above, and agree to close the case after submission *',
    labelSignatoryName: 'Full name as signature *',
    placeholderSignatoryName: 'Enter your full name to approve the terms',
    labelSignatoryDate: 'Date:',
    signaturePadHint: 'Sign in the box below (draw with mouse or touch).',
    clearSignature: 'Clear signature',
    
    cancel: 'Cancel',
    submit: 'Send and close case',
    submitLoading: 'Sending...',
    translateButton: 'עברית',
    loading: 'Loading...',
    errorFillRequired: 'Please fill in all required fields',
    errorFieldRequired: 'This field is required.',
    errorUploadRequired: 'Please upload a file.',
    errorFormHasFieldErrors: 'There are errors in the form. Invalid fields are highlighted in red.',
    errorConfirmSignature: 'Please confirm all declarations and signature',
    errorDrawSignature: 'Please draw your signature in the box.',
    errorLoginRequired: 'Please log in to submit the form.',
    errorSessionExpired: 'Session expired. Please log in again and try again.',
    errorNoPermission: 'You do not have permission to submit a case.',
    errorServerDown: 'Server is not running. Run from project root: npm run dev, then try again.',
    errorServerError: 'Server error. Try again or check the server terminal.',
    errorSubmit: 'Error submitting the form.',
    errorEnglishOnly: 'Please use English characters only in this field.',
    errorMissingBirthCerts: 'Birth certificates are optional; you can skip and get a reminder on submit.',
    errorMissingSSN: 'Please upload a photo of your Social Security card (SSN) or equivalent document.',
    errorMissingPassport: 'Please upload a passport photo.',
    errorMissingAmericanMarriageCertificate:
      'Family cases require a U.S. marriage certificate, or an Israeli one if a U.S. certificate is not available.',
    errorMissingPayment: 'Please upload proof of payment to the agent.',
    errorPaymentProofRequired:
      'Payment proof is required unless the manager has approved deferred payment.',
    errorCaseEmailInvalid: 'Please enter a valid email for the case account.',
    errorCasePasswordRequired: 'Please enter the case account password (when past or active case is selected).',
    benefitTitles: {
      family: 'Family',
      individual: 'Single person',
      minor: 'Youth',
    },

    simpleFormSubtitle: 'Please fill in the required details',
    simpleLabelAddress: 'Residential address *',
    simplePlaceholderAddress: 'Enter full address',
    simpleSectionPersonal: 'Personal details',
    simpleLabelFamilyBackground: 'Family background',
    simplePlaceholderFamilyBackground: 'Family background (optional)',
    simpleLabelPersonalDetails: 'Additional details *',
    simplePlaceholderPersonalDetails: 'Additional details about the person requesting the benefit',
    simpleSectionId: 'ID document',
    simpleSectionIdHint: 'Upload a photo of the document. You can select multiple images from your device.',
    labelDocumentType: 'Document type',
    docTypeId: 'ID card',
    docTypeLicense: 'Driver\'s license',
    docTypePassport: 'Passport',
  },
};
