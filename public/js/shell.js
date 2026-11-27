"use strict";
/* 사주냥이 화면 스크립트 — 시작·탭 전환·첫 감명 카드·신년 카드.
   index.html 이 js/ 파일들을 순서대로(defer) 불러 하나의 전역 공간을 함께 쓴다. 모든 계산은 서버(/api/*)가 한다. */
// ───────────────────────── 시작·화면 전환
const APPV = "35";
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
  setTimeout(nightSuggest, 1500);
}
function loading(el) { el.innerHTML = `<div class="loading"><span data-nyang="focus" data-size="80"></span>냥이가 만세력을 펼치는 중…</div>`; paintNyang(el); }

function showTab(tab, sub) {
  if ($(`#tab-${tab}`)?.hidden) track("tab", { t: tab });
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
  paintNyang($("#main")); paintNyang($(".bottom")); iconize($("#main"));
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
  track("yearcard");
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
    ...(d["냥이카드"] ? [{ mood: "wow", outfit: d["냥이카드"]["옷"], flip: 1, k: "1 / 4 · 나의 냥이 카드", big: d["냥이카드"]["이름"], sub: `${nm}의 60일주 냥이 · ${d["냥이카드"]["일주"]}일주`, body: d["냥이카드"]["한줄"] }] : []),
    { mood: "happy", k: "2 / 4 · 타고난 나", big: `${me["이모지"] || ""} ${me["이름"] || ""}`, sub: `${nm}의 본체는 ${d["원국"]["일주"]["천간"]["글자"]}(${d["원국"]["일주"]["한글"][0]}) 일간이다냥.`, body: ilgan },
    { mood: "cheer", k: "3 / 4 · 나의 보약 기운", big: `${yong}(${{ 목: "木", 화: "火", 토: "土", 금: "金", 수: "水" }[yong] || ""}) 기운`, sub: `너에게 제일 필요한 '용신'이다냥.`,
      body: `행운의 색은 ${(mt["행운의색"] || [""])[0]}, 힘이 나는 방향은 ${mt["행운의방위"] || ""}. ${mt["힐링"] ? `지칠 땐 ${mt["힐링"].split("·")[0]}!` : ""}` },
    { mood: "proud", k: `4 / 4 · 나의 ${y["연도"]}`, big: `${yt["이모지"] || "🧧"} ${yt["이름"] || y["테마"]}`, sub: `'${y["테마"]}'`, body: `${y["총평"]} 힘 실을 달은 ${(y["좋은달표시"] || []).join("·")}.` },
  ];
  let i = 0;
  const box = $("#reveal");
  const draw = () => {
    const c = cards[i], last = i === cards.length - 1;
    box.innerHTML = `<div class="rv-card ${c.flip ? "rv-flip" : ""}"><div class="rv-k">${esc(c.k)}</div><span data-nyang="${c.mood}" data-size="120" ${c.outfit ? `data-outfit="${esc(c.outfit)}"` : ""}></span>
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
