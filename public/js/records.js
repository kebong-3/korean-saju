"use strict";
/* 사주냥이 화면 스크립트 — 나의 기록·출석·택일·백업·알림.
   index.html 이 js/ 파일들을 순서대로(defer) 불러 하나의 전역 공간을 함께 쓴다. 모든 계산은 서버(/api/*)가 한다. */
// ───────────────────────── 나의 기록 (이 기기에만 저장) — 출석·오늘 어땠냥·돌아보기·준비하기
const CORE = ["year", "month", "day", "hour", "minute", "gender", "calendar", "leap"];
const meKey = () => hashStr(JSON.stringify(CORE.map((k) => S.birth?.[k])));  // 결혼·자녀를 바꿔도 기록은 그대로
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(`nyang:${k}:${meKey()}`)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`nyang:${k}:${meKey()}`, JSON.stringify(v)); } catch { /* 저장 공간 부족 */ } },
};
const MOODS = [["😣", "별로"], ["🙂", "보통"], ["😆", "좋았음"]];
function markVisit(t) {
  const days = store.get("days", {});
  days[t.date] = { 십성: t["십성"].split("/")[0], 점수: t["점수"], 일진: t["일진"] };
  const keys = Object.keys(days).sort();
  keys.slice(0, Math.max(0, keys.length - 400)).forEach((k) => delete days[k]);
  store.set("days", days);
}
function streak() {
  const days = store.get("days", {});
  let n = 0;
  for (let i = 0; i < 400; i++) { if (days[kstDate(-i)]) n++; else break; }
  return n;
}
function checkinCard() {
  const diary = store.get("diary", {}), days = store.get("days", {});
  const today = kstDate(0), yest = kstDate(-1);
  const n = streak(), week = [...Array(7)].map((_, i) => kstDate(i - 6));
  const target = !diary[yest] && days[yest] && !diary[today] && new Date(Date.now() + 9 * 3600e3).getUTCHours() < 12 ? yest : today;
  const done = diary[target];
  const label = target === today ? "오늘 하루 어땠냥?" : "어제는 어땠냥?";
  const hit = diaryStats().hit;
  return `<div class="checkin"><div class="ck-head"><b>🐾 출석 도장</b><span class="badge pink">${n >= 7 ? "일주일 개근!" : `${n}일 연속`}</span></div>
    <div class="stamps">${week.map((dd) => `<div class="${days[dd] ? "on" : ""} ${dd === today ? "is-today" : ""}"><span>${days[dd] ? (diary[dd] ? MOODS[diary[dd].mood][0] : "🐾") : ""}</span><small>${"일월화수목금토"[new Date(dd + "T00:00:00").getDay()]}</small></div>`).join("")}</div>
    ${bookLine()}${pushLine()}
    <div class="mood-q"><b>${label}</b>${done ? `<span class="sub"> — ${MOODS[done.mood][0]} 기록 완료!${hit != null ? ` · 냥이 적중률 ${hit}%` : ""}</span>` : ""}</div>
    ${done ? "" : `<div class="moods">${MOODS.map(([e, l], i) => `<button type="button" data-mood="${i}" data-day="${target}">${e}<small>${l}</small></button>`).join("")}</div>
      <input class="note-in" id="mood-note" maxlength="80" placeholder="한 줄 메모 (선택) — 예) 회의에서 칭찬받음">`}
    </div>`;
}
function saveMood(i, day) {
  const diary = store.get("diary", {}), days = store.get("days", {});
  diary[day] = { mood: +i, note: ($("#mood-note")?.value || "").trim(), 십성: days[day]?.["십성"] || "", 점수: days[day]?.["점수"] ?? null };
  store.set("diary", diary);
  $("#checkin-slot").innerHTML = checkinCard();
  const say = +i === 2 ? "좋은 날이었구나! 냥이도 꼬리가 살랑살랑 🐾" : +i === 1 ? "무난한 하루도 소중하다냥. 푹 쉬어!" : "고생 많았다냥… 오늘은 따뜻한 거 먹고 일찍 자라냥.";
  $("#checkin-slot .card").insertAdjacentHTML("beforeend", `<div class="say" style="margin-top:10px"><span class="who" data-nyang="${+i === 0 ? "sad" : +i === 2 ? "laugh" : "happy"}" data-size="44"></span><div class="bubble">${say}</div></div>`);
  paintNyang($("#checkin-slot"));
}
function diaryStats() {
  const diary = store.get("diary", {}), arr = Object.entries(diary).map(([d, v]) => ({ d, ...v }));
  const scored = arr.filter((x) => x["점수"] != null);
  // 점수로 기대한 기분(63↑ 좋음, 47↓ 별로, 그 사이 보통)과 실제 기분이 같으면 1, 한 칸 차이면 0.5
  const exp = (sc) => (sc >= 63 ? 2 : sc <= 47 ? 0 : 1);
  const pts = scored.reduce((a, x) => a + (x.mood === exp(x["점수"]) ? 1 : Math.abs(x.mood - exp(x["점수"])) === 1 ? 0.5 : 0), 0);
  const ok = pts;
  const by = {};
  arr.forEach((x) => { if (!x["십성"]) return; (by[x["십성"]] ||= []).push(x.mood); });
  return { arr: arr.sort((a, b) => (a.d < b.d ? 1 : -1)), hit: scored.length >= 3 ? Math.round((ok / scored.length) * 100) : null, by };
}
let wIdx = null;
function wisdomCard(w) {
  if (!w) return "";
  const all = w["전체"] || [w];
  if (wIdx == null) wIdx = w["오늘"] ?? 0;
  const x = all[wIdx % all.length], isToday = wIdx === (w["오늘"] ?? 0);
  const mk = `nyang:wm:${kstDate(0)}:${x.key}`, done = localStorage.getItem(mk) === "1";
  return `<div class="card wisdom" id="wisdom"><div class="card-head"><h2>📖 ${isToday ? "오늘의" : "한 줄 더!"} 냥이 고전 한 줄</h2><span class="badge">${esc(x["출전"].split(" · ")[0])}</span></div>
    <div class="w-title">${esc(x["제목"])}</div>
    <div class="w-now">“${esc(x["요즘말"])}”</div>
    <div class="say"><span class="who" data-nyang="wink" data-size="46"></span><div class="bubble">${esc(x["풀이"])}${x["나에게"] ? `<br><b class="w-me">🐾 ${esc(x["나에게"])}</b>` : ""}</div></div>
    <button type="button" class="w-mission ${done ? "done" : ""}" data-wm="${mk}">${done ? "✅" : "⬜"} 오늘의 미션: ${esc(x["미션"])}</button>
    ${moreSet([["📜 원문 보기", `<div class="orig">${esc(x["원문"])}</div><div class="src">— ${esc(x["출전"])}</div><p class="mean">${esc(x["뜻"])}</p>`]])}
    ${all.length > 1 ? `<button type="button" class="ghost wide w-next" data-wnext style="margin-top:10px">🔄 다른 구절 보여줘냥</button>` : ""}</div>`;
}
function pathTeaser() {
  const past = store.get("past", {}), n = Object.keys(past).length;
  return `<div class="card tint-mint path-teaser"><h2>🧭 나의 길</h2>
    <p>사주는 과거를 돌아보고 미래를 준비하는 거울이다냥. ${n ? `지난 해 기록 <b>${n}개</b>가 쌓였어. 패턴이 보이기 시작한다냥!` : "기억나는 해에 무슨 일이 있었는지 남기면, 냥이가 네 운의 패턴을 찾아 준다냥."}</p>
    <div class="rd-cta"><button class="btn lav" type="button" data-go="path:past">🪞 지난 해 돌아보기</button><button class="btn lav" type="button" data-go="path:future">🌱 앞으로 준비하기</button></div></div>`;
}

