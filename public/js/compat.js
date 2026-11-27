"use strict";
/* 사주냥이 화면 스크립트 — 궁합·귀인 지도·자녀 궁합.
   index.html 이 js/ 파일들을 순서대로(defer) 불러 하나의 전역 공간을 함께 쓴다. 모든 계산은 서버(/api/*)가 한다. */
// ───────────────────────── 궁합
let compatMode = "map";
function renderCompat() {
  const m = married(), kidsN = S.birth?.kids || 0;
  $("#tab-compat").innerHTML = `
    <div class="segtabs" role="tablist"><button data-cmode="map" type="button">🌌 귀인 지도</button><button data-cmode="love" type="button">${m ? "💑 부부 궁합" : "💞 연인 궁합"}</button><button data-cmode="child" type="button">👨‍👧 자녀</button></div>
    <div data-cpane="map" ${compatMode === "map" ? "" : "hidden"}></div>
    <div data-cpane="love" ${compatMode === "love" ? "" : "hidden"}>
      <div class="say"><span class="who" data-nyang="happy" data-size="64"></span><div class="bubble">${m ? "두 사람의 본성부터 마음의 안방(일지)까지, 우리 부부 사용 설명서를 펼쳐 주겠다냥 💑" : `두 사람의 ${chip("일간")}, 배우자 자리(${chip("일지")}), 서로의 ${chip("용신")}까지 정밀하게 보는 궁합이다냥 💞`}</div></div>
      <div class="pair"><form id="form-b" class="card form" autocomplete="off"></form></div>
      <button class="btn primary wide" id="btn-compat" type="button">궁합 보기</button>
      <div id="compat-out" style="margin-top:16px"></div>
    </div>
    <div data-cpane="child" ${compatMode === "child" ? "" : "hidden"}>${renderKidPane()}</div>`;
  buildForm($("#form-b"), "b", m ? "배우자 생일" : "상대방 생일");
  fillForm($("#form-b"), JSON.parse(localStorage.getItem("nyang:partner") || "null"));
  $("#btn-compat").addEventListener("click", runCompat);
  $$("#tab-compat [data-cmode]").forEach((b) => { b.setAttribute("aria-selected", b.dataset.cmode === compatMode);
    b.addEventListener("click", () => { compatMode = b.dataset.cmode; renderCompat(); }); });
  bindKidPane();
  paintNyang($("#tab-compat"));
  if (compatMode === "map") renderMapPane();
}

// ───────────────────────── 귀인 지도(관계 지도)
const KCOL = { guiin: "#ffd66b", jjak: "#7fd3b8", mine: "#a7e27a", arm: "#8ab4ff", tiger: "#ff8f8f" };
const ELC = { 목: "#6fd39a", 화: "#ff9b8a", 토: "#f6c96b", 금: "#d9dde6", 수: "#8fb0ff" };
let mapData = null, mapBusy = false;
const localFriends = () => store.get("friends", []);
const setLocalFriends = (v) => store.set("friends", v);
const mapRef = () => store.get("mapref", null);

