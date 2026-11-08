// Illustrazioni vettoriali delle carte (viewBox 0 0 184 104): fondo chiaro con skyline, soggetto nero, un solo accento.
const K = '#111', G = '#c9cfd4', L = '#eef1f3', WATER = '#cfe7fb';

// --- primitive ---
function skyline(seed = 1, color = '#dde2e6') {
  let x = 0, s = seed, out = '';
  while (x < 184) {
    s = (s * 9301 + 49297) % 233280;
    const w = 12 + (s % 18), h = 22 + (s % 46);
    out += `<rect x="${x}" y="${92 - h}" width="${w}" height="${h}" fill="${color}"/>`;
    if (s % 5 === 0) out += `<path d="M${x + w / 2} ${92 - h - 14}v14" stroke="${color}" stroke-width="2"/>`; // antenne
    x += w + 2;
  }
  return out;
}
const bg = (seed, extra = '') => `<rect width="184" height="104" fill="${L}"/>${skyline(seed)}${extra}<rect y="92" width="184" height="12" fill="#e2e6e9"/>`;
const water = y => `<rect y="${y}" width="184" height="${104 - y}" fill="${WATER}"/><path d="M0 ${y + 5}h184M0 ${y + 11}h184" stroke="#fff" stroke-width="1.5" stroke-dasharray="10 8"/>`;
const crowd = (y, n = 9, c = K) => Array.from({ length: n }, (_, i) => {
  const x = 10 + i * (164 / (n - 1)), up = i % 2;
  return `<circle cx="${x}" cy="${y - 7}" r="5" fill="${c}"/><path d="M${x - 8} ${y + 12}q8-14 16 0Z" fill="${c}"/>` +
    (up ? `<path d="M${x + 4} ${y - 2}l5-12" stroke="${c}" stroke-width="3" stroke-linecap="round"/>` : '');
}).join('');
const drone = (x, y, s, a) => `<g transform="translate(${x} ${y}) scale(${s})">
  <path d="M-14 0h28" stroke="${K}" stroke-width="3"/><rect x="-6" y="-3" width="12" height="7" rx="2" fill="${K}"/>
  <ellipse cx="-14" cy="-3" rx="7" ry="2" fill="${G}"/><ellipse cx="14" cy="-3" rx="7" ry="2" fill="${G}"/>
  <circle cx="0" cy="5" r="2.2" fill="${a}"/></g>`;
const robodog = (x, y, s, a) => `<g transform="translate(${x} ${y}) scale(${s})">
  <rect x="-22" y="-14" width="40" height="14" rx="5" fill="${K}"/><rect x="14" y="-24" width="16" height="11" rx="3" fill="${K}"/>
  <rect x="21" y="-21" width="8" height="3" fill="${a}"/>
  <path d="M-16 0l-4 10 4 10M-6 0l4 10-4 10M6 0l-4 10 4 10M14 0l4 10-4 10" fill="none" stroke="${K}" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M-22-10l-8-8" stroke="${K}" stroke-width="2.5"/></g>`;
const van = (x, y, s, a, rot = 0) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
  <path d="M-40-26h56l20 14v16h-76Z" fill="${K}"/><rect x="-34" y="-20" width="14" height="8" fill="${G}"/><rect x="-14" y="-20" width="14" height="8" fill="${G}"/>
  <path d="M18-22l14 10H18Z" fill="${G}"/><rect x="-20" y="-32" width="16" height="6" fill="${a}"/>
  <circle cx="-24" cy="5" r="8" fill="#333" stroke="${L}" stroke-width="2"/><circle cx="20" cy="5" r="8" fill="#333" stroke="${L}" stroke-width="2"/></g>`;
const rays = (cx, cy, n, r0, r1, c, w = 3, a0 = 0, a1 = 360) => Array.from({ length: n }, (_, i) => {
  const a = (a0 + (a1 - a0) * (i + 0.5) / n) * Math.PI / 180;
  return `<path d="M${cx + Math.cos(a) * r0} ${cy + Math.sin(a) * r0}L${cx + Math.cos(a) * r1} ${cy + Math.sin(a) * r1}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
}).join('');
const arcs = (x, y, n, c, dir = 1) => Array.from({ length: n }, (_, i) =>
  `<path d="M${x} ${y - 8 - i * 7}a${10 + i * 7} ${10 + i * 7} 0 0 ${dir > 0 ? 1 : 0} 0 ${16 + i * 14}" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round" transform="translate(${dir * i * 2} 0)"/>`).join('');
