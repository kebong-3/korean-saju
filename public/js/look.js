"use strict";
/* 사주냥이 화면 스크립트 — 아이콘·밤 모드·3단계 가입·로딩·공유 카드·주간 돌아보기·상담 기억.
   index.html 이 js/ 파일들을 순서대로(defer) 불러 하나의 전역 공간을 함께 쓴다. 모든 계산은 서버(/api/*)가 한다. */
// ───────────────────────── 3·4주차: 손그림 아이콘 · 밤 모드 · 3단계 가입 · 로딩 · 공유 카드 · 주간 돌아보기 · 상담 기억
// 손그림 아이콘: 살짝 일그러진 파스텔 얼룩 위에 둥근 선 — 냥이 그림체와 같은 결
const IC_BLOB = "M13 4.6c4.7-.2 8.5 3.7 8.2 8.4-.3 4.7-4 7.9-8.7 7.8-4.5-.1-7.8-3.7-7.7-8.2.2-4.4 3.6-7.8 8.2-8z";
const IC_COL = { pink: "#ffd0dc", lav: "#e2d6ff", mint: "#c9f0e2", butter: "#ffeaa6", peach: "#ffd9b8", sky: "#d3e3ff" };
const ICONS = {
  home: ["pink", '<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9h11v-9"/><path d="M10.3 19v-4.6h3.4V19"/>'],
  orb: ["lav", '<circle cx="12" cy="10.5" r="6.2"/><path d="M7.5 20h9M9 17.6l-1.2 2.4M15 17.6l1.2 2.4"/><path d="M9.6 8.4c.6-1.2 1.7-1.8 2.9-1.8"/>'],
  scroll: ["butter", '<path d="M8 5h9.5a2 2 0 0 1 2 2v10.5a2 2 0 0 1-2 2H8"/><path d="M8 5a2.2 2.2 0 0 0-2.2 2.2V8H10V7.2A2.2 2.2 0 0 0 8 5z"/><path d="M8 19.5V8"/><path d="M11.5 10.5h5M11.5 13.5h5M11.5 16.5h3"/>'],
  stars: ["pink", '<path d="M8.5 5.2l1.1 2.3 2.5.4-1.8 1.7.4 2.5-2.2-1.2-2.2 1.2.4-2.5L4.9 7.9l2.5-.4z"/><path d="M15.5 19.5s-4.2-2.6-4.2-5.2a2.1 2.1 0 0 1 4.2-.6 2.1 2.1 0 0 1 4.2.6c0 2.6-4.2 5.2-4.2 5.2z"/>'],
  hearts: ["pink", '<path d="M9.5 17s-5-3-5-6.3a2.5 2.5 0 0 1 5-.7 2.5 2.5 0 0 1 5 .7C14.5 14 9.5 17 9.5 17z"/><path d="M15.2 19.5s-2.4-1.5-2.4-3.2"/><path d="M17.5 9.8a2.2 2.2 0 0 1 2.4 2.1c0 2.4-3.8 4.8-3.8 4.8"/>'],
  heart: ["pink", '<path d="M12 19.5s-7-4.2-7-8.8a3.4 3.4 0 0 1 7-1 3.4 3.4 0 0 1 7 1c0 4.6-7 8.8-7 8.8z"/>'],
  month: ["mint", '<rect x="4.5" y="6" width="15" height="13.5" rx="2.5"/><path d="M4.5 10h15M9 4.5v3M15 4.5v3"/><path d="M8.5 14h.01M12 14h.01M15.5 14h.01M8.5 17h.01M12 17h.01"/>'],
  calcheck: ["peach", '<rect x="4.5" y="6" width="15" height="13.5" rx="2.5"/><path d="M4.5 10h15M9 4.5v3M15 4.5v3"/><path d="m9.3 14.8 1.9 1.8 3.6-3.6"/>'],
  paw: ["peach", '<path d="M12 12.6c-3 0-5.2 2.3-5.2 4.3 0 1.4 1.2 2.2 2.5 2.2 1 0 1.7-.6 2.7-.6s1.7.6 2.7.6c1.3 0 2.5-.8 2.5-2.2 0-2-2.2-4.3-5.2-4.3z"/><ellipse cx="7" cy="10.3" rx="1.4" ry="1.8"/><ellipse cx="10.2" cy="7.2" rx="1.4" ry="1.9"/><ellipse cx="13.8" cy="7.2" rx="1.4" ry="1.9"/><ellipse cx="17" cy="10.3" rx="1.4" ry="1.8"/>'],
  book: ["lav", '<path d="M4 6.2c3-1.2 5.4-1 8 1 2.6-2 5-2.2 8-1v12.3c-3-1.1-5.4-.9-8 1-2.6-1.9-5-2.1-8-1z"/><path d="M12 7.2v12.2"/>'],
  envelope: ["pink", '<rect x="6" y="4" width="12" height="16" rx="2"/><path d="M6 8.5l6 4 6-4"/><circle cx="12" cy="15.5" r="1.6"/>'],
  chart: ["mint", '<path d="M4 19.5h16"/><path d="M5 16l4-5 3 3 4-6.2 3 4.2"/><path d="M16 7.8h.01"/>'],
  card: ["butter", '<rect x="6" y="3.8" width="12" height="16.4" rx="2"/><path d="M9.2 12.5 10 10l1.2 1.6h1.6L14 10l.8 2.5"/><path d="M9.6 12.6c.6 2 4.2 2 4.8 0"/><path d="M9 17h6"/>'],
  target: ["peach", '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="1"/>'],
  clover: ["mint", '<path d="M12 12c-1.8-3.6-5.6-2.6-4.6.2.9 2.4 4.6 1.8 4.6-.2z"/><path d="M12 12c1.8-3.6 5.6-2.6 4.6.2-.9 2.4-4.6 1.8-4.6-.2z"/><path d="M12 12c-3.4 1.6-2.6 5.4.2 4.6 2.2-.7 1.8-4.2-.2-4.6z"/><path d="M12 12c3.4 1.6 2.6 5.4-.2 4.6"/><path d="M12.2 16.6c.4 1.4 1.2 2.6 2.4 3.4"/>'],
  pillar: ["lav", '<path d="M4 8.2 12 4l8 4.2"/><path d="M5 8.5h14"/><path d="M7 8.5v9M12 8.5v9M17 8.5v9"/><path d="M4 19.5h16"/>'],
  chat: ["pink", '<path d="M5 6h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-8.5L6 19.3V16H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/>'],
  compass: ["butter", '<circle cx="12" cy="12" r="7.6"/><path d="m14.6 9.4-1.5 3.7-3.7 1.5 1.5-3.7z"/>'],
  folder: ["peach", '<path d="M4 7.3c0-.7.6-1.3 1.3-1.3h4.3l2 2h7.1c.7 0 1.3.6 1.3 1.3v8.4c0 .7-.6 1.3-1.3 1.3H5.3c-.7 0-1.3-.6-1.3-1.3z"/><path d="M4 11h16"/>'],
  sprout: ["mint", '<path d="M12 19.5v-7.2"/><path d="M12 12.3c0-3.2-2.2-5.2-6-5.2 0 3.2 2.2 5.2 6 5.2z"/><path d="M12 14c0-3 2.1-4.8 5.6-4.8 0 3-2.1 4.8-5.6 4.8z"/><path d="M7.5 19.5h9"/>'],
  chime: ["sky", '<path d="M12 3.8v3"/><path d="M8.2 6.8h7.6l-1.1 6.4H9.3z"/><path d="M12 13.2v3"/><path d="M10.8 16.2h2.4l-.4 3.6h-1.6z"/>'],
  kimono: ["pink", '<path d="M8.5 4.5 12 7l3.5-2.5 4.2 3-2.2 3.2-1.8-1V19.5h-7.4V9.7l-1.8 1L4.3 7.5z"/><path d="M12 7v12.5"/><path d="M8.7 12.5h6.6"/>'],
  lock: ["butter", '<rect x="6.5" y="10.5" width="11" height="9" rx="2"/><path d="M9 10.5V8a3 3 0 0 1 6 0v2.5"/><path d="M12 14.2v2"/>'],
  grid: ["lav", '<rect x="5" y="5" width="5.5" height="5.5" rx="1.6"/><rect x="13.5" y="5" width="5.5" height="5.5" rx="1.6"/><rect x="5" y="13.5" width="5.5" height="5.5" rx="1.6"/><rect x="13.5" y="13.5" width="5.5" height="5.5" rx="1.6"/>'],
  books: ["mint", '<path d="M5 5h4v14.5H5zM10 5h4v14.5h-4z"/><path d="m15.2 6.2 3.3-.9 3 13.4-3.3.9z"/>'],
  sun: ["butter", '<circle cx="12" cy="12" r="3.8"/><path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4"/>'],
  moon: ["lav", '<path d="M16.8 15.6A7 7 0 0 1 9 5.2a7 7 0 1 0 7.8 10.4z"/><path d="M17 6.5h.01M19 9.5h.01"/>'],
  coin: ["butter", '<ellipse cx="12" cy="8" rx="6.5" ry="2.8"/><path d="M5.5 8v4c0 1.5 2.9 2.8 6.5 2.8s6.5-1.3 6.5-2.8V8"/><path d="M5.5 12v4c0 1.5 2.9 2.8 6.5 2.8s6.5-1.3 6.5-2.8v-4"/>'],
  bag: ["peach", '<rect x="4.5" y="8" width="15" height="11" rx="2"/><path d="M9 8V6.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6.5V8"/><path d="M4.5 12.5h15"/>'],
  leaf: ["mint", '<path d="M5 19c0-8 5-13 14-14-.6 9-5.6 14-14 14z"/><path d="M5 19c3-4 6-6.5 9.5-8.5"/>'],
  mirror: ["sky", '<ellipse cx="12" cy="9.5" rx="5.2" ry="6"/><path d="M12 15.5v4.5M9.5 20h5"/><path d="M10 7c.5-.9 1.3-1.4 2.2-1.5"/>'],
  family: ["peach", '<circle cx="9" cy="7.5" r="2.4"/><circle cx="16" cy="10" r="1.8"/><path d="M4.8 19c0-3 1.9-5.5 4.2-5.5s4.2 2.5 4.2 5.5"/><path d="M13.3 19c.2-2.2 1.3-3.8 2.7-3.8s2.5 1.6 2.7 3.8"/>'],
  cloud: ["sky", '<path d="M7.5 17.5a3.5 3.5 0 0 1-.3-7 5 5 0 0 1 9.6-1.1 3.9 3.9 0 0 1 .7 7.7z"/><path d="M8 20.5h.01M11 20.5h.01"/>'],
  calendar: ["mint", '<rect x="4.5" y="6" width="15" height="13.5" rx="2.5"/><path d="M4.5 10h15M9 4.5v3M15 4.5v3"/><path d="M8 13.5h3v3H8z"/>'],
};
const EMOJI_IC = { "🏠": "home", "🔮": "orb", "📜": "scroll", "🌌": "stars", "💞": "hearts", "💗": "heart", "💑": "hearts", "📅": "month", "📆": "calcheck",
  "🐾": "paw", "📖": "book", "🧧": "envelope", "📈": "chart", "🃏": "card", "🎯": "target", "🍀": "clover", "🏛️": "pillar", "💬": "chat",
  "🧭": "compass", "🗂️": "folder", "🌱": "sprout", "🎐": "chime", "👘": "kimono", "🔐": "lock", "☰": "grid", "📚": "books", "☀️": "sun",
  "🌙": "moon", "💰": "coin", "💼": "bag", "🌿": "leaf", "🪞": "mirror", "👨‍👧": "family", "💭": "cloud", "🗓️": "calendar" };
