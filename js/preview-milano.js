// Anteprima Milano 2077: stato di partita finto sulla città 3D, HUD con tutti i segnalini, mano completa.
import { CARDS } from './game/data.js';
import { THEME, THEME_NEON } from './milano/theme.js';
import { cardSVG, characterSVG, policeSVG } from './milano/card.js';
import { icon, ICON_SETS, setIconSet, iconSet } from './milano/icons.js';
import { createCity, WEATHER_TYPES } from './milano/city3d.js';

const $ = id => document.getElementById(id);
const q = new URLSearchParams(location.search);
setIconSet(q.get('icone') || 'pieno');
// ?quartieri=anello|esagono|rombo: proposte di forma per i quartieri liberi e presi
const city = await createCity($('city'), $('labels'), { markers: q.get('quartieri') || 'disco', areas: q.get('aree'), ...(q.get('stile') === 'neon' ? { theme: THEME_NEON } : {}), ...(q.get('view') === 'close' ? { camera: [1.6, 1.9, 2.6], target: [0.6, 0, 0.3] } : {}) });
$('loading').remove();
const T = city.towns, idx = Object.fromEntries(T.map((t, i) => [t.id, i]));

// --- partita finta, metà del secondo round ---
const players = [
  { name: 'Luigi', gang: 'Technoborghesi', points: 17, coins: 4, renown: 2, raiders: 3, church: 2, mar: 4, hand: 6 },
  { name: 'Giulia', gang: 'Punk', points: 21, coins: 1, renown: 3, raiders: 0, church: 4, mar: 6, hand: 5 },
  { name: 'Marco', gang: 'Technoborghesi', points: 14, coins: 7, renown: 1, raiders: 5, church: 0, mar: 1, hand: 5 },
  { name: 'Sara', gang: 'Punk', points: 16, coins: 2, renown: 2, raiders: 1, church: 1, mar: 2, hand: 5 },
];
const own = { 0: ['S1', 'S2', 'L3', 'L4', 'M2'], 1: ['N2', 'N5', 'B1', 'C3', 'S4'], 2: ['C1', 'C4', 'C6', 'M5', 'M7'], 3: ['U1', 'U3', 'D2', 'L7'] };
const towns = T.map(() => ({ owner: null, viking: false, monastery: false }));
for (const [p, ids] of Object.entries(own)) ids.forEach(id => (towns[idx[id]].owner = +p));
towns[idx.S2].monastery = towns[idx.N5].monastery = true;
towns[idx.C4].viking = towns[idx.S4].viking = true;
const claims = { SUN: 0, NUN: 1 };
const s = { towns, activeTown: T.findIndex((t, i) => t.region === 'SUN' && t.suit === 'red' && towns[i].owner === null) };
city.update(s);
city.select(s.activeTown); // nella partita vera: il quartiere scelto dal giocatore
if (!q.get('quartieri') && !q.get('aree')) city.setClickable(T.map((_, i) => i), i => city.select(i)); // nelle proposte niente anelli di scelta, per vedere solo liberi e presi
if (q.get('meteo')) city.setWeather(q.get('meteo'));
else setInterval(() => { // nel gioco il meteo cambierà a ogni round; qui ogni 40 s
  const keys = Object.keys(WEATHER_TYPES).filter(k => k !== city.weather());
  city.setWeather(keys[Math.floor(Math.random() * keys.length)]); render();
}, 40000);

const ME = 0, active = T[s.activeTown], suit = THEME.suit[active.suit];
const hand = [2, 5, 11, 13, 16, 24];
const trick = [{ p: 1, card: 15 }, { p: 2, card: 8 }];

function render() {
  const stat = (sym, v, label) => `<span class="stat" title="${label}">${icon(sym, 15)}<b>${v}</b></span>`;
  $('players').innerHTML = players.map((pl, i) => {
    const terr = Object.entries(claims).filter(([, o]) => o === i).map(([r]) => `<span class="terr" style="--rc:${THEME.region[r]}">${city.regions[r].name}</span>`).join('');
    return `<li class="pl${i === 0 ? ' turn' : ''}" style="--pc:${THEME.players[i]}">
      <span class="sw"></span>
      <span class="nm">${pl.name}${i === ME ? '<small>tu</small>' : ''}${i === 1 ? '<span class="mk" title="Ha il segnalino quartiere attivo">▲</span>' : ''}<em>${pl.gang}</em></span>
      <span class="pts">${pl.points}</span>
      <span class="row">${stat('C', pl.coins, 'Crediti')}${stat('R', pl.renown, 'Street cred')}${stat('A', pl.raiders, 'Unità di polizia neutralizzate')}${stat('X', pl.church, 'Comunità')}${stat('M', pl.mar + 1, 'Hype')}<span class="stat" title="Carte in mano"><svg viewBox="0 0 40 40" width="15" height="15"><rect x="9" y="5" width="22" height="30" fill="none" stroke="currentColor" stroke-width="4"/></svg><b>${pl.hand}</b></span></span>
      ${terr ? `<span class="row terrs">${terr}</span>` : ''}
    </li>`;
  }).join('');

  $('round').innerHTML = `<div><span>Round</span><b>2</b><em>/4</em></div>
    <div class="peek"><span>Polizia in arrivo</span><b>${icon('A', 18)} 9</b><figure>${policeSVG(1)}</figure></div>
    <div class="peek"><span>Personaggio da ingaggiare</span><b>+2 · NORD</b><figure>${characterSVG(4)}</figure></div>
`;
  $('tools').innerHTML = `<div class="sets"><span>Meteo</span><b>${Object.entries(WEATHER_TYPES).map(([k, v]) => `<button data-meteo="${k}" aria-pressed="${k === city.weather()}">${v}</button>`).join('')}</b></div>
<div class="sets"><span>Icone</span><b>${Object.entries(ICON_SETS).map(([k, v]) => `<button data-set="${k}" aria-pressed="${k === iconSet()}">${v.name}</button>`).join('')}</b></div>`;
  $('tools').querySelectorAll('[data-set]').forEach(b => (b.onclick = () => { setIconSet(b.dataset.set); render(); }));
  $('tools').querySelectorAll('[data-meteo]').forEach(b => (b.onclick = () => { city.setWeather(b.dataset.meteo); render(); }));

  $('prompt').innerHTML = `<p class="kicker">Tocca a te</p>
    <h2>Gioca una storia</h2>
    <p>Quartiere attivo: <b class="chip" style="--sc:${suit.fill};--si:${suit.ink}">${active.name}</b> · ${city.regions[active.region].name}.</p>
    <p>Vince la carta più alta <b>${suit.name.toLowerCase()}</b> o di Briano Borro.</p>`;

  $('trick').innerHTML = `<p class="kicker">Presa in corso</p><div>${trick.map(t => `<figure style="--pc:${THEME.players[t.p]}">${cardSVG(t.card)}<figcaption>${players[t.p].name}</figcaption></figure>`).join('')}</div>`;

  const ok = c => [active.suit, 'white'].includes(CARDS[c].color);
  $('hand').innerHTML = hand.map(c => `<button class="card${ok(c) ? '' : ' off'}" ${ok(c) ? '' : 'aria-disabled="true"'}>${cardSVG(c)}</button>`).join('');
}
render();
