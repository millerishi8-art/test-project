# משתני סביבה (Environment Variables)

קובץ זה מסביר אילו משתני סביבה יש להגדיר בקובץ `.env` בתיקיית `server/`.

---

## חובה (Required)

| משתנה | תיאור |
|--------|--------|
| `MONGODB_URI` | מחרוזת חיבור ל-MongoDB (למשל MongoDB Atlas). חייבת לכלול משתמש וסיסמה. דוגמה: `mongodb+srv://user:password@cluster...mongodb.net/?retryWrites=true&w=majority` |
| `JWT_SECRET` | מפתח סודי לחתימת טוקני JWT. יש להגדיר ערך ייחודי וחזק בסביבת production. |

---

## אופציונלי אבל מומלץ (Optional)

| משתנה | תיאור | ברירת מחדל |
|--------|--------|------------|
| `PORT` | פורט השרת. | `5000` |
| `NODE_ENV` | סביבת הרצה: `development` או `production`. | `development` |
| `MONGODB_DB_NAME` | שם מסד הנתונים ב-MongoDB. | `insurance-agent` |
| `ADMIN_EMAIL` | אימייל החשבון היחיד שיש לו גישה לפאנל הניהול. חייב להתאים למשתמש שנוצר ב-`create-admin`. | (פנימי) |

---

## Cloudinary (העלאת קבצים לתמונות)

