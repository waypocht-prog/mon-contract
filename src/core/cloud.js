// Синхронизация данных с облаком (таблица kv в Supabase).
// Стратегия offline-first: localStorage — быстрый кэш, Supabase — облако.
// Изменения ставятся в очередь и отправляются; при отсутствии сети копятся и уходят позже.
import { supabase } from "./supabase.js";

const QKEY = "md__queue";
let _uid = null;

function qget() { try { return JSON.parse(localStorage.getItem(QKEY)) || []; } catch (e) { return []; } }
function qset(v) { localStorage.setItem(QKEY, JSON.stringify(v)); }

export function setUid(id) { _uid = id; }

// Статус синхронизации: "synced" | "saving" | "offline".
let _status = "synced";
const _subs = [];
function setStatus(s) { _status = s; _subs.forEach((f) => { try { f(s); } catch (e) {} }); }
export function onSyncStatus(fn) { _subs.push(fn); try { fn(_status); } catch (e) {} }

// Загрузка всех данных пользователя из облака в localStorage.
export async function hydrate(userId) {
  if (!supabase) return;
  const { data, error } = await supabase.from("kv").select("k,v").eq("user_id", userId);
  if (error || !data) return;
  for (const row of data) {
    try { localStorage.setItem("md_" + row.k, JSON.stringify(row.v)); } catch (e) {}
  }
}

// Пометить ключ на отправку в облако (значение берётся из localStorage при отправке — всегда свежее).
export function pushChange(k) {
  if (!supabase) return;
  const q = qget();
  q.push({ k });
  qset(q);
  if (typeof navigator !== "undefined" && navigator.onLine === false) { setStatus("offline"); return; }
  setStatus("saving");
  flushQueue();
}

// Отправить накопленные изменения в облако.
export async function flushQueue() {
  if (!supabase || !_uid) return;
  const q = qget();
  if (!q.length) { setStatus(navigator.onLine === false ? "offline" : "synced"); return; }
  if (typeof navigator !== "undefined" && navigator.onLine === false) { setStatus("offline"); return; }
  const keys = [...new Set(q.map((x) => x.k))];
  const rows = keys.map((k) => {
    let v = null;
    try { v = JSON.parse(localStorage.getItem("md_" + k)); } catch (e) {}
    return { user_id: _uid, k, v };
  });
  const { error } = await supabase.from("kv").upsert(rows, { onConflict: "user_id,k" });
  if (!error) { qset([]); setStatus("synced"); } else { setStatus("offline"); }
}

if (typeof addEventListener !== "undefined") {
  addEventListener("online", () => flushQueue());
  addEventListener("offline", () => setStatus("offline"));
}