const mapKind = (M, k) => M["종류"][Object.keys(M["종류"]).find((c) => M["종류"][c][0] === k)];
function starMap(M, opts = {}) {
  const W = 360, C = 180, order = M["순서"], members = M["멤버"];
  const by = {};
  members.forEach((m) => { (by[m["나에게"]["키"]] ||= []).push(m); });
  const rad = (chem) => 58 + (98 - Math.max(30, Math.min(98, chem))) / 68 * 62;      // 달에서 58~120
  const ang = (i, n, sec) => (-90 + sec * 72 + (n === 1 ? 0 : -26 + (52 * i) / (n - 1))) * Math.PI / 180;
  let stars = "", lines = "", marks = "";
  order.forEach((k, sec) => {
    const a = (-90 + sec * 72) * Math.PI / 180, mx = C + Math.cos(a) * 158, my = C + Math.sin(a) * 158;
    const info = mapKind(M, k), n = (by[k] || []).length, emo = M["캐릭터"]?.[k]?.["이모지"] || info[1];
    marks += `<g opacity="${n ? 1 : 0.4}"><circle cx="${mx}" cy="${my}" r="14" fill="#2a2140" stroke="${KCOL[k]}" stroke-width="1.5"/>
      <text x="${mx}" y="${my + 5}" text-anchor="middle" font-size="14">${emo}</text></g>`;
    (by[k] || []).forEach((m, i, arr) => {
      const t = ang(i, arr.length, sec), r = rad(m["케미"]) - (arr.length > 2 && i % 2 ? 9 : 0);
      const x = C + Math.cos(t) * r, y = C + Math.sin(t) * r;
      const sz = Math.max(14, 15 + (m["나에게"]["영향력"] - 40) / 60 * 7), col = ELC[m["유형"]["오행"]] || "#fff";
      const nm = [...m["이름"]].slice(0, 3).join(""), fs = nm.length <= 2 ? 12.5 : 10.5;
      lines += `<line x1="${C}" y1="${C}" x2="${x}" y2="${y}" stroke="${KCOL[k]}" stroke-opacity="${0.15 + (m["케미"] - 30) / 68 * 0.5}" stroke-width="1.5"/>`;
      const rl = relRole(M, m["관계"]);
      stars += `<g class="mstar" data-mid="${esc(m.id)}" data-g="${ROLE_GRP[m["관계"]] || ""}" style="cursor:pointer"><title>${esc(m["이름"])} · ${esc(m["설명서"]?.["별명"] || m["나에게"]["세부"])} · 케미 ${m["케미"]}</title>
        ${m["나에게"]["천을귀인"] ? `<circle cx="${x}" cy="${y}" r="${sz + 6}" fill="none" stroke="#ffd66b" stroke-dasharray="3 3" opacity=".9"/>` : ""}
        <circle cx="${x}" cy="${y}" r="${sz + 4}" fill="${col}" opacity=".18"/>
        <circle cx="${x}" cy="${y}" r="${sz}" fill="${col}" stroke="#fff" stroke-width="1.5"/>
        <text x="${x}" y="${y + fs * 0.36}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="#2a2140">${esc(nm)}</text>
        ${rl ? `<circle cx="${x + sz * 0.8}" cy="${y - sz * 0.75}" r="8" fill="#2a2140"/><text x="${x + sz * 0.8}" y="${y - sz * 0.75 + 4}" text-anchor="middle" font-size="10">${rl[1]}</text>` : ""}</g>`;
    });
  });
  const sky = Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 97) % W}" cy="${(i * 53 + 17) % W}" r="${i % 5 ? 0.8 : 1.4}" fill="#fff" opacity="${0.2 + (i % 4) * 0.12}"/>`).join("");
  return `<svg class="starmap" viewBox="0 0 ${W} ${W}" role="img" aria-label="관계 지도" font-family="Jua, Gowun Dodum, Apple SD Gothic Neo, Malgun Gothic, sans-serif">
    <defs><radialGradient id="moon" cx="40%" cy="35%"><stop offset="0" stop-color="#fff8e8"/><stop offset="1" stop-color="#f3c98b"/></radialGradient>
      <radialGradient id="nightsky" cx="50%" cy="50%"><stop offset="0" stop-color="#4a2d4f"/><stop offset="1" stop-color="#1d1733"/></radialGradient></defs>
    <rect width="${W}" height="${W}" rx="28" fill="url(#nightsky)"/>${sky}
    ${[70, 105, 140].map((r) => `<circle cx="${C}" cy="${C}" r="${r}" fill="none" stroke="#fff" stroke-opacity=".08" stroke-dasharray="2 5"/>`).join("")}
    ${lines}
    <circle cx="${C}" cy="${C}" r="44" fill="#f3c98b" opacity=".15"/><circle cx="${C}" cy="${C}" r="34" fill="url(#moon)" stroke="#fff" stroke-width="2"/>
    <text x="${C}" y="${C + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="#3b2f4a">${esc([...(M["주인"]["이름"] || "나")].slice(0, 4).join(""))}</text>
    ${marks}${stars}
    ${opts.slot ? `<g><circle cx="${C}" cy="${C + 106}" r="18" fill="#2a2140" stroke="#ffd66b" stroke-dasharray="4 3"/><text x="${C}" y="${C + 112}" text-anchor="middle" font-size="17" fill="#ffd66b">?</text>
      <text x="${C}" y="${C + 140}" text-anchor="middle" font-size="11.5" fill="#f3eefc">내 자리는?</text></g>` : ""}
    <text x="${C}" y="${W - 10}" text-anchor="middle" font-size="10" fill="#cfc4e6">달에 가까울수록 케미↑ · 별이 클수록 주는 힘↑ · 금빛 점선 = 천을귀인</text></svg>`;
}

function mapBody(M, owner = true) {
  const sm = M["요약"], ms = M["멤버"], kinds = M["순서"];
  const kindName = (k) => { const c = Object.keys(M["종류"]).find((c) => M["종류"][c][0] === k); return M["종류"][c]; };
  const groups = {};
  ms.forEach((m) => { (groups[m["올해"]["이름"]] ||= { e: m["올해"], names: [] }).names.push(m["이름"]); });
  const medal = (i) => ["🥇", "🥈", "🥉"][i] || `${i + 1}`;
  return `
    <div class="card map-card"><div class="card-head"><h2>${owner && M["인맥"] ? "냥이의 인연 수첩" : "관계 지도"} <span class="sub">· ${sm["인원"]}${M["정원"] ? `/${M["정원"]}` : ""}명${M["대기수"] ? ` · 대기 ${M["대기수"]}` : ""}</span></h2><span class="badge">${esc(sm["칭호"])}</span></div>
      <div class="map-me">${esc(M["주인"]["유형"]["이모지"])} ${esc(M["주인"]["이름"])}님 · <b>${esc(M["주인"]["유형"]["이름"])}</b> · ${M["연도"]} ${esc(M["주인"]["올해"]["이모지"])} ${esc(M["주인"]["올해"]["이름"])}</div>
      ${owner ? mfilterHtml(M) : ""}
      ${starMap(M, { slot: !owner })}
      <div class="kcount">${kinds.map((k) => { const i = kindName(k), c = M["캐릭터"]?.[k]; return `<div><i class="kdot" style="background:${KCOL[k]}"></i><b>${sm["유형수"][k]}</b><small>${c ? `${c["이모지"]}<br><b class="kname">${esc(c["이름"].replace(/ 냥$/, ""))}</b>` : i[1]}<br>${esc(i[2])}</small></div>`; }).join("")}</div></div>
    ${owner ? todayCard(M) + netCard(M) + dexCard(M) : ""}
    ${owner ? `<div class="card tint-butter"><div class="today">${ring(sm["귀인점수"], "귀인 점수", "", "#e0a92b")}
      <div><h3 style="margin:0 0 4px">나의 귀인 점수</h3><p class="sub" style="margin:0">지도에 있는 사람들이 내 용신을 채워 주는 정도, 천을귀인, 귀인 관계를 모아 계산했다냥.</p>
      ${sm["가장큰귀인"] ? `<p style="margin:6px 0 0">🌟 가장 큰 힘이 되는 사람: <b>${esc(sm["가장큰귀인"]["이름"])}</b> (${sm["가장큰귀인"]["영향력"]})</p>` : ""}
      ${sm["내가귀인"] ? `<p style="margin:2px 0 0">🤲 내가 가장 힘이 되는 사람: <b>${esc(sm["내가귀인"]["이름"])}</b> (${sm["내가귀인"]["영향력"]})</p>` : ""}</div></div>
      <p class="map-line">🐾 ${esc(sm["한줄"])}</p></div>` : `<p class="map-line card">🐾 ${esc(sm["한줄"])}</p>`}
    ${Object.keys(groups).length ? `<div class="card"><h2>${M["연도"]}년, 같은 한 해를 보내는 사람들</h2>${Object.values(groups).map((g) => `<div class="yg"><b>${esc(g.e["이모지"])} ${esc(g.e["이름"])}</b> <span class="sub">${esc(g.e["설명"])}</span><div>${g.names.map(esc).join(" · ")}</div></div>`).join("")}</div>` : ""}
    <div class="card"><h2>${owner && M["인맥"] ? "📒 사람별 사용설명서" : "케미 순위"}</h2>${owner && ms.length && M["인맥"] ? `<p class="sub" style="margin:-4px 0 10px">이름을 누르면 존중·조심·채워 주기·해 주면 좋은 것이 나온다냥</p>` : ""}
      <div class="mlist">${ms.length ? ms.map((m, i) => { const g = m["설명서"], rl = relRole(M, m["관계"]);
        return `<button type="button" class="mrow" data-mid="${esc(m.id)}" data-g="${ROLE_GRP[m["관계"]] || ""}">
      <span class="md">${medal(i)}</span><span class="mn"><b>${esc(m["이름"])}</b>${rl ? ` <em class="rtag">${rl[1]} ${esc(rl[0])}</em>` : ""}
      ${g ? `<small class="nick">${g["캐릭터"]["이모지"]} ${esc(g["별명"])}</small>` : `<small>${esc(m["유형"]["이모지"])} ${esc(m["유형"]["이름"])}</small>`}
      <small>${esc(m["나에게"]["이모지"])} ${esc(m["나에게"]["세부"])}${m["나에게"]["천을귀인"] ? " · ✨천을귀인" : ""} · ${esc(m["올해"]["이모지"])} ${esc(m["올해"]["이름"])}</small></span>
      <span class="ms">${m["케미"]}</span></button>`; }).join("") : `<p class="sub">아직 아무도 없다냥. 아래에서 친구를 초대해 봐!</p>`}</div></div>`;
}

