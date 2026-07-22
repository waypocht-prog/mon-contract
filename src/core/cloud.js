// Синхронизация данных с облаком (таблица kv в Supabase).
// Стратегия offline-first: localStorage — быстрый кэш, Supabase — облако.
// Изменения ставятся в очередь и отправляются; при отсутствии сети копятся и уходят позже.
import { supabase } from "./supabase.js";

const QKEY = "md__queue";
let _uid = null;

function qget() { try { return JSON.parse(localStorage.getItem(QKEY)) || []; } catch (e) { return []; } }
function qset(v) { localStorage.setItem(QKEY, JSON.stringify(v)); }

export function setUid(id) { _uid = id; }

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
  flushQueue();
}

// Отправить накопленные изменения в облако.
export async function flushQueue() {
  if (!supabase || !_uid) return;
  const q = qget();
  if (!q.length) return;
  const keys = [...new Set(q.map((x) => x.k))];
  const rows = keys.map((k) => {
    let v = null;
    try { v = JSON.parse(localStorage.getItem("md_" + k)); } catch (e) {}
    return { user_id: _uid, k, v };
  });
  const { error } = await supabase.from("kv").upsert(rows, { onConflict: "user_id,k" });
  if (!error) qset([]);
}

if (typeof addEventListener !== "undefined") {
  addEventListener("online", () => flushQueue());
}
