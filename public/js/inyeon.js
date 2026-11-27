"use strict";
/* 사주냥이 화면 스크립트 — 냥이의 인연 수첩(귀인 지도의 실제 관계·사용설명서·인맥 별자리).
   index.html 이 js/ 파일들을 순서대로(defer) 불러 하나의 전역 공간을 함께 쓴다. 모든 계산은 서버(sajunyang/inyeon.py)가 한다. */

const ROLE_GRP = { coworker: "work", boss: "work", junior: "work", friend: "friend", family: "family", love: "love" };
const MFILTER = [["", "전체"], ["work", "💼 직장"], ["friend", "🧋 친구"], ["family", "🏠 가족"], ["love", "💗 연인"]];
const ROLE_FALLBACK = { friend: ["친구", "🧋"], coworker: ["동료", "💼"], boss: ["상사·선배", "👔"], junior: ["후배·팀원", "🐥"], family: ["가족", "🏠"], love: ["연인·썸", "💗"] };
const relRole = (M, k) => (k && (M?.["관계종류"]?.[k] ? [M["관계종류"][k]["이름"], M["관계종류"][k]["이모지"]] : ROLE_FALLBACK[k])) || null;

/** 부를 때: '지수님' — 이미 '님'으로 끝나거나 가족(엄마·언니…)이면 그대로 */
const callName = (m) => (/님$/.test(m["이름"]) || m["관계"] === "family" ? m["이름"] : `${m["이름"]}님`);
/** 받침 있으면 a(은·이·과), 없으면 b(는·가·와) */
function josa(w, a, b) { const c = (w || "").charCodeAt(w.length - 1); return w + (c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? a : b); }

/** 이 사람은 나의 … (주인이 고르는 칩) */
function roleChips(M, cur, id = "role-pick", clear = true) {
  return `<div class="role-pick" id="${id}">${Object.keys(ROLE_FALLBACK).map((k) => {
    const [n, e] = relRole(M, k);
    return `<button type="button" data-role="${k}" class="${cur === k ? "on" : ""}">${e} ${esc(n)}</button>`;
  }).join("")}${cur && clear ? `<button type="button" data-role="" class="ghost-chip">지우기</button>` : ""}</div>`;
}

/** 사용설명서 네 칸 + 말투 + 관계 팁 */
function guideHtml(g) {
  if (!g) return "";
  return `<div class="gd-grid">
      <div class="gd r"><small>🫶 존중하기</small>${esc(g["존중"])}</div>
      <div class="gd c"><small>⚠️ 조심하기</small>${esc(g["조심"])}</div>
      <div class="gd f"><small>🧩 서로 채워 주기</small>${esc(g["보완"])}</div>
      <div class="gd g"><small>🎁 해 주면 좋은 것</small>${esc(g["선물"])}</div></div>
    ${g["말투"] ? `<p class="gd-line">💬 <b>이 사람에게 통하는 말투</b><br>${esc(g["말투"])}</p>` : ""}
    ${g["관계"] && g["관계팁"] ? `<p class="gd-line">${g["관계"]["이모지"]} <b>${esc(g["관계"]["이름"])} 사이 꿀팁</b><br>${esc(g["관계팁"])}</p>` : ""}`;
}

/** 주고받는 힘 막대 */
function giveTakeHtml(g, them = "이 사람") {
  const t = g?.["주고받기"];
  if (!t) return "";
  const say = t["나는"] === "받는 쪽" ? `${them}에게 받는 힘이 더 크다냥. 고마움을 자주 표현해 줘.`
    : t["나는"] === "주는 쪽" ? `내가 ${them}에게 주는 힘이 더 크다냥. 나도 기대도 되는 사이인지 살펴봐.` : "서로 비슷하게 주고받는 사이다냥.";
  return `<div class="gt"><div><span>${esc(them)} → 나</span><i style="--w:${t["받는힘"]}%"></i><b>${t["받는힘"]}</b></div>
    <div><span>나 → ${esc(them)}</span><i class="give" style="--w:${t["주는힘"]}%"></i><b>${t["주는힘"]}</b></div><p>${esc(say)}</p></div>`;
}

