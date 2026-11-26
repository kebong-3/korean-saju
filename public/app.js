"use strict";
/* 사주냥이 화면 스크립트 — 모든 계산은 서버(/api/saju)가 하고, 여기서는 보여주기만 한다. */
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
const chip = (t, label) => `<button type="button" class="term" data-t="${esc(t)}">${esc(label ?? t)}</button>`;
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

// ───────────────────────── 바텀시트// ───────────────────────── 바텀시트
function openSheet(html) {
  $("#sheet-content").innerHTML = html;
  paintNyang($("#sheet-content")); dedupeTerms($("#sheet-content"));
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

async function api(path, body) {
  const r = await fetch(path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(typeof j.detail === "string" ? j.detail : "입력값을 확인해 달라냥");
  return j;
}

// ───────────────────────── 시작·화면 전환
const APPV = "22";
async function loadMe(birth) {
  const ck = `${hashStr(JSON.stringify(birth))}:${kstDate(0)}:${APPV}`;
  let cache = null; try { cache = JSON.parse(localStorage.getItem("nyang:sajuc") || "null"); } catch { cache = null; }
  if (cache?.k === ck) S.d = cache.d;
  else {
    try { S.d = await api("/api/saju", birth); try { localStorage.setItem("nyang:sajuc", JSON.stringify({ k: ck, d: S.d })); } catch { /* 저장 공간 부족 */ } }
    catch (err) { if (cache?.k?.startsWith(hashStr(JSON.stringify(birth)) + ":")) S.d = cache.d; else throw err; }
  }
  S.birth = birth;
  localStorage.setItem("nyang:me", JSON.stringify(birth));
  S.chat = { history: [], partner: null, topic: null };
  applyOutfit(); paintNyang(document.querySelector(".top") || document);
  renderAll();
  $("#onboard").hidden = true; $("#main").hidden = false;
  showTab("home");
  let go = null; try { go = localStorage.getItem("nyang:go"); localStorage.removeItem("nyang:go"); } catch { /* */ }
  if (go === "compat:map") { compatMode = "map"; renderCompat(); showTab("compat"); store.set("revealed", 1); }
  else if (!store.get("revealed", 0)) showReveal();
  autoBackup();
}
function loading(el) { el.innerHTML = `<div class="loading"><span data-nyang="focus" data-size="80"></span>냥이가 만세력을 펼치는 중…</div>`; paintNyang(el); }

function showTab(tab, sub) {
  if (tab !== "talk") saveTalk();
  $$(".bottom button").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === tab));
  $$(".tab").forEach((s) => (s.hidden = s.id !== `tab-${tab}`));
  if (tab === "luck" && sub) setLuck(sub);
  if (tab === "talk") startTalk();
  if (tab === "path") renderPath(sub);
  if (tab === "saju") {
    const panes = ["glance", "story", "ogo", "manse"];
    const pane = panes.includes(sub) ? sub : sub === "basic" ? "glance" : sub === "sinsal" ? "manse" : (sub && $(`#${sub}`)?.closest("[data-spane]")?.dataset.spane) || "glance";
    setSajuPane(pane);
    if (sub === "sinsal") { requestAnimationFrame(() => $("#mx-ss")?.scrollIntoView({ behavior: "smooth", block: "start" })); return; }
    if (sub && !panes.includes(sub) && sub !== "basic") { requestAnimationFrame(() => $(`#${sub}`)?.scrollIntoView({ behavior: "smooth", block: "start" })); return; }
  }
  window.scrollTo({ top: 0 });
}

function renderAll() {
  const d = S.d, i = d["입력"];
  $("#me-name").textContent = d["이름"] ? `${d["이름"]}님` : "나";
  $("#me-sub").textContent = `${i["띠"]}띠 · ${d["원국"]["일주"]["한글"]}일주`;
  renderHome(); renderLuck(); renderSaju(); renderCompat(); renderPath(); $("#tab-talk").innerHTML = "";
  paintNyang($("#main")); paintNyang($(".bottom"));
  ["home", "luck", "saju", "compat", "path"].forEach((t) => dedupeTerms($(`#tab-${t}`)));
}

