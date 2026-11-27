"use strict";
/* 사주냥이 화면 스크립트 — 입체감 있는 그림 아이콘(그라데이션·하이라이트·그림자). 메뉴마다 겹치지 않게 하나씩.
   ic3d(이름, 크기) → <svg>. 그라데이션 id는 아이콘마다 새로 만들어 한 화면에 여러 번 써도 섞이지 않는다. */
let IC3N = 0;
const I3L = (u, id, a, b, x2 = 0, y2 = 1) => `<linearGradient id="${u}${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const I3R = (u, id, a, b) => `<radialGradient id="${u}${id}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
const I3S = (x, y, rx, ry, o = 0.55) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity="${o}"/>`;
const I3P = (x, y, s = 1, c = "#fff") => `<g transform="translate(${x} ${y}) scale(${s})" fill="${c}"><ellipse cx="0" cy="2" rx="3" ry="2.4"/><circle cx="-3" cy="-2" r="1.2"/><circle cx="0" cy="-3.2" r="1.2"/><circle cx="3" cy="-2" r="1.2"/></g>`;
const I3STAR = (x, y, r, c) => `<path d="M${x} ${y - r}l${r * 0.3} ${r * 0.7} ${r * 0.7} ${r * 0.3}-${r * 0.7} ${r * 0.3}-${r * 0.3} ${r * 0.7}-${r * 0.3}-${r * 0.7}-${r * 0.7}-${r * 0.3} ${r * 0.7}-${r * 0.3}z" fill="${c}"/>`;

const IC3D = {
  life: (u, f) => [I3L(u, "p", "#fffaf0", "#f2d7a1") + I3L(u, "w", "#e8b877", "#a8692a") + I3R(u, "s", "#ff8f9f", "#d23c5a"),
    `<rect x="16" y="13" width="32" height="36" rx="3" fill="${f("p")}"/><rect x="11" y="8" width="42" height="10" rx="5" fill="${f("w")}"/><rect x="11" y="45" width="42" height="10" rx="5" fill="${f("w")}"/>
     <path d="M22 25h20M22 31h20M22 37h11" stroke="#c99c5c" stroke-width="2.4" stroke-linecap="round"/><circle cx="41" cy="39" r="6.5" fill="${f("s")}"/>${I3P(41, 39, 0.9)}${I3S(24, 10.6, 9, 1.6)}`],
  day: (u, f) => [I3R(u, "s", "#fff3a8", "#ff9f2e"),
    `${[...Array(8)].map((_, i) => `<rect x="30" y="2" width="4" height="9" rx="2" fill="#ffb648" transform="rotate(${i * 45} 32 32)"/>`).join("")}
     <path d="M19 23l2-11 7 6zM45 23l-2-11-7 6z" fill="#ffa83a"/><circle cx="32" cy="32" r="15" fill="${f("s")}"/>
     <path d="M25 31q2.5-3 5 0M34 31q2.5-3 5 0M29.5 36q2.5 2.4 5 0" stroke="#7a3d12" stroke-width="1.9" fill="none" stroke-linecap="round"/>
     <circle cx="24.5" cy="36" r="2.2" fill="#ff7b6b" opacity=".45"/><circle cx="39.5" cy="36" r="2.2" fill="#ff7b6b" opacity=".45"/>${I3S(27, 24.5, 5, 2.6)}`],
  tomorrow: (u, f) => [I3R(u, "m", "#fff8c8", "#f2b93a"),
    `<path d="M37 7a24 24 0 1 0 19 37A19 19 0 0 1 37 7z" fill="${f("m")}"/><path d="M19 35q2 2.2 4 0M28 37q2 2.2 4 0" stroke="#a87410" stroke-width="1.8" fill="none" stroke-linecap="round"/>
     <circle cx="20" cy="40" r="2" fill="#ff9b8a" opacity=".5"/>${I3STAR(51, 27, 4, "#ffd66b")}
     <text x="44" y="17" font-size="10" font-weight="700" fill="#9a86e8" font-family="sans-serif">z</text><text x="51" y="10" font-size="7" font-weight="700" fill="#b8a8f0" font-family="sans-serif">z</text>${I3S(20, 20, 4, 3)}`],
  week: (u, f) => [I3L(u, "b", "#effcf7", "#b9ecd9") + I3L(u, "t", "#7fdcc2", "#2fa684"),
    `<rect x="10" y="12" width="44" height="40" rx="8" fill="${f("b")}"/><path d="M10 20a8 8 0 0 1 8-8h28a8 8 0 0 1 8 8v4H10z" fill="${f("t")}"/>
     <rect x="19" y="7" width="4" height="10" rx="2" fill="#24725d"/><rect x="41" y="7" width="4" height="10" rx="2" fill="#24725d"/>
     ${[[18, 32], [26, 32], [34, 32], [42, 32], [18, 42], [26, 42], [34, 42]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#8fd4bd"/>`).join("")}
     <circle cx="44" cy="43" r="4.6" fill="#ff8fa3"/>${I3P(44, 43, 0.75)}${I3S(22, 15.4, 7, 1.4, 0.45)}`],
  month: (u, f) => [I3L(u, "h", "#ffa3b5", "#e05a7a") + I3L(u, "p", "#ffffff", "#f1e9f2"),
    `<rect x="13" y="14" width="38" height="38" rx="6" fill="${f("p")}" stroke="#eadcea"/><rect x="13" y="14" width="38" height="11" rx="6" fill="${f("h")}"/><rect x="13" y="20" width="38" height="5" fill="${f("h")}"/>
     <circle cx="23" cy="14" r="2.6" fill="#7a2f45"/><circle cx="41" cy="14" r="2.6" fill="#7a2f45"/>
     <text x="32" y="46" text-anchor="middle" font-size="17" font-weight="700" fill="#c2385a" font-family="serif">月</text><path d="M51 44v8h-8z" fill="#e6d6e8"/>${I3S(24, 17.5, 7, 1.5)}`],
  year: (u, f) => [I3R(u, "r", "#ff8a8a", "#c7243f") + I3L(u, "g", "#ffe38a", "#d39a16"),
    `<path d="M24 22c3 3 13 3 16 0l-3-9c-3 2-7 2-10 0z" fill="${f("r")}"/><path d="M20 27c-7 8-8 23 12 25 20-2 19-17 12-25z" fill="${f("r")}"/>
     <rect x="19" y="23" width="26" height="5" rx="2.5" fill="${f("g")}"/><path d="M32 25c-6-5-10 1-5 3M32 25c6-5 10 1 5 3" stroke="#ffd66b" stroke-width="2" fill="none"/>
     <text x="32" y="45" text-anchor="middle" font-size="12" font-weight="700" fill="#ffe38a" font-family="serif">福</text>${I3S(25, 35, 3.5, 6, 0.3)}`],
  love: (u, f) => [I3R(u, "h", "#ffc9d6", "#ff5f87"),
    `<path d="M15 21l2-11 8 6zM49 21l-2-11-8 6z" fill="#ff7a9a"/><path d="M32 53C16 42 10 34 10 25c0-7 5-12 11-12 5 0 8 3 11 7 3-4 6-7 11-7 6 0 11 5 11 12 0 9-6 17-22 28z" fill="${f("h")}"/>
     <circle cx="25" cy="30" r="2" fill="#8a1f3f"/><circle cx="39" cy="30" r="2" fill="#8a1f3f"/><path d="M29.5 35q2.5 2.4 5 0" stroke="#8a1f3f" stroke-width="1.8" fill="none" stroke-linecap="round"/>${I3S(19, 22, 4, 2.6)}`],
  marriage: (u, f) => [I3L(u, "g", "#fff3b8", "#d39a16", 1, 1) + I3L(u, "d", "#f2fbff", "#8fd0ff"),
    `<circle cx="24" cy="37" r="12" fill="none" stroke="${f("g")}" stroke-width="6"/><circle cx="40" cy="37" r="12" fill="none" stroke="${f("g")}" stroke-width="6"/>
     <path d="M34 19l3-5h6l3 5-6 8z" fill="${f("d")}" stroke="#fff" stroke-width="1"/><path d="M37 14l3 5 3-5" stroke="#fff" stroke-width=".8" fill="none"/>${I3S(18, 30, 4, 1.6, 0.8)}${I3S(46, 30, 3, 1.4, 0.6)}`],
  money: (u, f) => [I3L(u, "c", "#ffec96", "#d79a12"),
    `${[48, 42].map((y) => `<ellipse cx="32" cy="${y + 3}" rx="18" ry="6" fill="#b07a0c"/><ellipse cx="32" cy="${y}" rx="18" ry="6" fill="${f("c")}"/>`).join("")}
     <circle cx="32" cy="24" r="14" fill="${f("c")}" stroke="#c48a10" stroke-width="2"/><rect x="27.5" y="19.5" width="9" height="9" rx="1" fill="#fff6d6" stroke="#c48a10" stroke-width="1.6"/>
     <path d="M32 12v4M32 32v4M20 24h4M40 24h4" stroke="#c48a10" stroke-width="1.6" stroke-linecap="round"/>${I3S(26, 17, 4, 2.3)}`],
  career: (u, f) => [I3L(u, "b", "#ddaa74", "#9c5f2a") + I3L(u, "g", "#ffe38a", "#d39a16"),
    `<path d="M24 19v-4a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v4" stroke="#7a4a1e" stroke-width="3.5" fill="none"/><rect x="9" y="18" width="46" height="33" rx="7" fill="${f("b")}"/>
     <path d="M9 31h46" stroke="#8a5424" stroke-width="2"/><rect x="27" y="27" width="10" height="8" rx="2" fill="${f("g")}"/>
     <circle cx="45" cy="43" r="4.8" fill="#ff8fa3"/>${I3P(45, 43, 0.75)}${I3S(21, 22, 9, 2, 0.45)}`],
  health: (u, f) => [I3R(u, "p", "#f6b07a", "#a9521f") + I3L(u, "l", "#a6eab0", "#2f9a54"),
    `<path d="M46 35l10-7-2 9-8 4z" fill="#b8612a"/><path d="M14 31h36c0 14-6 22-18 22S14 45 14 31z" fill="${f("p")}"/><ellipse cx="32" cy="31" rx="19" ry="5" fill="#c46e33"/>
     <ellipse cx="32" cy="28" rx="14" ry="4" fill="#d9874a"/><circle cx="32" cy="24" r="3" fill="#a9521f"/>
     <path d="M37 15c4-8 14-8 14-8s0 10-9 12c-2 .4-4-1-5-4z" fill="${f("l")}"/><path d="M39 17c3-3 7-6 10-8" stroke="#1f7a40" stroke-width="1.2" fill="none"/>
     <path d="M23 21q-3-4 0-8M29 19q-3-4 0-8" stroke="#cfc4e6" stroke-width="2" fill="none" stroke-linecap="round"/>${I3S(22, 38, 4, 3, 0.4)}`],
  daewoon: (u, f) => [I3L(u, "m", "#a6e6b6", "#3f9f64") + I3L(u, "b", "#d3f3dc", "#7cc597"),
    `<path d="M3 53L21 25l10 12 9-9 21 25z" fill="${f("b")}"/><path d="M9 53L30 16l22 37z" fill="${f("m")}"/><path d="M30 16l-6 11 3-2 3 3 3-3 3 2z" fill="#fff"/>
     <path d="M30 53c-6-6 8-8 2-14s6-8 0-12" stroke="#fff6d6" stroke-width="3" fill="none" stroke-linecap="round" opacity=".9"/>
     <path d="M30 16V5" stroke="#7a4a1e" stroke-width="2"/><path d="M30 5l10 3.5-10 3.5z" fill="#ff6b81"/>`],
  compat: (u, f) => [I3R(u, "y", "#ffa8bb", "#d2335a"),
    `<circle cx="27" cy="35" r="16" fill="${f("y")}"/><path d="M13 31q14-6 28 4M14 39q12-8 26 6M19 23q8 10 4 26M29 19q8 12 2 30" stroke="#ffd2dc" stroke-width="1.6" fill="none" opacity=".85"/>
     <path d="M41 42q9 3 11-6" stroke="#d2335a" stroke-width="2" fill="none" stroke-linecap="round"/>
     <path d="M52 34c-4-3-6-5-6-7.5 0-2 1.5-3.2 3-3.2 1.3 0 2.3.8 3 1.8.7-1 1.7-1.8 3-1.8 1.5 0 3 1.2 3 3.2 0 2.5-2 4.5-6 7.5z" fill="#ff5f87"/>${I3S(21, 28, 4, 3)}`],
  child: (u, f) => [I3R(u, "b", "#fff3c0", "#ffb648") + I3L(u, "h", "#d2c3ff", "#7c5cf0"),
    `<path d="M21 14l1-8 6 4zM43 14l-1-8-6 4z" fill="#ffb648"/><rect x="29" y="34" width="6" height="17" rx="3" fill="${f("h")}"/><circle cx="32" cy="53" r="4" fill="${f("h")}"/>
     <circle cx="32" cy="22" r="14" fill="${f("b")}"/><path d="M18.5 24h27" stroke="#ff8fa3" stroke-width="3"/>${I3STAR(25, 16, 3, "#fff")}${I3STAR(40, 30, 2.4, "#fff")}${I3S(26, 15, 3.5, 2.2)}`],
  dream: (u, f) => [I3L(u, "c", "#ffffff", "#d9d0f5") + I3R(u, "m", "#fff6c2", "#f2c14a"),
    `<path d="M46 5a10 10 0 1 0 9 15 8 8 0 0 1-9-15z" fill="${f("m")}"/>${I3STAR(14, 14, 3, "#ffd66b")}${I3STAR(56, 30, 2.4, "#c8b6ff")}
     <path d="M16 48a9 9 0 0 1 2-18A11 11 0 0 1 39 26a9 9 0 0 1 9 9 6.5 6.5 0 0 1-1 13z" fill="${f("c")}"/>
     <path d="M24 39q2 2 4 0M34 39q2 2 4 0" stroke="#8a7bb8" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="22" cy="43" r="1.8" fill="#ffb3c4" opacity=".7"/>${I3S(24, 31, 5, 2.2, 0.7)}`],
  season: (u, f) => [I3L(u, "b", "#ffdc94", "#b47a1a"),
    `<path d="M32 3v9" stroke="#7a4a1e" stroke-width="2"/><path d="M21 15h22l-4-5H25z" fill="#7a4a1e"/><path d="M20 40c0-14 4-24 12-24s12 10 12 24z" fill="${f("b")}"/>
     <rect x="17" y="38" width="30" height="5" rx="2.5" fill="#a86d16"/><path d="M32 43v6" stroke="#7a4a1e" stroke-width="1.5"/>
     <path d="M25 55c3-4 9-4 12 0-3 4-9 4-12 0zm12 0l4-3v6z" fill="#6fb6ff"/>${I3S(27, 25, 2.6, 6, 0.45)}`],
  monthplan: (u, f) => [I3L(u, "b", "#ffe2c4", "#f3a76b") + I3L(u, "p", "#ffffff", "#f4f0f7"),
    `<rect x="12" y="10" width="40" height="46" rx="7" fill="${f("b")}"/><rect x="17" y="16" width="30" height="36" rx="3" fill="${f("p")}"/><rect x="24" y="6" width="16" height="8" rx="3" fill="#9c5f2a"/>
     ${[25, 34, 43].map((y, i) => `<rect x="20" y="${y - 3}" width="6" height="6" rx="1.5" fill="#dff7ef" stroke="#3fbf8f"/>${i < 2 ? `<path d="M21 ${y}l1.8 1.8 3.2-4" stroke="#2f9a54" stroke-width="1.6" fill="none"/>` : ""}<path d="M30 ${y}h13" stroke="#cfc4e6" stroke-width="2.4" stroke-linecap="round"/>`).join("")}`],
  yearcard: (u, f) => [I3L(u, "c", "#ffffff", "#ffe4ea") + I3R(u, "f", "#ffe0e8", "#ff6b8b"),
    `<g transform="rotate(-8 32 32)"><rect x="12" y="12" width="40" height="40" rx="6" fill="${f("c")}" stroke="#ffc2d0"/>
     <path d="M17 45c8-4 14-12 27-23" stroke="#8a5a3a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
     ${[[37, 27], [25, 38]].map(([x, y]) => [0, 72, 144, 216, 288].map((a) => `<circle cx="${x + Math.cos(a * Math.PI / 180) * 3.4}" cy="${y + Math.sin(a * Math.PI / 180) * 3.4}" r="2.8" fill="${f("f")}"/>`).join("") + `<circle cx="${x}" cy="${y}" r="1.6" fill="#ffd66b"/>`).join("")}
     <rect x="40" y="40" width="7" height="7" rx="1" fill="#d23c3c"/></g>`],
  ncard: (u, f) => [I3L(u, "c", "#d2c3ff", "#7c5cf0") + I3L(u, "f", "#ffffff", "#efe9ff"),
    `<rect x="20" y="8" width="30" height="42" rx="5" fill="#ffd0dc" transform="rotate(10 35 29)"/><rect x="12" y="12" width="32" height="44" rx="5" fill="${f("c")}"/>
     <rect x="16" y="16" width="24" height="22" rx="3" fill="${f("f")}"/><path d="M21 26l1-6 5 4zM35 26l-1-6-5 4z" fill="#ffb648"/><circle cx="28" cy="29" r="7" fill="#ffd28a"/>
     <circle cx="25.5" cy="28.5" r="1.1" fill="#5a3a20"/><circle cx="30.5" cy="28.5" r="1.1" fill="#5a3a20"/>
     <rect x="16" y="42" width="24" height="3" rx="1.5" fill="#fff" opacity=".85"/><rect x="16" y="48" width="14" height="3" rx="1.5" fill="#fff" opacity=".6"/>${I3STAR(41, 14, 4, "#ffd66b")}`],
  weekrev: (u, f) => [I3L(u, "g", "#eaf6ff", "#9cc8ff", 1, 1) + I3L(u, "f", "#ffc9d6", "#ff7a9a"),
    `<rect x="28" y="40" width="7" height="17" rx="3.5" fill="${f("f")}" transform="rotate(-18 32 48)"/><ellipse cx="30" cy="26" rx="17" ry="19" fill="${f("f")}"/>
     <ellipse cx="30" cy="26" rx="13" ry="15" fill="${f("g")}"/><path d="M22 21l6-6M22 28l10-10" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".85"/>${I3P(30, 7.6, 0.7, "#ffd66b")}`],
  charm: (u, f) => [I3L(u, "p", "#fff6c4", "#f0c84f"),
    `<g transform="rotate(-6 32 32)"><rect x="17" y="6" width="30" height="50" rx="3" fill="${f("p")}" stroke="#e0a92b"/><rect x="20" y="9" width="24" height="44" rx="2" fill="none" stroke="#d23c3c" stroke-width="1.3"/>
     <path d="M32 14v8M26 18h12M27 26c4 3 6 3 10 0M28 32q4 6 8 0M32 36v9M27 44h10" stroke="#d23c3c" stroke-width="2" fill="none" stroke-linecap="round"/>
     <rect x="35" y="45" width="7" height="6" rx="1" fill="#d23c3c"/>${I3S(25, 12, 3, 1.4, 0.7)}</g>`],
  twodays: (u, f) => [I3L(u, "a", "#ffffff", "#c9f0e2") + I3L(u, "b", "#ffffff", "#ffd0dc"),
    `<path d="M32 22c-4-3-6-5-6-7.5 0-2 1.5-3.2 3-3.2 1.3 0 2.3.8 3 1.8.7-1 1.7-1.8 3-1.8 1.5 0 3 1.2 3 3.2 0 2.5-2 4.5-6 7.5z" fill="#ff6b8b"/>
     <path d="M17 30q-2-4 0-7M47 30q-2-4 0-7" stroke="#cfc4e6" stroke-width="2" fill="none" stroke-linecap="round"/>
     <ellipse cx="18" cy="51" rx="13" ry="3" fill="#6fd3b8" opacity=".55"/><path d="M7 34h21v6a10.5 10.5 0 0 1-21 0z" fill="${f("a")}" stroke="#52bf9f" stroke-width="1.5"/><path d="M28 36q5 0 4 5-1 3-5 2" stroke="#52bf9f" stroke-width="2" fill="none"/>
     <ellipse cx="46" cy="51" rx="13" ry="3" fill="#ff8fa3" opacity=".55"/><path d="M35 34h21v6a10.5 10.5 0 0 1-21 0z" fill="${f("b")}" stroke="#ff7a9a" stroke-width="1.5"/><path d="M35 36q-5 0-4 5 1 3 5 2" stroke="#ff7a9a" stroke-width="2" fill="none"/>`],
  moodreport: (u, f) => [I3L(u, "a", "#d2c3ff", "#7c5cf0") + I3L(u, "b", "#ffd0dc", "#ff6b8b") + I3L(u, "c", "#c9f0e2", "#3fbf8f"),
    `<rect x="8" y="51" width="48" height="3" rx="1.5" fill="#cfc4e6"/><rect x="12" y="35" width="10" height="16" rx="3" fill="${f("a")}"/><rect x="27" y="27" width="10" height="24" rx="3" fill="${f("b")}"/>
     <rect x="42" y="19" width="10" height="32" rx="3" fill="${f("c")}"/><circle cx="47" cy="11" r="7" fill="#ffd66b"/>
     <circle cx="44.6" cy="10" r="1" fill="#8a5a00"/><circle cx="49.4" cy="10" r="1" fill="#8a5a00"/><path d="M44.5 12.5q2.5 2.5 5 0" stroke="#8a5a00" stroke-width="1.4" fill="none" stroke-linecap="round"/>${I3S(14, 37, 1.6, 4, 0.5)}`],
  birthday: (u, f) => [I3L(u, "c", "#fff0f4", "#ffc2d0") + I3L(u, "t", "#ffeab6", "#f3b54a"),
    `<path d="M19 26l1-7 5 4zM45 26l-1-7-5 4z" fill="#f3b54a"/><rect x="10" y="36" width="44" height="17" rx="5" fill="${f("c")}"/><rect x="17" y="24" width="30" height="14" rx="5" fill="${f("t")}"/>
     <path d="M17 29q3 4 6 0t6 0 6 0 6 0 6 0" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M10 41q4 4 8 0t8 0 8 0 8 0 8 0 4 0" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>
     <rect x="30" y="12" width="4" height="12" rx="2" fill="#7c5cf0"/><path d="M32 3c3 4 3 7 0 8-3-1-3-4 0-8z" fill="#ff9b3d"/>
     ${[[16, 47, "#7c5cf0"], [26, 48, "#3fbf8f"], [38, 47, "#ff6b8b"], [48, 48, "#f0a63a"]].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="1.4" fill="${c}"/>`).join("")}`],
  pae: (u, f) => [I3L(u, "r", "#ff8080", "#c7243f") + I3L(u, "w", "#ffffff", "#f1ebff"),
    `<rect x="12" y="11" width="26" height="40" rx="4" fill="${f("w")}" stroke="#d8cff0" transform="rotate(-14 25 31)"/>${I3P(22, 30, 1.3, "#d8cff0")}
     <g transform="rotate(10 37 32)"><rect x="24" y="12" width="26" height="40" rx="4" fill="${f("r")}"/><circle cx="37" cy="27" r="7" fill="#fff4cf"/>
     <path d="M27.5 41q2.4-2.4 4.8 0t4.8 0 4.8 0 4.8 0M27.5 46q2.4-2.4 4.8 0t4.8 0 4.8 0 4.8 0" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".9"/>${I3S(31, 16, 4, 1.4, 0.5)}</g>`],
  garden: (u, f) => [I3L(u, "p", "#f6b07a", "#b8612a") + I3L(u, "l", "#acecb5", "#3f9f64"),
    `<path d="M32 33V20" stroke="#3f9f64" stroke-width="3" stroke-linecap="round"/><path d="M32 25c-8 0-13-6-13-12 8 0 13 5 13 12z" fill="${f("l")}"/>
     <path d="M32 21c6-1 12-7 12-13-7 0-12 6-12 13z" fill="${f("l")}"/><path d="M16 37h32l-4 17H20z" fill="${f("p")}"/><rect x="13" y="32" width="38" height="7" rx="3.5" fill="#d9874a"/>
     <path d="M51 13c2 3 3 5 0 6.5-3-1.5-2-3.5 0-6.5z" fill="#8fb0ff"/>${I3S(21, 34.5, 6, 1.3, 0.5)}`],
  mood: (u, f) => [I3R(u, "f", "#fff3a8", "#ffc23a"),
    `<path d="M19 46l-6 10 12-6z" fill="#ffc23a"/><circle cx="32" cy="30" r="20" fill="${f("f")}"/>
     <path d="M22 28q3-4 6 0M36 28q3-4 6 0" stroke="#8a5a00" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M25 35q7 8 14 0z" fill="#ff7b6b"/>
     <circle cx="20" cy="34" r="2.6" fill="#ff8a7a" opacity=".45"/><circle cx="44" cy="34" r="2.6" fill="#ff8a7a" opacity=".45"/>${I3S(24, 18, 6, 3.4)}`],
  reading: (u, f) => [I3L(u, "p", "#ffffff", "#efe9ff") + I3L(u, "c", "#d2c3ff", "#7c5cf0"),
    `<path d="M6 18q13-6 26 2 13-8 26-2v33q-13-6-26 2-13-8-26-2z" fill="${f("c")}"/><path d="M9 18q11-5 22 2v29q-11-6-22-2z" fill="${f("p")}"/><path d="M55 18q-11-5-22 2v29q11-6 22-2z" fill="${f("p")}"/>
     <path d="M13 26q7-2 14 1M13 32q7-2 14 1M13 38q7-2 10 1M37 27q7-3 14-1M37 33q7-3 14-1" stroke="#cfc4e6" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M44 20v15l3-3 3 3V19" fill="#ff6b81"/>`],
  manse: () => ["",
    `${[["#e1f6ea", "#4fb37f"], ["#ffe3e3", "#ff6b6b"], ["#fff0d6", "#f0a63a"], ["#e4ebff", "#5b7fe0"]].map(([a, b], i) => `<rect x="${8 + i * 12.5}" y="12" width="10.5" height="17" rx="3" fill="${b}"/>
       <rect x="${8 + i * 12.5}" y="32" width="10.5" height="17" rx="3" fill="${a}" stroke="${b}" stroke-width="1.4"/>${I3S(11 + i * 12.5, 15, 2, 1, 0.6)}`).join("")}
     <path d="M11 20h5M23.5 22h5M36 20h5M48.5 22h5M11 40h5M23.5 42h5M36 40h5M48.5 42h5" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".9"/>`],
  map: (u, f) => [I3L(u, "n", "#5a3a66", "#1d1733") + I3R(u, "m", "#fff8e8", "#f3c98b"),
    `<rect x="6" y="8" width="52" height="46" rx="12" fill="${f("n")}"/><path d="M32 31L16 19M32 31L48 17M32 31L50 44M32 31L14 44" stroke="#fff" stroke-opacity=".3" stroke-width="1.4"/>
     <circle cx="32" cy="31" r="7" fill="${f("m")}"/>${[[16, 19, "#ffd66b"], [48, 17, "#7fd3b8"], [50, 44, "#ff9b8a"], [14, 44, "#8ab4ff"]].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="3.4" fill="${c}"/>`).join("")}${I3S(29, 28, 2.4, 1.6, 0.8)}`],
  closet: (u, f) => [I3L(u, "k", "#ffc9d6", "#ff7a9a") + I3L(u, "h", "#e8c18a", "#a8692a"),
    `<path d="M32 8a5 5 0 1 1 5 5c-2 0-5 1-5 4" stroke="${f("h")}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M32 17L8 34h48z" fill="none" stroke="${f("h")}" stroke-width="3.5" stroke-linejoin="round"/>
     <path d="M18 31l-3 22h34l-3-22-7 4h-14z" fill="${f("k")}"/><path d="M25 35l7 8 7-8" stroke="#fff" stroke-width="2" fill="none" opacity=".8"/>${I3S(22, 38, 2.4, 5, 0.45)}`],
  paw: (u, f) => [I3R(u, "p", "#ffd7e0", "#ff6b8b"),
    `<path d="M32 55c-9 0-15-5-15-11 0-6 7-12 15-12s15 6 15 12c0 6-6 11-15 11z" fill="${f("p")}"/>
     ${[[18, 27], [27, 17], [37, 17], [46, 27]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="6.5" fill="${f("p")}"/>`).join("")}${I3S(27, 38, 5, 2.4)}${I3S(26, 14, 1.6, 2, 0.6)}`],
};
/** 대풀이 메뉴 id → 아이콘(부부운은 연애운과 다른 그림) */
const READ_IC = { life: "life", day: "day", tomorrow: "tomorrow", week: "week", month: "month", year: "year", money: "money", career: "career",
  health: "health", daewoon: "daewoon", compat: "compat", child: "child", dream: "dream" };
function ic3d(name, size = 52) {
  const draw = IC3D[name] || IC3D.paw, u = `i3${++IC3N}`;
  const [defs, body] = draw(u, (id) => `url(#${u}${id})`);
  return `<svg class="i3d" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true" focusable="false"><defs>${defs}</defs>
    <ellipse cx="32" cy="58.5" rx="19" ry="3.4" fill="#3b2f4a" opacity=".12"/>${body}</svg>`;
}
