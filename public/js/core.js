"use strict";
/* 사주냥이 화면 스크립트 — 공통 도구: 선택자·이스케이프·용어 칩·이야기 블록·바텀시트·생일 폼·API·사용 통계.
   index.html 이 js/ 파일들을 순서대로(defer) 불러 하나의 전역 공간을 함께 쓴다. 모든 계산은 서버(/api/*)가 한다. */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ELEM = ["목", "화", "토", "금", "수"];
const HANJA = { 목: "木", 화: "火", 토: "土", 금: "金", 수: "水" };
const S = { birth: null, d: null, gloss: {}, ai: false, kinds: [], chat: { history: [], partner: null, topic: null } };

// ───────────────────────── 용어 칩
let TERM_RE = null;
function buildTermRe() {
  const keys = Object.keys(S.gloss).filter((k) => k.length >= 2).sort((a, b) => b.length - a.length);
  TERM_RE = keys.length ? new RegExp(keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g") : null;
}
const chip = (t, label) => `<button type="button" class="term" data-t="${esc(t)}"${label === "" ? ` aria-label="${esc(t)} 뜻 보기"` : ""}>${esc(label ?? t)}</button>`;
/** 이스케이프된 텍스트에서 [[용어]]는 칩으로, auto=true면 아는 용어도 자동으로 칩으로 */
/** auto: false(자동 링크 안 함) | true(모두) | Set(카드 안에서 처음 나온 용어만 링크) */
function linkify(html, auto = false) {
  const once = auto instanceof Set ? auto : null;
  const mk = (t, label) => { if (once) { if (once.has(t)) return label; once.add(t); } return chip(t, label); };
  if (html.includes("[[")) return html.replace(/\[\[(.+?)\]\]/g, (_, t) => (S.gloss[t] ? mk(t, t) : t));
  return auto && TERM_RE ? html.replace(TERM_RE, (m) => mk(m, m)) : html;
}
const T = (s, auto = false) => linkify(esc(s), auto);
function md(src, auto = false) {
  const inline = (s) => linkify(s, auto).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  let html = "", list = false;
  for (const raw of esc(src).split("\n")) {
    const l = raw.trimEnd();
    const li = l.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/);
    if (li) { if (!list) { html += "<ul>"; list = true; } html += `<li>${inline(li[1])}</li>`; continue; }
    if (list) { html += "</ul>"; list = false; }
    const h = l.match(/^#{1,4}\s+(.*)/);
    if (h) html += `<h3>${inline(h[1])}</h3>`; else if (l.trim()) html += `<p>${inline(l)}</p>`;
  }
  return html + (list ? "</ul>" : "");
}

// ───────────────────────── 냥이 도사 이야기 블록 (규칙 기반 — 서버 sajunyang/story_*.py)
// 원칙: 기본은 짧고 유쾌한 '핵심'만. 자세히 풀이·냥이 설화는 눌렀을 때만 펼친다.
const paras = (arr) => (Array.isArray(arr) ? arr : [arr]).filter(Boolean).map((x) => `<p>${esc(x).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")}</p>`).join("");
let TG = 0;
/** 버튼 여러 개 + 펼침 상자. items: [[라벨, html], ...]  group이면 하나만 열린다 */
function moreSet(items, group = false) {
  items = items.filter(([, h]) => h);
  if (!items.length) return "";
  const g = group ? "g" + (++TG) : "";
  const ids = items.map(() => "tg" + (++TG));
  return `<div class="more-row">${items.map(([l], i) => `<button type="button" class="more-btn" data-tg="${ids[i]}" ${g ? `data-group="${g}"` : ""}>${l}</button>`).join("")}</div>
    ${items.map(([, h], i) => `<div class="more-box" id="${ids[i]}" ${g ? `data-group="${g}"` : ""} hidden>${h}</div>`).join("")}`;
}
const tipBox = (tip, label = "냥이 도사의 한마디") => (tip ? `<div class="chap-tip"><span data-nyang="wink" data-size="38"></span><div><small>${label}</small>${esc(tip)}</div></div>` : "");
const taleHtml = (t) => (t ? `<div class="tale">${paras(t)}</div>` : "");
function chapter(ch) {
  if (!ch) return "";
  const head = ch["핵심"] || ch.summary || "";
  const body = ch["핵심"] ? `${tipBox(ch.tip)}${moreSet([["📖 자세히 풀이", paras(ch.story)], ["🏮 냥이 설화", taleHtml(ch["설화"])]])}`
    : `${paras(ch.story)}${tipBox(ch.tip)}`;
  return `<details class="chap"><summary><i>${ch.icon || "🐾"}</i><div><b>${esc(ch.title)}</b>${head ? `<small>${esc(head)}</small>` : ""}</div></summary>
    <div class="chap-body">${body}</div></details>`;
}
function storyCard(title, intro, mood = "happy") {
  if (!intro?.length) return "";
  return `<div class="card story-card"><div class="story-head"><span class="float" data-nyang="${mood}" data-size="54"></span><h2>${title}</h2></div>
    <div class="story-text">${paras(intro)}</div></div>`;
}
/** 핵심 말풍선 카드 + (선택) 더 보기 버튼들 */
function punchCard(title, punch, mood = "happy", extras = []) {
  if (!punch) return "";
  return `<div class="card punch"><div class="say"><span class="who" data-nyang="${mood}" data-size="54"></span>
    <div class="bubble"><small class="sub">${title}</small><br>${esc(punch)}</div></div>${moreSet(extras)}</div>`;
}
const oneLiners = (obj, icons = {}) => (obj ? `<div class="one-grid">${Object.entries(obj).map(([k, v]) =>
  `<div class="one"><b>${icons[k] || "🐾"} ${esc(k)}</b><span>${esc(v)}</span></div>`).join("")}</div>` : "");

// ───────────────────────── 바텀시트
function openSheet(html) {
  $("#sheet-content").innerHTML = html;
  paintNyang($("#sheet-content")); dedupeTerms($("#sheet-content")); iconize($("#sheet-content"));
  $("#sheet").hidden = false;
}
function closeSheet() { $("#sheet").hidden = true; }
function openTerm(t) {
  const g = S.gloss[t];
  if (!g) return;
  openSheet(`<div class="term-head"><span data-nyang="think" data-size="64"></span><div><h2>${esc(t)}</h2><div class="term-mean">${esc(g["뜻"])}</div></div></div>
    <div class="bubble lav" style="margin-bottom:14px">${esc(g["냥이"])}</div>
    ${S.d && S.ai ? `<button class="ghost wide" type="button" data-ask="${esc(t)}가 내 사주에서 어떤 의미야?" style="margin-bottom:8px">💬 내 사주에선 무슨 뜻인지 냥이에게 묻기</button>` : ""}`);
}
function openGlossary() {
  const items = Object.entries(S.gloss);
  openSheet(`<div class="term-head"><span data-nyang="happy" data-size="64"></span><div><h2>냥이의 명리 교실</h2><div class="term-mean">모르는 말은 냥이가 쉽게 풀어준다냥</div></div></div>
    <input id="gl-q" placeholder="용어 검색 (예: 용신, 편관)" style="margin-bottom:10px">
    <div class="glossary-list">${items.map(([k, v]) => `<button type="button" data-t="${esc(k)}" class="gl-item"><b>${esc(k)}</b>${esc(v["뜻"])}</button>`).join("")}</div>`);
  $("#gl-q").addEventListener("input", (e) => {
    const q = e.target.value.trim();
    $$(".gl-item").forEach((b) => (b.hidden = q && !b.textContent.includes(q)));
  });
}
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-t]");
  if (t) { e.preventDefault(); openTerm(t.dataset.t); return; }
  const a = e.target.closest("[data-ask]");
  if (a) { closeSheet(); askNyang(a.dataset.ask); return; }
  const wn = e.target.closest("[data-wnext]");
  if (wn) { wIdx = (wIdx ?? 0) + 1; $("#wisdom").outerHTML = wisdomCard(S.d["나의길"]["한구절"]); paintNyang($("#wisdom")); return; }
  const wm = e.target.closest("[data-wm]");
  if (wm) { const on = localStorage.getItem(wm.dataset.wm) !== "1"; localStorage.setItem(wm.dataset.wm, on ? "1" : "0");
    wm.classList.toggle("done", on); wm.innerHTML = wm.innerHTML.replace(on ? "⬜" : "✅", on ? "✅" : "⬜"); return; }
  if (e.target.closest("[data-book]")) { openBook(); return; }
  if (e.target.closest("[data-dex]")) { openDex(); return; }
  if (e.target.closest("[data-pae]")) { openPae(); return; }
  if (e.target.closest("[data-garden]")) { openGarden(); return; }
  if (e.target.closest("[data-season]")) { openSeason(); return; }
  if (e.target.closest("[data-ncard]")) { openNyangCard(); return; }
  if (e.target.closest("[data-saved]")) { openSaved(); return; }
  if (e.target.closest("[data-gloss]")) { openGlossary(); return; }
  if (e.target.closest("[data-allmenu]")) { openAllMenu(); return; }
  const pu = e.target.closest("[data-push]"); if (pu) { togglePush(pu); return; }
  if (e.target.closest("[data-taegil]")) { openTaegil(); return; }
  if (e.target.closest("[data-backup]")) { openBackup(); return; }
  const md = e.target.closest("[data-mood]");
  if (md) { saveMood(md.dataset.mood, md.dataset.day); return; }
  const tg = e.target.closest("[data-tg]");
  if (tg) {
    const box = document.getElementById(tg.dataset.tg);
    if (!box) return;
    const open = box.hidden;
    if (tg.dataset.group) $$(`[data-group="${tg.dataset.group}"]`).forEach((el) => { if (el.classList.contains("more-box")) el.hidden = true; else el.classList.remove("on"); });
    box.hidden = !open; tg.classList.toggle("on", open);
    if (open) paintNyang(box);
    return;
  }
  const rd = e.target.closest("[data-read]");
  if (rd) { e.preventDefault(); closeSheet(); readFrom(rd.dataset.read, rd.dataset.day); return; }
  const go = e.target.closest("[data-go]");
  if (go) { const [tab, sub] = go.dataset.go.split(":"); showTab(tab, sub); return; }
  if (e.target.closest("[data-close]")) closeSheet();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });

