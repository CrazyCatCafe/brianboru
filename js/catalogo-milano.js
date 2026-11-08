// Catalogo: i 4 set di icone a confronto e tutte le carte (storie, personaggi, polizia).
import { CARDS } from './game/data.js';
import { cardSVG, characterSVG, policeSVG } from './milano/card.js';
import { icon, ICON_SETS, setIconSet, iconSet } from './milano/icons.js';
import { SYMBOLS, CHARACTERS, POLICE, SUIT_NAMES } from './milano/lore.js';

const $ = id => document.getElementById(id);
const bySuit = c => Object.keys(CARDS).map(Number).filter(v => CARDS[v].color === c);

function render() {
  $('sets').innerHTML = Object.entries(ICON_SETS).map(([k, v]) => `<button data-set="${k}" aria-pressed="${k === iconSet()}">${v.name}</button>`).join('');
  $('sets').querySelectorAll('button').forEach(b => (b.onclick = () => { setIconSet(b.dataset.set); render(); }));
  const keep = iconSet();
  const sets = Object.entries(ICON_SETS).map(([k, v]) => {
    setIconSet(k);
    return `<section class="iconset${k === keep ? ' on' : ''}"><h3>${v.name}</h3><ul>${Object.entries(SYMBOLS).map(([s, d]) =>
      `<li>${icon(s, 40, '#111')}<span>${d}</span></li>`).join('')}</ul></section>`;
  }).join('');
  setIconSet(keep);
  const grid = (title, items) => `<h2>${title}</h2><div class="grid">${items.join('')}</div>`;
  $('catalog').innerHTML = `<h2>Set di icone</h2><div class="sets-grid">${sets}</div>` +
    ['red', 'blue', 'yellow', 'white'].map(c => grid(SUIT_NAMES[c], bySuit(c).map(v => `<div class="cat-card">${cardSVG(v)}</div>`))).join('') +
    grid('Personaggi', [...CHARACTERS.map((_, i) => characterSVG(i)), characterSVG('estrid')].map(s => `<div class="cat-card">${s}</div>`)) +
    grid('Polizia', POLICE.map((_, i) => `<div class="cat-card">${policeSVG(i)}</div>`));
}
render();