// ───────────────────────── 첫 감명 카드(리빌) · 2027 신년 공유 카드
function yearCardSvg(d) {
  const y = d["운세"]["신년운세"], me = d["나의유형"] || {}, yt = d["나의올해"] || {}, nm = nim();
  const good = (y["좋은달표시"] || []).join(" · ");
  const color = (d["운세"]["맞춤"]?.["행운의색"] || [""])[0];
  const cat = nyang("happy", 120).replace("<svg ", '<svg x="120" y="70" ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 450" width="100%" role="img" aria-label="${y["연도"]} 신년 카드"
    font-family="Jua, Gowun Dodum, Apple SD Gothic Neo, Malgun Gothic, sans-serif">
    <defs><linearGradient id="yc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe4ea"/><stop offset="1" stop-color="#efe9ff"/></linearGradient></defs>
    <rect width="360" height="450" rx="28" fill="url(#yc)"/>
    <text x="24" y="38" font-size="14" fill="#c2385a">사주냥이 · ${y["연도"]} 신년운세</text>
    <text x="336" y="38" font-size="12" fill="#6b6080" text-anchor="end">${esc(y["간지"])}</text>
    ${cat}
    <text x="180" y="218" font-size="15" fill="#6b6080" text-anchor="middle">${esc(nm)}${d["이름"] ? "은" : "는"} ${esc(me["이모지"] || "")} ${esc(me["이름"] || "")}</text>
    <text x="180" y="256" font-size="27" fill="#3b2f4a" text-anchor="middle">${esc(yt["이모지"] || "")} ${esc(yt["이름"] || y["테마"])}</text>
    <text x="180" y="284" font-size="15" fill="#3b2f4a" text-anchor="middle">'${esc(y["테마"])}'</text>
    <rect x="34" y="306" width="292" height="94" rx="18" fill="#ffffff" opacity=".85"/>
    <text x="52" y="334" font-size="13" fill="#7c5cf0">힘 실을 달</text><text x="308" y="334" font-size="14" fill="#3b2f4a" text-anchor="end">${esc(good)}</text>
    <text x="52" y="360" font-size="13" fill="#7c5cf0">나의 보약 기운</text><text x="308" y="360" font-size="14" fill="#3b2f4a" text-anchor="end">${esc(d["용신"]["용신"])} · ${esc(color)}</text>
    <text x="52" y="386" font-size="13" fill="#7c5cf0">한 해 한 줄</text><text x="308" y="386" font-size="13" fill="#3b2f4a" text-anchor="end">${esc((yt["설명"] || "").slice(0, 20))}</text>
    <text x="180" y="430" font-size="11" fill="#6b6080" text-anchor="middle">생일만 넣으면 무료 · korean-saju-six.vercel.app</text></svg>`;
}
async function shareYearCard() {
  const d = S.d, y = d["운세"]["신년운세"], yt = d["나의올해"] || {};
  const text = `나의 ${y["연도"]}년은 ${yt["이모지"] || ""} ${yt["이름"] || y["테마"]} — '${y["테마"]}' 🐾 너의 ${y["연도"]}년도 사주냥이에게 물어봐!`;
  const url = location.origin + "/";
  if (navigator.share) { try { await navigator.share({ title: `사주냥이 ${y["연도"]} 신년운세`, text, url }); return; } catch { /* 취소 */ } }
  try { await navigator.clipboard.writeText(`${text} ${url}`); alert("공유 문구를 복사했다냥!"); } catch { alert(text); }
}
function openYearCard() {
  openSheet(`<h2 style="margin:0 0 10px">🧧 나의 ${S.d["운세"]["신년운세"]["연도"]} 카드</h2>
    <div id="yc-box">${yearCardSvg(S.d)}</div>
    <div class="rd-cta" style="margin-top:12px"><button class="btn primary" type="button" id="yc-save">🖼️ 이미지 저장</button><button class="btn lav" type="button" id="yc-share">📤 친구에게 보내기</button></div>`);
  $("#yc-save").addEventListener("click", () => saveSvgPng($("#yc-box svg"), `사주냥이_${S.d["운세"]["신년운세"]["연도"]}_${S.d["이름"] || "나"}.png`));
  $("#yc-share").addEventListener("click", shareYearCard);
}

function showReveal() {
  const d = S.d, me = d["나의유형"] || {}, yt = d["나의올해"] || {}, y = d["운세"]["신년운세"], yong = d["용신"]["용신"];
  const mt = d["운세"]["맞춤"] || {}, nm = nim();
  const ilgan = (d["해석"]["일간"] || "").split(" — ")[1] || "";
  const cards = [
    { mood: "wow", k: "1 / 3 · 타고난 나", big: `${me["이모지"] || ""} ${me["이름"] || ""}`, sub: `${nm}의 본체는 ${d["원국"]["일주"]["천간"]["글자"]}(${d["원국"]["일주"]["한글"][0]}) 일간이다냥.`, body: ilgan },
    { mood: "cheer", k: "2 / 3 · 나의 보약 기운", big: `${yong}(${{ 목: "木", 화: "火", 토: "土", 금: "金", 수: "水" }[yong] || ""}) 기운`, sub: `너에게 제일 필요한 '용신'이다냥.`,
      body: `행운의 색은 ${(mt["행운의색"] || [""])[0]}, 힘이 나는 방향은 ${mt["행운의방위"] || ""}. ${mt["힐링"] ? `지칠 땐 ${mt["힐링"].split("·")[0]}!` : ""}` },
    { mood: "proud", k: `3 / 3 · 나의 ${y["연도"]}`, big: `${yt["이모지"] || "🧧"} ${yt["이름"] || y["테마"]}`, sub: `'${y["테마"]}'`, body: `${y["총평"]} 힘 실을 달은 ${(y["좋은달표시"] || []).join("·")}.` },
  ];
  let i = 0;
  const box = $("#reveal");
  const draw = () => {
    const c = cards[i], last = i === cards.length - 1;
    box.innerHTML = `<div class="rv-card"><div class="rv-k">${esc(c.k)}</div><span data-nyang="${c.mood}" data-size="120"></span>
      <div class="rv-big">${esc(c.big)}</div><div class="rv-sub">${esc(c.sub)}</div><p class="rv-body">${esc(c.body)}</p>
      <div class="rv-dots">${cards.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div>
      ${last ? `<button class="btn primary wide" type="button" id="rv-card">🧧 내 ${y["연도"]} 카드 만들기</button>
        <button class="ghost wide" type="button" id="rv-done" style="margin-top:8px">냥이 홈으로 가기 🐾</button>`
        : `<button class="btn primary wide" type="button" id="rv-next">다음 →</button><button class="ghost wide" type="button" id="rv-skip" style="margin-top:8px">건너뛰기</button>`}</div>`;
    paintNyang(box);
    $("#rv-next")?.addEventListener("click", () => { i++; draw(); });
    const close = () => { box.hidden = true; document.body.style.overflow = ""; store.set("revealed", 1); };
    $("#rv-skip")?.addEventListener("click", close);
    $("#rv-done")?.addEventListener("click", close);
    $("#rv-card")?.addEventListener("click", () => { close(); openYearCard(); });
  };
  box.hidden = false; document.body.style.overflow = "hidden";
  draw();
}

// ───────────────────────── 홈
function ring(score, label, cls = "", color = "var(--pink)") {
  return `<div class="ring ${cls}" style="--p:${score};--c:${color}"><div><span><b>${score}</b><small>${esc(label)}</small></span></div></div>`;
}
const TODAY_IC = { 일: "💼", 돈: "💰", 연애: "💗", 관계: "🤝", 컨디션: "🌿", 시간: "⏰", 자녀: "👶" };
const domLabel = (k) => (married() && (k === "연애" || k === "연애운") ? (k === "연애" ? "부부" : "애정·부부운") : k);
function todayStory(st, label = "냥이 도사의 오늘 한마디") {
  if (!st) return "";
  const punch = st["핵심"] || st.story?.[0] || "";
  const dom = st["분야"] ? moreSet(Object.entries(st["분야"]).map(([k, v]) => [`${TODAY_IC[k] || "🐾"} ${domLabel(k)}`, `<p>${esc(v)}</p>`]), true) : "";
  return `<div class="card story-card"><div class="story-head"><span class="float" data-nyang="normal" data-size="54"></span>
      <div><small class="sub">${label}</small><h2>${esc(st["제목"])}</h2></div></div>
    <p class="punch-text">${esc(punch)}</p>
    ${dom ? `<p class="sub" style="margin:8px 0 6px">궁금한 분야를 콕 눌러 봐 👇</p>${dom}` : ""}
    ${tipBox(st.tip, "오늘의 한마디")}
    ${moreSet([["📖 자세히 풀이", paras(st["핵심"] ? st.story : st.story?.slice(1))], ["🏮 냥이 설화", taleHtml(st["설화"])]])}</div>`;
}
function renderHome() {
  const d = S.d, f = d["운세"], t = f["오늘운세"], y = f["신년운세"], st = d["옛이야기"];
  markVisit(t); seasonMark();
  const key = "mission:" + t.date;
  const done = store.get(key, 0) === 1;
  const kh = new Date(Date.now() + 9 * 3600e3).getUTCHours();
  const moods = kh >= 23 || kh < 5 ? "sleepy" : t["점수"] >= 80 ? "cheer" : t["점수"] >= 68 ? "happy" : t["점수"] >= 56 ? "wink" : t["점수"] >= 45 ? "normal" : "focus";
  const hello = kh < 5 ? "늦은 밤이다냥" : kh < 11 ? "좋은 아침이다냥" : kh < 17 ? "오후도 힘내라냥" : kh < 23 ? "오늘 하루 수고했다냥" : "이제 잘 시간이다냥";
  const dt = new Date(t.date + "T00:00:00"), s = d["절기"];
  $("#tab-home").innerHTML = `
    <section class="hello">
      <span class="float" data-nyang="${moods}" data-size="76" title="톡 건드려 봐"></span>
      <div class="hello-t"><small>${dt.getMonth() + 1}월 ${dt.getDate()}일 ${"일월화수목금토"[dt.getDay()]}요일${s ? ` · ${esc(s["이모지"])} ${esc(s["이름"])}` : ""}</small>
        <h1>${esc(nim())}, ${hello}</h1>
        <button type="button" class="wardrobe" data-dex>👘 냥이 옷장 ${dexCount().got}/${dexCount().all}</button></div>
    </section>

    <div class="card today-card">
      <div class="today">${ring(t["점수"], t["등급"])}
        <div><div class="tc-k">오늘의 운세 · <b>${esc(t["일진"])}</b>일 · <span data-t="${esc(t["십성"].split("/")[0])}" class="tc-god">${esc(t["십성"].split("/")[0])}의 날</span></div>
        <p class="tc-main">${T(t["한마디"])}</p>
        ${(t["쉬운작용"] || []).length ? `<ul class="tips easy-rel">${t["쉬운작용"].slice(0, 2).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div></div>
      <div class="lucky-line"><span>🎨 ${esc(t["행운"]["색"])}</span><span>🔢 ${esc(t["행운"]["숫자"])}</span><span>🧭 ${esc(t["행운"]["방위"])}</span><span>🍽️ ${esc(t["행운"]["음식"])}</span></div>
      <details class="hours-more"><summary>⏰ 좋은 시간 <b>${f["시간대"]["좋은시간"].join("·")}</b> · 시간대별 기운</summary>
        ${hoursStrip(f["시간대"])}<p class="sub" style="margin:6px 0 0">살살 갈 시간 ${f["시간대"]["조심시간"].join("·")}</p>
        ${t["작용"].length ? `<p class="sub" style="margin:6px 0 0">명리 원문: ${T(t["작용"].join(" · "), true)}</p>` : ""}</details>
      <div class="rd-cta"><button class="btn primary" type="button" data-read="day">오늘 자세히</button>
        <button class="btn soft" type="button" data-read="tomorrow">내일 ${f["내일운세"]["점수"]}점 →</button></div>
    </div>

    <h2 class="sec-t">오늘의 의식 <small>하루 1분, 운을 키우는 시간</small></h2>
    <div class="card ritual">
      <div class="ritual-top">${paeTile()}<div id="garden-slot">${gardenMini()}</div></div>
      <button type="button" class="mission ${done ? "done" : ""}" id="mission" aria-pressed="${done}"><span>${done ? "✅" : "⬜"}</span>
        <span><small>개운 미션 · 하면 보약 화분이 자라요</small>${esc(t["미션"])}</span></button>
      <div id="checkin-slot">${checkinCard()}</div>
    </div>

    ${nowCard()}

    <h2 class="sec-t">바로가기 <button type="button" class="sec-more" data-allmenu>전체 메뉴 ›</button></h2>
    <div class="quick">${[["luck:month", "📅", "월별 운세"], ["luck:read", "🐾", "대풀이"], ["saju:manse", "📜", "만세력"], ["compat", "💞", "궁합·지도"]].map(menuBtn).join("")}</div>
    <div id="install-slot"></div>

    <details class="card home-more"><summary><b>📜 오늘의 읽을거리</b><span class="sub">냥이 도사 한마디 · 고전 한 줄 · 옛이야기</span></summary>
      ${todayStory(d["이야기"]?.["오늘"])}
      ${wisdomCard(d["나의길"]?.["한구절"])}
      <div class="card story">
        <div class="card-head"><h2>냥이의 옛이야기</h2><span class="badge">${esc(st["시대"])}</span></div>
        <h3>『${esc(st["제목"])}』</h3><p style="margin:0">${esc(st["이야기"])}</p>
        <div class="lesson">🐾 ${esc(st["교훈"])} <span class="sub">— ${T(st["개념"], true)}</span></div>
      </div>
      ${pathTeaser()}
    </details>
    <p class="foot">사주는 정답지가 아니라 지도다냥. 건강·법률·투자 판단은 전문가와 상의해 줘!<br>
      <a href="/privacy.html">개인정보 처리방침</a> · <a href="/terms.html">이용약관</a> · 계산 엔진 <a href="https://github.com/kebong-3/korean-saju" target="_blank" rel="noopener">korean-saju</a></p>`;
  $("#mission").addEventListener("click", (e) => {
    const on = store.get(key, 0) !== 1;
    store.set(key, on ? 1 : 0);
    e.currentTarget.classList.toggle("done", on);
    e.currentTarget.setAttribute("aria-pressed", on);
    e.currentTarget.firstElementChild.textContent = on ? "✅" : "⬜";
    const g = gardenState();
    if (on && g.bonus !== t.date) { g.bonus = t.date; store.set("garden", g); gardenAdd(d["용신"]["용신"], 1, "개운 미션 완료"); }
  });
}

function monthCard(m) {
  if (!m) return "";
  return `<div class="card tint-butter month-now"><div class="card-head"><h2>🗓️ 이번 달 냥이 플랜</h2><span class="badge">${esc(m["신호"])}</span></div>
    <p class="sub" style="margin:0 0 8px">${esc(m["절기"])} ${esc(m["시작"])} ~ ${esc(m["끝"] || "")} · ${esc(m["간지"])} · ${T(m["십성"], true)}</p>
    ${verseHtml(m["월령"])}
    <p style="margin:0 0 10px">${esc(m["한마디"])}</p>
    <div class="grid2"><div class="fit"><small>✅ 할 일</small>${m["할일"].map((x) => `<div>· ${esc(x)}</div>`).join("")}</div>
      <div class="fit"><small>🙅 피할 일</small>${m["피할일"].map((x) => `<div>· ${esc(x)}</div>`).join("")}</div></div></div>`;
}

// ───────────────────────── 운세
const DOM_IC = { 재물운: "💰", 직업운: "💼", 연애운: "💗", 건강운: "🌿", 학업운: "📚", 인간관계: "👥" };
function renderLuck() {
  const f = S.d["운세"], y = f["신년운세"], life = f["평생운"], SY = S.d["이야기"]?.["신년"] || {}, SL = S.d["이야기"]?.["평생"] || {};
  const months = y["월별"].map((m) => {
    const cls = y["좋은달"].includes(m["월"]) ? "good" : y["조심할달"].includes(m["월"]) ? "bad" : "";
    return `<div class="mon ${cls}"><div class="m">${m["월"]}월</div><div class="gz">${esc(m["절기"])} ${esc(m["시작"])}~ · ${esc(m["간지"])}</div>
      <span class="s">${m["점수"]}</span><div class="track"><div class="fill" style="width:${m["점수"]}%"></div></div>
      ${verseHtml(m["월령"], true)}
      <p>${esc(SY["월핵심"]?.[m["월"]] || m["한마디"])}</p>${SY["월"]?.[m["월"]] ? moreSet([["더 보기", `<p>${esc(SY["월"][m["월"]])}</p>`]]) : ""}<p class="sub" style="margin-top:2px">${T(m["십성"], true)}</p></div>`;
  }).join("");
  $("#tab-luck").innerHTML = `
    <div class="segtabs" role="tablist"><button data-sub="cal" type="button">달력</button><button data-sub="new" type="button">${y["연도"]} 신년</button><button data-sub="month" type="button">월별</button><button data-sub="life" type="button">인생</button><button data-sub="read" type="button">대풀이</button></div>
    <div data-pane="cal" hidden>${renderCal(f["달력"])}</div>
    <div data-pane="read" hidden>${readMenu()}</div>
    <div data-pane="new">
      <button class="btn primary wide" type="button" data-read="year" style="margin-bottom:14px">🧧 냥이 도사의 ${y["연도"]}년 신년운세 대풀이 듣기</button>
      <div class="card tint-lav">
        <div class="yhead">${ring(y["총운"], y["등급"], "", "var(--lav)")}
          <div><div class="gz">${y["연도"]}년 ${esc(y["간지"])} · ${T(y["십성"], true)}</div><div class="theme">${esc(y["테마"])}</div>
          <div class="sub">${chip("세운")} 12운성 ${chip(y["12운성"])}</div></div></div>
        <div class="say" style="margin-top:14px"><span class="who" data-nyang="wink" data-size="54"></span><div class="bubble">${T(y["총평"])}</div></div>
      </div>
      ${punchCard(`${y["연도"]}년 한 줄 요약`, SY["핵심"], "wink", [["📖 자세히 풀이", paras(SY["서문"])], ["🐾 마무리", paras(SY["맺음"])], ["🏮 냥이 설화", taleHtml(SY["설화"])]])}
      <div class="card"><h2>분야별 운세</h2><div class="dom">
        ${Object.entries(y["분야"]).map(([k, v]) => { const row = `<div class="dom-row"><span class="ic">${DOM_IC[k]}</span><span class="n">${domLabel(k)}</span>
          <div class="track"><div class="fill" style="width:${v}%"></div></div><span class="v">${v}</span></div>`;
          const short = SY["분야핵심"]?.[k];
          return short || SY["분야"]?.[k]?.length ? `<details class="dom-story"><summary>${row}</summary><div class="story-text">${short ? `<p>${esc(short)}</p>${moreSet([["📖 더 자세히", paras(SY["분야"]?.[k])]])}` : paras(SY["분야"][k])}</div></details>` : row; }).join("")}</div>
        ${SY["분야"] ? `<p class="sub" style="margin:10px 0 0">분야를 누르면 냥이 도사가 자세히 이야기해 준다냥 👆</p>` : ""}
        ${SY["자녀"]?.["핵심"] ? `<div class="kid-year"><b>👶 올해의 자녀운</b><p>${esc(SY["자녀"]["핵심"])}</p>${moreSet([["📖 자세히", paras(SY["자녀"].story)]])}</div>` : ""}
        <p class="sub" style="margin:12px 0 0">점수는 올해 기운이 내 ${chip("용신")}과 맞는지, 원국과 ${chip("합")}·${chip("충")}이 생기는지로 계산한 '순풍/역풍' 지표다냥.</p></div>
      <div class="card"><h2>냥이의 ${y["연도"]}년 조언</h2><ul class="tips">${y["조언"].map((x) => `<li>${T(x, true)}</li>`).join("")}</ul>
        ${y["작용"].length ? `<h3 style="margin-top:16px">원국과 만나는 작용</h3><div class="chips">${y["작용"].map((x) => `<span class="chip">${T(x, true)}</span>`).join("")}</div>` : ""}
        <p class="sub" style="margin:14px 0 0">좋은 달 <b>${y["좋은달"].join("·")}월</b> · 살살 갈 달 <b>${y["조심할달"].join("·")}월</b></p></div>
      ${S.ai ? `<button class="btn lav wide" type="button" data-ask="${y["연도"]}년 내 운세를 연애·일·돈으로 나눠서 자세히 풀어줘">💬 냥이에게 ${y["연도"]}년 더 물어보기</button>` : ""}
    </div>
    <div data-pane="month" hidden>
      <div class="say"><span class="who" data-nyang="normal" data-size="54"></span><div class="bubble">사주 달력은 양력 1일이 아니라 ${chip("절입")}일에 달이 바뀐다냥. 초록 카드가 냥이 추천 달!<br>달마다 냥이가 지은 <b>월령 노래</b> 두 줄도 읽어 봐 — 토정비결처럼 읽는 그달의 바람이다냥.</div></div>
      <button class="btn primary wide" type="button" data-read="month" style="margin-bottom:14px">🌙 이번 달 운세 대풀이 듣기</button>
      <div class="months">${months}</div>
    </div>
    <div data-pane="life" hidden>${timelinePane(S.d)}</div>`;
  $$("#tab-luck .segtabs button").forEach((b) => b.addEventListener("click", () => setLuck(b.dataset.sub)));
  $$("#tab-luck [data-cal]").forEach((b) => b.addEventListener("click", () => openDay(b.dataset.cal)));
  setLuck("cal");
}
function setLuck(sub) {
  $$("#tab-luck .segtabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.sub === sub));
  $$("#tab-luck [data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== sub));
}
function lifeChart(pts) {
  const W = 340, H = 170, px = 24, py = 20;
  const x = (i) => px + (i * (W - 2 * px)) / (pts.length - 1);
  const yv = (s) => H - py - ((s - 30) / 70) * (H - 2 * py);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${yv(p["점수"]).toFixed(1)}`).join(" ");
  const area = `${line} L${x(pts.length - 1)},${H - py} L${x(0)},${H - py} Z`;
  return `<svg viewBox="0 0 ${W} ${H + 18}" role="img" aria-label="대운 점수 그래프">
    <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8fa3" stop-opacity=".35"/><stop offset="1" stop-color="#ff8fa3" stop-opacity="0"/></linearGradient></defs>
    <line x1="${px}" x2="${W - px}" y1="${yv(60)}" y2="${yv(60)}" stroke="#eadff0" stroke-dasharray="4 4"/>
    <path d="${area}" fill="url(#lg)"/><path d="${line}" fill="none" stroke="#ff8fa3" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.map((p, i) => `<circle cx="${x(i)}" cy="${yv(p["점수"])}" r="${p["현재"] ? 7 : 4}" fill="${p["현재"] ? "#f0607d" : "#fff"}" stroke="#f0607d" stroke-width="2"/>
      <text x="${x(i)}" y="${H + 12}" font-size="11" text-anchor="middle" fill="#8a7f99">${p["나이"]}</text>`).join("")}
    ${pts.filter((p) => p["현재"]).map((p) => `<text x="${x(pts.indexOf(p))}" y="${yv(p["점수"]) - 12}" font-size="12" text-anchor="middle" fill="#f0607d" font-family="Jua">지금!</text>`).join("")}
  </svg>`;
}

// ───────────────────────── 내 사주
const STRENGTH_TERM = (s) => (s.includes("강") ? "신강" : s.includes("약") ? "신약" : "중화");
function renderSaju() {
  const d = S.d, a = d["해석"], y = d["용신"], mt = d["운세"]["맞춤"], gw = d["운세"]["개운법"], SM = d["이야기"]?.["사주"] || {};
  const order = ["시주", "일주", "월주", "연주"];
  const pillars = order.map((k) => {
    const p = d["원국"][k], lbl = k[0];
    if (!p) return `<div class="pillar"><div class="lbl">${lbl}주</div><div class="god">&nbsp;</div><div class="tile empty">시간<br>몰라요</div><div class="tile empty">?</div></div>`;
    const se = p["천간"]["오행"], be = d["지지오행"][k], me = k === "일주";
    const god = (g) => (g.startsWith("일간") ? chip("일간", "나") : chip(g));
    return `<div class="pillar ${me ? "me" : ""}"><div class="lbl">${me ? "일주 · 나" : chip(k, lbl + "주")}</div>
      <div class="god">${god(p["천간"]["십성"])}</div>
      <div class="tile e-${se}">${p["천간"]["글자"]}<small>${p["한글"][0]} · ${se}</small></div>
      <div class="tile e-${be}">${p["지지"]["글자"]}<small>${p["한글"][1]} · ${be}</small></div>
      <div class="god">${chip(p["지지"]["십성"])}</div><div class="meta">${chip(p["지지"]["12운성"])}<br>${p["지지"]["지장간"].map((x) => esc(x.split("(")[0])).join(" ")}</div></div>`;
  }).join("");
  const w = d["오행"]["비중(%)"], cnt = d["오행"]["개수"];
  const bars = ELEM.map((e) => `<div class="bar"><span class="n">${chip(e, HANJA[e] + " " + e)}${e === y["용신"] ? '<span class="yong">용신</span>' : ""}</span>
    <div class="track"><div class="fill f-${e}" style="width:${Math.min(100, w[e] * 2)}%"></div></div><span class="v">${w[e]}% · ${cnt[e]}개</span></div>`).join("");
  const top = Object.entries(d["십성 비중(%)"]).sort((p, q) => q[1] - p[1])[0][0];
  const st = STRENGTH_TERM(d["강약"]["판정"]);
  const G = (t) => esc(S.gloss[t]?.["냥이"] || "");
  const easy = [
    ["일간", "나는 어떤 사람?", a["일간"], `너의 본체는 ${d["원국"]["일주"]["천간"]["글자"]}(${d["원국"]["일주"]["한글"][0]})다냥. ${G("일간")}`],
    [st, "에너지는 센 편? 약한 편?", a["강약"], G(st)],
    ["격국", "사회에서 어떻게 쓰일까?", a["격국"], G("격국")],
    ["용신", "나에게 제일 필요한 기운", a["용신"], `너의 보약은 <b>${esc(y["용신"])}</b>이다냥! ${G("용신")}`],
    [top, "가장 강한 십성", a["가장 강한 십성"], G(top)],
    ["대운", "지금 나의 10년", a["현재 대운"] || "", G("대운")],
  ].filter((x) => x[2]).map(([t, q, raw, ny]) => `<div class="easy-item"><h3>${chip(t)} <span class="sub">${q}</span></h3>
      <div class="raw">${T(raw, true)}</div><div class="ny">${ny}</div></div>`).join("");
  const sinsal = Object.keys(d["신살"]);
  $("#tab-saju").innerHTML = `
    <div class="segtabs" role="tablist"><button data-pane="glance" type="button">한눈에</button><button data-pane="story" type="button">풀이</button><button data-pane="manse" type="button">만세력</button><button data-pane="ogo" type="button">오고</button></div>
    <div data-spane="glance">${glancePane(d)}</div>
    <div data-spane="story" hidden>
    <div class="card"><h2>${chip("오행")} 밸런스</h2><div class="bars">${bars}</div>
      <p class="sub" style="margin:12px 0 0">십성 비중 · ${Object.entries(d["십성 비중(%)"]).map(([k, v]) => `${chip(k)} ${v}%`).join(" · ")}</p></div>
    ${SM["장"]?.length ? `${SM["핵심"] ? punchCard("냥이 도사의 첫인상", SM["핵심"], "think", [["📖 자세히 풀이", paras(SM["서문"])], ["🐾 마무리 인사", paras(SM["맺음"])]]) : storyCard("냥이 도사가 펼친 너의 두루마리", SM["서문"], "think")}
      ${oneLiners(SM["한줄"], { 성격: "😺", 강점: "💪", 조심: "⚠️", 보약: "🍀" })}
      <div class="card tint-lav"><div class="card-head"><h2>📜 사주 이야기 ${SM["장"].length}장</h2><span class="badge">궁금한 장을 콕</span></div>
        <div class="chaps">${SM["장"].map((c) => chapter(c)).join("")}</div></div>`
    : `<div class="card tint-lav"><div class="card-head"><h2>냥이의 쉬운 해석</h2><span class="float" data-nyang="normal" data-size="50"></span></div><div class="easy">${easy}</div></div>`}
    <div class="card tint-mint" id="fit"><h2>🎯 나에게 맞는</h2><div class="grid2">
      <div class="fit full"><small>맞는 일</small><b>${esc(mt["직업"]["유형"])}</b><br>${esc(mt["직업"]["추천"])}<div class="sub">용신 분야: ${esc(mt["직업"]["용신분야"])}</div></div>
      <div class="fit full"><small>공부·일하는 법</small>${T(mt["공부일하는법"])}</div>
      <div class="fit full"><small>연애 스타일 (${chip("일지")} 기준)</small>${T(mt["연애스타일"])}</div>
      <div class="fit"><small>잘 맞는 띠</small><div class="zod">${mt["잘맞는띠"].map((z) => `<span>${esc(z)}</span>`).join("")}</div></div>
      <div class="fit"><small>맞춰 갈 띠</small><div class="zod">${mt["조심할띠"].map((z) => `<span>${esc(z)}</span>`).join("")}</div></div>
      <div class="fit"><small>행운의 색</small>${esc(mt["행운의색"].join(", "))}</div>
      <div class="fit"><small>숫자 · 방위</small>${esc(mt["행운의숫자"])} · ${esc(mt["행운의방위"])}</div>
      <div class="fit full"><small>힐링 방법</small>${esc(mt["힐링"])}</div>
      <div class="fit full"><small>보완할 점</small>${T(mt["보완할점"], true)}</div></div></div>
    <div class="card tint-butter" id="rx"><h2>🍀 냥이의 개운 처방전</h2>
      <div class="say"><span class="who" data-nyang="wink" data-size="50"></span><div class="bubble">${T(gw["올해"])}</div></div>
      <div class="rx">${gw["처방"].map((x, i) => `<div><i>${["🎨", "🧭", "🍠", "🪴", "🚶", "✨"][i] || "🍀"}</i><span><b>${esc(x["제목"])}</b><br>${esc(x["내용"])}<small>${T(x["이유"], true)}</small></span></div>`).join("")}</div>
      <ul class="tips" style="margin-top:12px"><li>${T(gw["피할것"], true)}</li>${gw["조후"] ? `<li>${T(gw["조후"], true)}</li>` : ""}</ul></div>
    <div class="card"><div class="card-head"><h2>${chip("신살")} · ${chip("합")}${chip("충")}</h2>${d["신살표"] ? `<button class="ghost" type="button" data-go="saju:sinsal">🔮 자세히</button>` : ""}</div>
      <div class="chips">${d["신살표"] ? (d["신살표"]["목록"].map((x) => ssChip(x["이름"], x["자리"].join(","))).join("") || '<span class="sub">특별한 신살이 없다냥</span>') : sinsal.length ? sinsal.map((s) => `<span class="chip">${S.gloss[s] ? chip(s) : esc(s)} (${esc(d["신살"][s].join("·"))})</span>`).join("") : '<span class="sub">특별한 신살이 없다냥</span>'}</div>
      <p style="margin:12px 0 0">${d["합충형파해"].length ? d["합충형파해"].map((x) => T(x, true)).join("<br>") : "원국 안에 큰 합충이 없는 차분한 사주다냥."}</p>
      <p class="sub" style="margin:8px 0 0">${chip("공망")}: ${esc(d["공망"].join(""))}</p></div>
    <details class="card"><summary><b>만세력 상세 (전문가용)</b></summary>
      <p class="sub">양력 ${esc(d["입력"]["양력"])} ${esc(d["입력"]["시각"] || "시간 모름")} · ${esc(d["입력"]["음력"])}<br>${(d["입력"]["보정"] || []).map(esc).join("<br>")}<br>
      ${chip("절입")}: ${esc(d["절입"]["직전"])} → ${esc(d["절입"]["직후"])}<br>${chip("대운수")} ${d["대운"].daewoonsu} (${esc(d["대운"].direction)}) · ${esc(d["대운"].basis)}<br>
      ${T(d["용신"]["근거"], true)}</p>${(d["주의"] || []).map((x) => `<p class="error">⚠ ${esc(x)}</p>`).join("")}</details>
    </div>
    <div data-spane="ogo" hidden>${renderOgo(d)}</div>
    <div data-spane="manse" hidden>${renderManse(d)}</div>`;
  $$("#tab-saju .segtabs button").forEach((b) => b.addEventListener("click", () => setSajuPane(b.dataset.pane)));
  $$("#tab-saju [data-lens-go]").forEach((b) => b.addEventListener("click", () => $(`#lens-${b.dataset.lensGo}`)?.scrollIntoView({ behavior: "smooth", block: "start" })));
  $("#btn-manse-png")?.addEventListener("click", saveMansePng);
  setSajuPane("glance");
}
function setSajuPane(p) {
  $$("#tab-saju .segtabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.pane === p));
  $$("#tab-saju [data-spane]").forEach((x) => (x.hidden = x.dataset.spane !== p));
  if (p === "manse") requestAnimationFrame(mxScrollNow);
}

// ───────────────────────── 오고(五古) 정밀 감명
function renderOgo(d) {
  const o = d["오고"], sy = o.synth;
  const list = (arr, seen) => arr.map((x) => md(x, seen)).join("");
  const lensCard = (L, i, _a, seen = new Set()) => `
    <div class="card lens" id="lens-${L.id}">
      <div class="lens-head"><span class="lens-ic">${L.icon}</span><div><div class="lens-no">제${i + 1}렌즈 · ${esc(L.lens)}</div>
        <h2>${esc(L.book)}</h2><div class="sub">${esc(L.era)}</div></div></div>
      <p class="lens-q">“${esc(L.q)}”</p>
      <div class="say"><span class="who" data-nyang="normal" data-size="44"></span><div class="bubble lav">${md(L.easy, seen)}</div></div>
      <div class="chips" style="margin-bottom:12px">${L.basis.map((b) => `<span class="chip">${T(b)}</span>`).join("")}</div>
      <div class="classic"><h3>📜 고전의 해석 <span class="sub">原典</span></h3>${list(L.classic, seen)}</div>
      <div class="modern"><h3>✨ 현대적 풀이 <span class="sub">現代</span></h3>${list(L.modern, seen)}</div>
    </div>`;
  const ax = sy["세축"].map((x) => `<div class="ax"><b>${esc(x["축"])}</b><span class="stars">${esc(x["평가"])}</span><small>${esc(x["책"])}</small><p>${T(x["요지"], true)}</p></div>`).join("");
  const yt = sy["용신비교"].map((x) => `<tr><td>${esc(x["관점"])}</td><td><b>${esc(x["오행"])}</b></td><td>${esc(x["뜻"])}</td></tr>`).join("");
  const dw = sy["대운"].map((x) => `<div class="dw3 ${x["현재"] ? "now" : ""}"><div class="age">${x["나이"]}세 <span class="sub">${x["시작"]}~</span></div>
      <div class="gz">${esc(x["간지"])}</div><div class="sub">${T(x["십신"], true)}</div>
      <dl><dt>그릇</dt><dd>${esc(x["그릇"])}</dd><dt>온도</dt><dd>${esc(x["온도"])}</dd><dt>균형</dt><dd>${esc(x["균형"])}</dd></dl></div>`).join("");
  const y = sy["세운"];
  return `
    <div class="card tint-lav"><div class="say" style="margin:0"><span class="who" data-nyang="happy" data-size="64"></span>
      <div class="bubble">${o.intro.map((x) => md(x, true)).join("")}</div></div>
      <div class="books">${o.lenses.map((L) => `<button type="button" data-lens-go="${L.id}"><i>${L.icon}</i>${esc(L.book.split("(")[0])}<small>${esc(L.lens)}</small></button>`).join("")}</div></div>
    ${o.lenses.map(lensCard).join("")}
    <div class="card tint-pink" id="lens-synth"><div class="lens-head"><span class="lens-ic">🔺</span><div><div class="lens-no">입체 종합 · 三位一體</div><h2>그릇 · 온도 · 균형</h2>
      <div class="sub">《자평진전》 그릇 + 《궁통보감》 온도 + 《적천수》 균형</div></div></div>
      <div class="axes">${ax}</div>
      <h3 style="margin-top:16px">세 관점의 용신 비교</h3>
      <table class="vtable"><thead><tr><th>관점</th><th>오행</th><th>의미</th></tr></thead><tbody>${yt}</tbody></table>
      <div class="final"><small>다섯 고전을 겹쳐 본 처방 · 기본 보약${sy["계절처방"] && sy["계절처방"] !== sy["최종용신"] ? " + 계절 처방" : ""}</small>
        <b>${esc(sy["최종용신"])}${sy["계절처방"] && sy["계절처방"] !== sy["최종용신"] ? ` <span class="sub" style="font-size:22px">+ ${esc(sy["계절처방"])}</span>` : ""}</b>
        <p>${md(sy["최종근거"], true)}</p></div>
      ${list(sy["입체해석"], new Set())}
    </div>
    <div class="card"><h2>대운 · 세운을 세 렌즈로</h2>
      <div class="say"><span class="who" data-nyang="think" data-size="44"></span><div class="bubble">${sy["운해석"].map((x) => md(x, true)).join("")}</div></div>
      <button class="ghost wide" type="button" data-go="luck:life">📈 대운마다 세 렌즈 풀이는 '인생 흐름'에서 ›</button>
      <div class="year3"><b>${y["연도"]}년 세운 ${esc(y["간지"])}</b> <span class="sub">${T(y["십신"], true)}</span>
        <dl><dt>그릇</dt><dd>${esc(y["그릇"])}</dd><dt>온도</dt><dd>${esc(y["온도"])}</dd><dt>균형</dt><dd>${esc(y["균형"])}</dd></dl>
        ${y["작용"].length ? `<p class="sub">${T(y["작용"].join(" / "), true)}</p>` : ""}</div>
    </div>
    <p class="fine">${esc(o.note)}</p>`;
}

// ───────────────────────── 만세력 (SVG + PNG 저장)
const EL_COLOR = { 목: ["#e1f6ea", "#2f8f5b"], 화: ["#ffe3e3", "#d94848"], 토: ["#fff0d6", "#c47d10"], 금: ["#eef0f5", "#5f6880"], 수: ["#e4ebff", "#3d5fc4"] };
const STEM_EL = { 甲: "목", 乙: "목", 丙: "화", 丁: "화", 戊: "토", 己: "토", 庚: "금", 辛: "금", 壬: "수", 癸: "수" };
function manseSvg(d) {
  const order = ["시주", "일주", "월주", "연주"], W = 680, cw = 140, x0 = 120;
  const i = d["입력"];
  const rows = [["stemGod", "십성", 34], ["stem", "천간", 92], ["branch", "지지", 92], ["branchGod", "십성", 34],
    ["hidden", "지장간", 34], ["stage", "12운성", 34], ["s12", "12신살", 34], ["naeum", "납음", 34]];
  const cell = (key, p, lbl) => ({
    stemGod: p["천간"]["십성"].replace("일간(나)", "일간"), branchGod: p["지지"]["십성"],
    hidden: p["지지"]["지장간"].map((x) => x.split("(")[0]).join(" "), stage: p["지지"]["12운성"],
    s12: (d["12신살"]?.["연지기준"]?.[lbl[0]] || ""), naeum: (d["납음"]?.[lbl] || "").split("(")[0],
  }[key]);
  let y = 96, body = "";
  rows.forEach(([key, name, h]) => {
    body += `<text x="${x0 / 2}" y="${y + h / 2 + 5}" text-anchor="middle" font-size="15" fill="#8a7f99">${name}</text>`;
    order.forEach((lbl, k) => {
      const p = d["원국"][lbl], cx = x0 + k * cw + cw / 2;
      if (key === "stem" || key === "branch") {
        if (!p) {
          body += `<rect x="${x0 + k * cw + 8}" y="${y + 4}" width="${cw - 16}" height="${h - 8}" rx="16" fill="#fbf8fd" stroke="#f0e6ef" stroke-dasharray="5 4"/>
            <text x="${cx}" y="${y + h / 2 + 6}" text-anchor="middle" font-size="15" fill="#8a7f99">${key === "stem" ? "시간" : "미상"}</text>`;
          return;
        }
        const ch = key === "stem" ? p["천간"]["글자"] : p["지지"]["글자"];
        const el = key === "stem" ? p["천간"]["오행"] : d["지지오행"][lbl];
        const [fill, color] = EL_COLOR[el];
        body += `<rect x="${x0 + k * cw + 8}" y="${y + 4}" width="${cw - 16}" height="${h - 8}" rx="16" fill="${fill}" ${lbl === "일주" ? 'stroke="#ff8fa3" stroke-width="3"' : ""}/>
          <text x="${cx}" y="${y + h / 2 + 12}" text-anchor="middle" font-size="44" font-weight="700" fill="${color}">${ch}</text>
          <text x="${cx}" y="${y + h - 10}" text-anchor="middle" font-size="12" fill="${color}">${esc((key === "stem" ? p["한글"][0] : p["한글"][1]) + " · " + el)}</text>`;
        return;
      }
      body += `<text x="${cx}" y="${y + h / 2 + 5}" text-anchor="middle" font-size="15" fill="#3b2f4a">${esc(p ? cell(key, p, lbl) : "—")}</text>`;
    });
    y += h + 6;
    body += `<line x1="16" x2="${W - 16}" y1="${y - 3}" y2="${y - 3}" stroke="#f0e6ef"/>`;
  });
  const dw = (d["운세"]?.["평생운"]?.["대운"] || []).slice(0, 8);
  let dws = `<text x="24" y="${y + 30}" font-size="16" fill="#7c5cf0" font-weight="700">대운 (${esc(d["대운"].direction)} · 대운수 ${d["대운"].daewoonsu})</text>`;
  const dwW = (W - 32) / Math.max(dw.length, 1);
  dw.forEach((p, k) => {
    const x = 16 + k * dwW, el = STEM_EL[p["간지"][0]];
    dws += `<rect x="${x + 3}" y="${y + 44}" width="${dwW - 6}" height="86" rx="12" fill="${p["현재"] ? "#ffe4ea" : "#fbf8fd"}" ${p["현재"] ? 'stroke="#ff8fa3" stroke-width="2"' : ""}/>
      <text x="${x + dwW / 2}" y="${y + 64}" text-anchor="middle" font-size="12" fill="#8a7f99">${p["나이"]}세</text>
      <text x="${x + dwW / 2}" y="${y + 98}" text-anchor="middle" font-size="26" font-weight="700" fill="${EL_COLOR[el][1]}">${esc(p["간지"])}</text>
      <text x="${x + dwW / 2}" y="${y + 120}" text-anchor="middle" font-size="11" fill="#8a7f99">${esc(p["십성"])}</text>`;
  });
  const H = y + 150;
  const title = `${d["이름"] ? esc(d["이름"]) + "님의 " : ""}만세력`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" font-family="Gowun Dodum, Apple SD Gothic Neo, Malgun Gothic, sans-serif" role="img" aria-label="만세력">
    <rect width="${W}" height="${H}" rx="24" fill="#fff"/>
    <text x="24" y="40" font-size="24" font-weight="700" fill="#3b2f4a">${title}</text>
    <text x="24" y="66" font-size="13" fill="#8a7f99">양력 ${esc(i["양력"])} ${esc(i["시각"] || "시간 미상")} · ${esc(i["음력"])} · ${esc(i["성별"])} · ${esc(i["띠"])}띠</text>
    <text x="${W - 24}" y="40" font-size="14" text-anchor="end" fill="#f0607d">사주냥이</text>
    ${order.map((lbl, k) => `<text x="${x0 + k * cw + cw / 2}" y="88" text-anchor="middle" font-size="14" fill="${lbl === "일주" ? "#f0607d" : "#8a7f99"}">${lbl}${lbl === "일주" ? " (나)" : ""}</text>`).join("")}
    ${body}${dws}</svg>`;
}
// ───────────────────────── 만세력 (표 · 관계 · 운 · 신살과 길성) — 모든 칸을 누르면 냥이가 설명
const MX_COLS = [["시주", "시", "생시"], ["일주", "일", "생일"], ["월주", "월", "생월"], ["연주", "연", "생년"]];
const STEM_KO = { 甲: "갑", 乙: "을", 丙: "병", 丁: "정", 戊: "무", 己: "기", 庚: "경", 辛: "신", 壬: "임", 癸: "계" };
const BR_KO = { 子: "자", 丑: "축", 寅: "인", 卯: "묘", 辰: "진", 巳: "사", 午: "오", 未: "미", 申: "신", 酉: "유", 戌: "술", 亥: "해" };
const BR_EL = { 子: "수", 丑: "토", 寅: "목", 卯: "목", 辰: "토", 巳: "화", 午: "화", 未: "토", 申: "금", 酉: "금", 戌: "토", 亥: "수" };
const YANG = (ch) => "甲丙戊庚壬寅辰巳申戌亥".includes(ch); // 지지는 쓰임(정기) 기준: 子午는 음, 巳亥는 양
const STEM_INFO = {
  甲: ["큰 나무", "곧게 뻗어 앞장서는 힘"], 乙: ["들꽃·덩굴", "유연하게 휘어도 꺾이지 않는 생활력"], 丙: ["태양", "숨김없이 환하게 비추는 열정"],
  丁: ["촛불·별빛", "한곳을 깊이 비추는 집중력"], 戊: ["큰 산", "흔들리지 않는 믿음직함"], 己: ["논밭", "사람과 일을 길러 내는 살림 솜씨"],
  庚: ["바위·원석", "옳고 그름이 분명한 결단력"], 辛: ["보석", "섬세하고 반짝이는 완벽주의"], 壬: ["큰 바다", "크게 품고 흐름을 읽는 지혜"],
  癸: ["이슬비", "조용히 스며드는 직관과 감수성"],
};
const BR_INFO = {
  子: ["쥐", "한겨울 밤(23~01시)", "아이디어와 비밀스러운 지혜"], 丑: ["소", "늦겨울 새벽(01~03시)", "묵묵한 끈기와 저장"],
  寅: ["호랑이", "초봄 새벽(03~05시)", "새 길을 여는 용기"], 卯: ["토끼", "한봄 아침(05~07시)", "부드러운 성장과 감각"],
  辰: ["용", "늦봄(07~09시)", "변화와 큰 꿈을 품은 창고"], 巳: ["뱀", "초여름(09~11시)", "빠른 판단과 열정의 시작"],
  午: ["말", "한여름 낮(11~13시)", "드러나는 열정과 인기"], 未: ["양", "늦여름(13~15시)", "따뜻한 돌봄과 인내"],
  申: ["원숭이", "초가을(15~17시)", "재주와 실행력"], 酉: ["닭", "한가을 저녁(17~19시)", "정리·완성·날카로운 감각"],
  戌: ["개", "늦가을(19~21시)", "의리와 지키는 힘"], 亥: ["돼지", "초겨울 밤(21~23시)", "넉넉한 포용과 휴식"],
};
const COLOR_KO = { 목: "푸른", 화: "붉은", 토: "노란", 금: "흰", 수: "검은" };
const S12_INFO = {
  겁살: "외부에서 밀려오는 압박 — 대신 승부 근성과 위기 대처력이 자란다냥.", 재살: "갇힌 듯 답답한 기운 — 전략을 짜고 집중하는 힘으로 쓰라냥.",
  천살: "하늘의 시험 — 예상 못 한 일이 오지만 기도·명상 같은 마음 수양에 강하다냥.", 지살: "땅을 딛고 출발 — 이동·새 출발·독립의 기운이다냥.",
  연살: "도화(년살) — 사람을 끄는 매력과 인기다냥.", 월살: "메마른 달 — 일이 더딜 땐 기다림의 지혜가 필요하다냥.",
  망신살: "드러나는 기운 — 주목받는 무대 체질, 다만 말조심!", 장성살: "장군의 별 — 리더십과 책임, 앞에 서는 힘이다냥.",
  반안살: "말안장에 오르는 기운 — 실력으로 자리 잡는 출세 운이다냥.", 역마살: "달리는 말 — 이동과 변화 속에서 기회가 온다냥.",
  육해살: "여섯 가지 해 — 잔병·소모 주의, 쉬어 가며 가라는 신호다냥.", 화개살: "빛나는 덮개 — 예술·학문·영성, 혼자 깊이 파고드는 힘이다냥.",
};
const GUNG = { 시: ["말년운", "자녀·결실", "60세~", "아들", "딸"], 일: ["중년운", "나 자신·배우자", "40~59세", "자신", "배우자"],
  월: ["청년운", "부모·사회", "20~39세", "부친", "모친"], 연: ["초년운", "조상·뿌리", "~19세", "조부", "조모"] };
const REL_TABS = [["궁성", []], ["천간합", ["천간합"]], ["지지육합", ["육합"]], ["지지삼합", ["삼합", "반합"]], ["지지방합", ["방합"]],
  ["천간충", ["천간충"]], ["지지충", ["충"]], ["공망", []], ["형", ["형"]], ["파", ["파"]], ["해", ["해"]], ["원진", ["원진"]], ["귀문", ["귀문"]]];
const KIND_CLS = { 귀인: "ss-gwi", 길성: "ss-gil", 살: "ss-sal", 특수: "ss-tk" };
const ssChip = (n, where = "") => `<button type="button" class="ss-chip ${KIND_CLS[S.sinsal?.["설명"]?.[n]?.["종류"]] || ""}" data-ss="${esc(n)}" data-where="${esc(where)}">${esc(n)}</button>`;
const signEl = (ch, el) => `${YANG(ch) ? "+" : "−"}${el}`;

function mxTile(ch, el, kind, pos, me = false) {
  const ko = kind === "s" ? STEM_KO[ch] : BR_KO[ch];
  return `<button type="button" class="mx-tile e-${el} ${me ? "me" : ""}" data-mx="${kind}:${pos}"><b>${ko}<span>${ch}</span></b><small>${signEl(ch, el)}</small></button>`;
}
function renderManse(d) {
  const ss = d["신살표"], lr = d["운줄"];
  if (!ss || !lr) return legacyManse(d);
  const i = d["입력"], day = d["원국"]["일주"], ds = day["천간"]["글자"], db = day["지지"]["글자"];
  const nm = d["이름"] ? esc(nim(d["이름"])) : "나";
  const cols = MX_COLS.map(([k, pos, lbl]) => ({ k, pos, lbl, p: d["원국"][k] }));
  const cell = (c, f) => (c.p ? f(c) : `<div class="mx-c mx-none">—</div>`);
  const row = (name, term, f) => `<div class="mx-l">${term ? chip(term, name) : esc(name)}</div>${cols.map((c) => cell(c, f)).join("")}`;
  const grid = chartGrid(d, true);
  const y = d["용신"];
  const luckCell = (x, kind, idx, top) => `<button type="button" class="lk ${x["현재"] ? "now" : ""}" data-luck="${kind}:${idx}">
      <span class="lk-t">${top}</span><span class="lk-g">${esc(x["천간십성"])}</span>
      <span class="lk-tile e-${STEM_EL[x["간지"][0]]}">${STEM_KO[x["간지"][0]]}<i>${x["간지"][0]}</i></span>
      <span class="lk-tile e-${BR_EL[x["간지"][1]]}">${BR_KO[x["간지"][1]]}<i>${x["간지"][1]}</i></span>
      <span class="lk-g">${esc(x["지지십성"])}</span><span class="lk-s">${esc(x["운성"])}</span>${x["신살"].length ? `<span class="lk-dot">${x["신살"].length}</span>` : ""}</button>`;
  const scroller = (rows, kind, top) => `<div class="lk-row" dir="rtl">${rows.map((x, k) => luckCell(x, kind, k, top(x))).join("")}</div>`;
  const listHtml = (ss["목록"] || []).map((x) => ssChip(x["이름"], x["자리"].join(","))).join("");
  const ssRow = (key) => cols.map((c) => `<div class="ss-cell">${c.p ? (ss[key][c.pos].length ? ss[key][c.pos].map((n) => ssChip(n, c.pos + (key === "천간" ? "간" : "지"))).join("") : '<span class="ss-x">×</span>') : "—"}</div>`).join("");
  const st = d["신살이야기"];
  return `
  <div class="card mx-top">
    <div class="mx-who"><span data-nyang="think" data-size="64"></span><div>
      <h2>${nm}</h2><div class="mx-ilju">${esc(day["한글"])}(${COLOR_KO[day["천간"]["오행"]]} ${BR_INFO[db][0]}) ${chip("일주", "일주")}</div>
      <p class="mx-dates"><span class="sol">양</span> ${esc(i["양력"].replaceAll("-", "/"))} ${esc(i["시각"] || "시간 모름")} ${esc(i["성별"])}<br>
      <span class="lun">음</span> ${esc(i["음력"])}${(i["보정"] || []).length ? `<br><span class="cor">보정</span> ${(i["보정"] || []).map(esc).join(" · ")}` : ""}</p></div></div>
    <details class="mx-guide" ${localStorage.getItem("nyang:mxguide") ? "" : "open"}><summary>🐾 냥이의 만세력 읽는 법 (5단계)</summary><ol>
      <li><b>네 기둥</b> — 오른쪽부터 태어난 해·달·날·시다냥. 가운데 <b>생일 윗글자(${STEM_KO[ds]}${ds})</b>가 바로 ${nm}의 본체, '일간'이다냥.</li>
      <li><b>위 줄 천간</b>은 겉으로 드러나는 모습, <b>아래 줄 지지</b>는 속마음과 생활 무대다냥.</li>
      <li><b>색깔</b>은 오행이다냥 — 초록 목, 빨강 화, 노랑 토, 회색 금, 파랑 수. 많은 색과 없는 색을 찾아보라냥.</li>
      <li><b>십성</b>은 나(일간)와 그 글자의 관계 — 돈·일·사람·공부 중 무엇인지 알려 준다냥.</li>
      <li><b>12운성</b>은 그 자리에서 내 기운의 세기, <b>12신살</b>은 그 자리의 분위기다냥. 아무 칸이나 눌러 보라냥!</li></ol></details>
  </div>
  <div class="card mx-card">${grid}
    <p class="sub mx-foot">절입 ${esc(d["절입"]["직전"])} → ${esc(d["절입"]["직후"])}</p>
    ${(d["주의"] || []).map((x) => `<p class="error">⚠ ${esc(x)}</p>`).join("")}</div>
  <div class="card mx-rel"><h2>사주 풀이 자세히 보기</h2>
    <div class="mx-tabs">${REL_TABS.map(([t, ks], k) => {
      const n = t === "궁성" ? 0 : t === "공망" ? ((ss["목록"].find((x) => x["이름"] === "공망") || {})["자리"] || []).length : (d["관계"] || []).filter((r) => ks.includes(r["종류"])).length;
      return `<button type="button" data-mxtab="${k}" class="${k === 0 ? "on" : ""} ${n ? "has" : ""}">${t}${n ? `<i>${n}</i>` : ""}</button>`;
    }).join("")}</div>
    <div id="mx-relpane">${relPane(d, 0)}</div></div>
  <div class="card"><div class="card-head"><h2>${chip("용신")}</h2><span class="badge">${chip("희신")} ${esc(y["희신"])}</span></div>
    <button type="button" class="mx-yong" data-t="용신"><b class="e-txt-${y["용신"]}">${esc(y["용신"])}</b>(${y["조후"] && y["조후"] !== y["용신"] ? "억부용신 · 조후 " + esc(y["조후"]) : "억부용신"})</button>
    <p class="sub" style="margin:8px 0 0">${T(y["근거"], true)}</p></div>
  <div class="card"><div class="card-head"><h2>${chip("대운수", `대운수 ${d["대운"].daewoonsu}`)}</h2><span class="badge">${esc(d["대운"].direction)}</span></div>
    <p class="sub" style="margin:0 0 6px">오른쪽이 어린 시절, 왼쪽으로 갈수록 미래다냥(원국과 같은 방향). 칸을 누르면 그 10년을 풀어 준다냥.</p>
    <h3 class="lk-h">${chip("대운")}</h3>${scroller(lr["대운"], "대운", (x) => `${x["나이"]}세`)}
    <h3 class="lk-h">${chip("세운", "연운")}</h3>${scroller(lr["세운"], "세운", (x) => x["연도"])}
    <h3 class="lk-h">${chip("월운")} <span class="sub">${new Date().getFullYear()}년</span></h3>${scroller(lr["월운"], "월운", (x) => x["절기"])}</div>
  <div class="card" id="mx-ss"><div class="card-head"><h2>${chip("신살", "신살과 길성")}</h2><span class="badge">${(ss["목록"] || []).length}개</span></div>
    <div class="ss-legend"><span class="ss-gwi">귀인</span><span class="ss-gil">길성</span><span class="ss-sal">양날의 칼</span><span class="ss-tk">성향</span></div>
    <div class="ss-list">${listHtml || '<span class="sub">특별한 신살이 없는 담백한 사주다냥</span>'}</div>
    <div class="ss-grid"><div></div>${cols.map((c) => `<div class="mx-h">${c.lbl}</div>`).join("")}
      <div class="mx-l">천간</div>${cols.map((c) => `<div class="ss-g">${c.p ? STEM_KO[c.p["천간"]["글자"]] + c.p["천간"]["글자"] : ""}</div>`).join("")}
      <div class="mx-l">길성</div>${ssRow("천간")}
      <div class="mx-l">지지</div>${cols.map((c) => `<div class="ss-g">${c.p ? BR_KO[c.p["지지"]["글자"]] + c.p["지지"]["글자"] : ""}</div>`).join("")}
      <div class="mx-l">길성</div>${ssRow("지지")}</div>
    ${ss["현침개수"] ? `<p class="sub" style="margin:10px 0 0">현침 글자 ${ss["현침개수"]}개 ${ss["현침개수"] >= 3 ? "— 3개 이상이라 예리한 감각이 뚜렷하다냥" : "— 3개 미만이라 가볍게 참고하라냥"}</p>` : ""}</div>
  ${st ? sinsalStory(st) : ""}
  <div class="card"><div class="card-head"><h2>만세력 이미지</h2><button class="ghost" id="btn-manse-png" type="button">🖼️ 이미지로 저장</button></div>
    <p class="sub" style="margin:0">친구에게 보내거나 다른 만세력과 비교할 때 쓰라냥.</p><div id="manse-svg" hidden>${manseSvg(d)}</div></div>`;
}
function legacyManse(d) {
  return `<div class="card"><div class="card-head"><h2>만세력</h2><button class="ghost" id="btn-manse-png" type="button">🖼️ 이미지로 저장</button></div>
    <div id="manse-svg">${manseSvg(d)}</div></div>`;
}
function relPane(d, k) {
  const [t, ks] = REL_TABS[k], G = (x) => esc(S.gloss[x]?.["냥이"] || "");
  if (t === "궁성") {
    const cols = MX_COLS.map(([key, pos, lbl]) => ({ key, pos, lbl, p: d["원국"][key] }));
    return `<div class="gung"><div></div>${cols.map((c) => `<div class="mx-h">${c.lbl}</div>`).join("")}
      <div class="mx-l">시기</div>${cols.map((c) => `<div class="gung-c"><b>${GUNG[c.pos][0]}</b><small>${GUNG[c.pos][1]}<br>${GUNG[c.pos][2]}</small></div>`).join("")}
      <div class="mx-l">천간</div>${cols.map((c) => `<div class="gung-c">${c.p ? `<b class="e-txt-${c.p["천간"]["오행"]}">${STEM_KO[c.p["천간"]["글자"]]}${c.p["천간"]["글자"]}</b><small>${GUNG[c.pos][3]}</small>` : "—"}</div>`).join("")}
      <div class="mx-l">지지</div>${cols.map((c) => `<div class="gung-c">${c.p ? `<b class="e-txt-${d["지지오행"][c.key]}">${BR_KO[c.p["지지"]["글자"]]}${c.p["지지"]["글자"]}</b><small>${GUNG[c.pos][4]}</small>` : "—"}</div>`).join("")}</div>
      <div class="say" style="margin-top:12px"><span class="who" data-nyang="normal" data-size="40"></span><div class="bubble lav">궁성은 네 기둥을 '인생의 집'으로 보는 법이다냥. 연주는 뿌리(조상·초년), 월주는 부모와 사회(청년), 일주는 나와 배우자(중년), 시주는 자녀와 결실(말년). 어느 기둥에 좋은 별이 있는지 보면 그 시기와 그 사람에게서 복이 온다고 읽는다냥.</div></div>`;
  }
  if (t === "공망") {
    const g = (d["신살표"]["목록"].find((x) => x["이름"] === "공망") || {})["자리"] || [];
    return `<p><b>공망 글자</b> ${esc(d["신살표"]["공망"].map((b) => BR_KO[b] + b).join(", "))} ${g.length ? `· 원국의 ${g.map((w) => w[0] + "주").join(", ")}에 있다냥` : "· 원국에는 공망 글자가 없다냥"}</p>
      <div class="say"><span class="who" data-nyang="think" data-size="40"></span><div class="bubble lav">${G("공망")}</div></div>`;
  }
  const rs = (d["관계"] || []).filter((r) => ks.includes(r["종류"]));
  const term = { 지지육합: "육합", 지지삼합: "삼합", 지지방합: "방합", 지지충: "충" }[t] || t;
  return `${rs.length ? `<ul class="rel-list">${rs.map((r) => `<li><b>${esc(r["종류"])}</b> ${esc(r["글자"].join(" · "))} ${r["설명"] ? `<span class="sub">${esc(r["설명"])}</span>` : ""}</li>`).join("")}</ul>`
    : `<p class="sub">원국 안에 ${esc(t)}이(가) 없다냥.</p>`}
    <div class="say"><span class="who" data-nyang="${rs.length ? "wow" : "normal"}" data-size="40"></span><div class="bubble lav">${G(term) || "냥이가 설명을 준비 중이다냥."}</div></div>`;
}
function sinsalStory(st) {
  const lk = (x, extra = "") => x ? `<div class="ss-period ${x["현재"] ? "now" : ""}"><div><b>${esc(x["나이"] || x["연도"] + "년")}</b> <span class="sub">${esc(x["간지"])}${x["시작"] ? ` · ${x["시작"]}~` : ""}</span></div>
      <div class="ss-inline">${(x["신살"] || []).map((n) => ssChip(n)).join("") || '<span class="sub">조용한 시기</span>'}</div>
      ${x["글"] ? `<p>${esc(x["글"])}</p>` : ""}${extra}</div>` : "";
  const ul = (arr) => (arr?.length ? `<ul class="tips">${arr.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "");
  return `<div class="card tint-lav" id="mx-story"><div class="story-head"><span class="float" data-nyang="proud" data-size="54"></span><h2>🔮 냥이의 신살 이야기</h2></div>
    <div class="bubble">${esc(st["한눈에"])}</div>
    <details class="chap" open><summary><i>🪞</i><div><b>1. 나를 이해하기</b><small>내 사주에 뜬 별들</small></div></summary><div class="chap-body">
      ${st["나"].map((x) => `<div class="ss-me">${ssChip(x["이름"])}<p>${esc(x["글"])}</p><p class="sub">🍀 ${esc(x["쓰는법"])}</p></div>`).join("")}</div></details>
    <button class="ghost wide" type="button" data-go="luck:life" style="margin-top:10px">🧭 지나온 길 · 지금 · 앞으로는 '인생 흐름'에서 보기 ›</button>
    <div class="ss-rx"><b>🐾 냥이의 신살 처방 3가지</b><ol>${st["처방"].map((x) => `<li><b>${esc(x["이름"])}</b> — ${esc(x["처방"])}</li>`).join("")}</ol></div>
    <details class="ss-notes"><summary>냥이 메모 · 판정 기준</summary><ul>${st["메모"].map((m) => `<li>${esc(m)}</li>`).join("")}</ul></details></div>`;
}
function mxSheet(kind, pos) {
  const d = S.d, key = { 시: "시주", 일: "일주", 월: "월주", 연: "연주" }[pos], p = d["원국"][key];
  if (!p) return;
  const lbl = { 시: "생시", 일: "생일", 월: "생월", 연: "생년" }[pos], g = GUNG[pos], G = (t) => esc(S.gloss[t]?.["냥이"] || "");
  const zone = `<p class="sub">${lbl} 기둥 = ${g[0]} · ${g[1]} (${g[2]})</p>`;
  let h = "", body = "";
  if (kind === "s" || kind === "b") {
    const ch = kind === "s" ? p["천간"]["글자"] : p["지지"]["글자"], el = kind === "s" ? p["천간"]["오행"] : d["지지오행"][key];
    const info = kind === "s" ? STEM_INFO[ch] : BR_INFO[ch];
    h = `${kind === "s" ? STEM_KO[ch] : BR_KO[ch]}${ch} <span class="sub">${signEl(ch, el)}</span>`;
    body = kind === "s"
      ? `<b>${info[0]}</b> — ${info[1]}. ${key === "일주" ? `이 글자가 바로 ${esc(nim(d["이름"]) || "너")}의 본체(일간)다냥! 다른 모든 칸은 이 글자와의 관계로 읽는다냥.` : `${g[3]} 자리이자 ${g[1]}의 겉모습에 이 기운이 드러난다냥.`}`
      : `<b>${info[0]}</b>의 글자 · ${info[1]} — ${info[2]}. ${g[4]} 자리이자 ${g[1]}의 속마음·생활 기반에 이 기운이 깔려 있다냥.`;
    body += `<br><br>오행은 <b>${el}</b>(${HANJA[el]})이다냥. ${G(el)}`;
  } else if (kind === "sg" || kind === "bg") {
    const t = (kind === "sg" ? p["천간"]["십성"] : p["지지"]["십성"]).replace("일간(나)", "일간");
    h = t; body = t === "일간" ? `여기는 '나' 자신이다냥. ${G("일간")}` : `${G(t)}<br><br>${lbl} ${kind === "sg" ? "천간" : "지지"}에 있으니 ${g[1]}의 영역에서 이 관계가 드러난다냥.`;
  } else if (kind === "hd") {
    h = "지장간"; body = `${G("지장간")}<br><br><b>${esc(p["지지"]["지장간"].join(" · "))}</b> — 지지 ${BR_KO[p["지지"]["글자"]]}${p["지지"]["글자"]} 속에 숨은 천간들이다냥. 마지막 글자가 주인(정기)이고 앞의 글자들은 손님(여기·중기)이다냥.`;
  } else if (kind === "st") {
    const t = p["지지"]["12운성"]; h = `12운성 · ${t}`;
    body = `${G(t)}<br><br>${G("12운성")}`;
  } else if (kind === "s12") {
    const t = d["신살표"]["12신살"][pos]; h = `12신살 · ${t}`;
    body = `${esc(S12_INFO[t] || "")}<br><br><span class="sub">${pos === "연" ? "연주 칸은 일지를 기준으로, 나머지는 연지를 기준으로 본다냥." : "연지(띠)를 기준으로 본 12신살이다냥."}</span>`;
  }
  const here = [...(d["신살표"]["천간"][pos] || []), ...(d["신살표"]["지지"][pos] || [])];
  openSheet(`<div class="term-head"><span data-nyang="think" data-size="64"></span><div><h2>${h}</h2>${zone}</div></div>
    <div class="bubble lav">${body}</div>
    ${here.length ? `<h3 style="margin:14px 0 6px">이 기둥의 신살</h3><div class="ss-inline">${[...new Set(here)].map((n) => ssChip(n, pos)).join("")}</div>` : ""}`);
}
function luckSheet(kind, idx) {
  const x = S.d["운줄"][kind][+idx]; if (!x) return;
  const G = (t) => esc(S.gloss[t]?.["냥이"] || "");
  const when = kind === "대운" ? `${x["나이"]}~${x["나이"] + 9}세 (${x["시작"]}~${x["시작"] + 9}년)` : kind === "세운" ? `${x["연도"]}년 (${x["나이"]}세)` : `${x["절기"]}부터 (${x["시작"]}~)`;
  openSheet(`<div class="term-head"><span data-nyang="${x["현재"] ? "wow" : "think"}" data-size="64"></span><div><h2>${kind} ${STEM_KO[x["간지"][0]]}${BR_KO[x["간지"][1]]} ${x["간지"]}</h2><div class="term-mean">${when}${x["현재"] ? " · 지금!" : ""}</div></div></div>
    <div class="bubble lav"><b>천간 ${esc(x["천간십성"])}</b> — ${G(x["천간십성"])}<br><br><b>지지 ${esc(x["지지십성"])}</b> — ${G(x["지지십성"])}<br><br><b>12운성 ${esc(x["운성"])}</b> — ${G(x["운성"])}</div>
    ${x["신살"].length ? `<h3 style="margin:14px 0 6px">이 운에 들어오는 신살</h3><div class="ss-inline">${x["신살"].map((n) => ssChip(n, "운")).join("")}</div>
      <ul class="tips">${x["신살"].slice(0, 3).map((n) => `<li><b>${esc(n)}</b>: ${esc(S.sinsal["설명"][n]?.["운"] || "")} <span class="sub">${esc(S.sinsal["설명"][n]?.["준비"] || "")}</span></li>`).join("")}</ul>` : '<p class="sub" style="margin-top:12px">특별한 신살 없이 원국의 기운대로 흐르는 시기다냥.</p>'}
    ${S.ai ? `<button class="ghost wide" type="button" data-ask="${esc(`${kind} ${x["간지"]}(${when})이 내 사주에서 어떤 의미야?`)}" style="margin-top:10px">💬 냥이에게 더 묻기</button>` : ""}`);
}
function ssSheet(n, where) {
  const x = S.sinsal?.["설명"]?.[n]; if (!x) return;
  const P = S.sinsal["자리"] || {}, R = S.sinsal["줄"] || {};
  const spots = (where || "").split(",").filter((w) => P[w[0]]).map((w) => `${P[w[0]][0]}${w[1] && R[w[1]] ? "의 " + R[w[1]] : ""} — ${P[w[0]][1]}`);
  const sec = (t, v) => (v ? `<div class="ss-sec"><b>${t}</b><p>${esc(v)}</p></div>` : "");
  openSheet(`<div class="term-head"><span data-nyang="${x["종류"] === "살" ? "focus" : "happy"}" data-size="64"></span><div><h2>${esc(n)} <span class="sub">${esc(x["한자"])}</span></h2>
      <div class="term-mean"><span class="ss-badge ${KIND_CLS[x["종류"]]}">${esc(x["종류뜻"])}</span> · 기준: ${esc(x["기준"])}</div></div></div>
    <div class="bubble lav">${esc(x["한줄"])}</div>
    ${spots.length ? `<div class="ss-sec"><b>📍 내 사주의 이 자리</b>${spots.map((s) => `<p>${esc(s)}</p>`).join("")}</div>` : where === "운" ? `<div class="ss-sec"><b>📍 운에서 들어올 때</b><p>${esc(x["운"])}</p><p class="sub">준비: ${esc(x["준비"])}</p></div>` : ""}
    ${sec("📜 옛 해석", x["옛뜻"])}${sec("✨ 요즘 해석", x["요즘"])}${sec("💪 강점", x["강점"])}${sec("⚠️ 조심", x["조심"])}${sec("🍀 이렇게 쓰라냥", x["쓰는법"])}
    ${where !== "운" ? sec("🔭 대운·세운에서 들어오면", `${x["운"]} 준비: ${x["준비"]}`) : ""}
    ${S.ai ? `<button class="ghost wide" type="button" data-ask="${esc(n)}이 내 사주에서 어떻게 작용해?" style="margin-top:10px">💬 내 사주에선 어떤지 냥이에게 묻기</button>` : ""}`);
}
document.addEventListener("click", (e) => {
  const m = e.target.closest("[data-mx]"); if (m) { const [k, p] = m.dataset.mx.split(":"); mxSheet(k, p); return; }
  const l = e.target.closest("[data-luck]"); if (l) { const [k, i] = l.dataset.luck.split(":"); luckSheet(k, i); return; }
  const s = e.target.closest("[data-ss]"); if (s) { ssSheet(s.dataset.ss, s.dataset.where); return; }
  const t = e.target.closest("[data-mxtab]");
  if (t) { $$(".mx-tabs button").forEach((b) => b.classList.toggle("on", b === t)); $("#mx-relpane").innerHTML = relPane(S.d, +t.dataset.mxtab); paintNyang($("#mx-relpane")); dedupeTerms($("#mx-relpane")); }
});
document.addEventListener("toggle", (e) => { if (e.target.classList?.contains("mx-guide") && !e.target.open) localStorage.setItem("nyang:mxguide", "1"); }, true);
function mxScrollNow() {
  $$("#tab-saju .lk-row").forEach((r) => { const n = $(".lk.now", r); if (n) r.scrollLeft += n.getBoundingClientRect().left - r.getBoundingClientRect().left - (r.clientWidth - n.clientWidth) / 2; });
}

function saveSvgPng(svg, filename) {
  if (!svg) return;
  const xml = new XMLSerializer().serializeToString(svg), vb = svg.viewBox.baseVal, scale = 3, img = new Image();
  img.onload = () => {
    const cv = document.createElement("canvas"); cv.width = vb.width * scale; cv.height = vb.height * scale;
    const ctx = cv.getContext("2d"); ctx.scale(scale, scale); ctx.drawImage(img, 0, 0, vb.width, vb.height);
    const a = document.createElement("a"); a.download = filename; a.href = cv.toDataURL("image/png"); a.click();
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
}
function saveMansePng() {
  const svg = $("#manse-svg svg");
  const xml = new XMLSerializer().serializeToString(svg);
  const vb = svg.viewBox.baseVal, scale = 2;
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement("canvas");
    cv.width = vb.width * scale; cv.height = vb.height * scale;
    const ctx = cv.getContext("2d"); ctx.scale(scale, scale); ctx.drawImage(img, 0, 0, vb.width, vb.height);
    const a = document.createElement("a");
    a.download = `만세력_${S.d["입력"]["양력"]}.png`; a.href = cv.toDataURL("image/png"); a.click();
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
}

// ───────────────────────── 궁합
let compatMode = "map";
function renderCompat() {
  const m = married(), kidsN = S.birth?.kids || 0;
  $("#tab-compat").innerHTML = `
    <div class="segtabs" role="tablist"><button data-cmode="map" type="button">🌌 귀인 지도</button><button data-cmode="love" type="button">${m ? "💑 부부 궁합" : "💞 연인 궁합"}</button><button data-cmode="child" type="button">👨‍👧 자녀</button></div>
    <div data-cpane="map" ${compatMode === "map" ? "" : "hidden"}></div>
    <div data-cpane="love" ${compatMode === "love" ? "" : "hidden"}>
      <div class="say"><span class="who" data-nyang="happy" data-size="64"></span><div class="bubble">${m ? "두 사람의 본성부터 마음의 안방(일지)까지, 우리 부부 사용 설명서를 펼쳐 주겠다냥 💑" : `두 사람의 ${chip("일간")}, 배우자 자리(${chip("일지")}), 서로의 ${chip("용신")}까지 정밀하게 보는 궁합이다냥 💞`}</div></div>
      <div class="pair"><form id="form-b" class="card form" autocomplete="off"></form></div>
      <button class="btn primary wide" id="btn-compat" type="button">궁합 보기</button>
      <div id="compat-out" style="margin-top:16px"></div>
    </div>
    <div data-cpane="child" ${compatMode === "child" ? "" : "hidden"}>${renderKidPane()}</div>`;
  buildForm($("#form-b"), "b", m ? "배우자 생일" : "상대방 생일");
  fillForm($("#form-b"), JSON.parse(localStorage.getItem("nyang:partner") || "null"));
  $("#btn-compat").addEventListener("click", runCompat);
  $$("#tab-compat [data-cmode]").forEach((b) => { b.setAttribute("aria-selected", b.dataset.cmode === compatMode);
    b.addEventListener("click", () => { compatMode = b.dataset.cmode; renderCompat(); }); });
  bindKidPane();
  paintNyang($("#tab-compat"));
  if (compatMode === "map") renderMapPane();
}

// ───────────────────────── 귀인 지도(관계 지도)
const KCOL = { guiin: "#ffd66b", jjak: "#7fd3b8", mine: "#a7e27a", arm: "#8ab4ff", tiger: "#ff8f8f" };
const ELC = { 목: "#6fd39a", 화: "#ff9b8a", 토: "#f6c96b", 금: "#d9dde6", 수: "#8fb0ff" };
let mapData = null, mapBusy = false;
const localFriends = () => store.get("friends", []);
const setLocalFriends = (v) => store.set("friends", v);
const mapRef = () => store.get("mapref", null);

const mapKind = (M, k) => M["종류"][Object.keys(M["종류"]).find((c) => M["종류"][c][0] === k)];
function starMap(M, opts = {}) {
  const W = 360, C = 180, order = M["순서"], members = M["멤버"];
  const by = {};
  members.forEach((m) => { (by[m["나에게"]["키"]] ||= []).push(m); });
  const rad = (chem) => 58 + (98 - Math.max(30, Math.min(98, chem))) / 68 * 62;      // 달에서 58~120
  const ang = (i, n, sec) => (-90 + sec * 72 + (n === 1 ? 0 : -26 + (52 * i) / (n - 1))) * Math.PI / 180;
  let stars = "", lines = "", marks = "";
  order.forEach((k, sec) => {
    const a = (-90 + sec * 72) * Math.PI / 180, mx = C + Math.cos(a) * 158, my = C + Math.sin(a) * 158;
    const info = mapKind(M, k), n = (by[k] || []).length;
    marks += `<g opacity="${n ? 1 : 0.4}"><circle cx="${mx}" cy="${my}" r="14" fill="#2a2140" stroke="${KCOL[k]}" stroke-width="1.5"/>
      <text x="${mx}" y="${my + 5}" text-anchor="middle" font-size="14">${info[1]}</text></g>`;
    (by[k] || []).forEach((m, i, arr) => {
      const t = ang(i, arr.length, sec), r = rad(m["케미"]) - (arr.length > 2 && i % 2 ? 9 : 0);
      const x = C + Math.cos(t) * r, y = C + Math.sin(t) * r;
      const sz = Math.max(14, 15 + (m["나에게"]["영향력"] - 40) / 60 * 7), col = ELC[m["유형"]["오행"]] || "#fff";
      const nm = [...m["이름"]].slice(0, 3).join(""), fs = nm.length <= 2 ? 12.5 : 10.5;
      lines += `<line x1="${C}" y1="${C}" x2="${x}" y2="${y}" stroke="${KCOL[k]}" stroke-opacity="${0.15 + (m["케미"] - 30) / 68 * 0.5}" stroke-width="1.5"/>`;
      stars += `<g class="mstar" data-mid="${esc(m.id)}" style="cursor:pointer"><title>${esc(m["이름"])} · ${esc(m["나에게"]["세부"])} · 케미 ${m["케미"]}</title>
        ${m["나에게"]["천을귀인"] ? `<circle cx="${x}" cy="${y}" r="${sz + 6}" fill="none" stroke="#ffd66b" stroke-dasharray="3 3" opacity=".9"/>` : ""}
        <circle cx="${x}" cy="${y}" r="${sz + 4}" fill="${col}" opacity=".18"/>
        <circle cx="${x}" cy="${y}" r="${sz}" fill="${col}" stroke="#fff" stroke-width="1.5"/>
        <text x="${x}" y="${y + fs * 0.36}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="#2a2140">${esc(nm)}</text></g>`;
    });
  });
  const sky = Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 97) % W}" cy="${(i * 53 + 17) % W}" r="${i % 5 ? 0.8 : 1.4}" fill="#fff" opacity="${0.2 + (i % 4) * 0.12}"/>`).join("");
  return `<svg class="starmap" viewBox="0 0 ${W} ${W}" role="img" aria-label="관계 지도" font-family="Jua, Gowun Dodum, Apple SD Gothic Neo, Malgun Gothic, sans-serif">
    <defs><radialGradient id="moon" cx="40%" cy="35%"><stop offset="0" stop-color="#fff8e8"/><stop offset="1" stop-color="#f3c98b"/></radialGradient>
      <radialGradient id="nightsky" cx="50%" cy="50%"><stop offset="0" stop-color="#4a2d4f"/><stop offset="1" stop-color="#1d1733"/></radialGradient></defs>
    <rect width="${W}" height="${W}" rx="28" fill="url(#nightsky)"/>${sky}
    ${[70, 105, 140].map((r) => `<circle cx="${C}" cy="${C}" r="${r}" fill="none" stroke="#fff" stroke-opacity=".08" stroke-dasharray="2 5"/>`).join("")}
    ${lines}
    <circle cx="${C}" cy="${C}" r="44" fill="#f3c98b" opacity=".15"/><circle cx="${C}" cy="${C}" r="34" fill="url(#moon)" stroke="#fff" stroke-width="2"/>
    <text x="${C}" y="${C + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="#3b2f4a">${esc([...(M["주인"]["이름"] || "나")].slice(0, 4).join(""))}</text>
    ${marks}${stars}
    ${opts.slot ? `<g><circle cx="${C}" cy="${C + 106}" r="18" fill="#2a2140" stroke="#ffd66b" stroke-dasharray="4 3"/><text x="${C}" y="${C + 112}" text-anchor="middle" font-size="17" fill="#ffd66b">?</text>
      <text x="${C}" y="${C + 140}" text-anchor="middle" font-size="11.5" fill="#f3eefc">내 자리는?</text></g>` : ""}
    <text x="${C}" y="${W - 10}" text-anchor="middle" font-size="10" fill="#cfc4e6">달에 가까울수록 케미↑ · 별이 클수록 주는 힘↑ · 금빛 점선 = 천을귀인</text></svg>`;
}

function mapBody(M, owner = true) {
  const sm = M["요약"], ms = M["멤버"], kinds = M["순서"];
  const kindName = (k) => { const c = Object.keys(M["종류"]).find((c) => M["종류"][c][0] === k); return M["종류"][c]; };
  const groups = {};
  ms.forEach((m) => { (groups[m["올해"]["이름"]] ||= { e: m["올해"], names: [] }).names.push(m["이름"]); });
  const medal = (i) => ["🥇", "🥈", "🥉"][i] || `${i + 1}`;
  return `
    <div class="card map-card"><div class="card-head"><h2>관계 지도 <span class="sub">· ${sm["인원"]}${M["정원"] ? `/${M["정원"]}` : ""}명${M["대기수"] ? ` · 대기 ${M["대기수"]}` : ""}</span></h2><span class="badge">${esc(sm["칭호"])}</span></div>
      <div class="map-me">${esc(M["주인"]["유형"]["이모지"])} ${esc(M["주인"]["이름"])}님 · <b>${esc(M["주인"]["유형"]["이름"])}</b> · ${M["연도"]} ${esc(M["주인"]["올해"]["이모지"])} ${esc(M["주인"]["올해"]["이름"])}</div>
      ${starMap(M, { slot: !owner })}
      <div class="kcount">${kinds.map((k) => { const i = kindName(k); return `<div><i class="kdot" style="background:${KCOL[k]}"></i><b>${sm["유형수"][k]}</b><small>${i[1]}<br>${esc(i[2])}</small></div>`; }).join("")}</div></div>
    ${owner ? `<div class="card tint-butter"><div class="today">${ring(sm["귀인점수"], "귀인 점수", "", "#e0a92b")}
      <div><h3 style="margin:0 0 4px">나의 귀인 점수</h3><p class="sub" style="margin:0">지도에 있는 사람들이 내 용신을 채워 주는 정도, 천을귀인, 귀인 관계를 모아 계산했다냥.</p>
      ${sm["가장큰귀인"] ? `<p style="margin:6px 0 0">🌟 가장 큰 힘이 되는 사람: <b>${esc(sm["가장큰귀인"]["이름"])}</b> (${sm["가장큰귀인"]["영향력"]})</p>` : ""}
      ${sm["내가귀인"] ? `<p style="margin:2px 0 0">🤲 내가 가장 힘이 되는 사람: <b>${esc(sm["내가귀인"]["이름"])}</b> (${sm["내가귀인"]["영향력"]})</p>` : ""}</div></div>
      <p class="map-line">🐾 ${esc(sm["한줄"])}</p></div>` : `<p class="map-line card">🐾 ${esc(sm["한줄"])}</p>`}
    ${Object.keys(groups).length ? `<div class="card"><h2>${M["연도"]}년, 같은 한 해를 보내는 사람들</h2>${Object.values(groups).map((g) => `<div class="yg"><b>${esc(g.e["이모지"])} ${esc(g.e["이름"])}</b> <span class="sub">${esc(g.e["설명"])}</span><div>${g.names.map(esc).join(" · ")}</div></div>`).join("")}</div>` : ""}
    <div class="card"><h2>케미 순위</h2><div class="mlist">${ms.length ? ms.map((m, i) => `<button type="button" class="mrow" data-mid="${esc(m.id)}">
      <span class="md">${medal(i)}</span><span class="mn"><b>${esc(m["이름"])}</b> <small>${esc(m["유형"]["이모지"])} ${esc(m["유형"]["이름"])}</small>
      <small>${esc(m["나에게"]["이모지"])} ${esc(m["나에게"]["세부"])}${m["나에게"]["천을귀인"] ? " · ✨천을귀인" : ""} · ${esc(m["올해"]["이모지"])} ${esc(m["올해"]["이름"])}</small></span>
      <span class="ms">${m["케미"]}</span></button>`).join("") : `<p class="sub">아직 아무도 없다냥. 아래에서 친구를 초대해 봐!</p>`}</div></div>`;
}

function openMember(m, owner, onDelete, onWait, onLetter) {
  const a = m["나에게"], b = m["상대에게"];
  openSheet(`<div class="term-head"><span data-nyang="think" data-size="60"></span><div><h2>${esc(m["이름"])} · 케미 ${m["케미"]}</h2>
      <div class="term-mean">${esc(m["유형"]["이모지"])} ${esc(m["유형"]["이름"])} · ${esc(m["올해"]["이모지"])} ${esc(m["올해"]["이름"])}</div></div></div>
    <div class="grid2" style="margin-bottom:10px"><div class="fit"><small>${owner ? "이 사람이 나에게" : "이 사람이 주인에게"}</small><b>${esc(a["이모지"])} ${esc(a["세부"])}</b>
      <div class="sub">용신 채움 ${a["보완"]} · 영향력 ${a["영향력"]}</div></div>
      <div class="fit"><small>${owner ? "내가 이 사람에게" : "주인이 이 사람에게"}</small><b>${esc(b["이모지"])} ${esc(b["세부"])}</b>
      <div class="sub">용신 채움 ${b["보완"]} · 영향력 ${b["영향력"]}</div></div></div>
    ${m["냥이"] ? `<p class="m-card" style="--c:${m["냥이"]["색"]}">🃏 ${esc(m["냥이"]["일주"])} · <b>${esc(m["냥이"]["이름"])}</b></p>` : ""}
    <div class="bubble lav" style="margin-bottom:10px">🔄 ${esc(m["흐름"])}</div>
    ${m["좋은점"].length ? `<h3>👍 좋은 기운</h3><ul class="tips">${m["좋은점"].map((x) => `<li>${T(x, true)}</li>`).join("")}</ul>` : ""}
    ${m["아쉬운점"].length ? `<h3 style="margin-top:10px">🤏 조율할 점</h3><ul class="tips">${m["아쉬운점"].map((x) => `<li>${T(x, true)}</li>`).join("")}</ul>` : ""}
    <p class="fine">궁합 점수는 서로를 이해하는 참고용이다냥. 사람은 점수보다 행동으로 알아 가는 거야!</p>
    ${onLetter ? `<button class="btn primary wide" type="button" id="m-letter" style="margin-bottom:8px">📮 보약 편지 보내기</button>` : ""}
    ${onWait ? `<button class="ghost wide" type="button" id="m-wait" style="margin-bottom:8px">⏳ 대기 명단으로 내리기 (자리 비우기)</button>` : ""}
    ${onDelete ? `<button class="ghost wide" type="button" id="m-del" style="margin-bottom:8px">지도에서 지우기</button>` : ""}`);
  $("#m-wait")?.addEventListener("click", () => { closeSheet(); onWait(); });
  $("#m-letter")?.addEventListener("click", () => onLetter());
  $("#m-del")?.addEventListener("click", () => { closeSheet(); onDelete(); });
}

function bindMap(root, M, owner, onDelete, onWait, onLetter) {
  $$("[data-mid]", root).forEach((el) => el.addEventListener("click", () => {
    const m = M["멤버"].find((x) => x.id === el.dataset.mid);
    if (m) openMember(m, owner, onDelete ? () => onDelete(m) : null, onWait ? () => onWait(m, true) : null, onLetter ? () => onLetter(m) : null);
  }));
}
function waitCard(M) {
  const ws = M["대기"] || [], full = M["멤버"].length >= (M["정원"] || 10);
  if (!ws.length && !full) return "";
  return `<div class="card" id="wait-card"><div class="card-head"><h2>⏳ 대기 명단</h2><span class="badge">${ws.length}명</span></div>
    <p class="sub" style="margin:0 0 10px">지도에는 <b>최대 ${M["정원"] || 10}명</b>까지 별로 떠요. 넘치면 여기서 기다리고, 언제든 넣고 뺄 수 있다냥.
      ${full ? "지금 지도가 꽉 찼어 — 별을 눌러 '대기 명단으로 내리기'로 자리를 비우면 올릴 수 있어." : ""}</p>
    ${ws.length ? `<div class="mlist">${ws.map((m) => `<div class="wrow"><div class="mn"><b>${esc(m["이름"])}</b>
        <small>${esc(m["나에게"]["이모지"])} ${esc(m["나에게"]["세부"])} · 케미 ${m["케미"]}</small></div>
        <div class="wbtn"><button type="button" class="ghost" data-wup="${esc(m.id)}" ${full ? "disabled" : ""}>⬆ 올리기</button>
        <button type="button" class="ghost" data-wdel="${esc(m.id)}" aria-label="${esc(m["이름"])} 지우기">✕</button></div></div>`).join("")}</div>`
    : `<p class="sub" style="margin:0">아직 기다리는 사람이 없다냥.</p>`}</div>`;
}

async function renderMapPane() {
  const pane = $("#tab-compat [data-cpane=map]");
  if (!pane || !S.d) return;
  const ref = mapRef();
  if (S.share && !ref) {
    pane.innerHTML = `<div class="say"><span class="who" data-nyang="happy" data-size="64"></span><div class="bubble">내 귀인 지도를 만들고 링크를 보내 봐! 친구가 <b>별명과 생일만</b> 넣으면 내 지도에 별로 떠오른다냥 🌌</div></div>
      <div class="card"><h2>🌌 내 귀인 지도 만들기</h2>
        <p class="sub">지도를 다시 계산하려고 <b>내 생년월일은 서버에 저장</b>돼요(지도 삭제 시 함께 삭제). 친구의 생년월일은 저장하지 않고, 계산된 관계 결과와 별명만 남아요. 내 링크로 참여한 친구가 자기 지도를 만들면 <b>내 별명도 그 친구 지도에 별로 떠요</b>(서로 보이기).</p>
        <label class="check consent"><input type="checkbox" id="map-consent"> 위 내용과 <a href="/privacy.html" target="_blank">개인정보 처리방침</a>에 동의하고 만 14세 이상이에요</label>
        <button class="btn primary wide" type="button" id="map-create">지도 만들기 ✨</button></div>`;
    $("#map-create").addEventListener("click", async (e) => {
      if (!$("#map-consent").checked) { alert("동의에 체크해 달라냥"); return; }
      e.currentTarget.disabled = true;
      let inv = ""; try { inv = localStorage.getItem("nyang:invitedBy") || ""; } catch { /* 저장 불가 */ }
      try {
        const r = await api("/api/map", { owner: S.birth, consent: true, invited_by: inv });
        store.set("mapref", { id: r.id, token: r.token });
        if (r["첫별"]) { try { localStorage.removeItem("nyang:invitedBy"); } catch { /* */ } alert(`나를 초대해 준 ${r["첫별"]}님이 내 지도의 첫 별로 올라왔다냥! 🌟`); }
        renderMapPane();
      }
      catch (err) { alert(err.message); e.currentTarget.disabled = false; }
    });
    paintNyang(pane); return;
  }
  loading(pane);
  try {
    if (S.share && ref) mapData = await api(`/api/map/${ref.id}?token=${encodeURIComponent(ref.token)}`);
    else mapData = await api("/api/mapcalc", { me: S.birth, others: localFriends() });
  } catch (err) {
    if (S.share && ref && /찾을 수 없/.test(err.message)) { store.set("mapref", null); return renderMapPane(); }
    pane.innerHTML = `<div class="card"><p class="error">${esc(err.message)}</p></div>`; return;
  }
  collectFriendCards(mapData);
  const link = S.share && ref ? `${location.origin}/m/${ref.id}` : "";
  pane.innerHTML = mapBody(mapData, true) + (S.share && ref ? questCard() + waitCard(mapData) : "") + (S.share ? `
    <div class="card tint-pink"><h2>🙋 친구에게 공유하기</h2><p>친구가 생일만 넣으면 나와 어떤 인연인지, 그 친구의 ${mapData["연도"]}년 한 줄까지 지도에 자동으로 떠요.</p>
      <div class="rd-cta"><button class="btn primary" type="button" id="map-share">📤 지도 링크 보내기</button><button class="ghost" type="button" id="map-copy">🔗 링크 복사</button></div>
      <button class="ghost wide" type="button" id="map-png" style="margin-top:8px">🖼️ 지도 이미지로 저장(단톡방용)</button>
      <p class="fine" style="margin:8px 0 0">${esc(link)}</p></div>` : `
    <div class="card tint-pink"><h2>➕ 친구 직접 넣기</h2><p class="sub">지금은 공유 저장소 연결 전이라 <b>이 폰에만 저장</b>돼요. 연결되면 링크 한 번으로 친구가 직접 올라온다냥.</p>
      <label class="field"><span>친구 별명</span><input id="fr-name" maxlength="12" placeholder="예) 단짝 지수"></label>
      <form id="form-fr" class="form" autocomplete="off"></form>
      <button class="btn primary wide" type="button" id="fr-add">지도에 올리기</button></div>`);
  if (!S.share) { buildForm($("#form-fr"), "fr", "친구 생일"); $("#form-fr .form-title")?.remove(); { const nf = $("#form-fr [name=nm]")?.closest(".field"); if (nf) nf.hidden = true; } }
  const setWait = async (m, wait) => {
    try { await api(`/api/map/${ref.id}/member/${m.id}/wait`, { token: ref.token, wait }); renderMapPane(); }
    catch (err) { alert(err.message); }
  };
  const delMember = async (m) => {
    if (S.share && ref) { await fetch(`/api/map/${ref.id}/member/${m.id}?token=${encodeURIComponent(ref.token)}`, { method: "DELETE" }); }
    else { const fr = localFriends(); fr.splice(+m.id.replace("local", ""), 1); setLocalFriends(fr); }
    renderMapPane();
  };
  bindMap(pane, mapData, true, delMember, S.share && ref ? setWait : null, S.share && ref ? (m) => openLetter(m, ref) : null);
  if (S.share && ref) loadLetters(ref);
  $$("[data-wup]", pane).forEach((b) => b.addEventListener("click", () => setWait({ id: b.dataset.wup }, false)));
  $$("[data-wdel]", pane).forEach((b) => b.addEventListener("click", () => {
    const m = (mapData["대기"] || []).find((x) => x.id === b.dataset.wdel);
    if (m && confirm(`${m["이름"]}님을 대기 명단에서 지울까?`)) delMember(m);
  }));
  $("#map-share")?.addEventListener("click", async () => {
    const text = `${S.d["이름"] ? S.d["이름"] + "님" : "나"}의 귀인 지도에 내 자리를 찾아 줘! 생일만 넣으면 우리 사이가 나온다냥 🐾`;
    if (navigator.share) { try { await navigator.share({ title: "사주냥이 귀인 지도", text, url: link }); } catch { /* 취소 */ } }
    else { await navigator.clipboard?.writeText(`${text} ${link}`); alert("링크를 복사했다냥!"); }
  });
  $("#map-png")?.addEventListener("click", () => saveSvgPng($(".starmap", pane), `귀인지도_${S.d["이름"] || "나"}.png`));
  $("#map-copy")?.addEventListener("click", async () => { await navigator.clipboard?.writeText(link); alert("링크를 복사했다냥!"); });
  $("#fr-add")?.addEventListener("click", async () => {
    const name = $("#fr-name").value.trim();
    if (!name) { alert("친구 별명을 적어 달라냥"); return; }
    let b; try { b = birthOf($("#form-fr")); } catch (err) { alert(err.message); return; }
    if (mapBusy) return; mapBusy = true;
    const fr = localFriends(); fr.push({ name, birth: { ...b, name } });
    try { await api("/api/mapcalc", { me: S.birth, others: [fr[fr.length - 1]] }); setLocalFriends(fr); renderMapPane(); }
    catch (err) { alert(err.message); } finally { mapBusy = false; }
  });
  paintNyang(pane);
}

// 링크로 들어온 친구(손님) 화면
async function guestMap(mid) {
  const box = $("#guest");
  $("#onboard").hidden = true; $("#main").hidden = true; box.hidden = false;
  loading(box);
  let M;
  try { M = await api(`/api/map/${encodeURIComponent(mid)}`); }
  catch (err) { box.innerHTML = `<div class="card"><p class="error">${esc(err.message)}</p><button class="btn primary wide" type="button" id="g-home">사주냥이 홈으로</button></div>`;
    $("#g-home").addEventListener("click", () => { location.href = "/"; }); return; }
  const owner = M["주인"]["이름"];
  box.innerHTML = `<div class="hero" style="margin-bottom:6px"><div data-nyang="happy" data-size="110"></div>
      <div class="bubble big">${esc(owner)}님의 귀인 지도에 초대받았다냥!<br><b>나는 ${esc(owner)}님에게 어떤 사람일까?</b></div></div>
    ${mapBody(M, false)}
    <div class="card" id="g-join"><h2>🙋 생일 넣고 내 자리 찾기</h2>
      <label class="field"><span>이름 또는 별명 <em>지도에 보여요 · 별명 권장</em></span><input id="g-name" maxlength="12" placeholder="예) 고양이 집사"></label>
      <form id="form-g" class="form" autocomplete="off"></form>
      <p class="sub">${esc(owner)}님의 지도에는 내 생년월일이 <b>저장되지 않고</b>, 계산된 관계 결과와 별명만 올라가요.</p>
      <label class="check consent"><input type="checkbox" id="g-consent"> 만 14세 이상이며, 별명과 관계 결과를 지도에 올리는 데 동의해요(<a href="/privacy.html" target="_blank">개인정보 처리방침</a>)</label>
      <label class="check consent mutual"><input type="checkbox" id="g-mutual" checked> <span><b>서로 연결하기</b> — ${esc(owner)}님도 <b>내 귀인 지도</b>에 별로 자동으로 올릴게요.
        <small>내 지도가 없으면 새로 만들어지고, 내 지도 계산을 위해 내 생년월일이 저장돼요(지도를 지우면 함께 삭제).</small></span></label>
      <button class="btn primary wide" type="button" id="g-go">지도에 이름 올리기 ✨</button></div>
    <div id="g-result"></div>
    <p class="foot">사주는 정답지가 아니라 지도다냥 · 언제든 내 별을 지울 수 있어요<br><a href="/privacy.html">개인정보 처리방침</a> · <a href="/terms.html">이용약관</a></p>`;
  buildForm($("#form-g"), "g", "내 생일"); $("#form-g .form-title")?.remove(); { const nf = $("#form-g [name=nm]")?.closest(".field"); if (nf) nf.hidden = true; }
  bindMap(box, M, false, null);
  paintNyang(box);
  $("#g-go").addEventListener("click", async (e) => {
    const name = $("#g-name").value.trim();
    if (!name) { alert("별명을 적어 달라냥"); return; }
    if (!$("#g-consent").checked) { alert("동의에 체크해 달라냥"); return; }
    let b; try { b = birthOf($("#form-g")); } catch (err) { alert(err.message); return; }
    e.currentTarget.disabled = true;
    try {
      const bk = `nyang:mapref:${hashStr(JSON.stringify(CORE.map((k) => b?.[k])))}`;
      let myMap = null; try { myMap = JSON.parse(localStorage.getItem(bk) || "null"); } catch { myMap = null; }
      const mutual = $("#g-mutual").checked;
      const r = await api(`/api/map/${encodeURIComponent(mid)}/join`, { name, birth: { ...b, name }, consent: true, mutual, my_map: mutual && myMap ? myMap : null });
      try {
        if (r.id) localStorage.setItem(`nyang:joined:${mid}`, JSON.stringify({ id: r.id, token: r.token }));
        if (r["내지도"]) localStorage.setItem(bk, JSON.stringify({ id: r["내지도"].id, token: r["내지도"].token }));
      } catch { /* 저장 불가 */ }
      const mm = r["내지도"];
      const me = r["내시선"]["나에게"], ow = r["주인시선"]["나에게"];
      $("#g-join").hidden = true;
      $("#g-result").innerHTML = `<div class="card tint-pink"><h2>🎉 ${esc(owner)}님 지도에 올라갔다냥!</h2>
        <div class="grid2"><div class="fit"><small>${esc(owner)}님에게 나는</small><b>${esc(ow["이모지"])} ${esc(ow["세부"])}</b><div class="sub">케미 ${r["주인시선"]["케미"]}</div></div>
          <div class="fit"><small>나에게 ${esc(owner)}님은</small><b>${esc(me["이모지"])} ${esc(me["세부"])}</b><div class="sub">용신 채움 ${me["보완"]}</div></div></div>
        <p style="margin:10px 0 4px">나는 <b>${esc(r["나"]["이모지"])} ${esc(r["나"]["이름"])}</b> · ${r["나의올해"]["이모지"]} ${esc(r["나의올해"]["이름"])} — ${esc(r["나의올해"]["설명"])}</p>
        <p class="sub">🔄 ${esc(r["내시선"]["흐름"])}</p>
        ${r["이미"] ? `<p class="note-box">🐾 이미 ${esc(owner)}님 지도에 올라가 있어서 한 번 더 올리진 않았다냥.</p>` : ""}
        ${r["대기"] ? `<p class="note-box">⏳ ${esc(owner)}님 지도가 꽉 차서(${10}명) <b>대기 명단</b>에 들어갔다냥. ${esc(owner)}님이 자리를 내 주면 별로 떠요.</p>` : ""}
        ${mm ? `<p class="note-box">🔗 <b>서로 연결 완료!</b> ${esc(owner)}님이 ${mm["new"] ? "새로 만든 내 귀인 지도의 첫 별로" : "내 귀인 지도에"} ${mm["주인올림"] === false ? "이미 떠 있다냥." : mm["주인대기"] ? "들어갔는데 지도가 꽉 차서 대기 명단에 있어." : "떴다냥! 🌟"}</p>` : ""}
        <button class="btn primary wide" type="button" id="g-mine">${mm ? "🗺 내 귀인 지도 보러 가기" : `🗺 내 귀인 지도도 만들기 — ${esc(owner)}님이 첫 별로 떠요`}</button>
        ${r.id ? `<button class="ghost wide" type="button" id="g-undo" style="margin-top:8px">${esc(owner)}님 지도에서 내 별 지우기</button>` : ""}</div>`;
      $("#g-mine").addEventListener("click", () => {
        try { localStorage.setItem("nyang:me", JSON.stringify({ ...b, name })); if (mm) localStorage.setItem("nyang:go", "compat:map"); else localStorage.setItem("nyang:invitedBy", mid); } catch { /* 저장 불가 */ }
        location.href = "/";
      });
      $("#g-undo")?.addEventListener("click", async () => { await fetch(`/api/map/${encodeURIComponent(mid)}/member/${r.id}?token=${encodeURIComponent(r.token)}`, { method: "DELETE" }); location.reload(); });
      $("#g-result").scrollIntoView({ behavior: "smooth" });
    } catch (err) { alert(err.message); e.currentTarget.disabled = false; }
  });
}

// ───────────────────────── 자녀 궁합
const getKids = () => JSON.parse(localStorage.getItem("nyang:kids") || "[]");
const setKids = (k) => localStorage.setItem("nyang:kids", JSON.stringify(k));
let kidSel = 0;
function renderKidPane() {
  const kids = getKids();
  return `<div class="say"><span class="who" data-nyang="wink" data-size="64"></span><div class="bubble">아이와 자꾸 부딪힌다면, 누가 틀린 게 아니라 <b>기운이 다른 것</b>일 수 있다냥. 아이의 타고난 기질과 우리 사이 사용 설명서를 펼쳐 주겠다냥 👨‍👧</div></div>
    ${kids.length ? `<div class="kid-chips">${kids.map((k, i) => `<button type="button" data-kid="${i}" class="${i === kidSel ? "on" : ""}">${k.gender === "남" ? "👦" : "👧"} ${esc(k.name || `아이 ${i + 1}`)}</button>`).join("")}
      <button type="button" data-kid="new" class="${kidSel === "new" ? "on" : ""}">＋ 추가</button></div>` : ""}
    <div class="pair"><form id="form-kid" class="card form" autocomplete="off"></form></div>
    <div class="rd-cta" style="grid-template-columns:1fr ${kids.length && kidSel !== "new" ? "auto" : ""}"><button class="btn primary" id="btn-kid" type="button">자녀 궁합 보기</button>
      ${kids.length && kidSel !== "new" ? `<button class="ghost" id="btn-kid-del" type="button">삭제</button>` : ""}</div>
    <div id="kid-out" style="margin-top:16px"></div>`;
}
function bindKidPane() {
  const f = $("#form-kid");
  if (!f) return;
  buildForm(f, "kid", "아이 생일");
  const kids = getKids();
  if (kidSel !== "new" && kids[kidSel]) fillForm(f, kids[kidSel]); else { f.year.value = 2015; }
  $$("#tab-compat [data-kid]").forEach((b) => b.addEventListener("click", () => {
    kidSel = b.dataset.kid === "new" ? "new" : +b.dataset.kid; compatMode = "child"; renderCompat();
  }));
  $("#btn-kid-del")?.addEventListener("click", () => { const k = getKids(); k.splice(kidSel, 1); setKids(k); kidSel = 0; renderCompat(); });
  $("#btn-kid").addEventListener("click", runKid);
}
async function runKid() {
  const out = $("#kid-out"), btn = $("#btn-kid"), kid = birthOf($("#form-kid"));
  const kids = getKids();
  if (kidSel === "new" || !kids.length) { kids.push(kid); kidSel = kids.length - 1; } else kids[kidSel] = kid;
  setKids(kids);
  btn.disabled = true; loading(out);
  try {
    const r = await api("/api/family", { parent: S.birth, child: kid }), F = r["이야기"] || {};
    const [pn, cn] = r.names;
    out.innerHTML = `<div class="card tint-mint"><div class="yhead"><span data-nyang="happy" data-size="80"></span><div>
        <div class="theme">${esc(pn)} 👨‍👧 ${esc(cn)}</div><div class="sub">${esc(r["자녀"]["띠"])}띠 · ${esc(r["자녀"]["일주"])}일주 · ${r["자녀"]["나이"]}세</div>
        <div class="kid-type">${esc(F["관계유형"] || "")}</div></div></div></div>
      ${punchCard(esc(F["제목"] || "우리 사이 한 줄 요약"), F["핵심"], "wink", [["📖 자세히 풀이", paras(F["서문"])], ["🐾 마무리", paras(F["맺음"])]])}
      ${oneLiners(F["한줄"], { 찰떡: "💞", 삐걱: "⚡", 비결: "🔑" })}
      ${F["장"]?.length ? `<div class="card tint-mint"><div class="card-head"><h2>👨‍👧 우리 사이 이야기 ${F["장"].length}장</h2><span class="badge">궁금한 장을 콕</span></div>
        <div class="chaps">${F["장"].map((c) => chapter(c)).join("")}</div></div>` : ""}
      <button class="btn primary wide" type="button" id="btn-kid-read" style="margin-bottom:10px">👨‍👧 냥이 도사의 자녀 궁합 대풀이 듣기</button>
      ${S.ai ? `<button class="btn lav wide" type="button" id="btn-kid-ai">💬 아이 일로 냥이에게 상담하기</button>` : ""}`;
    paintNyang(out);
    $("#btn-kid-read").addEventListener("click", () => openReading("child", { partner: kid, title: `${cn}와 나, 자녀 궁합` }));
    $("#btn-kid-ai")?.addEventListener("click", () => { S.chat = { history: [], partner: kid, role: "child", topic: null }; $("#tab-talk").innerHTML = "";
      askNyang(`우리 아이 ${cn}(${r["자녀"]["나이"]}세)와 자꾸 부딪혀. 아이 사주와 내 사주를 보고, 아이를 이해하는 법과 대화법을 알려줘`); });
    $$("#tab-compat .kid-chips button").forEach((b) => b.classList.toggle("on", b.dataset.kid === String(kidSel)));
  } catch (e) { out.innerHTML = `<div class="card"><p class="error">${esc(e.message)}</p></div>`; }
  finally { btn.disabled = false; }
}
async function runCompat() {
  const out = $("#compat-out"), btn = $("#btn-compat"), b = birthOf($("#form-b"));
  localStorage.setItem("nyang:partner", JSON.stringify(b));
  btn.disabled = true; loading(out);
  try {
    const ck = `nyang:cp:${hashStr(JSON.stringify([CORE.map((x) => S.birth?.[x]), b]))}`;
    let r = null; try { r = JSON.parse(localStorage.getItem(ck) || "null"); } catch { r = null; }
    if (!r) { r = await api("/api/compat", { a: S.birth, b }); try { localStorage.setItem(ck, JSON.stringify(r)); } catch { /* 저장 공간 부족 */ } }
    saveViewed({ key: ck, type: "compat", o: { partner: b }, title: `궁합 · ${r.names[0]} 💞 ${r.names[1]}`, icon: "💞", sub: `${r.score}점 ${r.grade}` });
    const mood = r.score >= 85 ? "love" : r.score >= 72 ? "happy" : r.score >= 58 ? "wink" : "think";
    const say = r.score >= 85 ? "와, 이건 2천 년 동안 몇 번 못 본 궁합이다냥!" : r.score >= 72 ? "서로에게 힘이 되는 좋은 궁합이다냥."
      : r.score >= 58 ? "다른 점이 있어서 오히려 배울 게 많은 궁합이다냥." : "부딪히는 곳이 있지만, 알고 맞춰 가면 충분하다냥. 궁합은 '사용 설명서'다냥!";
    const who = (t) => String(t).replace(/([12])번/g, (_, n) => r.names[n - 1]), SC = r["이야기"] || {};
    r.items.forEach((x) => { x["항목"] = who(x["항목"]); x["해석"] = who(x["해석"]); });
    out.innerHTML = `<div class="card tint-pink"><div class="yhead">${ring(r.score, r.grade)}<div>
        <div class="theme">${esc(r.names[0])} 💞 ${esc(r.names[1])}</div><div class="sub">${esc(r["띠"][0])}띠 · ${esc(r["띠"][1])}띠</div></div></div>
        <div class="say" style="margin-top:12px"><span class="who" data-nyang="${mood}" data-size="54"></span><div class="bubble">${say}</div></div>
        <p class="sub" style="margin:6px 0 0">${esc(r.names[0])}: ${T(r["1번"], true)}<br>${esc(r.names[1])}: ${T(r["2번"], true)}</p></div>
      ${SC["핵심"] ? punchCard(esc(SC["제목"] || "두 사람 한 줄 요약"), SC["핵심"], mood, [["📖 자세히 풀이", paras(SC["서문"])]]) : SC["서문"] ? storyCard(esc(SC["제목"] || "두 사람의 이야기"), SC["서문"], mood) : ""}
      ${oneLiners(SC["한줄"], { 찰떡: "💞", 삐걱: "⚡", 비결: "🔑" })}
      ${SC["장"]?.length ? `<div class="card tint-pink"><div class="card-head"><h2>💞 궁합 이야기 ${SC["장"].length}장</h2><span class="badge pink">궁금한 장을 콕</span></div>
        <div class="chaps">${SC["장"].map((c) => chapter(c)).join("")}</div></div>` : ""}
      <div class="card"><h2>항목별 궁합</h2>${r.items.map((x, i) => `<div class="citem"><b>${T(x["항목"], true)}</b>
        <span class="pt ${x["점수"] > 0 ? "pos" : x["점수"] < 0 ? "neg" : ""}">${x["점수"] > 0 ? "+" : ""}${x["점수"]}</span>
        <p class="sub" style="margin:2px 0 0">${T(x["해석"], true)}</p>${SC["항목"]?.[i]?.["한줄"] ? `<p>${esc(SC["항목"][i]["한줄"])}</p>` : ""}
        ${SC["항목"]?.[i]?.["이야기"] ? moreSet([["더 보기", `<p>${esc(SC["항목"][i]["이야기"])}</p>`]]) : ""}</div>`).join("")}
        <p class="sub">${esc(r.note)}</p></div>
      ${SC["핵심"] ? "" : storyCard("오래 가는 비결", SC["맺음"], "happy")}
      <button class="btn primary wide" type="button" id="btn-compat-read" style="margin-bottom:10px">💞 냥이 도사의 궁합 대풀이 듣기</button>
      ${S.ai ? `<button class="btn lav wide" type="button" id="btn-compat-ai">💬 냥이에게 우리 궁합 상담하기</button>` : ""}`;
    paintNyang(out);
    $("#btn-compat-read").addEventListener("click", () => openReading("compat", { partner: b }));
    $("#btn-compat-ai")?.addEventListener("click", () => { S.chat = { history: [], partner: b, topic: null }; $("#tab-talk").innerHTML = ""; askNyang("우리 둘 궁합을 잘 맞는 점, 부딪히는 점, 조언으로 풀어줘"); });
  } catch (e) { out.innerHTML = `<div class="card"><p class="error">${esc(e.message)}</p></div>`; }
  finally { btn.disabled = false; }
}

// ───────────────────────── 상담
const CRISIS = /(죽고\s*싶|죽어\s*버리고|죽고\s*말|죽는\s*게\s*나|죽을\s*래|자살(?!골)|자해|극단\s*적\s*(인\s*)?선택|스스로\s*목숨|목숨을\s*끊|사라지고\s*싶|사라져\s*버리|없어지고\s*싶|없어져\s*버리|살(기|고)\s*(가\s*)?싫|살고\s*싶지\s*않|그만\s*살|더\s*(는\s*)?못\s*살|살\s*이유가?\s*없|사는\s*게\s*(의미|무의미)|뛰어\s*내리|목을?\s*매|(다|삶을|인생을?)\s*끝내|세상을?\s*떠나고|suicid|kill\s*myself|want\s*to\s*die)/i;
const ROUTE = [
  [/썸|짝사랑|고백|좋아하는 사람/, "love", "some"], [/헤어|이별|전남친|전여친|재회/, "love", "breakup"],
  [/인연|언제.*(만나|생겨|연애)|솔로|소개팅/, "love", "when"], [/남친|여친|애인|연인|싸웠|권태/, "love", "dating"], [/이상형|잘 맞는 사람/, "love", "type"],
  [/상사|팀장|부장|동료|직장 사람/, "work", "boss"], [/퇴사|그만두|이직|회사 가기 싫/, "work", "quit"], [/취업|합격|면접|서류/, "work", "job"], [/적성|맞는 일|직업/, "work", "fit"],
  [/투자|주식|코인|부업/, "money", "invest"], [/돈.*(언제|운)|재물운/, "money", "when"], [/돈|저축|월급|빚|카드값/, "money", "save"],
  [/친구|서운|손절/, "people", "friend"], [/엄마|아빠|부모|가족|언니|오빠|동생|누나|형(이|한테|랑|과|이랑)/, "people", "family"], [/사람.*(지쳐|피곤)|인간관계/, "people", "tired"],
  [/시험|자격증|공부.*붙/, "study", "exam"], [/진로|전공|뭘 해야|꿈/, "study", "path"], [/집중|공부가 안/, "study", "focus"],
  [/불안|잠이|불면|우울/, "mind", "anxious"], [/지쳐|피곤|아파|번아웃|힘들어/, "mind", "tired"],
  [/언제 풀|인생.*언제/, "life", "when"], [/안 풀|되는 일이 없/, "life", "why"], [/이야기|옛날/, "life", "story"], [/위로|외로/, "life", "comfort"],
];
function chatEl() { return $("#chat"); }
function addMsg(role, html, mood = "normal") {
  const row = document.createElement("div");
  row.className = `msg ${role === "me" ? "me" : ""}`;
  row.innerHTML = role === "me" ? `<div class="bubble">${html}</div>` : `<span class="who" data-nyang="${mood}" data-size="40"></span><div class="bubble">${html}</div>`;
  chatEl().append(row); paintNyang(row);
  row.scrollIntoView({ behavior: "smooth", block: "end" });
  return row;
}
async function nyangSays(lines, mood = "normal") {
  for (const l of lines) {
    const row = addMsg("nyang", '<span class="typing"></span>', mood);
    await sleep(Math.min(1100, 350 + l.length * 9));
    $(".bubble", row).innerHTML = md(l);
  }
}
function choices(list) {
  const row = document.createElement("div");
  row.className = "worry";
  row.innerHTML = list.map(([label, fn], i) => `<button class="ghost" type="button" data-i="${i}">${esc(label)}</button>`).join("");
  row.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-i]");
    if (!b) return;
    row.remove(); list[+b.dataset.i][1](b.textContent);
  });
  chatEl().append(row);
  row.scrollIntoView({ behavior: "smooth", block: "end" });
}
const topicOf = (id) => S.d["상담"].topics.find((t) => t.id === id);
function topicMenu() {
  choices(S.d["상담"].topics.map((t) => [`${t.icon} ${t.label}`, (lbl) => openTopic(t.id, lbl)]));
}
async function openTopic(id, label) {
  const t = topicOf(id);
  if (label) addMsg("me", esc(label));
  await nyangSays([t.ask], "think");
  choices(t.options.map((o) => [o.label, () => answer(id, o.id, o.label)]));
}
async function answer(tid, oid, label) {
  const t = topicOf(tid), o = t.options.find((x) => x.id === oid);
  if (label) addMsg("me", esc(label));
  await nyangSays(o.answer, oid === "comfort" || oid === "breakup" ? "happy" : "normal");
  const rest = t.options.filter((x) => x.id !== oid).slice(0, 3).map((x) => [x.label, () => answer(tid, x.id, x.label)]);
  choices([...rest, ["🔁 다른 고민 말하기", () => { addMsg("me", "다른 고민도 있어"); nyangSays(["좋다냥, 뭐든 말해 보라냥."]).then(topicMenu); }]]);
}
function startTalk() {
  if (!S.d) return;
  const tab = $("#tab-talk");
  if (tab.dataset.ready === "1" && chatEl()) return;
  tab.dataset.ready = "1";
  tab.innerHTML = `
    <div class="card tint-lav" style="text-align:center"><span class="float" data-nyang="happy" data-size="96" style="display:inline-block"></span>
      <h2 style="margin:6px 0 2px">사주냥이 고민 상담소</h2><p class="sub" style="margin:0">2천 년 동안 인간의 사주를 봐 온 냥이가 네 사주로 답해 준다냥</p></div>
    ${S.chat.partner ? `<p class="ctx-note">${S.chat.role === "child" ? "👨‍👧 아이 사주도 함께 보고 있어요" : "💞 상대방 사주도 함께 보고 있어요"}</p>` : ""}
    <div class="chat" id="chat"></div>
    <form class="composer" id="composer"><input name="q" maxlength="300" placeholder="${S.ai ? "냥이에게 무엇이든 털어놔 봐" : "고민을 적으면 냥이가 알맞은 답을 찾아줘"}" autocomplete="off">
      <button class="btn primary" type="submit">보내기</button></form>
    <p class="fine">${S.ai ? "✨ 자유 상담은 AI 사주냥이가 네 계산 결과만 근거로 답해요 (베타)" : "지금은 고민 주제별 상담이 무료로 열려 있어요. 냥이와의 1:1 자유 대화 상담은 곧 프리미엄으로 열려요 ✨"}</p>`;
  const past = store.get("talklog", null);
  if (past?.html) $("#chat").insertAdjacentHTML("beforebegin", `<details class="past-chat"><summary>💬 지난 상담 다시 보기 <small>${esc(past.at)}</small></summary><div class="chat">${past.html}</div></details>`);
  paintNyang(tab);
  $("#composer").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = e.target.q.value.trim();
    if (q) { e.target.q.value = ""; handleFree(q); }
  });
  nyangSays([S.d["상담"].intro], "happy").then(topicMenu);
}
let talkBusy = false;
async function handleFree(q) {
  if (!S.d || talkBusy) return;
  talkBusy = true;
  try { await handleFreeInner(q); } finally { talkBusy = false; }
}
async function handleFreeInner(q) {
  $$(".worry", chatEl()).forEach((r) => r.remove());
  if (CRISIS.test(q)) {
    addMsg("me", esc(q));
    await nyangSays(["말해 줘서 정말 고마워. 지금 많이 힘들구나… 냥이는 네가 꼭 괜찮았으면 좋겠다냥.",
      "이건 사주보다 사람의 도움이 먼저 필요한 순간이다냥. 지금 바로 **자살예방상담전화 109**(24시간)나 **정신건강위기상담 1577-0199**에 전화해 줄래? 위급하면 **119**.",
      "혼자 버티지 않아도 된다냥. 냥이도 여기 있을게. 🐾"], "think");
    return;
  }
  if (S.ai) return aiSend(q);
  addMsg("me", esc(q));
  const hit = ROUTE.find(([re]) => re.test(q));
  if (hit) { await nyangSays(["냥이가 찰떡같이 알아들었다냥. 네 사주로 보면 말이지…"], "wink"); return answer(hit[1], hit[2]); }
  await nyangSays(["음… 냥이가 정확히 알아듣지 못했다냥. 어떤 쪽 고민인지 골라 줄래?"], "think");
  topicMenu();
}
/** 다른 탭에서 "냥이에게 묻기" */
function askNyang(q) {
  if (!$("#reader").hidden) closeReader();
  showTab("talk");
  if (S.ai) setTimeout(() => handleFree(q), 300);
}