function icon(name, size = 26) {
  const x = ICONS[name]; if (!x) return "";
  return `<svg class="hic" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="${IC_BLOB}" fill="${IC_COL[x[0]]}" class="hic-b"/>
    <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${x[1]}</g></svg>`;
}
const icOf = (emo, size) => (EMOJI_IC[emo] ? icon(EMOJI_IC[emo], size) : esc(emo));
/** 화면 안의 이모지 아이콘(<i>)을 손그림 아이콘으로 바꾼다 */
function iconize(root = document) {
  for (const el of root.querySelectorAll(".bottom button > i, .quick i, .menu-list i, .rd-menu i")) {
    const e = el.textContent.trim();
    if (EMOJI_IC[e]) el.innerHTML = icon(EMOJI_IC[e], el.closest(".bottom") ? 26 : 28);
  }
}

// ───────── 밤 모드: 밤 9시~아침 6시 또는 폰이 다크 모드일 때 자동(설정에서 바꿀 수 있음)
/** 색 테마 — 기본은 밝은 🌸 벚꽃. 예전 'auto'(밤엔 자동으로 어둡게)는 벚꽃으로 본다. 밤 자동은 따로 켜야만. */
const THEMES = [["day", "🌸", "벚꽃", "기본 · 밝고 포근하게", ["#fff4f1", "#ff8fa3", "#a78bfa"], "#fff4f1"],
  ["hanji", "📜", "한지", "차분한 아이보리·먹색", ["#f6f0e4", "#c98563", "#9a8566"], "#f6f0e4"],
  ["matcha", "🌿", "말차", "산뜻한 초록·크림", ["#eef5ea", "#6fb58a", "#7fb6a6"], "#eef5ea"],
  ["night", "🌙", "별밤", "어두운 밤하늘", ["#17142a", "#ff8fa3", "#a78bfa"], "#17142a"]];
