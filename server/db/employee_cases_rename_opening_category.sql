-- הרץ ב-Supabase → SQL Editor
-- משנה את שם הקטגוריה מ-"תשלום על פתיחת כייס" ל-"פתיחת כייס"

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN (
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.employee_cases'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%category%'
  ) LOOP
    EXECUTE format('ALTER TABLE public.employee_cases DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

UPDATE public.employee_cases
SET category = 'פתיחת כייס'
WHERE category IN ('תשלום על פתיחת כייס', 'Case Opening Payment');

ALTER TABLE public.employee_cases
  ADD CONSTRAINT employee_cases_category_check
  CHECK (category IN (
    'פתיחת כייס',
    'ראיונות',
    'הגשת טפסים',
    'Case Opening',
    'Interviews',
    'Form Submissions'
  ));