function openMember(m, owner, onDelete, onWait, onLetter) {
  const a = m["나에게"], b = m["상대에게"];
  openSheet(`<div class="term-head"><span data-nyang="think" data-size="60"></span><div><h2>${esc(m["이름"])} · 케미 ${m["케미"]}</h2>
      <div class="term-mean">${esc(m["유형"]["이모지"])} ${esc(m["유형"]["이름"])} · ${esc(m["올해"]["이모지"])} ${esc(m["올해"]["이름"])}</div></div></div>
    <div class="grid2" style="margin-bottom:10px"><div class="fit"><small>${owner ? "이 사람이 나에게" : "이 사람이 주인에게"}</small><b>${esc(a["이모지"])} ${esc(a["세부"])}</b>
      <div class="sub">용신 채움 ${a["보완"]} · 영향력 ${a["영향력"]}</div></div>
      <div class="fit"><small>${owner ? "내가 이 사람에게" : "주인이 이 사람에게"}</small><b>${esc(b["이모지"])} ${esc(b["세부"])}</b>
      <div class="sub">용신 채움 ${b["보완"]} · 영향력 ${b["영향력"]}</div></div></div>
    ${m["냥이"] ? `<p class="m-card" style="--c:${m["냥이"]["색"]}">🃏 ${esc(m["냥이"]["일주"])} · <b>${esc(m["냥이"]["이름"])}</b></p>` : ""}
    <div class="bubble lav" style="margin-bottom:10px">🔄 ${esc(m["흐름"])}</div>
    ${m["좋은점"].length ? `<h3>👍 좋은 기운</h3><ul class="tips">${m["좋은점"].map((x) => `<li>${T(x, true)}</li>`).join("")}</ul>` : ""}
    ${m["아쉬운점"].length ? `<h3 style="margin-top:10px">🤏 조율할 점</h3><ul class="tips">${m["아쉬운점"].map((x) => `<li>${T(x, true)}</li>`).join("")}</ul>` : ""}
    <p class="fine">궁합 점수는 서로를 이해하는 참고용이다냥. 사람은 점수보다 행동으로 알아 가는 거야!</p>
    ${onLetter ? `<button class="btn primary wide" type="button" id="m-letter" style="margin-bottom:8px">📮 보약 편지 보내기</button>` : ""}
    ${onWait ? `<button class="ghost wide" type="button" id="m-wait" style="margin-bottom:8px">⏳ 대기 명단으로 내리기 (자리 비우기)</button>` : ""}
    ${onDelete ? `<button class="ghost wide" type="button" id="m-del" style="margin-bottom:8px">지도에서 지우기</button>` : ""}`);
  $("#m-wait")?.addEventListener("click", () => { closeSheet(); onWait(); });
  $("#m-letter")?.addEventListener("click", () => onLetter());
  $("#m-del")?.addEventListener("click", () => { closeSheet(); onDelete(); });
}