function themeMode() { let m = "day"; try { m = localStorage.getItem("nyang:theme") || "day"; } catch { /* */ } return THEMES.some((t) => t[0] === m) ? m : "day"; }
const autoNight = () => { try { return localStorage.getItem("nyang:autonight") === "1"; } catch { return false; } };
function applyTheme() {
  const m = themeMode(), h = new Date().getHours(), el = document.documentElement;
  const night = m === "night" || (autoNight() && (h >= 21 || h < 6));
  el.classList.toggle("night", night);
  el.classList.toggle("t-hanji", !night && m === "hanji");
  el.classList.toggle("t-matcha", !night && m === "matcha");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", night ? "#17142a" : THEMES.find((t) => t[0] === m)[5]);
}
function openTheme() {
  const m = themeMode(), pref = (k, d) => { try { return localStorage.getItem(`nyang:${k}`) || d; } catch { return d; } };
  const row = (key, cur, opts) => `<div class="pref-row">${opts.map(([v, t, s]) => `<button type="button" data-pref="${key}" data-val="${v}" class="${cur === v ? "on" : ""}"><b>${t}</b><small>${s}</small></button>`).join("")}</div>`;
  openSheet(`<div class="term-head"><span data-nyang="sleepy" data-size="64"></span><div><h2>보기 설정</h2><div class="term-mean">눈이 편하고 마음이 편하게</div></div></div>
    <h3 class="pref-h">화면 색</h3>
    <div class="theme-cards">${THEMES.map(([k, e, t, s, sw]) => `<button type="button" data-theme="${k}" class="${m === k ? "on" : ""}">
      <span class="sw">${sw.map((c) => `<i style="background:${c}"></i>`).join("")}</span><b>${e} ${t}</b><small>${s}</small></button>`).join("")}</div>
    <label class="check" style="margin-top:8px"><input type="checkbox" data-autonight ${autoNight() ? "checked" : ""}> 밤 9시~아침 6시엔 자동으로 🌙 별밤</label>
    <h3 class="pref-h">글자 크기</h3>${row("font", pref("font", "normal"), [["normal", "보통", "지금 크기"], ["big", "크게", "글자·버튼을 15% 크게"]])}
    <h3 class="pref-h">냥이 말투</h3>${row("tone", pref("tone", "nyang"), [["nyang", "냥냥 말투", "…다냥! 귀엽게"], ["calm", "차분한 말투", "…다. 담백하게"]])}
    <h3 class="pref-h">운세 점수</h3>${row("score", pref("score", "show"), [["show", "숫자로 보기", "오늘 81점"], ["hide", "숫자 숨기기", "길·순탄 같은 말로만"]])}
    <p class="fine">설정은 이 기기에만 저장돼요.</p>`);
}
/** 보기 설정 적용: 글자 크게(html.big) · 점수 숨기기(html.noscore) · 차분한 말투(화면 글자에서 '냥' 어미만 뺀다) */
const hideScore = () => { try { return localStorage.getItem("nyang:score") === "hide"; } catch { return false; } };
const CALM_RE = /(다|라|자)냥(?!이)/g;
let calmObs = null;
function calmNode(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { if (CALM_RE.test(n.data)) { CALM_RE.lastIndex = 0; n.data = n.data.replace(CALM_RE, "$1"); } CALM_RE.lastIndex = 0; }
}
function applyPrefs() {
  let font = "normal", tone = "nyang";
  try { font = localStorage.getItem("nyang:font") || "normal"; tone = localStorage.getItem("nyang:tone") || "nyang"; } catch { /* 저장소 없음 */ }
  document.documentElement.classList.toggle("big", font === "big");
  document.documentElement.classList.toggle("noscore", hideScore());
  if (tone === "calm" && !calmObs) {
    calmNode(document.body);
    calmObs = new MutationObserver((ms) => { for (const m of ms) {
      if (m.type === "characterData") { if (CALM_RE.test(m.target.data)) { CALM_RE.lastIndex = 0; m.target.data = m.target.data.replace(CALM_RE, "$1"); } CALM_RE.lastIndex = 0; }
      else m.addedNodes.forEach((n) => { if (n.nodeType === 1) calmNode(n); else if (n.nodeType === 3 && CALM_RE.test(n.data)) { CALM_RE.lastIndex = 0; n.data = n.data.replace(CALM_RE, "$1"); } CALM_RE.lastIndex = 0; });
    } });
    calmObs.observe(document.body, { childList: true, subtree: true, characterData: true });
  } else if (tone !== "calm" && calmObs) { calmObs.disconnect(); calmObs = null; }
}
applyPrefs();
setInterval(applyTheme, 5 * 60e3);
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyTheme);

