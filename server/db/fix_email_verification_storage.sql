-- תיקון דחוף: שמירת קודי אימות / איפוס סיסמה
-- הרץ ב-Supabase → SQL Editor → Run
-- הסיבה: app_users בפרודקשן הייתה סכמה שטוחה בלי data JSONB, ולכן הקוד נשלח במייל אבל לא נשמר.

ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS email_verification_code TEXT;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS email_verification_code_expires TIMESTAMPTZ;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS password_reset_code TEXT;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS password_reset_code_expires TIMESTAMPTZ;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS auth_provider TEXT;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS phone TEXT;

UPDATE public.app_users
SET email_verified = true
WHERE email_verified IS NULL;

UPDATE public.app_users
SET auth_provider = 'supabase'
WHERE auth_provider IS NULL;

UPDATE public.app_users
SET data = COALESCE(data, '{}'::jsonb) || jsonb_strip_nulls(
  jsonb_build_object(
    'id', id,
    'email', email,
    'name', COALESCE(full_name, name, ''),
    'role', COALESCE(role, 'user'),
    'emailVerified', COALESCE(email_verified, true),
    'authProvider', COALESCE(auth_provider, 'supabase'),
    'phone', phone
  )
)
WHERE data IS NULL OR data = '{}'::jsonb OR NOT (data ? 'email');