כדי שהשרת יעלה תמונות (חתימה, תמונת תעודת זהות וכו') ל-Cloudinary במקום לשמור base64 במסד הנתונים, הוסף:

| משתנה | תיאור |
|--------|--------|
| `CLOUDINARY_CLOUD_NAME` | Cloud name מדשבור Cloudinary (Dashboard → Account Details). |
| `CLOUDINARY_API_KEY` | API Key מדשבור Cloudinary. |
| `CLOUDINARY_API_SECRET` | API Secret מדשבור Cloudinary. |

אם משתנים אלה **לא** מוגדרים, התמונות יישמרו כ-base64 כמו היום (תאימות לאחור).

---

## גוגל דרייב (Client – אופציונלי)

כדי שאפשר יהיה **לבחור תמונות מגוגל דרייב** בטופס (כפתור "בחירה מגוגל דרייב"), יש להגדיר משתנים **בתיקיית הקליינט** – קובץ `client/.env` (לא ב-`server/.env`).

| משתנה | תיאור |
|--------|--------|
| `VITE_GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID מ-Google Cloud Console (Credentials → Create → OAuth client ID → Web application). ב-JavaScript origins הוסף את כתובת האתר (למשל `http://localhost:3000`). |
| `VITE_GOOGLE_API_KEY` | (אופציונלי) API Key אם נדרש ל-Picker. |

אם **לא** מגדירים את `VITE_GOOGLE_CLIENT_ID`, הכפתור "בחירה מגוגל דרייב" יציג הודעה: "גוגל דרייב: לא הוגדר VITE_GOOGLE_CLIENT_ID ב-.env". העלאה מהמכשיר תמשיך לעבוד כרגיל.

דוגמה: צור קובץ `client/.env` עם שורה כמו:
`VITE_GOOGLE_CLIENT_ID=123456789-xxxx.apps.googleusercontent.com`

---

## אימייל – אימות כתובת (Nodemailer / SMTP)

כדי שתהיה **אופציה לאמת את המייל** שמתחבר לאתר (קישור אימות שנשלח ב-Nodemailer), הגדר את משתני ה-SMTP ב-`server/.env`:

### צעדים להפעלת אימייל אימות (Gmail)

1. **פתח חשבון Google** (או השתמש בחשבון קיים) והפעל אימות דו-שלבי לחשבון.
2. **צור סיסמאת אפליקציה:** Google → חשבון שלי → אבטחה → אימות דו-שלבי → סיסמאות אפליקציה → צור סיסמה (בחר "דוא"ל" או "מחשב אחר"). העתק את הסיסמה בת 16 התווים.
3. **צור/ערוך קובץ** `server/.env` והוסף:
   - `SMTP_HOST=smtp.gmail.com`
   - `SMTP_PORT=587`
   - `SMTP_USER=האימייל-שלך@gmail.com`
   - `SMTP_PASS=סיסמאת-האפליקציה-שיצרת`
   - `APP_BASE_URL=http://localhost:3000` (או כתובת האתר בפרודקשן)
4. **הפעל מחדש את השרת.** עכשיו בהרשמה יישלח אימייל אימות, ובדף ההתחברות תופיע אופציה "שלח שוב אימייל אימות" (נשלח דרך Nodemailer).

---

פירוט משתני הסביבה:

| משתנה | תיאור |
|--------|--------|
| `SMTP_HOST` | שרת SMTP (למשל `smtp.gmail.com` ל-Gmail). |
| `SMTP_PORT` | פורט (בדרך כלל `587` ל-TLS). |
| `SMTP_SECURE` | `true` אם משתמשים ב-465, אחרת השאר ריק או `false`. |
| `SMTP_USER` | שם משתמש (כתובת אימייל). |
| `SMTP_PASS` | סיסמה או App Password (ב-Gmail: חשבון Google → אבטחה → סיסמאות אפליקציה). |
| `EMAIL_FROM` | (אופציונלי) כתובת "מ" באימייל. ברירת מחדל: `SMTP_USER`. |
| `APP_BASE_URL` | (אופציונלי) כתובת בסיס של האתר לקישור האימות, למשל `https://yoursite.com` או `http://localhost:3000`. |

אם **לא** מגדירים SMTP, ההרשמה תמשיך לעבוד אך אימייל אימות **לא יישלח** (יודפס אזהרה בלוג). מומלץ להגדיר לפחות Gmail או שירות SMTP אחר.

דוגמה ל-Gmail:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
APP_BASE_URL=http://localhost:3000
```

---

## אימות דרך הטלפון (SMS – אופציונלי)

כדי שמשתמשים יוכלו **לאמת דרך מספר הטלפון** (קוד SMS) במקום אימייל, יש להגדיר Twilio ב-`server/.env` ולהתקין: `npm install twilio` (בתיקיית server).

| משתנה | תיאור |
|--------|--------|
| `TWILIO_ACCOUNT_SID` | Account SID מ-Twilio Console. |
| `TWILIO_AUTH_TOKEN` | Auth Token מ-Twilio Console. |
| `TWILIO_PHONE_NUMBER` | מספר הטלפון של Twilio (פורמט +972...) לשליחת SMS. |

אם **לא** מגדירים – הקוד יודפס ללוג השרת (מתאים לפיתוח). המספר נשלח ל-**הטלפון שנרשם** בהרשמה.

---

## דוגמת קובץ `.env`

צור קובץ `server/.env` (אל תעלה אותו ל-Git) עם תוכן בדומה ל:

```env
PORT=5000
NODE_ENV=development
JWT_SECRET=your-secret-key-change-this-in-production

# MongoDB
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster....mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=insurance-agent

# אדמין – חייב להתאים למשתמש מ-create-admin
ADMIN_EMAIL=your-admin@example.com

# Cloudinary (אופציונלי – להעלאת תמונות)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# אימייל אימות (אופציונלי – SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
APP_BASE_URL=http://localhost:3000

# אימות דרך הטלפון (אופציונלי – Twilio). בלי הגדרה – הקוד מודפס ללוג.
# TWILIO_ACCOUNT_SID=...
# TWILIO_AUTH_TOKEN=...
# TWILIO_PHONE_NUMBER=+972...
```

---

## סיכום

- **חובה:** `MONGODB_URI`, `JWT_SECRET`
- **מומלץ:** `PORT`, `NODE_ENV`, `ADMIN_EMAIL`, `MONGODB_DB_NAME`
- **העלאת תמונות ל-Cloudinary:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- **אימייל אימות (SMTP):** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `APP_BASE_URL`
- **אימות טלפון (SMS):** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (אופציונלי; בלי – קוד מודפס ללוג)