// ───────── 3단계 가입: 이름·성별 → 생일 → 시간·장소
function stepify(form) {
  const kids = [...form.children].filter((el) => el.matches(".field, details.adv"));
  const step = (el) => {
    const t = el.querySelector("span")?.textContent || "";
    if (/이름|성별/.test(t)) return 1;
    if (/생년월일/.test(t)) return 2;
    return 3;
  };
  kids.forEach((el) => (el.dataset.step = step(el)));
  const submit = form.querySelector("button[type=submit]");
  const tips = { 1: "냥이가 뭐라고 부르면 될까? 닉네임도 좋다냥.", 2: "양력·음력을 꼭 확인해 줘. 음력 윤달이면 체크!",
    3: "시간을 알면 시주까지 봐 줄 수 있다냥. 모르면 '몰라요'를 눌러도 괜찮아." };
  (form.querySelector(".form-title") || form).insertAdjacentHTML(form.querySelector(".form-title") ? "afterend" : "afterbegin", `<div class="steps"><div class="step-dots">${[1, 2, 3].map((n) => `<i data-dot="${n}"></i>`).join("")}</div><p class="step-tip"></p></div>`);
  submit.insertAdjacentHTML("beforebegin", `<div class="step-nav"><button type="button" class="ghost" data-step-prev>← 이전</button><button type="button" class="btn primary" data-step-next>다음 →</button></div>`);
  let cur = 1;
  const show = (n) => {
    cur = n;
    kids.forEach((el) => (el.hidden = +el.dataset.step !== n));
    $$("[data-dot]", form).forEach((d) => d.classList.toggle("on", +d.dataset.dot <= n));
    $(".step-tip", form).textContent = tips[n];
    $("[data-step-prev]", form).hidden = n === 1;
    $("[data-step-next]", form).hidden = n === 3; submit.hidden = n !== 3;
  };
  form.addEventListener("click", (e) => {
    if (e.target.closest("[data-step-next]")) { e.preventDefault(); show(Math.min(3, cur + 1)); }
    if (e.target.closest("[data-step-prev]")) { e.preventDefault(); show(Math.max(1, cur - 1)); }
  });
  form.addEventListener("keydown", (e) => { if (e.key === "Enter" && cur < 3 && e.target.tagName === "INPUT") { e.preventDefault(); show(cur + 1); } });
  form._step = show;
  show(1);
}