// ───────────────────────── AI 상담(키가 있을 때만)
let aiBusy = false;
async function aiSend(q) {
  if (aiBusy) return;
  aiBusy = true;
  addMsg("me", esc(q));
  S.chat.history.push({ role: "user", content: q });
  const row = addMsg("nyang", '<span class="typing"></span>', "think"), box = $(".bubble", row);
  let text = "", err = "";
  try {
    const r = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birth: S.birth, partner: S.chat.partner, partner_role: S.chat.role || "love", messages: S.chat.history.slice(-28) }) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "냥이가 잠깐 자리를 비웠다냥");
    const reader = r.body.getReader(), dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let k;
      while ((k = buf.indexOf("\n\n")) >= 0) {
        const line = buf.slice(0, k); buf = buf.slice(k + 2);
        if (!line.startsWith("data: ")) continue;
        const ev = JSON.parse(line.slice(6));
        if (ev.t) { text += ev.t; box.innerHTML = md(text, true); }
        if (ev.error) err = ev.error;
      }
    }
  } catch (e) { err = e.message; }
  if (text) S.chat.history.push({ role: "assistant", content: text }); else S.chat.history.pop();
  if (err) box.insertAdjacentHTML("beforeend", `<p class="error">${esc(err)}</p>`);
  aiBusy = false;
}

