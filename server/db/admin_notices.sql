-- הרץ ב-Supabase → SQL Editor → Run
-- חלון עדכונים חד-פעמי למנהלים אחרים אחרי שינוי בכייס

CREATE TABLE IF NOT EXISTS public.admin_notices (
  id TEXT PRIMARY KEY,
  actor_email TEXT,
  actor_name TEXT,
  case_id TEXT,
  client_name TEXT,
  title TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  seen_by JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_notices_created_at_idx
  ON public.admin_notices (created_at DESC);

COMMENT ON TABLE public.admin_notices IS
  'הסברי שינוי בכייס למנהלים אחרים – כל מנהל רואה כל עדכון פעם אחת';