// ───────── 계산 중 화면(골격) — 첫 계산은 1~2초 걸린다
function showLoading(on) {
  let el = $("#loading-veil");
  if (!on) { el?.remove(); return; }
  if (el) return;
  document.body.insertAdjacentHTML("beforeend", `<div id="loading-veil" class="veil"><div class="veil-in">
    <span data-nyang="focus" data-size="96"></span><b>냥이가 만세력을 펼치는 중…</b><small>절기 시각을 천문 계산으로 맞추고 있다냥</small>
    <div class="skel"><i></i><i></i><i></i></div></div></div>`);
  paintNyang($("#loading-veil"));
}

// ───────── 이미지 만들기(9:16 스토리 카드) · 공유
function svgBlob(svg, scale = 3) {
  return new Promise((res) => {
    const xml = new XMLSerializer().serializeToString(svg), vb = svg.viewBox.baseVal, img = new Image();
    img.onload = () => {
      const cv = document.createElement("canvas"); cv.width = vb.width * scale; cv.height = vb.height * scale;
      const ctx = cv.getContext("2d"); ctx.scale(scale, scale); ctx.drawImage(img, 0, 0, vb.width, vb.height);
      cv.toBlob(res, "image/png");
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  });
}
async function shareImage(svg, filename, text) {
  const blob = await svgBlob(svg);
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text: `${text} ${location.origin}/` }); return; } catch { return; }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("이미지를 저장했다냥! 인스타 스토리에 올려 봐 🐾");
}
const wrapText = (s, n) => { const out = []; let line = ""; for (const w of String(s).split(" ")) { if ((line + " " + w).trim().length > n) { out.push(line.trim()); line = w; } else line += " " + w; } if (line.trim()) out.push(line.trim()); return out; };
function storySvg(kind) {
  const d = S.d, W = 360, H = 640, nm = esc(nim());
  const lines = (arr, x, y, size, color, lh = 1.5, anchor = "middle") => arr.map((t, i) => `<text x="${x}" y="${y + i * size * lh}" font-size="${size}" fill="${color}" text-anchor="${anchor}">${esc(t)}</text>`).join("");
  let bg = ["#ffe4ea", "#efe9ff"], body = "", cat = "";
  if (kind === "pae") {
    const p = d["오늘의패"];
    bg = ["#fff0d9", "#ffe4ea"];
    cat = nyang("happy", 120).replace("<svg ", '<svg x="120" y="388" ');
    body = `<text x="180" y="86" font-size="15" fill="#c2385a" text-anchor="middle">${+p["날짜"].slice(5, 7)}월 ${+p["날짜"].slice(8)}일 · ${nm}의 오늘의 패</text>
      <rect x="70" y="110" width="220" height="250" rx="26" fill="#fff" stroke="#ffd0dc" stroke-width="3"/>
      <text x="180" y="200" font-size="64" text-anchor="middle">${esc(p["이모지"])}</text>
      <text x="180" y="252" font-size="30" fill="#3b2f4a" text-anchor="middle">${esc(p["이름"])}</text>
      <text x="180" y="282" font-size="14" fill="#6b6080" text-anchor="middle">${esc(p["십성"])}의 날</text>
      ${lines(wrapText(p["말"], 15), 180, 316, 14, "#3b2f4a", 1.45)}
      <rect x="36" y="520" width="288" height="78" rx="18" fill="#fff" opacity=".9"/>
      <text x="180" y="542" font-size="12" fill="#7c5cf0" text-anchor="middle">오늘 한 가지</text>
      ${lines(wrapText(p["행동"], 19).slice(0, 2), 180, 564, 14, "#3b2f4a", 1.4)}`;
  } else if (kind === "ncard") {
    const c = d["냥이카드"];
    bg = ["#ffffff", c["색"] + "55"];
    cat = nyang("happy", 170, c["옷"]).replace("<svg ", '<svg x="95" y="120" ');
    body = `<text x="180" y="86" font-size="15" fill="#6b6080" text-anchor="middle">${nm}의 60일주 냥이 · ${esc(c["일주"])}일주</text>
      <text x="180" y="340" font-size="30" fill="#3b2f4a" text-anchor="middle">${esc(c["이름"])}</text>
      <text x="180" y="374" font-size="15" fill="#7c5cf0" text-anchor="middle">${c["키워드"].map((k) => "#" + esc(k)).join("  ")}</text>
      ${lines(wrapText(c["한줄"], 17), 180, 420, 15, "#3b2f4a", 1.5)}
      <text x="180" y="560" font-size="17" fill="#c2385a" text-anchor="middle">너는 무슨 냥이야?</text>`;
  } else {
    const top = (d["신살이야기"]?.["나"] || []).slice(0, 3), I = S.sinsal?.["설명"] || {};
    bg = ["#221d38", "#3a2f66"];
    cat = nyang("proud", 110).replace("<svg ", '<svg x="125" y="78" ');
    body = `<text x="180" y="60" font-size="15" fill="#e2d6ff" text-anchor="middle">${nm}의 사주에 뜬 별 세 개</text>
      ${top.map((x, i) => { const y = 220 + i * 120; return `<rect x="30" y="${y}" width="300" height="104" rx="22" fill="#ffffff" opacity=".1"/>
        <text x="52" y="${y + 36}" font-size="22" fill="#ffd66b">★ ${esc(x["이름"])}</text>
        ${lines(wrapText(I[x["이름"]]?.["한줄"] || "", 22), 52, y + 64, 13.5, "#ece6f7", 1.45, "start")}`; }).join("")}
      ${[[40, 120], [320, 90], [300, 190], [60, 200], [180, 600], [30, 590], [330, 610]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#fff" opacity=".7"/>`).join("")}`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" font-family="Jua, Gowun Dodum, Apple SD Gothic Neo, Malgun Gothic, sans-serif">
    <defs><linearGradient id="sg-${kind}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#sg-${kind})"/>${cat}${body}
    <text x="180" y="${H - 22}" font-size="12" fill="${kind === "sinsal" ? "#b3a8c9" : "#6b6080"}" text-anchor="middle">사주냥이 · korean-saju-six.vercel.app</text></svg>`;
}
function openStory(kind) {
  track("story", { k: kind });
  const label = { pae: "오늘의 패", ncard: "냥이 카드", sinsal: "나의 별 세 개" }[kind];
  const text = { pae: `오늘 내 패는 '${S.d["오늘의패"]?.["이름"]}' 🐾 너의 오늘 패는?`, ncard: `나는 '${S.d["냥이카드"]?.["이름"]}'래 🐾 너는 무슨 냥이야?`,
    sinsal: "내 사주에 뜬 별 세 개 ✨ 너의 별도 궁금하다냥" }[kind];
  openSheet(`<h2 style="margin:0 0 10px">📸 ${label} 스토리 카드</h2><div id="story-box" class="story-box">${storySvg(kind)}</div>
    <div class="rd-cta" style="margin-top:12px"><button class="btn primary" type="button" id="story-share">📤 공유하기</button>
      <button class="btn lav" type="button" id="story-save">🖼️ 이미지 저장</button></div>
    <p class="sub" style="text-align:center;margin:8px 0 0">폰에서 '공유하기'를 누르면 카카오톡·인스타로 바로 보낼 수 있다냥.</p>`);
  const svg = () => $("#story-box svg"), fn = `사주냥이_${label.replace(/ /g, "_")}.png`;
  $("#story-share").addEventListener("click", () => { track("story_share", { k: kind }); shareImage(svg(), fn, text); });
  $("#story-save").addEventListener("click", () => { track("story_save", { k: kind }); saveSvgPng(svg(), fn); });
}