// ───────────────────────── 출석 보상: 냥이의 2천 년 일기장 · 칭호
const BOOK_AT = [1, 3, 5, 7, 10, 14, 21, 30];
const TITLES = [[100, "👑", "냥이 수호자"], [60, "🌙", "명리 도반"], [30, "🏮", "2천 년 일기장 지기"], [21, "📜", "냥이 제자"],
  [14, "🧶", "꾹꾹이 동지"], [7, "🐾", "냥이 친구"], [3, "🍵", "단골 손님"], [0, "🐣", "처음 온 손님"]];
const visits = () => Object.keys(store.get("days", {})).length;
function myTitle(n = visits()) {
  const t = TITLES.find(([k]) => n >= k), nx = [...TITLES].reverse().find(([k]) => k > n);
  return { e: t[1], name: t[2], next: nx };
}
function bookState() {
  const n = visits(), total = Math.min((S.stories || []).length, BOOK_AT.length);
  const open = BOOK_AT.slice(0, total).filter((k) => n >= k).length, nextAt = BOOK_AT.slice(0, total).find((k) => k > n);
  return { n, open, total, nextAt, left: nextAt ? nextAt - n : 0 };
}
function bookLine() {
  if (!S.stories?.length) return "";
  const b = bookState(), t = myTitle(b.n), fresh = b.open > store.get("bookSeen", 0);
  return `<button type="button" class="book-line ${fresh ? "fresh" : ""}" data-book>
    <span>📖 냥이의 2천 년 일기장 <b>${b.open}/${b.total}</b>${fresh ? ' <i class="new">새 이야기!</i>' : ""}</span>
    <small>칭호 ${t.e} ${esc(t.name)} · 누적 출석 ${b.n}일${b.nextAt ? ` · 다음 이야기까지 ${b.left}일` : " · 이야기를 전부 모았다냥!"}</small></button>`;
}
function openBook() {
  const b = bookState(), t = myTitle(b.n), all = S.stories.slice(0, b.total);
  store.set("bookSeen", b.open);
  openSheet(`<div class="term-head"><span data-nyang="love" data-size="64"></span><div><h2>냥이의 2천 년 일기장</h2>
    <div class="term-mean">들를 때마다 냥이가 옛 손님 이야기를 하나씩 꺼내 준다냥</div></div></div>
    <div class="book-title">${t.e} 지금 칭호 <b>${esc(t.name)}</b> · 누적 출석 ${b.n}일${t.next ? `<br><small>${t.next[0] - b.n}일 더 오면 ${t.next[1]} ${esc(t.next[2])}</small>` : ""}</div>
    <div class="book-list">${all.map((s, i) => (b.n >= BOOK_AT[i]
    ? `<details class="book-item"${i === b.open - 1 ? " open" : ""}><summary><b>${i + 1}. 『${esc(s["제목"])}』</b> <span class="sub">${esc(s["시대"])}</span></summary>
        <p>${esc(s["이야기"])}</p><div class="lesson">🐾 ${esc(s["교훈"])} <span class="sub">— ${T(s["개념"], true)}</span></div></details>`
    : `<div class="book-item locked"><b>${i + 1}. 🔒 아직 잠긴 이야기</b> <span class="sub">출석 ${BOOK_AT[i]}일째에 열린다냥 (${BOOK_AT[i] - b.n}일 남음)</span></div>`)).join("")}</div>
    <button type="button" class="btn lav wide" data-dex style="margin-top:12px">👘 표정·옷 도감 보기 (${dexCount().got}/${dexCount().all})</button>
    <p class="sub" style="margin-top:10px;text-align:center">출석은 하루 한 번, 이 기기에 기록돼요. 기기를 바꿀 땐 🔐 기록 백업으로 옮겨 오세요.</p>`);
  const slot = $("#checkin-slot"); if (slot) slot.innerHTML = checkinCard();
}

