"use strict";
/* 사주냥이 화면 스크립트 — 모든 계산은 서버(/api/saju)가 하고, 여기서는 보여주기만 한다. */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ELEM = ["목", "화", "토", "금", "수"];
const HANJA = { 목: "木", 화: "火", 토: "土", 금: "金", 수: "水" };
const S = { birth: null, d: null, gloss: {}, ai: false, chat: { history: [], partner: null, topic: null } };

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
  if (html.includes("[[")) return html.replace(/\[\[(.+?)\]\]/g, (_, t) => (S.gloss[t] ? mk(t, t) : esc(t)));
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

// ───────────────────────── 바텀시트
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
  $$('input[type="radio"]', form).forEach((r) => (r.name = `${key}-${r.name}`));
  const sync = () => { $(".leap", form).hidden = val(form, "calendar") !== "lunar"; form.time.disabled = form.unknown.checked; };
  form.addEventListener("change", sync);
  form._sync = sync;
  sync();
}
const val = (form, n) => (form.querySelector(`input[name$="-${n}"]:checked`) || {}).value;
function birthOf(form) {
  const unknown = form.unknown.checked;
  const [h, mi] = (form.time.value || "12:00").split(":").map(Number);
  return {
    name: form.nm.value.trim(), gender: val(form, "gender"), calendar: val(form, "calendar"),
    leap: val(form, "calendar") === "lunar" && form.leap.checked,
    year: +form.year.value, month: +form.month.value, day: +form.day.value,
    hour: unknown ? null : h, minute: unknown ? 0 : mi, longitude: +form.longitude.value,
    zi_mode: form.split.checked ? "split" : "unified",
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
  renderHome(); renderLuck(); renderSaju(); renderCompat(); $("#tab-talk").innerHTML = "";
  paintNyang($("#main"));
}

// ───────────────────────── 홈
function ring(score, label, cls = "", color = "var(--pink)") {
  return `<div class="ring ${cls}" style="--p:${score};--c:${color}"><div><span><b>${score}</b><small>${esc(label)}</small></span></div></div>`;
}
function renderHome() {
  const d = S.d, f = d["운세"], t = f["오늘운세"], y = f["신년운세"], st = d["옛이야기"];
  const nm = d["이름"] || "너";
  const key = "nyang:mission:" + t.date;
  const done = localStorage.getItem(key) === "1";
  const moods = t["점수"] >= 72 ? "happy" : t["점수"] >= 50 ? "normal" : "think";
  $("#tab-home").innerHTML = `
    <div class="greet"><span class="float" data-nyang="${moods}" data-size="92"></span>
      <div class="bubble">${esc(nm)}, 오늘의 [일진]은 <b>${esc(t["일진"])}</b>이다냥.<br>${T(t["한마디"])}</div></div>
    <div class="card tint-pink" style="margin-top:14px">
      <div class="card-head"><h2>오늘의 운세</h2><span class="badge pink">${esc(t.date.slice(5).replace("-", "월 "))}일</span></div>
      <div class="today">${ring(t["점수"], t["등급"])}
        <div><div class="sub">${chip("일진")} 십성 · ${T(t["십성"], true)}</div>
        <div style="margin-top:6px">${T(t["한마디"])}</div>
        ${t["작용"].length ? `<div class="sub" style="margin-top:6px">${T(t["작용"].slice(0, 2).join(" · "), true)}</div>` : ""}</div></div>
      <div class="lucky"><div><small>행운 색</small>${esc(t["행운"]["색"])}</div><div><small>숫자</small>${esc(t["행운"]["숫자"])}</div>
        <div><small>방위</small>${esc(t["행운"]["방위"])}</div><div><small>음식</small>${esc(t["행운"]["음식"])}</div></div>
      <div class="mission ${done ? "done" : ""}" id="mission"><span>${done ? "✅" : "⬜"}</span><span>오늘의 개운 미션: ${esc(t["미션"])}</span></div>
    </div>
    <button class="banner" data-go="luck:new" type="button"><div><small>${y["연도"]}년 ${esc(y["간지"])} · 신년운세 도착!</small>
      <div class="t">'${esc(y["테마"])}'</div><small>총운 ${y["총운"]}점 · 좋은 달 ${y["좋은달"].join("·")}월</small></div><span class="big">🧧</span></button>
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
  $("#tab-home .bubble").innerHTML = $("#tab-home .bubble").innerHTML.replace("[일진]", chip("일진"));
  $("#mission").addEventListener("click", (e) => {
    const on = localStorage.getItem(key) !== "1";
    localStorage.setItem(key, on ? "1" : "0");
    e.currentTarget.classList.toggle("done", on);
    e.currentTarget.firstElementChild.textContent = on ? "✅" : "⬜";
  });
  $("#btn-gloss").addEventListener("click", openGlossary);
}

// ───────────────────────── 운세
const DOM_IC = { 재물운: "💰", 직업운: "💼", 연애운: "💗", 건강운: "🌿", 학업운: "📚", 인간관계: "👥" };
function renderLuck() {
  const f = S.d["운세"], y = f["신년운세"], life = f["평생운"];
  const months = y["월별"].map((m) => {
    const cls = y["좋은달"].includes(m["월"]) ? "good" : y["조심할달"].includes(m["월"]) ? "bad" : "";
    return `<div class="mon ${cls}"><div class="m">${m["월"]}월</div><div class="gz">${esc(m["절기"])} ${esc(m["시작"])}~ · ${esc(m["간지"])}</div>
      <span class="s">${m["점수"]}</span><div class="track"><div class="fill" style="width:${m["점수"]}%"></div></div>
      <p>${T(m["한마디"])}</p><p class="sub" style="margin-top:2px">${T(m["십성"], true)}</p></div>`;
  }).join("");
  $("#tab-luck").innerHTML = `
    <div class="segtabs" role="tablist"><button data-sub="new" type="button">${y["연도"]} 신년운세</button><button data-sub="month" type="button">월별 운세</button><button data-sub="life" type="button">평생 총운</button></div>
    <div data-pane="new">
      <div class="card tint-lav">
        <div class="yhead">${ring(y["총운"], y["등급"], "", "var(--lav)")}
          <div><div class="gz">${y["연도"]}년 ${esc(y["간지"])} · ${T(y["십성"], true)}</div><div class="theme">${esc(y["테마"])}</div>
          <div class="sub">${chip("세운")} 12운성 ${chip(y["12운성"])}</div></div></div>
        <div class="say" style="margin-top:14px"><span class="who" data-nyang="wink" data-size="54"></span><div class="bubble">${T(y["총평"])}</div></div>
      </div>
      <div class="card"><h2>분야별 운세</h2><div class="dom">
        ${Object.entries(y["분야"]).map(([k, v]) => `<div class="dom-row"><span class="ic">${DOM_IC[k]}</span><span class="n">${k}</span>
          <div class="track"><div class="fill" style="width:${v}%"></div></div><span class="v">${v}</span></div>`).join("")}</div>
        <p class="sub" style="margin:12px 0 0">점수는 올해 기운이 내 ${chip("용신")}과 맞는지, 원국과 ${chip("합")}·${chip("충")}이 생기는지로 계산한 '순풍/역풍' 지표다냥.</p></div>
      <div class="card"><h2>냥이의 ${y["연도"]}년 조언</h2><ul class="tips">${y["조언"].map((x) => `<li>${T(x, true)}</li>`).join("")}</ul>
        ${y["작용"].length ? `<h3 style="margin-top:16px">원국과 만나는 작용</h3><div class="chips">${y["작용"].map((x) => `<span class="chip">${T(x, true)}</span>`).join("")}</div>` : ""}
        <p class="sub" style="margin:14px 0 0">좋은 달 <b>${y["좋은달"].join("·")}월</b> · 살살 갈 달 <b>${y["조심할달"].join("·")}월</b></p></div>
      <button class="btn lav wide" type="button" data-ask="${y["연도"]}년 내 운세를 연애·일·돈으로 나눠서 자세히 풀어줘">💬 냥이에게 ${y["연도"]}년 더 물어보기</button>
    </div>
    <div data-pane="month" hidden>
      <div class="say"><span class="who" data-nyang="normal" data-size="54"></span><div class="bubble">사주 달력은 양력 1일이 아니라 ${chip("절입")}일에 달이 바뀐다냥. 초록 카드가 냥이 추천 달!</div></div>
      <div class="months">${months}</div>
    </div>
    <div data-pane="life" hidden>
      <div class="card life"><div class="card-head"><h2>인생 흐름 그래프</h2><span class="badge">${chip("대운")} 10년 단위</span></div>
        ${lifeChart(life["대운"])}
        <div class="say" style="margin-top:10px"><span class="who" data-nyang="happy" data-size="54"></span>
          <div class="bubble">앞으로 가장 크게 피어나는 시기는 <b>${life["전성기"]["나이"]}세(${life["전성기"]["시작"]}년~)</b> '${esc(life["전성기"]["테마"])}'다냥!
          ${life["현재"] ? `<br>지금은 ${life["현재"]["나이"]}세 대운 '${esc(life["현재"]["테마"])}'의 한가운데에 있다냥.` : ""}</div></div></div>
      <div class="card"><h2>대운 한눈에 보기</h2><div class="dw-list">${life["대운"].map((p) => `<div class="dw ${p["현재"] ? "now" : ""}">
        <div class="age">${p["나이"]}세</div><div class="gz">${esc(p["간지"])}</div><div>${p["점수"]}점</div><div class="th">${esc(p["테마"])}<br>${T(p["십성"], true)}</div></div>`).join("")}</div></div>
      <div class="card"><h2>앞으로 10년</h2><div class="dom">${f["앞으로10년"].map((x) => `<div class="dom-row" style="grid-template-columns:52px 1fr 34px">
        <span class="n">${x["연도"]}</span><div><div class="track"><div class="fill" style="width:${x["점수"]}%"></div></div><div class="sub" style="font-size:12.5px">${esc(x["간지"])} · ${esc(x["테마"])}</div></div><span class="v">${x["점수"]}</span></div>`).join("")}</div></div>
    </div>`;
  $$("#tab-luck .segtabs button").forEach((b) => b.addEventListener("click", () => setLuck(b.dataset.sub)));
  setLuck("new");
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
  const d = S.d, a = d["해석"], y = d["용신"], mt = d["운세"]["맞춤"], gw = d["운세"]["개운법"];
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
    <div class="card"><div class="card-head"><h2>${chip("원국", "나의 사주 원국")}</h2><span class="badge">${chip("사주팔자", "팔자 여덟 글자")}</span></div>
      <div class="pillars">${pillars}</div>
      <p class="sub" style="margin:12px 0 0">위는 ${chip("천간")}, 아래는 ${chip("지지")}. 글자 위아래 작은 글씨는 ${chip("십성")}과 ${chip("12운성")}, 맨 아래는 ${chip("지장간")}이다냥. 밑줄 친 말을 누르면 냥이가 설명해 준다냥!</p></div>
    <div class="card"><h2>${chip("오행")} 밸런스</h2><div class="bars">${bars}</div>
      <p class="sub" style="margin:12px 0 0">십성 비중 · ${Object.entries(d["십성 비중(%)"]).map(([k, v]) => `${chip(k)} ${v}%`).join(" · ")}</p></div>
    <div class="card tint-lav"><div class="card-head"><h2>냥이의 쉬운 해석</h2><span class="float" data-nyang="normal" data-size="50"></span></div><div class="easy">${easy}</div></div>
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
      <div class="final"><small>냥이의 최종 판단 · 가장 먼저 챙길 기운</small><b>${esc(sy["최종용신"])}</b><p>${T(sy["최종근거"], true)}</p></div>
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
function renderCompat() {
  $("#tab-compat").innerHTML = `
    <div class="say"><span class="who" data-nyang="happy" data-size="64"></span><div class="bubble">두 사람의 ${chip("일간")}, 배우자 자리(${chip("일지")}), 서로의 ${chip("용신")}까지 정밀하게 보는 궁합이다냥 💞</div></div>
    <div class="pair"><form id="form-b" class="card form" autocomplete="off"></form></div>
    <button class="btn primary wide" id="btn-compat" type="button">궁합 보기</button>
    <div id="compat-out" style="margin-top:16px"></div>`;
  buildForm($("#form-b"), "b", "상대방 생일");
  fillForm($("#form-b"), JSON.parse(localStorage.getItem("nyang:partner") || "null"));
  $("#btn-compat").addEventListener("click", runCompat);
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
    const who = (t) => String(t).replace(/1번/g, r.names[0]).replace(/2번/g, r.names[1]);
    r.items.forEach((x) => { x["항목"] = who(x["항목"]); x["해석"] = who(x["해석"]); });
    out.innerHTML = `<div class="card tint-pink"><div class="yhead">${ring(r.score, r.grade)}<div>
        <div class="theme">${esc(r.names[0])} 💞 ${esc(r.names[1])}</div><div class="sub">${esc(r["띠"][0])}띠 · ${esc(r["띠"][1])}띠</div></div></div>
        <div class="say" style="margin-top:12px"><span class="who" data-nyang="${mood}" data-size="54"></span><div class="bubble">${say}</div></div>
        <p class="sub" style="margin:6px 0 0">${esc(r.names[0])}: ${T(r["1번"], true)}<br>${esc(r.names[1])}: ${T(r["2번"], true)}</p></div>
      <div class="card"><h2>항목별 궁합</h2>${r.items.map((x) => `<div class="citem"><b>${T(x["항목"], true)}</b>
        <span class="pt ${x["점수"] > 0 ? "pos" : x["점수"] < 0 ? "neg" : ""}">${x["점수"] > 0 ? "+" : ""}${x["점수"]}</span><p>${T(x["해석"], true)}</p></div>`).join("")}
        <p class="sub">${esc(r.note)}</p></div>
      ${S.ai ? `<button class="btn lav wide" type="button" id="btn-compat-ai">💬 냥이에게 우리 궁합 상담하기</button>` : ""}`;
    paintNyang(out);
    $("#btn-compat-ai")?.addEventListener("click", () => { S.chat = { history: [], partner: b, topic: null }; $("#tab-talk").innerHTML = ""; askNyang("우리 둘 궁합을 잘 맞는 점, 부딪히는 점, 조언으로 풀어줘"); });
  } catch (e) { out.innerHTML = `<div class="card"><p class="error">${esc(e.message)}</p></div>`; }
  finally { btn.disabled = false; }
}

// ───────────────────────── 상담
const CRISIS = /(죽고\s*싶|자살|사라지고\s*싶|살기\s*싫|자해|목숨|끝내고\s*싶)/;
const ROUTE = [
  [/썸|짝사랑|고백|좋아하는 사람/, "love", "some"], [/헤어|이별|전남친|전여친|재회/, "love", "breakup"],
  [/인연|언제.*(만나|생겨|연애)|솔로|소개팅/, "love", "when"], [/남친|여친|애인|연인|싸웠|권태/, "love", "dating"], [/이상형|잘 맞는 사람/, "love", "type"],
  [/상사|팀장|부장|동료|직장 사람/, "work", "boss"], [/퇴사|그만두|이직|회사 가기 싫/, "work", "quit"], [/취업|합격|면접|서류/, "work", "job"], [/적성|맞는 일|직업/, "work", "fit"],
  [/투자|주식|코인|부업/, "money", "invest"], [/돈.*(언제|운)|재물운/, "money", "when"], [/돈|저축|월급|빚|카드값/, "money", "save"],
  [/친구|서운|손절/, "people", "friend"], [/엄마|아빠|부모|가족|언니|오빠|동생|형/, "people", "family"], [/사람.*(지쳐|피곤)|인간관계/, "people", "tired"],
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
  const tab = $("#tab-talk");
  if (tab.dataset.ready === "1" && chatEl()) return;
  tab.dataset.ready = "1";
  tab.innerHTML = `
    <div class="card tint-lav" style="text-align:center"><span class="float" data-nyang="happy" data-size="96" style="display:inline-block"></span>
      <h2 style="margin:6px 0 2px">사주냥이 고민 상담소</h2><p class="sub" style="margin:0">2천 년 동안 인간의 사주를 봐 온 냥이가 네 사주로 답해 준다냥</p></div>
    ${S.chat.partner ? `<p class="ctx-note">💞 상대방 사주도 함께 보고 있어요</p>` : ""}
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
async function handleFree(q) {
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
      body: JSON.stringify({ birth: S.birth, partner: S.chat.partner, messages: S.chat.history.slice(-28) }) });
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

  const [meta, st] = await Promise.all([api("/api/meta").catch(() => ({ glossary: {} })), api("/api/status").catch(() => ({ ai: false }))]);
  S.gloss = meta.glossary || {}; S.ai = !!st.ai; buildTermRe();

  const saved = JSON.parse(localStorage.getItem("nyang:me") || "null");
  if (saved) {
    fillForm(form, saved);
    $("#main").hidden = false; loading($("#tab-home"));
    try { await loadMe(saved); return; } catch { $("#main").hidden = true; }
  }
  $("#onboard").hidden = false;
}
init();
