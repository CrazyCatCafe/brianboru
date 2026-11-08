// Mockup della plancia in stile REPLACED (schizzo del 08/11): stato di partita finto, solo per vedere l'aspetto.
import { CARDS, MARRIAGE_TRACK } from './game/data.js';
import { THEME, THEME_REPLACED as REPLACED, THEME_HOLO, THEME_METRO, PIXEL_SCALE } from './milano/theme.js';
import { cardSVG } from './milano/card.js';
import { icon, logo } from './milano/icons.js';
import { createCity } from './milano/city3d.js';

const $ = id => document.getElementById(id);
const q = new URLSearchParams(location.search);

// ?stile=holo | metro: le due alternative alla città pixel, senza pixel
const stile = q.get('stile');
document.body.classList.toggle('noscan', !!stile);
const city = await createCity($('city'), $('labels'), {
  areas: q.get('aree'), markers: q.get('quartieri') || 'disco', theme: { holo: THEME_HOLO, metro: THEME_METRO }[stile] || REPLACED,
 pixel: stile ? 0 : +(q.get('pixel') || PIXEL_SCALE),
  ...(stile === 'metro' ? { camera: [0.3, 12.5, 4.2], target: [0.2, 0, 0.7] } : {}),
  ...(q.get('view') === 'close' ? { camera: [1.6, 1.9, 2.6], target: [0.6, 0, 0.3] } : {}),
});
city.setWeather(q.get('meteo') || (stile ? 'sereno' : 'pioggia'));
$('loading').remove();
// interruttore del pixel (nel gioco andrà nel riquadro strumenti, ricordato sul dispositivo)
const pxBtn = document.createElement('button'); pxBtn.className = 'btn small pxtoggle';
const pxOn = () => !!+(q.get('pixel') ?? PIXEL_SCALE) && !stile;
let px = pxOn();
const pxLabel = () => (pxBtn.textContent = px ? 'Pixel: sì' : 'Pixel: no');
pxBtn.onclick = () => { px = !px; city.setPixel(px ? +(q.get('pixel') || PIXEL_SCALE) : 0); document.body.classList.toggle('noscan', !px); pxLabel(); };
pxLabel(); document.body.append(pxBtn);
const T = city.towns, idx = Object.fromEntries(T.map((t, i) => [t.id, i]));

