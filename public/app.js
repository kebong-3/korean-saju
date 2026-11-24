"use strict";
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ELEM = ["목", "화", "토", "금", "수"];
const ELEM_HANJA = { 목: "木", 화: "火", 토: "土", 금: "金", 수: "水" };
let AI_ON = false;

// ───────────────────────── 폼
function buildForm(form, key, title) {
  form.append($("#tpl-birth").content.cloneNode(true));
  $('[data-slot="title"]', form).textContent = title;
  const ys = form.year, ms = form.month, ds = form.day;
  for (let y = 2100; y >= 1900; y--) ys.add(new Option(`${y}년`, y));
  for (let m = 1; m <= 12; m++) ms.add(new Option(`${m}월`, m));
  for (let d = 1; d <= 31; d++) ds.add(new Option(`${d}일`, d));
  ys.value = 1990; ms.value = 1; ds.value = 1;
  // 라디오 이름이 폼마다 겹치지 않게
  form.querySelectorAll('input[type="radio"]').forEach((r) => (r.name = `${key}-${r.name}`));
  const leap = $(".leap", form);
  const sync = () => {
    leap.hidden = val(form, "calendar") !== "lunar";
    form.time.disabled = form.unknown.checked;
  };
  form.addEventListener("change", () => { sync(); save(form, key); });
  load(form, key); sync();
}
const val = (form, n) => (form.querySelector(`input[name$="-${n}"]:checked`) || {}).value;

function birthOf(form) {
  const unknown = form.unknown.checked;
  const [h, mi] = (form.time.value || "12:00").split(":").map(Number);
  return {
    name: form.nm.value.trim(),
    gender: val(form, "gender"),
    calendar: val(form, "calendar"),
    leap: val(form, "calendar") === "lunar" && form.leap.checked,
    year: +form.year.value, month: +form.month.value, day: +form.day.value,
    hour: unknown ? null : h, minute: unknown ? 0 : mi,
    longitude: +form.longitude.value,
    zi_mode: form.split.checked ? "split" : "unified",
  };
}
function save(form, key) { try { localStorage.setItem("saju:" + key, JSON.stringify(birthOf(form))); } catch {} }
function load(form, key) {
  let b; try { b = JSON.parse(localStorage.getItem("saju:" + key)); } catch {}
  if (!b) return;
  form.nm.value = b.name || "";
  for (const k of ["gender", "calendar"]) {
    const r = form.querySelector(`input[name$="-${k}"][value="${b[k]}"]`);
    if (r) r.checked = true;
  }
  form.leap.checked = !!b.leap;
  form.year.value = b.year; form.month.value = b.month; form.day.value = b.day;
  form.unknown.checked = b.hour == null;
  if (b.hour != null) form.time.value = `${String(b.hour).padStart(2, "0")}:${String(b.minute).padStart(2, "0")}`;
  form.longitude.value = String(b.longitude.toFixed(2));
  form.split.checked = b.zi_mode === "split";
}

async function api(path, body) {
  const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(typeof j.detail === "string" ? j.detail : "입력값을 확인해 주세요");
  return j;
}

// ───────────────────────── 내 사주
async function runMine(e) {
  e?.preventDefault();
  const form = $("#form-mine"), out = $("#result-mine"), btn = $("button.primary", form);
  const birth = birthOf(form);
  btn.disabled = true; $(".error", form)?.remove();
  try {
    const d = await api("/api/saju", birth);
    out.innerHTML = renderSaju(d);
    out.hidden = false;
    mountAI($(".ai-card", out), { birth });
    out.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    form.insertAdjacentHTML("beforeend", `<p class="error">${esc(err.message)}</p>`);
  } finally { btn.disabled = false; }
}

