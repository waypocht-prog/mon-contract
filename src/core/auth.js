// Авторизация через Google (Supabase Auth).
import { supabase } from "./supabase.js";

export async function getUser() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
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
  supabase.auth.onAuthStateChange((_e, session) => cb(session?.user ?? null));
}
