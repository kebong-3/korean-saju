"use strict";
/* 사주냥이 화면 스크립트 — 홈 화면.
   index.html 이 js/ 파일들을 순서대로(defer) 불러 하나의 전역 공간을 함께 쓴다. 모든 계산은 서버(/api/*)가 한다. */
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
/** 오늘의 의식 — 누르면 열리는 그림 타일 네 개(상태를 한 줄로 보여 줘서 '뭔지' 바로 알게) */
function ritualTiles() {
  const p = S.d["오늘의패"], paeOpen = p && store.get("pae", "") === p["날짜"], g = gardenState(), watered = g.water === kstDate(0);
  const moodDone = !!store.get("diary", {})[kstDate(0)], n = streak();
  const t = (ic, attr, title, sub, done) => `<button type="button" class="rit ${done ? "done" : ""}" ${attr}>${ic3d(ic, 50)}<span><b>${title}</b><small>${sub}</small></span>${done ? '<em class="rit-ok">✓</em>' : ""}</button>`;
  return t("pae", "data-pae", "오늘의 패", paeOpen ? `오늘: ${esc(p["이름"])}` : "톡 눌러 한 장 뒤집기", paeOpen)
    + t("garden", "data-garden", "보약 화분", watered ? "오늘 물 주기 완료" : `보약 ${S.d["용신"]["용신"]} 화분에 물 주기`, watered)
    + t("mood", "data-moodsheet", "오늘 기분", moodDone ? `기록 완료 · ${n}일 연속` : `기록하고 출석 도장 · ${n}일 연속`, moodDone)
    + t("reading", "data-readsheet", "오늘의 읽을거리", "냥이 한마디 · 고전 · 옛이야기", false);
}
function openReadSheet() {
  const d = S.d, st = d["옛이야기"];
  track("reading_sheet");
  openSheet(`<h2 style="margin:0 0 10px">📜 오늘의 읽을거리</h2>${todayStory(d["이야기"]?.["오늘"])}${wisdomCard(d["나의길"]?.["한구절"])}
    <div class="card story"><div class="card-head"><h2>냥이의 옛이야기</h2><span class="badge">${esc(st["시대"])}</span></div>
      <h3>『${esc(st["제목"])}』</h3><p style="margin:0">${esc(st["이야기"])}</p>
      <div class="lesson">🐾 ${esc(st["교훈"])} <span class="sub">— ${T(st["개념"], true)}</span></div></div>${pathTeaser()}`);
  paintNyang($("#sheet-content"));
}
document.addEventListener("click", (e) => { if (e.target.closest("[data-readsheet]")) openReadSheet(); });
/** 패·정원·기분을 바꾼 뒤 홈 타일 상태를 새로 */
function refreshRitual() { const g = $(".rit-grid"); if (g) g.innerHTML = ritualTiles(); }

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
        <button type="button" class="wardrobe" data-dex>${ic3d("closet", 22)} 냥이 옷장 ${dexCount().got}/${dexCount().all}</button></div>
    </section>

    <div class="card today-card">
      <div class="today">${ring(t["점수"], t["등급"], "fortune")}
        <div><div class="tc-k">오늘의 운세 · <b>${esc(t["일진"])}</b>일 · <span data-t="${esc(t["십성"].split("/")[0])}" class="tc-god">${esc(t["십성"].split("/")[0])}의 날</span></div>
        <p class="tc-main">${T(t["한마디"])}</p>
        ${t["점수"] < 45 ? `<p class="low-day">🌿 정비의 날은 나쁜 날이 아니라 <b>숨 고르는 날</b>이다냥. 큰 결정 대신 정리·휴식·준비에 쓰면 딱 좋아.</p>` : ""}</div></div>
      ${(t["근거"] || []).length ? `<details class="why-score"><summary>🔎 왜 ${hideScore() ? "이 운세" : t["점수"] + "점"}일까?</summary><ul>${t["근거"].map((x) => `<li><span>${esc(x["말"])}</span><b class="${x["점"] > 0 && x["말"] !== "기본 점수" ? "pos" : x["점"] < 0 ? "neg" : ""}">${x["말"] === "기본 점수" ? x["점"] : (x["점"] > 0 ? "+" : "") + x["점"]}</b></li>`).join("")}
        <li class="sum"><span>오늘 점수</span><b>${t["점수"]}</b></li></ul><p class="sub" style="margin:6px 0 0">보약 기운이 들어오면 오르고, 내 사주와 부딪히면 내려간다냥. 점수는 흐름의 참고일 뿐, 하루를 정하는 건 너야.</p></details>` : ""}
      <button type="button" class="mission ${done ? "done" : ""}" id="mission" aria-pressed="${done}"><span>${done ? "✅" : "⬜"}</span>
        <span><small>오늘 한 가지 · 하면 보약 화분이 자라요</small>${esc(t["미션"])}</span></button>
      <div class="rd-cta"><button class="btn primary" type="button" data-read="day">오늘 자세히</button>
        <button class="btn soft" type="button" data-read="tomorrow">내일 ${hideScore() ? esc(f["내일운세"]["등급"]) : f["내일운세"]["점수"] + "점"} →</button></div>
      <details class="hours-more"><summary>🍀 행운 · 좋은 시간 <b>${f["시간대"]["좋은시간"].join("·")}</b></summary>
        ${(t["쉬운작용"] || []).length ? `<ul class="tips easy-rel">${t["쉬운작용"].slice(0, 2).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        <div class="lucky-line"><span>🎨 ${esc(t["행운"]["색"])}</span><span>🔢 ${esc(t["행운"]["숫자"])}</span><span>🧭 ${esc(t["행운"]["방위"])}</span><span>🍽️ ${esc(t["행운"]["음식"])}</span></div>
        ${hoursStrip(f["시간대"])}<p class="sub" style="margin:6px 0 0">살살 갈 시간 ${f["시간대"]["조심시간"].join("·")}</p>
        ${t["작용"].length ? `<p class="sub" style="margin:6px 0 0">명리 원문: ${T(t["작용"].join(" · "), true)}</p>` : ""}</details>
    </div>

    ${promiseCheck()}
    ${nowCard()}

    <h2 class="sec-t">바로가기 <button type="button" class="sec-more" data-allmenu>전체 메뉴 ›</button></h2>
    <div class="quick q3d">${[["luck:month", "month", "월별 운세"], ["luck:read", "paw", "대풀이"], ["saju:manse", "manse", "만세력"], ["compat", "map", "궁합·지도"]]
      .map(([g, ic, l]) => `<button type="button" data-go="${g}"><i class="i3w">${ic3d(ic, 44)}</i><span>${l}</span></button>`).join("")}</div>
    <div id="install-slot"></div>

    <h2 class="sec-t">오늘의 의식 <small>하루 1분, 운을 키우는 시간</small></h2>
    <div class="rit-grid">${ritualTiles()}</div>
    <p class="foot">사주는 정답지가 아니라 지도다냥. 건강·법률·투자 판단은 전문가와 상의해 줘!<br>
      <button type="button" class="linkish" data-feedback>💌 의견 보내기</button> · <button type="button" class="linkish" data-mydata>내 정보 관리</button><br>
      <a href="/guide">명리 안내</a> · <a href="/privacy.html">개인정보 처리방침</a> · <a href="/terms.html">이용약관</a> · 계산 엔진 <a href="https://github.com/kebong-3/korean-saju" target="_blank" rel="noopener">korean-saju</a></p>`;
  refreshBdayTile();
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