function renderSaju(d) {
  const i = d["입력"], a = d["해석"], yong = d["용신"];
  const title = d["이름"] ? `${esc(d["이름"])} 님의 사주팔자` : "사주팔자";
  const order = ["시주", "일주", "월주", "연주"];
  const pillars = order.map((k) => {
    const p = d["원국"][k];
    const lbl = { 시주: "시", 일주: "일", 월주: "월", 연주: "연" }[k];
    if (!p) return `<div class="pillar"><div class="lbl">${lbl}주</div><div class="god">&nbsp;</div>
      <div class="glyph empty">시각<br>미상</div><div class="glyph empty">—</div></div>`;
    const se = p["천간"]["오행"], be = d["지지오행"][k];
    return `<div class="pillar ${k === "일주" ? "me" : ""}">
      <div class="lbl">${lbl}주${k === "일주" ? " · 나" : ""}</div>
      <div class="god">${esc(p["천간"]["십성"])}</div>
      <div class="glyph e-${se}">${p["천간"]["글자"]}<small>${p["한글"][0]}·${se}</small></div>
      <div class="glyph e-${be}">${p["지지"]["글자"]}<small>${p["한글"][1]}·${be}</small></div>
      <div class="god">${esc(p["지지"]["십성"])}</div>
      <div class="meta">${esc(p["지지"]["12운성"])}<br>${p["지지"]["지장간"].map((x) => esc(x.split("(")[0])).join(" ")}</div>
    </div>`;
  }).join("");

  const w = d["오행"]["비중(%)"], cnt = d["오행"]["개수"];
  const bars = ELEM.map((e) => `<div class="bar"><span class="name">${ELEM_HANJA[e]} ${e}${e === yong["용신"] ? '<span class="tag">용신</span>' : ""}</span>
    <div class="track"><div class="fill f-${e}" style="width:${Math.min(100, w[e] * 2)}%"></div></div>
    <span class="val">${w[e]}% · ${cnt[e]}</span></div>`).join("");

  const dict = (o) => Object.entries(o || {}).map(([k, v]) => `<b>${esc(k)}</b> ${esc(v)}`).join("<br>");
  const kv = [
    ["일간 — 타고난 나", a["일간"]], ["일주", a["일주"]], ["강약", a["강약"]], ["격국", a["격국"]],
    ["용신", a["용신"]], ["가장 강한 십성", a["가장 강한 십성"]],
    ["부족한 오행", dict(a["부족 오행"]), true], ["넘치는 오행", dict(a["과다 오행"]), true],
    ["현재 대운", a["현재 대운"]], ["신살", dict(a["신살 풀이"]), true],
  ].filter(([, v]) => v).map(([k, v, raw]) => `<div><dt>${k}</dt><dd>${raw ? v : esc(v)}</dd></div>`).join("");

  const tip = a["개운법"];
  const tipHtml = `<p class="muted">용신 <b>${esc(tip["용신"])}</b> 기운을 생활에서 보충하는 방법</p>
    <dl class="kv">${["색", "방위", "숫자", "활동", "직무"].map((k) => `<div><dt>${k}</dt><dd>${esc(tip[k])}</dd></div>`).join("")}</dl>`;

  const dw = d["대운표"].map((p) => `<div class="dw ${p["현재"] ? "now" : ""}"><div class="age">${p["나이"]}세</div>
    <div class="gz">${p["간지"]}</div><div class="s">${p["시작"]}~</div><div class="s">${esc(p["십성"])}</div><div class="s">${esc(p["12운성"])}</div></div>`).join("");
  const thisYear = +d["오늘"].date.slice(0, 4);
  const yrs = d["세운"].map((y) => `<div class="yr ${y["연도"] === thisYear ? "now" : ""}"><div class="y">${y["연도"]}<small>${y["간지"].slice(0, 2)}</small></div>
    <div><div>${esc(y["간지"])} · ${esc(y["십성"])} · ${esc(y["12운성"])}</div>
    ${y["작용"].length ? `<ul>${y["작용"].map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : '<div class="muted">원국과 특별한 합충 없음</div>'}</div></div>`).join("");

  const t = d["오늘"];
  const warn = (d["주의"] || []).map((x) => `<div class="warn">⚠ ${esc(x)}</div>`).join("");
  const rel = d["합충형파해"].length ? d["합충형파해"].map(esc).join("<br>") : "원국 안에 특별한 합충이 없습니다.";

  return `
  <div class="card">
    <div class="summary"><h2>${title}</h2><span class="muted">${esc(i["성별"])} · ${esc(i["띠"])}띠</span></div>
    <div class="chips"><span class="chip">양력 ${esc(i["양력"])} ${esc(i["시각"] || "시각 미상")}</span><span class="chip">${esc(i["음력"])}</span>
      ${(i["보정"] || []).map((x) => `<span class="chip">${esc(x)}</span>`).join("")}</div>
    ${warn}
  </div>
  <div class="card"><h2>사주 원국</h2><div class="pillars">${pillars}</div>
    <p class="muted" style="margin:12px 0 0">절입 ${esc(d["절입"]["직전"])} → ${esc(d["절입"]["직후"])}</p></div>
  <div class="card ai-card"></div>
  <div class="card"><h2>오행 분포</h2><div class="bars">${bars}</div>
    <p class="muted" style="margin:12px 0 0">십성 비중: ${Object.entries(d["십성 비중(%)"]).map(([k, v]) => `${k} ${v}%`).join(" · ")}</p></div>
  <div class="card"><h2>핵심 풀이</h2><dl class="kv">${kv}</dl></div>
  <div class="card"><h2>대운 <span class="muted">${esc(d["대운"].direction)} · 대운수 ${d["대운"].daewoonsu}</span></h2><div class="scroller">${dw}</div></div>
  <div class="card"><h2>세운 (해마다의 운)</h2><div class="years">${yrs}</div></div>
  <div class="card"><h2>오늘의 일진</h2><p style="margin:0"><b>${esc(t.date)}</b> ${esc(t.day)} — ${esc(t.stem_god)}/${esc(t.branch_god)}, ${esc(t.stage)}</p>
    ${t.relations.length ? `<p class="muted" style="margin:6px 0 0">${t.relations.map(esc).join(" · ")}</p>` : ""}</div>
  <div class="card"><h2>합충형파해 · 공망</h2><p style="margin:0">${rel}</p><p class="muted" style="margin:8px 0 0">공망: ${esc(d["공망"].join(""))}</p></div>
  <div class="card"><h2>개운법</h2>${tipHtml}</div>`;
}

// ───────────────────────── 궁합
async function runCompat() {
  const btn = $("#btn-compat"), out = $("#result-compat");
  const a = birthOf($("#form-a")), b = birthOf($("#form-b"));
  btn.disabled = true; out.hidden = false; out.innerHTML = '<div class="loading">계산 중…</div>';
  try {
    const r = await api("/api/compat", { a, b });
    const items = r.items.map((x) => `<div class="item"><b>${esc(x["항목"])}</b>
      <span class="pt ${x["점수"] > 0 ? "pos" : x["점수"] < 0 ? "neg" : ""}">${x["점수"] > 0 ? "+" : ""}${x["점수"]}</span><p>${esc(x["해석"])}</p></div>`).join("");
    out.innerHTML = `<div class="card"><div class="score"><div class="ring" style="--p:${r.score}"><span>${r.score}</span></div>
      <div><h2 style="margin:0 0 4px">${esc(r.grade)}</h2><p class="muted" style="margin:0">${esc(r.names[0])} · ${esc(r["1번"])}<br>${esc(r.names[1])} · ${esc(r["2번"])}</p></div></div>
      <div style="margin-top:14px">${items}</div><p class="muted">${esc(r.note)}</p></div>
      <div class="card ai-card"></div>`;
    mountAI($(".ai-card", out), { birth: a, partner: b });
  } catch (err) {
    out.innerHTML = `<div class="card"><p class="error">${esc(err.message)}</p></div>`;
  } finally { btn.disabled = false; }
}

// ───────────────────────── AI 풀이
const SUGGEST_MINE = ["올해 일·직장운은 어때요?", "연애·결혼운이 궁금해요", "나에게 맞는 직업은?", "재물운을 키우려면?", "내년에 조심할 점은?"];
const SUGGEST_COMPAT = ["서로 다툴 때 어떻게 풀면 좋을까요?", "결혼하면 어떤 부부가 될까요?", "올해 두 사람의 흐름은?"];

function mountAI(card, ctx) {
  const isCompat = !!ctx.partner;
  if (!AI_ON) {
    card.innerHTML = `<h2>AI 풀이</h2><p class="muted" style="margin:0">AI 풀이는 서버에 <code>ANTHROPIC_API_KEY</code>가 설정되면 켜집니다. 위·아래 계산 결과는 그대로 이용할 수 있어요.</p>`;
    return;
  }
  card.innerHTML = `<h2>AI ${isCompat ? "궁합" : "사주"} 풀이</h2>
    <p class="muted intro" style="margin:0 0 12px">계산 엔진이 구한 원국·용신·대운을 근거로 AI가 풀어 드립니다.</p>
    <button class="primary wide start" type="button">✦ AI ${isCompat ? "궁합" : "종합"} 풀이 받기</button>
    <div class="ai-out"></div>
    <div class="followup" hidden>
      <div class="suggest">${(isCompat ? SUGGEST_COMPAT : SUGGEST_MINE).map((s) => `<button class="ghost" type="button">${esc(s)}</button>`).join("")}</div>
      <form class="ask"><input name="q" maxlength="300" placeholder="궁금한 점을 물어보세요" autocomplete="off"><button class="primary" type="submit">질문</button></form>
    </div>`;
  const outEl = $(".ai-out", card), follow = $(".followup", card), askForm = $(".ask", card);
  const history = [];
  let busy = false;

  async function send(question) {
    if (busy) return;
    busy = true;
    $(".start", card)?.remove(); $(".intro", card)?.remove();
    askForm.querySelector("button").disabled = true;
    if (question) {
      history.push({ role: "user", content: question });
      outEl.insertAdjacentHTML("beforeend", `<div class="msg-user">Q. ${esc(question)}</div>`);
    }
    const box = document.createElement("div");
    box.className = "cursor"; outEl.append(box);
    let text = "", err = "";
    try {
      const r = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...ctx, messages: history.slice(-19) }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "AI 요청 실패");
      const reader = r.body.getReader(), dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const line = buf.slice(0, idx); buf = buf.slice(idx + 2);
          if (!line.startsWith("data: ")) continue;
          const ev = JSON.parse(line.slice(6));
          if (ev.t) { text += ev.t; box.innerHTML = md(text); }
          if (ev.error) err = ev.error;
        }
      }
    } catch (e) { err = e.message; }
    box.classList.remove("cursor");
    if (text) history.push({ role: "assistant", content: text });
    else if (question) history.pop();
    if (err) box.insertAdjacentHTML("beforeend", `<p class="error">${esc(err)}</p>`);
    follow.hidden = false;
    askForm.querySelector("button").disabled = false;
    busy = false;
  }
  $(".start", card).addEventListener("click", () => send(null));
  $(".suggest", card).addEventListener("click", (e) => { if (e.target.matches("button")) send(e.target.textContent); });
  askForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = askForm.q.value.trim();
    if (q) { askForm.q.value = ""; send(q); }
  });
}

// 아주 작은 Markdown 렌더러 (제목·굵게·목록·문단만)
function md(src) {
  const lines = esc(src).split("\n");
  let html = "", list = false;
  const inline = (s) => s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*]+)\*/g, "$1<i>$2</i>");
  for (const raw of lines) {
    const l = raw.trimEnd();
    const li = l.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/);
    if (li) { if (!list) { html += "<ul>"; list = true; } html += `<li>${inline(li[1])}</li>`; continue; }
    if (list) { html += "</ul>"; list = false; }
    const h = l.match(/^(#{1,4})\s+(.*)/);
    if (h) html += `<h3>${inline(h[2])}</h3>`;
    else if (l.trim()) html += `<p>${inline(l)}</p>`;
  }
  return html + (list ? "</ul>" : "");
}

// ───────────────────────── 초기화
function init() {
  const mine = $("#form-mine");
  buildForm(mine, "mine", "생년월일시를 알려 주세요");
  mine.insertAdjacentHTML("beforeend", '<button class="primary wide" type="submit">사주 보기</button>');
  mine.addEventListener("submit", runMine);
  buildForm($("#form-a"), "a", "나");
  buildForm($("#form-b"), "b", "상대");
  $("#btn-compat").addEventListener("click", runCompat);

  document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach((x) => x.setAttribute("aria-selected", x === b));
    $("#tab-mine").hidden = b.dataset.tab !== "mine";
    $("#tab-compat").hidden = b.dataset.tab !== "compat";
  }));
  fetch("/api/status").then((r) => r.json()).then((s) => { AI_ON = !!s.ai; }).catch(() => {});
}
init();
