"use strict";
/* 사주냥이 화면 스크립트 — 내 정보 관리(무엇이 어디 저장됐는지 · 모든 기록 지우기) · 의견 보내기(비공개).
   모든 기록 지우기는 실수로 누르지 않게 '곱셈·덧셈 문제'의 답을 맞혀야만 실행된다. */

function myDataSummary() {
  const n = (k, d) => store.get(k, d);
  const diary = Object.keys(n("diary", {})).length, days = Object.keys(n("days", {})).length;
  let kids = 0, partner = 0; try { kids = JSON.parse(localStorage.getItem("nyang:kids") || "[]").length; partner = localStorage.getItem("nyang:partner") ? 1 : 0; } catch { /* */ }
  const joined = Object.keys(localStorage).filter((k) => k.startsWith("nyang:joined:")).length;
  let backup = false; try { backup = !!localStorage.getItem("nyang:backupCode"); } catch { /* */ }
  return {
    phone: [["내 생일·이름", true], ["출석·기분 기록", Math.max(diary, days)], ["가족 지도", (n("fam", []) || []).length], ["내 폰 귀인 지도 친구", localFriends().length],
      ["직접 저장한 사람", n("people", []).length], ["배우자·연인 생일", !!partner], ["아이 생일", kids], ["상담 기억·약속", (n("talkmem", []) || []).length]],
    server: [["내 귀인 지도(링크로 공유)", !!mapRef(), "map"], ["다른 사람 지도에 올린 내 별", joined, "joined"],
      ["기록 백업(잠긴 상태)", backup, "backup"], ["아침·저녁 알림 구독", localStorage.getItem("nyang:push") === "1", "push"]],
  };
}

function openMyData() {
  track("mydata_open");
  const s = myDataSummary();
  const row = ([t, c]) => `<li><span>${t}</span><b>${typeof c === "boolean" ? (c ? "있음" : "없음") : c ? `${c}개` : "없음"}</b></li>`;
  openSheet(`<div class="term-head"><span data-nyang="think" data-size="60"></span><div><h2>🗂️ 내 정보 관리</h2><div class="term-mean">무엇이 어디에 저장돼 있는지 한눈에</div></div></div>
    <h3 class="pref-h">📱 이 폰에만 있는 것</h3><ul class="md-list">${s.phone.map(row).join("")}</ul>
    <h3 class="pref-h">☁️ 서버에 있는 것 <small class="sub">(내가 켠 기능만)</small></h3><ul class="md-list">${s.server.map(row).join("")}</ul>
    <p class="fine">생일은 계산할 때만 서버로 보내고 저장하지 않아요. 자세한 내용은 <a href="/privacy.html" target="_blank">개인정보 처리방침</a>.</p>
    <button class="btn lav wide" type="button" data-feedback style="margin-top:6px">💌 냥이에게 의견 보내기</button>
    <details class="md-danger"><summary>🗑️ 모든 기록 지우기…</summary>
      <p>이 폰의 사주냥이 기록과, 아래에서 고른 서버 정보를 <b>되돌릴 수 없게</b> 지운다냥. 다시 쓰려면 처음부터 가입해야 해.</p>
      ${s.server.filter((x) => x[1]).map(([t, , k]) => `<label class="check"><input type="checkbox" data-wipe="${k}" checked> 서버의 ${t}도 지우기</label>`).join("")}
      <button class="ghost wide" type="button" id="md-wipe-go" style="margin-top:8px">지우기 단계로 →</button></details>`);
  paintNyang($("#sheet-content"));
  $("#md-wipe-go").addEventListener("click", () => {
    const what = $$("[data-wipe]").filter((c) => c.checked).map((c) => c.dataset.wipe);
    wipeQuiz(what);
  });
}

/** 실수 방지: 무작위 곱셈(또는 두 자리 덧셈) 문제의 답을 넣어야 버튼이 켜진다 */
function wipeQuiz(what) {
  const mul = Math.random() < 0.6, a = mul ? 3 + Math.floor(Math.random() * 7) : 12 + Math.floor(Math.random() * 30), b = mul ? 3 + Math.floor(Math.random() * 7) : 11 + Math.floor(Math.random() * 30);
  const ans = mul ? a * b : a + b;
  openSheet(`<div class="term-head"><span data-nyang="sad" data-size="60"></span><div><h2>정말 다 지울까냥?</h2><div class="term-mean">되돌릴 수 없어요</div></div></div>
    <p>지우면 출석·기분 기록, 가족·친구 생일, 냥이 옷장, 상담 기억이 모두 사라지고${what.length ? `, 서버의 ${what.length}가지 정보도 함께 지워진다냥` : ""}.</p>
    <div class="md-quiz"><b>${a} ${mul ? "×" : "+"} ${b} = ?</b><input id="md-ans" inputmode="numeric" autocomplete="off" aria-label="답 입력" placeholder="답"></div>
    <p class="sub" style="margin:4px 0 10px">실수로 지우지 않도록 답을 맞혀야 버튼이 켜진다냥.</p>
    <button class="btn wide md-del" type="button" id="md-del" disabled>🗑️ 모두 지우기</button>
    <button class="ghost wide" type="button" data-close style="margin-top:8px">아니, 그만둘래</button>`);
  paintNyang($("#sheet-content"));
  const inp = $("#md-ans"), btn = $("#md-del");
  inp.addEventListener("input", () => { btn.disabled = +inp.value.trim() !== ans; });
  btn.addEventListener("click", async () => {
    if (+inp.value.trim() !== ans) return;
    btn.disabled = true; btn.textContent = "지우는 중…";
    await wipeAll(what);
  });
}

