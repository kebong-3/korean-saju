/* 사주냥이 캐릭터 — 갓 쓴 2천 살 선비 고양이. nyang(mood, size) → SVG 문자열
   mood: normal | happy | think | wow | wink */
(function () {
  const INK = "#3b2f4a";
  const eyes = {
    normal: `<g class="ny-eye"><ellipse cx="46" cy="70" rx="4.2" ry="5.2" fill="${INK}"/><ellipse cx="74" cy="70" rx="4.2" ry="5.2" fill="${INK}"/>
             <circle cx="47.6" cy="68" r="1.6" fill="#fff"/><circle cx="75.6" cy="68" r="1.6" fill="#fff"/></g>`,
    happy: `<path d="M40 71 q6 -8 12 0 M68 71 q6 -8 12 0" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    think: `<path d="M40 70 h12" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
            <ellipse cx="74" cy="70" rx="4.2" ry="5.2" fill="${INK}"/><circle cx="75.6" cy="68" r="1.6" fill="#fff"/>`,
    wow: `<circle cx="46" cy="70" r="6" fill="${INK}"/><circle cx="74" cy="70" r="6" fill="${INK}"/>
          <circle cx="48" cy="67.5" r="2.2" fill="#fff"/><circle cx="76" cy="67.5" r="2.2" fill="#fff"/>`,
    wink: `<path d="M40 71 q6 -8 12 0" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>
           <ellipse cx="74" cy="70" rx="4.2" ry="5.2" fill="${INK}"/><circle cx="75.6" cy="68" r="1.6" fill="#fff"/>`,
  };
  const mouth = {
    normal: `<path d="M54 82 q3 4 6 0 q3 4 6 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    happy: `<path d="M53 81 q7 9 14 0 z" fill="#ff7a93" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
    think: `<path d="M56 84 h8" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`,
    wow: `<ellipse cx="60" cy="84" rx="3.6" ry="4.4" fill="#ff7a93" stroke="${INK}" stroke-width="2"/>`,
    wink: `<path d="M54 82 q3 4 6 0 q3 4 6 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  };
  window.nyang = function (mood = "normal", size = 120) {
    const m = eyes[mood] ? mood : "normal";
    return `<svg class="nyang ny-${m}" width="${size}" height="${size}" viewBox="0 0 120 124" role="img" aria-label="사주냥이">
      <ellipse cx="60" cy="120" rx="34" ry="3.5" fill="#3b2f4a" opacity=".08"/>
      <path d="M24 124 q2 -26 36 -26 q34 0 36 26 z" fill="#b9a4f5" stroke="${INK}" stroke-width="2.4"/>
      <path d="M48 99 l12 15 l12 -15" fill="#fff" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
      <circle cx="60" cy="112" r="3.2" fill="#ffd66b" stroke="${INK}" stroke-width="1.6"/>
      <path d="M22 54 L27 20 L50 38 Z" fill="#fff4e6" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M98 54 L93 20 L70 38 Z" fill="#ffb570" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M28 46 L30 28 L42 38 Z M92 46 L90 28 L78 38 Z" fill="#ffc2cf"/>
      <ellipse cx="60" cy="68" rx="40" ry="33" fill="#fff4e6" stroke="${INK}" stroke-width="2.6"/>
      <path d="M78 40 q16 4 20 22 q-12 -4 -22 -14 z" fill="#ffb570" opacity=".9"/>
      <ellipse cx="60" cy="33" rx="33" ry="6" fill="#2e2640"/>
      <rect x="47" y="10" width="26" height="24" rx="8" fill="#2e2640"/>
      <rect x="47" y="25" width="26" height="4" fill="#ff8fa3"/>
      <path d="M33 36 q-4 22 6 34 M87 36 q4 22 -6 34" stroke="#2e2640" stroke-width="1.2" fill="none" stroke-dasharray="2 3" opacity=".6"/>
      ${eyes[m]}
      <circle cx="46" cy="70" r="10" fill="none" stroke="#d9a441" stroke-width="2"/>
      <circle cx="74" cy="70" r="10" fill="none" stroke="#d9a441" stroke-width="2"/>
      <path d="M56 70 h8" stroke="#d9a441" stroke-width="2"/>
      <ellipse cx="34" cy="82" rx="6" ry="3.6" fill="#ff8fa3" opacity=".55"/>
      <ellipse cx="86" cy="82" rx="6" ry="3.6" fill="#ff8fa3" opacity=".55"/>
      <path d="M57.5 77 h5 l-2.5 3 z" fill="#ff7a93"/>
      ${mouth[m]}
      <path d="M55 90 q5 12 5 14 q0 -2 5 -14" fill="#fff" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M22 76 l-14 -3 M22 82 l-14 2 M98 76 l14 -3 M98 82 l14 2" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`;
  };
  // data-nyang 속성이 붙은 요소에 그림 넣기
  window.paintNyang = function (root = document) {
    root.querySelectorAll("[data-nyang]").forEach((el) => {
      el.innerHTML = window.nyang(el.dataset.nyang, +(el.dataset.size || 120));
    });
  };
})();
