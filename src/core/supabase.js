// Клиент Supabase. Создаётся только если заданы переменные окружения.
// Без них приложение работает локально (как раньше) — обратная совместимость.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false, // callback обрабатываем сами в consumeAuthCallback
          flowType: "pkce",
        },
      })
    : null;
export const cloudEnabled = !!supabase;
