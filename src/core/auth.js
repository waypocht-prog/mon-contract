// Авторизация через Google (Supabase Auth).
// Callback обрабатываем вручную и детерминированно (см. consumeAuthCallback):
// поддержаны и современный PKCE (?code=...), и старый implicit (#access_token=...),
// и ошибки OAuth (в query и в hash).
import { supabase } from "./supabase.js";

export async function getUser() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.user ?? null;
}

// Разбор текущего URL на query и hash.
function authParams() {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(
    url.hash.startsWith("#") ? url.hash.slice(1) : url.hash
  );
  return { url, query: url.searchParams, hash };
}

// Ошибку OAuth ищем в обоих местах (query и hash), до проверки code/токенов.
function readAuthError(query, hash) {
  const description =
    query.get("error_description") ||
    hash.get("error_description") ||
    query.get("error") ||
    hash.get("error");
  return description ? description.replace(/\+/g, " ") : null;
}

// После обработки callback убираем ТОЛЬКО OAuth-параметры, сохраняя обычные query приложения.
function cleanAuthUrl(url) {
  const authKeys = [
    "code",
    "error",
    "error_code",
    "error_description",
    "access_token",
    "refresh_token",
    "expires_in",
    "expires_at",
    "provider_token",
    "provider_refresh_token",
    "token_type",
    "type",
  ];
  for (const key of authKeys) url.searchParams.delete(key);
  url.hash = "";
  const clean =
    url.pathname +
    (url.searchParams.size ? `?${url.searchParams.toString()}` : "");
  history.replaceState(null, "", clean);
}

// Ручная обработка OAuth callback.
// Всегда возвращает { handled, user, error }.
export async function consumeAuthCallback() {
  if (!supabase || typeof window === "undefined") {
    return { handled: false, user: null, error: null };
  }

  const { url, query, hash } = authParams();

  // 1) Ошибка OAuth — читаем раньше любых проверок code/токенов.
  const callbackError = readAuthError(query, hash);
  if (callbackError) {
    cleanAuthUrl(url);
    console.error("[auth] OAuth callback error:", callbackError);
    return { handled: true, user: null, error: callbackError };
  }

  // 2) Современный PKCE callback: ?code=...
  const code = query.get("code");
  if (code) {
    let data = null;
    let error = null;
    try {
      ({ data, error } = await supabase.auth.exchangeCodeForSession(code));
    } catch (e) {
      error = e;
    }
    cleanAuthUrl(url);
    if (error) {
      console.error("[auth] exchangeCodeForSession error:", error);
      return { handled: true, user: null, error: error?.message || String(error) };
    }
    return { handled: true, user: data?.session?.user ?? data?.user ?? null, error: null };
  }

  // 3) Старый implicit callback: #access_token=...&refresh_token=...
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (accessToken || refreshToken) {
    if (!accessToken || !refreshToken) {
      cleanAuthUrl(url);
      return { handled: true, user: null, error: "Supabase вернул неполную сессию авторизации." };
    }
    let data = null;
    let error = null;
    try {
      ({ data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      }));
    } catch (e) {
      error = e;
    }
    cleanAuthUrl(url);
    if (error) {
      console.error("[auth] setSession error:", error);
      return { handled: true, user: null, error: error?.message || String(error) };
    }
    return { handled: true, user: data?.session?.user ?? null, error: null };
  }

  // 4) Callback в URL нет.
  return { handled: false, user: null, error: null };
}

export async function signInGoogle() {
  if (!supabase) return;
  // Возвращаемся строго на тот же origin+pathname, откуда начали вход:
  // PKCE code verifier хранится в localStorage конкретного origin.
  const redirectUrl = new URL(window.location.href);
  redirectUrl.search = "";
  redirectUrl.hash = "";
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: redirectUrl.href },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function onAuth(cb) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    cb(event, session?.user ?? null);
  });
  return () => data.subscription.unsubscribe();
}
