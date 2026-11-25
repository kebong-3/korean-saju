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
  paintNyang($("#sheet-content"));
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
  for (let y = 2100; y >= 1900; y--) form.year.add(new Option(`${y}년`, y));
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
async function loadMe(birth) {
  S.d = await api("/api/saju", birth);
  S.birth = birth;
  localStorage.setItem("nyang:me", JSON.stringify(birth));
  S.chat = { history: [], partner: null, topic: null };
  renderAll();
  $("#onboard").hidden = true; $("#main").hidden = false;
  showTab("home");
}
function loading(el) { el.innerHTML = `<div class="loading"><span data-nyang="think" data-size="80"></span>냥이가 만세력을 펼치는 중…</div>`; paintNyang(el); }

function showTab(tab, sub) {
  $$(".bottom button").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === tab));
  $$(".tab").forEach((s) => (s.hidden = s.id !== `tab-${tab}`));
  if (tab === "luck" && sub) setLuck(sub);
  if (tab === "talk") startTalk();
  if (tab === "path") renderPath(sub);
  if (tab === "saju") {
    const pane = ["basic", "ogo", "manse"].includes(sub) ? sub : "basic";
    setSajuPane(pane);
    if (sub && pane === "basic") { requestAnimationFrame(() => $(`#${sub}`)?.scrollIntoView({ behavior: "smooth", block: "start" })); return; }
  }
  window.scrollTo({ top: 0 });
}

