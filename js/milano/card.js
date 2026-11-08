// Carta azione Milano: blocco colore con valore e azione se vinci, sotto le azioni se perdi. Solo icone.
import { CARDS } from '../game/data.js';
import { THEME } from './theme.js';
import { iconAt } from './icons.js';

const W = 200, H = 290;

function row(syms, y, size, color, hole, gap = 6) {
  const w = syms.length * size + (syms.length - 1) * gap;
  return syms.map((s, i) => iconAt(s, (W - w) / 2 + i * (size + gap), y, size, color, hole)).join('');
}

export function cardSVG(value, { width = 150 } = {}) {
  const c = CARDS[value], suit = THEME.suit[c.color], royal = c.color === 'white';
  const blockFill = royal ? THEME.ink : suit.fill, blockInk = royal ? '#fff' : suit.ink;
  const secs = c.secondary, size = c.primary.length > 3 ? 36 : 42;
  const secTop = 158, rowH = secs.length === 2 ? 58 : 80;
  return `<svg viewBox="0 0 ${W} ${H}" width="${width}" role="img" aria-label="Carta ${value}, ${suit.name}">
  <rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="6" fill="#fff" stroke="${THEME.ink}" stroke-width="3"/>
  <path d="M1.5 7.5a6 6 0 0 1 6-6h${W - 15}a6 6 0 0 1 6 6V132H1.5Z" fill="${blockFill}"/>
  ${royal ? `<path d="M1.5 132H${W - 1.5}" stroke="${THEME.accent}" stroke-width="6"/>` : ''}
  <text x="16" y="52" font-family="${THEME.font}" font-weight="800" font-size="48" fill="${blockInk}" letter-spacing="-1">${value}</text>
  <text x="${W - 16}" y="30" text-anchor="end" font-family="${THEME.font}" font-weight="800" font-size="12" letter-spacing="2" fill="${blockInk}" opacity=".75">VINCI</text>
  ${row(c.primary, 76, size, blockInk, blockFill, 5)}
  <text x="16" y="${secTop - 8}" font-family="${THEME.font}" font-weight="800" font-size="12" letter-spacing="2" fill="${THEME.muted}">PERDI</text>
  ${secs.map((s, i) => `${i ? `<path d="M16 ${secTop + i * rowH - 2}H${W - 16}" stroke="#d5d9dc" stroke-width="2"/>` : ''}
    ${row(s, secTop + i * rowH + (rowH - 40) / 2 - 2, 36, THEME.ink, '#fff', 6)}`).join('')}
</svg>`;
}
