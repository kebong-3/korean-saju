"use strict";
/* 사주냥이 화면 스크립트 — 가족 지도: 가족 별자리(모든 짝의 케미) · 우리 집 오행 · 찰떡 콤비/조율할 사이 · 가족 사용설명서.
   가족 생일은 이 기기에만 저장하고, 계산할 때만 /api/familymap 으로 보낸다(서버 저장 없음). */

const FAM_REL = [["spouse", "💍", "배우자"], ["child", "🧒", "자녀"], ["parent", "👵", "부모님"], ["sibling", "👫", "형제자매"], ["family", "🏠", "그 밖의 가족"]];
const famRel = (k) => FAM_REL.find((r) => r[0] === k) || ["", "👤", ""];
let famData = null, famBusy = false, famAdding = false;

/** 가족 명단 — 처음엔 이미 넣어 둔 배우자(부부 궁합)·아이(자녀 궁합)를 불러온다 */
function famList() {
  let list = store.get("fam", null);
  if (!list) {
    list = [];
    try {
      const p = JSON.parse(localStorage.getItem("nyang:partner") || "null");
      if (p && married()) list.push({ name: p.name || "배우자", rel: "spouse", birth: p });
      JSON.parse(localStorage.getItem("nyang:kids") || "[]").forEach((k, i) => list.push({ name: k.name || `아이 ${i + 1}`, rel: "child", birth: k }));
    } catch { /* 저장된 게 없으면 빈 명단 */ }
    store.set("fam", list);
  }
  return list;
}
const setFamList = (v) => { store.set("fam", v); famData = null; };

