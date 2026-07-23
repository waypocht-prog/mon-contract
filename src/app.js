// Логика приложения «Мой договор».
// Данные и переводы — в src/i18n, утилиты — в src/core.
import { store, $, esc, todayStr, monthKey, daysBetween, pad2, toast } from "./core/store.js";
import { L, LANGS, getLang, t, applyStatic, setLang, onLangChange } from "./i18n/index.js";
import { cloudEnabled } from "./core/supabase.js";
import { getUser, signInGoogle, signOut, onAuth, consumeUrlToken } from "./core/auth.js";
import { hydrate, setUid, flushQueue, onSyncStatus } from "./core/cloud.js";

/* ===================== PROFILE ===================== */
let profile = store.get("profile", { name: "" });
function profName() { return profile && profile.name ? profile.name : t("name"); }
function showOnboard(edit) {
  $("#ob-name").value = edit && profile.name ? profile.name : "";
  document.querySelectorAll(".ob-langs button").forEach((b) => b.classList.toggle("sel", b.dataset.l === getLang()));
  $("#ob-cancel").style.display = profile.name ? "block" : "none";
  $("#onboard").style.display = "flex";
  setTimeout(() => $("#ob-name").focus(), 150);
}
function cancelOnboard() { $("#onboard").style.display = "none"; }
function obLang(l) { setLang(l); document.querySelectorAll(".ob-langs button").forEach((b) => b.classList.toggle("sel", b.dataset.l === l)); }
function saveOnboard() {
  const n = $("#ob-name").value.trim();
  if (!n) { $("#ob-name").focus(); toast(t("onb_ph")); return; }
  profile.name = n; store.set("profile", profile); $("#onboard").style.display = "none"; renderToday();
}
function editName() { showOnboard(true); }

/* ===================== THEME + LANG BUTTON ===================== */
(function () {
  const s = store.get("theme", null);
  if (s) document.documentElement.dataset.theme = s;
  $("#theme").onclick = () => {
    const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light");
    const n = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = n; store.set("theme", n);
  };
})();
$("#lang").onclick = () => { const i = LANGS.indexOf(getLang()); const nl = LANGS[(i + 1) % LANGS.length]; setLang(nl); toast(t("lang_self")); };

// Перерисовать всё при смене языка (регистрируется в i18n).
onLangChange(() => { resetTodayState(); renderPhrases(); renderPrices(); renderProgram(); renderLog(); renderToday(); });

/* ===================== NAV + HISTORY (кнопка «назад») ===================== */
function resetTodayState() {
  const f = $("#t-flow"); if (f) { f.style.display = "none"; f.innerHTML = ""; }
  const a = $("#t-auditform"); if (a) a.style.display = "none";
  const hm = $("#t-home"); if (hm) hm.style.display = "block";
  ritualStep = 0;
}
let armed = false, ritualStep = 0;
function curScreen() {
  if (closeId !== null) return "close";
  const af = $("#t-auditform"); if (af && af.style.display !== "none") return "audit";
  const fl = $("#t-flow"); if (fl && fl.style.display !== "none" && $("#v-today").classList.contains("active")) return "ritual";
  return "home";
}
function arm() { if (armed) return; try { history.pushState({ mdApp: 1 }, ""); armed = true; } catch (e) {} }
function appBackOne() {
  if (closeId !== null) { cancelClose(); return; }
  const af = $("#t-auditform"); if (af && af.style.display !== "none") { closeAudit(); return; }
  if (ritualStep >= 3) { renderStep(2); return; }
  if (ritualStep === 2) { renderStep(1); return; }
  if (ritualStep === 1) { endRitual(); return; }
}
addEventListener("popstate", () => { armed = false; if (curScreen() === "home") return; appBackOne(); if (curScreen() !== "home") arm(); });
function nav(v) {
  closeId = null; resetTodayState();
  document.querySelectorAll(".view").forEach((x) => x.classList.remove("active"));
  $("#v-" + v).classList.add("active");
  document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("on", b.dataset.v === v));
  window.scrollTo(0, 0);
  if (v === "log") renderLog(); if (v === "today") renderToday(); if (v === "prices") renderPrices();
}

