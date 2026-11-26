"use strict";
/* 사주냥이 화면 스크립트 — 원국 표·한눈에·인생 흐름 타임라인.
   index.html 이 js/ 파일들을 순서대로(defer) 불러 하나의 전역 공간을 함께 쓴다. 모든 계산은 서버(/api/*)가 한다. */
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
      <div class="ss-list">${top.map((n) => ssChip(n)).join("")}</div>
      <button class="ghost wide" type="button" data-story="sinsal" style="margin-top:12px">📸 나의 별 세 개 스토리 카드</button></div>` : ""}
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
  track("timeline");
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
