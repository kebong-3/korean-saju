"use strict";
/* 사주냥이 화면 스크립트 — 초기화.
   index.html 이 js/ 파일들을 순서대로(defer) 불러 하나의 전역 공간을 함께 쓴다. 모든 계산은 서버(/api/*)가 한다. */
// ───────────────────────── 초기화
async function init() {
  applyTheme(); paintNyang();
  const form = $("#form-me");
  buildForm(form, "me", "생일을 알려줘");
  form.insertAdjacentHTML("beforeend", '<button class="btn primary wide" type="submit">냥이에게 사주 보여주기 🐾</button>');
  stepify(form);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("button[type=submit]", form);
    btn.disabled = true; $(".error", form)?.remove();
    try { const first = !S.d; await withLoading(loadMe(birthOf(form))); track(first ? "signup" : "profile_edit"); }
    catch (err) { form.insertAdjacentHTML("beforeend", `<p class="error">${esc(err.message)}</p>`); }
    finally { btn.disabled = false; }
  });
  $$(".bottom button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
  $("#btn-profile").addEventListener("click", () => { fillForm(form, S.birth); form._step?.(1); $("#main").hidden = true; $("#onboard").hidden = false; window.scrollTo({ top: 0 }); });

  // 두 번째 방문부터는 지난번 받아 둔 용어·기능 정보로 바로 그리고, 새 정보는 뒤에서 받아 바꿔 둔다(서버가 잠에서 깨는 1~3초를 기다리지 않음)
  const useBoot = ({ meta, st, kinds }) => {
    S.gloss = meta.glossary || {}; S.sinsal = meta.sinsal || {}; S.ai = !!st.ai; S.share = !!st.share; S.kinds = kinds; S.stories = meta.stories || []; S.pushKey = st.push_key || null; buildTermRe();
  };
  const fetchBoot = async () => {
    const [meta, st, kinds] = await Promise.all([api("/api/meta").catch(() => null), api("/api/status").catch(() => null), api("/api/readings").catch(() => null)]);
    if (meta && st && kinds) { try { localStorage.setItem("nyang:boot", JSON.stringify({ v: APPV, meta, st, kinds })); } catch { /* 저장 공간 부족 */ } }
    return { meta: meta || { glossary: {} }, st: st || { ai: false }, kinds: kinds || [] };
  };
  let boot = null; try { boot = JSON.parse(localStorage.getItem("nyang:boot") || "null"); } catch { boot = null; }
  if (boot?.v === APPV && boot.meta && boot.st && boot.kinds) { useBoot(boot); fetchBoot().then(useBoot); }
  else useBoot(await fetchBoot());
  $("#btn-restore")?.addEventListener("click", () => openBackup());
  if (location.hash.startsWith("#smoke=")) { await runSmoke(JSON.parse(decodeURIComponent(location.hash.slice(7)))); return; }
  const qs = new URLSearchParams(location.search);
  if (qs.get("now")) S.nowPick = qs.get("now");
  if (qs.get("from")) track("entry", { from: qs.get("from") });
  const guest = qs.get("map");
  if (guest) { guestMap(guest); return; }
  $("#rd-back").addEventListener("click", () => (history.state?.reader ? history.back() : closeReader()));
  window.addEventListener("popstate", () => { if (!$("#reader").hidden) closeReader(); });

  let saved = null;
  try { saved = JSON.parse(localStorage.getItem("nyang:me") || "null"); } catch { saved = null; }
  if (saved) {
    fillForm(form, saved);
    $("#main").hidden = false; loading($("#tab-home"));
    try { await loadMe(saved); return; } catch { $("#main").hidden = true; }
  }
  $("#onboard").hidden = false;
}
init();
