// Icone vettoriali dei simboli di gioco (viewBox 0 0 40 40), ricreate dalla scheda assets/docs/card-abilities.pdf.
import { THEME } from './theme.js';

const gold = '#e8b52c', goldDeep = '#9a6b12', steel = '#9aa4ab', wood = '#7a4b25';

const triquetra = (cx = 20, cy = 21, s = 1, stroke = THEME.ink) => {
  const tips = [-90, 30, 150].map(a => [cx + 14 * s * Math.cos(a * Math.PI / 180), cy + 14 * s * Math.sin(a * Math.PI / 180)]);
  const r = 9.5 * s;
  return `<g fill="none" stroke="${stroke}" stroke-width="${2.6 * s}" stroke-linejoin="round">
    ${tips.map(([x, y]) => `<path d="M${cx} ${cy}A${r} ${r} 0 0 1 ${x} ${y}A${r} ${r} 0 0 1 ${cx} ${cy}Z"/>`).join('')}
    <circle cx="${cx}" cy="${cy}" r="${7 * s}"/></g>`;
};
const coin = (cx = 20, cy = 20, r = 12) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${gold}" stroke="${goldDeep}" stroke-width="2"/>
   <circle cx="${cx}" cy="${cy}" r="${r * 0.62}" fill="none" stroke="${goldDeep}" stroke-width="1.4"/>`;
const plus = (x, y) => `<circle cx="${x}" cy="${y}" r="6.5" fill="#3f9a3a" stroke="#fff" stroke-width="1.5"/>
  <path d="M${x - 3.5} ${y}h7M${x} ${y - 3.5}v7" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>`;
const cross = (cx, cy, r, color = THEME.ink, w = 3) =>
  `<path d="M${cx - r} ${cy - r}L${cx + r} ${cy + r}M${cx + r} ${cy - r}L${cx - r} ${cy + r}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;

export const ICONS = {
  // prendi la città attiva
  T: triquetra(),
  // +1 moneta
  C: coin(22, 22) + plus(10, 10),
  // paga 1 moneta
  P: coin(20, 20) + cross(20, 20, 12),
  // avanza sul tracciato matrimoni (pergamena con sigillo)
  M: `<rect x="5" y="11" width="30" height="19" rx="2" fill="${THEME.parchment}" stroke="${THEME.parchmentDark}" stroke-width="1.5"/>
      <circle cx="20" cy="20.5" r="7" fill="#a3221b" stroke="#6e130e" stroke-width="1.5"/>
      <circle cx="20" cy="20.5" r="3.4" fill="none" stroke="#e0827a" stroke-width="1.2"/>`,
  // prendi un predone vichingo (ascia)
  A: `<path d="M12 35L27 8" stroke="${wood}" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M23 7C30 3 37 8 36 17L31 20C31 14 28 11 22 11Z" fill="${steel}" stroke="#5d666c" stroke-width="1.4" stroke-linejoin="round"/>`,
  // disco nell'area chiesa (croce celtica)
  X: `<circle cx="20" cy="15" r="7.5" fill="none" stroke="${goldDeep}" stroke-width="2.6"/>
      <path d="M20 3V37M9 15H31" stroke="#8a5a2b" stroke-width="5" stroke-linecap="round"/>
      <circle cx="20" cy="15" r="2.6" fill="${gold}"/>`,
  // espansione: 5 monete per una città collegata
  E: triquetra(17, 22, 0.8) + `<path d="M24 12l9-8M33 4h-6M33 4v6" stroke="${THEME.ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
     + coin(31, 31, 8) + `<text x="31" y="34.5" font-size="10" font-weight="800" text-anchor="middle" fill="${THEME.ink}" font-family="${THEME.font.ui}">5</text>`,
  // rimuovi un segnalino di controllo vichingo
  V: `<circle cx="20" cy="20" r="15" fill="#c9452f" stroke="#7d2216" stroke-width="2"/>
      <path d="M11 22a9 9 0 0 1 18 0Z" fill="${steel}"/><path d="M11 21l-4-8M29 21l4-8" stroke="#f1e6c8" stroke-width="2.6" stroke-linecap="round"/>`
     + cross(20, 20, 13, THEME.ink, 3.4),
  // fama
  R: `<g transform="translate(20 20)">${Array.from({ length: 10 }, (_, i) => `<path d="M0 -17L3 -10H-3Z" fill="#e8892c" transform="rotate(${i * 36})"/>`).join('')}
      <circle r="10" fill="${gold}" stroke="#e8892c" stroke-width="2"/><circle r="4" fill="#e8892c"/></g>`,
};

export const icon = (sym, size = 40) => `<svg viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true">${ICONS[sym]}</svg>`;
// Versione da annidare dentro un altro SVG
export const iconAt = (sym, x, y, size) => `<g transform="translate(${x} ${y}) scale(${size / 40})">${ICONS[sym]}</g>`;
