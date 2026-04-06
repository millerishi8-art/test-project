/**
 * לקוח ציבורי ל-Supabase (אופציונלי).
 * זרמת ברירת המחדל: הרשמה/התחברות דרך ה-API של השרת (/register, /login) — אותו Bearer מתקבל כאן.
 * אם תעבור ל-signIn ישיר מהדפדפן, הגדר VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.
 */
import { createClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const supabaseConfigured = !!(url && anon);

export const supabase = supabaseConfigured
  ? createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