function bindMap(root, M, owner, onDelete, onWait, onLetter, onRole) {
  $$("[data-mid]", root).forEach((el) => el.addEventListener("click", () => {
    const m = M["멤버"].find((x) => x.id === el.dataset.mid);
    if (!m) return;
    if (owner && m["설명서"]) openGuide(M, m, { del: onDelete && (() => onDelete(m)), wait: onWait && (() => onWait(m, true)), letter: onLetter && (() => onLetter(m)), role: onRole });
    else openMember(m, owner, onDelete ? () => onDelete(m) : null, onWait ? () => onWait(m, true) : null, onLetter ? () => onLetter(m) : null);
  }));
  if (owner) { bindMFilter(root); bindVillage(root, M); }
}
function waitCard(M) {
  const ws = M["대기"] || [], full = M["멤버"].length >= (M["정원"] || 10);
  if (!ws.length && !full) return "";
  return `<div class="card" id="wait-card"><div class="card-head"><h2>⏳ 대기 명단</h2><span class="badge">${ws.length}명</span></div>
    <p class="sub" style="margin:0 0 10px">지도에는 <b>최대 ${M["정원"] || 10}명</b>까지 별로 떠요. 넘치면 여기서 기다리고, 언제든 넣고 뺄 수 있다냥.
      ${full ? "지금 지도가 꽉 찼어 — 별을 눌러 '대기 명단으로 내리기'로 자리를 비우면 올릴 수 있어." : ""}</p>
    ${ws.length ? `<div class="mlist">${ws.map((m) => `<div class="wrow"><div class="mn"><b>${esc(m["이름"])}</b>
        <small>${esc(m["나에게"]["이모지"])} ${esc(m["나에게"]["세부"])} · 케미 ${m["케미"]}</small></div>
        <div class="wbtn"><button type="button" class="ghost" data-wup="${esc(m.id)}" ${full ? "disabled" : ""}>⬆ 올리기</button>
        <button type="button" class="ghost" data-wdel="${esc(m.id)}" aria-label="${esc(m["이름"])} 지우기">✕</button></div></div>`).join("")}</div>`
    : `<p class="sub" style="margin:0">아직 기다리는 사람이 없다냥.</p>`}</div>`;
}