/* ===================== TODAY / STREAK ===================== */
function pluralDay(n) {
  if (getLang() === "fr") return n < 2 ? "jour" : "jours";
  if (getLang() === "ce") return n === 1 ? "де" : "денош";
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return "дней"; if (b > 1 && b < 5) return "дня"; if (b === 1) return "день"; return "дней";
}
function computeStreak() {
  const s = store.get("streak", { last: null, count: 0 });
  if (s.last) { const gap = daysBetween(s.last, todayStr()); if (gap > 1) { s.count = 0; s.last = null; store.set("streak", s); } }
  return s;
}
function markDay() {
  const s = store.get("streak", { last: null, count: 0 }), tt = todayStr();
  if (s.last === tt) return false;
  const gap = s.last ? daysBetween(s.last, tt) : 999;
  s.count = gap === 1 ? s.count + 1 : 1; s.last = tt; store.set("streak", s); return true;
}
function checkIn() { if (markDay()) { renderToday(); toast(t("t_checkin")); } else toast(t("t_already")); }
function renderToday() {
  const d = new Date();
  $("#t-date").textContent = getLang() === "ce"
    ? d.getDate() + "." + pad2(d.getMonth() + 1) + "." + d.getFullYear()
    : d.toLocaleDateString(t("locale"), { weekday: "long", day: "numeric", month: "long" });
  const h = d.getHours();
  const g = h < 5 ? t("greet_night") : h < 12 ? t("greet_morning") : h < 18 ? t("greet_day") : t("greet_evening");
  $("#t-hi").textContent = g + ", " + profName();
  const av = $("#t-avatar"); if (av) av.textContent = (profName().trim()[0] || "?").toUpperCase();
  const s = computeStreak();
  $("#t-streak").textContent = s.count; $("#t-streak-w").textContent = pluralDay(s.count);
  $("#t-flame").textContent = s.count >= 1 ? "🔥" : "🕯️";
  const done = s.last === todayStr(); const btn = $("#t-checkin");
  btn.textContent = done ? t("checkin_done") : t("checkin"); btn.classList.toggle("done", done);
  const w = store.get("weeks", {}); let cur = -1; for (let i = 0; i < 12; i++) { if (!w[i]) { cur = i; break; } }
  const fEl = $("#t-focus");
  if (cur >= 0) {
    const info = WEEKFLAT()[cur];
    fEl.innerHTML = `<div class="focus" onclick="nav('program')"><span class="k">${t("focus_key")} · ${cur + 1}/12</span><b>${esc(info[0])}</b><p>${esc(info[1])}</p><div class="go">${t("focus_open")}</div></div>`;
  } else fEl.innerHTML = `<div class="focus"><span class="k">${t("focus_done_key")}</span><b>${t("focus_done_t")}</b><p>${t("focus_done_p")}</p></div>`;
  const cta = $("#t-audit"); const auditDone = store.get("audit_" + monthKey(), null);
  cta.innerHTML = !auditDone && auditDue()
    ? `<div class="audit-cta" onclick="openAudit()"><span class="ic">🧾</span><div><b>${t("audit_cta_t")}</b><span>${t("audit_cta_s")}</span></div><span style="margin-left:auto;color:var(--accent)">→</span></div>`
    : "";
}
function auditDue() { const d = new Date(); return d.getDate() <= 7 || d.getDay() === 0; }

