// Tabellone vettoriale (SVG 1024x1026, stesse coordinate di TOWNS).
import { TOWNS, ROADS, REGIONS, MARRIAGE_TRACK, REGION_SCORE } from '../game/data.js';
import { REGION_SHAPES, LAND } from '../game/shapes.js';
import { THEME } from './theme.js';
import { ICONS, iconAt } from './icons.js';

export const BOARD_W = 1024, BOARD_H = 1026;
const LABEL = { NUN: [618, 246], ULA: [722, 222], BRE: [522, 340], CON: [420, 448], SUN: [610, 452], DUB: [782, 478], LEI: [606, 592], MUN: [430, 722] };
const ISLAND = LAND.reduce((a, b) => (b.length > a.length ? b : a)); // solo l'isola principale

const inPoly = (x, y, pts) => { // ray casting
  const p = pts.split(' ').map(q => q.split(',').map(Number));
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++)
    if ((p[i][1] > y) !== (p[j][1] > y) && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) inside = !inside;
  return inside;
};
// Cerca vicino a (x0,y0) un riquadro w x h (dal bordo alto y-18) che non tocchi città e stia nella regione.
function placeLabel(region, [x0, y0], w, h) {
  const clear = (x, y) => TOWNS.every(t => {
    const cx = Math.max(x - w / 2, Math.min(t.x, x + w / 2)), cy = Math.max(y - 18, Math.min(t.y, y - 18 + h));
    return Math.hypot(t.x - cx, t.y - cy) > 21;
  }) && (region === 'DUB' || inPoly(x, y, REGION_SHAPES[region]));
  for (let r = 0; r <= 120; r += 2)
    for (let a = 0; a < 360; a += r ? 10 : 360) {
      const x = Math.round(x0 + r * Math.cos(a * Math.PI / 180)), y = Math.round(y0 + r * Math.sin(a * Math.PI / 180));
      if (clear(x, y)) return [x, y];
    }
  return [x0, y0];
}

// Posizione delle caselle del tracciato punti (0 in alto a sinistra, senso orario, 15 per lato)
export function scoreCell(n) {
  const a = 82, b = 942, side = Math.floor((n % 60) / 15), t = (n % 15) / 15;
  return [[a + t * (b - a), a], [b, a + t * (b - a)], [b - t * (b - a), b], [a, b - t * (b - a)]][side];
}
// Spazi del tracciato matrimoni: indice 0 (in basso) … 9 (in alto)
export const marriageCell = i => [178, 868 - i * 34];

const txt = (x, y, s, size, opts = '') =>
  `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" ${opts}>${s}</text>`;

function road([a, b], i) {
  const A = TOWNS[a], B = TOWNS[b], mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
  const dx = B.x - A.x, dy = B.y - A.y, k = (i % 2 ? 1 : -1) * 0.12; // leggera curva, alternata
  return `M${A.x} ${A.y}Q${mx - dy * k} ${my + dx * k} ${B.x} ${B.y}`;
}

function knot(x, y) {
  return `<path d="M${x - 6} ${y - 6}c8 4 4 8 12 12M${x + 6} ${y - 6}c-8 4 -4 8 -12 12" stroke="#fff" stroke-width="1.8" fill="none" opacity=".85"/>
    <circle cx="${x}" cy="${y}" r="10" fill="none" stroke="#fff" stroke-width="1.4" opacity=".6"/>`;
}

