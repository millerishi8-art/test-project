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
```

---

## סיכום

- **חובה:** `MONGODB_URI`, `JWT_SECRET`
- **מומלץ:** `PORT`, `NODE_ENV`, `ADMIN_EMAIL`, `MONGODB_DB_NAME`
- **העלאת תמונות ל-Cloudinary:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
