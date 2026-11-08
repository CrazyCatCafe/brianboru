// Carte azione vettoriali: valore, colore e azioni come icone, niente testo.
// Layout ripreso dalla carta originale: azione principale in alto (se vinci), secondarie in basso (se perdi).
import { CARDS } from '../game/data.js';
import { THEME } from './theme.js';
import { ICONS, iconAt } from './icons.js';

const W = 200, H = 290;
const CROWN = `<path d="M6 30L4 12l9 8 7-12 7 12 9-8-2 18Z" fill="#c9a43a" stroke="#7d6418" stroke-width="2" stroke-linejoin="round"/>`;
const EMBLEM = { yellow: ICONS.M, red: ICONS.A, blue: ICONS.X, white: CROWN };

function row(syms, y, size, gap = 6) {
  const w = syms.length * size + (syms.length - 1) * gap;
  return syms.map((s, i) => iconAt(s, (W - w) / 2 + i * (size + gap), y, size)).join('');
}

export function cardSVG(value, { width = 150 } = {}) {
  const c = CARDS[value], suit = THEME.suit[c.color];
  const primSize = c.primary.length > 3 ? 38 : 44;
  const secs = c.secondary;
  const secTop = secs.length === 2 ? 170 : 200;
  return `<svg class="card-svg" viewBox="0 0 ${W} ${H}" width="${width}" role="img" aria-label="Carta ${value} ${suit.name}">
  <defs>
    <linearGradient id="band${value}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${suit.fill}"/><stop offset="1" stop-color="${suit.deep}"/></linearGradient>
  </defs>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="${suit.deep}"/>
  <rect x="7" y="7" width="${W - 14}" height="${H - 14}" rx="10" fill="${THEME.parchment}"/>
  <path d="M7 17a10 10 0 0 1 10-10h${W - 34}a10 10 0 0 1 10 10v${92}H7Z" fill="url(#band${value})"/>
  <g opacity=".13" transform="translate(${W / 2 - 45} 108) scale(2.25)">${EMBLEM[c.color]}</g>
  <circle cx="34" cy="34" r="22" fill="${THEME.parchment}" stroke="${suit.deep}" stroke-width="3"/>
  <text x="34" y="${value > 9 ? 43 : 44}" text-anchor="middle" font-family="${THEME.font.display}" font-size="${value > 9 ? 24 : 28}" fill="${THEME.ink}">${value}</text>
  ${row(c.primary, 60, primSize, 4)}
  <path d="M24 ${secTop - 12}H${W - 24}" stroke="${suit.deep}" stroke-width="1.5" stroke-dasharray="2 4" stroke-linecap="round"/>
  ${secs.map((s, i) => `<rect x="16" y="${secTop + i * 52}" width="${W - 32}" height="44" rx="8" fill="${THEME.parchmentDark}" opacity=".55"/>
    ${row(s, secTop + 4 + i * 52, 36, 4)}`).join('')}
</svg>`;
}

// Retro della carta (per le mani degli avversari e il mazzo)
export function cardBackSVG({ width = 150 } = {}) {
  return `<svg viewBox="0 0 ${W} ${H}" width="${width}" aria-hidden="true">
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="#1d3b2c"/>
  <rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="9" fill="none" stroke="#c9a43a" stroke-width="2"/>
  <g transform="translate(${W / 2 - 40} ${H / 2 - 40}) scale(2)" opacity=".85">${ICONS.T.replaceAll(THEME.ink, '#c9a43a')}</g>
</svg>`;
}