function renderAll() {
  const d = S.d, i = d["입력"];
  $("#me-name").textContent = d["이름"] || "나";
  $("#me-sub").textContent = `${i["띠"]}띠 · ${d["원국"]["일주"]["한글"]}일주`;
  renderHome(); renderLuck(); renderSaju(); renderCompat(); renderPath(); $("#tab-talk").innerHTML = "";
  paintNyang($("#main"));
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
  markVisit(t);
  const nm = d["이름"] || "너";
  const key = "mission:" + t.date;
  const done = store.get(key, 0) === 1;
  const moods = t["점수"] >= 72 ? "happy" : t["점수"] >= 50 ? "normal" : "think";
  $("#tab-home").innerHTML = `
    <div class="greet"><span class="float" data-nyang="${moods}" data-size="92"></span>
      <div class="bubble">${esc(nm)}, 오늘의 ${chip("일진")}은 <b>${esc(t["일진"])}</b>이다냥.<br>${T(t["한마디"])}</div></div>
    <div class="card tint-pink" style="margin-top:14px">
      <div class="card-head"><h2>오늘의 운세</h2><span class="badge pink">${+t.date.slice(5, 7)}월 ${+t.date.slice(8, 10)}일 ${esc(t["신호"] || "")}</span></div>
      <div class="today">${ring(t["점수"], t["등급"])}
        <div><div class="sub">${chip("일진")} 십성 · ${T(t["십성"], true)}</div>
        <div style="margin-top:6px">${T(t["한마디"])}</div>
        ${(t["쉬운작용"] || []).length ? `<ul class="tips easy-rel">${t["쉬운작용"].slice(0, 2).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        ${t["작용"].length ? `<details class="raw-rel"><summary class="sub">명리 원문 보기</summary><p class="sub">${T(t["작용"].join(" · "), true)}</p></details>` : ""}</div></div>
      <div class="lucky"><div><small>행운 색</small>${esc(t["행운"]["색"])}</div><div><small>숫자</small>${esc(t["행운"]["숫자"])}</div>
        <div><small>방위</small>${esc(t["행운"]["방위"])}</div><div><small>음식</small>${esc(t["행운"]["음식"])}</div></div>
      <button type="button" class="mission ${done ? "done" : ""}" id="mission" aria-pressed="${done}"><span>${done ? "✅" : "⬜"}</span><span>오늘의 개운 미션: ${esc(t["미션"])}</span></button>
      ${hoursStrip(f["시간대"])}
      <p class="sub" style="margin:6px 0 0">시간대별 기운 · 좋은 시간 <b>${f["시간대"]["좋은시간"].join("·")}</b> · 살살 갈 시간 ${f["시간대"]["조심시간"].join("·")}</p>
      <div class="rd-cta"><button class="btn primary" type="button" data-read="day">☀️ 오늘 운세 자세히</button>
        <button class="btn lav" type="button" data-read="tomorrow">🌙 내일 운세 (${f["내일운세"]["점수"]}점)</button></div>
    </div>
    ${monthCard(f["이번달"])}
    ${todayStory(d["이야기"]?.["오늘"])}
    <div id="checkin-slot">${checkinCard()}</div>
    ${wisdomCard(d["나의길"]?.["한구절"])}
    ${readMenu()}
    ${pathTeaser()}
    <div id="install-slot"></div>
    <button class="banner" data-go="luck:new" type="button"><div><small>${y["연도"]}년 ${esc(y["간지"])} · 신년운세 도착!</small>
      <div class="t">'${esc(y["테마"])}'</div><small>총운 ${y["총운"]}점 · 좋은 달 ${(y["좋은달표시"] || y["좋은달"].map((m) => m + "월")).join("·")}</small></div><span class="big">🧧</span></button>
    <div class="menu" style="margin-bottom:16px">
      ${[["luck:new", "🧧", `${y["연도"]} 신년운세`, "var(--pink-l)"], ["luck:month", "📅", "월별 운세", "var(--butter-l)"], ["luck:life", "📈", "평생 총운", "var(--lav-l)"],
        ["saju:fit", "🎯", "나에게 맞는", "var(--mint-l)"], ["saju:rx", "🍀", "개운 처방전", "var(--mint-l)"], ["compat", "💞", "궁합", "var(--pink-l)"],
        ["talk", "💬", "고민 상담", "var(--lav-l)"], ["saju:ogo", "🏛️", "오고 정밀감명", "var(--peach-l)"], ["glossary", "📚", "명리 교실", "var(--butter-l)"]]
        .map(([g, ic, l, bg]) => `<button type="button" ${g === "glossary" ? 'id="btn-gloss"' : `data-go="${g}"`}><i style="background:${bg}">${ic}</i>${l}</button>`).join("")}
    </div>
    <div class="card story">
      <div class="card-head"><h2>냥이의 옛이야기</h2><span class="badge">${esc(st["시대"])}</span></div>
      <h3>『${esc(st["제목"])}』</h3><p style="margin:0">${esc(st["이야기"])}</p>
      <div class="lesson">🐾 ${esc(st["교훈"])} <span class="sub">— ${T(st["개념"], true)}</span></div>
    </div>
    <p class="foot">사주는 정답지가 아니라 지도다냥. 건강·법률·투자 판단은 전문가와 상의해 줘!<br>
      계산 엔진 <a href="https://github.com/kebong-3/korean-saju" target="_blank" rel="noopener">korean-saju</a> · 천문 계산 만세력 · 옛이야기는 창작 설화예요</p>`;
  $("#mission").addEventListener("click", (e) => {
    const on = store.get(key, 0) !== 1;
    store.set(key, on ? 1 : 0);
    e.currentTarget.classList.toggle("done", on);
    e.currentTarget.setAttribute("aria-pressed", on);
    e.currentTarget.firstElementChild.textContent = on ? "✅" : "⬜";
  });
  $("#btn-gloss").addEventListener("click", openGlossary);
}

function monthCard(m) {
  if (!m) return "";
  return `<div class="card tint-butter month-now"><div class="card-head"><h2>🗓️ 이번 달 냥이 플랜</h2><span class="badge">${esc(m["신호"])}</span></div>
    <p class="sub" style="margin:0 0 8px">${esc(m["절기"])} ${esc(m["시작"])} ~ ${esc(m["끝"] || "")} · ${esc(m["간지"])} · ${T(m["십성"], true)}</p>
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
      <p>${esc(SY["월핵심"]?.[m["월"]] || m["한마디"])}</p>${SY["월"]?.[m["월"]] ? moreSet([["더 보기", `<p>${esc(SY["월"][m["월"]])}</p>`]]) : ""}<p class="sub" style="margin-top:2px">${T(m["십성"], true)}</p></div>`;
  }).join("");
  $("#tab-luck").innerHTML = `
    <div class="segtabs" role="tablist"><button data-sub="cal" type="button">운세 달력</button><button data-sub="new" type="button">${y["연도"]} 신년</button><button data-sub="month" type="button">월별 운세</button><button data-sub="life" type="button">평생 총운</button></div>
    <div data-pane="cal" hidden>${renderCal(f["달력"])}</div>
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
      <div class="say"><span class="who" data-nyang="normal" data-size="54"></span><div class="bubble">사주 달력은 양력 1일이 아니라 ${chip("절입")}일에 달이 바뀐다냥. 초록 카드가 냥이 추천 달!</div></div>
      <button class="btn primary wide" type="button" data-read="month" style="margin-bottom:14px">🌙 이번 달 운세 대풀이 듣기</button>
      <div class="months">${months}</div>
    </div>
    <div data-pane="life" hidden>
      <button class="btn primary wide" type="button" data-read="daewoon" style="margin-bottom:14px">📈 대운 인생지도 대풀이 듣기</button>
      <div class="card life"><div class="card-head"><h2>인생 흐름 그래프</h2><span class="badge">${chip("대운")} 10년 단위</span></div>
        ${lifeChart(life["대운"])}
        <div class="say" style="margin-top:10px"><span class="who" data-nyang="happy" data-size="54"></span>
          <div class="bubble">앞으로 가장 크게 피어나는 시기는 <b>${life["전성기"]["나이"]}세(${life["전성기"]["시작"]}년~)</b> '${esc(life["전성기"]["테마"])}'다냥!
          ${life["현재"] ? `<br>지금은 ${life["현재"]["나이"]}세 대운 '${esc(life["현재"]["테마"])}'의 한가운데에 있다냥.` : ""}</div></div></div>
      ${SL["핵심"] ? punchCard("인생 지도 한 줄 요약", SL["핵심"], "think", [["📖 자세히 풀이", paras(SL["서문"])], ["🌟 전성기 이야기", paras(SL["전성기"])], ["🏮 냥이 설화", taleHtml(SL["설화"])]])
        : storyCard("냥이 도사가 읽은 너의 인생 지도", SL["서문"], "think")}
      ${SL["지금핵심"] ? punchCard("지금, 그리고 앞으로 10년", SL["지금핵심"], "wink", [["📖 자세히 풀이", paras(SL["지금"])]]) : storyCard("지금, 그리고 앞으로 10년", SL["지금"], "wink")}
      ${SL["대운"]?.length ? `<div class="card"><h2>📜 대운 이야기 — 10년마다 바뀌는 인생의 계절</h2><div class="chaps">${SL["대운"].map((x, i) => {
        const cur = life["대운"][i]?.["현재"];
        return chapter({ icon: cur ? "⭐" : "🍂", title: `${x["나이"]}세 ${x["간지"]} · ${x["제목"]}${cur ? " (지금)" : ""}`, summary: `${life["대운"][i]?.["시작"] ?? ""}년~ · ${life["대운"][i]?.["점수"] ?? ""}점`, "핵심": x["핵심"], story: x.story, "설화": x["설화"] });
      }).join("")}</div></div>` : ""}
      ${SL["핵심"] ? "" : storyCard("너의 전성기", SL["전성기"], "happy")}
      <div class="card"><h2>대운 한눈에 보기</h2><div class="dw-list">${life["대운"].map((p) => `<div class="dw ${p["현재"] ? "now" : ""}">
        <div class="age">${p["나이"]}세</div><div class="gz">${esc(p["간지"])}</div><div>${p["점수"]}점</div><div class="th">${esc(p["테마"])}<br>${T(p["십성"], true)}</div></div>`).join("")}</div></div>
      <div class="card"><h2>앞으로 10년</h2><div class="dom">${f["앞으로10년"].map((x) => `<div class="dom-row" style="grid-template-columns:52px 1fr 34px">
        <span class="n">${x["연도"]}</span><div><div class="track"><div class="fill" style="width:${x["점수"]}%"></div></div><div class="sub" style="font-size:12.5px">${esc(x["간지"])} · ${esc(x["테마"])}</div></div><span class="v">${x["점수"]}</span></div>`).join("")}</div></div>
    </div>`;
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
    <div class="segtabs" role="tablist"><button data-pane="basic" type="button">기본 풀이</button><button data-pane="ogo" type="button">오고 정밀 감명</button><button data-pane="manse" type="button">만세력</button></div>
    <div data-spane="basic">
    <button class="btn primary wide" type="button" data-read="life" style="margin-bottom:14px">📜 냥이 도사의 평생 사주 총평 듣기</button>
    <div class="card"><div class="card-head"><h2>${chip("원국", "나의 사주 원국")}</h2><span class="badge">${chip("사주팔자", "팔자 여덟 글자")}</span></div>
      <div class="pillars">${pillars}</div>
      <p class="sub" style="margin:12px 0 0">위는 ${chip("천간")}, 아래는 ${chip("지지")}. 글자 위아래 작은 글씨는 ${chip("십성")}과 ${chip("12운성")}, 맨 아래는 ${chip("지장간")}이다냥. 밑줄 친 말을 누르면 냥이가 설명해 준다냥!</p></div>
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
    <div class="card"><h2>${chip("신살")} · ${chip("합")}${chip("충")}</h2>
      <div class="chips">${sinsal.length ? sinsal.map((s) => `<span class="chip">${S.gloss[s] ? chip(s) : esc(s)} (${esc(d["신살"][s].join("·"))})</span>`).join("") : '<span class="sub">특별한 신살이 없다냥</span>'}</div>
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
  setSajuPane("basic");
}
function setSajuPane(p) {
  $$("#tab-saju .segtabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.pane === p));
  $$("#tab-saju [data-spane]").forEach((x) => (x.hidden = x.dataset.spane !== p));
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
      <div class="dw3-list">${dw}</div>
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
  const title = `${d["이름"] ? esc(d["이름"]) + " 님의 " : ""}만세력`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" font-family="Gowun Dodum, Apple SD Gothic Neo, Malgun Gothic, sans-serif" role="img" aria-label="만세력">
    <rect width="${W}" height="${H}" rx="24" fill="#fff"/>
    <text x="24" y="40" font-size="24" font-weight="700" fill="#3b2f4a">${title}</text>
    <text x="24" y="66" font-size="13" fill="#8a7f99">양력 ${esc(i["양력"])} ${esc(i["시각"] || "시간 미상")} · ${esc(i["음력"])} · ${esc(i["성별"])} · ${esc(i["띠"])}띠</text>
    <text x="${W - 24}" y="40" font-size="14" text-anchor="end" fill="#f0607d">사주냥이</text>
    ${order.map((lbl, k) => `<text x="${x0 + k * cw + cw / 2}" y="88" text-anchor="middle" font-size="14" fill="${lbl === "일주" ? "#f0607d" : "#8a7f99"}">${lbl}${lbl === "일주" ? " (나)" : ""}</text>`).join("")}
    ${body}${dws}</svg>`;
}
function renderManse(d) {
  return `<div class="card"><div class="card-head"><h2>만세력</h2><button class="ghost" id="btn-manse-png" type="button">🖼️ 이미지로 저장</button></div>
    <div id="manse-svg">${manseSvg(d)}</div>
    <p class="sub" style="margin:10px 0 0">절입 ${esc(d["절입"]["직전"])} → ${esc(d["절입"]["직후"])} · ${(d["입력"]["보정"] || []).map(esc).join(" · ")}</p>
    ${(d["주의"] || []).map((x) => `<p class="error">⚠ ${esc(x)}</p>`).join("")}</div>`;
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
let compatMode = "love";
function renderCompat() {
  const m = married(), kidsN = S.birth?.kids || 0;
  $("#tab-compat").innerHTML = `
    <div class="segtabs" role="tablist"><button data-cmode="love" type="button">${m ? "💑 부부 궁합" : "💞 연인 궁합"}</button><button data-cmode="child" type="button">👨‍👧 자녀 궁합${kidsN ? "" : ""}</button></div>
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
    const r = await api("/api/compat", { a: S.birth, b });
    const mood = r.score >= 72 ? "happy" : r.score >= 58 ? "wink" : "think";
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
    <div class="say" style="margin-bottom:12px"><span class="who" data-nyang="wink" data-size="48"></span><div class="bubble">궁금한 걸 콕 누르면 핵심만 쏙쏙! 더 듣고 싶으면 '길게 듣기'도 있다냥.</div></div>
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
  const nm = S.d["이름"] || "너";
  body.innerHTML = `<div class="rd-hero"><span class="float" data-nyang="think" data-size="104"></span>
      <div class="bubble big" id="rd-intro">흠흠… ${esc(nm)}의 <b>${esc(title)}</b>이라.<br>냥이 도사가 ${o.long ? "2천 년 묵은 두루마리를 통째로 펼치는" : "핵심만 쏙쏙 골라내는"} 중이다냥…</div></div>
    <article class="scroll-paper" id="rd-text"><p><span class="typing"></span></p></article>
    ${o.long ? "" : `<button class="btn lav wide" type="button" id="rd-long" hidden style="margin-top:14px">📜 길게 듣기 — 설화·자세한 풀이까지</button>`}
    <div class="rd-actions" id="rd-actions" hidden><button class="ghost" type="button" id="rd-again">🔄 다시 풀이</button>
      <button class="ghost" type="button" id="rd-copy">📋 복사</button><button class="ghost" type="button" id="rd-share">📤 공유</button></div>
    <p class="rd-note" id="rd-note">사주는 정답지가 아니라 지도다냥. 건강·법률·투자 판단은 전문가와 상의해 줘!</p>`;
  paintNyang(body);
  $(".rd-scroll", R).scrollTop = 0;
  const box = $("#rd-text"), key = kind === "dream" ? null : rdCacheKey(kind, o);
  const render = (txt) => { box.innerHTML = md(txt, new Set()); };
  const finish = (txt, note) => {
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
  if (cached) { render(cached); finish(cached, "이전에 받은 풀이를 다시 보여주는 중이다냥. 새로 듣고 싶으면 '다시 풀이'를 눌러 줘."); return; }

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
  if (text && !err && !fallback && key) { try { localStorage.setItem(key, text); } catch { /* 저장 공간 부족 */ } }
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
  return `<div class="card checkin"><div class="card-head"><h2>🐾 냥이 출석부</h2><span class="badge pink">${n}일 연속</span></div>
    <div class="stamps">${week.map((dd) => `<div class="${days[dd] ? "on" : ""} ${dd === today ? "is-today" : ""}"><span>${days[dd] ? (diary[dd] ? MOODS[diary[dd].mood][0] : "🐾") : ""}</span><small>${"일월화수목금토"[new Date(dd + "T00:00:00").getDay()]}</small></div>`).join("")}</div>
    <p class="sub" style="margin:10px 0 6px">${n >= 7 ? `일주일 개근! 냥이가 꾹꾹이 해 준다냥 🐾` : n >= 3 ? `${n}일째 출석 중, 이 기세로 가자냥!` : "매일 들르면 도장이 쌓인다냥. 7일 개근에 도전!"}</p>
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
  $("#checkin-slot .card").insertAdjacentHTML("beforeend", `<div class="say" style="margin-top:10px"><span class="who" data-nyang="${+i === 0 ? "think" : "happy"}" data-size="44"></span><div class="bubble">${say}</div></div>`);
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
  S.gloss = meta.glossary || {}; S.ai = !!st.ai; S.kinds = kinds; buildTermRe();
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
