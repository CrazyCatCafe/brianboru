import { move, current, emptyTowns, ownTowns, expandTargets, vikingTowns, newGame } from './game/engine.js';
import { TOWNS, CARDS, REGIONS, PLAYER_COLORS, MARRIAGE_TRACK } from './game/data.js';
import { connect } from './net.js';

const $ = id => document.getElementById(id);
const esc = t => String(t).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const SYM = { T: '🏰 città attiva', C: '+1 🪙', P: '−1 🪙', M: '💍 matrimonio', A: '🪓 predone', X: '✝ chiesa', E: 'espandi (5 🪙)', V: 'togli vichingo' };
const COLOR_IT = { yellow: 'giallo', red: 'rosso', blue: 'blu', white: 'reale' };

let net = null, code = null, room = null; // online
let local = null;                          // stato partita locale
let state = null, me = null;               // stato mostrato e giocatore che agisce da questo schermo
let ui = {};                               // scelte in corso per l'azione

// ---------- avvio ----------
const savedName = localStorage.getItem('bb-name');
if (savedName) $('name').value = savedName;
const config = await import('./firebase-config.js').then(m => m.firebaseConfig).catch(() => null);
if (!config) { $('online-off').hidden = false; ['create', 'join', 'code'].forEach(id => ($(id).disabled = true)); }

async function online() {
  const name = $('name').value.trim();
  if (!name) throw new Error('Scrivi il tuo nome');
  localStorage.setItem('bb-name', name);
  net ??= await connect(config);
  return name;
}
const guard = fn => async (...a) => { try { await fn(...a); } catch (e) { alert(e.message); } };

$('create').onclick = guard(async () => { const name = await online(); enter(await net.create(name), name); });
$('join').onclick = guard(async () => { const name = await online(); enter($('code').value.trim().toUpperCase(), name); });
$('start').onclick = guard(() => net.start(code));
$('local').onclick = guard(() => {
  const names = $('local-names').value.split('\n').map(s => s.trim()).filter(Boolean);
  local = newGame(names);
  show(local);
});

async function enter(c, name) {
  await net.join(c, name);
  code = c;
  location.hash = c;
  net.watch(c, g => {
    room = g;
    if (g.state) { me = g.players.findIndex(p => p.uid === net.uid); show(JSON.parse(g.state)); return; }
    $('room').hidden = false;
    $('room-code').textContent = c;
    $('room-link').textContent = $('room-link').href = location.href;
    $('room-players').innerHTML = g.players.map(p => `<li>${esc(p.name)}</li>`).join('');
    $('start').hidden = g.host !== net.uid || g.players.length < 3;
  });
}
if (location.hash.length > 1 && config) {
  $('code').value = location.hash.slice(1);
  if (savedName) guard(async () => enter(location.hash.slice(1).toUpperCase(), await online()))();
}

async function act(m) {
  try {
    if (local) { local = move(local, me, m); ui = {}; show(local); }
    else { await net.act(code, m); ui = {}; }
  } catch (e) { console.error(e); alert(e.message); }
}

// ---------- rendering ----------
function show(s) {
  state = s;
  $('lobby').hidden = true;
  $('game').hidden = false;
  const pd = current(s);
  if (local) me = !pd ? 0 : pd.type === 'draft' ? s.draft.picks.findIndex(x => !x) : pd.p;
  renderBoard(s, pd);
  renderPrompt(s, pd);
  renderHand(s, pd);
  renderStatus(s);
}

const pc = i => PLAYER_COLORS[i];

function clickable(s, pd) {
  if (!pd || pd.p !== me) return [];
  switch (pd.type) {
    case 'setupTown': return emptyTowns(s).filter(id => !TOWNS.some(o => o.region === TOWNS[id].region && s.towns[o.id].owner !== null && s.towns[o.id].owner !== me));
    case 'activeTown': return emptyTowns(s);
    case 'placeTown': return emptyTowns(s, pd.region);
    case 'loseTown': return ownTowns(s, pd.victim);
    case 'monastery': return ownTowns(s, me).filter(id => !s.towns[id].monastery);
    case 'action': return ui.pickExpand ? expandTargets(s, me) : ui.pickViking ? vikingTowns(s) : [];
  }
  return [];
}

