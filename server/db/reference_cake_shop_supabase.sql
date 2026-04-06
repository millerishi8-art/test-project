-- התייחסות בלבד: סכמה לחנות עוגות עם Supabase Auth.
-- הפרויקט ב-workspace הוא "סוכן ביטוח" (app_users / app_cases) — קובץ זה לא רץ אוטומטית.
-- הרץ ב-Supabase → SQL Editor אם תרצה פרויקט נפרד לעוגות.

-- פרופיל ציבורי לכל משתמש שנרשם דרך Supabase Auth
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  cake_id UUID NOT NULL REFERENCES public.cakes (id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending',
  total_price NUMERIC(12, 2) NOT NULL CHECK (total_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT orders_status_check CHECK (status IN ('pending', 'paid', 'baking', 'ready', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS orders_user_id_idx ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS orders_cake_id_idx ON public.orders (cake_id);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders (created_at DESC);

-- טריגר: יצירת שורת profile אחרי הרשמה ב-auth (אופציונלי)
CREATE OR REPLACE FUNCTION public.handle_new_user ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE PROCEDURE public.handle_new_user ();

-- RLS: הפעלה רק אחרי שמגדירים מדיניות, אחרת אין גישה לשום שורה.
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.cakes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- דוגמאות מדיניות (מותאמות לפרויקט שלך)
-- CREATE POLICY "Profiles read own" ON public.profiles FOR SELECT USING (auth.uid() = id);
-- CREATE POLICY "Cakes public read" ON public.cakes FOR SELECT USING (true);
-- CREATE POLICY "Orders own" ON public.orders FOR ALL USING (auth.uid() = user_id);

COMMENT ON TABLE public.profiles IS 'קישור ל-auth.users';
COMMENT ON TABLE public.cakes IS 'קטלוג עוגות';
COMMENT ON TABLE public.orders IS 'הזמנות לפי משתמש ועוגה';