function famSvg(F) {
  const ppl = F["사람"], n = ppl.length, W = 360, H = 330, C = [180, 165], R = n <= 3 ? 95 : 120;
  const pos = ppl.map((_, i) => { const a = (-90 + (360 / n) * i) * Math.PI / 180; return [C[0] + Math.cos(a) * R, C[1] + Math.sin(a) * R]; });
  const col = (c) => (c >= 78 ? "#3fbf8f" : c >= 64 ? "#f0b93a" : "#ff8a8a");
  const dash = (c) => (c >= 78 ? "" : c >= 64 ? 'stroke-dasharray="9 5"' : 'stroke-dasharray="2.5 5"');  // 색을 구분하기 어려워도 모양으로
  const lines = F["짝"].map((p) => { const [x1, y1] = pos[p.ai], [x2, y2] = pos[p.bi];
    const adj = Math.abs(p.ai - p.bi) === 1 || Math.abs(p.ai - p.bi) === n - 1, k = adj ? 0.5 : 0.3;  // 가운데서 겹치는 대각선 숫자는 앞쪽으로
    const mx = x1 + (x2 - x1) * k, my = y1 + (y2 - y1) * k;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col(p["케미"])}" ${dash(p["케미"])} stroke-width="${1.5 + Math.max(0, p["케미"] - 50) / 12}" stroke-linecap="round" opacity=".85"/>
      ${n <= 5 ? `<rect x="${mx - 13}" y="${my - 9}" width="26" height="17" rx="8" fill="#fff" opacity=".95"/><text x="${mx}" y="${my + 4}" font-size="11" text-anchor="middle" fill="#3b2f4a">${p["케미"]}</text>` : ""}`; }).join("");
  const nodes = ppl.map((p, i) => { const [x, y] = pos[i], me = p["관계"] === "me", r = me ? 30 : 26, el = ELC[p["오행"]] || "#eee";
    return `<g class="fam-node" ${p.id ? `data-mid="${esc(p.id)}"` : ""} style="cursor:${p.id ? "pointer" : "default"}">
      <circle cx="${x}" cy="${y}" r="${r + 5}" fill="${el}" opacity=".25"/><circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${me ? "#ff8fa3" : el}" stroke-width="${me ? 4 : 3}"/>
      <text x="${x}" y="${y - 2}" font-size="16" text-anchor="middle">${me ? "⭐" : famRel(p["관계"])[1]}</text>
      <text x="${x}" y="${y + 14}" font-size="11.5" text-anchor="middle" fill="#3b2f4a">${esc([...p["이름"]].slice(0, 4).join(""))}</text></g>`; }).join("");
  const alt = `가족 별자리: ${F["짝"].map((p) => `${p.a}와 ${p.b} 케미 ${p["케미"]}`).join(", ")}`;
  return `<svg class="fam-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(alt)}" font-family="Jua, Gowun Dodum, Apple SD Gothic Neo, Malgun Gothic, sans-serif">${lines}${nodes}</svg>
    <div class="fam-leg"><span><svg width="26" height="6" aria-hidden="true"><line x1="1" y1="3" x2="25" y2="3" stroke="#3fbf8f" stroke-width="3"/></svg>찰떡(실선)</span>
      <span><svg width="26" height="6" aria-hidden="true"><line x1="1" y1="3" x2="25" y2="3" stroke="#f0b93a" stroke-width="3" stroke-dasharray="9 5"/></svg>무난(긴 점선)</span>
      <span><svg width="26" height="6" aria-hidden="true"><line x1="1" y1="3" x2="25" y2="3" stroke="#ff8a8a" stroke-width="3" stroke-dasharray="2.5 5" stroke-linecap="round"/></svg>조율(짧은 점선)</span></div>`;
}

function famBody(F) {
  const H = F["우리집"], pct = H["오행"], pairs = F["짝"], M = F["지도"];
  const top = pairs.slice(0, 2), low = pairs.length > 3 ? pairs.slice(-2).reverse() : [];
  const pairRow = (p, good) => `<div class="fam-pair ${good ? "good" : "care"}"><b>${esc(p.a)} ${good ? "💞" : "🤝"} ${esc(p.b)}</b><span class="fp-chem">${p["케미"]}</span>
    <small>${esc(good ? p["좋은"] : (p["조심"] || p["좋은"]))}</small></div>`;
  return `<div class="card fam-card"><div class="fam-head"><span class="net-emo">${H["이모지"]}</span><div><small>우리 집 별자리</small><h2>${esc(H["이름"])}</h2></div></div>
      <p class="net-desc">${esc(H["설명"])}</p>${famSvg(F)}
      <p class="sub" style="margin:4px 0 0">이름을 누르면 그 사람과 나의 사용설명서가 열린다냥.</p></div>
    <div class="card"><h2>🏠 우리 집 오행</h2>
      <div class="el-stack">${ELEM.filter((e) => pct[e]).map((e) => `<i style="flex:${pct[e]};background:${ELC[e]}"></i>`).join("")}</div>
      <div class="el-lbl">${ELEM.map((e) => `<span class="${e === H["부족"] ? "yong" : ""}">${HANJA[e]} ${e} ${pct[e]}%</span>`).join("")}</div>
      <ul class="tips plain" style="margin-top:10px"><li>🌱 ${esc(H["처방"])}</li><li>⚖️ ${esc(H["주의"])}</li></ul></div>
    ${pairs.length ? `<div class="card"><h2>💞 우리 집 찰떡 콤비</h2>${top.map((p) => pairRow(p, true)).join("")}
      ${low.length ? `<h2 style="margin-top:14px">🤝 조금 더 맞춰 갈 사이</h2>${low.map((p) => pairRow(p, false)).join("")}
        <p class="sub" style="margin:6px 0 0">케미 숫자가 낮다고 나쁜 사이가 아니다냥. 서로 다른 결이라 '사용법'을 알면 더 단단해져.</p>` : ""}</div>` : ""}
    <div class="card"><h2>📒 가족 사용설명서</h2><div class="mlist">${M["멤버"].map((m) => { const g = m["설명서"], r = famRel(m["관계"]);
      return `<button type="button" class="mrow" data-mid="${esc(m.id)}"><span class="md">${r[1]}</span><span class="mn"><b>${esc(m["이름"])}</b> <em class="rtag">${esc(r[2])}</em>
        <small class="nick">${g["캐릭터"]["이모지"]} ${esc(g["별명"])}</small><small>${esc(g["한줄"])}</small></span><span class="ms">${m["케미"]}</span></button>`; }).join("")}</div></div>`;
}

function famForm() {
  return `<div class="card fam-add"><h2>➕ 가족 추가</h2>
    <div class="field"><span>나에게 이 사람은?</span><div class="role-pick" id="fam-rel">${FAM_REL.map(([k, e, l], i) => `<button type="button" data-role="${k}" class="${i === 0 ? "on" : ""}">${e} ${l}</button>`).join("")}</div></div>
    <form id="form-fam" class="form" autocomplete="off"></form>
    <div class="rd-cta"><button class="btn primary" type="button" id="fam-save">가족 지도에 올리기</button><button class="ghost" type="button" id="fam-cancel">취소</button></div></div>`;
}

document.addEventListener("click", (e) => {
  if (!e.target.closest("[data-cfamily]")) return;
  closeSheet(); compatMode = "family"; renderCompat(); showTab("compat");
});

async function renderFamilyPane() {
  const pane = $("#tab-compat [data-cpane=family]");
  if (!pane || !S.d) return;
  const list = famList();
  pane.innerHTML = `<div class="say"><span class="who" data-nyang="happy" data-size="64"></span><div class="bubble">우리 가족을 한 화면에 모아 보자냥! 🏠 가족 생일은 <b>이 폰에만</b> 저장되고, 계산할 때만 잠깐 보낸다냥.</div></div>
    <div class="card fam-list"><div class="card-head"><h2>우리 가족 ${list.length + 1}명</h2><button class="ghost" type="button" id="fam-add-open">＋ 추가</button></div>
      <div class="fam-chips"><span class="fam-chip me">⭐ ${esc(S.d["이름"] || "나")}</span>${list.map((m, i) => `<span class="fam-chip">${famRel(m.rel)[1]} ${esc(m.name)}<button type="button" data-famdel="${i}" aria-label="${esc(m.name)} 빼기">✕</button></span>`).join("")}</div>
      ${list.length ? "" : `<p class="sub" style="margin:8px 0 0">배우자·아이·부모님을 넣으면 가족끼리 서로 어떤 사이인지 한눈에 보여 준다냥.</p>`}</div>
    ${famAdding || !list.length ? famForm() : ""}
    <div id="fam-out"></div>
    <details class="card home-more"><summary><b>👨‍👧 아이와 나, 자세히 보기</b><span class="sub">자녀 궁합 · 아이 기질 · 대화법</span></summary>${renderKidPane()}</details>`;
  bindKidPane();
  paintNyang(pane);
  $("#fam-add-open").addEventListener("click", () => { famAdding = true; renderFamilyPane(); });
  $$("[data-famdel]", pane).forEach((b) => b.addEventListener("click", () => {
    const l = famList(); const m = l[+b.dataset.famdel];
    if (m && confirm(`${m.name}을(를) 가족 지도에서 뺄까?`)) { l.splice(+b.dataset.famdel, 1); setFamList(l); renderFamilyPane(); }
  }));
  if ($("#form-fam")) {
    buildForm($("#form-fam"), "fam", "가족 생일");
    const rel = pickChips($("#fam-rel"));
    $("#fam-cancel").addEventListener("click", () => { famAdding = false; renderFamilyPane(); });
    $("#fam-save").addEventListener("click", () => {
      let b; try { b = birthOf($("#form-fam")); } catch (err) { alert(err.message); return; }
      if (!b.name) { alert("이름(별명)을 적어 달라냥 — 예) 엄마, 첫째"); return; }
      const l = famList(); if (l.length >= 8) { alert("가족 지도에는 나 말고 8명까지 올릴 수 있다냥"); return; }
      l.push({ name: b.name, rel: rel() || "family", birth: b }); setFamList(l); famAdding = false; track("family_add", { r: rel() || "family" });
      renderFamilyPane();
    });
  }
  const out = $("#fam-out");
  if (!list.length) return;
  const fk = hashStr(JSON.stringify([S.birth, list.map((m) => [m.name, m.rel, m.birth])])), fc = store.get("famcache", null);
  if (!famData && fc?.d === kstDate(0) && fc.h === fk) famData = fc.v;
  if (!famData) {
    if (famBusy) return;
    famBusy = true; loading(out);
    try { famData = await api("/api/familymap", { me: S.birth, members: list.map((m) => ({ name: m.name, rel: m.rel, birth: { ...m.birth, name: m.name } })) });
      store.set("famcache", { d: kstDate(0), h: fk, v: famData }); }
    catch (err) { out.innerHTML = `<div class="card"><p class="error">${esc(err.message)}</p></div>`; return; }
    finally { famBusy = false; }
    track("family_map", { n: list.length });
  }
  out.innerHTML = famBody(famData);
  paintNyang(out); iconize(out);
  $$("[data-mid]", out).forEach((el) => el.addEventListener("click", () => {
    const m = famData["지도"]["멤버"].find((x) => x.id === el.dataset.mid);
    if (m) openGuide(famData["지도"], m, {});
  }));
}
