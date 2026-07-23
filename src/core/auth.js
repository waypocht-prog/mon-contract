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
  const errInUrl = p.get("error_description") || p.get("error");
  if (errInUrl) { try { window.__authError = "URL: " + errInUrl; } catch (e) {} }
  if (!access_token || !refresh_token) {
    try { window.__authError = window.__authError || "нет access/refresh токена в адресе"; } catch (e) {}
    return null;
  }
  let user = null;
  try {
    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) {
      const msg = error.message || JSON.stringify(error);
      console.error("[auth] setSession error:", msg);
      try { window.__authError = "setSession: " + msg; } catch (e) {}
    } else {
      user = data.session?.user ?? null;
      try { window.__authError = user ? "OK" : "setSession без user"; } catch (e) {}
    }
  } catch (e) {
    console.error("[auth] setSession threw:", e);
    try { window.__authError = "setSession threw: " + (e && e.message ? e.message : String(e)); } catch (_) {}
  }
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