async function renderMapPane() {
  const pane = $("#tab-compat [data-cpane=map]");
  if (!pane || !S.d) return;
  const ref = mapRef();
  if (S.share && !ref) {
    pane.innerHTML = `<div class="say"><span class="who" data-nyang="happy" data-size="64"></span><div class="bubble">내 귀인 지도를 만들고 링크를 보내 봐! 친구가 <b>별명과 생일만</b> 넣으면 내 지도에 별로 떠오른다냥 🌌</div></div>
      <div class="card"><h2>🌌 내 귀인 지도 만들기</h2>
        <p class="sub">지도를 다시 계산하려고 <b>내 생년월일은 서버에 저장</b>돼요(지도 삭제 시 함께 삭제). 친구의 생년월일은 저장하지 않고, 계산된 관계 결과와 별명만 남아요. 내 링크로 참여한 친구가 자기 지도를 만들면 <b>내 별명도 그 친구 지도에 별로 떠요</b>(서로 보이기).</p>
        <label class="check consent"><input type="checkbox" id="map-consent"> 위 내용과 <a href="/privacy.html" target="_blank">개인정보 처리방침</a>에 동의하고 만 14세 이상이에요</label>
        <button class="btn primary wide" type="button" id="map-create">지도 만들기 ✨</button></div>`;
    $("#map-create").addEventListener("click", async (e) => {
      if (!$("#map-consent").checked) { alert("동의에 체크해 달라냥"); return; }
      e.currentTarget.disabled = true;
      let inv = ""; try { inv = localStorage.getItem("nyang:invitedBy") || ""; } catch { /* 저장 불가 */ }
      try {
        const r = await api("/api/map", { owner: S.birth, consent: true, invited_by: inv });
        store.set("mapref", { id: r.id, token: r.token });
        if (r["첫별"]) { try { localStorage.removeItem("nyang:invitedBy"); } catch { /* */ } alert(`나를 초대해 준 ${r["첫별"]}님이 내 지도의 첫 별로 올라왔다냥! 🌟`); }
        renderMapPane();
      }
      catch (err) { alert(err.message); e.currentTarget.disabled = false; }
    });
    paintNyang(pane); return;
  }
  loading(pane);
  try {
    if (S.share && ref) mapData = await api(`/api/map/${ref.id}`, null, ref.token);
    else mapData = await api("/api/mapcalc", { me: S.birth, others: localFriends() });
  } catch (err) {
    if (S.share && ref && /찾을 수 없/.test(err.message)) { store.set("mapref", null); return renderMapPane(); }
    pane.innerHTML = `<div class="card"><p class="error">${esc(err.message)}</p></div>`; return;
  }
  collectFriendCards(mapData);
  const link = S.share && ref ? `${location.origin}/m/${ref.id}` : "";
  pane.innerHTML = mapBody(mapData, true) + (S.share && ref ? questCard() + waitCard(mapData) : "") + (S.share ? `
    <div class="card tint-pink"><h2>🙋 친구에게 공유하기</h2><p>친구가 생일만 넣으면 나와 어떤 인연인지, 그 친구의 ${mapData["연도"]}년 한 줄까지 지도에 자동으로 떠요.</p>
      <div class="rd-cta"><button class="btn primary" type="button" id="map-share">📤 지도 링크 보내기</button><button class="ghost" type="button" id="map-copy">🔗 링크 복사</button></div>
      <button class="ghost wide" type="button" id="map-png" style="margin-top:8px">🖼️ 지도 이미지로 저장(단톡방용)</button>
      <p class="fine" style="margin:8px 0 0">${esc(link)}</p></div>` : `
    <div class="card tint-pink"><h2>➕ 친구 직접 넣기</h2><p class="sub">지금은 공유 저장소 연결 전이라 <b>이 폰에만 저장</b>돼요. 연결되면 링크 한 번으로 친구가 직접 올라온다냥.</p>
      <label class="field"><span>친구 별명</span><input id="fr-name" maxlength="12" placeholder="예) 단짝 지수"></label>
      <div class="field"><span>나에게 이 사람은?</span>${roleChips(mapData, "friend", "fr-role", false)}</div>
      <form id="form-fr" class="form" autocomplete="off"></form>
      <button class="btn primary wide" type="button" id="fr-add">지도에 올리기</button></div>`);
  const frRole = $("#fr-role") ? pickChips($("#fr-role")) : () => "";
  if (!S.share) { buildForm($("#form-fr"), "fr", "친구 생일"); $("#form-fr .form-title")?.remove(); { const nf = $("#form-fr [name=nm]")?.closest(".field"); if (nf) nf.hidden = true; } }
  const setWait = async (m, wait) => {
    try { await api(`/api/map/${ref.id}/member/${m.id}/wait`, { token: ref.token, wait }); renderMapPane(); }
    catch (err) { alert(err.message); }
  };
  const delMember = async (m) => {
    if (S.share && ref) { await fetch(`/api/map/${ref.id}/member/${m.id}`, { method: "DELETE", headers: { "X-Token": ref.token } }); }
    else { const fr = localFriends(); fr.splice(+m.id.replace("local", ""), 1); setLocalFriends(fr); }
    renderMapPane();
  };
  const setRole = async (m, role) => {
    if (S.share && ref) await api(`/api/map/${ref.id}/member/${m.id}/role`, { token: ref.token, role });
    else { const fr = localFriends(), i = +m.id.replace("local", ""); if (fr[i]) { fr[i].role = role; setLocalFriends(fr); } }
    closeSheet(); await renderMapPane();
    const again = mapData?.["멤버"].find((x) => x.id === m.id);
    if (again?.["설명서"]) openGuide(mapData, again, { role: setRole, del: () => delMember(again), wait: S.share && ref ? () => setWait(again, true) : null, letter: S.share && ref ? () => openLetter(again, ref) : null });
  };
  bindMap(pane, mapData, true, delMember, S.share && ref ? setWait : null, S.share && ref ? (m) => openLetter(m, ref) : null, setRole);
  if (S.share && ref) loadLetters(ref);
  $$("[data-wup]", pane).forEach((b) => b.addEventListener("click", () => setWait({ id: b.dataset.wup }, false)));
  $$("[data-wdel]", pane).forEach((b) => b.addEventListener("click", () => {
    const m = (mapData["대기"] || []).find((x) => x.id === b.dataset.wdel);
    if (m && confirm(`${m["이름"]}님을 대기 명단에서 지울까?`)) delMember(m);
  }));
  $("#map-share")?.addEventListener("click", async () => {
    const text = `${S.d["이름"] ? S.d["이름"] + "님" : "나"}의 귀인 지도에 내 자리를 찾아 줘! 생일만 넣으면 우리 사이가 나온다냥 🐾`;
    if (navigator.share) { try { await navigator.share({ title: "사주냥이 귀인 지도", text, url: link }); } catch { /* 취소 */ } }
    else { await navigator.clipboard?.writeText(`${text} ${link}`); alert("링크를 복사했다냥!"); }
  });
  $("#map-png")?.addEventListener("click", () => saveSvgPng($(".starmap", pane), `귀인지도_${S.d["이름"] || "나"}.png`));
  $("#map-copy")?.addEventListener("click", async () => { await navigator.clipboard?.writeText(link); alert("링크를 복사했다냥!"); });
  $("#fr-add")?.addEventListener("click", async () => {
    const name = $("#fr-name").value.trim();
    if (!name) { alert("친구 별명을 적어 달라냥"); return; }
    let b; try { b = birthOf($("#form-fr")); } catch (err) { alert(err.message); return; }
    if (mapBusy) return; mapBusy = true;
    const fr = localFriends(); fr.push({ name, birth: { ...b, name }, role: frRole() });
    try { await api("/api/mapcalc", { me: S.birth, others: [fr[fr.length - 1]] }); setLocalFriends(fr); renderMapPane(); }
    catch (err) { alert(err.message); } finally { mapBusy = false; }
  });
  paintNyang(pane);
}