export function boardSVG({ fontCSS = '' } = {}) {
  const T = THEME, ui = `font-family="${T.font.ui}"`, disp = `font-family="${T.font.heading}" font-weight="700"`;
  const regions = Object.entries(REGION_SHAPES).map(([k, pts]) =>
    `<polygon points="${pts}" fill="${T.region[k]}"/>`).join('');
  const borders = Object.values(REGION_SHAPES).map(pts =>
    `<polygon points="${pts}" fill="none" stroke="${T.border}" stroke-width="2.2" stroke-linejoin="round" opacity=".55"/>`).join('');
  const land = `<polygon points="${ISLAND}"/>`;
  const score = Array.from({ length: 60 }, (_, n) => {
    const [x, y] = scoreCell(n), big = n % 5 === 0;
    return `<rect x="${x - 25}" y="${y - 25}" width="50" height="50" rx="7" fill="${big ? '#e4cf96' : T.parchment}" stroke="${T.parchmentDark}" stroke-width="2"/>
      ${txt(x, y + 8, n, big ? 24 : 19, `${ui} font-weight="${big ? 800 : 500}" fill="${T.ink}" opacity="${big ? 1 : .7}"`)}`;
  }).join('');
  const mtrack = MARRIAGE_TRACK.map((b, i) => {
    const [x, y] = marriageCell(i);
    const ic = b === 'C' ? 'C' : b === 'CC' ? 'C' : b === 'R' ? 'R' : b === 'T' ? 'T' : null;
    return `<circle cx="${x}" cy="${y}" r="${i ? 14 : 19}" fill="${T.parchment}" opacity=".55" stroke="${T.parchmentDark}"/>
      ${ic ? iconAt(ic, x - 64, y - 13, 26) + (b === 'CC' ? iconAt('C', x - 50, y - 13, 26) : '') : ''}`;
  }).join('');
  const regScore = REGION_SCORE.slice(1).map((p, i) => `${txt(150 + i * 17, 280, i + 1, 13, `${ui} fill="${T.ink}"`)}${txt(150 + i * 17, 298, p, 13, `${ui} font-weight="800" fill="${T.ink}"`)}`).join('');
  const slots = Object.entries(REGIONS).map(([k, r], i) => {
    const x = 640 + (i % 4) * 66, y = 780 + Math.floor(i / 4) * 66;
    return `<rect x="${x}" y="${y}" width="60" height="60" rx="8" fill="${T.parchment}" opacity=".18" stroke="${T.parchment}" stroke-opacity=".5"/>
      ${txt(x + 30, y + 34, r.name.replace('Northern ', 'N. ').replace('Southern ', 'S. '), 9, `${ui} font-weight="700" fill="${T.parchment}" opacity=".8"`)}`;
  }).join('');
  const labels = Object.entries(LABEL).map(([k, pos]) => {
    const r = REGIONS[k], name = r.name.replace('Uí Néill', '').trim();
    const sub = /Uí Néill/.test(r.name) ? 'Uí Néill' : '';
    const lines = sub ? 2 : 1, w = Math.max(70, name.length * 10);
    const [x, y] = placeLabel(k, pos, w, lines * 17 + 26);
    const by = y + lines * 17 - 4;
    return `<g ${disp} fill="${T.ink}" stroke="${T.parchment}" stroke-width="4.5" paint-order="stroke" stroke-linejoin="round">
        ${txt(x, y, name, 19)}${sub ? txt(x, y + 17, sub, 15) : ''}</g>
      <g transform="translate(${x - 27} ${by})">
        <circle cx="10" cy="10" r="10" fill="${T.ink}"/>${txt(10, 14.5, r.threshold, 13, `${ui} font-weight="800" fill="${T.parchment}"`)}
        ${iconAt('T', 26, -1, 22)}${txt(54, 15, r.points, 14, `${ui} font-weight="800" fill="${T.ink}"`)}
      </g>`;
  }).join('');
  const towns = TOWNS.map(t => `<g><circle cx="${t.x}" cy="${t.y}" r="17" fill="${T.suit[t.color].fill}" stroke="#fff8e6" stroke-width="3.5"/>${knot(t.x, t.y)}</g>`).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOARD_W} ${BOARD_H}" width="${BOARD_W}" height="${BOARD_H}">
  <defs>
    <style>${fontCSS}</style>
    <radialGradient id="sea" cx=".55" cy=".45" r=".75"><stop offset="0" stop-color="${T.sea[0]}"/><stop offset="1" stop-color="${T.sea[1]}"/></radialGradient>
    <filter id="soft" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="6"/></filter>
    <pattern id="waves" width="46" height="22" patternUnits="userSpaceOnUse"><path d="M0 16q11.5-9 23 0t23 0" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width="2"/></pattern>
  </defs>
  <rect width="${BOARD_W}" height="${BOARD_H}" rx="18" fill="#e7d8b0"/>
  <rect x="44" y="44" width="936" height="938" rx="12" fill="none" stroke="${T.parchmentDark}" stroke-width="2"/>
  ${score}
  <rect x="112" y="112" width="800" height="802" rx="10" fill="url(#sea)"/>
  <rect x="112" y="112" width="800" height="802" rx="10" fill="url(#waves)"/>
  <g fill="${T.coast}" stroke="${T.coast}" stroke-width="16" stroke-linejoin="round" filter="url(#soft)" opacity=".75">${land}</g>
  <g fill="${T.coast}" stroke="#e9dcb4" stroke-width="5" stroke-linejoin="round">${land}</g>
  ${regions}${borders}
  <g fill="none" stroke="${T.road}" stroke-width="5" stroke-linecap="round" opacity=".9">${ROADS.map(road).map(d => `<path d="${d}"/>`).join('')}</g>
  ${labels}
  ${towns}
  <g>
    <rect x="124" y="124" width="160" height="112" rx="10" fill="${T.parchment}" opacity=".9"/>
    ${iconAt('A', 134, 132, 44)}${txt(228, 162, 'Vichinghi', 19, `${disp} fill="${T.ink}"`)}
    <rect x="124" y="252" width="160" height="56" rx="8" fill="${T.parchment}" opacity=".9"/>${regScore}
  </g>
  <g>
    <rect x="808" y="124" width="92" height="210" rx="10" fill="${T.parchment}" opacity=".9"/>
    ${iconAt('X', 829, 140, 50)}${txt(854, 210, 'Chiesa', 19, `${disp} fill="${T.ink}"`)}
  </g>
  <g>${mtrack}${iconAt('M', 158, 530, 40)}</g>
  ${slots}
</svg>`;
}