/* ===================== AUDIT ===================== */
function openAudit() {
  $("#t-home").style.display = "none"; $("#t-flow").style.display = "none";
  const f = $("#t-auditform"); f.style.display = "block";
  const prev = store.get("audit_" + monthKey(), { q1: "", q2: "", q3: "", q4: "" });
  f.innerHTML = `<div class="formtop"><button class="navback" onclick="closeAudit()" aria-label="back">←</button></div><div class="eyebrow">${t("au_eye")}</div><h2 style="font-size:22px;margin-bottom:14px">${t("au_h")}</h2>
    <div class="card">
      <label class="fld">${t("au1")}</label><input type="text" id="a1" value="${esc(prev.q1)}" placeholder="${esc(t("au1_ph"))}">
      <label class="fld" style="margin-top:14px">${t("au2")}</label><input type="text" id="a2" value="${esc(prev.q2)}" placeholder="${esc(t("au2_ph"))}">
      <label class="fld" style="margin-top:14px">${t("au3")}</label><textarea id="a3" placeholder="${esc(t("au3_ph"))}">${esc(prev.q3)}</textarea>
      <label class="fld" style="margin-top:14px">${t("au4")}</label><textarea id="a4" placeholder="${esc(t("au4_ph"))}">${esc(prev.q4)}</textarea>
    </div>
    <button class="btn btn-green" onclick="saveAudit()">${t("au_save")}</button>
    <div class="row"><button class="btn btn-ghost" onclick="closeAudit()">${t("au_close")}</button></div>`;
  window.scrollTo(0, 0); arm();
}
function saveAudit() { store.set("audit_" + monthKey(), { q1: $("#a1").value, q2: $("#a2").value, q3: $("#a3").value, q4: $("#a4").value, done: true, t: Date.now() }); closeAudit(); toast(t("t_audit")); }
function closeAudit() { $("#t-auditform").style.display = "none"; $("#t-home").style.display = "block"; renderToday(); }

/* ===================== PHRASES ===================== */
function renderPhrases() {
  $("#phrase-list").innerHTML = t("phrases").map((p) => `<div class="quote"><span class="lbl">${p[0]} · ${esc(p[1])}</span>«${esc(p[2])}»<br><button class="copyhint" style="margin-top:8px;color:var(--accent);font-weight:600" onclick='copyText(${JSON.stringify(p[2])})'>📋 ${t("copy")}</button></div>`).join("");
}
function copyText(x) { navigator.clipboard?.writeText(x).then(() => toast(t("t_copied")), () => toast(t("t_copyfail"))); }

/* ===================== PRICES ===================== */
const SEED_AMTS = [80, 150, 400, 500, 5000];
function defaultPrices() { return t("seed").map((n, i) => ({ name: n, amt: SEED_AMTS[i] })); }
function migratePrices() {
  const p = store.get("prices", null);
  if (p !== null && store.get("pricesCustom", null) === null) {
    const ru = L.ru.seed;
    const old = Array.isArray(p) && p.length === ru.length && p.every((x, i) => x && x.name === ru[i]);
    store.set("pricesCustom", !old);
  }
}
function getPrices() { return store.get("pricesCustom", false) ? store.get("prices", []) : defaultPrices(); }
function renderPrices() {
  const list = getPrices(); const el = $("#price-list");
  if (!list.length) { el.innerHTML = `<div class="empty">—</div>`; return; }
  el.innerHTML = list.map((p, i) => `<div class="price-item"><div class="pn">${esc(p.name)}</div><div class="pa">${p.amt} €</div><button class="del" onclick="delPrice(${i})">✕</button></div>`).join("");
}
function addPrice() {
  const name = $("#p-name").value.trim(); const amt = parseInt(($("#p-amt").value || "").replace(/\D/g, "")) || 0;
  if (!name) { toast(t("t_pname")); return; } if (!amt) { toast(t("t_pamt")); return; }
  const list = getPrices().slice(); list.push({ name, amt }); store.set("prices", list); store.set("pricesCustom", true);
  $("#p-name").value = ""; $("#p-amt").value = ""; renderPrices(); toast(t("t_padd"));
}
function delPrice(i) { const list = getPrices().slice(); list.splice(i, 1); store.set("prices", list); store.set("pricesCustom", true); renderPrices(); }
function useprice(a) { const f = $("#f-amt"); if (f) { f.value = a; gate(); toast(t("t_chip")(a)); } }

