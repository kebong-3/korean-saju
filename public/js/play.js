"use strict";
/* 사주냥이 화면 스크립트 — 냥이 도감·보관함·패·정원·절기·냥이 카드·귀인 퀘스트·전체 메뉴.
   index.html 이 js/ 파일들을 순서대로(defer) 불러 하나의 전역 공간을 함께 쓴다. 모든 계산은 서버(/api/*)가 한다. */
// ───────────────────────── 냥이 도감: 표정·옷 수집(누적 출석으로 열림), 옷 갈아입히기, 쓰다듬기
const MOOD_AT = { normal: 0, happy: 0, think: 0, wow: 0, wink: 0, sad: 0, love: 2, sleepy: 3, focus: 4, proud: 5, shy: 7, cheer: 10, laugh: 14 };
const OUTFIT_AT = { gat: 0, flower: 3, moon: 7, winter: 14, newyear: 21, king: 30 };
const OUTFIT_SAY = {
  gat: "2천 년째 쓰는 내 갓이다냥. 낡았어도 이게 제일 편해.", flower: "봄 들판에서 직접 엮은 화관이다냥. 3일 출석 기념!",
  moon: "보름달 뜨는 밤에만 꺼내 입는 도사복이다냥.", winter: "한양 겨울은 매서웠다냥… 그래서 남바위는 필수!",
  newyear: "설날 아침엔 색동이지! 세배는 받는 쪽이 좋다냥.", king: "30일이나 와 줬다냥? 오늘만은 냥이가 임금님이다냥 👑",
};
const unlockedMoods = (n = visits()) => Object.keys(MOOD_AT).filter((k) => n >= MOOD_AT[k]);
const outfitOk = (o, n = visits()) => n >= (OUTFIT_AT[o] ?? 99);
function applyOutfit() {
  const o = store.get("outfit", "gat");
  window.nyangOutfit = outfitOk(o) ? o : "gat";
}
function dexCount() {
  const n = visits();
  return { got: unlockedMoods(n).length + Object.keys(OUTFIT_AT).filter((o) => outfitOk(o, n)).length,
    all: Object.keys(MOOD_AT).length + Object.keys(OUTFIT_AT).length };
}
function openDex() {
  const n = visits(), cur = window.nyangOutfit || "gat", c = dexCount();
  openSheet(`<div class="term-head"><span data-nyang="proud" data-size="64"></span><div><h2>냥이 도감 <small class="sub">${c.got}/${c.all}</small></h2>
      <div class="term-mean">들를수록 냥이의 표정과 옷이 하나씩 늘어난다냥 · 누적 출석 ${n}일</div></div></div>
    <h3 class="dex-h">👘 옷장 <span class="sub">— 눌러서 갈아입히기</span></h3>
    <div class="dex-grid outfits">${Object.entries(window.NYANG_OUTFITS).map(([k, v]) => outfitOk(k, n)
      ? `<button type="button" class="dex-tile ${k === cur ? "on" : ""}" data-wear="${k}"><span data-nyang="happy" data-size="74" data-outfit="${k}"></span><b>${esc(v.name)}</b>${k === cur ? "<small>입는 중</small>" : ""}</button>`
      : `<div class="dex-tile locked"><span class="lock-sil">${nyang("normal", 74, k)}</span><b>🔒 ${esc(v.name)}</b><small>출석 ${OUTFIT_AT[k]}일째</small></div>`).join("")}</div>
    <h3 class="dex-h">😺 표정 모음</h3>
    <div class="dex-grid moods">${Object.entries(window.NYANG_MOODS).map(([k, v]) => n >= MOOD_AT[k]
      ? `<div class="dex-tile mini"><span data-nyang="${k}" data-size="56"></span><b>${esc(v)}</b></div>`
      : `<div class="dex-tile mini locked"><span class="q">?</span><b>${MOOD_AT[k]}일째</b></div>`).join("")}</div>
    <p class="sub" style="text-align:center;margin:12px 0 0">홈의 냥이를 톡 건드리면 모은 표정 중 하나로 반응한다냥 🐾</p>`);
  $$("#sheet-content [data-wear]").forEach((b) => b.addEventListener("click", () => {
    store.set("outfit", b.dataset.wear); applyOutfit();
    paintNyang(document); openDex();
    const say = OUTFIT_SAY[b.dataset.wear];
    if (say) $("#sheet-content .term-mean").textContent = say;
  }));
}
// 쓰다듬기: 홈·상담·리빌의 냥이를 톡 → 모은 표정 중 하나 + 한마디
const PATS = ["냥?", "꾹꾹…", "간지럽다냥!", "2천 년 살아도 이건 좋다냥", "오늘도 와 줘서 고맙다냥", "갓은 만지지 마라냥!", "골골골…", "츄르는 없냥?"];
document.addEventListener("click", (e) => {
  const el = e.target.closest(".greet [data-nyang], .hero-cat[data-nyang], .rv-card [data-nyang], .float[data-nyang]");
  if (!el || el.closest("button")) return;
  const pool = unlockedMoods().filter((m) => m !== el.dataset.nyang);
  const orig = el.dataset.nyangOrig || el.dataset.nyang;
  el.dataset.nyangOrig = orig;
  el.dataset.nyang = pool[Math.floor(Math.random() * pool.length)] || "happy";
  paintNyang(el.parentElement);
  el.classList.remove("boing"); void el.offsetWidth; el.classList.add("boing");
  el.querySelector(".ny-pop")?.remove();
  el.insertAdjacentHTML("beforeend", `<span class="ny-pop">${PATS[Math.floor(Math.random() * PATS.length)]}</span>`);
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.dataset.nyang = orig; paintNyang(el.parentElement); }, 1800);
});
// 냥이 월령 한 수(토정비결처럼 두 줄로 읽는 그달의 노래)
function verseHtml(v, compact = false) {
  if (!v) return "";
  return `<div class="verse ${compact ? "compact" : ""}"><span class="v-season">${esc(v["계절"])}</span>
    <span class="v-line">${esc(v["구절"][0])}</span><span class="v-line">${esc(v["구절"][1])}</span>
    ${compact ? "" : `<span class="v-why">🐾 ${esc(v["풀이"])}</span>`}</div>`;
}