// ───────── 주간 돌아보기(일·월요일): 지난 7일 운세 점수와 내 기분, 다음 주 미리보기
function weekCard() {
  const days = store.get("days", {}), diary = store.get("diary", {});
  const last = [...Array(7)].map((_, i) => kstDate(i - 6));
  const seen = last.filter((d) => days[d]).length;
  const moods = last.filter((d) => diary[d]).map((d) => diary[d].mood);
  const avg = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null;
  const next = (S.d["운세"]["달력"] || []).slice(1, 8);
  const best = next.reduce((a, b) => (b["점수"] > (a?.["점수"] ?? -1) ? b : a), null);
  const mx = Math.max(...last.map((d) => days[d]?.["점수"] || 0), 1);
  return `<div class="card tint-lav week-card"><div class="card-head"><h2>🪞 이번 주 돌아보기</h2><span class="badge">출석 ${seen}/7</span></div>
    <div class="wk-bars">${last.map((d) => { const s = days[d]?.["점수"]; const m = diary[d]; return `<div><span class="wk-m">${m ? MOODS[m.mood][0] : ""}</span>
      <i style="height:${s ? Math.round((s / mx) * 60) + 8 : 4}px" class="${s ? calCls(s) : "none"}"></i><small>${"일월화수목금토"[new Date(d + "T00:00:00").getDay()]}</small></div>`; }).join("")}</div>
    <p style="margin:10px 0 0">${seen ? `이번 주 ${seen}일 들렀다냥. ` : "이번 주엔 냥이를 거의 못 봤다냥… "}${avg == null ? "기분 기록을 남기면 냥이가 적중률도 알려 준다냥." : avg >= 1.5 ? "기분 좋은 날이 많았구나! 그 리듬 그대로 가자냥." : avg >= .8 ? "무난하게 잘 버틴 한 주였다냥." : "조금 지친 한 주였구나. 주말엔 푹 쉬어라냥."}</p>
    ${best ? `<p class="sub" style="margin:6px 0 0">다음 주 힘 실을 날: <b>${+best.date.slice(5, 7)}월 ${+best.date.slice(8)}일</b> (${best["점수"]}점) — 중요한 약속은 이날로!</p>` : ""}</div>`;
}