/* ===================== RITUAL ===================== */
let flow = {};
function startRitual() { flow = { who: "", what: "", color: null }; $("#t-home").style.display = "none"; $("#t-auditform").style.display = "none"; renderStep(1); arm(); }
function endRitual() { ritualStep = 0; $("#t-flow").style.display = "none"; $("#t-home").style.display = "block"; $("#t-flow").innerHTML = ""; renderToday(); }
const dots = (n) => `<div class="step-dots">${[1, 2, 3].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</div>`;
const flowTop = (n) => `<div class="flowtop"><button class="navback" onclick="flowBack(${n})" aria-label="back">←</button>${dots(n)}<button class="xbtn" onclick="endRitual()" aria-label="close">✕</button></div>`;
function flowBack(n) { if (n <= 1) endRitual(); else renderStep(n - 1); }
function renderStep(n) {
  ritualStep = n;
  const f = $("#t-flow"); f.style.display = "block"; window.scrollTo(0, 0);
  if (n === 1) {
    f.innerHTML = `${flowTop(1)}<div class="eyebrow">${t("st1_eye")}</div><h2 style="font-size:22px;margin-bottom:14px">${t("st1_h")}</h2>
    <div class="card"><label class="fld">${t("who")}</label><input type="text" id="f-who" placeholder="${esc(t("who_ph"))}" value="${esc(flow.who)}">
    <label class="fld" style="margin-top:14px">${t("what")}</label><input type="text" id="f-what" placeholder="${esc(t("what_ph"))}" value="${esc(flow.what)}"></div>
    <button class="btn btn-primary" onclick="toStep2()">${t("next")}</button><div class="row"><button class="btn btn-ghost" onclick="endRitual()">${t("cancel")}</button></div>`;
    setTimeout(() => $("#f-who")?.focus(), 100);
  }
  if (n === 2) {
    f.innerHTML = `${flowTop(2)}<div class="eyebrow">${t("st2_eye")}</div><h2 style="font-size:22px;margin-bottom:12px">${t("st2_h")}</h2>
    <div class="q-self">${t("qself")}</div>
    <div class="tri">
      <button onclick="pick('g')"><span class="dot g"></span><span class="tx"><b>${t("tri_g_t")}</b><span>${t("tri_g_s")}</span></span></button>
      <button onclick="pick('a')"><span class="dot a"></span><span class="tx"><b>${t("tri_a_t")}</b><span>${t("tri_a_s")}</span></span></button>
      <button onclick="pick('r')"><span class="dot r"></span><span class="tx"><b>${t("tri_r_t")}</b><span>${t("tri_r_s")}</span></span></button>
    </div><div class="row" style="margin-top:14px"><button class="btn btn-ghost" onclick="renderStep(1)">${t("back")}</button></div>`;
  }
  if (n === 3) renderResult();
}
function toStep2() { flow.who = $("#f-who").value.trim(); flow.what = $("#f-what").value.trim(); renderStep(2); }
function pick(c) { flow.color = c; renderStep(3); }
function renderResult() {
  const f = $("#t-flow");
  if (flow.color === "g") f.innerHTML = `${flowTop(3)}<div class="res g"><div class="tag"><span class="tdot" style="background:var(--green)"></span>${t("cat_g")}</div><h3>${t("res_g_h")}</h3><p>${t("res_g_p")}</p></div>${finishBtns()}`;
  else if (flow.color === "a") f.innerHTML = `${flowTop(3)}<div class="res a"><div class="tag"><span class="tdot" style="background:var(--amber)"></span>${t("cat_a")}</div><h3>${t("res_a_h")}</h3><p>${t("res_a_p")}</p></div><div class="quote"><span class="lbl">${t("res_a_q_l")}</span>${t("res_a_q")}</div>${finishBtns()}`;
  else f.innerHTML = `${flowTop(3)}<div class="res r"><div class="tag"><span class="tdot" style="background:var(--red)"></span>${t("cat_r")}</div><h3>${t("res_r_h")}</h3><p>${t("res_r_p")}</p></div>
    <div class="quote"><span class="lbl">${t("res_r_q_l")}</span>${t("res_r_q")}</div>
    <p style="font-size:13.5px;color:var(--ink-faint);margin:2px 2px 12px">${t("res_r_note")}</p>
    <div class="card" style="padding:16px"><h3 style="font-size:15px;margin-bottom:12px">${t("fill_h")}</h3>
      <label class="fld">${t("f_price")}</label><input type="text" id="f-amt" inputmode="numeric" placeholder="${esc(t("f_price_ph"))}" oninput="gate()">
      ${priceChips()}
      <label class="fld" style="margin-top:12px">${t("f_dl")}</label><input type="text" id="f-deadline" placeholder="${esc(t("f_dl_ph"))}">
      <label class="fld" style="margin-top:12px">${t("f_bn")}</label><input type="text" id="f-benefit" placeholder="${esc(t("f_bn_ph"))}">
      <div style="height:8px"></div>
      <label class="check"><input type="checkbox" class="gate" onchange="gate()"><span>${t("chk1")}</span></label>
      <label class="check"><input type="checkbox" class="gate" onchange="gate()"><span>${t("chk2")}</span></label>
      <label class="check"><input type="checkbox" class="gate" onchange="gate()"><span>${t("chk3")}</span></label></div>
    <button class="btn btn-primary" id="startBtn" disabled onclick="finish()">${t("gate_start")}</button>
    <div class="row"><button class="btn btn-ghost" onclick="renderStep(2)">${t("back")}</button></div>`;
}
function finishBtns() { return `<button class="btn btn-green" onclick="finish()">${t("finish_green")}</button><div class="row"><button class="btn btn-ghost" onclick="renderStep(2)">${t("back")}</button></div>`; }
function priceChips() {
  const list = getPrices(); if (!list.length) return "";
  return `<div style="font-size:12px;color:var(--ink-faint);margin:10px 2px 6px">${t("chips_label")}</div><div class="chips">${list.map((p) => `<button type="button" class="chip" onclick="useprice(${p.amt})">${esc(p.name)} · ${p.amt} €</button>`).join("")}</div>`;
}
function gate() {
  const boxes = [...document.querySelectorAll(".gate")].every((c) => c.checked);
  const priced = (($("#f-amt")?.value || "").replace(/\D/g, "")) !== "";
  const all = boxes && priced; const b = $("#startBtn"); b.disabled = !all;
  b.textContent = all ? t("gate_ok") : !priced ? t("gate_price") : t("gate_all");
  b.className = "btn " + (all ? "btn-green" : "btn-primary");
}
function finish() {
  const c = flow.color; const amt = c === "r" ? parseInt(($("#f-amt")?.value || "").replace(/\D/g, "")) || 0 : 0;
  const dl = c === "r" ? ($("#f-deadline")?.value || "").trim() : ""; const bn = c === "r" ? ($("#f-benefit")?.value || "").trim() : "";
  const log = store.get("log", []);
  log.unshift({ t: Date.now(), who: flow.who || "—", what: flow.what || "", c, amt, dl, bn, status: c === "r" ? "open" : "done", author: profName() });
  store.set("log", log);
  markDay(); endRitual(); toast(c === "r" ? t("t_fin_r") : t("t_fin_o")); if (c === "r") setTimeout(() => nav("log"), 700);
}

