"use strict";
/* 사주냥이 화면 스크립트 — 상담·AI 상담.
   index.html 이 js/ 파일들을 순서대로(defer) 불러 하나의 전역 공간을 함께 쓴다. 모든 계산은 서버(/api/*)가 한다. */
// ───────────────────────── 상담
const CRISIS = /(죽고\s*싶|죽어\s*버리고|죽고\s*말|죽는\s*게\s*나|죽을\s*래|자살(?!골)|자해|극단\s*적\s*(인\s*)?선택|스스로\s*목숨|목숨을\s*끊|사라지고\s*싶|사라져\s*버리|없어지고\s*싶|없어져\s*버리|살(기|고)\s*(가\s*)?싫|살고\s*싶지\s*않|그만\s*살|더\s*(는\s*)?못\s*살|살\s*이유가?\s*없|사는\s*게\s*(의미|무의미)|뛰어\s*내리|목을?\s*매|(다|삶을|인생을?)\s*끝내|세상을?\s*떠나고|suicid|kill\s*myself|want\s*to\s*die)/i;
const ROUTE = [
  [/썸|짝사랑|고백|좋아하는 사람/, "love", "some"], [/헤어|이별|전남친|전여친|재회/, "love", "breakup"],
  [/인연|언제.*(만나|생겨|연애)|솔로|소개팅/, "love", "when"], [/남친|여친|애인|연인|싸웠|권태/, "love", "dating"], [/이상형|잘 맞는 사람/, "love", "type"],
  [/상사|팀장|부장|동료|직장 사람/, "work", "boss"], [/퇴사|그만두|이직|회사 가기 싫/, "work", "quit"], [/취업|합격|면접|서류/, "work", "job"], [/적성|맞는 일|직업/, "work", "fit"],
  [/투자|주식|코인|부업/, "money", "invest"], [/돈.*(언제|운)|재물운/, "money", "when"], [/돈|저축|월급|빚|카드값/, "money", "save"],
  [/친구|서운|손절/, "people", "friend"], [/엄마|아빠|부모|가족|언니|오빠|동생|누나|형(이|한테|랑|과|이랑)/, "people", "family"], [/사람.*(지쳐|피곤)|인간관계/, "people", "tired"],
  [/시험|자격증|공부.*붙/, "study", "exam"], [/진로|전공|뭘 해야|꿈/, "study", "path"], [/집중|공부가 안/, "study", "focus"],
  [/불안|잠이|불면|우울/, "mind", "anxious"], [/지쳐|피곤|아파|번아웃|힘들어/, "mind", "tired"],
  [/언제 풀|인생.*언제/, "life", "when"], [/안 풀|되는 일이 없/, "life", "why"], [/이야기|옛날/, "life", "story"], [/위로|외로/, "life", "comfort"],
];
function chatEl() { return $("#chat"); }
function addMsg(role, html, mood = "normal") {
  const row = document.createElement("div");
  row.className = `msg ${role === "me" ? "me" : ""}`;
  row.innerHTML = role === "me" ? `<div class="bubble">${html}</div>` : `<span class="who" data-nyang="${mood}" data-size="40"></span><div class="bubble">${html}</div>`;
  chatEl().append(row); paintNyang(row);
  row.scrollIntoView({ behavior: "smooth", block: "end" });
  return row;
}
async function nyangSays(lines, mood = "normal") {
  for (const l of lines) {
    const row = addMsg("nyang", '<span class="typing"></span>', mood);
    await sleep(Math.min(1100, 350 + l.length * 9));
    $(".bubble", row).innerHTML = md(l);
  }
}
function choices(list) {
  const row = document.createElement("div");
  row.className = "worry";
  row.innerHTML = list.map(([label, fn], i) => `<button class="ghost" type="button" data-i="${i}">${esc(label)}</button>`).join("");
  row.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-i]");
    if (!b) return;
    row.remove(); list[+b.dataset.i][1](b.textContent);
  });
  chatEl().append(row);
  row.scrollIntoView({ behavior: "smooth", block: "end" });
}
const topicOf = (id) => S.d["상담"].topics.find((t) => t.id === id);
function topicMenu() {
  choices(S.d["상담"].topics.map((t) => [`${t.icon} ${t.label}`, (lbl) => openTopic(t.id, lbl)]));
}
async function openTopic(id, label) {
  const t = topicOf(id);
  if (label) addMsg("me", esc(label));
  await nyangSays([t.ask], "think");
  choices(t.options.map((o) => [o.label, () => answer(id, o.id, o.label)]));
}
async function answer(tid, oid, label) {
  const t = topicOf(tid), o = t.options.find((x) => x.id === oid);
  if (label) addMsg("me", esc(label));
  await nyangSays(o.answer, oid === "comfort" || oid === "breakup" ? "happy" : "normal");
  const rest = t.options.filter((x) => x.id !== oid).slice(0, 3).map((x) => [x.label, () => answer(tid, x.id, x.label)]);
  choices([...rest, ["🔁 다른 고민 말하기", () => { addMsg("me", "다른 고민도 있어"); nyangSays(["좋다냥, 뭐든 말해 보라냥."]).then(topicMenu); }]]);
}
function startTalk() {
  if (!S.d) return;
  const tab = $("#tab-talk");
  if (tab.dataset.ready === "1" && chatEl()) return;
  tab.dataset.ready = "1";
  tab.innerHTML = `
    <div class="card tint-lav" style="text-align:center"><span class="float" data-nyang="happy" data-size="96" style="display:inline-block"></span>
      <h2 style="margin:6px 0 2px">사주냥이 고민 상담소</h2><p class="sub" style="margin:0">2천 년 동안 인간의 사주를 봐 온 냥이가 네 사주로 답해 준다냥</p></div>
    ${S.chat.partner ? `<p class="ctx-note">${S.chat.role === "child" ? "👨‍👧 아이 사주도 함께 보고 있어요" : "💞 상대방 사주도 함께 보고 있어요"}</p>` : ""}
    <div class="chat" id="chat"></div>
    <form class="composer" id="composer"><input name="q" maxlength="300" placeholder="${S.ai ? "냥이에게 무엇이든 털어놔 봐" : "고민을 적으면 냥이가 알맞은 답을 찾아줘"}" autocomplete="off">
      <button class="btn primary" type="submit">보내기</button></form>
    <p class="fine">${S.ai ? "✨ 자유 상담은 AI 사주냥이가 네 계산 결과만 근거로 답해요 (베타)" : "지금은 고민 주제별 상담이 무료로 열려 있어요. 냥이와의 1:1 자유 대화 상담은 곧 프리미엄으로 열려요 ✨"}</p>`;
  const past = store.get("talklog", null);
  if (past?.html) $("#chat").insertAdjacentHTML("beforebegin", `<details class="past-chat"><summary>💬 지난 상담 다시 보기 <small>${esc(past.at)}</small></summary><div class="chat">${past.html}</div></details>`);
  paintNyang(tab);
  $("#composer").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = e.target.q.value.trim();
    if (q) { e.target.q.value = ""; handleFree(q); }
  });
  nyangSays([S.d["상담"].intro], "happy").then(topicMenu);
}
let talkBusy = false;
async function handleFree(q) {
  track("talk", { ai: S.ai ? 1 : 0 });
  if (!S.d || talkBusy) return;
  talkBusy = true;
  try { await handleFreeInner(q); } finally { talkBusy = false; }
}
async function handleFreeInner(q) {
  $$(".worry", chatEl()).forEach((r) => r.remove());
  if (CRISIS.test(q)) {
    addMsg("me", esc(q));
    await nyangSays(["말해 줘서 정말 고마워. 지금 많이 힘들구나… 냥이는 네가 꼭 괜찮았으면 좋겠다냥.",
      "이건 사주보다 사람의 도움이 먼저 필요한 순간이다냥. 지금 바로 **자살예방상담전화 109**(24시간)나 **정신건강위기상담 1577-0199**에 전화해 줄래? 위급하면 **119**.",
      "혼자 버티지 않아도 된다냥. 냥이도 여기 있을게. 🐾"], "think");
    return;
  }
  if (S.ai) return aiSend(q);
  addMsg("me", esc(q));
  const hit = ROUTE.find(([re]) => re.test(q));
  if (hit) { await nyangSays(["냥이가 찰떡같이 알아들었다냥. 네 사주로 보면 말이지…"], "wink"); return answer(hit[1], hit[2]); }
  await nyangSays(["음… 냥이가 정확히 알아듣지 못했다냥. 어떤 쪽 고민인지 골라 줄래?"], "think");
  topicMenu();
}
/** 다른 탭에서 "냥이에게 묻기" */
function askNyang(q) {
  if (!$("#reader").hidden) closeReader();
  showTab("talk");
  if (S.ai) setTimeout(() => handleFree(q), 300);
}

