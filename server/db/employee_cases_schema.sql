-- הרץ ב-Supabase → SQL Editor אם הטבלה עדיין לא קיימת.
-- מעקב כייסים של מנהלים/עובדים (ראיונות / הגשת טפסים) + סטטוס תשלום.
-- חשוב: ב-production שלנו app_users.id הוא UUID (לא TEXT).

CREATE TABLE IF NOT EXISTS public.employee_cases (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.app_users (id) ON DELETE CASCADE,
  case_number TEXT NOT NULL,
  category TEXT NOT NULL
    CHECK (category IN (
      'תשלום על פתיחת כייס',
      'ראיונות',
      'הגשת טפסים',
      'Case Opening Payment',
      'Interviews',
      'Form Submissions'
    )),
  is_completed BOOLEAN NOT NULL DEFAULT true,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS employee_cases_user_id_idx
  ON public.employee_cases (user_id);

CREATE INDEX IF NOT EXISTS employee_cases_active_idx
  ON public.employee_cases (is_archived, is_paid, created_at DESC);

CREATE INDEX IF NOT EXISTS employee_cases_case_number_idx
  ON public.employee_cases (case_number);

COMMENT ON TABLE public.employee_cases IS
  'כייסי עובדים/מנהלים (ראיונות / הגשת טפסים) – תשלום ואיפוס רק למנהל-על; לאחר ארכוב הרשומה נעולה';