// ───────────────────────── 시간대·운세 달력
function hoursStrip(h) {
  const now = new Date(Date.now() + 9 * 3600e3).getUTCHours(), cur = Math.floor(((now + 1) % 24) / 2);
  return `<div class="hours" aria-label="시간대별 운">${h["시진"].map((x, i) => {
    const cls = h["좋은시간"].includes(x["시"]) ? "good" : h["조심시간"].includes(x["시"]) ? "bad" : "";
    return `<div class="${cls} ${i === cur ? "now" : ""}" title="${esc(x["시간"])}시 ${esc(x["간지"])} ${esc(x["십성"])} ${x["점수"]}점"><span style="height:${Math.max(8, (x["점수"] - 30) * 1.1)}%"></span>${esc(x["시"][0])}</div>`;
  }).join("")}</div>`;
}
const calCls = (s) => (s >= 75 ? "gg" : s >= 63 ? "g" : s <= 47 ? "b" : "");
function renderCal(days) {
  const first = new Date(days[0].date + "T00:00:00"), pad = (first.getDay() + 6) % 7;
  const cells = days.map((x, i) => {
    const d = +x.date.slice(8), m = +x.date.slice(5, 7);
    return `<button type="button" data-cal="${x.date}" class="${calCls(x["점수"])} ${i === 0 ? "today" : ""} ${x["충"] ? "clash" : ""}">
      ${d === 1 || i === 0 ? `<small>${m}월</small>` : `<small>&nbsp;</small>`}${d}<em>${x["점수"]}</em></button>`;
  }).join("");
  const top = [...days].sort((a, b) => b["점수"] - a["점수"]).slice(0, 5);
  return `<div class="card"><div class="card-head"><h2>📅 앞으로 5주 운세 달력</h2><span class="badge">일진 기준</span></div>
    <div class="cal">${"월화수목금토일".split("").map((w) => `<div class="wd">${w}</div>`).join("")}${'<button class="blank" tabindex="-1"></button>'.repeat(pad)}${cells}</div>
    <div class="legend"><span><i style="background:#bfeedd"></i>대길</span><span><i style="background:var(--mint-l)"></i>좋음</span><span><i style="background:var(--pink-l)"></i>살살</span><span><i style="background:var(--pink-d);border-radius:50%"></i>원국과 충</span></div>
    <p class="sub" style="margin:10px 0 0">날짜를 누르면 그날의 운세를 보고, 냥이 도사에게 자세히 들을 수 있다냥.</p></div>
    <div class="card tint-mint"><h2>🍀 냥이 추천 좋은 날 TOP 5</h2><div class="top-days">${top.map((x) => `<button type="button" data-cal="${x.date}">
      <b>${+x.date.slice(5, 7)}/${+x.date.slice(8)} (${x["요일"]})</b><span>${esc(x["간지"])}일 · ${T(x["십성"], true)}</span><b>${x["점수"]}점</b></button>`).join("")}</div>
      <p class="sub" style="margin:10px 0 0">이사·계약·고백·면접처럼 중요한 일은 순풍 부는 날에 잡으면 마음이 편하다냥.</p></div>`;
}
function openDay(dt) {
  const x = S.d["운세"]["달력"].find((v) => v.date === dt);
  if (!x) return;
  const mood = x["점수"] >= 63 ? "happy" : x["점수"] >= 48 ? "normal" : "think";
  openSheet(`<div class="term-head"><span data-nyang="${mood}" data-size="64"></span><div><h2>${+dt.slice(5, 7)}월 ${+dt.slice(8)}일 (${x["요일"]})</h2>
      <div class="term-mean">${esc(x["간지"])}(${esc(x["한글"])})일 · ${esc(x["십성"])} · ${x["점수"]}점</div></div></div>
    <div class="bubble lav" style="margin-bottom:14px">${T(x["한마디"])}${x["충"] ? "<br>원국과 부딪히는 글자가 들어오니 말과 일정은 여유 있게!" : ""}${x["합"] ? "<br>합이 들어 사람 운이 붙는 날이다냥." : ""}</div>
    <div id="day-story"><div class="loading" style="padding:14px 0"><span data-nyang="think" data-size="48"></span>냥이 도사가 그날을 들여다보는 중…</div></div>
    <button class="btn primary wide" type="button" data-read="day" data-day="${dt}" style="margin-bottom:8px">☀️ AI 냥이 도사에게 더 길게 듣기</button>`);
  api("/api/day", { birth: S.birth, day: dt }).then((j) => {
    const st = j["이야기"], el = $("#day-story");
    if (!el) return;
    el.innerHTML = st ? todayStory(st, "그날의 한마디").replace('class="card story-card"', 'class="story-card sheet-story"') : "";
    paintNyang(el);
  }).catch(() => { const el = $("#day-story"); if (el) el.innerHTML = ""; });
}

