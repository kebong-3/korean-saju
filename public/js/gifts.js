"use strict";
/* 사주냥이 화면 스크립트 — 냥이의 선물: 행운 부적 · 우리 둘 좋은 날 · 기분 × 기운 리포트 · 생일 냥이.
   사람 생일은 이미 이 폰에 넣어 둔 것(가족·내 폰 지도 친구·배우자·아이)만 쓰고, 계산할 때만 서버로 보낸다(저장 없음). */

/** 이 폰에 생일이 저장된 사람들(중복 없이) */
function phonePeople() {
  const out = [], seen = new Set();
  const add = (name, birth, rel) => {
    if (!birth?.year) return;
    const nm = (name || "").trim() || "이름 없음", k = `${nm}|${birth.year}-${birth.month}-${birth.day}`;
    if (seen.has(k)) return; seen.add(k);
    out.push({ name: nm, birth: { ...birth, name: nm }, rel });
  };
  try { famList().forEach((m) => add(m.name, m.birth, m.rel)); } catch { /* */ }
  try { const p = JSON.parse(localStorage.getItem("nyang:partner") || "null"); if (p) add(p.name || (married() ? "배우자" : "그 사람"), p, married() ? "spouse" : "love"); } catch { /* */ }
  try { JSON.parse(localStorage.getItem("nyang:kids") || "[]").forEach((k, i) => add(k.name || `아이 ${i + 1}`, k, "child")); } catch { /* */ }
  try { localFriends().forEach((f) => add(f.name, f.birth, f.role || "friend")); } catch { /* */ }
  store.get("people", []).forEach((p) => add(p.name, p.birth, "saved"));
  return out;
}
/** '직접 입력'한 사람을 이 폰에 저장(다음에 고르기만 하면 되게) — 서버에는 저장하지 않는다 */
function savePerson(name, birth) {
  const l = store.get("people", []);
  if (l.some((p) => p.name === name && p.birth.year === birth.year && p.birth.month === birth.month && p.birth.day === birth.day)) return;
  l.push({ name, birth: { ...birth, name } }); store.set("people", l.slice(-20));
}
const PERSON_IC = { spouse: "💍", child: "🧒", parent: "👵", sibling: "👫", family: "🏠", love: "💗", friend: "🧋", coworker: "💼", boss: "👔", junior: "🐥" };

/** 사람 고르기: 나 / 저장된 사람 / 직접 입력 */
function personPicker(id, withMe = true) {
  const ppl = phonePeople();
  const first = withMe ? "me" : ppl.length ? "0" : "new";
  return {
    html: `<div class="role-pick" id="${id}">${withMe ? `<button type="button" data-pi="me" class="${first === "me" ? "on" : ""}">⭐ 나</button>` : ""}
      ${ppl.map((p, i) => `<button type="button" data-pi="${i}" class="${first === String(i) ? "on" : ""}">${PERSON_IC[p.rel] || "👤"} ${esc(p.name)}</button>`).join("")}
      <button type="button" data-pi="new" class="${first === "new" ? "on" : ""}">✏️ 직접 입력</button></div>
      <form id="${id}-form" class="form pick-form" autocomplete="off" hidden></form>`,
    bind() {
      const root = $(`#${id}`), form = $(`#${id}-form`);
      buildForm(form, id, "생일"); form.querySelector(".form-title")?.remove();
      form.insertAdjacentHTML("beforeend", `<label class="check"><input type="checkbox" name="keep" checked> 이 사람 이 폰에 저장(다음엔 고르기만)</label>`);
      form.hidden = first !== "new";
      $$("[data-pi]", root).forEach((b) => b.addEventListener("click", () => { $$("[data-pi]", root).forEach((x) => x.classList.toggle("on", x === b)); form.hidden = b.dataset.pi !== "new"; }));
    },
    get() {
      const v = $(`#${id} [data-pi].on`)?.dataset.pi;
      if (v === "me") return { name: S.d["이름"] || "나", birth: S.birth, me: true };
      if (v === "new") {
        const f = $(`#${id}-form`), b = birthOf(f), nm = b.name || "그 사람";
        if (f.keep?.checked && b.name) { savePerson(nm, b); track("person_save"); }
        return { name: nm, birth: b };
      }
      return ppl[+v];
    },
  };
}
const giftHead = (ic, title, sub) => `<div class="gift-head">${ic3d(ic, 64)}<div><h2>${title}</h2><p class="sub">${sub}</p></div></div>`;

