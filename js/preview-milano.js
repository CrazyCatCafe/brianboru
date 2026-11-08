// Anteprima Milano: stato di partita finto mostrato sulla città 3D, HUD con tutti i segnalini, mano completa.
import { CARDS } from './game/data.js';
import { THEME } from './milano/theme.js';
import { cardSVG } from './milano/card.js';
import { icon } from './milano/icons.js';
import { createCity } from './milano/city3d.js';

const $ = id => document.getElementById(id);
const close = /[?&]view=close/.test(location.search); // inquadratura ravvicinata sul centro
const city = await createCity($('city'), $('labels'), close ? { camera: [1.6, 1.9, 2.6], target: [0.6, 0, 0.3] } : {});
$('loading').remove();
const T = city.towns, idx = Object.fromEntries(T.map((t, i) => [t.id, i]));

// --- partita finta, metà del secondo round ---
const players = [
  { name: 'Luigi', points: 17, coins: 4, renown: 2, raiders: 3, church: 2, mar: 4, hand: 6 },
  { name: 'Giulia', points: 21, coins: 1, renown: 3, raiders: 0, church: 4, mar: 6, hand: 5 },
  { name: 'Marco', points: 14, coins: 7, renown: 1, raiders: 5, church: 0, mar: 1, hand: 5 },
  { name: 'Sara', points: 16, coins: 2, renown: 2, raiders: 1, church: 1, mar: 2, hand: 5 },
];
const own = { 0: ['S1', 'S2', 'L3', 'L4', 'M2'], 1: ['N2', 'N5', 'B1', 'C3', 'S4'], 2: ['C1', 'C4', 'C6', 'M5', 'M7'], 3: ['U1', 'U3', 'D2', 'L7'] };
const towns = T.map(() => ({ owner: null, viking: false, monastery: false }));
for (const [p, ids] of Object.entries(own)) ids.forEach(id => (towns[idx[id]].owner = +p));
towns[idx.S2].monastery = towns[idx.N5].monastery = true;
towns[idx.C4].viking = true;
const claims = { SUN: 0, NUN: 1 };
const s = { towns, activeTown: T.findIndex((t, i) => t.region === 'SUN' && t.suit === 'red' && towns[i].owner === null) };
city.update(s);

const ME = 0, active = T[s.activeTown], suit = THEME.suit[active.suit];
const hand = [2, 5, 11, 13, 16, 24];
const trick = [{ p: 1, card: 15 }, { p: 2, card: 8 }];

// --- HUD giocatori: tutto ciò che prima stava sul tabellone ---
const stat = (sym, v, label) => `<span class="stat" title="${label}">${icon(sym, 15)}<b>${v}</b></span>`;
$('players').innerHTML = players.map((pl, i) => {
  const terr = Object.entries(claims).filter(([, o]) => o === i).map(([r]) => `<span class="terr" style="--rc:${THEME.region[r]}">${city.regions[r].name}</span>`).join('');
  return `<li class="pl${i === ME ? ' me' : ''}${i === 0 ? ' turn' : ''}" style="--pc:${THEME.players[i]}">
    <span class="sw"></span>
    <span class="nm">${pl.name}${i === ME ? '<small>tu</small>' : ''}${i === 1 ? '<span class="mk" title="Segnalino città attiva">▲</span>' : ''}</span>
    <span class="pts">${pl.points}</span>
    <span class="row">${stat('C', pl.coins, 'Crediti')}${stat('R', pl.renown, 'Fama')}${stat('A', pl.raiders, 'Predoni')}${stat('X', pl.church, 'Influenza')}${stat('M', pl.mar + 1, 'Tracciato alleanze')}<span class="stat" title="Carte in mano"><svg viewBox="0 0 40 40" width="15" height="15"><rect x="9" y="5" width="22" height="30" fill="none" stroke="currentColor" stroke-width="4"/></svg><b>${pl.hand}</b></span></span>
    ${terr ? `<span class="row terrs">${terr}</span>` : ''}
  </li>`;
}).join('');

$('round').innerHTML = `<div><span>Round</span><b>2</b><em>/4</em></div>
  <div><span>Predoni in arrivo</span><b>${icon('A', 18)} 9</b></div>
  <div><span>Alleanza in palio</span><b>+2 ${icon('R', 18)} · NORD</b></div>`;

$('prompt').innerHTML = `<p class="kicker">Tocca a te</p>
  <h2>Gioca una carta</h2>
  <p>Città attiva: <b class="chip" style="--sc:${suit.fill};--si:${suit.ink}">${active.name}</b> · ${city.regions[active.region].name}.</p>
  <p>Vince la carta più alta <b>${suit.name.toLowerCase()}</b> o jolly.</p>`;

$('trick').innerHTML = `<p class="kicker">Presa in corso</p><div>${trick.map(t => `<figure style="--pc:${THEME.players[t.p]}">${cardSVG(t.card, { width: 120 })}<figcaption>${players[t.p].name}</figcaption></figure>`).join('')}</div>`;

const ok = c => [active.suit, 'white'].includes(CARDS[c].color);
$('hand').innerHTML = hand.map(c => `<button class="card${ok(c) ? '' : ' off'}" ${ok(c) ? '' : 'aria-disabled="true"'}>${cardSVG(c, { width: 200 })}</button>`).join('');
