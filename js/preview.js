// Anteprima statica: una partita a metà, giocata in automatico, mostrata con il nuovo tavolo 3D e la mano in basso.
import { newGame, move, current, emptyTowns } from './game/engine.js';
import { TOWNS, CARDS, REGIONS } from './game/data.js';
import { THEME } from './ui/theme.js';
import { cardSVG } from './ui/card.js';
import { icon } from './ui/icons.js';
import { createTable } from './ui/scene.js';

const $ = id => document.getElementById(id);
const esc = t => String(t).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

// --- partita finta: setup, draft e qualche presa con mosse casuali, fino al turno di "Luigi" ---
let rnd = 7; const r = n => ((rnd = (rnd * 16807) % 2147483647) % n);
let s = newGame(['Luigi', 'Máel', 'Sitric', 'Aoife'], 11);
const ME = 0;
for (let k = 0; k < 400; k++) {
  const pd = current(s);
  if (pd.type === 'play' && pd.p === ME && s.round === 1 && s.trick.plays.length >= 2 && s.players[ME].hand.length <= 5) break;
  const free = emptyTowns(s), pick = a => a[r(a.length)];
  if (pd.type === 'draft') { const p = s.draft.picks.findIndex(x => !x); s = move(s, p, { cards: s.draft.packets[p].slice(0, 2) }); continue; }
  const m = {
    setupTown: () => ({ town: pick(free.filter(id => !TOWNS.some(o => o.region === TOWNS[id].region && s.towns[o.id].owner !== null))) }),
    activeTown: () => ({ town: pick(free) }),
    play: () => {
      const hand = s.players[pd.p].hand, col = TOWNS[s.trick.town].color;
      const fit = hand.filter(c => CARDS[c].color === col || CARDS[c].color === 'white');
      return { card: pd.p === s.trick.leader && fit.length ? fit[0] : pick(hand) };
    },
    action: () => ({ opt: pd.won ? 'p' : CARDS[pd.card].secondary.length - 1, extra: 0 }),
  }[pd.type];
  s = move(s, pd.p, m ? m() : { town: pick(free) });
}

// --- tavolo 3D ---
const table = await createTable($('table'));
table.update(s);

// --- HUD ---
const stat = (sym, v, label) => `<span class="stat" title="${label}">${icon(sym, 18)}<b>${v}</b></span>`;
$('players').innerHTML = s.players.map((pl, i) => `
  <li class="player${i === ME ? ' me' : ''}${current(s).p === i ? ' turn' : ''}" style="--pc:${THEME.players[i]}">
    <span class="pname">${esc(pl.name)}${i === s.active ? ' <span class="badge" title="Segnalino città attiva">◆</span>' : ''}</span>
    <span class="pts">${pl.points}</span>
    <span class="stats">${stat('C', pl.coins, 'Monete')}${stat('R', pl.renown, 'Fama')}${stat('A', pl.raiders, 'Predoni')}${stat('X', pl.church, 'Chiesa')}</span>
    <span class="cards" title="Carte in mano">${pl.hand.length}</span>
  </li>`).join('');

const mc = s.marriage;
$('round').innerHTML = `<span class="label">Round</span> <b>${s.round}</b>/4
  <span class="sep"></span>${icon('A', 20)} <b>${s.area}</b> predoni
  <span class="sep"></span>${icon('M', 20)} ${mc.princess ? 'Principessa di Danimarca' : `<b>${mc.points}</b> punti${mc.region ? ' + ' + REGIONS[mc.region].name : ''}`}`;

const town = TOWNS[s.trick.town], suit = THEME.suit[town.color];
$('prompt').innerHTML = `<p class="kicker">Tocca a te</p>
  <h2>Gioca una carta</h2>
  <p>La città attiva è <b style="color:${suit.fill}">${suit.name.toLowerCase()}</b> in ${REGIONS[town.region].name}. La carta più alta di quel colore (o reale) vince la presa.</p>`;

$('trick').innerHTML = s.trick.plays.map(p => `<figure style="--pc:${THEME.players[p.p]}">${cardSVG(p.card, { width: 92 })}<figcaption>${esc(s.players[p.p].name)}</figcaption></figure>`).join('');

const hand = s.players[ME].hand;
const playable = c => [town.color, 'white'].includes(CARDS[c].color);
$('hand').innerHTML = hand.map((c, i) => {
  const mid = (hand.length - 1) / 2, a = (i - mid) * 6, y = Math.abs(i - mid) ** 2 * 5;
  return `<button class="hcard${playable(c) || s.trick.leader !== ME ? '' : ' off'}" style="--a:${a}deg;--y:${y}px;--i:${i}">${cardSVG(c, { width: 170 })}</button>`;
}).join('');
