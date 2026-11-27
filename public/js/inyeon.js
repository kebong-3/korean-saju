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
  const lg = g["전설"], mo = g["달"], lore = M["마을"]?.["설정"]?.[a["키"]];
  openSheet(`<div class="gd-head"><span class="gd-char ${lg ? "legend" : ""}">${ch["이모지"]}</span><div><small>${esc(josa(ch["이름"], "이", "가"))} 지키는 별 · 케미 ${m["케미"]}</small>
      <h2>${nm}${role ? ` <em>${role[1]} ${esc(role[0])}</em>` : ""}</h2><div class="gd-nick">“${esc(g["별명"])}”</div></div></div>
    ${mo ? `<div class="moon-tag">${mo["이모지"]} <b>${esc(mo["이름"])}</b> · ${esc(mo["설명"])}</div>` : ""}
    ${lg ? `<div class="legend-box"><b>🔔 전설의 ${esc(lg["이름"])}이 나타났다!</b><span>${esc(lg["소개"])}</span><em>“${esc(lg["말버릇"])}”</em></div>` : ""}
    <div class="say"><span class="who" data-nyang="wink" data-size="48"></span><div class="bubble">${esc(ch["소개"])}<br><b>${esc(g["한줄"])}</b></div></div>
    ${g["목소리"] ? `<div class="char-say"><i>${ch["이모지"]}</i><div><small>${esc(ch["이름"])}의 한마디${lore ? ` · ${esc(lore["사는곳"])}에서` : ""}</small>${esc(g["목소리"])}</div></div>` : ""}
    <button class="btn primary wide" type="button" id="gd-story" style="margin:4px 0 6px">📸 ${nm} 사용설명서 스토리 카드 만들기</button>
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
  $("#gd-story").addEventListener("click", () => openGuideStory(M, m));
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

// ───────── 묘연(猫緣) 마을: 오늘의 인연 · 인연 도감 · 마을 이야기
const KIND_ORDER5 = ["guiin", "jjak", "mine", "arm", "tiger"];
function todayCard(M) {
  const t = M["오늘인연"];
  if (!t) return "";
  return `<div class="card today-yeon"><div class="ty-head"><span class="ty-bell">🔔</span><div><small>오늘의 인연 · ${esc(t["오늘기운"])}의 날</small>
      <h2>오늘은 <b>${esc(t["이름"])}</b>에게 연락해 봐</h2></div></div>
    <p class="sub" style="margin:6px 0 10px">${esc(t["이유"])}</p>
    <div class="ty-msg"><small>${esc(josa(t["캐릭터"], "이", "가"))} 골라 준 한 줄</small><p id="ty-text">${esc(t["한마디"])}</p></div>
    <div class="rd-cta" style="margin-top:10px"><button class="btn primary" type="button" id="ty-copy">📋 이 말 복사하기</button>
      ${t.id ? `<button class="ghost" type="button" data-mid="${esc(t.id)}">📒 사용설명서</button>` : ""}</div></div>`;
}
function dexCard(M) {
  const D = M["인맥"]?.["도감"], C = M["캐릭터"] || {};
  if (!D) return "";
  return `<div class="card dex-card"><div class="card-head"><h2>🏘 묘연 마을 인연 도감</h2><span class="badge">${D["수"]}/${D["전체"]}</span></div>
    <div class="dex-row">${KIND_ORDER5.map((k) => { const on = D["만남"].includes(k), c = C[k] || {};
      return `<div class="dex ${on ? "on" : ""}"><i>${on ? c["이모지"] : "?"}</i><small>${on ? esc(c["이름"]) : "아직"}</small></div>`; }).join("")}
      <div class="dex legend ${D["전설"].length ? "on" : ""}"><i>${D["전설"].length ? "🔔" : "?"}</i><small>${D["전설"].length ? "전설!" : "전설"}</small></div></div>
    <p style="margin:10px 0 4px"><b>${esc(D["칭호"])}</b></p><p class="sub" style="margin:0">${esc(D["말"])}</p>
    <button class="ghost wide" type="button" id="village-open" style="margin-top:10px">📜 묘연 마을 이야기 · 냥이들 만나 보기</button></div>`;
}
function openVillage(M) {
  const V = M["마을"], C = M["캐릭터"] || {}, D = M["인맥"]?.["도감"] || { 만남: [], 전설: [] };
  if (!V) return;
  track("village");
  const L = V["전설"];
  openSheet(`<div class="term-head"><span data-nyang="proud" data-size="60"></span><div><h2>📜 묘연(猫緣) 마을</h2><div class="term-mean">고양이로 맺어진 인연들이 사는 마을</div></div></div>
    <p>${esc(V["소개"])}</p>
    <div class="vil-list">${KIND_ORDER5.map((k) => { const c = C[k] || {}, l = V["설정"][k], met = D["만남"].includes(k);
      return `<div class="vil ${met ? "" : "locked"}"><div class="vil-top"><i>${c["이모지"]}</i><div><b>${esc(c["이름"])}</b><small>${esc(l["사는곳"])}${met ? "" : " · 아직 못 만났다냥"}</small></div></div>
        <p class="vil-say">“${esc(l["말버릇"])}”</p>
        <ul><li><b>특기</b> ${esc(l["특기"])}</li><li><b>좋아하는 것</b> ${esc(l["좋아하는것"])}</li><li><b>약점</b> ${esc(l["약점"])}</li></ul>
        <p class="sub">${esc(c["소개"])}</p></div>`; }).join("")}
      <div class="vil legend ${D["전설"].length ? "" : "locked"}"><div class="vil-top"><i>${L["이모지"]}</i><div><b>${esc(L["이름"])} <em>${esc(L["등급"])}</em></b>
        <small>${D["전설"].length ? `${D["전설"].map(esc).join(", ")}님 곁에 나타났다냥!` : "천을귀인이면서 케미 85 이상인 별에게만 나타난다냥"}</small></div></div>
        <p class="vil-say">“${esc(L["말버릇"])}”</p><p class="sub">${esc(L["소개"])}</p></div></div>
    <p class="fine">캐릭터는 일간 오행의 생극(귀인·단짝·내 사람·오른팔·호랑이 선생)을 이야기로 옮긴 거다냥.</p>`);
}
function bindVillage(root, M) {
  $("#village-open", root)?.addEventListener("click", () => openVillage(M));
  $("#ty-copy", root)?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("#ty-text").textContent); toast("복사했다냥! 카톡에 붙여 넣어 봐 🐾"); } catch { alert($("#ty-text").textContent); }
    track("today_yeon_copy");
  });
}

// ───────── 사용설명서 스토리 카드(9:16)
const CARD_TONE = { guiin: ["#fff7e3", "#ffe1a8", "#b86e08"], jjak: ["#eafaf3", "#c4eedd", "#1f7f61"], mine: ["#fff1ea", "#ffd6c2", "#b8482a"],
  arm: ["#edf3ff", "#cddcff", "#3552b0"], tiger: ["#fff0e3", "#ffc9a3", "#b23c0a"] };
const HIDE_AS = { boss: "우리 상사", junior: "우리 후배", coworker: "우리 동료", friend: "내 친구", family: "우리 가족", love: "그 사람" };
function guideStorySvg(M, m, hide = false) {
  const g = m["설명서"], k = m["나에게"]["키"], [c1, c2, ac] = CARD_TONE[k], ch = g["캐릭터"], cd = g["카드"], lg = g["전설"];
  const W = 360, H = 640, name = hide ? (HIDE_AS[m["관계"]] || "비밀의 그 사람") : m["이름"];
  const title = `${name} 사용설명서`, fs = Math.min(26, Math.floor(300 / Math.max(6, [...title].length)));
  const L = (arr, x, y, size, color, lh = 1.45, anchor = "middle") => arr.map((t, i) => `<text x="${x}" y="${y + i * size * lh}" font-size="${size}" fill="${color}" text-anchor="${anchor}">${esc(t)}</text>`).join("");
  const box = (x, y, label, col, text) => `<rect x="${x}" y="${y}" width="150" height="112" rx="18" fill="#fff" opacity=".92"/>
    <text x="${x + 14}" y="${y + 26}" font-size="13.5" fill="${col}">${label}</text>${L(wrapText(text, 10).slice(0, 3), x + 14, y + 52, 14, "#3b2f4a", 1.4, "start")}`;
  const voice = wrapText(`${ch["이모지"]} “${g["목소리"]}”`, 24).slice(0, 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" font-family="Jua, Gowun Dodum, Apple SD Gothic Neo, Malgun Gothic, sans-serif">
    <defs><linearGradient id="gs-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#gs-bg)"/>
    ${[[30, 40], [330, 70], [300, 150], [50, 170], [22, 300], [338, 320]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="#fff" opacity=".9"/>`).join("")}
    <text x="180" y="44" font-size="12.5" fill="${ac}" text-anchor="middle" opacity=".8">묘연 마을 인연 수첩</text>
    <text x="180" y="80" font-size="${fs}" fill="#3b2f4a" text-anchor="middle">📒 ${esc(title)}</text>
    <text x="180" y="106" font-size="13" fill="${ac}" text-anchor="middle">${esc(g["달"]["이모지"])} ${esc(g["달"]["이름"])} · 케미 ${m["케미"]}</text>
    ${lg ? `<circle cx="180" cy="172" r="55" fill="none" stroke="#e0a92b" stroke-width="3" stroke-dasharray="5 5"/>` : ""}
    <circle cx="180" cy="172" r="46" fill="#fff"/><text x="180" y="190" font-size="50" text-anchor="middle">${ch["이모지"]}</text>
    ${lg ? `<rect x="112" y="214" width="136" height="24" rx="12" fill="#e0a92b"/><text x="180" y="231" font-size="12.5" fill="#fff" text-anchor="middle">🔔 전설의 황금방울 냥</text>` : ""}
    <text x="180" y="${lg ? 258 : 246}" font-size="13" fill="#6b6080" text-anchor="middle">${esc(josa(ch["이름"], "이", "가"))} 지키는 별</text>
    <text x="180" y="${lg ? 284 : 276}" font-size="21" fill="${ac}" text-anchor="middle">“${esc(g["별명"])}”</text>
    ${L(wrapText(g["한줄"], 24).slice(0, 2), 180, lg ? 306 : 300, 12.5, "#6b6080", 1.4)}
    ${box(24, 338, "🫶 존중하기", "#c2385a", cd["존중"])}${box(186, 338, "⚠️ 조심하기", "#b8740b", cd["조심"])}
    ${box(24, 458, "🧩 채워 주기", "#2a8c6a", cd["보완"])}${box(186, 458, "🎁 해 주면 좋은 것", "#7c5cf0", cd["선물"])}
    ${L(voice, 180, 590, 12.5, "#3b2f4a", 1.35)}
    <text x="180" y="${H - 14}" font-size="11.5" fill="#6b6080" text-anchor="middle">사주냥이 · 너는 누구의 무슨 냥이야?</text></svg>`;
}
function openGuideStory(M, m) {
  track("story", { k: "guide" });
  let hide = false;
  const draw = () => { $("#story-box").innerHTML = guideStorySvg(M, m, hide); };
  openSheet(`<h2 style="margin:0 0 10px">📸 사용설명서 스토리 카드</h2><div id="story-box" class="story-box"></div>
    <label class="check" style="margin:10px 0 0"><input type="checkbox" id="story-hide"> 🙈 이름 가리기 (예: '우리 상사 사용설명서')</label>
    <div class="rd-cta" style="margin-top:10px"><button class="btn primary" type="button" id="story-share">📤 공유하기</button>
      <button class="btn lav" type="button" id="story-save">🖼️ 이미지 저장</button></div>
    <p class="sub" style="text-align:center;margin:8px 0 0">상사·동료 카드는 이름을 가리고 올리면 안전하다냥 🐾</p>`);
  draw();
  $("#story-hide").addEventListener("change", (e) => { hide = e.target.checked; draw(); });
  const svg = () => $("#story-box svg"), fn = () => `사주냥이_사용설명서_${hide ? "비밀" : m["이름"]}.png`;
  const text = () => `${hide ? (HIDE_AS[m["관계"]] || "그 사람") : m["이름"]} 사용설명서 📒 나에게 '${m["설명서"]["별명"]}'래 🐾 너는 누구의 무슨 냥이야?`;
  $("#story-share").addEventListener("click", () => { track("story_share", { k: "guide" }); shareImage(svg(), fn(), text()); });
  $("#story-save").addEventListener("click", () => { track("story_save", { k: "guide" }); saveSvgPng(svg(), fn()); });
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