// ───────────────────────── AI 상담(키가 있을 때만)
let aiBusy = false;
async function aiSend(q) {
  if (aiBusy) return;
  aiBusy = true;
  addMsg("me", esc(q));
  S.chat.history.push({ role: "user", content: q });
  const row = addMsg("nyang", '<span class="typing"></span>', "think"), box = $(".bubble", row);
  let text = "", err = "";
  try {
    const r = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birth: S.birth, partner: S.chat.partner, partner_role: S.chat.role || "love", messages: S.chat.history.slice(-28), memo: talkMemo() }) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "냥이가 잠깐 자리를 비웠다냥");
    const reader = r.body.getReader(), dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let k;
      while ((k = buf.indexOf("\n\n")) >= 0) {
        const line = buf.slice(0, k); buf = buf.slice(k + 2);
        if (!line.startsWith("data: ")) continue;
        const ev = JSON.parse(line.slice(6));
        if (ev.t) { text += ev.t; box.innerHTML = md(text, true); }
        if (ev.error) err = ev.error;
      }
    }
  } catch (e) { err = e.message; }
  if (text) S.chat.history.push({ role: "assistant", content: text }); else S.chat.history.pop();
  if (text) {
    rememberTalk(q);
    if (!S.chat.promised && store.get("promise", null)?.d !== kstDate(0)) { row.insertAdjacentHTML("afterend", promiseBox()); S.chat.promised = 1; }
  }
  if (err && !text) {
    box.innerHTML = `냥이가 잠깐 낮잠에 빠졌다냥… 😴 <span class="sub">(${esc(err)})</span><br>대신 고민 주제를 고르면 네 사주로 바로 답해 줄게!`;
    topicMenu();
  } else if (err) box.insertAdjacentHTML("beforeend", `<p class="error">${esc(err)}</p>`);
  aiBusy = false;
}