/* ===================== LOG / ARCHIVE ===================== */
const CCOL = { g: "var(--green)", a: "var(--amber)", r: "var(--red)" };
let closeId = null, closeStatus = "paid";
function fmtDate(ts, full) {
  const d = new Date(ts);
  if (getLang() === "ce") { const s = d.getDate() + "." + pad2(d.getMonth() + 1); return full ? s + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) : s; }
  const dd = d.toLocaleDateString(t("locale"), { day: "numeric", month: "short" });
  return full ? dd + " " + d.toLocaleTimeString(t("locale"), { hour: "2-digit", minute: "2-digit" }) : dd;
}
function isOpen(l) { return l.c === "r" && (l.status || "open") === "open"; }
function renderLog() {
  const log = store.get("log", []); const now = new Date(), m = now.getMonth(), y = now.getFullYear();
  const month = log.filter((l) => { const d = new Date(l.t); return d.getMonth() === m && d.getFullYear() === y; });
  $("#s-red").textContent = month.filter((l) => l.c === "r").length;
  $("#s-all").textContent = month.length;
  $("#s-money").textContent = month.reduce((s, l) => s + (l.paid || l.amt || 0), 0);
  if (closeId !== null) { renderCloseForm(); return; }
  const list = $("#log-list");
  if (!log.length) { list.innerHTML = `<div class="empty">${t("log_empty")}</div>`; return; }
  const active = log.filter(isOpen), archive = log.filter((l) => !isOpen(l));
  let html = `<div class="phase-h">${t("log_active")} · ${active.length}</div>`;
  html += active.length ? active.map(activeCard).join("") : `<div class="empty" style="padding:16px">${t("active_empty")}</div>`;
  html += `<div class="phase-h">${t("log_archive")} · ${archive.length}</div>`;
  html += archive.length ? archive.slice(0, 120).map(archiveCard).join("") : `<div class="empty" style="padding:16px">${t("archive_empty")}</div>`;
  html += `<button class="btn btn-ghost" style="margin-top:10px" onclick="clearLog()">${t("log_clear")}</button>`;
  list.innerHTML = html;
}
function activeCard(l) {
  const extra = [l.dl ? t("meta_dl") + ": " + esc(l.dl) : "", l.bn ? t("meta_bn") + ": " + esc(l.bn) : ""].filter(Boolean).join(" · ");
  return `<div class="logitem" style="flex-wrap:wrap"><span class="cdot" style="background:${CCOL.r}"></span><div style="min-width:0;flex:1"><div class="who">${esc(l.who)}</div>${l.what ? `<div class="what">${esc(l.what)}</div>` : ""}<div class="meta">${t("cat_r")} · ${fmtDate(l.t, true)}${extra ? " · " + extra : ""}</div>${l.author ? `<div class="by">${t("meta_by")}: ${esc(l.author)}</div>` : ""}</div>${l.amt ? `<div class="amt">${l.amt} €</div>` : ""}<button class="dealbtn" onclick="openClose(${l.t})">✓ ${t("deal_close")}</button></div>`;
}
function statusInfo(l) {
  if (l.c === "g") return { cls: "g", txt: t("cat_g") }; if (l.c === "a") return { cls: "a", txt: t("cat_a") };
  if (l.status === "paid") return { cls: "g", txt: t("st_paid") }; if (l.status === "done") return { cls: "a", txt: t("st_done") }; if (l.status === "cancel") return { cls: "r", txt: t("st_cancel") };
  return { cls: "n", txt: t("cat_r") };
}
function archiveCard(l) {
  const s = statusInfo(l); const col = l.c === "g" ? CCOL.g : l.c === "a" ? CCOL.a : CCOL.r;
  const paidLine = l.status === "paid" && l.paid ? `<span class="amt">${l.paid} €</span>` : l.amt && l.c === "r" && l.status !== "cancel" && !l.paid ? `<span class="amt">${l.amt} €</span>` : "";
  const out = l.outcome ? `<div class="out">${esc(l.outcome)}</div>` : "";
  const closed = l.tdone ? ` · ${t("meta_done_at")} ${fmtDate(l.tdone, false)}` : "";
  return `<div class="logitem" style="flex-wrap:wrap"><span class="cdot" style="background:${col}"></span><div style="min-width:0;flex:1"><div class="who">${esc(l.who)}</div>${l.what ? `<div class="what">${esc(l.what)}</div>` : ""}<div class="meta"><span class="pill ${s.cls}">${s.txt}</span> · ${fmtDate(l.t, false)}${closed}</div>${l.author ? `<div class="by">${t("meta_by")}: ${esc(l.author)}</div>` : ""}${out}</div>${paidLine}</div>`;
}
function openClose(id) { closeId = id; closeStatus = "paid"; renderLog(); window.scrollTo(0, 0); arm(); }
function cancelClose() { closeId = null; renderLog(); }
function setCS(s) { closeStatus = s; ["paid", "done", "cancel"].forEach((x) => $("#cs-" + x)?.classList.toggle("sel", x === s)); }
function renderCloseForm() {
  const l = store.get("log", []).find((x) => x.t === closeId); if (!l) { closeId = null; return renderLog(); }
  $("#log-list").innerHTML = `<div class="formtop"><button class="navback" onclick="cancelClose()" aria-label="back">←</button></div><div class="eyebrow">${esc(l.who)}${l.what ? " — " + esc(l.what) : ""}</div>
    <h2 style="font-size:21px;margin-bottom:14px">${t("close_h")}</h2>
    <button class="csbtn sel" id="cs-paid" onclick="setCS('paid')"><span class="d" style="background:var(--green)"></span>${t("st_paid")}</button>
    <button class="csbtn" id="cs-done" onclick="setCS('done')"><span class="d" style="background:var(--amber)"></span>${t("st_done")}</button>
    <button class="csbtn" id="cs-cancel" onclick="setCS('cancel')"><span class="d" style="background:var(--red)"></span>${t("st_cancel")}</button>
    <div class="card" style="padding:16px;margin-top:6px">
      <label class="fld">${t("close_paid")}</label><input type="text" id="c-paid" inputmode="numeric" value="${l.amt || ""}">
      <label class="fld" style="margin-top:12px">${t("close_note")}</label><textarea id="c-note" placeholder="${esc(t("close_note_ph"))}">${esc(l.outcome || "")}</textarea>
    </div>
    <button class="btn btn-green" onclick="saveClose()">${t("close_save")}</button>
    <div class="row"><button class="btn btn-ghost" onclick="cancelClose()">${t("cancel")}</button></div>`;
}
function saveClose() {
  const log = store.get("log", []); const l = log.find((x) => x.t === closeId); if (!l) { closeId = null; return renderLog(); }
  l.status = closeStatus; l.paid = closeStatus === "cancel" ? 0 : parseInt(($("#c-paid").value || "").replace(/\D/g, "")) || 0;
  l.outcome = $("#c-note").value.trim(); l.tdone = Date.now();
  store.set("log", log); closeId = null; renderLog(); toast(t("t_archived"));
}
function clearLog() { if (confirm(t("log_confirm"))) { store.set("log", []); closeId = null; renderLog(); toast(t("t_cleared")); } }

