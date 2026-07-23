// Авторизация через Google (Supabase Auth).
import { supabase } from "./supabase.js";

export async function getUser() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

// Жёсткая подстраховка: сами достаём токен из адреса (#access_token=...) и ставим сессию.
// Нужно, если автоподхват Supabase (detectSessionInUrl) на проде не срабатывает.
export async function consumeUrlToken() {
  if (!supabase) return null;
  const hash = typeof window !== "undefined" ? window.location.hash : "";
  if (!hash || hash.indexOf("access_token") === -1) return null;
  const p = new URLSearchParams(hash.slice(1));
  const access_token = p.get("access_token");
  const refresh_token = p.get("refresh_token");
  if (!access_token || !refresh_token) return null;
  let user = null;
  try {
    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (!error) user = data.session?.user ?? null;
  } catch (e) {}
  // Чистим токен из адресной строки в любом случае, чтобы он не висел и не путал.
  try { history.replaceState(null, "", window.location.pathname + window.location.search); } catch (e) {}
  return user;
}

export async function signInGoogle() {
  if (!supabase) return;
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export function onAuth(cb) {
  if (!supabase) return;
  supabase.auth.onAuthStateChange((event, session) => cb(event, session?.user ?? null));
}
