/* 사주냥이 첫 그림 전에 도는 아주 작은 스크립트(보안 정책상 인라인 스크립트를 쓰지 않으려고 파일로 뺐다).
   1) 색 테마(벚꽃·한지·말차·별밤)를 첫 화면부터 적용해 깜빡임을 없앤다  2) 방문 통계(va) 대기열을 미리 만든다 */
(function () {
  try {
    var m = localStorage.getItem("nyang:theme") || "day", h = new Date().getHours(), el = document.documentElement;
    var night = m === "night" || (localStorage.getItem("nyang:autonight") === "1" && (h >= 21 || h < 6));
    if (night) el.classList.add("night"); else if (m === "hanji") el.classList.add("t-hanji"); else if (m === "matcha") el.classList.add("t-matcha");
  } catch (e) { /* 저장소를 못 쓰는 브라우저 */ }
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
})();
