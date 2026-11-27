"use strict";
/* 사주냥이 화면 스크립트 — 내 사주·오고 감명·만세력·신살.
   index.html 이 js/ 파일들을 순서대로(defer) 불러 하나의 전역 공간을 함께 쓴다. 모든 계산은 서버(/api/*)가 한다. */
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
  $$("#tab-saju .segtabs button").forEach((b) => b.addEventListener("click", () => { setSajuPane(b.dataset.pane); track("saju_pane", { p: b.dataset.pane }); }));
  $$("#tab-saju [data-lens-go]").forEach((b) => b.addEventListener("click", () => $(`#lens-${b.dataset.lensGo}`)?.scrollIntoView({ behavior: "smooth", block: "start" })));
  $("#btn-manse-png")?.addEventListener("click", saveMansePng);
  $("#btn-manse-print")?.addEventListener("click", printManse);
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
      <span class="lun">음</span> ${esc(i["음력"])}${(i["보정"] || []).length ? `<br><span class="cor">보정</span> ${(i["보정"] || []).map(esc).join(" · ")}` : ""}</p>
      <button type="button" class="acc-badge" data-acc>🔭 천문 계산 만세력 · 절기 대조 검증</button></div></div>
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
  <div class="card"><div class="card-head"><h2>만세력 이미지</h2><span class="mx-out"><button class="ghost" id="btn-manse-png" type="button">🖼️ 저장</button><button class="ghost" id="btn-manse-print" type="button">🖨️ 인쇄·PDF</button></span></div>
    <p class="sub" style="margin:0">친구에게 보내거나 다른 만세력과 비교할 때 쓰라냥.</p><div id="manse-svg" hidden>${manseSvg(d)}</div></div>`;
}
/** 상담·보관용 인쇄 — 원국 그림과 대운·용신을 한 장에(브라우저 '인쇄 → PDF로 저장'으로 PDF) */
function printManse() {
  const d = S.d, y = d["용신"], life = d["운세"]["평생운"], i = d["입력"];
  const sheet = document.createElement("div");
  sheet.className = "print-sheet";
  sheet.innerHTML = `<h1>사주냥이 만세력 · ${esc(d["이름"] || "")}</h1>
    <p>양력 ${esc(i["양력"] || "")}${i["음력"] ? ` · 음력 ${esc(i["음력"])}` : ""} · ${esc(d["원국"]["일주"]["한글"])}일주</p>
    <div class="ps-svg">${manseSvg(d)}</div>
    <p><b>용신</b> ${esc(y["용신"])} · <b>희신</b> ${esc(y["희신"] || "-")}${y["조후"] ? ` · <b>조후</b> ${esc(y["조후"])}` : ""} — ${esc(y["근거"] || "")}</p>
    <p><b>대운</b> ${life["대운"].map((p) => `${p["나이"]}세 ${esc(p["간지"])}`).join(" · ")}</p>
    <p class="ps-foot">korean-saju-six.vercel.app · ${kstDate(0)} 출력</p>`;
  document.body.append(sheet);
  document.documentElement.classList.add("printing");
  track("manse_print");
  const done = () => { sheet.remove(); document.documentElement.classList.remove("printing"); window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  setTimeout(() => window.print(), 50);
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
  track("manse_cell", { k: kind });
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
  track("luck_cell", { k: kind });
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
  track("sinsal", { n });
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