// ═════════════════════════ 4단계: 기록 보관 · 오늘의 패 · 오행 정원 · 절기 시즌 · 냥이 카드 · 귀인 퀘스트
const nim = () => (S.d?.["이름"] ? `${S.d["이름"]}님` : "너");
const EL5 = ["목", "화", "토", "금", "수"];
const EL_HANJA = { 목: "木", 화: "火", 토: "土", 금: "金", 수: "水" };
const EL_FLOWER = { 목: "🌳", 화: "🌺", 토: "🌻", 금: "🌼", 수: "🪷" };
const toast = (msg) => {
  let t = $("#toast");
  if (!t) { document.body.insertAdjacentHTML("beforeend", '<div id="toast" class="toast" role="status"></div>'); t = $("#toast"); }
  t.textContent = msg; t.classList.remove("on"); void t.offsetWidth; t.classList.add("on");
};

// ───────── 내가 본 풀이 보관함: 한 번 본 대풀이·궁합·택일은 이 기기에 남겨 두고 다시 열 때 그대로 불러온다
function saveViewed(entry) {
  const list = store.get("saved", []).filter((x) => x.key !== entry.key);
  list.unshift({ ...entry, at: new Date().toISOString() });
  store.set("saved", list.slice(0, 80));
}
function openSaved() {
  const list = store.get("saved", []);
  const fmt = (iso) => { const d = new Date(iso); return `${d.getMonth() + 1}월 ${d.getDate()}일`; };
  openSheet(`<div class="sheet-title"><span data-nyang="focus" data-size="56"></span><div><h2>내가 본 풀이</h2>
      <p class="sub">한 번 본 풀이는 이 기기에 남아 있어서, 다시 눌러도 기다리지 않고 바로 열린다냥.</p></div></div>
    ${list.length ? `<div class="saved-list">${list.map((x, i) => `<button type="button" class="saved-row" data-srow="${i}">
        <span class="ic">${esc(x.icon || "📜")}</span><span class="tx"><b>${esc(x.title)}</b><small>${esc(x.sub || "")}</small></span><span class="dt">${fmt(x.at)}</span></button>`).join("")}</div>
      <button class="ghost wide" type="button" id="saved-clear" style="margin-top:12px">보관함 비우기</button>`
    : `<p class="empty">아직 본 풀이가 없다냥. 홈의 '냥이 도사 대풀이'부터 열어 봐!</p>`}`);
  $$("#sheet-content [data-srow]").forEach((b) => b.addEventListener("click", () => {
    const x = list[+b.dataset.srow]; closeSheet();
    if (x.type === "compat") { showTab("compat"); fillForm($("#form-b"), x.o.partner); runCompat(); return; }
    if (x.type === "taegil") { openTaegil(x.o.purpose); return; }
    openReading(x.kind, x.o || {});
  }));
  $("#saved-clear")?.addEventListener("click", () => {
    if (!confirm("보관함 목록과 저장된 풀이를 지울까? (사주 기록·일기는 그대로)")) return;
    list.forEach((x) => { if (x.key) try { localStorage.removeItem(x.key); } catch { /* */ } });
    store.set("saved", []); openSaved();
  });
}
// 상담 대화도 남겨 두기(최근 대화 한 묶음)
function saveTalk() {
  const c = $("#chat");
  if (!c || !c.querySelector(".msg.me")) return;
  store.set("talklog", { at: kstDate(0), html: c.innerHTML.slice(-60000) });
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") saveTalk(); });

// ───────── 오늘의 패 한 장(다시 뽑기 없음)
function paeTile() {
  const p = S.d["오늘의패"]; if (!p) return "";
  const open = store.get("pae", "") === p["날짜"];
  return `<button type="button" class="pae ${open ? "open" : ""}" data-pae aria-label="오늘의 패">
    <span class="pae-in"><span class="pae-back"><i>🐾</i><b>오늘의 패</b><small>톡 눌러 뒤집기</small></span>
      <span class="pae-front"><i>${esc(p["이모지"])}</i><b>${esc(p["이름"])}</b><small>${esc(p["십성"])}의 날</small></span></span></button>`;
}
function openPae() {
  track("pae");
  const p = S.d["오늘의패"], first = store.get("pae", "") !== p["날짜"];
  store.set("pae", p["날짜"]);
  $("[data-pae]")?.classList.add("open");
  setTimeout(() => {
    openSheet(`<div class="pae-sheet"><div class="pae-big"><i>${esc(p["이모지"])}</i><b>${esc(p["이름"])}</b><small>${esc(p["십성"])}의 날 · ${+p["날짜"].slice(5, 7)}월 ${+p["날짜"].slice(8)}일</small></div>
      <p class="pae-msg">${esc(p["말"])}</p><div class="pae-act"><small>오늘 한 가지</small><b>${esc(p["행동"])}</b></div>
      <p class="sub" style="text-align:center;margin:12px 0 0">패는 하루에 한 장이다냥. 같은 패를 다시 뽑지 않는 게 냥이의 약속이야 🐾</p>
      <button class="btn lav wide" type="button" data-story="pae" style="margin-top:12px">📸 스토리 카드로 자랑하기</button></div>`);
    if (first) gardenAdd(S.d["용신"]["용신"], 0, "패를 뒤집었다냥");
  }, first ? 420 : 0);
}

// ───────── 오행 정원: 용신 화분에 물을 주며 운을 키운다
const gardenState = () => ({ 목: 0, 화: 0, 토: 0, 금: 0, 수: 0, water: "", bonus: "", ...store.get("garden", {}) });
const stageOf = (n, el) => (n < 1 ? "🌰" : n < 4 ? "🌱" : n < 9 ? "🌿" : n < 16 ? EL_FLOWER[el] : EL_FLOWER[el] + "✨");
const stageName = (n) => (n < 1 ? "씨앗" : n < 4 ? "새싹" : n < 9 ? "잎" : n < 16 ? "꽃" : "만개");
function roleOf(el) {
  const y = S.d["용신"];
  return el === y["용신"] ? "용신" : el === y["희신"] ? "희신" : el === y["기신"] ? "기신" : el === y["구신"] ? "구신" : "한신";
}
function gardenAdd(el, n, why) {
  const g = gardenState(); g[el] = (g[el] || 0) + n; store.set("garden", g);
  const slot = $("#garden-slot"); if (slot) slot.innerHTML = gardenMini();
  if (n && why) toast(`${why} · ${el}(${EL_HANJA[el]}) 화분 +${n} ${stageOf(g[el], el)}`);
}
function gardenMini() {
  const g = gardenState(), watered = g.water === kstDate(0);
  return `<button type="button" class="garden-mini" data-garden aria-label="오행 정원 열기">
    <span class="gm-pots">${EL5.map((el) => `<span class="gm-pot r-${roleOf(el)}"><i>${stageOf(g[el], el)}</i><small>${el}</small></span>`).join("")}</span>
    <span class="gm-t"><b>🌱 오행 정원</b><small>${watered ? "오늘 물 주기 완료 ✓" : `오늘의 물 한 번 · 보약 ${S.d["용신"]["용신"]} 화분부터!`}</small></span></button>`;
}
function openGarden() {
  track("garden");
  const g = gardenState(), y = S.d["용신"], watered = g.water === kstDate(0);
  const say = { 용신: "제일 필요한 보약 기운이다냥. 물 +2", 희신: "보약을 돕는 기운이다냥. 물 +1", 한신: "있어도 없어도 괜찮은 기운. 물 +1",
    구신: "부담 기운을 돕는 쪽이라 물이 잘 안 먹힌다냥. 물 +0", 기신: "이미 넘치는 기운이라 물을 주면 넘친다냥. 물 +0" };
  const gain = { 용신: 2, 희신: 1, 한신: 1, 구신: 0, 기신: 0 };
  openSheet(`<div class="sheet-title"><span data-nyang="happy" data-size="56"></span><div><h2>오행 정원</h2>
      <p class="sub">모자란 기운을 채우면 운이 산다냥. 하루 한 번 물을 주고, 개운 미션을 하면 보약 화분이 한 번 더 자란다냥.</p></div></div>
    <div class="garden">${EL5.map((el) => { const r = roleOf(el); return `<button type="button" class="pot r-${r}" data-water="${el}" ${watered ? "disabled" : ""}>
        <span class="plant">${stageOf(g[el], el)}</span><span class="clay"></span>
        <b>${el}(${EL_HANJA[el]})</b><small>${r === "용신" ? "⭐ 보약" : r}</small><em>${stageName(g[el])} · ${g[el]}</em></button>`; }).join("")}</div>
    <p class="garden-note">${watered ? "오늘은 물을 다 줬다냥. 내일 또 와 줘 🐾" : "어느 화분에 물을 줄까? 화분을 톡 눌러 줘."}</p>
    <ul class="tips">${EL5.map((el) => `<li><b>${el}</b> · ${roleOf(el)} — ${say[roleOf(el)]}</li>`).join("")}</ul>
    <p class="sub">이 정원은 ${nim()}의 용신(${y["용신"]})·희신(${y["희신"] || "-"})에 맞춰 자란다냥. 보약 화분이 가장 크면 균형이 잘 잡힌 거야.</p>`);
  $$("#sheet-content [data-water]").forEach((b) => b.addEventListener("click", () => {
    const el = b.dataset.water, n = gain[roleOf(el)];
    const gg = gardenState(); gg.water = kstDate(0); store.set("garden", gg);
    gardenAdd(el, n, n ? "물을 줬다냥" : null);
    if (!n) toast(`${el} 화분은 이미 넘친다냥… 보약 화분에 주는 게 좋아!`);
    openGarden();
  }));
}

// ───────── 절기 시즌
function seasonMark() {
  const s = S.d["절기"]; if (!s) return;
  const got = store.get("seasons", {}); if (!got[s["키"]]) { got[s["키"]] = s["이름"]; store.set("seasons", got); }
}
function seasonBanner() {
  const s = S.d["절기"]; if (!s) return "";
  const n = new Set(Object.values(store.get("seasons", {}))).size;
  return `<button type="button" class="season" data-season><span class="se-ic">${esc(s["이모지"])}</span>
    <span class="se-t"><small>지금은 ${esc(s["이름"])} 시즌 · 절기 도장 ${n}/24</small><b>냥이의 ${esc(s["이름"])} 일기 열기</b></span>
    <span class="se-d">${esc(s["다음이모지"])} ${esc(s["다음"])}<br><small>D-${s["남은날"]}</small></span></button>`;
}
async function openSeason() {
  track("season");
  const s = S.d["절기"], got = new Set(Object.values(store.get("seasons", {})));
  let all = S.terms;
  if (!all) { try { all = S.terms = (await api("/api/terms"))["절기"]; } catch { all = []; } }
  openSheet(`<div class="season-sheet"><div class="se-head"><span data-nyang="${s["이름"] === "동지" || s["이름"].includes("설") || s["이름"].includes("한") ? "sleepy" : "happy"}" data-size="70"></span>
      <div><small>${s["번호"]}번째 절기 · ${+s["시작"].slice(5, 7)}월 ${+s["시작"].slice(8)}일부터</small><h2>${esc(s["이모지"])} ${esc(s["이름"])}</h2></div></div>
    <div class="diary-paper"><p>${esc(s["일기"])}</p><span class="sign">— 2천 살 냥이</span></div>
    <div class="pae-act"><small>${esc(s["이름"])}의 개운 한 가지</small><b>${esc(s["개운"])}</b></div>
    <h3 style="margin:16px 0 8px">절기 도장 <span class="sub">${got.size}/24 · 절기마다 한 번 들르면 찍혀요</span></h3>
    <div class="term-grid">${all.map((t) => `<span class="jg ${got.has(t["이름"]) ? "on" : ""} ${t["이름"] === s["이름"] ? "now" : ""}"><i>${got.has(t["이름"]) ? esc(t["이모지"]) : "·"}</i>${esc(t["이름"])}</span>`).join("")}</div>
    <p class="sub" style="text-align:center;margin:12px 0 0">다음 절기 ${esc(s["다음이모지"])} ${esc(s["다음"])}까지 ${s["남은날"]}일 — 새 일기가 열린다냥</p></div>`);
}

// ───────── 60일주 냥이 카드
function nyangCardSvg(c, who) {
  const cat = nyang("happy", 170, c["옷"]).replace("<svg ", '<svg x="95" y="78" ');
  const kw = c["키워드"].map((k, i) => `<g transform="translate(${[30, 130, 230][i]} 336)"><rect width="100" height="30" rx="15" fill="#fff" opacity=".9"/><text x="50" y="20" font-size="13" fill="#3b2f4a" text-anchor="middle">#${esc(k)}</text></g>`).join("");
  const line = c["한줄"].replace("사람이다냥.", "").trim();
  const half = Math.ceil(line.length / 2), cut = line.lastIndexOf(" ", half) > 6 ? line.lastIndexOf(" ", half) : half;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 470" width="100%" role="img" aria-label="${esc(c["이름"])} 카드" font-family="Jua, Gowun Dodum, Apple SD Gothic Neo, Malgun Gothic, sans-serif">
    <defs><linearGradient id="nc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="${c["색"]}"/></linearGradient></defs>
    <rect width="360" height="470" rx="30" fill="url(#nc)"/><rect x="10" y="10" width="340" height="450" rx="24" fill="none" stroke="#fff" stroke-width="2" opacity=".8"/>
    <text x="28" y="44" font-size="14" fill="#7c5cf0">사주냥이 · 60일주 냥이 카드</text><text x="332" y="44" font-size="20" fill="#3b2f4a" text-anchor="end">${esc(c["일주"])}</text>
    <circle cx="180" cy="168" r="84" fill="#fff" opacity=".55"/>${cat}
    <text x="180" y="276" font-size="13" fill="#6b6080" text-anchor="middle">${esc(who)}${who.endsWith("님") ? "은 " : "는 "}${esc(c["한글"])}일주 · ${esc(c["동물"])}의 기운</text>
    <text x="180" y="310" font-size="27" fill="#3b2f4a" text-anchor="middle">${esc(c["이름"])}</text>${kw}
    <text x="180" y="396" font-size="13.5" fill="#3b2f4a" text-anchor="middle">${esc(line.slice(0, cut))}</text>
    <text x="180" y="416" font-size="13.5" fill="#3b2f4a" text-anchor="middle">${esc(line.slice(cut).trim())} 사람이다냥.</text>
    <text x="180" y="450" font-size="11" fill="#6b6080" text-anchor="middle">너는 무슨 냥이야? · korean-saju-six.vercel.app</text></svg>`;
}
function myCardTile() {
  const c = S.d["냥이카드"]; if (!c) return "";
  return `<button type="button" class="ncard-tile" data-ncard style="--c:${c["색"]}"><span data-nyang="wink" data-size="58" data-outfit="${c["옷"]}"></span>
    <span><small>${esc(nim())}의 60일주 냥이 · ${esc(c["일주"])}</small><b>${esc(c["이름"])}</b><em>${c["키워드"].map((k) => "#" + esc(k)).join(" ")}</em></span></button>`;
}
function openNyangCard() {
  track("ncard");
  const c = S.d["냥이카드"];
  const friends = store.get("friendCards", {});
  openSheet(`<div id="nc-box">${nyangCardSvg(c, nim())}</div>
    <div class="rd-cta" style="margin-top:12px"><button class="btn primary" type="button" id="nc-share">📤 너는 무슨 냥이야?</button><button class="btn lav" type="button" id="nc-save">🖼️ 카드 저장</button></div>
    <button class="ghost wide" type="button" data-story="ncard" style="margin-top:8px">📸 인스타 스토리 크기로 만들기</button>
    <h3 style="margin:16px 0 6px">친구 냥이 카드 <span class="sub">${Object.keys(friends).length}/60</span></h3>
    ${Object.keys(friends).length ? `<div class="fcards">${Object.entries(friends).map(([k, f]) => `<span class="fcard" style="--c:${f["색"]}"><b>${esc(k)}</b>${esc(f["이름"])}<small>${esc(f.who)}</small></span>`).join("")}</div>`
      : `<p class="sub">귀인 지도에 친구가 올라오면 친구의 냥이 카드가 여기 모인다냥.</p>`}`);
  $("#nc-save").addEventListener("click", () => saveSvgPng($("#nc-box svg"), `사주냥이_${c["이름"].replace(/ /g, "_")}.png`));
  $("#nc-share").addEventListener("click", async () => {
    const text = `나는 ${c["일주"]}일주, '${c["이름"]}'이래 🐾 #${c["키워드"].join(" #")} — 너는 무슨 냥이야?`;
    if (navigator.share) { try { await navigator.share({ title: "사주냥이 60일주 냥이 카드", text, url: location.origin + "/" }); return; } catch { /* 취소 */ } }
    try { await navigator.clipboard.writeText(`${text} ${location.origin}/`); toast("공유 문구를 복사했다냥!"); } catch { alert(text); }
  });
}
function collectFriendCards(M) {
  const got = store.get("friendCards", {});
  (M["멤버"] || []).concat(M["대기"] || []).forEach((m) => { const c = m["냥이"]; if (c && !got[c["일주"]]) got[c["일주"]] = { 이름: c["이름"], 색: c["색"], who: m["이름"] }; });
  store.set("friendCards", got);
}