// ───────── 상담 기억 · 냥이와의 약속(실천 1가지)
function rememberTalk(q) {
  const mem = store.get("talkmem", []);
  mem.unshift({ d: kstDate(0), q: String(q).slice(0, 80) });
  store.set("talkmem", mem.slice(0, 5));
}
function talkMemo() {
  const mem = store.get("talkmem", []).map((m) => `${m.d} 고민: ${m.q}`);
  const p = store.get("promise", null);
  if (p) mem.unshift(`${p.d} 냥이와 약속: ${p.t}${p.done == null ? "" : p.done ? " (지켰음)" : " (못 지킴)"}`);
  return mem.slice(0, 5);
}
function promiseBox() {
  return `<div class="promise-box"><b>🤙 냥이랑 약속 하나</b><small>오늘 해 볼 한 가지를 적으면 내일 냥이가 물어본다냥</small>
    <div class="promise-in"><input id="promise-t" maxlength="40" placeholder="예) 퇴근 후 20분 산책하기"><button type="button" class="btn primary" data-promise>약속</button></div></div>`;
}
function promiseCheck() {
  const p = store.get("promise", null);
  if (!p || p.d >= kstDate(0) || p.done != null) return "";
  return `<div class="card promise-check"><span data-nyang="wink" data-size="54"></span><div><small>${+p.d.slice(5, 7)}월 ${+p.d.slice(8)}일 냥이와 약속</small>
    <b>${esc(p.t)}</b><div class="pc-btn"><button type="button" class="btn primary" data-kept="1">했다냥! ✅</button><button type="button" class="ghost" data-kept="0">못 했어</button></div></div></div>`;
}
document.addEventListener("click", (e) => {
  const th = e.target.closest("[data-theme]");
  if (th) { track("theme", { m: th.dataset.theme }); localStorage.setItem("nyang:theme", th.dataset.theme); applyTheme(); openTheme(); return; }
  if (e.target.closest("[data-themesheet]")) { openTheme(); return; }
  const an = e.target.closest("[data-autonight]");
  if (an) { try { localStorage.setItem("nyang:autonight", an.checked ? "1" : "0"); } catch { /* */ } applyTheme(); return; }
  const pf = e.target.closest("[data-pref]");
  if (pf) {
    const k = pf.dataset.pref, v = pf.dataset.val, was = localStorage.getItem(`nyang:${k}`);
    try { localStorage.setItem(`nyang:${k}`, v); } catch { /* 저장소 없음 */ }
    track("pref", { k, v });
    if (k === "tone" && was === "calm" && v !== "calm") { location.reload(); return; }  // 이미 바꾼 글자를 되돌리려면 새로 그린다
    applyPrefs();
    if (k === "score" && S.d) { const h = $("#tab-home"); renderHome(); paintNyang(h); iconize(h); dedupeTerms(h); }
    openTheme(); return;
  }
  const sk = e.target.closest("[data-story]"); if (sk) { openStory(sk.dataset.story); return; }
  if (e.target.closest("[data-promise]")) {
    const t = $("#promise-t")?.value.trim(); if (!t) { $("#promise-t")?.focus(); return; }
    store.set("promise", { d: kstDate(0), t, done: null }); track("promise");
    e.target.closest(".promise-box").outerHTML = `<p class="promise-ok">🤙 약속했다냥! 내일 홈에서 물어볼게: <b>${esc(t)}</b></p>`;
    return;
  }
  const kp = e.target.closest("[data-kept]");
  if (kp) {
    const p = store.get("promise", null); if (!p) return;
    p.done = kp.dataset.kept === "1"; store.set("promise", p); track("promise_kept", { ok: p.done ? 1 : 0 });
    if (p.done) { gardenAdd(S.d["용신"]["용신"], 1, "약속을 지켰다냥"); store.set("beadBonus", kstDate(0)); toast("약속을 지켰다냥! 오늘 상담 구슬 ⭐ 한 알 더 🐾"); }
    kp.closest(".promise-check").outerHTML = `<div class="card promise-check done"><span data-nyang="${p.done ? "love" : "shy"}" data-size="54"></span><div><b>${p.done ? "역시! 약속 지킨 사람이 운도 지킨다냥. 보약 화분에 물 한 번 더 줬다냥 🌱" : "괜찮아, 오늘 다시 하면 된다냥. 냥이는 늘 여기 있다냥 🐾"}</b></div></div>`;
    paintNyang($("#tab-home"));
  }
});

