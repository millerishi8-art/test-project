-- הרץ ב-Supabase → SQL Editor → New query → Run
-- מסד נתוני האפליקציה (משתמשים + תיקים). לא מחליף את auth.users של Supabase.

CREATE TABLE IF NOT EXISTS public.app_users (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS app_users_email_lower_idx
  ON public.app_users (lower(trim(data ->> 'email')));

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
  WHERE lower(trim(data ->> 'email')) = lower(trim(e));
$$;

GRANT EXECUTE ON FUNCTION public.find_app_users_by_email_normalized(TEXT) TO anon, authenticated, service_role;

COMMENT ON TABLE public.app_users IS 'משתמשי האפליקציה (מסמך JSON בשדה data)';
COMMENT ON TABLE public.app_cases IS 'תיקים – user_id לשאילתות, data מסמך מלא';