/* ===================== PROGRAM ===================== */
function WEEKFLAT() { const a = []; t("weeks").forEach((p) => p[1].forEach((w) => a.push(w))); return a; }
function renderProgram() {
  const done = store.get("weeks", {}); let html = "", idx = 0, ndone = 0; let cur = -1;
  for (let i = 0; i < 12; i++) { if (!done[i]) { cur = i; break; } }
  t("weeks").forEach((p) => {
    html += `<div class="phase-h">${esc(p[0])}</div>`;
    p[1].forEach((w) => {
      const i = idx++; const on = !!done[i]; if (on) ndone++;
      html += `<label class="wk ${on ? "done" : ""} ${i === cur ? "cur" : ""}"><input type="checkbox" ${on ? "checked" : ""} onchange="toggleWeek(${i},this.checked)"><div><span class="num">${i + 1}/12${i === cur ? " · " + t("wk_now") : ""}</span><br><b>${esc(w[0])}</b><p>${esc(w[1])}</p></div></label>`;
    });
  });
  $("#week-list").innerHTML = html; $("#prog-bar").style.width = (ndone / 12 * 100) + "%"; $("#prog-txt").textContent = t("prog_txt")(ndone);
}
function toggleWeek(i, v) { const d = store.get("weeks", {}); d[i] = v; store.set("weeks", d); renderProgram(); renderToday(); if (v) toast(t("t_week")); }

