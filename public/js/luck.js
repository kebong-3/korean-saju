"use strict";
/* 사주냥이 화면 스크립트 — 운세 탭.
   index.html 이 js/ 파일들을 순서대로(defer) 불러 하나의 전역 공간을 함께 쓴다. 모든 계산은 서버(/api/*)가 한다. */
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
  $$("#tab-luck .segtabs button").forEach((b) => b.addEventListener("click", () => { setLuck(b.dataset.sub); track("luck_pane", { p: b.dataset.sub }); }));
  iconize($("#tab-luck"));
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