async function wipeAll(what) {
  track("mydata_wipe", { n: what.length });
  const tries = [];
  try {
    if (what.includes("map")) { const r = mapRef(); if (r) tries.push(fetch(`/api/map/${r.id}`, { method: "DELETE", headers: { "X-Token": r.token } })); }
    if (what.includes("joined")) {
      Object.keys(localStorage).filter((k) => k.startsWith("nyang:joined:")).forEach((k) => {
        try { const mid = k.split(":")[2], j = JSON.parse(localStorage.getItem(k)); if (j?.id) tries.push(fetch(`/api/map/${encodeURIComponent(mid)}/member/${j.id}`, { method: "DELETE", headers: { "X-Token": j.token } })); } catch { /* */ }
      });
    }
    if (what.includes("backup")) { const code = localStorage.getItem("nyang:backupCode"); if (code) { const { id } = await codeKeys(code); tries.push(fetch(`/api/backup/${id}`, { method: "DELETE" })); } }
    if (what.includes("push") && "serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration(); const sub = await reg?.pushManager?.getSubscription();
      if (sub) { tries.push(api("/api/push/off", { endpoint: sub.endpoint }).catch(() => {})); tries.push(sub.unsubscribe().catch(() => {})); }
    }
    await Promise.allSettled(tries);
  } catch { /* 서버 쪽이 실패해도 폰 기록은 지운다 */ }
  Object.keys(localStorage).filter((k) => k.startsWith("nyang:")).forEach((k) => localStorage.removeItem(k));
  try { for (const k of await caches.keys()) await caches.delete(k); } catch { /* */ }
  alert("모두 지웠다냥. 그동안 고마웠어 🐾 언제든 다시 와!");
  location.replace("/");
}

// ───────── 💌 의견 보내기(공개 게시판이 아니라 운영자만 읽는 의견함)
const FB_KIND = [["like", "😊 좋았어요"], ["bad", "😣 불편해요"], ["idea", "💡 이런 기능"], ["bug", "🐞 오류"]];
function openFeedback() {
  track("feedback_open");
  openSheet(`<div class="term-head"><span data-nyang="love" data-size="60"></span><div><h2>💌 냥이에게 의견 보내기</h2><div class="term-mean">운영자만 읽어요 · 공개되지 않아요</div></div></div>
    <div class="role-pick" id="fb-kind">${FB_KIND.map(([k, l], i) => `<button type="button" data-role="${k}" class="${i === 2 ? "on" : ""}">${l}</button>`).join("")}</div>
    <textarea id="fb-text" class="fb-text" maxlength="500" rows="5" placeholder="무엇이든 좋다냥. 이름·전화번호·생일 같은 개인정보는 적지 말아 줘!"></textarea>
    <p class="sub" style="margin:4px 0 10px"><span id="fb-n">0</span>/500 · 보낸 의견은 1년 뒤 지워져요</p>
    <button class="btn primary wide" type="button" id="fb-send">보내기</button>`);
  paintNyang($("#sheet-content"));
  const kind = pickChips($("#fb-kind")), ta = $("#fb-text");
  ta.addEventListener("input", () => { $("#fb-n").textContent = ta.value.length; });
  $("#fb-send").addEventListener("click", async (e) => {
    const t = ta.value.trim(); if (t.length < 2) { ta.focus(); return; }
    e.currentTarget.disabled = true;
    try { await api("/api/feedback", { kind: kind(), text: t, appv: APPV, where: document.querySelector(".bottom [aria-selected=true]")?.dataset.tab || "" });
      track("feedback_sent", { k: kind() });
      openSheet(`<div class="term-head"><span data-nyang="cheer" data-size="70"></span><div><h2>고맙다냥! 🐾</h2><div class="term-mean">보내 준 의견은 꼭 읽고 사주냥이를 더 좋게 만들게.</div></div></div>`);
      paintNyang($("#sheet-content"));
    } catch (err) { alert(err.message); e.currentTarget.disabled = false; }
  });
}
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-mydata]")) { openMyData(); return; }
  if (e.target.closest("[data-feedback]")) { openFeedback(); return; }
});