function renderBoard(s, pd) {
  const can = new Set(clickable(s, pd)), active = s.trick?.town;
  $('towns').innerHTML = TOWNS.map(t => {
    const st = s.towns[t.id];
    let g = '';
    if (t.id === active) g += `<circle cx="${t.x}" cy="${t.y}" r="27" class="active-town"/>`;
    if (st.owner !== null) g += `<circle cx="${t.x}" cy="${t.y}" r="13" fill="${pc(st.owner)}" stroke="#fff" stroke-width="3"/>`;
    if (st.monastery) g += `<circle cx="${t.x}" cy="${t.y}" r="20" fill="none" stroke="#fff" stroke-width="4"/>`;
    if (st.viking) g += `<path d="M${t.x - 12} ${t.y - 12}l24 24M${t.x + 12} ${t.y - 12}l-24 24" stroke="#111" stroke-width="6"/>`;
    if (ui.expand === t.id || ui.viking === t.id) g += `<circle cx="${t.x}" cy="${t.y}" r="24" fill="none" stroke="#0f0" stroke-width="5"/>`;
    if (can.has(t.id)) g += `<circle cx="${t.x}" cy="${t.y}" r="22" class="can" data-town="${t.id}"><title>${esc(REGIONS[t.region].name)}</title></circle>`;
    return g;
  }).join('');
}

$('towns').onclick = e => {
  const id = e.target.dataset?.town;
  if (id === undefined) return;
  const town = Number(id), pd = current(state);
  if (pd.type === 'action') {
    if (ui.pickExpand) ui.expand = town; else ui.viking = town;
    ui.pickExpand = ui.pickViking = false;
    show(state);
  } else act({ town });
};

function cardHtml(v, extra = '') {
  const c = CARDS[v];
  const line = syms => syms.map(x => SYM[x]).join(', ');
  return `<button class="card ${c.color}" data-card="${v}" ${extra}>
    <b>${v}</b> <small>${COLOR_IT[c.color]}</small>
    <span>Vinci: ${line(c.primary)}</span>
    ${c.secondary.map(sec => `<span>Perdi: ${line(sec)}</span>`).join('')}
  </button>`;
}

function renderHand(s, pd) {
  if (me < 0 || me === null) { $('hand').innerHTML = ''; return; }
  const hand = s.players[me].hand;
  if (pd?.type === 'draft') {
    const pk = s.draft.packets[me], sel = ui.draft || [];
    $('hand').innerHTML = s.draft.picks[me] ? '' :
      `<p>Scegli 2 carte da tenere (${sel.length}/2):</p>` + pk.map(v => cardHtml(v, sel.includes(v) ? 'aria-pressed="true"' : '')).join('') +
      `<p>Già in mano: ${hand.join(', ') || '—'}</p>` +
      `<button id="draft-ok" ${sel.length === 2 ? '' : 'disabled'}>Conferma scelta</button>`;
    $('hand').querySelectorAll('.card').forEach(b => (b.onclick = () => {
      const v = Number(b.dataset.card);
      ui.draft = sel.includes(v) ? sel.filter(x => x !== v) : [...sel, v].slice(-2);
      renderHand(s, pd);
    }));
    $('draft-ok')?.addEventListener('click', () => act({ cards: ui.draft }));
    return;
  }
  const playing = pd?.type === 'play' && pd.p === me;
  let ok = () => playing;
  if (playing && me === s.trick.leader) {
    const fits = v => [TOWNS[s.trick.town].color, 'white'].includes(CARDS[v].color);
    if (hand.some(fits)) ok = fits;
  }
  $('hand').innerHTML = hand.length ? `<p>La tua mano${local ? ` (${esc(s.players[me].name)})` : ''}:</p>` + hand.map(v => cardHtml(v, ok(v) ? '' : 'disabled')).join('') : '';
  if (playing) $('hand').querySelectorAll('.card').forEach(b => (b.onclick = () => act({ card: Number(b.dataset.card) })));
}