// ───────────────────────── 택일 도우미
const TAEGIL = [["move", "🏠", "이사·입주"], ["contract", "✍️", "계약·서명"], ["interview", "💼", "면접·발표"], ["exam", "📚", "시험·자격증"],
  ["date", "💗", "데이트·고백"], ["start", "🚀", "새 일 시작"]];
let tgSeq = 0;
async function openTaegil(p = "move") {
  track("taegil");
  const my = ++tgSeq;
  openSheet(`<h2 style="margin:0 0 4px">📆 냥이 택일 도우미</h2><p class="sub" style="margin:0 0 10px">앞으로 60일 중에서 ${esc(nim())}에게 맞는 날을 골라 준다냥</p>
    <div class="tg-chips">${TAEGIL.map(([k, e, l]) => `<button type="button" class="${k === p ? "on" : ""}" data-tgl="${k}">${e} ${l}</button>`).join("")}</div>
    <div id="tg-box"><p class="sub" style="text-align:center;padding:24px 0">냥이가 달력을 넘기는 중… 📅</p></div>`);
  $$("[data-tgl]").forEach((b) => b.addEventListener("click", () => openTaegil(b.dataset.tgl)));
  try {
    const tk = `nyang:tg:${meKey()}:${p}:${kstDate(0)}`;
    let r = null; try { r = JSON.parse(localStorage.getItem(tk) || "null"); } catch { r = null; }
    if (!r) { r = await api("/api/taegil", { birth: S.birth, purpose: p }); try { localStorage.setItem(tk, JSON.stringify(r)); } catch { /* */ } }
    saveViewed({ key: tk, type: "taegil", o: { purpose: p }, title: `택일 · ${r["이름"]}`, icon: r["이모지"], sub: r["기간"] });
    if (my !== tgSeq || !$("#tg-box")) return;
    $("#tg-box").innerHTML = taegilBody(r);
  } catch (e) { if (my === tgSeq && $("#tg-box")) $("#tg-box").innerHTML = `<p class="error">${esc(e.message)}</p>`; }
}
function taegilBody(r) {
  const fmt = (x) => { const [, m, d] = x.date.split("-"); return `${+m}월 ${+d}일 (${x["요일"]})`; };
  return `<div class="bubble lav" style="margin:4px 0 12px">${esc(r["이모지"])} ${esc(r["이름"])}: ${esc(r["기준"])}</div>
    <h3 class="tg-h">✨ 냥이가 고른 날</h3>
    ${r["추천"].map((x) => `<div class="tg-day"><div class="tg-d"><b>${fmt(x)}</b><span class="sub">${esc(x["일진"])}일 · ${T(x["십성"], true)}</span><span class="badge pink">${x["점수"]}점</span></div>
      <div class="tg-why">${x["이유"].length ? x["이유"].map(esc).join(" · ") : "마찰 없이 순하게 흐르는 날"}</div><div class="sub">🐾 ${esc(x["한마디"])}</div></div>`).join("")}
    ${r["피할날"].length ? `<h3 class="tg-h">🙅 큰일은 살짝 피하면 좋은 날</h3><p class="sub" style="margin:0 0 8px">${r["피할날"].map((x) => `${fmt(x)} — ${x["주의"].map(esc).join(", ")}`).join("<br>")}</p>` : ""}
    <p class="sub" style="text-align:center">${esc(r["안내"])}<br>기간 ${esc(r["기간"])}</p>`;
}