// 링크로 들어온 친구(손님) 화면
async function guestMap(mid) {
  const box = $("#guest");
  $("#onboard").hidden = true; $("#main").hidden = true; box.hidden = false;
  loading(box);
  let M;
  try { M = await api(`/api/map/${encodeURIComponent(mid)}`); }
  catch (err) { box.innerHTML = `<div class="card"><p class="error">${esc(err.message)}</p><button class="btn primary wide" type="button" id="g-home">사주냥이 홈으로</button></div>`;
    $("#g-home").addEventListener("click", () => { location.href = "/"; }); return; }
  const owner = M["주인"]["이름"];
  box.innerHTML = `<div class="hero" style="margin-bottom:6px"><div data-nyang="happy" data-size="110"></div>
      <div class="bubble big">${esc(owner)}님의 귀인 지도에 초대받았다냥!<br><b>나는 ${esc(owner)}님에게 어떤 사람일까?</b></div></div>
    ${mapBody(M, false)}
    <div class="card" id="g-join"><h2>🙋 생일 넣고 내 자리 찾기</h2>
      <label class="field"><span>이름 또는 별명 <em>지도에 보여요 · 별명 권장</em></span><input id="g-name" maxlength="12" placeholder="예) 고양이 집사"></label>
      ${guestRoleChips(owner)}
      <form id="form-g" class="form" autocomplete="off"></form>
      <p class="sub">${esc(owner)}님의 지도에는 내 생년월일이 <b>저장되지 않고</b>, 계산된 관계 결과와 별명만 올라가요.</p>
      <label class="check consent"><input type="checkbox" id="g-consent"> 만 14세 이상이며, 별명과 관계 결과를 지도에 올리는 데 동의해요(<a href="/privacy.html" target="_blank">개인정보 처리방침</a>)</label>
      <label class="check consent mutual"><input type="checkbox" id="g-mutual" checked> <span><b>서로 연결하기</b> — ${esc(owner)}님도 <b>내 귀인 지도</b>에 별로 자동으로 올릴게요.
        <small>내 지도가 없으면 새로 만들어지고, 내 지도 계산을 위해 내 생년월일이 저장돼요(지도를 지우면 함께 삭제).</small></span></label>
      <button class="btn primary wide" type="button" id="g-go">지도에 이름 올리기 ✨</button></div>
    <div id="g-result"></div>
    <p class="foot">사주는 정답지가 아니라 지도다냥 · 언제든 내 별을 지울 수 있어요<br><a href="/privacy.html">개인정보 처리방침</a> · <a href="/terms.html">이용약관</a></p>`;
  buildForm($("#form-g"), "g", "내 생일"); $("#form-g .form-title")?.remove(); { const nf = $("#form-g [name=nm]")?.closest(".field"); if (nf) nf.hidden = true; }
  bindMap(box, M, false, null);
  const gRole = pickChips($("#g-role"));
  paintNyang(box);
  $("#g-go").addEventListener("click", async (e) => {
    const name = $("#g-name").value.trim();
    if (!name) { alert("별명을 적어 달라냥"); return; }
    if (!$("#g-consent").checked) { alert("동의에 체크해 달라냥"); return; }
    let b; try { b = birthOf($("#form-g")); } catch (err) { alert(err.message); return; }
    e.currentTarget.disabled = true;
    try {
      const bk = `nyang:mapref:${hashStr(JSON.stringify(CORE.map((k) => b?.[k])))}`;
      let myMap = null; try { myMap = JSON.parse(localStorage.getItem(bk) || "null"); } catch { myMap = null; }
      const mutual = $("#g-mutual").checked;
      const r = await api(`/api/map/${encodeURIComponent(mid)}/join`, { name, birth: { ...b, name }, consent: true, mutual, role: gRole(), my_map: mutual && myMap ? myMap : null });
      try {
        if (r.id) localStorage.setItem(`nyang:joined:${mid}`, JSON.stringify({ id: r.id, token: r.token }));
        if (r["내지도"]) localStorage.setItem(bk, JSON.stringify({ id: r["내지도"].id, token: r["내지도"].token }));
      } catch { /* 저장 불가 */ }
      const mm = r["내지도"];
      const me = r["내시선"]["나에게"], ow = r["주인시선"]["나에게"];
      $("#g-join").hidden = true;
      $("#g-result").innerHTML = `<div class="card tint-pink"><h2>🎉 ${esc(owner)}님 지도에 올라갔다냥!</h2>
        <div class="grid2"><div class="fit"><small>${esc(owner)}님에게 나는</small><b>${esc(ow["이모지"])} ${esc(ow["세부"])}</b><div class="sub">케미 ${r["주인시선"]["케미"]}</div></div>
          <div class="fit"><small>나에게 ${esc(owner)}님은</small><b>${esc(me["이모지"])} ${esc(me["세부"])}</b><div class="sub">용신 채움 ${me["보완"]}</div></div></div>
        <p style="margin:10px 0 4px">나는 <b>${esc(r["나"]["이모지"])} ${esc(r["나"]["이름"])}</b> · ${r["나의올해"]["이모지"]} ${esc(r["나의올해"]["이름"])} — ${esc(r["나의올해"]["설명"])}</p>
        <p class="sub">🔄 ${esc(r["내시선"]["흐름"])}</p>
        ${r["내설명서"] ? `<div class="gd-guest"><div class="gd-head"><span class="gd-char">${r["내설명서"]["캐릭터"]["이모지"]}</span><div><small>나에게 ${esc(owner)}님은 ${esc(r["내설명서"]["캐릭터"]["이름"])}</small>
          <h2>📒 ${esc(owner)}님 사용설명서</h2><div class="gd-nick">“${esc(r["내설명서"]["별명"])}”</div></div></div>
          <p class="sub">${esc(r["내설명서"]["한줄"])}</p>${guideHtml(r["내설명서"])}</div>` : ""}
        ${r["이미"] ? `<p class="note-box">🐾 이미 ${esc(owner)}님 지도에 올라가 있어서 한 번 더 올리진 않았다냥.</p>` : ""}
        ${r["대기"] ? `<p class="note-box">⏳ ${esc(owner)}님 지도가 꽉 차서(${10}명) <b>대기 명단</b>에 들어갔다냥. ${esc(owner)}님이 자리를 내 주면 별로 떠요.</p>` : ""}
        ${mm ? `<p class="note-box">🔗 <b>서로 연결 완료!</b> ${esc(owner)}님이 ${mm["new"] ? "새로 만든 내 귀인 지도의 첫 별로" : "내 귀인 지도에"} ${mm["주인올림"] === false ? "이미 떠 있다냥." : mm["주인대기"] ? "들어갔는데 지도가 꽉 차서 대기 명단에 있어." : "떴다냥! 🌟"}</p>` : ""}
        <button class="btn primary wide" type="button" id="g-mine">${mm ? "🗺 내 귀인 지도 보러 가기" : `🗺 내 귀인 지도도 만들기 — ${esc(owner)}님이 첫 별로 떠요`}</button>
        ${r.id ? `<button class="ghost wide" type="button" id="g-undo" style="margin-top:8px">${esc(owner)}님 지도에서 내 별 지우기</button>` : ""}</div>`;
      $("#g-mine").addEventListener("click", () => {
        try { localStorage.setItem("nyang:me", JSON.stringify({ ...b, name })); if (mm) localStorage.setItem("nyang:go", "compat:map"); else localStorage.setItem("nyang:invitedBy", mid); } catch { /* 저장 불가 */ }
        location.href = "/";
      });
      $("#g-undo")?.addEventListener("click", async () => { await fetch(`/api/map/${encodeURIComponent(mid)}/member/${r.id}`, { method: "DELETE", headers: { "X-Token": r.token } }); location.reload(); });
      $("#g-result").scrollIntoView({ behavior: "smooth" });
    } catch (err) { alert(err.message); e.currentTarget.disabled = false; }
  });
}