function renderPrompt(s, pd) {
  const el = $('prompt'), who = p => `<span class="dot" style="background:${pc(p)}"></span>${esc(s.players[p].name)}`;
  if (!pd) {
    el.innerHTML = `<h2>Partita finita</h2><p>Vince ${s.winner.map(who).join(' e ')}.</p>`;
    return;
  }
  const trick = s.trick?.plays.length ? `<p>Carte giocate: ${s.trick.plays.map(x => `${who(x.p)} ${x.card}`).join(' · ')}</p>` : '';
  if (pd.type === 'draft') {
    const waiting = s.draft.picks.flatMap((x, i) => (x ? [] : [i]));
    el.innerHTML = `<h2>Draft</h2><p>In attesa di: ${waiting.map(who).join(', ')}</p>`;
    return;
  }
  if (pd.p !== me) { el.innerHTML = `<p>In attesa di ${who(pd.p)}…</p>${trick}`; return; }
  const T = {
    setupTown: () => 'Scegli la tua città di partenza (regione senza altri giocatori).',
    activeTown: () => 'Scegli la città attiva per questa presa.',
    play: () => `Gioca una carta. Città attiva: <b>${COLOR_IT[TOWNS[s.trick.town].color]}</b>.`,
    placeTown: () => `Prendi il controllo di una città libera${pd.region ? ' in ' + REGIONS[pd.region].name : ''}.`,
    loseTown: () => `Scegli quale città di ${pd.victim === me ? 'tua' : esc(s.players[pd.victim].name)} va ai vichinghi.`,
    monastery: () => 'Costruisci un monastero in una tua città.',
  };
  if (T[pd.type]) { el.innerHTML = `<h2>${who(me)}</h2><p>${T[pd.type]()}</p>${trick}`; return; }
  if (pd.type === 'princess') {
    el.innerHTML = `<h2>Principessa di Danimarca</h2>
      <button data-c="military">Supporto militare</button> <button data-c="trade">Commercio</button> <button data-c="spurn">Rifiutala (+4 punti)</button>`;
    el.querySelectorAll('button').forEach(b => (b.onclick = () => act({ choice: b.dataset.c })));
    return;
  }
  // action
  const card = CARDS[pd.card], opts = pd.won ? [['p', card.primary]] : card.secondary.map((x, i) => [i, x]);
  ui.opt ??= opts[0][0];
  const syms = opts.find(o => o[0] === ui.opt)[1];
  const buyable = syms.find(x => 'MAX'.includes(x));
  el.innerHTML = `<h2>${who(me)}: ${pd.won ? 'hai vinto' : 'hai perso'} con ${pd.card}</h2>${trick}
    ${opts.map(([k, sy]) => `<label class="opt"><input type="radio" name="opt" value="${k}" ${k === ui.opt ? 'checked' : ''}> ${sy.map(x => SYM[x]).join(', ')}</label>`).join('')}
    ${buyable ? `<label>Extra (2 🪙 ciascuno): <input id="extra" type="number" min="0" value="${ui.extra || 0}"></label>` : ''}
    ${syms.includes('E') ? `<p><button id="pick-exp">Scegli città per espandersi</button> ${ui.expand != null ? `→ città ${ui.expand} <button id="no-exp">annulla</button>` : '(facoltativo)'}</p>` : ''}
    ${syms.includes('V') && vikingTowns(s).length ? `<p><button id="pick-vik">Scegli città vichinga</button> ${ui.viking != null ? '✓' : ''}</p>` : ''}
    <button id="act-ok">Conferma azione</button>`;
  el.querySelectorAll('[name=opt]').forEach(r => (r.onchange = () => { ui = { opt: r.value === 'p' ? 'p' : Number(r.value) }; show(s); }));
  $('extra')?.addEventListener('change', e => (ui.extra = Number(e.target.value)));
  $('pick-exp')?.addEventListener('click', () => { ui.pickExpand = true; show(s); });
  $('no-exp')?.addEventListener('click', () => { ui.expand = null; show(s); });
  $('pick-vik')?.addEventListener('click', () => { ui.pickViking = true; show(s); });
  $('act-ok').onclick = () => act({ opt: ui.opt, extra: ui.extra || 0, expand: ui.expand ?? null, viking: ui.viking });
}

function renderStatus(s) {
  const mc = s.marriage;
  const mtxt = !mc ? '—' : mc.princess ? 'Principessa di Danimarca' : `${mc.points} punti${mc.region ? ' + città in ' + REGIONS[mc.region].name : ''}${mc.renown ? ' + 1 fama' : ''}`;
  const claims = Object.entries(REGIONS).map(([r, c]) => {
    const cl = s.claims[r];
    return `<li>${esc(c.name)} (${c.threshold}/${c.points}pt): ${!cl.up ? 'coperto' : cl.owner === null ? 'scoperto' : `<span class="dot" style="background:${pc(cl.owner)}"></span>${esc(s.players[cl.owner].name)}`}</li>`;
  }).join('');
  $('status').innerHTML = `<p>Round ${s.round}${s.final ? ' (ultimo)' : ''} · Predoni nell'area: <b>${s.area}</b> · Matrimonio in palio: <b>${mtxt}</b></p>
    <details><summary>Segnalini regione</summary><ul>${claims}</ul></details>`;
  $('players').innerHTML = `<tr><th>Giocatore</th><th title="Punti">Pt</th><th title="Monete">🪙</th><th title="Fama">☀</th><th title="Predoni">🪓</th><th title="Dischi chiesa">✝</th><th title="Tracciato matrimoni">💍</th><th title="Mano">🂠</th></tr>` +
    s.players.map((pl, i) => `<tr${i === s.active ? ' class="marker" title="Ha il segnalino città attiva"' : ''}>
      <td><span class="dot" style="background:${pc(i)}"></span>${esc(pl.name)}${i === s.active ? ' ★' : ''}${pl.princess ? ' 👸' : ''}</td>
      <td>${pl.points}</td><td>${pl.coins}</td><td>${pl.renown}</td><td>${pl.raiders}</td><td>${pl.church}</td>
      <td>${pl.mar + 1}${MARRIAGE_TRACK[pl.mar] ? '*' : ''}</td><td>${pl.hand.length}</td></tr>`).join('');
  $('log').innerHTML = [...s.log].reverse().map(l => `<li>${esc(l)}</li>`).join('');
}
