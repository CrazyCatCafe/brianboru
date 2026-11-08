// Mockup della plancia in stile REPLACED (schizzo del 08/11): stato di partita finto, solo per vedere l'aspetto.
import { CARDS, MARRIAGE_TRACK } from './game/data.js';
import { THEME } from './milano/theme.js';
import { cardSVG } from './milano/card.js';
import { icon } from './milano/icons.js';
import { createCity } from './milano/city3d.js';

const $ = id => document.getElementById(id);
const q = new URLSearchParams(location.search);

// Tema 3D REPLACED: nebbia grigia, terreno bagnato e scuro, edifici chiari, luce bassa; reso a bassa risoluzione (pixel art)
const REPLACED = {
  sky: ['#b3bbc1', '#a3acb2'], fog: { color: '#a7b0b6', range: [10, 26] },
  ground: { city: '#868f95', outside: '#626a70' }, building: { city: '#e6eaec', outside: '#8f979c' },
  park: '#737c82', rural: '#56604f', water: '#6fd0ff',
  light: { hemi: 0.95, sun: 0.85, sky: '#f0f4f6', ground: '#5c656c', sunColor: '#fff0dc', sunPos: [-7, 6, 2] },
};
const city = await createCity($('city'), $('labels'), {
  theme: REPLACED, pixel: +(q.get('pixel') || 0.5),
  ...(q.get('view') === 'close' ? { camera: [1.6, 1.9, 2.6], target: [0.6, 0, 0.3] } : {}),
});
city.setWeather(q.get('meteo') || 'pioggia');
$('loading').remove();
const T = city.towns, idx = Object.fromEntries(T.map((t, i) => [t.id, i]));

// --- partita finta: upkeep del round 2, fase Guerrilla ---
const players = [
  { name: 'Luigi', points: 17, coins: 4, raiders: 3, church: 2, mar: 4 },
  { name: 'Giulia', points: 21, coins: 1, raiders: 0, church: 4, mar: 6 },
  { name: 'Elisa', points: 14, coins: 7, raiders: 5, church: 1, mar: 1 },
];
const own = { 0: ['S1', 'S2', 'L3', 'L4', 'M2'], 1: ['N2', 'N5', 'B1', 'C3', 'S4'], 2: ['C1', 'C4', 'C6', 'M5', 'M7'] };
const towns = T.map(() => ({ owner: null, viking: false, monastery: false }));
for (const [p, ids] of Object.entries(own)) ids.forEach(id => (towns[idx[id]].owner = +p));
towns[idx.S2].monastery = towns[idx.N5].monastery = true;
towns[idx.C4].viking = true;
const active = T.findIndex((t, i) => t.region === 'SUN' && t.suit === 'red' && towns[i].owner === null);
city.update({ towns, activeTown: active });
const police = 8, phase = q.get('fase') || 'guerrilla';
const zones = { SUN: 0, NUN: 1, CON: null }; // in palio: chi le controlla (null = contesa)

const PHASES = [['prep', 'Preparazione'], ['draft', 'Draft'], ['trick', 'Azioni'], ['party', 'Underground Party'], ['guerrilla', 'Guerrilla'], ['community', 'Community Projects'], ['uprising', 'Uprising']];
const dot = i => `<i class="pd" style="--pc:${THEME.players[i]}"></i>`;
const nameOf = i => `${dot(i)}<b>${players[i].name}</b>`;
const asc = key => players.map((p, i) => i).sort((a, b) => players[a][key] - players[b][key]); // ordine crescente, come nello schizzo

function render() {
  // barra in alto: frecce delle fasi
  $('phases').innerHTML = PHASES.map(([k, l]) => `<span class="chev${k === phase ? ' on' : ''}${['party', 'guerrilla', 'community', 'uprising'].includes(k) ? ' up' : ''}">${l}</span>`).join('');

  // giocatori: solo crediti e punti
  $('b-players').innerHTML = `<h3>Bande</h3><ul>${players.map((p, i) => `<li>${nameOf(i)}<span class="num" title="Crediti">${icon('C', 14, 'currentColor', '#0f1316')}${p.coins}</span><span class="num pts" title="Punti">${p.points}</span></li>`).join('')}</ul>`;

  // underground party: solo caselle, niente numeri
  $('b-party').className = `box${phase === 'party' ? ' on' : ''}`;
  $('b-party').innerHTML = `<h3>Underground Party <em>Hype</em></h3><div class="cells">${MARRIAGE_TRACK.map((b, c) =>
    `<span class="cell" title="${b ? { C: '+1 credito', CC: '+2 crediti', R: '+1 street cred', T: 'un quartiere' }[b] : 'nessun bonus'}">${players.map((p, i) => (p.mar === c ? dot(i) : '')).join('')}</span>`).join('')}</div>`;

  // guerrilla: polizia totale, bande in ordine crescente di unità neutralizzate
  $('b-guerrilla').className = `box${phase === 'guerrilla' ? ' on' : ''}`;
  $('b-guerrilla').innerHTML = `<h3>Guerrilla</h3><p class="big">${icon('A', 18, 'currentColor')} <span>Polizia</span> <b>${police}</b></p>
    <ol>${asc('raiders').map(i => `<li>${nameOf(i)}<span class="num">${players[i].raiders}</span></li>`).join('')}</ol>`;

  // community projects: bande in ordine crescente di comunità
  $('b-community').className = `box${phase === 'community' ? ' on' : ''}`;
  $('b-community').innerHTML = `<h3>Community Projects</h3>
    <ol>${asc('church').map(i => `<li>${nameOf(i)}<span class="num">${icon('X', 13, 'currentColor')}${players[i].church}</span></li>`).join('')}</ol>`;

  // uprising: zone sbloccate e chi le tiene
  $('b-uprising').className = `box${phase === 'uprising' ? ' on' : ''}`;
  $('b-uprising').innerHTML = `<h3>Uprising <em>zone in palio</em></h3>
    <ul>${Object.entries(zones).map(([r, o]) => `<li><i class="rz" style="--rc:${THEME.region[r]}"></i><b>${city.regions[r].name}</b><span class="own">${o === null ? 'contesa' : nameOf(o)}</span></li>`).join('')}</ul>`;

  // centro: racconto della fase in corso
  $('stage').innerHTML = `<p class="kicker">Guerrilla · 2/4</p><h2>Retata!</h2>
    <p>${police} unità di polizia in allerta. Chi ne ha neutralizzate meno perde un quartiere:</p>
    <p>${nameOf(1)} perde un quartiere, sceglie ${nameOf(2)}.</p>
    <div class="row end"><button class="btn ghost small">Salta</button><button class="btn small">Avanti ›</button></div>`;
  $('turn').innerHTML = `<p class="kicker">Turno</p><p class="big">${nameOf(2)}</p><p class="sub">Round 2/3 · Pioggia</p>`;

  const hand = [2, 5, 11, 13, 16, 24];
  $('hand').innerHTML = hand.map(c => `<button class="card">${cardSVG(c)}</button>`).join('');
}
render();