// --- partita finta: upkeep del round 2, fase Guerrilla ---
const players = [
  { name: 'Luigi', points: 17, coins: 4, raiders: 3, church: 2, mar: 4 },
  { name: 'Giulia', points: 21, coins: 1, raiders: 0, church: 4, mar: 6 },
  { name: 'Massimiliano', points: 14, coins: 7, raiders: 5, church: 1, mar: 1 },
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
  $('b-guerrilla').innerHTML = `<h3>${logo('guerrilla')}Guerrilla</h3><p class="big">${icon('A', 18, 'currentColor')} <span>Polizia</span> <b>${police}</b></p>
    <ol>${asc('raiders').map(i => `<li>${nameOf(i)}<span class="num">${players[i].raiders}</span></li>`).join('')}</ol>`;

  // community projects: bande in ordine crescente di comunità
  $('b-community').className = `box${phase === 'community' ? ' on' : ''}`;
  $('b-community').innerHTML = `<h3>${logo('community')}Community Projects</h3>
    <ol>${asc('church').map(i => `<li>${nameOf(i)}<span class="num">${icon('X', 13, 'currentColor')}${players[i].church}</span></li>`).join('')}</ol>`;

  // uprising: zone sbloccate e chi le tiene
  $('b-uprising').className = `box${phase === 'uprising' ? ' on' : ''}`;
  $('b-uprising').innerHTML = `<h3>${logo('uprising')}Uprising <em>zone in palio</em></h3>
    <ul>${Object.entries(zones).map(([r, o]) => `<li><i class="rz" style="--rc:${THEME.region[r]}"></i><b>${city.regions[r].name}</b><span class="own">${o === null ? 'contesa' : nameOf(o)}</span></li>`).join('')}</ul>`;

  // prova: un'unica griglia in alto (bande × Punti, Crediti, Guerrilla, Community) con sotto la track dell'Hype
  if (q.get('plancia') === 'griglia') renderGrid();
  if (q.get('plancia') === 'colonne') renderColumns();

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

function renderGrid() {
  document.body.classList.add('griglia');
  let g = $('grid');
  if (!g) { g = document.createElement('section'); g.id = 'grid'; g.className = 'box topgrid'; g.setAttribute('aria-label', 'Bande'); document.body.append(g); }
  const col = k => (phase === k ? ' class="on"' : '');
  const BONUS = { C: '+1 credito', CC: '+2 crediti', R: '+1 street cred', T: 'un quartiere' };
  g.innerHTML = `<table>
    <thead><tr><th>Banda</th><th>Punti</th><th>${icon('C', 14, '#ffc20e', '#0f1316')} Crediti</th><th${col('guerrilla')}>${logo('guerrilla', 14)} Guerrilla</th><th${col('community')}>${logo('community', 14)} Community</th></tr></thead>
    <tbody>${players.map((p, i) => `<tr><td><span class="nm">${nameOf(i)}</span></td><td class="pts">${p.points}</td><td>${p.coins}</td><td${col('guerrilla')}>${p.raiders}</td><td${col('community')}>${p.church}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="3"></td><td${col('guerrilla')}>${icon('A', 13, 'currentColor', '#0f1316')} polizia <b>${police}</b></td><td${col('community')}></td></tr></tfoot>
  </table>
  <div class="hype${phase === 'party' ? ' on' : ''}"><span class="lab">Hype</span><div class="cells">${MARRIAGE_TRACK.map((b, c) =>
    `<span class="cell${b ? ' bonus' : ''}" title="Casella ${c + 1}: ${b ? BONUS[b] : 'nessun bonus'}"><span class="g">${b ? icon(b === 'CC' ? 'C' : b, 11, 'currentColor', '#0f1316') + (b === 'CC' ? '<sup>2</sup>' : '') : ''}</span>${players.map((pl, i) => (pl.mar === c ? dot(i) : '')).join('')}</span>`).join('')}</div>
    <span class="who">Conte Galleria</span></div>`;
  const fit = () => document.documentElement.style.setProperty('--gh', g.offsetHeight + 'px');
  fit(); new ResizeObserver(fit).observe(g); // l'altezza cambia quando arrivano i font
}

// prova 2: griglia verticale a sinistra. Colonne = bande, righe = solo loghi (Punti, Crediti, Guerrilla, Community, Polizia); accanto l'Hype in verticale.
// Il tastino ingrandisce: nelle colonne compare il nome, tagliato con un punto se troppo lungo.
var bigGrid; // var: render() parte prima di questa riga, il valore iniziale lo mette renderColumns()
var MAXN = 7; // caratteri massimi per colonna da ingrandita
function short(n) { return n.length > (MAXN || 7) ? n.slice(0, (MAXN || 7) - 1) + '.' : n; }
function renderColumns() {
  document.body.classList.add('colonne'); bigGrid ??= q.has('grande');
  const g = $('b-players');
  g.classList.toggle('big', bigGrid);
  const row = (kind, key, k) => `<tr${phase === k ? ' class="on"' : ''}><th>${logo(kind, 16)}</th>${players.map(p => `<td${key === 'points' ? ' class="pts"' : ''}>${p[key]}</td>`).join('')}</tr>`;
  const BONUS = { C: '+1 credito', CC: '+2 crediti', R: '+1 street cred', T: 'un quartiere' };
  g.innerHTML = `<button class="zoom" aria-pressed="${bigGrid}" title="${bigGrid ? 'Rimpicciolisci' : 'Ingrandisci'}">${bigGrid ? '−' : '+'}</button><div class="vgrid"><table>
    <thead><tr><th></th>${players.map((p, i) => `<th><span class="ini" style="--pc:${THEME.players[i]}" title="${p.name}">${bigGrid ? short(p.name) : p.name[0]}</span></th>`).join('')}</tr></thead>
    <tbody>${row('punti', 'points')}${row('crediti', 'coins')}${row('guerrilla', 'raiders', 'guerrilla')}${row('community', 'church', 'community')}</tbody>
    <tfoot><tr${phase === 'guerrilla' ? ' class="on"' : ''}><th>${logo('polizia', 16)}</th><td colspan="${players.length}">${police}</td></tr></tfoot>
  </table>
  <div class="vhype${phase === 'party' ? ' on' : ''}" title="Hype: Conte Galleria">${MARRIAGE_TRACK.map((b, c) => [b, c]).reverse().map(([b, c]) =>
    `<span class="vc${b ? ' bonus' : ''}" title="Casella ${c + 1}: ${b ? BONUS[b] : 'nessun bonus'}"><span class="g">${b ? icon(b === 'CC' ? 'C' : b, 10, 'currentColor', '#0f1316') + (b === 'CC' ? '<sup>2</sup>' : '') : ''}</span>${players.map((pl, i) => (pl.mar === c ? dot(i) : '')).join('')}</span>`).join('')}</div></div>`;
  g.querySelector('.zoom').onclick = () => { bigGrid = !bigGrid; renderColumns(); };
}
