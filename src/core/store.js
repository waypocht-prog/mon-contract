// Хранилище: localStorage как локальный кэш + отправка изменений в облако (если включено).
import { pushChange } from "./cloud.js";

export const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem("md_" + k)) ?? d; } catch (e) { return d; } },
  set(k, v) { localStorage.setItem("md_" + k, JSON.stringify(v)); pushChange(k); },
};

export const $ = (s, r = document) => r.querySelector(s);

export function esc(s) {
  return (s + "").replace(/[<>&]/g, (x) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[x]));
}

export const todayStr = () => {
  const d = new Date();
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
};

export const monthKey = () => {
  const d = new Date();
  return d.getFullYear() + "-" + (d.getMonth() + 1);
};

export function daysBetween(a, b) {
  return Math.round((Date.parse(b + "T00:00") - Date.parse(a + "T00:00")) / 86400000);
}

export function pad2(n) {
  return String(n).padStart(2, "0");
}

export function toast(m) {
  const el = $("#toast");
  el.textContent = m;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2400);
}
