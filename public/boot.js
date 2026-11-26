/* 사주냥이 첫 그림 전에 도는 아주 작은 스크립트(보안 정책상 인라인 스크립트를 쓰지 않으려고 파일로 뺐다).
   1) 밤 모드를 첫 화면부터 적용해 깜빡임을 없앤다  2) 방문 통계(va) 대기열을 미리 만든다 */
(function () {
  try {
    var m = localStorage.getItem("nyang:theme") || "auto", h = new Date().getHours();
    if (m === "night" || (m === "auto" && (h >= 21 || h < 6 || matchMedia("(prefers-color-scheme: dark)").matches))) document.documentElement.classList.add("night");
  } catch (e) { /* 저장소를 못 쓰는 브라우저 */ }
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
})();
