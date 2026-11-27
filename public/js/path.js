"use strict";
/* 사주냥이 화면 스크립트 — 나의 길·설치·지금 나에게·화면 자동 점검.
   index.html 이 js/ 파일들을 순서대로(defer) 불러 하나의 전역 공간을 함께 쓴다. 모든 계산은 서버(/api/*)가 한다. */
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
const NOW_LABEL = { week: "🪞 이번 주 돌아보기", season: "🎐 절기 일기", month: "🗓️ 이번 달 플랜", year: "🧧 신년 카드", ncard: "🃏 나의 냥이 카드" };
const NOW_TILE = { week: ["weekrev", "이번 주 돌아보기", "지난 7일 기분과 운"], season: ["season", "절기 일기", "이번 절기 개운법"],
  month: ["monthplan", "이번 달 플랜", "할 일·피할 일"], year: ["yearcard", "신년 카드", "내 2027 한 장"], ncard: ["ncard", "나의 냥이 카드", "60일주 냥이"] };
const giftTile = ([ic, title, desc], attr, cls = "") => `<button type="button" class="gtile ${cls}" ${attr}>${ic3d(ic, 46)}<b>${title}</b><small>${desc}</small></button>`;
function nowPick() {
  const d = S.d, s = d["절기"], today = kstDate(0), day = +today.slice(8), mon = +today.slice(5, 7);
  const fresh = s && (Date.parse(today) - Date.parse(s["시작"])) / 864e5 <= 3;
  if (fresh) return "season";
  const dow = new Date(today + "T00:00:00").getDay();
  if (dow === 0 || dow === 1) return "week";
  if (day <= 7) return "month";
  if (mon === 12 || mon === 1) return "year";
  return ["month", "ncard", "season", "year"][Math.floor(Date.parse(today) / 864e5) % 4];
}
function nowCard() {
  const d = S.d;
  const opts = { week: weekCard(), season: seasonBanner(), month: monthCard(d["운세"]["이번달"]), year: yearBanner(), ncard: myCardTile() };
  let pick = S.nowPick || nowPick();
  if (!opts[pick]) pick = Object.keys(opts).find((k) => opts[k]);
  const tiles = Object.keys(opts).filter((k) => k !== pick && opts[k]).map((k) => giftTile(NOW_TILE[k], `data-now="${k}"`)).join("")
    + GIFT_TILES.map(([k, t, s]) => giftTile([k, t, s], `data-gift="${k}"`, "new")).join("");
  return `<div id="now-wrap"><h2 class="sec-t">지금 나에게</h2>${opts[pick] || ""}
    <h2 class="sec-t">냥이가 준비한 것 <small>눌러서 열어 봐</small></h2><div class="gtiles">${tiles}</div></div>`;
}
document.addEventListener("click", (e) => {
  const n = e.target.closest("[data-now]");
  if (n) { track("now_card", { k: n.dataset.now }); S.nowPick = n.dataset.now; $("#now-wrap").outerHTML = nowCard(); paintNyang($("#now-wrap")); dedupeTerms($("#now-wrap")); refreshBdayTile(); $("#now-wrap").scrollIntoView({ behavior: "smooth", block: "start" }); return; }
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