const plant = (x, y, s, a) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0v-14" stroke="${K}" stroke-width="2.5"/>
  <path d="M0-8c-8 0-11-5-11-11 7 0 11 4 11 11Z" fill="${a}"/><path d="M0-12c0-7 4-11 11-11 0 7-4 11-11 11Z" fill="${a}"/></g>`;
const person = (x, y, s, c = K) => `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="0" cy="-26" r="7" fill="${c}"/><path d="M-12 0c0-14 5-17 12-17s12 3 12 17Z" fill="${c}"/></g>`;

// --- 25 storie ---
export const STORY_ART = {
  // rosse
  2: a => bg(2) + `<path d="M18 90Q50 20 104 36" fill="none" stroke="${K}" stroke-width="2" stroke-dasharray="4 6"/>
    <g transform="translate(112 44) rotate(28)"><rect x="-9" y="-6" width="18" height="30" rx="4" fill="${K}"/><rect x="-4" y="-16" width="8" height="12" fill="${K}"/>
    <path d="M0-16c-2-8 6-10 2-22 10 8 12 18 4 24Z" fill="${a}"/><rect x="-9" y="4" width="18" height="5" fill="${a}"/></g>
    ${rays(150, 30, 6, 6, 14, a, 2.5)}`,
  5: a => bg(5) + `<path d="M20 88 92 52M164 88 92 52" stroke="${K}" stroke-width="7"/><rect x="40" y="60" width="104" height="8" fill="${K}" transform="rotate(-6 92 64)"/>
    ${[44, 70, 96, 122].map(x => `<circle cx="${x}" cy="82" r="11" fill="${K}"/><circle cx="${x}" cy="82" r="4.5" fill="${L}"/>`).join('')}
    <path d="M150 92l10-28 10 28Z" fill="${a}"/><path d="M154 80h12" stroke="#fff" stroke-width="4"/>
    <circle cx="30" cy="40" r="10" fill="#d4d9dd"/><circle cx="44" cy="30" r="13" fill="#dde2e6"/>`,
  8: a => bg(8) + `<rect x="24" y="66" width="34" height="22" rx="3" fill="${K}"/><path d="M32 66V44M50 66V36" stroke="${K}" stroke-width="3"/>
    <circle cx="32" cy="42" r="3" fill="${a}"/><circle cx="50" cy="34" r="3" fill="${a}"/>${arcs(60, 50, 4, a)}
    ${drone(142, 34, 1.4, a).replace('<g ', '<g opacity=".95" ')}<path d="M126 22l32 26M158 22l-32 26" stroke="${a}" stroke-width="3"/>`,
  11: a => bg(11) + `<rect x="128" y="44" width="34" height="48" fill="${K}"/><rect x="134" y="52" width="22" height="14" fill="${G}"/>
    <rect x="138" y="34" width="14" height="10" rx="2" fill="${a}"/>${rays(145, 36, 6, 10, 18, a, 2)}
    <g transform="rotate(-14 30 70)">${Array.from({ length: 5 }, (_, i) => `<rect x="${24 + i * 16}" y="64" width="16" height="9" fill="${i % 2 ? '#fff' : a}" stroke="${K}" stroke-width="1.5"/>`).join('')}</g>
    <rect x="22" y="70" width="8" height="22" fill="${K}"/><path d="M108 88l-6-18" stroke="${K}" stroke-width="3"/>`,
  15: a => bg(15) + robodog(80, 70, 1.25, a) + `<circle cx="104" cy="44" r="26" fill="none" stroke="${a}" stroke-width="3"/>
    <path d="M104 12v14M104 62v14M72 44h14M122 44h14" stroke="${a}" stroke-width="3"/>`,
  18: a => bg(18) + [[40, 28, 1], [80, 18, .8], [120, 30, 1.1], [154, 18, .7], [100, 50, .9]].map(([x, y, s]) => drone(x, y, s, a)).join('') +
    `<rect x="70" y="74" width="44" height="14" rx="2" fill="${K}"/><rect x="74" y="64" width="36" height="12" fill="#333"/>
    <path d="M92 64 40 34M92 64 120 36M92 64 100 54" stroke="${a}" stroke-width="1.5" stroke-dasharray="3 3"/>`,
  24: a => bg(24) + van(92, 62, 1.25, a, 168) + `<path d="M50 92c-4-16 8-20 4-36 12 10 16 22 10 36Z" fill="${a}"/><path d="M128 92c-2-10 6-14 4-24 8 8 10 16 6 24Z" fill="${a}"/>
    <circle cx="70" cy="22" r="10" fill="#d4d9dd"/><circle cx="86" cy="14" r="8" fill="#dde2e6"/>`,
  // blu
  3: a => bg(3) + `<rect x="18" y="66" width="148" height="6" fill="${K}"/><rect x="18" y="72" width="148" height="10" fill="${a}"/>
    <path d="M26 82v10M158 82v10" stroke="${K}" stroke-width="4"/>
    ${[44, 74, 104, 134].map(x => `<path d="M${x - 11} 58h22a11 8 0 0 1-22 0Z" fill="${K}"/><path d="M${x - 4} 52c-4-6 4-8 0-14M${x + 4} 52c-4-6 4-8 0-14" stroke="${G}" stroke-width="2" fill="none"/>`).join('')}`,
  6: a => bg(6) + [[30, 58], [62, 58], [46, 30]].map(([x, y]) => `<rect x="${x}" y="${y}" width="30" height="28" fill="${K}"/><path d="M${x} ${y + 9}h30" stroke="${a}" stroke-width="3"/>`).join('') +
    `<path d="M104 88l6-36h34l6 36Z" fill="${a}"/><path d="M116 52c0-10 22-10 22 0" fill="none" stroke="${K}" stroke-width="3"/>
    <rect x="128" y="30" width="7" height="30" rx="3.5" fill="#d9a35b" transform="rotate(12 131 45)"/><circle cx="160" cy="84" r="7" fill="${a}"/><circle cx="168" cy="72" r="6" fill="${K}"/>`,
  9: a => bg(9) + `<rect x="34" y="50" width="116" height="42" fill="${K}"/>${Array.from({ length: 4 }, (_, i) => `<rect x="${44 + i * 26}" y="62" width="14" height="10" fill="${G}"/>`).join('')}
    <rect x="34" y="44" width="116" height="6" fill="#5b4a3a"/>${Array.from({ length: 8 }, (_, i) => plant(42 + i * 14, 44, 0.8, a)).join('')}
    <circle cx="160" cy="20" r="9" fill="none" stroke="${K}" stroke-width="2.5"/>`,
  12: a => bg(12) + `<rect x="10" y="70" width="164" height="22" fill="#cfd5da"/><path d="M40 70l10 10-6 12M98 70l-8 9 8 13M140 70l8 12-4 10" stroke="${K}" stroke-width="2" fill="none"/>
    ${plant(48, 70, 1.3, a)}${plant(92, 70, 1.6, a)}${plant(146, 70, 1.1, a)}
    <path d="M118 30h22l8 10h10v6h-10M118 30v18h28" fill="${K}"/><path d="M158 46c4 4 6 10 2 14" stroke="${a}" stroke-width="2" stroke-dasharray="2 4" fill="none"/>`,
  16: a => bg(16) + `<circle cx="92" cy="50" r="28" fill="${a}"/><circle cx="92" cy="50" r="15" fill="${L}"/>
    ${[45, 135, 225, 315].map(d => `<path d="M92 50l${Math.cos(d * Math.PI / 180) * 30} ${Math.sin(d * Math.PI / 180) * 30}" stroke="#fff" stroke-width="7"/>`).join('')}
    <circle cx="92" cy="50" r="15" fill="none" stroke="${K}" stroke-width="2"/><path d="M120 50q30 0 40 30" fill="none" stroke="${K}" stroke-width="3"/>
    <path d="M30 92V70l6-6 4 6 4-8 4 8v22Z" fill="${K}"/>`,
  19: a => bg(19) + `${[[30, 70], [70, 50], [114, 50], [154, 70], [92, 84]].map(([x, y], i, arr) =>
      arr.slice(i + 1).map(([x2, y2]) => `<path d="M${x} ${y - 14}L${x2} ${y2 - 14}" stroke="${G}" stroke-width="2"/>`).join('')).join('')}
    ${[[30, 70], [70, 50], [114, 50], [154, 70], [92, 84]].map(([x, y]) => person(x, y, 0.7)).join('')}
    <path d="M92 40c-6-10-20-4-12 6l12 10 12-10c8-10-6-16-12-6Z" fill="${a}"/>`,
  25: a => bg(25) + `<rect x="56" y="24" width="72" height="68" fill="${K}"/>${Array.from({ length: 6 }, (_, i) => `<rect x="${64 + (i % 3) * 21}" y="${34 + Math.floor(i / 3) * 24}" width="14" height="14" fill="${G}"/>${plant(71 + (i % 3) * 21, 48 + Math.floor(i / 3) * 24, 0.55, a)}`).join('')}
    <path d="M58 24l12-10h48l12 10Z" fill="${a}"/><path d="M70 14l4 10M90 14v10M110 14l-4 10" stroke="${K}" stroke-width="1.5"/>
    <path d="M150 92V64" stroke="${K}" stroke-width="4"/><circle cx="150" cy="56" r="14" fill="${a}"/><circle cx="26" cy="22" r="10" fill="none" stroke="${a}" stroke-width="3"/>`,
  // gialle
  1: a => bg(1) + `<g transform="rotate(-8 92 52)"><rect x="56" y="10" width="72" height="86" fill="#fff" stroke="${K}" stroke-width="3"/>
    <rect x="64" y="20" width="56" height="22" fill="${K}"/><text x="92" y="37" text-anchor="middle" font-family="Saira, sans-serif" font-weight="800" font-size="17" fill="${a}">RAVE</text>
    <path d="M64 56l6-6 6 10 6-14 6 18 6-12 6 8 6-6 6 4" fill="none" stroke="${K}" stroke-width="2.5"/>
    ${[[64, 70], [70, 70], [64, 76], [76, 82], [70, 82]].map(([x, y]) => `<rect x="${x}" y="${y}" width="5" height="5" fill="${K}"/>`).join('')}
    <text x="122" y="88" text-anchor="end" font-family="Saira, sans-serif" font-weight="800" font-size="9" fill="${K}">SAB 03:00</text></g>
    <circle cx="92" cy="12" r="4" fill="${a}"/>`,
  4: a => bg(4) + `<rect x="58" y="30" width="56" height="62" rx="4" fill="${K}"/><path d="M70 30v-8h32v8" fill="none" stroke="${K}" stroke-width="4"/>
    <circle cx="86" cy="50" r="10" fill="#333" stroke="${a}" stroke-width="3"/><circle cx="86" cy="76" r="13" fill="#333" stroke="${a}" stroke-width="3"/>
    ${arcs(124, 60, 3, a)}${arcs(48, 60, 3, a, -1)}`,
  7: a => bg(7) + `<rect x="0" y="22" width="184" height="12" fill="#b7bec4"/><rect x="24" y="34" width="12" height="58" fill="#b7bec4"/><rect x="148" y="34" width="12" height="58" fill="#b7bec4"/>
    ${rays(92, 40, 7, 6, 60, a, 3, 30, 150)}<circle cx="92" cy="40" r="5" fill="${a}"/>${crowd(80, 9)}`,
  10: a => `<rect width="184" height="104" fill="#e9eef2"/>${skyline(10)}${water(70)}
    ${[-40, -25, -10, 5, 20].map(d => `<path d="M8 66L184 ${66 + Math.tan(d * Math.PI / 180) * 176}" stroke="${a}" stroke-width="2.2"/>`).join('')}
    <rect x="2" y="60" width="12" height="10" fill="${K}"/>`,
  14: a => `<rect width="184" height="104" fill="#e9eef2"/>${skyline(14)}${water(74)}
    ${[34, 26, 18, 10].map((r, i) => `<circle cx="92" cy="44" r="${r}" fill="none" stroke="${i % 2 ? K : a}" stroke-width="4"/>`).join('')}
    ${person(40, 74, 0.6)}${person(146, 74, 0.6)}`,
  17: a => bg(17) + `<path d="M30 92V48l24-14v14l24-14v14l24-14v14l24-14v58Z" fill="${K}"/><rect x="74" y="62" width="30" height="30" fill="${a}"/>
    ${rays(89, 62, 5, 20, 34, a, 2.5, 200, 340)}${person(84, 92, 0.45, K)}${person(96, 92, 0.4, K)}`,
  23: a => `<rect width="184" height="104" fill="#f7efe0"/><circle cx="92" cy="80" r="40" fill="${a}"/>${rays(92, 80, 11, 46, 64, a, 3, 190, 350)}
    ${skyline(23, '#cbb98f')}<rect y="92" width="184" height="12" fill="#e2d6bd"/>${crowd(92, 11)}`,
  // grigie: Briano Borro
  13: a => bg(13) + `<rect x="18" y="76" width="148" height="12" fill="#a77b4f"/><path d="M24 80h40M80 84h50" stroke="#7c5734" stroke-width="1.5"/>
    <g transform="rotate(-35 92 50)"><rect x="88" y="20" width="8" height="58" fill="#7c5734"/><rect x="74" y="12" width="36" height="14" fill="${K}"/></g>
    <path d="M118 30h36v8h-28v30h-8Z" fill="${a}"/>`,
  20: a => bg(20) + `<path d="M40 92V14" stroke="${K}" stroke-width="4"/><path d="M42 16h52l-10 14 10 14H42Z" fill="${a}"/>
    <path d="M104 64l40-22v44l-40-22Z" fill="${K}"/><rect x="94" y="56" width="12" height="16" fill="${K}"/>${arcs(152, 64, 3, a)}`,
  21: a => bg(21) + `<path d="M92 14 70 92M92 14l22 78M78 64h28M74 80h36M84 40h16" stroke="${K}" stroke-width="3" fill="none"/>
    <circle cx="92" cy="14" r="5" fill="${a}"/>${arcs(104, 14, 4, a)}${arcs(80, 14, 4, a, -1)}`,
  22: a => `<rect width="184" height="104" fill="${a}"/>${rays(92, 104, 14, 30, 140, '#fff', 6, 180, 360).replace(/stroke="#fff"/g, 'stroke="#ffffff" stroke-opacity=".18"')}
    <path d="M48 104c0-30 20-38 44-38s44 8 44 38Z" fill="${K}"/><circle cx="92" cy="44" r="20" fill="${K}"/>
    <path d="M70 40c0-16 10-22 22-22s22 6 22 22l-6-4H76Z" fill="#333"/><path d="M72 46c2 18 10 22 20 22s18-4 20-22c-6 6-34 6-40 0Z" fill="#444"/>
    <rect x="62" y="80" width="60" height="8" fill="#fff" transform="rotate(-8 92 84)"/>`,
};

// --- personaggi (carte da ingaggiare) ---
const portrait = (bgc, extra, c = K) => `<rect width="184" height="104" fill="${bgc}"/>${extra.back || ''}
  <path d="M52 104c0-26 18-34 40-34s40 8 40 34Z" fill="${c}"/><circle cx="92" cy="46" r="20" fill="${c}"/>${extra.front || ''}`;
export const CHARACTER_ART = [
  a => portrait('#f3f5f7', { back: rays(92, 46, 10, 30, 52, a, 2), front: `<path d="M56 74h72l-6 12H62Z" fill="${a}"/><path d="M60 74l-6 22M124 74l6 22" stroke="${a}" stroke-width="6"/><path d="M70 40a22 22 0 0 1 44 0" fill="none" stroke="#fff" stroke-width="4"/><rect x="66" y="38" width="8" height="14" rx="3" fill="#fff"/><rect x="110" y="38" width="8" height="14" rx="3" fill="#fff"/>` }),
  a => portrait('#f3f5f7', { back: arcs(124, 40, 4, a) + arcs(60, 40, 4, a, -1), front: `<path d="M72 50c-4 20-2 34-8 44M112 50c4 20 2 34 8 44" stroke="${K}" stroke-width="8"/><path d="M128 80l14-36" stroke="${K}" stroke-width="6" stroke-linecap="round"/><circle cx="142" cy="42" r="4" fill="${a}"/>` }),
  a => portrait('#f3f5f7', { front: `<circle cx="92" cy="22" r="10" fill="${K}"/><path d="M124 104V62" stroke="#888" stroke-width="5"/><ellipse cx="124" cy="58" rx="12" ry="7" fill="${a}"/><rect x="66" y="84" width="52" height="20" fill="${a}"/>` }),
  a => portrait('#f3f5f7', { front: `<rect x="74" y="8" width="36" height="22" fill="${K}"/><rect x="66" y="28" width="52" height="5" fill="${K}"/><rect x="74" y="24" width="36" height="4" fill="${a}"/><circle cx="100" cy="46" r="6" fill="none" stroke="${a}" stroke-width="2.5"/><path d="M106 48l8 16" stroke="${a}" stroke-width="1.5"/><path d="M84 76l8 10 8-10" fill="#fff"/>` }),
  a => portrait('#1b1d20', { front: `<path d="M66 60c0-30 12-40 26-40s26 10 26 40l-8-6H74Z" fill="#2b2e33"/><rect x="80" y="40" width="24" height="10" fill="${a}"/><path d="M80 45h24" stroke="#fff" stroke-width="1" stroke-dasharray="2 2"/>` }, '#2b2e33'),
  a => `<rect width="184" height="104" fill="#e9eef2"/>${water(78)}` + `<path d="M52 104c0-26 18-34 40-34s40 8 40 34Z" fill="${K}"/><circle cx="92" cy="46" r="20" fill="${K}"/>
    <path d="M70 40c-10 20 0 40-10 60M114 40c10 20 0 40 10 60" stroke="${a}" stroke-width="7" fill="none"/><path d="M122 70v-20" stroke="${K}" stroke-width="4"/><circle cx="122" cy="46" r="6" fill="${a}"/>`,
  a => portrait('#f3f5f7', { front: `<path d="M64 60c0-28 12-40 28-40s28 12 28 40l-10-6H74Z" fill="#5b4a3a"/><circle cx="92" cy="48" r="13" fill="${K}"/><rect x="72" y="80" width="40" height="22" rx="3" fill="${K}"/><circle cx="92" cy="91" r="8" fill="#333" stroke="${a}" stroke-width="2.5"/>` }),
];
export const ESTRID_ART = a => `<rect width="184" height="104" fill="#111"/>${Array.from({ length: 9 }, (_, i) => `<path d="M${i * 23} 0v104" stroke="#2a2d31"/>`).join('')}
  <path d="M60 104c0-24 14-32 32-32s32 8 32 32" fill="none" stroke="${a}" stroke-width="2.5"/>
  <path d="M92 22 112 34v24L92 70 72 58V34Z" fill="none" stroke="#fff" stroke-width="2.5"/><path d="M92 22v48M72 34l40 24M112 34 72 58" stroke="#fff" stroke-width="1" opacity=".6"/>
  <circle cx="84" cy="44" r="3" fill="${a}"/><circle cx="100" cy="44" r="3" fill="${a}"/><path d="M74 20l6-12 6 8 6-10 6 10 6-8 6 12Z" fill="${a}"/>`;

// --- polizia ---
export const POLICE_ART = [
  a => bg(31) + van(92, 70, 1.2, a) + rays(80, 30, 8, 8, 16, a, 2),
  a => bg(32) + robodog(58, 72, 0.9, a) + robodog(122, 76, 1, a),
  a => bg(33) + [[40, 30], [80, 22], [120, 34], [150, 20], [64, 50], [104, 52]].map(([x, y]) => drone(x, y, 0.9, a)).join(''),
  a => bg(34) + Array.from({ length: 6 }, (_, i) => `<rect x="${18 + i * 26}" y="46" width="22" height="46" rx="3" fill="${K}"/><rect x="${22 + i * 26}" y="52" width="14" height="6" fill="${a}"/>`).join(''),
  a => bg(35) + van(56, 72, 0.9, a) + van(132, 76, 1, a),
  a => `<rect width="184" height="104" fill="#1b1d20"/>${skyline(36, '#2b2e33')}<path d="M92 0 40 92h104Z" fill="${a}" opacity=".35"/><rect x="84" y="0" width="16" height="10" fill="${a}"/>`,
  a => bg(37) + `<path d="M52 104V60c0-24 18-36 40-36s40 12 40 36v44Z" fill="${K}"/><rect x="62" y="52" width="60" height="16" fill="${a}"/><path d="M62 60h60" stroke="#fff" stroke-width="1.5"/>`,
];