/** 내 인맥 별자리(전체 풀이) */
function netCard(M) {
  const N = M["인맥"];
  if (!N || !M["멤버"].length) return "";
  const t = N["별자리"], els = N["오행수"], yong = M["주인"]["용신"];
  const tot = Object.values(els).reduce((a, b) => a + b, 0) || 1;
  return `<div class="card net-card"><div class="net-type"><span class="net-emo">${t["이모지"]}</span><div><small>냥이가 본 내 인맥</small><h2>${esc(t["이름"])}</h2></div></div>
    <p class="net-desc">${esc(t["설명"])}</p>
    ${N["주고받기"] ? `<div class="net-bal"><b>${esc(N["주고받기"]["유형"])}</b><span>${esc(N["주고받기"]["말"])}</span></div>` : ""}
    <div class="el-stack">${ELEM.filter((e) => els[e]).map((e) => `<i style="flex:${els[e]};background:${ELC[e]}"></i>`).join("")}</div>
    <div class="el-lbl">${ELEM.map((e) => `<span class="${e === yong ? "yong" : ""}">${HANJA[e]} ${e} ${els[e]}</span>`).join("")}</div>
    <p class="sub" style="margin:2px 0 10px">지도 속 사람들의 타고난 기운(일간 오행) · 밑줄 = 내 보약 ${yong}</p>
    ${N["조언"].length ? `<ul class="tips plain">${N["조언"].map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    ${N["직장"] ? `<div class="net-work"><b>💼 직장 별자리 · ${N["직장"]["인원"]}명</b><span>${esc(N["직장"]["말"])}</span></div>` : ""}
    ${N["관계미정"] ? `<p class="note-box">🐾 별 ${N["관계미정"]}개는 아직 <b>어떤 사이</b>인지 몰라. 별을 눌러 친구·동료·상사…를 정해 주면 냥이가 딱 맞는 사용설명서를 써 준다냥.</p>` : ""}</div>`;
}

/** 직장·친구·가족·연인만 골라 보기 */
function mfilterHtml(M) {
  const has = new Set(M["멤버"].map((m) => ROLE_GRP[m["관계"]]).filter(Boolean));
  if (!has.size) return "";
  return `<div class="mfilter" role="tablist">${MFILTER.filter(([k]) => !k || has.has(k)).map(([k, l]) => `<button type="button" data-mf="${k}" class="${k ? "" : "on"}">${l}</button>`).join("")}</div>`;
}
function bindMFilter(root) {
  $$("[data-mf]", root).forEach((b) => b.addEventListener("click", () => {
    const f = b.dataset.mf;
    $$("[data-mf]", root).forEach((x) => x.classList.toggle("on", x === b));
    $$(".mstar, .mrow", root).forEach((el) => el.classList.toggle("dim", !!f && el.dataset.g !== f));
    track("map_filter", { f: f || "all" });
  }));
}

/** 지도 속 한 사람 — 사용설명서 시트(주인 전용) */
function openGuide(M, m, h) {
  const g = m["설명서"], a = m["나에게"], b = m["상대에게"], ch = g["캐릭터"];
  const role = relRole(M, m["관계"]), nm = esc(m["이름"]), who = esc(callName(m));
  openSheet(`<div class="gd-head"><span class="gd-char">${ch["이모지"]}</span><div><small>${esc(ch["이름"])} · 케미 ${m["케미"]}</small>
      <h2>${nm}${role ? ` <em>${role[1]} ${esc(role[0])}</em>` : ""}</h2><div class="gd-nick">“${esc(g["별명"])}”</div></div></div>
    <div class="say"><span class="who" data-nyang="wink" data-size="48"></span><div class="bubble">${esc(ch["소개"])}<br><b>${esc(g["한줄"])}</b></div></div>
    <h3 class="gd-q">${esc(josa(callName(m), "은", "는"))} 나의…</h3>${roleChips(M, m["관계"])}
    <h3 class="gd-q">📒 ${nm} 사용설명서</h3>${guideHtml(g)}
    ${giveTakeHtml(g, m["이름"])}
    ${moreSet([["🔎 사주로 본 근거", `<div class="grid2" style="margin-bottom:10px"><div class="fit"><small>이 사람이 나에게</small><b>${esc(a["이모지"])} ${esc(a["세부"])}</b>
        <div class="sub">용신 채움 ${a["보완"]} · 영향력 ${a["영향력"]}</div></div><div class="fit"><small>내가 이 사람에게</small><b>${esc(b["이모지"])} ${esc(b["세부"])}</b>
        <div class="sub">용신 채움 ${b["보완"]} · 영향력 ${b["영향력"]}</div></div></div>
      <p class="sub">${esc(m["유형"]["이모지"])} ${esc(m["유형"]["이름"])} · ${esc(m["올해"]["이모지"])} ${esc(m["올해"]["이름"])}</p>
      ${m["좋은점"].length ? `<h3>👍 좋은 기운</h3><ul class="tips">${m["좋은점"].map((x) => `<li>${T(x, true)}</li>`).join("")}</ul>` : ""}
      ${m["아쉬운점"].length ? `<h3 style="margin-top:10px">🤏 조율할 점</h3><ul class="tips">${m["아쉬운점"].map((x) => `<li>${T(x, true)}</li>`).join("")}</ul>` : ""}`]])}
    <button class="btn lav wide" type="button" id="gd-ask" style="margin:12px 0 8px">💬 ${who} 일로 냥이에게 묻기 <small>(구슬 1알)</small></button>
    ${h.letter ? `<button class="btn primary wide" type="button" id="m-letter" style="margin-bottom:8px">📮 보약 편지 보내기</button>` : ""}
    ${h.wait ? `<button class="ghost wide" type="button" id="m-wait" style="margin-bottom:8px">⏳ 대기 명단으로 내리기 (자리 비우기)</button>` : ""}
    ${h.del ? `<button class="ghost wide" type="button" id="m-del" style="margin-bottom:8px">지도에서 지우기</button>` : ""}
    <p class="fine">사용설명서는 서로를 이해하는 참고용이다냥. 사람은 점수보다 행동으로 알아 가는 거야!</p>`);
  track("guide_open", { k: a["키"], r: m["관계"] || "none" });
  $$("#role-pick [data-role]").forEach((btn) => btn.addEventListener("click", async () => {
    if (!h.role) return;
    btn.disabled = true;
    try { await h.role(m, btn.dataset.role); track("role_set", { r: btn.dataset.role || "none" }); } catch (err) { alert(err.message); btn.disabled = false; }
  }));
  $("#gd-ask").addEventListener("click", () => {
    closeSheet();
    const r = role ? `내 ${role[0]}인 ` : "";
    askNyang(`${r}${josa(callName(m), "과", "와")}의 관계가 궁금해. 귀인 지도에서 이 사람은 나에게 '${a["세부"]}'(${a["유형"]}) 관계이고 케미는 ${m["케미"]}점이래. 이 사람을 대할 때 조심할 점과 잘 지내는 법을 알려줘.`);
  });
  $("#m-wait")?.addEventListener("click", () => { closeSheet(); h.wait(); });
  $("#m-letter")?.addEventListener("click", () => h.letter());
  $("#m-del")?.addEventListener("click", () => { closeSheet(); h.del(); });
}

/** 손님(링크로 들어온 친구)이 고르는 '나는 주인에게 어떤 사이' */
function guestRoleChips(owner) {
  const o = esc(owner);
  return `<div class="field"><span>${o}님과 나는 어떤 사이? <em>${o}님 지도에만 보여요</em></span><div class="role-pick" id="g-role">
    ${[["friend", "🧋 친구"], ["coworker", "💼 직장 동료"], ["boss", `👔 내가 ${o}님의 상사·선배`], ["junior", `🐥 내가 ${o}님의 후배·팀원`],
      ["family", "🏠 가족"], ["love", "💗 연인·썸"], ["", "🤫 비밀"]].map(([k, l]) => `<button type="button" data-role="${k}" class="${k === "friend" ? "on" : ""}">${l}</button>`).join("")}</div></div>`;
}
function pickChips(root) {
  $$("[data-role]", root).forEach((b) => b.addEventListener("click", () => $$("[data-role]", root).forEach((x) => x.classList.toggle("on", x === b))));
  return () => $("[data-role].on", root)?.dataset.role ?? "";
}