// ───────────────────────── 기록 백업(복구 코드) — 이 기기에서 코드로 잠근 뒤 보내므로 서버는 내용을 읽을 수 없다
const B32 = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => [...crypto.getRandomValues(new Uint8Array(12))].map((x) => B32[x % 32]).join("").match(/.{4}/g).join("-");
const normCode = (c) => { const s = String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); return s.length === 12 && [...s].every((ch) => B32.includes(ch)) ? s.match(/.{4}/g).join("-") : null; };
const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function codeKeys(code) {
  const enc = new TextEncoder(), raw = enc.encode(code.replace(/-/g, ""));
  const idb = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode("nyang-id:" + code.replace(/-/g, ""))));
  const id = [...idb.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const base = await crypto.subtle.importKey("raw", raw, "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: enc.encode("sajunyang-backup-v1"), iterations: 150000, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  return { id, key };
}
const SKIP_KEYS = ["nyang:backupCode", "nyang:backupAt"];
function collectLocal() {
  const o = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith("nyang:") && !SKIP_KEYS.includes(k)) o[k] = localStorage.getItem(k); }
  return o;
}
async function doBackup() {
  const code = localStorage.getItem("nyang:backupCode") || newCode();
  const { id, key } = await codeKeys(code), iv = crypto.getRandomValues(new Uint8Array(12));
  const body = new TextEncoder().encode(JSON.stringify({ v: 1, at: new Date().toISOString(), data: collectLocal() }));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, body));
  await api("/api/backup", { id, iv: b64(iv), ct: b64(ct) });
  localStorage.setItem("nyang:backupCode", code); localStorage.setItem("nyang:backupAt", kstDate(0));
  return code;
}
async function doRestore(code) {
  const { id, key } = await codeKeys(code);
  const r = await api(`/api/backup/${id}`);
  let j;
  try { j = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(r.iv) }, key, unb64(r.ct)))); }
  catch { throw new Error("코드가 맞지 않는 것 같다냥. 다시 확인해 줘"); }
  Object.entries(j.data || {}).forEach(([k, v]) => { if (k.startsWith("nyang:") && typeof v === "string") localStorage.setItem(k, v); });
  localStorage.setItem("nyang:backupCode", code); localStorage.setItem("nyang:backupAt", kstDate(0));
  return j;
}
function autoBackup() {  // 백업을 켠 사람만, 하루 한 번 조용히 최신으로
  if (!S.share || !localStorage.getItem("nyang:backupCode") || localStorage.getItem("nyang:backupAt") === kstDate(0)) return;
  doBackup().catch(() => {});
}
function openBackup() {
  const code = localStorage.getItem("nyang:backupCode");
  if (!S.share) { openSheet(`<h2>🔐 기록 백업</h2><p class="sub">백업 저장소를 준비 중이다냥. 조금만 기다려 줘!</p>`); return; }
  openSheet(`<h2 style="margin:0 0 6px">🔐 기록 백업 · 복구 코드</h2>
    <p class="sub" style="margin:0 0 10px">폰을 바꾸거나 브라우저 기록을 지워도 출석·운세 일기·지난 해 기록·입명 노트를 되찾을 수 있다냥.</p>
    ${code ? `<div class="bk-code"><small>나의 복구 코드</small><b id="bk-code">${esc(code)}</b>
        <div class="rd-cta"><button class="btn lav" type="button" id="bk-copy">📋 코드 복사</button><button class="btn primary" type="button" id="bk-now">🔄 지금 최신으로</button></div>
        <small>마지막 백업 ${esc(localStorage.getItem("nyang:backupAt") || "-")} · 들를 때마다 하루 한 번 자동으로 최신화돼요</small></div>
        <button class="ghost wide" type="button" id="bk-del" style="margin-top:8px">🗑 서버에서 백업 지우기</button>`
    : `<button class="btn primary wide" type="button" id="bk-now">🔐 백업 켜고 복구 코드 받기</button>`}
    <div class="bk-note">🔒 기록은 이 기기에서 <b>복구 코드로 잠근 뒤</b> 보내져서, 서버(사주냥이)도 내용을 읽을 수 없어요.
      그래서 <b>코드를 잃어버리면 아무도 되살릴 수 없어요</b> — 캡처나 메모로 꼭 남겨 두세요. 마지막 백업 후 400일이 지나면 지워져요.
      <a href="/privacy.html" target="_blank">개인정보 처리방침</a></div>
    <hr class="bk-hr"><h3 style="margin:0 0 6px">📦 다른 기기의 기록 불러오기</h3>
    <div class="bk-restore"><input id="bk-in" placeholder="XXXX-XXXX-XXXX" maxlength="16" autocomplete="off" autocapitalize="characters">
      <button class="btn lav" type="button" id="bk-load">불러오기</button></div>
    <p class="sub" id="bk-msg" style="margin:8px 0 0"></p>`);
  const msg = (t) => { $("#bk-msg").textContent = t; };
  $("#bk-now")?.addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    try { await doBackup(); openBackup(); $("#bk-msg").textContent = "백업 완료! 코드를 꼭 따로 남겨 두라냥 🐾"; }
    catch (err) { msg(err.message); e.currentTarget.disabled = false; }
  });
  $("#bk-copy")?.addEventListener("click", async () => { try { await navigator.clipboard.writeText(code); msg("복사했다냥! 메모장이나 캡처로 보관해 줘"); } catch { msg(code); } });
  $("#bk-del")?.addEventListener("click", async () => {
    if (!confirm("서버의 백업을 지울까? 이 기기의 기록은 그대로 남아요.")) return;
    try { const { id } = await codeKeys(code); await fetch(`/api/backup/${id}`, { method: "DELETE" });
      localStorage.removeItem("nyang:backupCode"); localStorage.removeItem("nyang:backupAt"); openBackup(); $("#bk-msg").textContent = "서버의 백업을 지웠다냥."; }
    catch (err) { msg(err.message); }
  });
  $("#bk-load").addEventListener("click", () => restoreFlow($("#bk-in").value, msg));
}
async function restoreFlow(raw, msg) {
  const c = normCode(raw);
  if (!c) { msg("코드는 영문·숫자 12자리(XXXX-XXXX-XXXX)다냥"); return; }
  if (!confirm("불러온 기록으로 이 기기의 같은 기록을 덮어쓸까?")) return;
  msg("냥이가 기록을 꺼내는 중…");
  try { const j = await doRestore(c); msg(`불러왔다냥! (${String(j.at || "").slice(0, 10)} 백업) 잠깐 뒤 새로고침할게`); setTimeout(() => location.reload(), 900); }
  catch (err) { msg(err.message); }
}


