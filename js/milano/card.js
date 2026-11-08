// Carte Milano 2077: storia illustrata al centro, azioni come icone (VINCI in alto, PERDI in basso).
import { CARDS, MARRIAGES } from '../game/data.js';
import { THEME } from './theme.js';
import { iconAt } from './icons.js';
import { STORIES, CHARACTERS, ESTRID, POLICE } from './lore.js';

const SHORT = { red: 'GUERRIGLIA', blue: 'COMUNITÀ', yellow: 'FESTA', white: 'BRIANO BORRO' };
import { STORY_ART, CHARACTER_ART, ESTRID_ART, POLICE_ART } from './art.js';

const W = 200, H = 290, F = `font-family="${THEME.font}"`;
let uid = 0;

const frame = (inner, label) => `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">
  <rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="6" fill="#fff" stroke="${THEME.ink}" stroke-width="3"/>${inner}</svg>`;
const art = (svg, y = 38) => { const id = `a${uid++}`;
  return `<clipPath id="${id}"><rect x="8" y="${y}" width="184" height="104"/></clipPath>
  <g clip-path="url(#${id})"><svg x="8" y="${y}" width="184" height="104" viewBox="0 0 184 104">${svg}</svg></g>
  <rect x="8" y="${y}" width="184" height="104" fill="none" stroke="${THEME.ink}" stroke-width="2"/>`; };
const band = (fill, ink, left, right) => `<path d="M1.5 7.5a6 6 0 0 1 6-6h${W - 15}a6 6 0 0 1 6 6V34H1.5Z" fill="${fill}"/>
  <text x="12" y="29" ${F} font-weight="800" font-size="28" fill="${ink}" letter-spacing="-.5">${left}</text>
  <text x="${W - 12}" y="23" text-anchor="end" ${F} font-weight="800" font-size="9.5" letter-spacing="1.6" fill="${ink}" opacity=".8">${right}</text>`;
const title = (t, y = 158) => `<text x="${W / 2}" y="${y}" text-anchor="middle" ${F} font-weight="800" font-size="${t.length > 22 ? 11.5 : 13}" letter-spacing=".6" fill="${THEME.ink}">${t.toUpperCase()}</text>`;
function icons(syms, x0, x1, y, size, color, hole) {
  const gap = 4, w = syms.length * size + (syms.length - 1) * gap, x = x0 + (x1 - x0 - w) / 2;
  return syms.map((s, i) => iconAt(s, x + i * (size + gap), y, size, color, hole)).join('');
}
const tag = (x, y, t, c) => `<text x="${x}" y="${y}" ${F} font-weight="800" font-size="8.5" letter-spacing="1.4" fill="${c}">${t}</text>`;

export function cardSVG(value) {
  const c = CARDS[value], suit = THEME.suit[c.color], royal = c.color === 'white';
  const fill = royal ? THEME.ink : suit.fill, ink = royal ? '#fff' : suit.ink, accent = royal ? THEME.accent : suit.fill;
  const rowH = 38, secY = 210;
  return frame(`${band(fill, ink, value, SHORT[c.color])}
    ${art(STORY_ART[value](accent))}
    ${title(STORIES[value])}
    <rect x="8" y="166" width="184" height="34" fill="${fill}"/>${royal ? `<rect x="8" y="198" width="184" height="3" fill="${THEME.accent}"/>` : ''}
    ${tag(14, 186, 'VINCI', ink)}${icons(c.primary, 46, 192, 169, 28, ink, fill)}
    ${c.secondary.map((s, i) => `${i ? `<path d="M14 ${secY + i * rowH - 2}H186" stroke="#d5d9dc" stroke-width="1.5"/>` : ''}
      ${tag(14, secY + i * rowH + 21, i ? 'OPPURE' : 'PERDI', THEME.muted)}${icons(s, 46, 192, secY + i * rowH + 3, 28, THEME.ink, '#fff')}`).join('')}`,
  `Carta ${value}: ${STORIES[value]}`);
}

function wrap(text, max = 30) {
  const words = text.split(' '), lines = [''];
  for (const w of words) (lines.at(-1) + ' ' + w).trim().length > max ? lines.push(w) : (lines[lines.length - 1] = (lines.at(-1) + ' ' + w).trim());
  return lines;
}

// Personaggio da ingaggiare (indice in MARRIAGES) oppure 'estrid'
export function characterSVG(i) {
  const isE = i === 'estrid', ch = isE ? ESTRID : CHARACTERS[i], m = isE ? null : MARRIAGES[i];
  const reward = isE ? '' : `<text x="22" y="262" ${F} font-weight="800" font-size="26" fill="${THEME.ink}">+${m.points}</text>
    ${tag(22, 274, 'PUNTI', THEME.muted)}
    ${m.region ? `${iconAt('T', 74, 240, 28, THEME.ink)}${tag(106, 254, ch.zone, THEME.ink)}${tag(106, 266, 'UN QUARTIERE', THEME.muted)}` : ''}
    ${m.renown ? `${iconAt('R', 74, 240, 28, THEME.ink)}${tag(106, 258, 'STREET CRED', THEME.ink)}` : ''}`;
  const choices = isE ? Object.values(ESTRID.options).map((o, k) => tag(22, 238 + k * 14, `${k + 1} · ${o.toUpperCase()}`, THEME.ink)).join('') : '';
  return frame(`${band(THEME.ink, '#fff', isE ? 'IA' : '★', isE ? 'IA LIBERA' : 'PERSONAGGIO')}
    ${art(isE ? ESTRID_ART(THEME.suit.yellow.fill) : CHARACTER_ART[i](THEME.suit.yellow.fill))}
    ${title(ch.name)}
    ${wrap(ch.who).map((l, k) => `<text x="${W / 2}" y="${178 + k * 13}" text-anchor="middle" ${F} font-size="11" fill="${THEME.muted}">${l}</text>`).join('')}
    <path d="M14 214H186" stroke="#d5d9dc" stroke-width="1.5"/>${reward}${choices}`, `Personaggio: ${ch.name}`);
}

export function policeSVG(i) {
  const p = POLICE[i];
  return frame(`<path d="M1.5 7.5a6 6 0 0 1 6-6h${W - 15}a6 6 0 0 1 6 6V34H1.5Z" fill="#1b1d20"/>
    <rect x="1.5" y="30" width="98.5" height="4" fill="${THEME.accent}"/><rect x="100" y="30" width="98.5" height="4" fill="${THEME.suit.blue.fill}"/>
    <text x="12" y="23" ${F} font-weight="800" font-size="11" letter-spacing="2" fill="#fff">POLIZIA</text>
    ${art(POLICE_ART[i](THEME.accent))}${title(p.name)}
    <text x="${W / 2}" y="236" text-anchor="middle" ${F} font-weight="800" font-size="54" fill="${THEME.ink}">${p.strength}</text>
    ${tag(W / 2 - 42, 262, 'UNITÀ IN ARRIVO', THEME.muted)}`, `Polizia: ${p.name}, ${p.strength} unità`);
}
