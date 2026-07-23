// Клиент Supabase. Создаётся только если заданы переменные окружения.
// Без них приложение работает локально (как раньше) — обратная совместимость.
import { createClient } from "@supabase/supabase-js";

// Значения из окружения могут прийти с лишними символами (пробел, перенос строки,
// кавычки) — особенно при ручной вставке в Vercel. Такой символ в заголовке apikey/URL
// ломает fetch («Invalid value»). Поэтому чистим значения перед использованием.
function cleanEnv(v) {
  return typeof v === "string" ? v.trim().replace(/^["'\s]+|["'\s]+$/g, "") : v;
}

const url = cleanEnv(import.meta.env.VITE_SUPABASE_URL);
const key = cleanEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);

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
