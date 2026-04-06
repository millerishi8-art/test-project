/**
 * לקוח ציבורי ל-Supabase (אופציונלי).
 * אופציונלי: signIn ישיר מהדפדפן — VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.
 * השרת משתמש ב-SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (לא ב-VITE_).
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