// ───────────────────────── 아침 운세 알림(웹 푸시) — 생일 대신 일간·용신만 보낸다
const pushOk = () => !!(S.pushKey && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window);
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone;
function pushLine() {
  if (!S.pushKey) return "";
  const on = localStorage.getItem("nyang:push") === "1";
  if (!pushOk()) return isIOS() && !standalone() ? `<p class="sub push-hint">🔔 아이폰은 '홈 화면에 추가'한 뒤 열면 아침 7시 운세 알림을 받을 수 있다냥</p>` : "";
  return `<button type="button" class="push-line ${on ? "on" : ""}" data-push>${on ? "🔔 아침 7시 운세 알림 받는 중 · 끄기" : "🔔 매일 아침 7시, 오늘 운세 알림 받기"}</button>`;
}
const u8key = (b) => { const p = "=".repeat((4 - (b.length % 4)) % 4); return Uint8Array.from(atob((b + p).replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)); };
async function togglePush(btn) {
  btn.disabled = true;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (localStorage.getItem("nyang:push") === "1") {
      if (sub) { await api("/api/push/off", { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe().catch(() => {}); }
      localStorage.removeItem("nyang:push");
    } else {
      if (await Notification.requestPermission() !== "granted") { alert("알림이 꺼져 있다냥. 브라우저 설정에서 사주냥이 알림을 허용해 줘!"); return; }
      sub ||= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8key(S.pushKey) });
      const y = S.d["용신"], STEMS = "甲乙丙丁戊己庚辛壬癸";
      await api("/api/push", { sub: sub.toJSON(), ilgan: STEMS.indexOf(S.d["원국"]["일주"]["천간"]["글자"]), yong: [y["용신"], y["희신"]].filter(Boolean).slice(0, 2) });
      localStorage.setItem("nyang:push", "1");
    }
  } catch (e) { alert(e.message || "알림 설정에 실패했다냥. 잠시 후 다시 해 줘"); }
  finally { const slot = $("#checkin-slot"); if (slot) slot.innerHTML = checkinCard(); }
}