// ───────────────────────── 냥이 도사 대풀이 (서술형 AI 풀이)
const READ_MENU = [["life", "hot"], ["day", "hot"], ["tomorrow", ""], ["week", ""], ["month", ""], ["year", "hot"], ["love", ""], ["money", ""],
  ["career", ""], ["health", ""], ["daewoon", ""], ["compat", ""], ["child", ""], ["dream", ""]];
const married = () => S.birth?.marital === "기혼";
function kindInfo(id) {
  if (id === "tomorrow") return { id, title: "내일의 운세", icon: "🌙", desc: "내일 하루를 미리 귀띔" };
  if (id === "love" && married()) return { id, title: "부부운", icon: "💑", desc: "우리 부부 사용 설명서" };
  return S.kinds.find((k) => k.id === id) || { id, title: id, icon: "🐾", desc: "" };
}
function readMenu() {
  if (!S.kinds.length) return "";
  return `<div class="card tint-lav"><div class="card-head"><h2>🐾 냥이 도사 대풀이</h2><span class="badge">${S.ai ? "AI 서술형" : "서술형"}</span></div>
    <p class="sub" style="margin:-4px 0 12px">궁금한 걸 콕 누르면 핵심만 쏙쏙. 한 번 본 풀이는 '내가 본 풀이'에 남아요.</p>
    <div class="rd-menu">${READ_MENU.filter(([id]) => id !== "child" || (S.birth?.kids || 0) > 0).map(([id, hot]) => { const k = kindInfo(id); return `<button type="button" class="${hot}" data-read="${id}"><i>${k.icon}</i>${esc(k.title)}<small>${esc(k.desc)}</small></button>`; }).join("")}</div></div>`;
}
const kstDate = (offset = 0) => new Date(Date.now() + 9 * 3600e3 + offset * 864e5).toISOString().slice(0, 10);
function hashStr(t) { let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) | 0; return (h >>> 0).toString(36); }
function readFrom(id, day) {
  if (id === "tomorrow") return openReading("day", { day: kstDate(1), title: "내일의 운세" });
  if (id === "day") return openReading("day", { day: day || kstDate(0), title: !day || day === kstDate(0) ? "오늘의 운세" : `${+day.slice(5, 7)}월 ${+day.slice(8)}일 운세` });
  if (id === "compat") {
    const p = JSON.parse(localStorage.getItem("nyang:partner") || "null");
    if (p) return openReading("compat", { partner: p });
    showTab("compat"); return;
  }
  if (id === "dream") return openDream();
  if (id === "child") {
    const kids = JSON.parse(localStorage.getItem("nyang:kids") || "[]");
    if (kids.length === 1) return openReading("child", { partner: kids[0], title: `${kids[0].name || "아이"}와 나, 자녀 궁합` });
    compatMode = "child"; renderCompat(); showTab("compat"); return;
  }
  return openReading(id);
}
function openDream() {
  openSheet(`<div class="term-head"><span data-nyang="think" data-size="64"></span><div><h2>💭 꿈해몽</h2><div class="term-mean">간밤의 꿈을 냥이 도사가 풀어 준다냥</div></div></div>
    <textarea class="dream-box" id="dream-text" maxlength="500" placeholder="예) 맑은 물에서 커다란 잉어를 두 손으로 잡았는데 금빛으로 빛났어요"></textarea>
    <button class="btn primary wide" type="button" id="dream-go" style="margin-bottom:8px">냥이 도사에게 꿈 풀이 듣기</button>`);
  $("#dream-go").addEventListener("click", () => {
    const t = $("#dream-text").value.trim();
    if (!t) { $("#dream-text").focus(); return; }
    closeSheet(); openReading("dream", { text: t });
  });
}
function rdCacheKey(kind, o) {
  const scope = { day: o.day, week: kstDate(0), month: kstDate(0).slice(0, 7), year: kstDate(0).slice(0, 7) }[kind] || kstDate(0).slice(0, 4);
  return `nyang:rd2:${hashStr(JSON.stringify(S.birth))}:${kind}:${scope}${o.long ? ":long" : ""}${o.partner ? ":" + hashStr(JSON.stringify(o.partner)) : ""}`;
}
let rdCtl = null;
function closeReader() { rdCtl?.abort(); rdCtl = null; $("#reader").hidden = true; document.body.style.overflow = ""; }
async function openReading(kind, o = {}) {
  const k = kindInfo(kind), title = (o.title || k.title) + (o.long ? " · 길게" : "");
  const R = $("#reader"), body = $("#rd-body");
  if (R.hidden) history.pushState({ reader: 1 }, "");
  R.hidden = false; document.body.style.overflow = "hidden";
  $("#rd-title").textContent = `${k.icon} ${title}`;
  const nm = nim();
  body.innerHTML = `<div class="rd-hero"><span class="float" data-nyang="think" data-size="104"></span>
      <div class="bubble big" id="rd-intro">흠흠… ${esc(nm)}의 <b>${esc(title)}</b>이라.<br>냥이 도사가 ${o.long ? "2천 년 묵은 두루마리를 통째로 펼치는" : "핵심만 쏙쏙 골라내는"} 중이다냥…</div></div>
    <article class="scroll-paper" id="rd-text"><p><span class="typing"></span></p></article>
    ${o.long ? "" : `<button class="btn lav wide" type="button" id="rd-long" hidden style="margin-top:14px">📜 길게 듣기 — 설화·자세한 풀이까지</button>`}
    <div class="rd-actions" id="rd-actions" hidden><button class="ghost" type="button" id="rd-again">🔄 다시 풀이</button>
      <button class="ghost" type="button" id="rd-copy">📋 복사</button><button class="ghost" type="button" id="rd-share">📤 공유</button></div>
    <p class="rd-note" id="rd-note">사주는 정답지가 아니라 지도다냥. 건강·법률·투자 판단은 전문가와 상의해 줘!</p>`;
  paintNyang(body);
  $(".rd-scroll", R).scrollTop = 0;
  const box = $("#rd-text"), key = kind === "dream" ? `${rdCacheKey(kind, o)}:${hashStr(o.text || "")}` : rdCacheKey(kind, o);
  const render = (txt) => { box.innerHTML = md(txt, new Set()); };
  const finish = (txt, note) => {
    if (key) saveViewed({ key, kind, o: { ...o }, title, icon: k.icon, sub: kind === "dream" ? (o.text || "").slice(0, 30) : o.day ? o.day : "" });
    $("#rd-actions").hidden = false;
    const lb = $("#rd-long");
    if (lb) { lb.hidden = false; lb.onclick = () => openReading(kind, { ...o, long: true }); }
    $("#rd-intro").innerHTML = `${esc(nm)}의 <b>${esc(title)}</b>, 냥이 도사가 다 풀었다냥! 🐾`;
    if (note) $("#rd-note").textContent = note;
    $("#rd-again").onclick = () => { if (key) localStorage.removeItem(key); openReading(kind, o); };
    $("#rd-copy").onclick = async () => { try { await navigator.clipboard.writeText(`[사주냥이] ${title}\n\n${txt}`); $("#rd-copy").textContent = "✅ 복사됨"; } catch { /* 무시 */ } };
    $("#rd-share").onclick = async () => {
      const data = { title: `사주냥이 · ${title}`, text: txt.slice(0, 600) + "…", url: location.origin };
      if (navigator.share) { try { await navigator.share(data); } catch { /* 취소 */ } } else $("#rd-copy").click();
    };
  };
  const cached = key && localStorage.getItem(key);
  if (cached) { render(cached); finish(cached, "📂 이 기기에 저장해 둔 풀이를 불러왔다냥. 새로 듣고 싶으면 '다시 풀이'를 눌러 줘."); return; }

  rdCtl?.abort(); rdCtl = new AbortController();
  const ctl = rdCtl;
  let text = "", err = "", fallback = false;
  try {
    const r = await fetch("/api/reading", { method: "POST", headers: { "Content-Type": "application/json" }, signal: ctl.signal,
      body: JSON.stringify({ birth: S.birth, kind, partner: o.partner || null, day: o.day || null, text: o.text || "", long: !!o.long }) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "냥이 도사가 잠깐 자리를 비웠다냥");
    const reader = r.body.getReader(), dec = new TextDecoder();
    let buf = "", last = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (!line.startsWith("data: ")) continue;
        const ev = JSON.parse(line.slice(6));
        if (ev.t) text += ev.t;
        if (ev.error) err = ev.error;
        if (ev.fallback) fallback = true;
      }
      if (Date.now() - last > 120) { render(text + " ▍"); last = Date.now(); }
    }
  } catch (e) { if (e.name === "AbortError") return; err = e.message; }
  if (ctl !== rdCtl) return;
  render(text);
  if (err) box.insertAdjacentHTML("beforeend", `<p class="error">${esc(err)}</p><button class="btn lav wide" type="button" id="rd-retry">다시 불러 보기</button>`);
  $("#rd-retry")?.addEventListener("click", () => openReading(kind, o));
  if (text && !err && key) { try { localStorage.setItem(key, text); } catch { /* 저장 공간 부족 */ } }
  if (text) finish(text, fallback ? "지금은 AI 냥이 도사가 잠들어 있어 기본 풀이로 들려줬다냥." : "");
}

// ───────────────────────── 나의 기록 (이 기기에만 저장) — 출석·오늘 어땠냥·돌아보기·준비하기
const CORE = ["year", "month", "day", "hour", "minute", "gender", "calendar", "leap"];
const meKey = () => hashStr(JSON.stringify(CORE.map((k) => S.birth?.[k])));  // 결혼·자녀를 바꿔도 기록은 그대로
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(`nyang:${k}:${meKey()}`)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`nyang:${k}:${meKey()}`, JSON.stringify(v)); } catch { /* 저장 공간 부족 */ } },
};
const MOODS = [["😣", "별로"], ["🙂", "보통"], ["😆", "좋았음"]];
function markVisit(t) {
  const days = store.get("days", {});
  days[t.date] = { 십성: t["십성"].split("/")[0], 점수: t["점수"], 일진: t["일진"] };
  const keys = Object.keys(days).sort();
  keys.slice(0, Math.max(0, keys.length - 400)).forEach((k) => delete days[k]);
  store.set("days", days);
}
function streak() {
  const days = store.get("days", {});
  let n = 0;
  for (let i = 0; i < 400; i++) { if (days[kstDate(-i)]) n++; else break; }
  return n;
}
function checkinCard() {
  const diary = store.get("diary", {}), days = store.get("days", {});
  const today = kstDate(0), yest = kstDate(-1);
  const n = streak(), week = [...Array(7)].map((_, i) => kstDate(i - 6));
  const target = !diary[yest] && days[yest] && !diary[today] && new Date(Date.now() + 9 * 3600e3).getUTCHours() < 12 ? yest : today;
  const done = diary[target];
  const label = target === today ? "오늘 하루 어땠냥?" : "어제는 어땠냥?";
  const hit = diaryStats().hit;
  return `<div class="checkin"><div class="ck-head"><b>🐾 출석 도장</b><span class="badge pink">${n >= 7 ? "일주일 개근!" : `${n}일 연속`}</span></div>
    <div class="stamps">${week.map((dd) => `<div class="${days[dd] ? "on" : ""} ${dd === today ? "is-today" : ""}"><span>${days[dd] ? (diary[dd] ? MOODS[diary[dd].mood][0] : "🐾") : ""}</span><small>${"일월화수목금토"[new Date(dd + "T00:00:00").getDay()]}</small></div>`).join("")}</div>
    ${bookLine()}${pushLine()}
    <div class="mood-q"><b>${label}</b>${done ? `<span class="sub"> — ${MOODS[done.mood][0]} 기록 완료!${hit != null ? ` · 냥이 적중률 ${hit}%` : ""}</span>` : ""}</div>
    ${done ? "" : `<div class="moods">${MOODS.map(([e, l], i) => `<button type="button" data-mood="${i}" data-day="${target}">${e}<small>${l}</small></button>`).join("")}</div>
      <input class="note-in" id="mood-note" maxlength="80" placeholder="한 줄 메모 (선택) — 예) 회의에서 칭찬받음">`}
    </div>`;
}
function saveMood(i, day) {
  const diary = store.get("diary", {}), days = store.get("days", {});
  diary[day] = { mood: +i, note: ($("#mood-note")?.value || "").trim(), 십성: days[day]?.["십성"] || "", 점수: days[day]?.["점수"] ?? null };
  store.set("diary", diary);
  $("#checkin-slot").innerHTML = checkinCard();
  const say = +i === 2 ? "좋은 날이었구나! 냥이도 꼬리가 살랑살랑 🐾" : +i === 1 ? "무난한 하루도 소중하다냥. 푹 쉬어!" : "고생 많았다냥… 오늘은 따뜻한 거 먹고 일찍 자라냥.";
  $("#checkin-slot .card").insertAdjacentHTML("beforeend", `<div class="say" style="margin-top:10px"><span class="who" data-nyang="${+i === 0 ? "sad" : +i === 2 ? "laugh" : "happy"}" data-size="44"></span><div class="bubble">${say}</div></div>`);
  paintNyang($("#checkin-slot"));
}
function diaryStats() {
  const diary = store.get("diary", {}), arr = Object.entries(diary).map(([d, v]) => ({ d, ...v }));
  const scored = arr.filter((x) => x["점수"] != null);
  // 점수로 기대한 기분(63↑ 좋음, 47↓ 별로, 그 사이 보통)과 실제 기분이 같으면 1, 한 칸 차이면 0.5
  const exp = (sc) => (sc >= 63 ? 2 : sc <= 47 ? 0 : 1);
  const pts = scored.reduce((a, x) => a + (x.mood === exp(x["점수"]) ? 1 : Math.abs(x.mood - exp(x["점수"])) === 1 ? 0.5 : 0), 0);
  const ok = pts;
  const by = {};
  arr.forEach((x) => { if (!x["십성"]) return; (by[x["십성"]] ||= []).push(x.mood); });
  return { arr: arr.sort((a, b) => (a.d < b.d ? 1 : -1)), hit: scored.length >= 3 ? Math.round((ok / scored.length) * 100) : null, by };
}
let wIdx = null;
function wisdomCard(w) {
  if (!w) return "";
  const all = w["전체"] || [w];
  if (wIdx == null) wIdx = w["오늘"] ?? 0;
  const x = all[wIdx % all.length], isToday = wIdx === (w["오늘"] ?? 0);
  const mk = `nyang:wm:${kstDate(0)}:${x.key}`, done = localStorage.getItem(mk) === "1";
  return `<div class="card wisdom" id="wisdom"><div class="card-head"><h2>📖 ${isToday ? "오늘의" : "한 줄 더!"} 냥이 고전 한 줄</h2><span class="badge">${esc(x["출전"].split(" · ")[0])}</span></div>
    <div class="w-title">${esc(x["제목"])}</div>
    <div class="w-now">“${esc(x["요즘말"])}”</div>
    <div class="say"><span class="who" data-nyang="wink" data-size="46"></span><div class="bubble">${esc(x["풀이"])}${x["나에게"] ? `<br><b class="w-me">🐾 ${esc(x["나에게"])}</b>` : ""}</div></div>
    <button type="button" class="w-mission ${done ? "done" : ""}" data-wm="${mk}">${done ? "✅" : "⬜"} 오늘의 미션: ${esc(x["미션"])}</button>
    ${moreSet([["📜 원문 보기", `<div class="orig">${esc(x["원문"])}</div><div class="src">— ${esc(x["출전"])}</div><p class="mean">${esc(x["뜻"])}</p>`]])}
    ${all.length > 1 ? `<button type="button" class="ghost wide w-next" data-wnext style="margin-top:10px">🔄 다른 구절 보여줘냥</button>` : ""}</div>`;
}
function pathTeaser() {
  const past = store.get("past", {}), n = Object.keys(past).length;
  return `<div class="card tint-mint path-teaser"><h2>🧭 나의 길</h2>
    <p>사주는 과거를 돌아보고 미래를 준비하는 거울이다냥. ${n ? `지난 해 기록 <b>${n}개</b>가 쌓였어. 패턴이 보이기 시작한다냥!` : "기억나는 해에 무슨 일이 있었는지 남기면, 냥이가 네 운의 패턴을 찾아 준다냥."}</p>
    <div class="rd-cta"><button class="btn lav" type="button" data-go="path:past">🪞 지난 해 돌아보기</button><button class="btn lav" type="button" data-go="path:future">🌱 앞으로 준비하기</button></div></div>`;
}