// ───────── 귀인 퀘스트: 친구에게 보약 편지
const weekKey = () => { const d = new Date(Date.now() + 9 * 3600e3); const j = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); return `${d.getUTCFullYear()}-w${Math.ceil(((d - j) / 864e5 + j.getUTCDay() + 1) / 7)}`; };
function questCard() {
  const q = store.get("quest", {}), w = weekKey(), sent = q.week === w ? q.sent || 0 : 0;
  return `<div class="card quest"><div class="card-head"><h2>🤝 이번 주 귀인 퀘스트</h2><span class="badge ${sent ? "mint" : ""}">${sent ? "완료 ✓" : "0 / 1"}</span></div>
    <p class="sub" style="margin:0 0 8px">지도 속 친구에게 그 친구의 보약 기운을 담은 <b>보약 편지</b>를 한 통 보내 봐. 서로에게 귀인이 되는 연습이다냥.</p>
    <p class="sub" style="margin:0">별을 누르면 '📮 보약 편지 보내기'가 있어요 · 받은 도장 ${q.total || 0}개</p>
    <div id="letters-slot"></div></div>`;
}
function openLetter(m, ref) {
  const el = m["용신"] || "";
  openSheet(`<div class="sheet-title"><span data-nyang="love" data-size="56"></span><div><h2>📮 ${esc(m["이름"])}님에게 보약 편지</h2>
      <p class="sub">${el ? `${esc(m["이름"])}님의 보약은 ${el}(${EL_HANJA[el]}) 기운이다냥. 그 기운을 담아 보낼게.` : "따뜻한 응원을 담아 보낼게."}</p></div></div>
    <label class="field"><span>한 줄 덧붙이기 (선택 · 60자)</span><input id="lt-msg" maxlength="60" placeholder="예) 시험 잘 봐! 끝나고 맛있는 거 먹자"></label>
    <button class="btn primary wide" type="button" id="lt-send" style="margin-top:12px">보약 편지 보내기 🐾</button>
    <p class="sub" style="margin:10px 0 0">친구가 '서로 연결하기'로 자기 지도를 만든 경우에만 배달돼요 · 같은 친구에겐 하루 한 통</p>`);
  $("#lt-send").addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    try {
      await api(`/api/map/${ref.id}/member/${m.id}/letter`, { token: ref.token, msg: $("#lt-msg").value.trim() });
      const q = store.get("quest", {}), w = weekKey();
      store.set("quest", { week: w, sent: (q.week === w ? q.sent || 0 : 0) + 1, total: (q.total || 0) + 1 });
      closeSheet(); toast(`${m["이름"]}님에게 보약 편지를 보냈다냥! 귀인 도장 +1`); renderMapPane();
    } catch (err) { alert(err.message); e.currentTarget.disabled = false; }
  });
}
async function loadLetters(ref) {
  const slot = $("#letters-slot"); if (!slot) return;
  try {
    const r = await api(`/api/map/${ref.id}/letters`, null, ref.token);
    const seen = new Set(store.get("lettersSeen", [])), list = r["편지"] || [];
    if (!list.length) { slot.innerHTML = `<p class="sub" style="margin:10px 0 0">📬 아직 받은 편지는 없다냥.</p>`; return; }
    slot.innerHTML = `<h3 style="margin:14px 0 6px">📬 받은 보약 편지 ${list.length}통</h3>${list.map((x) => `<div class="letter ${seen.has(x.id) ? "" : "new"}">
      <b>${esc(x.from)}님</b> <small>${esc(x.at.slice(5).replace("-", "/"))}</small><p>${esc(x.line)}</p>${x.msg ? `<p class="lm">“${esc(x.msg)}”</p>` : ""}</div>`).join("")}`;
    store.set("lettersSeen", [...new Set([...seen, ...list.map((x) => x.id)])].slice(-100));
  } catch { slot.innerHTML = ""; }
}