/* ===================== ИНЛАЙН-ОБРАБОТЧИКИ (для onclick в разметке) ===================== */
Object.assign(window, {
  nav, checkIn, startRitual, editName, addPrice, obLang, saveOnboard,
  openAudit, saveAudit, closeAudit, delPrice, toStep2, endRitual, pick,
  renderStep, finish, useprice, clearLog, openClose, setCS, saveClose,
  cancelClose, toggleWeek, gate, copyText, flowBack, cancelOnboard,
  signInGoogle, doSignOut,
});

/* ===================== AUTH GATE + INIT ===================== */
function showLogin() { applyStatic(); $("#login").style.display = "flex"; }

async function doSignOut() {
  try { await signOut(); } catch (e) {}
  Object.keys(localStorage).forEach((k) => { if (k.startsWith("md_")) localStorage.removeItem(k); });
  location.reload();
}

function startApp() {
  applyStatic();
  migratePrices();
  renderPhrases();
  renderPrices();
  renderProgram();
  renderLog();
  renderToday();
  if (cloudEnabled) {
    const lb = $("#logout-btn"); if (lb) lb.style.display = "block";
    const lh = $("#logout"); if (lh) lh.style.display = "grid";
    const sy = $("#sync"); if (sy) sy.style.display = "inline-flex";
    onSyncStatus(renderSync);
  }
  if (!profile.name) showOnboard(false);
}