// ───────────────────────── 출석 보상: 냥이의 2천 년 일기장 · 칭호
const BOOK_AT = [1, 3, 5, 7, 10, 14, 21, 30];
const TITLES = [[100, "👑", "냥이 수호자"], [60, "🌙", "명리 도반"], [30, "🏮", "2천 년 일기장 지기"], [21, "📜", "냥이 제자"],
  [14, "🧶", "꾹꾹이 동지"], [7, "🐾", "냥이 친구"], [3, "🍵", "단골 손님"], [0, "🐣", "처음 온 손님"]];
const visits = () => Object.keys(store.get("days", {})).length;
function myTitle(n = visits()) {
  const t = TITLES.find(([k]) => n >= k), nx = [...TITLES].reverse().find(([k]) => k > n);
  return { e: t[1], name: t[2], next: nx };
}
function bookState() {
  const n = visits(), total = Math.min((S.stories || []).length, BOOK_AT.length);
  const open = BOOK_AT.slice(0, total).filter((k) => n >= k).length, nextAt = BOOK_AT.slice(0, total).find((k) => k > n);
  return { n, open, total, nextAt, left: nextAt ? nextAt - n : 0 };
}
function bookLine() {
  if (!S.stories?.length) return "";
  const b = bookState(), t = myTitle(b.n), fresh = b.open > store.get("bookSeen", 0);
  return `<button type="button" class="book-line ${fresh ? "fresh" : ""}" data-book>
    <span>📖 냥이의 2천 년 일기장 <b>${b.open}/${b.total}</b>${fresh ? ' <i class="new">새 이야기!</i>' : ""}</span>
    <small>칭호 ${t.e} ${esc(t.name)} · 누적 출석 ${b.n}일${b.nextAt ? ` · 다음 이야기까지 ${b.left}일` : " · 이야기를 전부 모았다냥!"}</small></button>`;
}
function openBook() {
  const b = bookState(), t = myTitle(b.n), all = S.stories.slice(0, b.total);
  store.set("bookSeen", b.open);
  openSheet(`<div class="term-head"><span data-nyang="love" data-size="64"></span><div><h2>냥이의 2천 년 일기장</h2>
    <div class="term-mean">들를 때마다 냥이가 옛 손님 이야기를 하나씩 꺼내 준다냥</div></div></div>
    <div class="book-title">${t.e} 지금 칭호 <b>${esc(t.name)}</b> · 누적 출석 ${b.n}일${t.next ? `<br><small>${t.next[0] - b.n}일 더 오면 ${t.next[1]} ${esc(t.next[2])}</small>` : ""}</div>
    <div class="book-list">${all.map((s, i) => (b.n >= BOOK_AT[i]
    ? `<details class="book-item"${i === b.open - 1 ? " open" : ""}><summary><b>${i + 1}. 『${esc(s["제목"])}』</b> <span class="sub">${esc(s["시대"])}</span></summary>
        <p>${esc(s["이야기"])}</p><div class="lesson">🐾 ${esc(s["교훈"])} <span class="sub">— ${T(s["개념"], true)}</span></div></details>`
    : `<div class="book-item locked"><b>${i + 1}. 🔒 아직 잠긴 이야기</b> <span class="sub">출석 ${BOOK_AT[i]}일째에 열린다냥 (${BOOK_AT[i] - b.n}일 남음)</span></div>`)).join("")}</div>
    <button type="button" class="btn lav wide" data-dex style="margin-top:12px">👘 표정·옷 도감 보기 (${dexCount().got}/${dexCount().all})</button>
    <p class="sub" style="margin-top:10px;text-align:center">출석은 하루 한 번, 이 기기에 기록돼요. 기기를 바꿀 땐 🔐 기록 백업으로 옮겨 오세요.</p>`);
  const slot = $("#checkin-slot"); if (slot) slot.innerHTML = checkinCard();
}

// ───────────────────────── 택일 도우미
const TAEGIL = [["move", "🏠", "이사·입주"], ["contract", "✍️", "계약·서명"], ["interview", "💼", "면접·발표"], ["exam", "📚", "시험·자격증"],
  ["date", "💗", "데이트·고백"], ["start", "🚀", "새 일 시작"]];
let tgSeq = 0;
async function openTaegil(p = "move") {
  const my = ++tgSeq;
  openSheet(`<h2 style="margin:0 0 4px">📆 냥이 택일 도우미</h2><p class="sub" style="margin:0 0 10px">앞으로 60일 중에서 ${esc(nim())}에게 맞는 날을 골라 준다냥</p>
    <div class="tg-chips">${TAEGIL.map(([k, e, l]) => `<button type="button" class="${k === p ? "on" : ""}" data-tgl="${k}">${e} ${l}</button>`).join("")}</div>
    <div id="tg-box"><p class="sub" style="text-align:center;padding:24px 0">냥이가 달력을 넘기는 중… 📅</p></div>`);
  $$("[data-tgl]").forEach((b) => b.addEventListener("click", () => openTaegil(b.dataset.tgl)));
  try {
    const tk = `nyang:tg:${meKey()}:${p}:${kstDate(0)}`;
    let r = null; try { r = JSON.parse(localStorage.getItem(tk) || "null"); } catch { r = null; }
    if (!r) { r = await api("/api/taegil", { birth: S.birth, purpose: p }); try { localStorage.setItem(tk, JSON.stringify(r)); } catch { /* */ } }
    saveViewed({ key: tk, type: "taegil", o: { purpose: p }, title: `택일 · ${r["이름"]}`, icon: r["이모지"], sub: r["기간"] });
    if (my !== tgSeq || !$("#tg-box")) return;
    $("#tg-box").innerHTML = taegilBody(r);
  } catch (e) { if (my === tgSeq && $("#tg-box")) $("#tg-box").innerHTML = `<p class="error">${esc(e.message)}</p>`; }
}
function taegilBody(r) {
  const fmt = (x) => { const [, m, d] = x.date.split("-"); return `${+m}월 ${+d}일 (${x["요일"]})`; };
  return `<div class="bubble lav" style="margin:4px 0 12px">${esc(r["이모지"])} ${esc(r["이름"])}: ${esc(r["기준"])}</div>
    <h3 class="tg-h">✨ 냥이가 고른 날</h3>
    ${r["추천"].map((x) => `<div class="tg-day"><div class="tg-d"><b>${fmt(x)}</b><span class="sub">${esc(x["일진"])}일 · ${T(x["십성"], true)}</span><span class="badge pink">${x["점수"]}점</span></div>
      <div class="tg-why">${x["이유"].length ? x["이유"].map(esc).join(" · ") : "마찰 없이 순하게 흐르는 날"}</div><div class="sub">🐾 ${esc(x["한마디"])}</div></div>`).join("")}
    ${r["피할날"].length ? `<h3 class="tg-h">🙅 큰일은 살짝 피하면 좋은 날</h3><p class="sub" style="margin:0 0 8px">${r["피할날"].map((x) => `${fmt(x)} — ${x["주의"].map(esc).join(", ")}`).join("<br>")}</p>` : ""}
    <p class="sub" style="text-align:center">${esc(r["안내"])}<br>기간 ${esc(r["기간"])}</p>`;
}

// ───────────────────────── 기록 백업(복구 코드) — 이 기기에서 코드로 잠근 뒤 보내므로 서버는 내용을 읽을 수 없다
const B32 = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => [...crypto.getRandomValues(new Uint8Array(12))].map((x) => B32[x % 32]).join("").match(/.{4}/g).join("-");
const normCode = (c) => { const s = String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); return s.length === 12 && [...s].every((ch) => B32.includes(ch)) ? s.match(/.{4}/g).join("-") : null; };
const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function codeKeys(code) {
  const enc = new TextEncoder(), raw = enc.encode(code.replace(/-/g, ""));
  const idb = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode("nyang-id:" + code.replace(/-/g, ""))));
  const id = [...idb.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const base = await crypto.subtle.importKey("raw", raw, "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: enc.encode("sajunyang-backup-v1"), iterations: 150000, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  return { id, key };
}
const SKIP_KEYS = ["nyang:backupCode", "nyang:backupAt"];
function collectLocal() {
  const o = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith("nyang:") && !SKIP_KEYS.includes(k)) o[k] = localStorage.getItem(k); }
  return o;
}
async function doBackup() {
  const code = localStorage.getItem("nyang:backupCode") || newCode();
  const { id, key } = await codeKeys(code), iv = crypto.getRandomValues(new Uint8Array(12));
  const body = new TextEncoder().encode(JSON.stringify({ v: 1, at: new Date().toISOString(), data: collectLocal() }));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, body));
  await api("/api/backup", { id, iv: b64(iv), ct: b64(ct) });
  localStorage.setItem("nyang:backupCode", code); localStorage.setItem("nyang:backupAt", kstDate(0));
  return code;
}
async function doRestore(code) {
  const { id, key } = await codeKeys(code);
  const r = await api(`/api/backup/${id}`);
  let j;
  try { j = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(r.iv) }, key, unb64(r.ct)))); }
  catch { throw new Error("코드가 맞지 않는 것 같다냥. 다시 확인해 줘"); }
  Object.entries(j.data || {}).forEach(([k, v]) => { if (k.startsWith("nyang:") && typeof v === "string") localStorage.setItem(k, v); });
  localStorage.setItem("nyang:backupCode", code); localStorage.setItem("nyang:backupAt", kstDate(0));
  return j;
}
function autoBackup() {  // 백업을 켠 사람만, 하루 한 번 조용히 최신으로
  if (!S.share || !localStorage.getItem("nyang:backupCode") || localStorage.getItem("nyang:backupAt") === kstDate(0)) return;
  doBackup().catch(() => {});
}
function openBackup() {
  const code = localStorage.getItem("nyang:backupCode");
  if (!S.share) { openSheet(`<h2>🔐 기록 백업</h2><p class="sub">백업 저장소를 준비 중이다냥. 조금만 기다려 줘!</p>`); return; }
  openSheet(`<h2 style="margin:0 0 6px">🔐 기록 백업 · 복구 코드</h2>
    <p class="sub" style="margin:0 0 10px">폰을 바꾸거나 브라우저 기록을 지워도 출석·운세 일기·지난 해 기록·입명 노트를 되찾을 수 있다냥.</p>
    ${code ? `<div class="bk-code"><small>나의 복구 코드</small><b id="bk-code">${esc(code)}</b>
        <div class="rd-cta"><button class="btn lav" type="button" id="bk-copy">📋 코드 복사</button><button class="btn primary" type="button" id="bk-now">🔄 지금 최신으로</button></div>
        <small>마지막 백업 ${esc(localStorage.getItem("nyang:backupAt") || "-")} · 들를 때마다 하루 한 번 자동으로 최신화돼요</small></div>
        <button class="ghost wide" type="button" id="bk-del" style="margin-top:8px">🗑 서버에서 백업 지우기</button>`
    : `<button class="btn primary wide" type="button" id="bk-now">🔐 백업 켜고 복구 코드 받기</button>`}
    <div class="bk-note">🔒 기록은 이 기기에서 <b>복구 코드로 잠근 뒤</b> 보내져서, 서버(사주냥이)도 내용을 읽을 수 없어요.
      그래서 <b>코드를 잃어버리면 아무도 되살릴 수 없어요</b> — 캡처나 메모로 꼭 남겨 두세요. 마지막 백업 후 400일이 지나면 지워져요.
      <a href="/privacy.html" target="_blank">개인정보 처리방침</a></div>
    <hr class="bk-hr"><h3 style="margin:0 0 6px">📦 다른 기기의 기록 불러오기</h3>
    <div class="bk-restore"><input id="bk-in" placeholder="XXXX-XXXX-XXXX" maxlength="16" autocomplete="off" autocapitalize="characters">
      <button class="btn lav" type="button" id="bk-load">불러오기</button></div>
    <p class="sub" id="bk-msg" style="margin:8px 0 0"></p>`);
  const msg = (t) => { $("#bk-msg").textContent = t; };
  $("#bk-now")?.addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    try { await doBackup(); openBackup(); $("#bk-msg").textContent = "백업 완료! 코드를 꼭 따로 남겨 두라냥 🐾"; }
    catch (err) { msg(err.message); e.currentTarget.disabled = false; }
  });
  $("#bk-copy")?.addEventListener("click", async () => { try { await navigator.clipboard.writeText(code); msg("복사했다냥! 메모장이나 캡처로 보관해 줘"); } catch { msg(code); } });
  $("#bk-del")?.addEventListener("click", async () => {
    if (!confirm("서버의 백업을 지울까? 이 기기의 기록은 그대로 남아요.")) return;
    try { const { id } = await codeKeys(code); await fetch(`/api/backup/${id}`, { method: "DELETE" });
      localStorage.removeItem("nyang:backupCode"); localStorage.removeItem("nyang:backupAt"); openBackup(); $("#bk-msg").textContent = "서버의 백업을 지웠다냥."; }
    catch (err) { msg(err.message); }
  });
  $("#bk-load").addEventListener("click", () => restoreFlow($("#bk-in").value, msg));
}
async function restoreFlow(raw, msg) {
  const c = normCode(raw);
  if (!c) { msg("코드는 영문·숫자 12자리(XXXX-XXXX-XXXX)다냥"); return; }
  if (!confirm("불러온 기록으로 이 기기의 같은 기록을 덮어쓸까?")) return;
  msg("냥이가 기록을 꺼내는 중…");
  try { const j = await doRestore(c); msg(`불러왔다냥! (${String(j.at || "").slice(0, 10)} 백업) 잠깐 뒤 새로고침할게`); setTimeout(() => location.reload(), 900); }
  catch (err) { msg(err.message); }
}


// ───────────────────────── 아침 운세 알림(웹 푸시) — 생일 대신 일간·용신만 보낸다
const pushOk = () => !!(S.pushKey && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window);
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone;
function pushLine() {
  if (!S.pushKey) return "";
  const on = localStorage.getItem("nyang:push") === "1";
  if (!pushOk()) return isIOS() && !standalone() ? `<p class="sub push-hint">🔔 아이폰은 '홈 화면에 추가'한 뒤 열면 아침 7시 운세 알림을 받을 수 있다냥</p>` : "";
  return `<button type="button" class="push-line ${on ? "on" : ""}" data-push>${on ? "🔔 아침 7시 운세 알림 받는 중 · 끄기" : "🔔 매일 아침 7시, 오늘 운세 알림 받기"}</button>`;
}
const u8key = (b) => { const p = "=".repeat((4 - (b.length % 4)) % 4); return Uint8Array.from(atob((b + p).replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)); };
async function togglePush(btn) {
  btn.disabled = true;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (localStorage.getItem("nyang:push") === "1") {
      if (sub) { await api("/api/push/off", { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe().catch(() => {}); }
      localStorage.removeItem("nyang:push");
    } else {
      if (await Notification.requestPermission() !== "granted") { alert("알림이 꺼져 있다냥. 브라우저 설정에서 사주냥이 알림을 허용해 줘!"); return; }
      sub ||= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8key(S.pushKey) });
      const y = S.d["용신"], STEMS = "甲乙丙丁戊己庚辛壬癸";
      await api("/api/push", { sub: sub.toJSON(), ilgan: STEMS.indexOf(S.d["원국"]["일주"]["천간"]["글자"]), yong: [y["용신"], y["희신"]].filter(Boolean).slice(0, 2) });
      localStorage.setItem("nyang:push", "1");
    }
  } catch (e) { alert(e.message || "알림 설정에 실패했다냥. 잠시 후 다시 해 줘"); }
  finally { const slot = $("#checkin-slot"); if (slot) slot.innerHTML = checkinCard(); }
}

// ───────────────────────── 냥이 도감: 표정·옷 수집(누적 출석으로 열림), 옷 갈아입히기, 쓰다듬기
const MOOD_AT = { normal: 0, happy: 0, think: 0, wow: 0, wink: 0, sad: 0, love: 2, sleepy: 3, focus: 4, proud: 5, shy: 7, cheer: 10, laugh: 14 };
const OUTFIT_AT = { gat: 0, flower: 3, moon: 7, winter: 14, newyear: 21, king: 30 };
const OUTFIT_SAY = {
  gat: "2천 년째 쓰는 내 갓이다냥. 낡았어도 이게 제일 편해.", flower: "봄 들판에서 직접 엮은 화관이다냥. 3일 출석 기념!",
  moon: "보름달 뜨는 밤에만 꺼내 입는 도사복이다냥.", winter: "한양 겨울은 매서웠다냥… 그래서 남바위는 필수!",
  newyear: "설날 아침엔 색동이지! 세배는 받는 쪽이 좋다냥.", king: "30일이나 와 줬다냥? 오늘만은 냥이가 임금님이다냥 👑",
};
const unlockedMoods = (n = visits()) => Object.keys(MOOD_AT).filter((k) => n >= MOOD_AT[k]);
const outfitOk = (o, n = visits()) => n >= (OUTFIT_AT[o] ?? 99);
function applyOutfit() {
  const o = store.get("outfit", "gat");
  window.nyangOutfit = outfitOk(o) ? o : "gat";
}
function dexCount() {
  const n = visits();
  return { got: unlockedMoods(n).length + Object.keys(OUTFIT_AT).filter((o) => outfitOk(o, n)).length,
    all: Object.keys(MOOD_AT).length + Object.keys(OUTFIT_AT).length };
}
function openDex() {
  const n = visits(), cur = window.nyangOutfit || "gat", c = dexCount();
  openSheet(`<div class="term-head"><span data-nyang="proud" data-size="64"></span><div><h2>냥이 도감 <small class="sub">${c.got}/${c.all}</small></h2>
      <div class="term-mean">들를수록 냥이의 표정과 옷이 하나씩 늘어난다냥 · 누적 출석 ${n}일</div></div></div>
    <h3 class="dex-h">👘 옷장 <span class="sub">— 눌러서 갈아입히기</span></h3>
    <div class="dex-grid outfits">${Object.entries(window.NYANG_OUTFITS).map(([k, v]) => outfitOk(k, n)
      ? `<button type="button" class="dex-tile ${k === cur ? "on" : ""}" data-wear="${k}"><span data-nyang="happy" data-size="74" data-outfit="${k}"></span><b>${esc(v.name)}</b>${k === cur ? "<small>입는 중</small>" : ""}</button>`
      : `<div class="dex-tile locked"><span class="lock-sil">${nyang("normal", 74, k)}</span><b>🔒 ${esc(v.name)}</b><small>출석 ${OUTFIT_AT[k]}일째</small></div>`).join("")}</div>
    <h3 class="dex-h">😺 표정 모음</h3>
    <div class="dex-grid moods">${Object.entries(window.NYANG_MOODS).map(([k, v]) => n >= MOOD_AT[k]
      ? `<div class="dex-tile mini"><span data-nyang="${k}" data-size="56"></span><b>${esc(v)}</b></div>`
      : `<div class="dex-tile mini locked"><span class="q">?</span><b>${MOOD_AT[k]}일째</b></div>`).join("")}</div>
    <p class="sub" style="text-align:center;margin:12px 0 0">홈의 냥이를 톡 건드리면 모은 표정 중 하나로 반응한다냥 🐾</p>`);
  $$("#sheet-content [data-wear]").forEach((b) => b.addEventListener("click", () => {
    store.set("outfit", b.dataset.wear); applyOutfit();
    paintNyang(document); openDex();
    const say = OUTFIT_SAY[b.dataset.wear];
    if (say) $("#sheet-content .term-mean").textContent = say;
  }));
}
// 쓰다듬기: 홈·상담·리빌의 냥이를 톡 → 모은 표정 중 하나 + 한마디
const PATS = ["냥?", "꾹꾹…", "간지럽다냥!", "2천 년 살아도 이건 좋다냥", "오늘도 와 줘서 고맙다냥", "갓은 만지지 마라냥!", "골골골…", "츄르는 없냥?"];
document.addEventListener("click", (e) => {
  const el = e.target.closest(".greet [data-nyang], .hero-cat[data-nyang], .rv-card [data-nyang], .float[data-nyang]");
  if (!el || el.closest("button")) return;
  const pool = unlockedMoods().filter((m) => m !== el.dataset.nyang);
  const orig = el.dataset.nyangOrig || el.dataset.nyang;
  el.dataset.nyangOrig = orig;
  el.dataset.nyang = pool[Math.floor(Math.random() * pool.length)] || "happy";
  paintNyang(el.parentElement);
  el.classList.remove("boing"); void el.offsetWidth; el.classList.add("boing");
  el.querySelector(".ny-pop")?.remove();
  el.insertAdjacentHTML("beforeend", `<span class="ny-pop">${PATS[Math.floor(Math.random() * PATS.length)]}</span>`);
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.dataset.nyang = orig; paintNyang(el.parentElement); }, 1800);
});
// 냥이 월령 한 수(토정비결처럼 두 줄로 읽는 그달의 노래)
function verseHtml(v, compact = false) {
  if (!v) return "";
  return `<div class="verse ${compact ? "compact" : ""}"><span class="v-season">${esc(v["계절"])}</span>
    <span class="v-line">${esc(v["구절"][0])}</span><span class="v-line">${esc(v["구절"][1])}</span>
    ${compact ? "" : `<span class="v-why">🐾 ${esc(v["풀이"])}</span>`}</div>`;
}

// ═════════════════════════ 4단계: 기록 보관 · 오늘의 패 · 오행 정원 · 절기 시즌 · 냥이 카드 · 귀인 퀘스트
const nim = () => (S.d?.["이름"] ? `${S.d["이름"]}님` : "너");
const EL5 = ["목", "화", "토", "금", "수"];
const EL_HANJA = { 목: "木", 화: "火", 토: "土", 금: "金", 수: "水" };
const EL_FLOWER = { 목: "🌳", 화: "🌺", 토: "🌻", 금: "🌼", 수: "🪷" };
const toast = (msg) => {
  let t = $("#toast");
  if (!t) { document.body.insertAdjacentHTML("beforeend", '<div id="toast" class="toast" role="status"></div>'); t = $("#toast"); }
  t.textContent = msg; t.classList.remove("on"); void t.offsetWidth; t.classList.add("on");
};