// ───────── 🧧 행운 부적
const CHARM_P = [["exam", "📚", "시험"], ["interview", "💼", "면접"], ["talk", "🎤", "발표"], ["love", "💗", "고백·데이트"], ["start", "🌱", "첫 출근"], ["deal", "✍️", "계약"], ["etc", "✨", "그 밖에"]];
function charmSvg(c, who) {
  const W = 360, H = 640, ch = [...c["글자"]], L = c["행운"];
  const lines = (arr, x, y, s, col, lh = 1.45) => arr.map((t, i) => `<text x="${x}" y="${y + i * s * lh}" font-size="${s}" fill="${col}" text-anchor="middle">${esc(t)}</text>`).join("");
  const nm = who.me ? (S.d["이름"] || "나") : who.name;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" font-family="Jua, Gowun Dodum, Apple SD Gothic Neo, Malgun Gothic, sans-serif">
    <defs><linearGradient id="cb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff7e6"/><stop offset="1" stop-color="#ffe0b0"/></linearGradient>
      <linearGradient id="cp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2a8"/><stop offset="1" stop-color="#f3c84a"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#cb)"/>
    <text x="180" y="44" font-size="17" fill="#8a5a00" text-anchor="middle">${esc(nm)}의 행운 부적</text>
    <rect x="48" y="62" width="264" height="420" rx="8" fill="url(#cp)" stroke="#d4a017" stroke-width="2"/>
    <rect x="58" y="72" width="244" height="400" rx="4" fill="none" stroke="#c62f2f" stroke-width="2"/><rect x="64" y="78" width="232" height="388" rx="3" fill="none" stroke="#c62f2f" stroke-width="1"/>
    <text x="180" y="108" font-size="15" fill="#a32626" text-anchor="middle">${esc(c["날짜말"])} · ${esc(c["목적"]["이모지"])} ${esc(c["목적"]["이름"])}</text>
    ${ch.map((t, i) => `<text x="${i % 2 ? 228 : 132}" y="${i < 2 ? 196 : 286}" font-size="70" font-weight="700" fill="#c62f2f" text-anchor="middle" font-family="serif">${esc(t)}</text>`).join("")}
    <text x="180" y="332" font-size="19" fill="#a32626" text-anchor="middle">${esc(c["뜻"])}</text>
    ${c["소원"] ? `<text x="180" y="364" font-size="18" fill="#7a1f1f" text-anchor="middle">“${esc(c["소원"])}”</text>` : ""}
    <rect x="${c["소원"] ? 256 : 244}" y="${c["소원"] ? 426 : 410}" width="${c["소원"] ? 34 : 40}" height="${c["소원"] ? 34 : 40}" rx="6" fill="#c62f2f"/><g transform="translate(${c["소원"] ? 273 : 264} ${c["소원"] ? 445 : 432}) scale(${c["소원"] ? 1.7 : 2})" fill="#fff"><ellipse cx="0" cy="2" rx="3" ry="2.4"/><circle cx="-3" cy="-2" r="1.2"/><circle cx="0" cy="-3.2" r="1.2"/><circle cx="3" cy="-2" r="1.2"/></g>
    ${c["소원"] ? lines(wrapText(c["응원"], 15).slice(0, 3), 150, 394, 13, "#5a3a10", 1.4) : lines(wrapText(c["응원"], 17).slice(0, 3), 165, 370, 13.5, "#5a3a10")}
    <rect x="28" y="500" width="304" height="100" rx="16" fill="#fff" opacity=".85"/>
    <text x="180" y="524" font-size="13" fill="#b8740b" text-anchor="middle">이날 나를 지켜 줄 것</text>
    <text x="180" y="550" font-size="14" fill="#3b2f4a" text-anchor="middle">🎨 ${esc(L["색"])} · 🍽️ ${esc(L["음식"])} · 🧭 ${esc(L["방향"])}${L["시간"].length ? ` · ⏰ ${esc(L["시간"].join("·"))}` : ""}</text>
    <text x="180" y="576" font-size="14" fill="#3b2f4a" text-anchor="middle">🎒 ${esc(L["소품"])}</text>
    <text x="180" y="${H - 18}" font-size="12" fill="#8a6a3a" text-anchor="middle">사주냥이 · 이 부적은 ${esc(josa(nm, "을", "를"))} 응원한다냥 🐾</text></svg>`;
}
function openCharm() {
  track("charm_open");
  const pk = personPicker("ch-who");
  openSheet(`${giftHead("charm", "행운 부적", "시험·면접·고백 같은 날, 점수 대신 그날 나를 지켜 줄 것만 담아 준다냥.")}
    <h3 class="pref-h">누구를 위한 부적?</h3>${pk.html}
    <h3 class="pref-h">어떤 날이야?</h3><div class="role-pick" id="ch-p">${CHARM_P.map(([k, e, l], i) => `<button type="button" data-role="${k}" class="${i ? "" : "on"}">${e} ${l}</button>`).join("")}</div>
    <h3 class="pref-h">내 목표 한 줄 <small class="sub">(선택 · 부적에 적혀요)</small></h3><input id="ch-wish" class="date-in" maxlength="20" placeholder="예) 9급 공무원 합격! / 토익 900">
    <h3 class="pref-h">그날은 언제?</h3><input type="date" id="ch-day" class="date-in" value="${kstDate(1)}" min="${kstDate(0)}" max="${kstDate(400)}">
    <button class="btn primary wide" type="button" id="ch-go" style="margin-top:14px">🧧 부적 만들기</button><div id="ch-out"></div>`);
  pk.bind();
  const purpose = pickChips($("#ch-p"));
  $("#ch-go").addEventListener("click", async (e) => {
    const btn = e.currentTarget; let who;
    try { who = pk.get(); } catch (err) { alert(err.message); return; }
    btn.disabled = true; const out = $("#ch-out"); loading(out);
    try {
      const c = await api("/api/charm", { birth: who.birth, day: $("#ch-day").value, purpose: purpose(), wish: $("#ch-wish").value.trim() });
      track("charm", { p: purpose() });
      out.innerHTML = `<div id="story-box" class="story-box" style="margin-top:14px">${charmSvg(c, who)}</div>
        <div class="gift-note"><b>${esc(c["기운"])}</b><span>${esc(c["지킴"])}</span></div>
        <div class="rd-cta" style="margin-top:10px"><button class="btn primary" type="button" id="ch-share">📤 공유하기</button><button class="btn lav" type="button" id="ch-save">🖼️ 이미지 저장</button></div>
        <p class="sub" style="text-align:center;margin:8px 0 0">친구 시험날 보내 주면 최고의 응원이 된다냥 🐾</p>`;
      const svg = () => $("#story-box svg"), fn = `사주냥이_행운부적_${c["날짜"]}.png`;
      $("#ch-share").addEventListener("click", () => { track("story_share", { k: "charm" }); shareImage(svg(), fn, `${c["날짜말"]} ${c["목적"]["이름"]} 행운 부적 🧧 ${c["뜻"]}!`); });
      $("#ch-save").addEventListener("click", () => { track("story_save", { k: "charm" }); saveSvgPng(svg(), fn); });
      out.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) { out.innerHTML = `<p class="error">${esc(err.message)}</p>`; }
    finally { btn.disabled = false; }
  });
}

// ───────── 📅 우리 둘 좋은 날
const TWO_P = [["meet", "☕", "약속·데이트"], ["trip", "🧳", "여행"], ["talk", "💬", "중요한 대화"], ["work", "🤝", "같이 하는 일"]];
const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);
function openTwoDays() {
  track("twodays_open");
  const pk = personPicker("td-who", false);
  openSheet(`${giftHead("twodays", "우리 둘 좋은 날", "앞으로 60일 중 우리 둘 다 기운이 좋은 날을 골라 준다냥. 약속·여행 날짜 잡기 전에!")}
    <h3 class="pref-h">누구랑?</h3>${pk.html}
    <h3 class="pref-h">무엇을 할 거야?</h3><div class="role-pick" id="td-p">${TWO_P.map(([k, e, l], i) => `<button type="button" data-role="${k}" class="${i ? "" : "on"}">${e} ${l}</button>`).join("")}</div>
    <button class="btn primary wide" type="button" id="td-go" style="margin-top:14px">📅 좋은 날 찾기</button><div id="td-out"></div>`);
  pk.bind();
  const purpose = pickChips($("#td-p"));
  $("#td-go").addEventListener("click", async (e) => {
    const btn = e.currentTarget; let who;
    try { who = pk.get(); } catch (err) { alert(err.message); return; }
    btn.disabled = true; const out = $("#td-out"); loading(out);
    try {
      const r = await api("/api/twodays", { a: S.birth, b: who.birth, purpose: purpose() });
      track("twodays", { p: purpose() });
      let weekend = false;
      const draw = () => {
        const list = weekend ? r["주말추천"] : r["추천"];
        out.innerHTML = `<div class="td-top"><b>${esc(S.d["이름"] || "나")} 💞 ${esc(who.name)} · ${esc(r["목적"])}</b>
          <label class="check"><input type="checkbox" id="td-wk" ${weekend ? "checked" : ""}> 주말만</label></div>
          ${list.length ? list.map((x, i) => `<div class="td-row ${i ? "" : "best"}"><div><b>${esc(x["날짜말"])}</b><span class="td-star">${stars(x["별"])}</span></div>
            <small>${esc(x["이유"])} · ${esc(x["한줄"])}</small></div>`).join("") : `<p class="sub">60일 안에 주말 추천이 없다냥. 주말만을 꺼 봐!</p>`}
          <button class="ghost wide" type="button" id="td-copy" style="margin-top:10px">📋 이 날짜 보내기</button>`;
        $("#td-wk").addEventListener("change", (ev) => { weekend = ev.target.checked; draw(); });
        $("#td-copy").addEventListener("click", async () => {
          const t = `우리 둘 좋은 날 🐾 ${list.slice(0, 3).map((x) => `${x["날짜말"]} ${stars(x["별"])}`).join(" / ")} — 사주냥이가 골라 줬어! ${location.origin}/`;
          try { await navigator.clipboard.writeText(t); toast("복사했다냥! 카톡에 붙여 넣어 봐 🐾"); } catch { alert(t); }
        });
      };
      draw(); out.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) { out.innerHTML = `<p class="error">${esc(err.message)}</p>`; }
    finally { btn.disabled = false; }
  });
}

// ───────── 📈 기분 × 기운 리포트
const MOOD_NEED = 5;
function openMoodSheet() {
  openSheet(`<h2 style="margin:0 0 10px">😊 오늘 기분 · 출석 도장</h2><div id="checkin-slot">${checkinCard()}</div>`);
  paintNyang($("#checkin-slot"));
}
async function openMoodReport() {
  track("moodreport_open");
  const diary = store.get("diary", {});
  const recs = Object.entries(diary).filter(([, v]) => v && v.mood != null).map(([d, v]) => ({ d, m: v.mood })).slice(-180);
  if (recs.length < MOOD_NEED) {
    openSheet(`${giftHead("moodreport", "기분 × 기운 리포트", "매일 기분을 기록하면, 어떤 기운의 날에 내가 웃고 지치는지 나만의 패턴을 찾아 준다냥.")}
      <div class="mood-prog"><div class="mp-bar"><i style="width:${recs.length / MOOD_NEED * 100}%"></i></div><b>${recs.length} / ${MOOD_NEED}일</b></div>
      <p>기분을 <b>${MOOD_NEED - recs.length}일</b>만 더 기록하면 리포트가 열린다냥. 기록이 쌓일수록 더 정확해져!</p>
      <button class="btn primary wide" type="button" data-moodsheet>😊 오늘 기분 기록하기</button>`);
    return;
  }
  openSheet(`${giftHead("moodreport", "기분 × 기운 리포트", `기록 ${recs.length}일로 찾은 나만의 패턴이다냥.`)}<div id="mr-out"></div>`);
  const out = $("#mr-out"); loading(out);
  try {
    const r = await api("/api/moodreport", { birth: S.birth, records: recs });
    track("moodreport", { n: recs.length });
    const face = (v) => (v == null ? "·" : v < 0.7 ? "😣" : v < 1.4 ? "🙂" : "😆");
    out.innerHTML = `<div class="mr-bars">${ELEM.map((e) => { const x = r["오행"][e]; return `<div class="mr-col ${e === r["좋은기운"] ? "best" : ""}">
        <span class="mr-face">${face(x["평균"])}</span><i style="height:${x["평균"] == null ? 6 : 12 + x["평균"] / 2 * 70}px;background:${ELC[e]}"></i><b>${HANJA[e]} ${e}</b><small>${x["수"]}일</small></div>`; }).join("")}</div>
      <p class="sub" style="text-align:center;margin:4px 0 12px">그날 들어온 기운(일진 오행)별 내 기분 평균 · ${r["확신"] ? "기운마다 3일 이상 쌓인 결과" : "아직 기록이 적어 참고용"}</p>
      <ul class="tips plain">${r["말"].map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      ${r["상관"] != null ? `<p class="fine">냥이 점수와 기분의 닮은 정도: ${Math.round(r["상관"] * 100)}% (100%에 가까울수록 같이 움직임)</p>` : ""}`;
  } catch (err) { out.innerHTML = `<p class="error">${esc(err.message)}</p>`; }
}

// ───────── 🎂 생일 냥이
async function bdayData() {
  const me = { name: S.d["이름"] || "나", birth: S.birth };
  const ppl = [me, ...phonePeople()].slice(0, 30);
  const h = hashStr(JSON.stringify(ppl.map((p) => [p.name, p.birth.year, p.birth.month, p.birth.day, p.birth.calendar, !!p.birth.leap])));
  const c = store.get("bday", null);
  if (c?.d === kstDate(0) && c.h === h) return c.v;
  const v = await api("/api/birthdays", { people: ppl.map((p) => ({ name: p.name, birth: { ...p.birth, name: p.name } })) });
  store.set("bday", { d: kstDate(0), h, v });
  return v;
}
const dday = (n) => (n === 0 ? "오늘!" : `D-${n}`);
async function refreshBdayTile() {
  const t = $("[data-gift=\"birthday\"] small"); if (!t || !S.d) return;
  try {
    const v = await bdayData(), x = v["생일"][0];
    if (x && x["디데이"] <= 30) { t.textContent = `${dday(x["디데이"])} ${x["이름"]}`; t.closest("[data-gift]")?.classList.toggle("hot", x["디데이"] <= 7); }
  } catch { /* 생일 정보는 없어도 된다 */ }
}
function bdaySvg(x, showAge = null) {
  const W = 360, H = 640, me = x["이름"] === (S.d["이름"] || "나"), age = showAge ?? me;
  const cake = ic3d("birthday", 150).replace("<svg ", '<svg x="105" y="96" ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" font-family="Jua, Gowun Dodum, Apple SD Gothic Neo, Malgun Gothic, sans-serif">
    <defs><linearGradient id="bb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0f4"/><stop offset="1" stop-color="#e9e0ff"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#bb)"/>
    ${[[40, 60, "#ffd66b"], [320, 90, "#ff8fa3"], [300, 260, "#7fd3b8"], [56, 300, "#a78bfa"], [330, 420, "#ffd66b"], [30, 470, "#ff8fa3"]].map(([cx, cy, c]) => `<circle cx="${cx}" cy="${cy}" r="5" fill="${c}"/>`).join("")}
    <text x="180" y="70" font-size="15" fill="#7c5cf0" text-anchor="middle">${esc(x["날짜말"])}${age ? ` · ${x["나이"]}번째 생일` : ""}</text>${cake}
    <text x="180" y="300" font-size="27" fill="#c2385a" text-anchor="middle">${me ? "생일 축하해, 나!" : `생일 축하해, ${esc(x["이름"])}!`}</text>
    ${x["냥이"] ? `<text x="180" y="336" font-size="15" fill="#3b2f4a" text-anchor="middle">${age ? `${esc(x["띠"])}띠 · ${esc(x["냥이"]["일주"])}일주 · ` : ""}${esc(x["냥이"]["이름"])}</text>` : ""}
    <rect x="34" y="364" width="292" height="150" rx="20" fill="#fff" opacity=".9"/>
    ${wrapText(age ? x["축하"] : x["축하"].replace(/^\d+번째 /, ""), 19).slice(0, 3).map((t, i) => `<text x="180" y="${400 + i * 24}" font-size="15.5" fill="#3b2f4a" text-anchor="middle">${esc(t)}</text>`).join("")}
    ${wrapText("🎁 " + x["선물"], 21).slice(0, 2).map((t, i) => `<text x="180" y="${478 + i * 20}" font-size="13" fill="#7c5cf0" text-anchor="middle">${esc(t)}</text>`).join("")}
    <text x="180" y="${H - 18}" font-size="12" fill="#6b6080" text-anchor="middle">사주냥이 · 너의 생일 냥이는 누구야? 🐾</text></svg>`;
}
async function openBirthdays() {
  track("birthday_open");
  openSheet(`${giftHead("birthday", "생일 냥이", "이 폰에 넣어 둔 가족·친구 생일을 챙겨 준다냥. 음력 생일은 올해 양력 날짜로 바꿔서!")}<div id="bd-out"></div>`);
  const out = $("#bd-out"); loading(out);
  try {
    const v = await bdayData(), list = v["생일"];
    out.innerHTML = `${list.map((x, i) => `<div class="bd-row ${x["디데이"] <= 7 ? "soon" : ""}"><span class="bd-d">${dday(x["디데이"])}</span>
        <div><b>${esc(x["이름"])}</b><small>${esc(x["날짜말"])}${x["음력"] ? " (음력 생일)" : ""} · ${x["나이"]}번째 · ${esc(x["띠"])}띠</small></div>
        <button type="button" class="ghost" data-bdcard="${i}">🎂 카드</button></div>`).join("")}
      ${list.length <= 1 ? `<p class="sub" style="margin-top:10px">인연 탭의 🏠 가족, 귀인 지도(내 폰 저장), 또는 '우리 둘 좋은 날'·'행운 부적'에서 직접 입력한 사람이 여기 함께 떠요.</p>` : ""}
      ${store.get("people", []).length ? `<details class="saved-ppl"><summary>저장한 사람 ${store.get("people", []).length}명 관리</summary>
        ${store.get("people", []).map((p, i) => `<div class="sp-row"><span>👤 ${esc(p.name)} <small>${p.birth.year}.${p.birth.month}.${p.birth.day}${p.birth.calendar === "lunar" ? " 음력" : ""}</small></span>
          <button type="button" class="ghost" data-pdel="${i}" aria-label="${esc(p.name)} 지우기">✕</button></div>`).join("")}</details>` : ""}`;
    $$("[data-pdel]", out).forEach((b) => b.addEventListener("click", () => {
      const l = store.get("people", []), p = l[+b.dataset.pdel];
      if (p && confirm(`${p.name}을(를) 이 폰에서 지울까?`)) { l.splice(+b.dataset.pdel, 1); store.set("people", l); store.set("bday", null); openBirthdays(); }
    }));
    $$("[data-bdcard]", out).forEach((b) => b.addEventListener("click", () => {
      const x = list[+b.dataset.bdcard]; track("birthday_card");
      const me = x["이름"] === (S.d["이름"] || "나");
      openSheet(`<h2 style="margin:0 0 10px">🎂 ${esc(x["이름"])} 생일 카드</h2><div id="story-box" class="story-box">${bdaySvg(x)}</div>
        <label class="check" style="margin-top:8px"><input type="checkbox" id="bd-age" ${me ? "checked" : ""}> 나이·띠 보이기 ${me ? "" : "<small class='sub'>(다른 사람 카드는 기본으로 숨겨요)</small>"}</label>
        <div class="rd-cta" style="margin-top:12px"><button class="btn primary" type="button" id="bd-share">📤 보내기</button><button class="btn lav" type="button" id="bd-save">🖼️ 이미지 저장</button></div>`);
      $("#bd-age").addEventListener("change", (ev) => { $("#story-box").innerHTML = bdaySvg(x, ev.target.checked); });
      const svg = () => $("#story-box svg"), fn = `사주냥이_생일카드_${x["이름"]}.png`;
      $("#bd-share").addEventListener("click", () => shareImage(svg(), fn, `${x["이름"]}, 생일 축하해! 🎂`));
      $("#bd-save").addEventListener("click", () => saveSvgPng(svg(), fn));
    }));
  } catch (err) { out.innerHTML = `<p class="error">${esc(err.message)}</p>`; }
}

/** 타일 아래 한 줄 — 기분 리포트는 기록이 얼마나 쌓였는지 */
function giftSub(k, def) {
  if (k !== "moodreport") return def;
  const n = Object.values(store.get("diary", {})).filter((v) => v && v.mood != null).length;
  return n < MOOD_NEED ? `기록 ${n}/${MOOD_NEED}일 — 쌓이면 열려요` : def;
}

// ───────── 타일(지금 나에게 · 오늘의 의식)에서 여는 곳
const GIFT_TILES = [["charm", "행운 부적", "중요한 날 지켜 줄 부적", openCharm], ["twodays", "우리 둘 좋은 날", "약속·여행 날짜 고르기", openTwoDays],
  ["moodreport", "기분 리포트", "나만의 기분 패턴", openMoodReport], ["birthday", "생일 냥이", "다가오는 생일 챙기기", openBirthdays]];
document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-gift]");
  if (g) { const t = GIFT_TILES.find((x) => x[0] === g.dataset.gift); if (t) { store.set(`seen:${t[0]}`, 1); $$(`.gtile[data-gift="${t[0]}"]`).forEach((el) => el.classList.remove("new")); t[3](); } return; }
  if (e.target.closest("[data-moodsheet]")) { openMoodSheet(); return; }
});
