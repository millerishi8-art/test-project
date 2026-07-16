-- הרץ ב-Supabase → SQL Editor → New query → Run
-- מסד נתוני האפליקציה (משתמשים + תיקים). לא מחליף את auth.users של Supabase.

CREATE TABLE IF NOT EXISTS public.app_users (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- עמודות אופציונליות לחיפוש/סנכרון; הקוד תומך גם רק ב-data JSONB
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS auth_provider TEXT;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS email_verification_code TEXT;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS email_verification_code_expires TIMESTAMPTZ;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS password_reset_code TEXT;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS password_reset_code_expires TIMESTAMPTZ;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- אם הטבלה הייתה שטוחה בלי data – מוסיפים JSONB (חובה לקודי אימות מלאים)
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb;

-- משתמשי קדם: מסמנים כמאומתים כדי לא לנעול אותם אחרי השינוי
UPDATE public.app_users
SET email_verified = true
WHERE email_verified IS NULL;

CREATE INDEX IF NOT EXISTS app_users_email_lower_idx
  ON public.app_users (lower(trim(data ->> 'email')));

CREATE INDEX IF NOT EXISTS app_users_email_col_lower_idx
  ON public.app_users (lower(trim(email)))
  WHERE email IS NOT NULL AND trim(email) <> '';

CREATE TABLE IF NOT EXISTS public.app_cases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.app_users (id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS app_cases_user_id_idx ON public.app_cases (user_id);

-- חיפוש אימייל לא רגיש לאותיות
CREATE OR REPLACE FUNCTION public.find_app_users_by_email_normalized(e TEXT)
RETURNS SETOF public.app_users
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM public.app_users
  WHERE lower(trim(COALESCE(data ->> 'email', ''))) = lower(trim(e))
     OR (
          email IS NOT NULL
          AND trim(email) <> ''
          AND lower(trim(email)) = lower(trim(e))
        );
$$;

GRANT EXECUTE ON FUNCTION public.find_app_users_by_email_normalized(TEXT) TO anon, authenticated, service_role;

-- היסטוריית תשלומים לעובדים (15$ לכייס שהושלם) – כל רשומה = סגירת חשבון לעובד
CREATE TABLE IF NOT EXISTS public.app_payouts (
  id TEXT PRIMARY KEY,
  employee_email TEXT NOT NULL,
  employee_name TEXT,
  cases_count INTEGER NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  case_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  paid_by TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_payouts_employee_email_idx ON public.app_payouts (employee_email);
CREATE INDEX IF NOT EXISTS app_payouts_paid_at_idx ON public.app_payouts (paid_at DESC);

COMMENT ON TABLE public.app_users IS 'משתמשי האפליקציה (מסמך JSON בשדה data)';
COMMENT ON TABLE public.app_cases IS 'תיקים – user_id לשאילתות, data מסמך מלא';
COMMENT ON TABLE public.app_payouts IS 'היסטוריית תשלומים לעובדים על כייסים שהושלמו';
