"use strict";
/* 사주냥이 화면 스크립트 — 운세 달력·냥이 도사 대풀이.
   index.html 이 js/ 파일들을 순서대로(defer) 불러 하나의 전역 공간을 함께 쓴다. 모든 계산은 서버(/api/*)가 한다. */
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
    compatMode = "family"; renderCompat(); showTab("compat"); return;
  }
  return openReading(id);
}
function openDream() {
  track("reading", { k: "dream" });
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
  track("reading", { k: kind });
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