// ───────── 전체 메뉴(한곳에 모아 홈을 가볍게)
const ALL_MENU = [
  ["운세", [["luck:new", "🧧", "신년운세"], ["luck:month", "📅", "월별 운세"], ["luck:cal", "🗓️", "운세 달력"], ["luck:life", "📈", "인생 흐름"], ["luck:read", "🐾", "냥이 도사 대풀이"], ["@taegil", "📆", "택일 도우미"]]],
  ["나를 알기", [["@ncard", "🃏", "나의 냥이 카드"], ["saju:fit", "🎯", "나에게 맞는"], ["saju:rx", "🍀", "개운 처방전"], ["saju:manse", "📜", "만세력"], ["saju:sinsal", "🔮", "신살과 길성"], ["saju:ogo", "🏛️", "오고 정밀감명"], ["@gloss", "📚", "명리 교실"]]],
  ["함께", [["compat", "💞", "궁합·귀인 지도"], ["talk", "💬", "고민 상담"], ["path", "🧭", "나의 길"]]],
  ["기록·수집", [["@saved", "🗂️", "내가 본 풀이"], ["@garden", "🌱", "오행 정원"], ["@season", "🎐", "절기 일기"], ["@book", "📖", "냥이 일기장"], ["@dex", "👘", "냥이 도감"], ["@backup", "🔐", "기록 백업"]]],
  ["설정", [["@themesheet", "🌙", "밤 모드"]]],
];
const menuBtn = ([g, ic, l]) => `<button type="button" ${g[0] === "@" ? `data-${g.slice(1)}` : `data-go="${g}"`}><i>${ic}</i><span>${l}</span></button>`;
function openAllMenu() {
  openSheet(`<h2 style="margin:0 0 12px">전체 메뉴</h2>${ALL_MENU.map(([t, items]) => `<h3 class="menu-h">${t}</h3><div class="menu-list">${items.map(menuBtn).join("")}</div>`).join("")}`);
  $$("#sheet-content [data-go]").forEach((b) => b.addEventListener("click", closeSheet));
}