// ───────── 내가 본 풀이 보관함: 한 번 본 대풀이·궁합·택일은 이 기기에 남겨 두고 다시 열 때 그대로 불러온다
function saveViewed(entry) {
  const list = store.get("saved", []).filter((x) => x.key !== entry.key);
  list.unshift({ ...entry, at: new Date().toISOString() });
  store.set("saved", list.slice(0, 80));
}
function openSaved() {
  const list = store.get("saved", []);
  const fmt = (iso) => { const d = new Date(iso); return `${d.getMonth() + 1}월 ${d.getDate()}일`; };
  openSheet(`<div class="sheet-title"><span data-nyang="focus" data-size="56"></span><div><h2>내가 본 풀이</h2>
      <p class="sub">한 번 본 풀이는 이 기기에 남아 있어서, 다시 눌러도 기다리지 않고 바로 열린다냥.</p></div></div>
    ${list.length ? `<div class="saved-list">${list.map((x, i) => `<button type="button" class="saved-row" data-srow="${i}">
        <span class="ic">${esc(x.icon || "📜")}</span><span class="tx"><b>${esc(x.title)}</b><small>${esc(x.sub || "")}</small></span><span class="dt">${fmt(x.at)}</span></button>`).join("")}</div>
      <button class="ghost wide" type="button" id="saved-clear" style="margin-top:12px">보관함 비우기</button>`
    : `<p class="empty">아직 본 풀이가 없다냥. 홈의 '냥이 도사 대풀이'부터 열어 봐!</p>`}`);
  $$("#sheet-content [data-srow]").forEach((b) => b.addEventListener("click", () => {
    const x = list[+b.dataset.srow]; closeSheet();
    if (x.type === "compat") { showTab("compat"); fillForm($("#form-b"), x.o.partner); runCompat(); return; }
    if (x.type === "taegil") { openTaegil(x.o.purpose); return; }
    openReading(x.kind, x.o || {});
  }));
  $("#saved-clear")?.addEventListener("click", () => {
    if (!confirm("보관함 목록과 저장된 풀이를 지울까? (사주 기록·일기는 그대로)")) return;
    list.forEach((x) => { if (x.key) try { localStorage.removeItem(x.key); } catch { /* */ } });
    store.set("saved", []); openSaved();
  });
}
// 상담 대화도 남겨 두기(최근 대화 한 묶음)
function saveTalk() {
  const c = $("#chat");
  if (!c || !c.querySelector(".msg.me")) return;
  store.set("talklog", { at: kstDate(0), html: c.innerHTML.slice(-60000) });
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") saveTalk(); });

// ───────── 오늘의 패 한 장(다시 뽑기 없음)
function paeTile() {
  const p = S.d["오늘의패"]; if (!p) return "";
  const open = store.get("pae", "") === p["날짜"];
  return `<button type="button" class="pae ${open ? "open" : ""}" data-pae aria-label="오늘의 패">
    <span class="pae-in"><span class="pae-back"><i>🐾</i><b>오늘의 패</b><small>톡 눌러 뒤집기</small></span>
      <span class="pae-front"><i>${esc(p["이모지"])}</i><b>${esc(p["이름"])}</b><small>${esc(p["십성"])}의 날</small></span></span></button>`;
}
function openPae() {
  const p = S.d["오늘의패"], first = store.get("pae", "") !== p["날짜"];
  store.set("pae", p["날짜"]);
  $("[data-pae]")?.classList.add("open");
  setTimeout(() => {
    openSheet(`<div class="pae-sheet"><div class="pae-big"><i>${esc(p["이모지"])}</i><b>${esc(p["이름"])}</b><small>${esc(p["십성"])}의 날 · ${+p["날짜"].slice(5, 7)}월 ${+p["날짜"].slice(8)}일</small></div>
      <p class="pae-msg">${esc(p["말"])}</p><div class="pae-act"><small>오늘 한 가지</small><b>${esc(p["행동"])}</b></div>
      <p class="sub" style="text-align:center;margin:12px 0 0">패는 하루에 한 장이다냥. 같은 패를 다시 뽑지 않는 게 냥이의 약속이야 🐾</p></div>`);
    if (first) gardenAdd(S.d["용신"]["용신"], 0, "패를 뒤집었다냥");
  }, first ? 420 : 0);
}

// ───────── 오행 정원: 용신 화분에 물을 주며 운을 키운다
const gardenState = () => ({ 목: 0, 화: 0, 토: 0, 금: 0, 수: 0, water: "", bonus: "", ...store.get("garden", {}) });
const stageOf = (n, el) => (n < 1 ? "🌰" : n < 4 ? "🌱" : n < 9 ? "🌿" : n < 16 ? EL_FLOWER[el] : EL_FLOWER[el] + "✨");
const stageName = (n) => (n < 1 ? "씨앗" : n < 4 ? "새싹" : n < 9 ? "잎" : n < 16 ? "꽃" : "만개");
function roleOf(el) {
  const y = S.d["용신"];
  return el === y["용신"] ? "용신" : el === y["희신"] ? "희신" : el === y["기신"] ? "기신" : el === y["구신"] ? "구신" : "한신";
}
function gardenAdd(el, n, why) {
  const g = gardenState(); g[el] = (g[el] || 0) + n; store.set("garden", g);
  const slot = $("#garden-slot"); if (slot) slot.innerHTML = gardenMini();
  if (n && why) toast(`${why} · ${el}(${EL_HANJA[el]}) 화분 +${n} ${stageOf(g[el], el)}`);
}
function gardenMini() {
  const g = gardenState(), watered = g.water === kstDate(0);
  return `<button type="button" class="garden-mini" data-garden aria-label="오행 정원 열기">
    <span class="gm-pots">${EL5.map((el) => `<span class="gm-pot r-${roleOf(el)}"><i>${stageOf(g[el], el)}</i><small>${el}</small></span>`).join("")}</span>
    <span class="gm-t"><b>🌱 오행 정원</b><small>${watered ? "오늘 물 주기 완료 ✓" : `오늘의 물 한 번 · 보약 ${S.d["용신"]["용신"]} 화분부터!`}</small></span></button>`;
}
function openGarden() {
  const g = gardenState(), y = S.d["용신"], watered = g.water === kstDate(0);
  const say = { 용신: "제일 필요한 보약 기운이다냥. 물 +2", 희신: "보약을 돕는 기운이다냥. 물 +1", 한신: "있어도 없어도 괜찮은 기운. 물 +1",
    구신: "부담 기운을 돕는 쪽이라 물이 잘 안 먹힌다냥. 물 +0", 기신: "이미 넘치는 기운이라 물을 주면 넘친다냥. 물 +0" };
  const gain = { 용신: 2, 희신: 1, 한신: 1, 구신: 0, 기신: 0 };
  openSheet(`<div class="sheet-title"><span data-nyang="happy" data-size="56"></span><div><h2>오행 정원</h2>
      <p class="sub">모자란 기운을 채우면 운이 산다냥. 하루 한 번 물을 주고, 개운 미션을 하면 보약 화분이 한 번 더 자란다냥.</p></div></div>
    <div class="garden">${EL5.map((el) => { const r = roleOf(el); return `<button type="button" class="pot r-${r}" data-water="${el}" ${watered ? "disabled" : ""}>
        <span class="plant">${stageOf(g[el], el)}</span><span class="clay"></span>
        <b>${el}(${EL_HANJA[el]})</b><small>${r === "용신" ? "⭐ 보약" : r}</small><em>${stageName(g[el])} · ${g[el]}</em></button>`; }).join("")}</div>
    <p class="garden-note">${watered ? "오늘은 물을 다 줬다냥. 내일 또 와 줘 🐾" : "어느 화분에 물을 줄까? 화분을 톡 눌러 줘."}</p>
    <ul class="tips">${EL5.map((el) => `<li><b>${el}</b> · ${roleOf(el)} — ${say[roleOf(el)]}</li>`).join("")}</ul>
    <p class="sub">이 정원은 ${nim()}의 용신(${y["용신"]})·희신(${y["희신"] || "-"})에 맞춰 자란다냥. 보약 화분이 가장 크면 균형이 잘 잡힌 거야.</p>`);
  $$("#sheet-content [data-water]").forEach((b) => b.addEventListener("click", () => {
    const el = b.dataset.water, n = gain[roleOf(el)];
    const gg = gardenState(); gg.water = kstDate(0); store.set("garden", gg);
    gardenAdd(el, n, n ? "물을 줬다냥" : null);
    if (!n) toast(`${el} 화분은 이미 넘친다냥… 보약 화분에 주는 게 좋아!`);
    openGarden();
  }));
}

// ───────── 절기 시즌
function seasonMark() {
  const s = S.d["절기"]; if (!s) return;
  const got = store.get("seasons", {}); if (!got[s["키"]]) { got[s["키"]] = s["이름"]; store.set("seasons", got); }
}
function seasonBanner() {
  const s = S.d["절기"]; if (!s) return "";
  const n = new Set(Object.values(store.get("seasons", {}))).size;
  return `<button type="button" class="season" data-season><span class="se-ic">${esc(s["이모지"])}</span>
    <span class="se-t"><small>지금은 ${esc(s["이름"])} 시즌 · 절기 도장 ${n}/24</small><b>냥이의 ${esc(s["이름"])} 일기 열기</b></span>
    <span class="se-d">${esc(s["다음이모지"])} ${esc(s["다음"])}<br><small>D-${s["남은날"]}</small></span></button>`;
}
async function openSeason() {
  const s = S.d["절기"], got = new Set(Object.values(store.get("seasons", {})));
  let all = S.terms;
  if (!all) { try { all = S.terms = (await api("/api/terms"))["절기"]; } catch { all = []; } }
  openSheet(`<div class="season-sheet"><div class="se-head"><span data-nyang="${s["이름"] === "동지" || s["이름"].includes("설") || s["이름"].includes("한") ? "sleepy" : "happy"}" data-size="70"></span>
      <div><small>${s["번호"]}번째 절기 · ${+s["시작"].slice(5, 7)}월 ${+s["시작"].slice(8)}일부터</small><h2>${esc(s["이모지"])} ${esc(s["이름"])}</h2></div></div>
    <div class="diary-paper"><p>${esc(s["일기"])}</p><span class="sign">— 2천 살 냥이</span></div>
    <div class="pae-act"><small>${esc(s["이름"])}의 개운 한 가지</small><b>${esc(s["개운"])}</b></div>
    <h3 style="margin:16px 0 8px">절기 도장 <span class="sub">${got.size}/24 · 절기마다 한 번 들르면 찍혀요</span></h3>
    <div class="term-grid">${all.map((t) => `<span class="jg ${got.has(t["이름"]) ? "on" : ""} ${t["이름"] === s["이름"] ? "now" : ""}"><i>${got.has(t["이름"]) ? esc(t["이모지"]) : "·"}</i>${esc(t["이름"])}</span>`).join("")}</div>
    <p class="sub" style="text-align:center;margin:12px 0 0">다음 절기 ${esc(s["다음이모지"])} ${esc(s["다음"])}까지 ${s["남은날"]}일 — 새 일기가 열린다냥</p></div>`);
}

// ───────── 60일주 냥이 카드
function nyangCardSvg(c, who) {
  const cat = nyang("happy", 170, c["옷"]).replace("<svg ", '<svg x="95" y="78" ');
  const kw = c["키워드"].map((k, i) => `<g transform="translate(${[30, 130, 230][i]} 336)"><rect width="100" height="30" rx="15" fill="#fff" opacity=".9"/><text x="50" y="20" font-size="13" fill="#3b2f4a" text-anchor="middle">#${esc(k)}</text></g>`).join("");
  const line = c["한줄"].replace("사람이다냥.", "").trim();
  const half = Math.ceil(line.length / 2), cut = line.lastIndexOf(" ", half) > 6 ? line.lastIndexOf(" ", half) : half;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 470" width="100%" role="img" aria-label="${esc(c["이름"])} 카드" font-family="Jua, Gowun Dodum, Apple SD Gothic Neo, Malgun Gothic, sans-serif">
    <defs><linearGradient id="nc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="${c["색"]}"/></linearGradient></defs>
    <rect width="360" height="470" rx="30" fill="url(#nc)"/><rect x="10" y="10" width="340" height="450" rx="24" fill="none" stroke="#fff" stroke-width="2" opacity=".8"/>
    <text x="28" y="44" font-size="14" fill="#7c5cf0">사주냥이 · 60일주 냥이 카드</text><text x="332" y="44" font-size="20" fill="#3b2f4a" text-anchor="end">${esc(c["일주"])}</text>
    <circle cx="180" cy="168" r="84" fill="#fff" opacity=".55"/>${cat}
    <text x="180" y="276" font-size="13" fill="#6b6080" text-anchor="middle">${esc(who)}${who.endsWith("님") ? "은 " : "는 "}${esc(c["한글"])}일주 · ${esc(c["동물"])}의 기운</text>
    <text x="180" y="310" font-size="27" fill="#3b2f4a" text-anchor="middle">${esc(c["이름"])}</text>${kw}
    <text x="180" y="396" font-size="13.5" fill="#3b2f4a" text-anchor="middle">${esc(line.slice(0, cut))}</text>
    <text x="180" y="416" font-size="13.5" fill="#3b2f4a" text-anchor="middle">${esc(line.slice(cut).trim())} 사람이다냥.</text>
    <text x="180" y="450" font-size="11" fill="#6b6080" text-anchor="middle">너는 무슨 냥이야? · korean-saju-six.vercel.app</text></svg>`;
}
function myCardTile() {
  const c = S.d["냥이카드"]; if (!c) return "";
  return `<button type="button" class="ncard-tile" data-ncard style="--c:${c["색"]}"><span data-nyang="wink" data-size="58" data-outfit="${c["옷"]}"></span>
    <span><small>${esc(nim())}의 60일주 냥이 · ${esc(c["일주"])}</small><b>${esc(c["이름"])}</b><em>${c["키워드"].map((k) => "#" + esc(k)).join(" ")}</em></span></button>`;
}
function openNyangCard() {
  const c = S.d["냥이카드"];
  const friends = store.get("friendCards", {});
  openSheet(`<div id="nc-box">${nyangCardSvg(c, nim())}</div>
    <div class="rd-cta" style="margin-top:12px"><button class="btn primary" type="button" id="nc-share">📤 너는 무슨 냥이야?</button><button class="btn lav" type="button" id="nc-save">🖼️ 카드 저장</button></div>
    <h3 style="margin:16px 0 6px">친구 냥이 카드 <span class="sub">${Object.keys(friends).length}/60</span></h3>
    ${Object.keys(friends).length ? `<div class="fcards">${Object.entries(friends).map(([k, f]) => `<span class="fcard" style="--c:${f["색"]}"><b>${esc(k)}</b>${esc(f["이름"])}<small>${esc(f.who)}</small></span>`).join("")}</div>`
      : `<p class="sub">귀인 지도에 친구가 올라오면 친구의 냥이 카드가 여기 모인다냥.</p>`}`);
  $("#nc-save").addEventListener("click", () => saveSvgPng($("#nc-box svg"), `사주냥이_${c["이름"].replace(/ /g, "_")}.png`));
  $("#nc-share").addEventListener("click", async () => {
    const text = `나는 ${c["일주"]}일주, '${c["이름"]}'이래 🐾 #${c["키워드"].join(" #")} — 너는 무슨 냥이야?`;
    if (navigator.share) { try { await navigator.share({ title: "사주냥이 60일주 냥이 카드", text, url: location.origin + "/" }); return; } catch { /* 취소 */ } }
    try { await navigator.clipboard.writeText(`${text} ${location.origin}/`); toast("공유 문구를 복사했다냥!"); } catch { alert(text); }
  });
}
function collectFriendCards(M) {
  const got = store.get("friendCards", {});
  (M["멤버"] || []).concat(M["대기"] || []).forEach((m) => { const c = m["냥이"]; if (c && !got[c["일주"]]) got[c["일주"]] = { 이름: c["이름"], 색: c["색"], who: m["이름"] }; });
  store.set("friendCards", got);
}

// ───────── 귀인 퀘스트: 친구에게 보약 편지
const weekKey = () => { const d = new Date(Date.now() + 9 * 3600e3); const j = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); return `${d.getUTCFullYear()}-w${Math.ceil(((d - j) / 864e5 + j.getUTCDay() + 1) / 7)}`; };
function questCard() {
  const q = store.get("quest", {}), w = weekKey(), sent = q.week === w ? q.sent || 0 : 0;
  return `<div class="card quest"><div class="card-head"><h2>🤝 이번 주 귀인 퀘스트</h2><span class="badge ${sent ? "mint" : ""}">${sent ? "완료 ✓" : "0 / 1"}</span></div>
    <p class="sub" style="margin:0 0 8px">지도 속 친구에게 그 친구의 보약 기운을 담은 <b>보약 편지</b>를 한 통 보내 봐. 서로에게 귀인이 되는 연습이다냥.</p>
    <p class="sub" style="margin:0">별을 누르면 '📮 보약 편지 보내기'가 있어요 · 받은 도장 ${q.total || 0}개</p>
    <div id="letters-slot"></div></div>`;
}
function openLetter(m, ref) {
  const el = m["용신"] || "";
  openSheet(`<div class="sheet-title"><span data-nyang="love" data-size="56"></span><div><h2>📮 ${esc(m["이름"])}님에게 보약 편지</h2>
      <p class="sub">${el ? `${esc(m["이름"])}님의 보약은 ${el}(${EL_HANJA[el]}) 기운이다냥. 그 기운을 담아 보낼게.` : "따뜻한 응원을 담아 보낼게."}</p></div></div>
    <label class="field"><span>한 줄 덧붙이기 (선택 · 60자)</span><input id="lt-msg" maxlength="60" placeholder="예) 시험 잘 봐! 끝나고 맛있는 거 먹자"></label>
    <button class="btn primary wide" type="button" id="lt-send" style="margin-top:12px">보약 편지 보내기 🐾</button>
    <p class="sub" style="margin:10px 0 0">친구가 '서로 연결하기'로 자기 지도를 만든 경우에만 배달돼요 · 같은 친구에겐 하루 한 통</p>`);
  $("#lt-send").addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    try {
      await api(`/api/map/${ref.id}/member/${m.id}/letter`, { token: ref.token, msg: $("#lt-msg").value.trim() });
      const q = store.get("quest", {}), w = weekKey();
      store.set("quest", { week: w, sent: (q.week === w ? q.sent || 0 : 0) + 1, total: (q.total || 0) + 1 });
      closeSheet(); toast(`${m["이름"]}님에게 보약 편지를 보냈다냥! 귀인 도장 +1`); renderMapPane();
    } catch (err) { alert(err.message); e.currentTarget.disabled = false; }
  });
}
async function loadLetters(ref) {
  const slot = $("#letters-slot"); if (!slot) return;
  try {
    const r = await api(`/api/map/${ref.id}/letters?token=${encodeURIComponent(ref.token)}`);
    const seen = new Set(store.get("lettersSeen", [])), list = r["편지"] || [];
    if (!list.length) { slot.innerHTML = `<p class="sub" style="margin:10px 0 0">📬 아직 받은 편지는 없다냥.</p>`; return; }
    slot.innerHTML = `<h3 style="margin:14px 0 6px">📬 받은 보약 편지 ${list.length}통</h3>${list.map((x) => `<div class="letter ${seen.has(x.id) ? "" : "new"}">
      <b>${esc(x.from)}님</b> <small>${esc(x.at.slice(5).replace("-", "/"))}</small><p>${esc(x.line)}</p>${x.msg ? `<p class="lm">“${esc(x.msg)}”</p>` : ""}</div>`).join("")}`;
    store.set("lettersSeen", [...new Set([...seen, ...list.map((x) => x.id)])].slice(-100));
  } catch { slot.innerHTML = ""; }
}

// ───────── 전체 메뉴(한곳에 모아 홈을 가볍게)
const ALL_MENU = [
  ["운세", [["luck:new", "🧧", "신년운세"], ["luck:month", "📅", "월별 운세"], ["luck:cal", "🗓️", "운세 달력"], ["luck:life", "📈", "인생 흐름"], ["luck:read", "🐾", "냥이 도사 대풀이"], ["@taegil", "📆", "택일 도우미"]]],
  ["나를 알기", [["@ncard", "🃏", "나의 냥이 카드"], ["saju:fit", "🎯", "나에게 맞는"], ["saju:rx", "🍀", "개운 처방전"], ["saju:manse", "📜", "만세력"], ["saju:sinsal", "🔮", "신살과 길성"], ["saju:ogo", "🏛️", "오고 정밀감명"], ["@gloss", "📚", "명리 교실"]]],
  ["함께", [["compat", "💞", "궁합·귀인 지도"], ["talk", "💬", "고민 상담"], ["path", "🧭", "나의 길"]]],
  ["기록·수집", [["@saved", "🗂️", "내가 본 풀이"], ["@garden", "🌱", "오행 정원"], ["@season", "🎐", "절기 일기"], ["@book", "📖", "냥이 일기장"], ["@dex", "👘", "냥이 도감"], ["@backup", "🔐", "기록 백업"]]],
];
const menuBtn = ([g, ic, l]) => `<button type="button" ${g[0] === "@" ? `data-${g.slice(1)}` : `data-go="${g}"`}><i>${ic}</i><span>${l}</span></button>`;
function openAllMenu() {
  openSheet(`<h2 style="margin:0 0 12px">전체 메뉴</h2>${ALL_MENU.map(([t, items]) => `<h3 class="menu-h">${t}</h3><div class="menu-list">${items.map(menuBtn).join("")}</div>`).join("")}`);
  $$("#sheet-content [data-go]").forEach((b) => b.addEventListener("click", closeSheet));
}

// ───────────────────────── 나의 길 탭
const TAGS = ["이직·취업", "승진·성과", "시험·합격", "이사", "연애·결혼", "이별", "출산·육아", "돈 들어옴", "돈 나감", "건강", "가족 일", "힘든 시기", "좋은 시기", "새 시작"];
const GRP_OF = { 비견: "비겁", 겁재: "비겁", 식신: "식상", 상관: "식상", 편재: "재성", 정재: "재성", 편관: "관성", 정관: "관성", 편인: "인성", 정인: "인성" };
const GRP_DESC = { 비겁: "나·경쟁의 해", 식상: "표현·재능의 해", 재성: "돈·기회의 해", 관성: "책임·시험의 해", 인성: "배움·도움의 해" };
let pathSub = "past";
function renderPath(sub) {
  if (!S.d) return;
  if (sub) pathSub = sub;
  const J = S.d["나의길"] || {};
  $("#tab-path").innerHTML = `
    <div class="segtabs" role="tablist"><button data-psub="past" type="button">🪞 돌아보기</button><button data-psub="future" type="button">🌱 준비하기</button><button data-psub="diary" type="button">📔 운세 일기</button><button data-psub="ipmyeong" type="button">🌿 입명 노트</button></div>
    <div data-ppane="past" hidden>${renderPast(J["지난해들"] || [])}</div>
    <div data-ppane="future" hidden>${renderFuture(J["앞으로"] || [])}</div>
    <div data-ppane="diary" hidden>${renderDiary()}</div>
    <div data-ppane="ipmyeong" hidden>${renderIpmyeong(S.d["입명"])}</div>`;
  $$("#tab-path [data-psub]").forEach((b) => { b.setAttribute("aria-selected", b.dataset.psub === pathSub); b.addEventListener("click", () => renderPath(b.dataset.psub)); });
  $$("#tab-path [data-ppane]").forEach((p) => (p.hidden = p.dataset.ppane !== pathSub));
  $$("#tab-path [data-year]").forEach((b) => b.addEventListener("click", () => openYear(+b.dataset.year)));
  $$("#tab-path [data-prep]").forEach((c) => c.addEventListener("change", () => {
    const pr = store.get("prep", {}); pr[c.dataset.prep] = c.checked; store.set("prep", pr);
    const card = c.closest(".fut"), n = $$("[data-prep]:checked", card).length, el = $(".prep-n", card);
    if (el) el.textContent = `준비 ${n}/3${n === 3 ? " · 완벽 준비! 냥이가 도장 쾅 🐾" : ""}`;
  }));
  $$("#tab-path [data-vow]").forEach((c) => c.addEventListener("change", () => { const v = store.get("vow", {}); v[c.dataset.vow] = c.value.trim(); store.set("vow", v); }));
  $("#btn-journey")?.addEventListener("click", () => openReading("journey", { text: journeyText(), title: "인생 패턴 돌아보기" }));
  $("#ip-reflect")?.addEventListener("change", (e) => store.set("reflect", e.target.value.trim()));
  $("#ip-deed")?.addEventListener("click", (e) => {
    const k = "deed:" + S.d["운세"]["오늘운세"].date, on = store.get(k, 0) !== 1; store.set(k, on ? 1 : 0);
    e.currentTarget.classList.toggle("done", on); e.currentTarget.setAttribute("aria-pressed", on);
    e.currentTarget.firstElementChild.textContent = on ? "✅" : "⬜";
  });
  $("[data-psub-go]", $("#tab-path"))?.addEventListener("click", (e) => renderPath(e.currentTarget.dataset.psubGo));
  paintNyang($("#tab-path"));
}
function journeyText() {
  const past = store.get("past", {}), J = S.d["나의길"]["지난해들"];
  return Object.keys(past).sort().map((y) => { const e = J.find((x) => x["연도"] === +y); const p = past[y];
    return `${y}년(${e ? e["간지"] + "·" + e["십성"] : ""}): ${(p.tags || []).join("·")}${p.memo ? " — " + p.memo : ""}`; }).join("\n").slice(0, 1900);
}
function pastPattern(list) {
  const past = store.get("past", {});
  const tagged = list.filter((y) => past[y["연도"]] && ((past[y["연도"]].tags || []).length || past[y["연도"]].memo));
  if (tagged.length < 2) return "";
  const cnt = {};
  tagged.forEach((y) => { cnt[y["그룹"]] = (cnt[y["그룹"]] || 0) + 1; });
  const [g, c] = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
  const yrs = tagged.filter((y) => y["그룹"] === g).map((y) => y["연도"]);
  const next = (S.d["운세"]["앞으로10년"] || []).filter((x) => GRP_OF[x["십성"]] === g).map((x) => x["연도"]).slice(0, 2);
  const changes = tagged.filter((y) => (past[y["연도"]].tags || []).some((t) => ["이직·취업", "이사", "새 시작", "이별", "연애·결혼"].includes(t)));
  return `<div class="card tint-lav"><div class="card-head"><h2>🔍 냥이가 찾은 패턴</h2><span class="badge">기록 ${tagged.length}개</span></div>
    <div class="say"><span class="who" data-nyang="think" data-size="50"></span><div class="bubble">
    큰일을 남긴 해 ${tagged.length}개 중 <b>${c}개</b>가 <b>${g}(${GRP_DESC[g]})</b>였다냥 (${yrs.join("·")}년).
    ${next.length ? `<br>다음 ${g}의 해는 <b>${next.join("·")}년</b>! 그때를 미리 준비해 두자냥.` : ""}
    ${changes.length >= 2 ? `<br>변화(이사·이직·만남·이별)가 있던 해: ${changes.map((y) => `${y["연도"]}(${y["십성"]})`).join(", ")}` : ""}
    ${c < 2 ? "<br><small>아직은 우연일 수도 있다냥. 기록이 쌓일수록 정확해진다냥.</small>" : ""}</div></div>
    <button class="btn primary wide" type="button" id="btn-journey" style="margin-top:12px">🪞 냥이 도사에게 내 인생 패턴 자세히 듣기</button></div>`;
}
function renderPast(list) {
  const past = store.get("past", {});
  return `<div class="say" style="margin-bottom:12px"><span class="who" data-nyang="normal" data-size="54"></span><div class="bubble">
    지나온 해를 돌아보면 앞으로가 보인다냥. 기억나는 해를 눌러 그해 있었던 일을 남겨 봐. <b>기록은 이 폰에만</b> 저장된다냥.</div></div>
    ${pastPattern(list)}
    <div class="card"><h2>📜 지나온 해들</h2><div class="years">${list.map((y) => { const p = past[y["연도"]]; const has = p && ((p.tags || []).length || p.memo);
      return `<button type="button" class="yr ${has ? "has" : ""}" data-year="${y["연도"]}"><span class="y">${y["연도"]}<small>${y["나이"]}세</small></span>
        <span class="g">${esc(y["간지"])} · ${esc(y["십성"])}<small>${esc(y["테마"])}</small>${has ? `<em>${esc((p.tags || []).join(" · ") || "메모")}</em>` : ""}</span>
        <span class="s ${y["점수"] >= 63 ? "good" : y["점수"] <= 47 ? "bad" : ""}">${y["점수"]}</span></button>`; }).join("")}</div></div>`;
}
function openYear(y) {
  const e = S.d["나의길"]["지난해들"].find((x) => x["연도"] === y);
  if (!e) return;
  const past = store.get("past", {}), cur = past[y] || { tags: [], memo: "" };
  openSheet(`<div class="term-head"><span data-nyang="think" data-size="60"></span><div><h2>${y}년 · ${e["나이"]}세</h2>
      <div class="term-mean">${esc(e["간지"])}(${esc(e["한글"])}) · ${esc(e["십성"])}의 해 · ${e["점수"]}점 · 대운 ${esc(e["대운"])}</div></div></div>
    <div class="bubble lav" style="margin-bottom:12px"><b>${esc(e["테마"])}</b><br>${esc(e["질문"][0])}<br><span class="sub">${esc(e["질문"][1])}</span></div>
    <div class="tagpick">${TAGS.map((t) => `<label><input type="checkbox" value="${t}" ${cur.tags.includes(t) ? "checked" : ""}><span>${t}</span></label>`).join("")}</div>
    <textarea class="dream-box" id="yr-memo" maxlength="200" placeholder="그해의 기억을 한두 줄로 — 예) 첫 직장 입사, 밤샘 많았지만 사람을 얻었다">${esc(cur.memo)}</textarea>
    <button class="btn primary wide" type="button" id="yr-save" style="margin-bottom:8px">기록 남기기</button>`);
  $("#yr-save").addEventListener("click", () => {
    const tags = $$("#sheet .tagpick input:checked").map((i) => i.value), memo = $("#yr-memo").value.trim();
    const p = store.get("past", {});
    if (tags.length || memo) p[y] = { tags, memo }; else delete p[y];
    store.set("past", p); closeSheet(); renderPath("past"); renderHomeTeaser();
  });
}
function renderHomeTeaser() { const el = $("#tab-home .path-teaser"); if (el) { el.outerHTML = pathTeaser(); paintNyang($("#tab-home")); } }
function planBlock() {
  const f = S.d["운세"], plan = f["분기플랜"] || [], tm = f["타이밍"] || [], tr = f["대운전환"], rm = f["로드맵"], y = f["신년운세"];
  if (!plan.length) return "";
  return `<div class="card tint-lav"><div class="card-head"><h2>📋 ${y["연도"]} 분기 플랜</h2><span class="badge">절기 기준</span></div>
    <p class="sub" style="margin:0 0 10px">☀️ 밀기 · ⛅ 실행 · 🌧️ 정비 — 점수가 아니라 '어떻게 움직일지'로 보면 된다냥.</p>
    <div class="quarters">${plan.map((q) => `<div class="qtr"><div class="qh"><b>${esc(q["분기"])}</b><span>${esc(q["신호"])}</span></div>
      <p class="sub" style="margin:2px 0 6px">핵심: ${esc(q["핵심"])}</p>
      ${q["달별"].map((m) => `<div class="qm"><b>${esc(m["표시"])}</b> ${esc(m["신호"])} · ${esc(m["할일"])}${m["주의"] ? `<small>⚠ ${esc(m["주의"])}</small>` : ""}</div>`).join("")}</div>`).join("")}</div></div>
    <div class="card"><h2>⏱️ 타이밍 도우미</h2>
      <div class="timing">${tm.map((t) => `<div class="tm"><b>${esc(t["목적"])}</b>
        <div>👍 ${t["추천"].length ? t["추천"].map(esc).join("·") : "특정 달보다 준비가 먼저"}${t["추천해"].length ? ` <span class="sub">· 해: ${t["추천해"].join("·")}</span>` : ""}</div>
        <div class="sub">🙅 ${t["피할"].map(esc).join("·")} · ${esc(t["이유"])}</div></div>`).join("")}</div>
      <p class="fine" style="margin:10px 0 0">냥이는 '바람 방향'만 알려 준다냥. 연봉·건강·계약 조건이 언제나 먼저야!</p></div>
    ${tr ? `<div class="card tint-mint"><div class="card-head"><h2>🌗 대운 전환 준비</h2><span class="badge mint">D-${tr["남은해"]}년</span></div>
      <p style="margin:0 0 8px">${esc(tr["문구"])}</p>${tr["씨앗"].map((x) => `<div>🌱 ${esc(x)}</div>`).join("")}</div>` : ""}
    ${rm ? `<div class="card"><h2>🗺️ 10년 로드맵</h2><p style="margin:0">수확의 해 <b>${rm["수확"]["연도"]}년</b>(${esc(rm["수확"]["테마"])}, ${rm["수확"]["점수"]}점) — <b>${rm["준비"]}년</b>부터 씨앗을 심어 두자냥.</p></div>` : ""}`;
}
function renderIpmyeong(I) {
  if (!I) return `<p class="sub">입명 노트를 불러오지 못했다냥.</p>`;
  const done = store.get("deed:" + S.d["운세"]["오늘운세"].date, 0) === 1;
  return `<div class="say" style="margin-bottom:12px"><span class="who" data-nyang="happy" data-size="54"></span><div class="bubble">${esc(I["소개"])}</div></div>
    <div class="card"><h2>${esc(I["지명"]["제목"])}</h2>${I["지명"]["문장"].map((x) => `<p class="ip-line">${T(x, true)}</p>`).join("")}</div>
    <div class="card tint-lav"><h2>${esc(I["개과"]["제목"])}</h2>
      <p><b>되풀이하기 쉬운 모습</b> — ${esc(I["개과"]["패턴"])}</p>
      <div class="bubble lav" style="margin:8px 0">🪞 ${esc(I["개과"]["질문"])}</div>
      <p>👉 바꿀 행동 하나: <b>${esc(I["개과"]["행동"])}</b></p>
      <textarea class="dream-box" id="ip-reflect" maxlength="300" placeholder="떠오른 일을 적어 봐 — 이 폰에만 저장된다냥">${esc(store.get("reflect", ""))}</textarea>
      <p class="sub" style="margin:4px 0 0">${esc(I["개과"]["근거"])}</p></div>
    <div class="card tint-mint"><h2>${esc(I["적선"]["제목"])}</h2>
      <button type="button" class="mission ${done ? "done" : ""}" id="ip-deed" aria-pressed="${done}"><span>${done ? "✅" : "⬜"}</span><span>오늘의 나눔: ${esc(I["적선"]["오늘"])}</span></button>
      <p class="sub" style="margin:8px 0 0">${esc(I["적선"]["근거"])}</p></div>
    <div class="card"><h2>${esc(I["겸덕"]["제목"])}</h2><p style="margin:0">🙇 ${esc(I["겸덕"]["한줄"])}</p><p class="sub" style="margin:6px 0 0">${esc(I["겸덕"]["근거"])}</p></div>
    <div class="card tint-butter"><h2>${esc(I["입명"]["제목"])}</h2>${I["입명"]["계획"].map((x) => `<div class="ip-plan"><b>${esc(x["기간"])}</b> ${esc(x["신호"] || "")}${x["할일"].filter(Boolean).map((t) => `<div>· ${esc(t)}</div>`).join("")}</div>`).join("")}
      <button class="ghost wide" type="button" data-psub-go="future" style="margin-top:10px">🌱 준비하기에서 분기 플랜 보기</button></div>
    <div class="card"><h2>📖 이 노트의 근거</h2>${I["출처"].map((x) => `<div class="src"><b>${esc(x["제목"])}</b>
      ${x["원문"] ? `<div class="src-orig">${esc(x["원문"])}</div>` : ""}<div>${esc(x["뜻"])}</div><div class="sub">🐱 ${esc(x["냥이"])}</div>
      <a href="${esc(x["url"])}" target="_blank" rel="noopener" class="sub">${esc(x["출처"])} ↗</a></div>`).join("")}
      <h3 style="margin-top:14px">사주냥이의 다섯 가지 원칙</h3><ol class="principles">${I["원칙"].map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div>`;
}
function renderFuture(list) {
  const pr = store.get("prep", {}), vow = store.get("vow", {});
  return planBlock() + `<div class="say" style="margin-bottom:12px"><span class="who" data-nyang="happy" data-size="54"></span><div class="bubble">
    운은 날씨, 준비는 우산이다냥. 해마다 할 일을 체크하면서 한 해를 미리 그려 보자냥!</div></div>
    ${list.map((y, i) => { const done = y["준비"].filter((_, k) => pr[`${y["연도"]}:${k}`]).length;
      return `<div class="card fut ${i === 0 ? "tint-pink" : ""}"><div class="card-head"><h2>${y["연도"]}년 <small class="sub">${esc(y["간지"])} · ${esc(y["십성"])} · ${y["나이"]}세</small></h2><span class="badge ${y["점수"] >= 63 ? "" : "pink"}">${y["점수"]}점</span></div>
      <div class="kw">🎯 ${esc(y["키워드"])}</div>
      <p class="sub" style="margin:6px 0 10px">${esc(y["한마디"])}</p>
      <div class="checks">${y["준비"].map((t, k) => `<label><input type="checkbox" data-prep="${y["연도"]}:${k}" ${pr[`${y["연도"]}:${k}`] ? "checked" : ""}><span>${esc(t)}</span></label>`).join("")}</div>
      <p class="care">⚠️ 조심: ${esc(y["조심"])}</p>
      <input class="note-in" data-vow="${y["연도"]}" maxlength="60" value="${esc(vow[y["연도"]] || "")}" placeholder="${y["연도"]}년 나의 다짐 한 줄">
      <p class="sub" style="margin:8px 0 0"><span class="prep-n">준비 ${done}/3${done === 3 ? " · 완벽 준비! 냥이가 도장 쾅 🐾" : ""}</span> · 대운 ${esc(y["대운"])}</p></div>`; }).join("")}
    <button class="btn lav wide" type="button" data-read="year">🧧 냥이 도사의 신년운세 풀이 듣기</button>`;
}
function renderDiary() {
  const st = diaryStats();
  if (!st.arr.length) return `<div class="say"><span class="who" data-nyang="wink" data-size="54"></span><div class="bubble">아직 일기가 없다냥. 홈의 <b>'오늘 하루 어땠냥?'</b>에 기분을 눌러 주면 여기 쌓인다냥. 쌓일수록 냥이가 '너만의 날씨 패턴'을 찾아 준다냥!</div></div>`;
  const rows = Object.entries(st.by).map(([g, ms]) => [g, ms.reduce((a, b) => a + b, 0) / ms.length, ms.length]).sort((a, b) => b[1] - a[1]);
  const best = rows.find((r) => r[2] >= 2), worst = [...rows].reverse().find((r) => r[2] >= 2 && r !== best);
  return `<div class="card tint-lav"><div class="card-head"><h2>📊 나의 운세 날씨</h2><span class="badge">일기 ${st.arr.length}일</span></div>
    ${st.hit != null ? `<div class="hit">냥이 적중률 <b>${st.hit}%</b><small>운세 점수와 실제 기분이 맞은 비율</small></div>` : ""}
    <div class="say"><span class="who" data-nyang="think" data-size="50"></span><div class="bubble">${best ? `너는 <b>${esc(best[0])}</b>의 날에 기분이 제일 좋았다냥 (${best[2]}번).` : "조금만 더 쌓이면 패턴이 보인다냥!"}
      ${worst ? `<br><b>${esc(worst[0])}</b>의 날엔 조금 지쳤었네. 그런 날은 미리 일정을 가볍게!` : ""}</div></div>
    <div class="dom" style="margin-top:12px">${rows.map(([g, avg, n]) => `<div class="dom-row" style="grid-template-columns:52px 1fr 40px"><span class="n">${esc(g)}</span><div class="track"><div class="fill" style="width:${Math.round(avg * 50)}%"></div></div><span class="v">${n}일</span></div>`).join("")}</div></div>
    <div class="card"><h2>📔 최근 기록</h2><div class="dlist">${st.arr.slice(0, 30).map((x) => `<div><span>${MOODS[x.mood][0]}</span><b>${+x.d.slice(5, 7)}/${+x.d.slice(8)}</b><small>${esc(x["십성"] || "")}${x["점수"] != null ? ` · ${x["점수"]}점` : ""}</small><p>${esc(x.note || "")}</p></div>`).join("")}</div></div>`;
}