// ───────────────────────── 자녀 궁합
const getKids = () => JSON.parse(localStorage.getItem("nyang:kids") || "[]");
const setKids = (k) => localStorage.setItem("nyang:kids", JSON.stringify(k));
let kidSel = 0;
function renderKidPane() {
  const kids = getKids();
  return `<div class="say"><span class="who" data-nyang="wink" data-size="64"></span><div class="bubble">아이와 자꾸 부딪힌다면, 누가 틀린 게 아니라 <b>기운이 다른 것</b>일 수 있다냥. 아이의 타고난 기질과 우리 사이 사용 설명서를 펼쳐 주겠다냥 👨‍👧</div></div>
    ${kids.length ? `<div class="kid-chips">${kids.map((k, i) => `<button type="button" data-kid="${i}" class="${i === kidSel ? "on" : ""}">${k.gender === "남" ? "👦" : "👧"} ${esc(k.name || `아이 ${i + 1}`)}</button>`).join("")}
      <button type="button" data-kid="new" class="${kidSel === "new" ? "on" : ""}">＋ 추가</button></div>` : ""}
    <div class="pair"><form id="form-kid" class="card form" autocomplete="off"></form></div>
    <div class="rd-cta" style="grid-template-columns:1fr ${kids.length && kidSel !== "new" ? "auto" : ""}"><button class="btn primary" id="btn-kid" type="button">자녀 궁합 보기</button>
      ${kids.length && kidSel !== "new" ? `<button class="ghost" id="btn-kid-del" type="button">삭제</button>` : ""}</div>
    <div id="kid-out" style="margin-top:16px"></div>`;
}
function bindKidPane() {
  const f = $("#form-kid");
  if (!f) return;
  buildForm(f, "kid", "아이 생일");
  const kids = getKids();
  if (kidSel !== "new" && kids[kidSel]) fillForm(f, kids[kidSel]); else { f.year.value = 2015; }
  $$("#tab-compat [data-kid]").forEach((b) => b.addEventListener("click", () => {
    kidSel = b.dataset.kid === "new" ? "new" : +b.dataset.kid; compatMode = "child"; renderCompat();
  }));
  $("#btn-kid-del")?.addEventListener("click", () => { const k = getKids(); k.splice(kidSel, 1); setKids(k); kidSel = 0; renderCompat(); });
  $("#btn-kid").addEventListener("click", runKid);
}
async function runKid() {
  const out = $("#kid-out"), btn = $("#btn-kid"), kid = birthOf($("#form-kid"));
  const kids = getKids();
  if (kidSel === "new" || !kids.length) { kids.push(kid); kidSel = kids.length - 1; } else kids[kidSel] = kid;
  setKids(kids);
  btn.disabled = true; loading(out);
  try {
    const r = await api("/api/family", { parent: S.birth, child: kid }), F = r["이야기"] || {};
    const [pn, cn] = r.names;
    out.innerHTML = `<div class="card tint-mint"><div class="yhead"><span data-nyang="happy" data-size="80"></span><div>
        <div class="theme">${esc(pn)} 👨‍👧 ${esc(cn)}</div><div class="sub">${esc(r["자녀"]["띠"])}띠 · ${esc(r["자녀"]["일주"])}일주 · ${r["자녀"]["나이"]}세</div>
        <div class="kid-type">${esc(F["관계유형"] || "")}</div></div></div></div>
      ${punchCard(esc(F["제목"] || "우리 사이 한 줄 요약"), F["핵심"], "wink", [["📖 자세히 풀이", paras(F["서문"])], ["🐾 마무리", paras(F["맺음"])]])}
      ${oneLiners(F["한줄"], { 찰떡: "💞", 삐걱: "⚡", 비결: "🔑" })}
      ${F["장"]?.length ? `<div class="card tint-mint"><div class="card-head"><h2>👨‍👧 우리 사이 이야기 ${F["장"].length}장</h2><span class="badge">궁금한 장을 콕</span></div>
        <div class="chaps">${F["장"].map((c) => chapter(c)).join("")}</div></div>` : ""}
      <button class="btn primary wide" type="button" id="btn-kid-read" style="margin-bottom:10px">👨‍👧 냥이 도사의 자녀 궁합 대풀이 듣기</button>
      ${S.ai ? `<button class="btn lav wide" type="button" id="btn-kid-ai">💬 아이 일로 냥이에게 상담하기</button>` : ""}`;
    paintNyang(out);
    $("#btn-kid-read").addEventListener("click", () => openReading("child", { partner: kid, title: `${cn}와 나, 자녀 궁합` }));
    $("#btn-kid-ai")?.addEventListener("click", () => { S.chat = { history: [], partner: kid, role: "child", topic: null }; $("#tab-talk").innerHTML = "";
      askNyang(`우리 아이 ${cn}(${r["자녀"]["나이"]}세)와 자꾸 부딪혀. 아이 사주와 내 사주를 보고, 아이를 이해하는 법과 대화법을 알려줘`); });
    $$("#tab-compat .kid-chips button").forEach((b) => b.classList.toggle("on", b.dataset.kid === String(kidSel)));
  } catch (e) { out.innerHTML = `<div class="card"><p class="error">${esc(e.message)}</p></div>`; }
  finally { btn.disabled = false; }
}
async function runCompat() {
  const out = $("#compat-out"), btn = $("#btn-compat"), b = birthOf($("#form-b"));
  localStorage.setItem("nyang:partner", JSON.stringify(b));
  btn.disabled = true; loading(out);
  try {
    const ck = `nyang:cp:${hashStr(JSON.stringify([CORE.map((x) => S.birth?.[x]), b]))}`;
    let r = null; try { r = JSON.parse(localStorage.getItem(ck) || "null"); } catch { r = null; }
    if (!r) { r = await api("/api/compat", { a: S.birth, b }); try { localStorage.setItem(ck, JSON.stringify(r)); } catch { /* 저장 공간 부족 */ } }
    saveViewed({ key: ck, type: "compat", o: { partner: b }, title: `궁합 · ${r.names[0]} 💞 ${r.names[1]}`, icon: "💞", sub: `${r.score}점 ${r.grade}` });
    const mood = r.score >= 85 ? "love" : r.score >= 72 ? "happy" : r.score >= 58 ? "wink" : "think";
    const say = r.score >= 85 ? "와, 이건 2천 년 동안 몇 번 못 본 궁합이다냥!" : r.score >= 72 ? "서로에게 힘이 되는 좋은 궁합이다냥."
      : r.score >= 58 ? "다른 점이 있어서 오히려 배울 게 많은 궁합이다냥." : "부딪히는 곳이 있지만, 알고 맞춰 가면 충분하다냥. 궁합은 '사용 설명서'다냥!";
    const who = (t) => String(t).replace(/([12])번/g, (_, n) => r.names[n - 1]), SC = r["이야기"] || {};
    r.items.forEach((x) => { x["항목"] = who(x["항목"]); x["해석"] = who(x["해석"]); });
    out.innerHTML = `<div class="card tint-pink"><div class="yhead">${ring(r.score, r.grade)}<div>
        <div class="theme">${esc(r.names[0])} 💞 ${esc(r.names[1])}</div><div class="sub">${esc(r["띠"][0])}띠 · ${esc(r["띠"][1])}띠</div></div></div>
        <div class="say" style="margin-top:12px"><span class="who" data-nyang="${mood}" data-size="54"></span><div class="bubble">${say}</div></div>
        <p class="sub" style="margin:6px 0 0">${esc(r.names[0])}: ${T(r["1번"], true)}<br>${esc(r.names[1])}: ${T(r["2번"], true)}</p></div>
      ${SC["핵심"] ? punchCard(esc(SC["제목"] || "두 사람 한 줄 요약"), SC["핵심"], mood, [["📖 자세히 풀이", paras(SC["서문"])]]) : SC["서문"] ? storyCard(esc(SC["제목"] || "두 사람의 이야기"), SC["서문"], mood) : ""}
      ${oneLiners(SC["한줄"], { 찰떡: "💞", 삐걱: "⚡", 비결: "🔑" })}
      ${SC["장"]?.length ? `<div class="card tint-pink"><div class="card-head"><h2>💞 궁합 이야기 ${SC["장"].length}장</h2><span class="badge pink">궁금한 장을 콕</span></div>
        <div class="chaps">${SC["장"].map((c) => chapter(c)).join("")}</div></div>` : ""}
      <div class="card"><h2>항목별 궁합</h2>${r.items.map((x, i) => `<div class="citem"><b>${T(x["항목"], true)}</b>
        <span class="pt ${x["점수"] > 0 ? "pos" : x["점수"] < 0 ? "neg" : ""}">${x["점수"] > 0 ? "+" : ""}${x["점수"]}</span>
        <p class="sub" style="margin:2px 0 0">${T(x["해석"], true)}</p>${SC["항목"]?.[i]?.["한줄"] ? `<p>${esc(SC["항목"][i]["한줄"])}</p>` : ""}
        ${SC["항목"]?.[i]?.["이야기"] ? moreSet([["더 보기", `<p>${esc(SC["항목"][i]["이야기"])}</p>`]]) : ""}</div>`).join("")}
        <p class="sub">${esc(r.note)}</p></div>
      ${SC["핵심"] ? "" : storyCard("오래 가는 비결", SC["맺음"], "happy")}
      <button class="btn primary wide" type="button" id="btn-compat-read" style="margin-bottom:10px">💞 냥이 도사의 궁합 대풀이 듣기</button>
      ${S.ai ? `<button class="btn lav wide" type="button" id="btn-compat-ai">💬 냥이에게 우리 궁합 상담하기</button>` : ""}`;
    paintNyang(out);
    $("#btn-compat-read").addEventListener("click", () => openReading("compat", { partner: b }));
    $("#btn-compat-ai")?.addEventListener("click", () => { S.chat = { history: [], partner: b, topic: null }; $("#tab-talk").innerHTML = ""; askNyang("우리 둘 궁합을 잘 맞는 점, 부딪히는 점, 조언으로 풀어줘"); });
  } catch (e) { out.innerHTML = `<div class="card"><p class="error">${esc(e.message)}</p></div>`; }
  finally { btn.disabled = false; }
}
