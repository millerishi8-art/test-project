/**
 * תרגומי דף הזמנת כרטיס – עברית ואנגלית
 */
export const orderCardTranslations = {
  he: {
    pageTitle: 'הזמנת כרטיס',
    pageSubtitle: 'השירות מיועד להזמנת כרטיס פוד סטאמפס מחדש דרך הנציגים שלנו.',
    backHome: 'חזרה לדף הבית',
    translateButton: 'English',

    sectionContact: 'פרטי המזמין',
    labelFullName: 'שם מלא *',
    placeholderFullName: 'כפי שמופיע במסמך הזיהוי',
    labelPhone: 'טלפון ליצירת קשר',
    placeholderPhone: '050-0000000',

    sectionCardStatus: 'סטטוס הכרטיס',
    qReceived: 'האם הכרטיס הגיע אליך בדואר (או נמסר ליעדך) אי־פעם? *',
    yes: 'כן',
    no: 'לא',
    receivedHintYes: 'נשאל כמה שאלות קצרות על מצב הכרטיס ונוכל לבקש צילום שלו.',
    receivedHintNo: 'מכיוון שהכרטיס לא הגיע ליעד — שאלות על גניבה, אובדן או צילום הכרטיס אינן רלוונטיות.',

    qActive: 'האם הכרטיס שלך פעיל כרגע? *',
    qIssue: 'מה המצב הנוכחי של הכרטיס? *',
    issueNone: 'אין דיווח מיוחד — מבקש/ת כרטיס חדש / החלפה',
    issueStolen: 'דווח כגנוב',
    issueLost: 'דווח כנאבד',
    issueNotWorking: 'קיבלתי אותו אבל הוא לא עובד',

    qCardPhoto: 'צילום של הכרטיס (אם יש ברשותך)',
    cardPhotoHint:
      'מומלץ מאוד אם הכרטיס הגיע אליכם ונאבד / נגנב / לא עובד — הצילום מסייע לטיפול מהיר יותר.',
    cardPhotoRequired: 'נדרש צילום של הכרטיס במצב שבחרתם',

    sectionDocs: 'מסמכים נדרשים',
    docsIntro: 'יש להעלות את המסמכים הבאים. ניתן לבחור תמונה או PDF.',

    labelIdDoc: 'דרכון / תעודת זהות / רישיון נהיגה אמריקאי *',
    idDocHint: 'אחד מהשלושה — מסמך זיהוי ברור וקריא',
    labelSsn: 'צילום SSN אמריקאי *',
    ssnHint: 'חובה — כרטיס הביטוח הלאומי (Social Security)',

    sectionPayment: 'תשלום לסיום ההזמנה',
    paymentRequestTitle: 'בקשת תשלום: $150',
    paymentRequestBody:
      'לסיום הזמנת הכרטיס יש לשלם לנציגים שלנו סכום של 150 דולר, ואז להעלות כאן צילום של אישור התשלום.',
    labelPayment: 'אישור תשלום על סך $150 *',
    paymentHint: 'צילום קבלה / אישור העברה לנציגים שלנו באתר',

    chooseFile: 'בחירה מהמכשיר',
    removeFile: 'הסר',
    uploading: 'מעלה...',
    fileReady: 'הועלה בהצלחה',

    submit: 'שליחת הזמנה',
    submitting: 'שולח...',
    successNavigate: 'ההזמנה נשלחה בהצלחה',

    errorName: 'נא למלא שם מלא',
    errorReceived: 'נא לבחור האם הכרטיס הגיע ליעד',
    errorActive: 'נא לציין אם הכרטיס פעיל',
    errorIssue: 'נא לבחור את מצב הכרטיס',
    errorId: 'נא להעלות מסמך זיהוי',
    errorSsn: 'נא להעלות צילום SSN',
    errorPayment: 'נא להעלות אישור תשלום של $150',
    errorCardPhoto: 'נא להעלות צילום של הכרטיס',
    errorUpload: 'העלאת הקובץ נכשלה — נסו שוב',
    errorLogin: 'יש להתחבר מחדש',
    errorSubmit: 'שגיאה בשליחת ההזמנה',
    errorPending: 'ממתינים לסיום העלאת קבצים...',
  },
  en: {
    pageTitle: 'Order Card',
    pageSubtitle: 'Order a replacement Food Stamps card through our representatives.',
    backHome: 'Back to home',
    translateButton: 'עברית',

    sectionContact: 'Your details',
    labelFullName: 'Full name *',
    placeholderFullName: 'As shown on your ID document',
    labelPhone: 'Phone number',
    placeholderPhone: '050-0000000',

    sectionCardStatus: 'Card status',
    qReceived: 'Did the card ever arrive by mail (or get delivered to you)? *',
    yes: 'Yes',
    no: 'No',
    receivedHintYes: 'We’ll ask a few short questions about the card and may request a photo of it.',
    receivedHintNo: 'Since the card never arrived — questions about theft, loss, or a card photo do not apply.',

    qActive: 'Is your card currently active? *',
    qIssue: 'What is the current status of the card? *',
    issueNone: 'No special report — requesting a new / replacement card',
    issueStolen: 'Reported as stolen',
    issueLost: 'Reported as lost',
    issueNotWorking: 'I received it but it does not work',

    qCardPhoto: 'Photo of the card (if you have it)',
    cardPhotoHint:
      'Strongly recommended if the card arrived and was lost / stolen / not working — it helps us process faster.',
    cardPhotoRequired: 'A photo of the card is required for the status you selected',

    sectionDocs: 'Required documents',
    docsIntro: 'Please upload the documents below. Image or PDF accepted.',

    labelIdDoc: 'Passport / National ID / US driver’s license *',
    idDocHint: 'One of the three — clear and readable',
    labelSsn: 'US Social Security card (SSN) photo *',
    ssnHint: 'Required — Social Security card',

    sectionPayment: 'Payment to complete the order',
    paymentRequestTitle: 'Payment request: $150',
    paymentRequestBody:
      'To complete your card order, please pay our representatives $150, then upload a photo of the payment confirmation here.',
    labelPayment: 'Payment confirmation for $150 *',
    paymentHint: 'Receipt / transfer confirmation to our site representatives',

    chooseFile: 'Choose from device',
    removeFile: 'Remove',
    uploading: 'Uploading...',
    fileReady: 'Uploaded',

    submit: 'Submit order',
    submitting: 'Submitting...',
    successNavigate: 'Order submitted successfully',

    errorName: 'Please enter your full name',
    errorReceived: 'Please select whether the card arrived',
    errorActive: 'Please indicate if the card is active',
    errorIssue: 'Please select the card status',
    errorId: 'Please upload an ID document',
    errorSsn: 'Please upload your SSN photo',
    errorPayment: 'Please upload the $150 payment confirmation',
    errorCardPhoto: 'Please upload a photo of the card',
    errorUpload: 'Upload failed — please try again',
    errorLogin: 'Please sign in again',
    errorSubmit: 'Failed to submit the order',
    errorPending: 'Waiting for file uploads to finish...',
  },
};