async function withLoading(p) {
  const t = setTimeout(() => showLoading(true), 250);
  try { return await p; } finally { clearTimeout(t); showLoading(false); }
}
function openAcc() {
  openSheet(`<div class="term-head"><span data-nyang="focus" data-size="64"></span><div><h2>🔭 이 만세력은 이렇게 계산했다냥</h2><div class="term-mean">외워 둔 표가 아니라 하늘을 직접 계산</div></div></div>
    <ul class="tips">
      <li><b>절기 시각</b>: 태양의 위치를 천문 계산으로 구해 절입 시각을 분 단위로 맞춘다냥. 한국천문연구원 발표 절기와 대조하는 검사를 배포 때마다 돌린다냥.</li>
      <li><b>태어난 곳 보정</b>: 서울과 부산은 해가 뜨는 시각이 달라서, 태어난 곳 경도로 시간을 보정한다냥(지방시).</li>
      <li><b>서머타임</b>: 1948~1988년 한국 서머타임 기간은 자동으로 1시간 빼서 계산한다냥.</li>
      <li><b>야자시</b>: 밤 11~12시 출생은 학파마다 날짜를 다르게 본다냥. 기본은 다음 날, 고급 설정에서 '야자시'를 켜면 당일로 본다냥.</li>
      <li><b>음력</b>: 1900~2100년 음력·윤달을 천문 계산으로 만든다냥.</li></ul>
    <p class="sub">다른 만세력과 다르면 대부분 시간 보정(지방시·서머타임)이나 야자시 설정 차이다냥. 내 정보 수정에서 태어난 곳과 고급 설정을 확인해 봐.</p>`);
}
document.addEventListener("click", (e) => { if (e.target.closest("[data-acc]")) openAcc(); });