function renderSync(s) {
  const el = $("#sync"); if (!el) return;
  const map = { synced: "ok", saving: "saving", offline: "off" };
  el.className = "sync " + (map[s] || "off");
  el.textContent = t(s === "saving" ? "sync_saving" : s === "offline" ? "sync_offline" : "sync_synced");
}

async function afterLogin(user) {
  setUid(user.id);
  // Сначала отправляем накопленные офлайн-изменения, потом тянем облако —
  // иначе hydrate перезапишет локальные правки, и они потеряются.
  try { await flushQueue(); } catch (e) {}
  try { await hydrate(user.id); } catch (e) {}
  profile = store.get("profile", { name: "" });
  if (!profile.name) {
    profile.name = (user.user_metadata && user.user_metadata.full_name) || (user.email ? user.email.split("@")[0] : "");
    store.set("profile", profile);
  }
  startApp();
}

async function boot() {
  if (!cloudEnabled) { startApp(); return; }
  let done = false;
  // 1) Вернулись с Google? Забираем токен из адреса вручную — надёжнее автоподхвата Supabase.
  try {
    const u = await consumeUrlToken();
    if (u) { done = true; afterLogin(u); return; }
  } catch (e) {}
  // 2) Иначе слушаем события: Supabase шлёт INITIAL_SESSION с итоговой сессией, затем SIGNED_IN.
  onAuth((event, user) => {
    if (done) return;
    if (user) { done = true; afterLogin(user); }
    else if (event === "INITIAL_SESSION") { showLogin(); } // старт без сессии — показываем вход
  });
  // Страховка: если событие почему-то не пришло за 4 сек — проверяем сессию напрямую.
  setTimeout(async () => {
    if (done) return;
    let u = null;
    try { u = await getUser(); } catch (e) {}
    if (u) { done = true; afterLogin(u); }
    else showLogin();
  }, 4000);
}

boot();
