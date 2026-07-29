# משתני סביבה – שרת (Supabase בלבד)

המסד הוא **Supabase (PostgreSQL)** דרך `app_users` ו-`app_cases` בלבד.

## חובה

| משתנה | תיאור |
|--------|--------|
| `SUPABASE_URL` | כתובת הפרויקט: `https://xxxx.supabase.co` (בלי `/` בסוף). ב-Vercel הגדר את אותו ערך תחת `SUPABASE_URL` (לא רק `NEXT_PUBLIC_*`). |
| `SUPABASE_SERVICE_ROLE_KEY` | מפתח **service_role** מ-Supabase → Project Settings → API (לא anon). |
| `JWT_SECRET` | מחרוזת סודית לחתימת JWT (משתמשי bcrypt/legacy). |

## אופציונלי

- `AUTH_PROVIDER=supabase` — אז גם **`SUPABASE_ANON_KEY`** (anon) להתחברות `signInWithPassword`.
- מייל / Twilio / `CRON_SECRET` — לפי הפיצ’רים שבהם אתה משתמש.

## סכמה

הרץ ב-Supabase → SQL Editor את התוכן מ-`server/db/supabase_schema.sql`.

למעקב כייסי מנהלים (ראיונות / הגשת טפסים) — אם הטבלה עדיין לא קיימת, הרץ גם את  
`server/db/employee_cases_schema.sql`.

## Vercel

Project → Settings → Environment Variables: הוסף את המשתנים, סמן Production + Preview, בצע **Redeploy**.
