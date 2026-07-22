// Многоязычность: словари данных + текущий язык + применение к DOM.
import ru from "./ru.js";
import fr from "./fr.js";
import ce from "./ce.js";
import { store, $ } from "../core/store.js";

export const L = { ru, fr, ce };
export const LANGS = ["ru", "fr", "ce"];
export const langLabel = (l) => ({ ru: "РУ", fr: "FR", ce: "НХ" }[l]);

let LANG = store.get("lang", "ru");
export const getLang = () => LANG;

// Перевод по ключу для текущего языка.
export const t = (k) => L[LANG][k];

// Проставляет тексты во все элементы с data-i18n* и метку языка.
export function applyStatic() {
  document.documentElement.lang = LANG;
  document.querySelectorAll("[data-i18n]").forEach((e) => (e.textContent = t(e.dataset.i18n)));
  document.querySelectorAll("[data-i18n-html]").forEach((e) => (e.innerHTML = t(e.dataset.i18nHtml)));
  document.querySelectorAll("[data-i18n-ph]").forEach((e) => (e.placeholder = t(e.dataset.i18nPh)));
  $("#lang").textContent = langLabel(LANG);
}

// Колбэк, который приложение регистрирует, чтобы перерисоваться при смене языка.
let _onChange = () => {};
export function onLangChange(fn) {
  _onChange = fn;
}

export function setLang(l) {
  LANG = l;
  store.set("lang", l);
  applyStatic();
  _onChange();
}