// ───────────────────────── 생일 폼
function buildForm(form, key, title) {
  form.append($("#tpl-birth").content.cloneNode(true));
  $('[data-slot="title"]', form).textContent = title;
  for (let y = new Date().getFullYear(); y >= 1900; y--) form.year.add(new Option(`${y}년`, y));
  for (let m = 1; m <= 12; m++) form.month.add(new Option(`${m}월`, m));
  for (let d = 1; d <= 31; d++) form.day.add(new Option(`${d}일`, d));
  form.year.value = 2000; form.month.value = 1; form.day.value = 1;
  if (key === "me") $("details.adv", form).insertAdjacentHTML("beforebegin", `
    <div class="field"><span>결혼 <small class="sub">(선택 · 풀이 말투가 달라져요)</small></span>
      <div class="seg small wrap">${["미혼", "연애중", "기혼", "기타"].map((m) => `<label><input type="radio" name="marital" value="${m}"><b>${m === "연애중" ? "연애 중" : m}</b></label>`).join("")}</div></div>
    <label class="field"><span>자녀 <small class="sub">(선택)</small></span>
      <select name="kids"><option value="0">없음</option>${[1, 2, 3, 4, 5].map((n) => `<option value="${n}">${n}명</option>`).join("")}</select></label>`);
  $$('input[type="radio"]', form).forEach((r) => (r.name = `${key}-${r.name}`));
  const sync = () => { $(".leap", form).hidden = val(form, "calendar") !== "lunar"; form.time.disabled = form.unknown.checked; };
  form.addEventListener("change", sync);
  form._sync = sync;
  sync();
}
const val = (form, n) => (form.querySelector(`input[name$="-${n}"]:checked`) || {}).value;
function birthOf(form) {
  const unknown = form.unknown.checked;
  if (!unknown && !form.time.value) throw new Error("태어난 시간을 모르면 '몰라요'를 눌러 줘 — 냥이가 시주를 빼고 정확히 본다냥");
  const [h, mi] = (form.time.value || "12:00").split(":").map(Number);
  return {
    name: form.nm.value.trim(), gender: val(form, "gender"), calendar: val(form, "calendar"),
    leap: val(form, "calendar") === "lunar" && form.leap.checked,
    year: +form.year.value, month: +form.month.value, day: +form.day.value,
    hour: unknown ? null : h, minute: unknown ? 0 : mi, longitude: +form.longitude.value,
    zi_mode: form.split.checked ? "split" : "unified",
    ...(form.kids ? { marital: val(form, "marital") || "", kids: +form.kids.value || 0 } : {}),
  };
}
function fillForm(form, b) {
  if (!b) return;
  form.nm.value = b.name || "";
  for (const k of ["gender", "calendar"]) { const r = form.querySelector(`input[name$="-${k}"][value="${b[k]}"]`); if (r) r.checked = true; }
  form.leap.checked = !!b.leap;
  form.year.value = b.year; form.month.value = b.month; form.day.value = b.day;
  form.unknown.checked = b.hour == null;
  if (b.hour != null) form.time.value = `${String(b.hour).padStart(2, "0")}:${String(b.minute).padStart(2, "0")}`;
  form.longitude.value = Number(b.longitude).toFixed(2);
  form.split.checked = b.zi_mode === "split";
  if (form.kids) {
    form.kids.value = b.kids || 0;
    const m = form.querySelector(`input[name$="-marital"][value="${b.marital || ""}"]`);
    $$('input[name$="-marital"]', form).forEach((x) => (x.checked = x === m));
  }
  form._sync?.();
}

/** token: 지도 주인·멤버 열쇠 — 주소에 남지 않게 헤더(X-Token)로 보낸다 */
async function api(path, body, token) {
  const headers = { "Content-Type": "application/json", ...(token ? { "X-Token": token } : {}) };
  const r = await fetch(path, { method: body ? "POST" : "GET", headers, body: body && JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(typeof j.detail === "string" ? j.detail : "입력값을 확인해 달라냥");
  return j;
}


// ───────── 기능 사용 통계: 어떤 기능을 눌렀는지만 센다(생년월일·이름·입력 내용은 보내지 않음)
function track(name, data) { try { window.va?.("event", data ? { name, data } : { name }); } catch { /* 통계 실패는 무시 */ } }