// ───────────────────────── 홈 화면에 설치(PWA)
let installEvt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); installEvt = e;
  const slot = $("#install-slot");
  if (slot) slot.innerHTML = `<button class="ghost wide" type="button" id="btn-install">📲 홈 화면에 냥이 집 만들기</button>`;
  $("#btn-install")?.addEventListener("click", async () => { installEvt?.prompt(); installEvt = null; $("#install-slot").innerHTML = ""; });
});
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("/sw.js").catch(() => {});


// ───────── 홈 '지금 나에게': 그날 가장 관련 있는 카드 한 장만
function yearBanner() {
  const d = S.d, y = d["운세"]["신년운세"];
  return `<button class="banner" type="button" data-yearcard><div><small>${y["연도"]}년 ${esc(y["간지"])} 신년운세</small>
      <div class="t">${esc(d["나의올해"]?.["이모지"] || "")} ${esc(d["나의올해"]?.["이름"] || y["테마"])}</div><small>좋은 달 ${(y["좋은달표시"] || y["좋은달"].map((m) => m + "월")).join("·")} · 카드 만들기 →</small></div><span class="big">🧧</span></button>`;
}
const NOW_LABEL = { season: "🎐 절기 일기", month: "🗓️ 이번 달 플랜", year: "🧧 신년 카드", ncard: "🃏 나의 냥이 카드" };
function nowPick() {
  const d = S.d, s = d["절기"], today = kstDate(0), day = +today.slice(8), mon = +today.slice(5, 7);
  const fresh = s && (Date.parse(today) - Date.parse(s["시작"])) / 864e5 <= 3;
  if (fresh) return "season";
  if (day <= 7) return "month";
  if (mon === 12 || mon === 1) return "year";
  return ["month", "ncard", "season", "year"][Math.floor(Date.parse(today) / 864e5) % 4];
}
function nowCard() {
  const d = S.d;
  const opts = { season: seasonBanner(), month: monthCard(d["운세"]["이번달"]), year: yearBanner(), ncard: myCardTile() };
  let pick = S.nowPick || nowPick();
  if (!opts[pick]) pick = Object.keys(opts).find((k) => opts[k]);
  const chips = Object.keys(opts).filter((k) => k !== pick && opts[k]).map((k) => `<button type="button" class="now-chip" data-now="${k}">${NOW_LABEL[k]}</button>`).join("");
  return `<div id="now-wrap"><h2 class="sec-t">지금 나에게</h2>${opts[pick] || ""}<div class="now-chips">${chips}</div></div>`;
}
document.addEventListener("click", (e) => {
  const n = e.target.closest("[data-now]");
  if (n) { S.nowPick = n.dataset.now; $("#now-wrap").outerHTML = nowCard(); paintNyang($("#now-wrap")); dedupeTerms($("#now-wrap")); return; }
  if (e.target.closest("[data-yearcard]")) openYearCard();
});

// ───────── 용어 밑줄 다이어트: 카드 하나에서 처음 나온 용어만 누를 수 있게
function dedupeTerms(root) {
  if (!root) return;
  const boxes = [...root.querySelectorAll(".card, .chap, .more-box, .mx-grid, .ss-grid")].filter((b) => !b.parentElement.closest(".card, .chap"));
  if (root.matches?.(".card, #sheet-content, #now-wrap")) boxes.push(root);
  for (const box of boxes) {
    const seen = new Set();
    for (const t of box.querySelectorAll(".term")) {
      if (t.closest(".mx-l")) continue; // 만세력 줄 이름은 늘 누를 수 있게
      const k = t.dataset.t;
      if (seen.has(k)) t.replaceWith(document.createTextNode(t.textContent)); else seen.add(k);
    }
  }
}

// ───────── 화면 자동 점검(배포 전 헤드리스 브라우저로 실행: /#smoke=<생일 JSON>)
async function runSmoke(birth) {
  const out = { ok: false, errors: [], tabs: {} };
  window.addEventListener("error", (e) => out.errors.push(String(e.message)));
  window.addEventListener("unhandledrejection", (e) => out.errors.push(String(e.reason)));
  try {
    store.set("revealed", 1);
    await loadMe(birth);
    for (const t of ["home", "luck", "saju", "compat", "path", "talk"]) {
      try {
        showTab(t);
        const el = $(`#tab-${t}`);
        out.tabs[t] = { len: el.innerHTML.length, h: Math.round(el.scrollHeight / Math.max(innerHeight, 1) * 10) / 10, terms: el.querySelectorAll(".term").length };
      } catch (err) { out.errors.push(`${t}: ${err.message}`); }
    }
    for (const p of ["glance", "story", "ogo", "manse"]) { try { setSajuPane(p); } catch (err) { out.errors.push(`saju/${p}: ${err.message}`); } }
    out.manse = !!$(".mx-grid") || !S.d["신살표"];
    out.overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    out.ok = !out.errors.length && out.manse && !out.overflowX && Object.values(out.tabs).every((x) => x.len > 100);
  } catch (err) { out.errors.push(String(err.message || err)); }
  const pre = document.createElement("pre"); pre.id = "smoke-out"; pre.textContent = JSON.stringify(out); document.body.append(pre);
}


// ───────────────────────── 2주차: 원국 표 하나로 · 내 사주 '한눈에' · 인생 흐름 타임라인
/** 원국 표 — 만세력과 한눈에가 같은 모양을 쓴다. full=false면 십성·글자만 */
function chartGrid(d, full = true) {
  const ss = d["신살표"] || { "12신살": {} };
  const cols = MX_COLS.map(([k, pos, lbl]) => ({ k, pos, lbl, p: d["원국"][k] }));
  const cell = (c, f) => (c.p ? f(c) : `<div class="mx-c mx-none">—</div>`);
  const row = (name, term, f) => `<div class="mx-l">${term ? chip(term, name) : esc(name)}</div>${cols.map((c) => cell(c, f)).join("")}`;
  const sg = (c) => `<button type="button" class="mx-c" data-mx="sg:${c.pos}">${esc(c.p["천간"]["십성"].replace("일간(나)", "일간"))}</button>`;
  const bg = (c) => `<button type="button" class="mx-c" data-mx="bg:${c.pos}">${esc(c.p["지지"]["십성"])}</button>`;
  return `<div class="mx-grid ${full ? "" : "mini"}">
    <div></div>${cols.map((c) => `<div class="mx-h ${c.k === "일주" ? "me" : ""}">${c.lbl}${c.k === "일주" ? "<i>나</i>" : ""}</div>`).join("")}
    ${full ? "" : row("십성", "십성", sg)}
    ${row("천간", "천간", (c) => mxTile(c.p["천간"]["글자"], c.p["천간"]["오행"], "s", c.pos, c.k === "일주"))}
    ${full ? row("십성", "십성", sg) : ""}
    ${row("지지", "지지", (c) => mxTile(c.p["지지"]["글자"], d["지지오행"][c.k], "b", c.pos))}
    ${row("십성", "십성", bg)}
    ${full ? `${row("지장간", "지장간", (c) => `<button type="button" class="mx-c" data-mx="hd:${c.pos}">${c.p["지지"]["지장간"].map((x) => STEM_KO[x[0]] || x[0]).join("")}</button>`)}
    ${row("12운성", "12운성", (c) => `<button type="button" class="mx-c" data-mx="st:${c.pos}">${esc(c.p["지지"]["12운성"])}</button>`)}
    ${row("12신살", "12신살", (c) => `<button type="button" class="mx-c" data-mx="s12:${c.pos}">${esc(ss["12신살"][c.pos] || "")}</button>`)}` : ""}
  </div>`;
}

function glancePane(d) {
  const y = d["용신"], st = STRENGTH_TERM(d["강약"]["판정"]), c = d["냥이카드"] || {}, SM = d["이야기"]?.["사주"] || {};
  const life = d["운세"]["평생운"], cur = life["현재"], w = d["오행"]["비중(%)"];
  const top = (d["신살이야기"]?.["나"] || []).slice(0, 3).map((x) => x["이름"]);
  const stat = (attr, k, v, s) => `<button type="button" class="gl-stat" ${attr}><small>${k}</small><b>${v}</b><span>${s}</span></button>`;
  return `
    <div class="card gl-hero" style="--c:${esc(c["색"] || "#f6a5b8")}">
      <span data-nyang="wink" data-size="76" ${c["옷"] ? `data-outfit="${esc(c["옷"])}"` : ""}></span>
      <div><small>${esc(nim())} · ${esc(d["원국"]["일주"]["한글"])}일주</small><h2>${esc(c["이름"] || d["나의유형"]?.["이름"] || "")}</h2>
        <p>${esc(SM["핵심"] || c["한줄"] || "")}</p></div></div>
    <div class="card gl-chart"><div class="card-head"><h2>${chip("원국", "나의 사주")}</h2><button class="ghost" type="button" data-go="saju:manse">만세력 전체 ›</button></div>
      ${chartGrid(d, false)}
      <p class="sub gl-hint">글자를 누르면 냥이가 그 칸을 풀어 준다냥.</p></div>
    <div class="gl-stats">
      ${stat(`data-t="${st}"`, "에너지", esc(d["강약"]["판정"]), `${st} · 지지세력 ${d["강약"]["점수"]}%`)}
      ${stat('data-go="saju:rx"', "나의 보약", `<span class="e-txt-${y["용신"]}">${esc(y["용신"])}</span> 기운`, `희신 ${esc(y["희신"] || "-")} · 개운법 ›`)}
      ${stat('data-t="격국"', "사회의 그릇", esc(d["격국"]["이름"]), "격국 · 누르면 설명")}
      ${stat('data-go="luck:life"', "지금 10년", cur ? `${esc(cur["한글"])} 대운` : "첫 대운 전", cur ? `${esc(cur["테마"])} ›` : "인생 흐름 보기 ›")}
    </div>
    <div class="card gl-el"><div class="card-head"><h2>${chip("오행")} 밸런스</h2><span class="badge">보약 ${esc(y["용신"])}</span></div>
      <div class="el-bar">${ELEM.map((e) => (w[e] > 0 ? `<span class="f-${e}" style="flex:${w[e]}" title="${e} ${w[e]}%"></span>` : "")).join("")}</div>
      <div class="el-leg">${ELEM.map((e) => `<span class="${e === y["용신"] ? "yong" : ""}"><i class="f-${e}"></i>${e} ${Math.round(w[e])}%</span>`).join("")}</div></div>
    ${top.length ? `<div class="card"><div class="card-head"><h2>${chip("신살", "나의 별 세 개")}</h2><button class="ghost" type="button" data-go="saju:sinsal">전체 ›</button></div>
      <div class="ss-list">${top.map((n) => ssChip(n)).join("")}</div></div>` : ""}
    <div class="rd-cta gl-cta"><button class="btn primary" type="button" data-read="life">📜 평생 총평 듣기</button>
      <button class="btn soft" type="button" data-pane-go="story">자세한 풀이 ›</button></div>`;
}

// ───────── 인생 흐름: 대운 10칸을 한 줄로 — 지난 시기는 정리, 지금은 집중, 앞으로는 준비
function tlRows(d) {
  const life = d["운세"]["평생운"], SL = d["이야기"]?.["평생"] || {}, lr = d["운줄"]?.["대운"] || [];
  const ci = life["대운"].findIndex((p) => p["현재"]);
  const firstAge = life["대운"][0]?.["나이"] ?? 0, age = new Date().getFullYear() - +d["입력"]["양력"].slice(0, 4);
  return life["대운"].map((p, i) => ({
    p, i, sl: SL["대운"]?.[i], lr: lr[i], og: d["오고"]?.synth?.["대운"]?.[i],
    status: ci >= 0 ? (i < ci ? "past" : i === ci ? "now" : "future") : (age < firstAge ? "future" : "past"),
  }));
}
function timelinePane(d) {
  const f = d["운세"], life = f["평생운"], SL = d["이야기"]?.["평생"] || {}, st = d["신살이야기"] || {};
  const rows = tlRows(d);
  const lab = { past: "정리", now: "지금", future: "준비" };
  const row = (r) => `<button type="button" class="tl-row ${r.status}" data-tl="${r.i}">
      <span class="tl-age"><b>${r.p["나이"]}세</b><small>${r.p["시작"]}~</small></span>
      <span class="tl-dot"><i>${lab[r.status]}</i></span>
      <span class="tl-main"><b>${esc(r.p["한글"])} <span class="sub">${esc(r.p["간지"])}</span></b>
        <em>${esc(r.sl?.["제목"] || r.p["테마"])}</em>
        <span class="tl-ss">${(r.lr?.["신살"] || []).slice(0, 3).map((n) => `<span class="ss-mini ${KIND_CLS[S.sinsal?.["설명"]?.[n]?.["종류"]] || ""}">${esc(n)}</span>`).join("")}</span></span>
      <span class="tl-score"><b>${r.p["점수"]}</b><small>점</small></span></button>`;
  const yrs = (st["앞으로"]?.["3년"] || []);
  return `
    <div class="card life"><div class="card-head"><h2>인생 흐름</h2><span class="badge">${chip("대운")} 10년 단위</span></div>
      ${lifeChart(life["대운"])}
      <div class="say" style="margin-top:10px"><span class="who" data-nyang="happy" data-size="50"></span>
        <div class="bubble">가장 크게 피어나는 시기는 <b>${life["전성기"]["나이"]}세(${life["전성기"]["시작"]}년~)</b> '${esc(life["전성기"]["테마"])}'다냥!
        ${life["현재"] ? `<br>지금은 ${life["현재"]["나이"]}세 대운 '${esc(life["현재"]["테마"])}'의 한가운데에 있다냥.` : ""}</div></div></div>
    ${SL["지금핵심"] ? punchCard("지금, 그리고 앞으로 10년", SL["지금핵심"], "wink", [["📖 자세히 풀이", paras(SL["지금"])], ["🌟 전성기 이야기", paras(SL["전성기"])]]) : ""}
    <div class="card"><div class="card-head"><h2>10년마다 바뀌는 인생의 계절</h2></div>
      <p class="sub" style="margin:-4px 0 10px">지난 시기는 <b>정리</b>, 지금은 <b>집중</b>, 앞으로는 <b>준비</b>. 칸을 누르면 냥이가 그 10년을 펼쳐 준다냥.</p>
      <div class="tl">${rows.map(row).join("")}</div></div>
    ${yrs.length ? `<div class="card tint-mint"><h2>🌱 올해부터 3년, 미리 챙길 것</h2>${yrs.map((x) => `<div class="tl-year"><b>${x["연도"]}년 <span class="sub">${esc(x["간지"])}</span></b>
        <div class="ss-inline">${x["신살"].map((n) => ssChip(n, "운")).join("") || '<span class="sub">조용한 해</span>'}</div>
        <ul class="tips">${x["준비"].map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>`).join("")}</div>` : ""}
    <div class="card"><h2>앞으로 10년 점수</h2><div class="dom">${f["앞으로10년"].map((x) => `<div class="dom-row" style="grid-template-columns:52px 1fr 34px">
      <span class="n">${x["연도"]}</span><div><div class="track"><div class="fill" style="width:${x["점수"]}%"></div></div><div class="sub" style="font-size:12.5px">${esc(x["간지"])} · ${esc(x["테마"])}</div></div><span class="v">${x["점수"]}</span></div>`).join("")}</div></div>
    <div class="rd-cta"><button class="btn primary" type="button" data-read="daewoon">📈 인생지도 대풀이</button>
      <button class="btn lav" type="button" data-go="path:past">🧭 해마다 돌아보기</button></div>`;
}
function openTimeline(i) {
  const d = S.d, r = tlRows(d)[+i]; if (!r) return;
  const st = d["신살이야기"] || {}, G = (t) => esc(S.gloss[t]?.["냥이"] || "");
  const past = (st["지나온길"] || []).find((x) => x["간지"].startsWith(r.p["간지"]));
  const nxt = st["앞으로"]?.["다음대운"]?.["간지"]?.startsWith(r.p["간지"]) ? st["앞으로"]["다음대운"] : null;
  const lr = r.lr || {}, og = r.og;
  const head = { past: "지나온 10년 — 정리하기", now: "지금 이 10년 — 집중하기", future: "다가올 10년 — 준비하기" }[r.status];
  const tile = (ch, el) => `<span class="lk-tile e-${el}">${(STEM_KO[ch] || BR_KO[ch])}<i>${ch}</i></span>`;
  openSheet(`<div class="term-head"><div class="tl-tiles">${tile(r.p["간지"][0], STEM_EL[r.p["간지"][0]])}${tile(r.p["간지"][1], BR_EL[r.p["간지"][1]])}</div>
      <div><h2>${r.p["나이"]}~${r.p["나이"] + 9}세 · ${esc(r.p["한글"])} 대운</h2><div class="term-mean">${r.p["시작"]}~${r.p["시작"] + 9}년 · ${r.p["점수"]}점 · ${head}</div></div></div>
    ${r.sl?.["핵심"] ? `<div class="bubble lav"><b>${esc(r.sl["제목"] || "")}</b><br>${esc(r.sl["핵심"])}</div>${moreSet([["📖 자세히 풀이", paras(r.sl.story)], ["🏮 냥이 설화", taleHtml(r.sl["설화"])]])}` : `<div class="bubble lav">${esc(r.p["테마"])}</div>`}
    <div class="ss-sec"><b>🔎 이 10년의 기운</b>
      <p><b>천간 ${esc(lr["천간십성"] || r.p["십성"].split("/")[0])}</b> — ${G(lr["천간십성"] || r.p["십성"].split("/")[0])}</p>
      <p><b>지지 ${esc(lr["지지십성"] || r.p["십성"].split("/")[1] || "")}</b> — ${G(lr["지지십성"] || r.p["십성"].split("/")[1] || "")}</p>
      <p><b>12운성 ${esc(r.p["12운성"])}</b> — ${G(r.p["12운성"])}</p></div>
    ${og ? `<div class="ss-sec"><b>🏛️ 세 렌즈로 보면</b><dl class="tl-dl"><dt>그릇</dt><dd>${esc(og["그릇"])}</dd><dt>온도</dt><dd>${esc(og["온도"])}</dd><dt>균형</dt><dd>${esc(og["균형"])}</dd></dl>
      ${og["작용"]?.length ? `<p class="sub">${T(og["작용"].join(" / "), true)}</p>` : ""}</div>` : ""}
    ${lr["신살"]?.length ? `<div class="ss-sec"><b>✨ 이 시기에 들어오는 별</b><div class="ss-inline" style="margin-top:6px">${lr["신살"].map((n) => ssChip(n, "운")).join("")}</div>
      <ul class="tips">${lr["신살"].slice(0, 3).map((n) => `<li><b>${esc(n)}</b>: ${esc(S.sinsal["설명"][n]?.["운"] || "")}</li>`).join("")}</ul></div>` : ""}
    ${r.status === "past" && past ? `<div class="ss-sec"><b>✍️ 정리하는 한마디</b><p>${esc(past["정리"])}</p></div>` : ""}
    ${r.status === "now" && st["지금"]?.["올해"] ? `<div class="ss-sec"><b>🌕 올해 챙길 것</b><ul class="tips">${(st["지금"]["올해"]["준비"] || []).map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
    ${r.status === "future" && (nxt?.["준비"] || lr["신살"]?.length) ? `<div class="ss-sec"><b>🌱 미리 준비할 것</b><ul class="tips">${(nxt?.["준비"] || lr["신살"].slice(0, 2).map((n) => `${n}: ${S.sinsal["설명"][n]?.["준비"] || ""}`)).map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
    ${S.ai ? `<button class="ghost wide" type="button" data-ask="${esc(`${r.p["나이"]}세 ${r.p["간지"]} 대운이 내 사주에서 어떤 의미야?`)}" style="margin-top:10px">💬 이 10년을 냥이에게 더 묻기</button>` : ""}`);
}
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-tl]"); if (t) { openTimeline(t.dataset.tl); return; }
  const p = e.target.closest("[data-pane-go]"); if (p) { setSajuPane(p.dataset.paneGo); window.scrollTo({ top: 0, behavior: "smooth" }); }
});

// ───────────────────────── 초기화
async function init() {
  paintNyang();
  const form = $("#form-me");
  buildForm(form, "me", "생일을 알려줘");
  form.insertAdjacentHTML("beforeend", '<button class="btn primary wide" type="submit">냥이에게 사주 보여주기 🐾</button>');
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("button[type=submit]", form);
    btn.disabled = true; $(".error", form)?.remove();
    try { await loadMe(birthOf(form)); }
    catch (err) { form.insertAdjacentHTML("beforeend", `<p class="error">${esc(err.message)}</p>`); }
    finally { btn.disabled = false; }
  });
  $$(".bottom button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
  $("#btn-profile").addEventListener("click", () => { fillForm(form, S.birth); $("#main").hidden = true; $("#onboard").hidden = false; window.scrollTo({ top: 0 }); });

  const [meta, st, kinds] = await Promise.all([api("/api/meta").catch(() => ({ glossary: {} })), api("/api/status").catch(() => ({ ai: false })),
    api("/api/readings").catch(() => [])]);
  S.gloss = meta.glossary || {}; S.sinsal = meta.sinsal || {}; S.ai = !!st.ai; S.share = !!st.share; S.kinds = kinds; S.stories = meta.stories || []; S.pushKey = st.push_key || null; buildTermRe();
  $("#btn-restore")?.addEventListener("click", () => openBackup());
  if (location.hash.startsWith("#smoke=")) { await runSmoke(JSON.parse(decodeURIComponent(location.hash.slice(7)))); return; }
  const guest = new URLSearchParams(location.search).get("map");
  if (guest) { guestMap(guest); return; }
  $("#rd-back").addEventListener("click", () => (history.state?.reader ? history.back() : closeReader()));
  window.addEventListener("popstate", () => { if (!$("#reader").hidden) closeReader(); });

  let saved = null;
  try { saved = JSON.parse(localStorage.getItem("nyang:me") || "null"); } catch { saved = null; }
  if (saved) {
    fillForm(form, saved);
    $("#main").hidden = false; loading($("#tab-home"));
    try { await loadMe(saved); return; } catch { $("#main").hidden = true; }
  }
  $("#onboard").hidden = false;
}
init();
