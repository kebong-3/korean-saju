/* 사주냥이 캐릭터 v3 — 갓 쓴 2천 살 선비 고양이.
   nyang(mood, size, outfit) → SVG 문자열.  paintNyang(root) 는 [data-nyang] 요소에 그려 넣는다.
   - 표정 13가지(MOODS), 의상 6벌(OUTFITS). 의상을 안 주면 window.nyangOutfit(사용자가 고른 옷)을 입는다.
   - 입체감: 얼굴·몸·귀에 빛 방향(왼쪽 위)을 맞춘 그라데이션과 하이라이트, 바닥 그림자.
   - 한 화면에 여러 마리가 있어도 그라데이션 id가 겹치지 않도록 그릴 때마다 번호를 붙인다. */
(function () {
  const INK = "#3b2f4a";
  let seq = 0;

  const MOODS = {
    normal: "평온", happy: "방긋", think: "골똘", wow: "깜짝", wink: "찡긋", love: "반함", sleepy: "꾸벅",
    proud: "으쓱", sad: "시무룩", shy: "부끄", cheer: "응원", laugh: "깔깔", focus: "집중",
  };
  const OUTFITS = {
    gat: { name: "선비 갓", body: ["#c9b6ff", "#9f86ef"], trim: "#fff" },
    flower: { name: "봄꽃 화관", body: ["#ffc6d3", "#f59bb0"], trim: "#fff" },
    moon: { name: "달빛 도사", body: ["#5d5aa8", "#3a3576"], trim: "#ffe7a3" },
    winter: { name: "겨울 남바위", body: ["#9fdcc8", "#62b8a0"], trim: "#fff" },
    newyear: { name: "설빔 색동", body: ["#ffd88a", "#f4b04f"], trim: "#fff" },
    king: { name: "임금님 곤룡포", body: ["#ff8a8a", "#d9485f"], trim: "#ffd66b" },
  };

  const eyeDot = (x, y, dy = 0) => `<ellipse cx="${x}" cy="${y + dy}" rx="4.3" ry="5.3" fill="${INK}"/><circle cx="${x + 1.7}" cy="${y - 2 + dy}" r="1.7" fill="#fff"/><circle cx="${x - 1.4}" cy="${y + 2.2 + dy}" r=".8" fill="#fff" opacity=".8"/>`;
  const arcUp = (x) => `<path d="M${x - 6} 71 q6 -8 12 0" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  const heart = (x, y, s, c = "#ff5c7a") => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 3 C-4 -1 -7 2 -5 5 L0 10 L5 5 C7 2 4 -1 0 3 Z" fill="${c}"/>`;
  const sparkle = (x, y, s = 1, c = "#ffd66b") => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6 Z" fill="${c}"/>`;

  const eyes = {
    normal: `<g class="ny-eye">${eyeDot(46, 70)}${eyeDot(74, 70)}</g>`,
    happy: arcUp(46) + arcUp(74),
    think: `<path d="M40 70 h12" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>${eyeDot(74, 70, -1)}`,
    wow: `<circle cx="46" cy="70" r="6.2" fill="${INK}"/><circle cx="74" cy="70" r="6.2" fill="${INK}"/><circle cx="48" cy="67.5" r="2.3" fill="#fff"/><circle cx="76" cy="67.5" r="2.3" fill="#fff"/>`,
    wink: arcUp(46) + eyeDot(74, 70),
    love: heart(46, 64, 1.15) + heart(74, 64, 1.15),
    sleepy: `<path d="M40 70 q6 5 12 0 M68 70 q6 5 12 0" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    proud: `<g>${eyeDot(46, 71)}${eyeDot(74, 71)}<path d="M39 67.5 h14 M67 67.5 h14" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/></g>`,
    sad: `<g class="ny-eye">${eyeDot(46, 71)}${eyeDot(74, 71)}</g><path d="M39 61 l10 -3 M81 61 l-10 -3" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`,
    shy: `<path d="M41 66 l9 4.5 l-9 4.5 M79 66 l-9 4.5 l9 4.5" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    cheer: arcUp(46) + arcUp(74),
    laugh: `<path d="M39 72 q7 -11 14 0 M67 72 q7 -11 14 0" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`,
    focus: `<g class="ny-eye">${eyeDot(46, 70, 2.5)}${eyeDot(74, 70, 2.5)}</g>`,
  };
  const mouth = {
    normal: `<path d="M54 82 q3 4 6 0 q3 4 6 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    happy: `<path d="M53 81 q7 10 14 0 z" fill="#ff7a93" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
    think: `<path d="M56 84 q3 -2 8 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    wow: `<ellipse cx="60" cy="84.5" rx="3.8" ry="4.6" fill="#ff7a93" stroke="${INK}" stroke-width="2"/>`,
    wink: `<path d="M54 82 q3 4 6 0 q3 4 6 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M62 84 q2 4 4 0" fill="#ff7a93"/>`,
    love: `<path d="M53 81 q7 10 14 0 z" fill="#ff7a93" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
    sleepy: `<ellipse cx="60" cy="84" rx="2.6" ry="2" fill="${INK}" opacity=".75"/>`,
    proud: `<path d="M53 82 q4 3 8 0 q3 -1 6 -3" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    sad: `<path d="M54 86 q6 -5 12 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    shy: `<path d="M56 83 q2 2 4 0 q2 2 4 0" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    cheer: `<path d="M52 80 q8 13 16 0 z" fill="#ff7a93" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
    laugh: `<path d="M51 79 q9 15 18 0 z" fill="#ff6f8c" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M56 85.5 q4 3 8 0" fill="#ffb3c1"/>`,
    focus: `<path d="M57 84 h6" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`,
  };
  // 표정에 따라붙는 작은 효과(머리 위·옆)
  const extra = {
    wow: sparkle(14, 40, 1) + sparkle(106, 34, .8),
    love: heart(102, 30, 1.1) + heart(12, 44, .8, "#ff8fa3"),
    sleepy: `<text x="94" y="32" font-size="13" font-weight="700" fill="#7c5cf0" font-family="sans-serif">z</text><text x="103" y="22" font-size="10" font-weight="700" fill="#a78bfa" font-family="sans-serif">z</text>`,
    sad: `<path d="M38 78 q-3 6 0 9 q3 -3 0 -9 z" fill="#8fc1ff" stroke="#5b8fe0" stroke-width=".8"/>`,
    shy: `<path d="M94 50 q4 6 0 9 q-4 -3 0 -9 z" fill="#bfe1ff" stroke="#7fb3e8" stroke-width=".8"/>`,
    cheer: sparkle(104, 40, .9) + sparkle(12, 56, .7, "#ff8fa3"),
    laugh: `<path d="M36 74 q-4 3 -2 7 M84 74 q4 3 2 7" stroke="#8fc1ff" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    think: `<text x="98" y="34" font-size="15" font-weight="700" fill="#7c5cf0" font-family="sans-serif">?</text>`,
    proud: sparkle(102, 46, .7),
  };

  function hat(o, g) {
    switch (o) {
      case "flower": return `<g>
        <path d="M24 46 q36 -22 72 0" stroke="#6fbf8f" stroke-width="3" fill="none" stroke-linecap="round"/>
        ${[[28, 43, "#ff8fa3"], [42, 35, "#ffd66b"], [60, 32, "#ff8fa3"], [78, 35, "#c7a6ff"], [92, 43, "#ffb570"]].map(([x, y, c]) =>
          `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map((r) => `<ellipse rx="3.4" ry="5" cy="-4" fill="${c}" stroke="${INK}" stroke-width=".9" transform="rotate(${r})"/>`).join("")}<circle r="2.4" fill="#fff4cf" stroke="${INK}" stroke-width=".9"/></g>`).join("")}
        <ellipse cx="51" cy="37" rx="4" ry="2" fill="#6fbf8f" transform="rotate(-25 51 37)"/><ellipse cx="69" cy="37" rx="4" ry="2" fill="#6fbf8f" transform="rotate(25 69 37)"/></g>`;
      case "winter": return `<g>
        <path d="M21 58 q-2 -38 39 -40 q41 2 39 40 q-8 -14 -39 -16 q-31 2 -39 16 z" fill="url(#${g}hat)" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="M20 58 q2 -18 40 -19 q38 1 40 19" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round"/>
        <path d="M20 58 q2 -18 40 -19 q38 1 40 19" stroke="${INK}" stroke-width="1" fill="none" stroke-dasharray="1 3" opacity=".35"/>
        <circle cx="60" cy="16" r="5" fill="#ff8fa3" stroke="${INK}" stroke-width="1.6"/><path d="M58 13 q2 -1 3 0" stroke="#fff" stroke-width="1.2" fill="none"/></g>`;
      case "newyear": return `<g>
        <path d="M34 40 q4 -26 26 -26 q22 0 26 26 q-26 -6 -52 0 z" fill="url(#${g}hat)" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="M86 38 q12 6 10 22 q-6 -6 -12 -10" fill="#2e2640" stroke="${INK}" stroke-width="1.6"/>
        <path d="M44 22 q16 -6 32 0" stroke="#fff" stroke-width="1.6" fill="none" opacity=".35"/>
        <circle cx="60" cy="36" r="3" fill="#ff5c7a" stroke="${INK}" stroke-width="1.2"/></g>`;
      case "moon": return `<g>
        <ellipse cx="60" cy="33" rx="34" ry="6.5" fill="url(#${g}brim)"/>
        <rect x="46" y="8" width="28" height="26" rx="9" fill="url(#${g}hat)"/>
        <rect x="46" y="25" width="28" height="4" fill="#ffd66b"/>
        <path d="M66 12 a6 6 0 1 0 4 10 a5 5 0 1 1 -4 -10 z" fill="#ffe7a3"/>
        ${sparkle(52, 16, .45, "#ffe7a3")}${sparkle(104, 24, .6, "#ffe7a3")}${sparkle(14, 30, .5, "#ffe7a3")}</g>`;
      case "king": return `<g>
        <path d="M38 38 l2 -22 l10 10 l10 -16 l10 16 l10 -10 l2 22 z" fill="url(#${g}gold)" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
        <rect x="37" y="34" width="46" height="6" rx="3" fill="#e8b23a" stroke="${INK}" stroke-width="1.6"/>
        <circle cx="60" cy="24" r="3" fill="#6fd3b8" stroke="${INK}" stroke-width="1"/><circle cx="44" cy="30" r="2" fill="#ff8fa3"/><circle cx="76" cy="30" r="2" fill="#ff8fa3"/>
        ${sparkle(100, 22, .7)}</g>`;
      default: return `<g>
        <ellipse cx="60" cy="33" rx="33" ry="6" fill="url(#${g}brim)"/>
        <rect x="47" y="10" width="26" height="24" rx="8" fill="url(#${g}hat)"/>
        <rect x="47" y="25" width="26" height="4" fill="#ff8fa3"/>
        <path d="M51 14 v9" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".25"/>
        <path d="M33 36 q-4 22 6 34 M87 36 q4 22 -6 34" stroke="#2e2640" stroke-width="1.2" fill="none" stroke-dasharray="2 3" opacity=".6"/></g>`;
    }
  }

  function body(o, g, mood) {
    const O = OUTFITS[o];
    const up = mood === "cheer" || mood === "wink";
    let deco = "";
    if (o === "newyear") deco = ["#ff8fa3", "#ffd66b", "#6fd3b8", "#a78bfa", "#ff8fa3"].map((c, i) => `<path d="M${28 + i * 4} ${122 - i} q-1 -8 2 -14" stroke="${c}" stroke-width="3.2" fill="none"/>`).join("")
      + ["#ff8fa3", "#ffd66b", "#6fd3b8", "#a78bfa"].map((c, i) => `<path d="M${92 - i * 4} ${122 - i} q1 -8 -2 -14" stroke="${c}" stroke-width="3.2" fill="none"/>`).join("");
    if (o === "moon") deco = sparkle(36, 114, .5, "#ffe7a3") + sparkle(84, 110, .4, "#ffe7a3");
    if (o === "king") deco = `<circle cx="60" cy="113" r="6" fill="#ffd66b" stroke="${INK}" stroke-width="1.4"/><path d="M57 113 q3 -4 6 0 q-3 4 -6 0" fill="#d9485f"/>`;
    return `
      <path d="M90 116 q22 -2 19 -24 q-2 -7 -7 -5 q3 11 -4 18 q-5 5 -10 5 z" fill="url(#${g}tail)" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M102 91 l5 -1 M105 99 l4 1" stroke="${INK}" stroke-width="1.4" opacity=".35"/>
      <path d="M24 124 q2 -26 36 -26 q34 0 36 26 z" fill="url(#${g}body)" stroke="${INK}" stroke-width="2.4"/>
      <path d="M30 120 q4 -14 18 -18" stroke="#fff" stroke-width="3" fill="none" opacity=".28" stroke-linecap="round"/>
      ${deco}
      <path d="M48 99 l12 15 l12 -15" fill="${O.trim}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
      ${o === "king" ? "" : `<path d="M60 112 q-7 2 -9 8 M60 112 q7 2 9 8" stroke="#ff8fa3" stroke-width="2.6" fill="none" stroke-linecap="round"/><circle cx="60" cy="112" r="2.6" fill="#ff8fa3" stroke="${INK}" stroke-width="1.2"/>`}
      <ellipse cx="44" cy="120" rx="7" ry="5" fill="url(#${g}paw)" stroke="${INK}" stroke-width="1.8"/>
      ${up ? "" : `<ellipse cx="76" cy="120" rx="7" ry="5" fill="url(#${g}paw)" stroke="${INK}" stroke-width="1.8"/>`}
      <path d="M41 120 v2 M44 120.5 v2 M47 120 v2" stroke="${INK}" stroke-width="1" opacity=".35"/>`;
  }

  // 손에 든 물건(표정에 맞춰)
  function prop(mood, g) {
    if (mood === "cheer" || mood === "wink") return `<g class="ny-paw">
      <path d="M86 100 q8 -10 12 -22" stroke="${INK}" stroke-width="2.2" fill="none"/>
      <ellipse cx="99" cy="74" rx="8" ry="7" fill="url(#${g}paw)" stroke="${INK}" stroke-width="2"/>
      <circle cx="96" cy="72" r="1.6" fill="#ff8fa3"/><circle cx="100" cy="70.5" r="1.6" fill="#ff8fa3"/><circle cx="103.5" cy="73" r="1.6" fill="#ff8fa3"/><ellipse cx="99.5" cy="77" rx="3" ry="2.2" fill="#ff8fa3"/></g>`;
    if (mood === "think" || mood === "focus") return `<g>
      <rect x="36" y="104" width="48" height="14" rx="3" fill="#fff8e8" stroke="${INK}" stroke-width="1.8"/>
      <rect x="33" y="102" width="6" height="18" rx="3" fill="#c98a4a" stroke="${INK}" stroke-width="1.4"/><rect x="81" y="102" width="6" height="18" rx="3" fill="#c98a4a" stroke="${INK}" stroke-width="1.4"/>
      <path d="M44 108 h12 M44 112 h20 M62 108 h12" stroke="${INK}" stroke-width="1.2" opacity=".5"/><text x="70" y="115" font-size="6" fill="#d9485f" font-family="serif">命</text></g>`;
    if (mood === "proud") return `<g transform="translate(94 112) rotate(-14)">
      <path d="M0 0 L-17 -17 A24 24 0 0 1 17 -17 Z" fill="url(#${g}fan)" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M0 0 L-10 -21 M0 0 L-3.5 -23.7 M0 0 L3.5 -23.7 M0 0 L10 -21" stroke="${INK}" stroke-width=".9" opacity=".35"/>
      <path d="M-12 -12 A17 17 0 0 1 12 -12" stroke="#d9485f" stroke-width="1.6" fill="none" opacity=".7"/>
      <circle r="2.4" fill="#d9485f" stroke="${INK}" stroke-width="1"/></g>`;
    if (mood === "love") return `<g>${heart(60, 104, 1.5)}</g>`;
    return "";
  }

  window.NYANG_MOODS = MOODS;
  window.NYANG_OUTFITS = OUTFITS;
  window.nyang = function (mood = "normal", size = 120, outfit) {
    const m = eyes[mood] ? mood : "normal";
    const o = OUTFITS[outfit] ? outfit : (OUTFITS[window.nyangOutfit] ? window.nyangOutfit : "gat");
    const O = OUTFITS[o], g = `ny${++seq}`;
    const hatC = { gat: ["#4a3f63", "#231c33"], flower: ["#4a3f63", "#231c33"], winter: ["#7c5cf0", "#4b2fb3"], newyear: ["#3a3150", "#17111f"],
      moon: ["#3d3a82", "#1b1840"], king: ["#ffe08a", "#e0a72e"] }[o];
    const blush = m === "shy" || m === "love" ? ".9" : ".55";
    return `<svg class="nyang ny-${m} ny-o-${o}" width="${size}" height="${size}" viewBox="0 0 120 124" role="img" aria-label="사주냥이 · ${MOODS[m]}">
      <defs>
        <radialGradient id="${g}face" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#fffdf8"/><stop offset=".55" stop-color="#fff2e2"/><stop offset="1" stop-color="#f3d9bd"/></radialGradient>
        <linearGradient id="${g}body" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="${O.body[0]}"/><stop offset="1" stop-color="${O.body[1]}"/></linearGradient>
        <linearGradient id="${g}hat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hatC[0]}"/><stop offset="1" stop-color="${hatC[1]}"/></linearGradient>
        <linearGradient id="${g}brim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hatC[0]}"/><stop offset="1" stop-color="${hatC[1]}"/></linearGradient>
        <linearGradient id="${g}gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b0"/><stop offset="1" stop-color="#e6a92a"/></linearGradient>
        <linearGradient id="${g}ear" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc58a"/><stop offset="1" stop-color="#f29a4a"/></linearGradient>
        <radialGradient id="${g}paw" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fffdf8"/><stop offset="1" stop-color="#f0d6b8"/></radialGradient>
        <linearGradient id="${g}fan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe4ea"/><stop offset="1" stop-color="#fff8e8"/></linearGradient>
        <linearGradient id="${g}tail" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffc58a"/><stop offset="1" stop-color="#ef9440"/></linearGradient>
      </defs>
      <ellipse cx="60" cy="121" rx="38" ry="3.6" fill="#3b2f4a" opacity=".12"/>
      ${body(o, g, m)}
      <path d="M22 54 L27 20 L50 38 Z" fill="url(#${g}face)" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M98 54 L93 20 L70 38 Z" fill="url(#${g}ear)" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M28 46 L30 28 L42 38 Z M92 46 L90 28 L78 38 Z" fill="#ffc2cf"/>
      <ellipse cx="60" cy="68" rx="40" ry="33" fill="url(#${g}face)" stroke="${INK}" stroke-width="2.6"/>
      <path d="M78 40 q16 4 20 22 q-12 -4 -22 -14 z" fill="url(#${g}ear)" opacity=".92"/>
      <ellipse cx="44" cy="50" rx="13" ry="6" fill="#fff" opacity=".55" transform="rotate(-18 44 50)"/>
      ${hat(o, g)}
      ${eyes[m]}
      ${m === "sleepy" ? "" : `<circle cx="46" cy="70" r="10" fill="#fff" fill-opacity=".12" stroke="#d9a441" stroke-width="2"/><circle cx="74" cy="70" r="10" fill="#fff" fill-opacity=".12" stroke="#d9a441" stroke-width="2"/>
      <path d="M56 70 h8" stroke="#d9a441" stroke-width="2"/><path d="M40 64 q3 -3 7 -3" stroke="#fff" stroke-width="1.6" fill="none" opacity=".8"/>`}
      <ellipse cx="33" cy="82" rx="6.5" ry="3.8" fill="#ff8fa3" opacity="${blush}"/>
      <ellipse cx="87" cy="82" rx="6.5" ry="3.8" fill="#ff8fa3" opacity="${blush}"/>
      ${m === "shy" ? `<path d="M29 81 l3 -2 M33 82 l3 -2 M83 81 l3 -2 M87 82 l3 -2" stroke="#e05577" stroke-width="1.2" stroke-linecap="round"/>` : ""}
      <path d="M57.5 77 h5 l-2.5 3 z" fill="#ff7a93"/>
      ${mouth[m]}
      ${o === "moon" || o === "king" ? "" : `<path d="M55 90 q5 12 5 14 q0 -2 5 -14" fill="#fff" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`}
      <path d="M22 76 l-14 -3 M22 82 l-14 2 M98 76 l14 -3 M98 82 l14 2" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>
      ${prop(m, g)}
      ${extra[m] || ""}
    </svg>`;
  };
  // data-nyang="표정" data-size="크기" (data-outfit="옷" 선택)
  window.paintNyang = function (root = document) {
    root.querySelectorAll("[data-nyang]").forEach((el) => {
      el.innerHTML = window.nyang(el.dataset.nyang, +(el.dataset.size || 120), el.dataset.outfit);
    });
  };
})();
