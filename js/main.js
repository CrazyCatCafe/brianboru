// Brian Boru · Milano 2077: accesso, lobby, amici e partita (online o locale).
import { move as applyMove, current, emptyTowns, ownTowns, expandTargets, vikingTowns, newGame } from './game/engine.js';
import { CARDS, MARRIAGES, TOWNS, REGIONS } from './game/data.js';
import { THEME } from './milano/theme.js';
import { cardSVG, characterSVG } from './milano/card.js';
import { icon, setIconSet } from './milano/icons.js';
import { STORIES, ESTRID, SYMBOLS } from './milano/lore.js';
import { createCity, WEATHER_TYPES } from './milano/city3d.js';
import { connect } from './milano/online.js';

setIconSet('pieno');
const $ = id => document.getElementById(id);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const SCREENS = ['auth', 'nick', 'lobby', 'game'];
const show = name => { SCREENS.forEach(s => ($(s).hidden = s !== name)); $('loading').hidden = true; };
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 4500); }
const guard = fn => async (...a) => { try { await fn(...a); } catch (e) { console.error(e); toast(friendly(e)); } };
function friendly(e) {
  const c = e.code || '';
  return { 'auth/invalid-credential': 'Email o password errate', 'auth/wrong-password': 'Password errata', 'auth/user-not-found': 'Account inesistente',
    'auth/email-already-in-use': 'Email già registrata: usa Accedi', 'auth/weak-password': 'Password troppo corta (almeno 6 caratteri)',
    'auth/invalid-email': 'Email non valida', 'auth/popup-closed-by-user': 'Accesso annullato', 'auth/unauthorized-domain': 'Dominio non autorizzato in Firebase',
    'PERMISSION_DENIED': 'Permesso negato dal database: controlla le regole' }[c] || e.message;
}

let net = null, me = null, roomCode = null, room = null, unwatch = null;
let state = null, seat = -1, local = false, ui = {}, city = null, lastTown = null;
const gang = () => document.querySelector('[name=gang]:checked').value;

// ---------- avvio ----------
const config = await import('./firebase-config.js').then(m => m.firebaseConfig).catch(() => null);
if (config) {
  try { net = await connect(config); } catch (e) { console.error(e); }
}
if (!net) { document.body.classList.add('offline'); show('lobby'); } // senza Firebase resta la partita locale
else net.onAuth(guard(async user => {
  if (!user) return show('auth');
  me = await net.profile();
  if (!me) return show('nick');
  enterLobby();
}));

// ---------- accesso ----------
$('google').onclick = guard(() => net.signInGoogle());
$('email-form').onsubmit = e => e.preventDefault();
document.querySelectorAll('#email-form [data-mode]').forEach(b => (b.onclick = guard(async () => {
  if (!$('email-form').reportValidity()) return;
  const [em, pw] = [$('email').value.trim(), $('password').value];
  await (b.dataset.mode === 'signup' ? net.signUpEmail(em, pw) : net.signInEmail(em, pw));
})));
$('reset').onclick = guard(async () => {
  if (!$('email').value) return toast('Scrivi prima la tua email');
  await net.resetPassword($('email').value.trim()); toast('Ti abbiamo mandato una email per reimpostare la password');
});
$('nick-form').onsubmit = guard(async e => {
  e.preventDefault();
  await net.claimNick($('nick-input').value);
  me = await net.profile(); enterLobby();
});
$('logout').onclick = guard(() => net.signOut());

// ---------- lobby ----------
let lobbyReady = false, friends = [];
function enterLobby() {
  show('lobby');
  $('me').innerHTML = `<b>${esc(me.nick)}</b>`;
  const saved = localStorage.getItem('bb-gang'); if (saved) document.querySelector(`[name=gang][value="${saved}"]`).checked = true;
  if (lobbyReady) return;
  lobbyReady = true;
  net.goOnline();
  net.watchFriends(list => { friends = list; renderFriends(); });
  net.watchInvites(renderInvites);
  net.watchOpenGames(renderGames);
  const code = location.hash.slice(1).toUpperCase();
  if (/^[A-Z]{5}$/.test(code)) openRoom(code, true).catch(e => toast(friendly(e)));
}
document.querySelectorAll('[name=gang]').forEach(r => (r.onchange = () => localStorage.setItem('bb-gang', gang())));

$('create').onclick = guard(async () => openRoom(await net.createGame(gang())));
async function openRoom(code, join = true) {
  if (join) await net.joinGame(code, gang());
  unwatch?.(); roomCode = code; location.hash = code; local = false;
  unwatch = net.watchGame(code, g => {
    room = g;
    if (g.status === 'lobby') { if (!$('game').hidden) show('lobby'); renderRoom(); }
    else if (g.status === 'chiusa') { leaveRoomUi(); toast('La partita è stata chiusa'); }
    else enterGame(JSON.parse(g.state));
  });
}
function leaveRoomUi() { unwatch?.(); unwatch = null; roomCode = room = null; history.replaceState(null, '', location.pathname); $('room').hidden = true; show('lobby'); }

function renderRoom() {
  const r = $('room'), host = room.host === net.uid(), mine = room.players.some(p => p.uid === net.uid());
  r.hidden = !mine;
  if (!mine) return;
  const inRoom = new Set(room.players.map(p => p.uid));
  r.innerHTML = `<h3>Sala d'attesa <span class="code">${roomCode}</span></h3>
    <ol class="list">${room.players.map(p => `<li><b>${esc(p.nick)}</b> <em>${esc(p.gang)}</em>${p.uid === room.host ? ' <small>host</small>' : ''}</li>`).join('')}</ol>
    <p class="note">Link da condividere: <a href="${location.href}">${esc(location.href)}</a></p>
    ${friends.filter(f => f.st === 'ok' && !inRoom.has(f.id)).map(f => `<button class="btn ghost small" data-inv="${f.id}">Invita ${esc(f.nick)}</button>`).join(' ')}
    <div class="row">${host ? `<button id="start" class="btn" ${room.players.length < 3 ? 'disabled' : ''}>Inizia (${room.players.length}/5)</button>` : '<span class="note">In attesa che l\'host avvii…</span>'}
      <button id="leave" class="btn ghost">${host ? 'Chiudi' : 'Esci'}</button></div>`;
  r.querySelectorAll('[data-inv]').forEach(b => (b.onclick = guard(async () => { await net.invite(b.dataset.inv, roomCode); toast('Invito inviato'); })));
  $('start') && ($('start').onclick = guard(() => net.startGame(roomCode)));
  $('leave').onclick = guard(async () => { await net.leaveGame(roomCode); leaveRoomUi(); });
}
function renderGames(list) {
  $('games').innerHTML = list.length ? list.map(g => `<li><span><b>${g.code}</b> · ${esc(g.players[0]?.nick)} · ${g.players.length}/5</span>
    <button class="btn small" data-join="${g.code}">${g.players.some(p => p.uid === net.uid()) ? 'Apri' : 'Entra'}</button></li>`).join('') : '<li class="empty">Nessuna partita aperta.</li>';
  $('games').querySelectorAll('[data-join]').forEach(b => (b.onclick = guard(() => openRoom(b.dataset.join))));
}
function renderInvites(list) {
  $('invites').innerHTML = list.length ? list.map(i => `<li><span><b>${esc(i.from)}</b> ti invita (${i.code})</span>
    <span><button class="btn small" data-go="${i.code}">Entra</button> <button class="btn ghost small" data-no="${i.code}">Ignora</button></span></li>`).join('') : '<li class="empty">Nessun invito.</li>';
  $('invites').querySelectorAll('[data-go]').forEach(b => (b.onclick = guard(async () => { await openRoom(b.dataset.go); net.dismissInvite(b.dataset.go); })));
  $('invites').querySelectorAll('[data-no]').forEach(b => (b.onclick = guard(() => net.dismissInvite(b.dataset.no))));
}
function renderFriends() {
  const order = { in: 0, ok: 1, out: 2 };
  $('friends').innerHTML = friends.length ? [...friends].sort((a, b) => order[a.st] - order[b.st] || b.online - a.online).map(f => `<li>
    <span><i class="dot ${f.online ? 'on' : ''}" title="${f.online ? 'online' : 'offline'}"></i><b>${esc(f.nick)}</b>
    ${f.st === 'in' ? '<small>vuole essere tuo amico</small>' : f.st === 'out' ? '<small>richiesta inviata</small>' : ''}</span>
    <span>${f.st === 'in' ? `<button class="btn small" data-ok="${f.id}">Accetta</button>` : ''}
    <button class="btn ghost small" data-rm="${f.id}">${f.st === 'ok' ? 'Rimuovi' : f.st === 'in' ? 'Rifiuta' : 'Annulla'}</button></span></li>`).join('') : '<li class="empty">Ancora nessun amico.</li>';
  $('friends').querySelectorAll('[data-ok]').forEach(b => (b.onclick = guard(() => net.acceptFriend(b.dataset.ok))));
  $('friends').querySelectorAll('[data-rm]').forEach(b => (b.onclick = guard(() => net.removeFriend(b.dataset.rm))));
  if (room?.status === 'lobby') renderRoom();
}
$('friend-form').onsubmit = guard(async e => {
  e.preventDefault();
  await net.requestFriend($('friend-nick').value); $('friend-nick').value = ''; toast('Richiesta inviata');
});

// ---------- partita locale ----------
$('local').onclick = guard(() => {
  const names = $('local-names').value.split('\n').map(s => s.trim()).filter(Boolean);
  local = true; roomCode = null;
  room = { players: names.map((nick, i) => ({ nick, gang: i % 2 ? 'Punk' : 'Technoborghesi' })) };
  enterGame(newGame(names));
});
$('to-lobby').onclick = () => { if (local) { local = false; state = null; } show(!net || me ? 'lobby' : 'auth'); };

// ---------- partita ----------
async function enterGame(s) {
  if ($('game').hidden) { show('game'); }
  if (!city) {
    $('loading').hidden = false;
    city = await createCity($('city'), $('labels'));
    $('loading').hidden = true;
  }
  state = s; render();
}

async function act(m) {
  try {
    if (local) state = applyMove(state, seat, m);
    else await net.act(roomCode, m);
    ui = {};
    if (local) render();
  } catch (e) { console.error(e); toast(friendly(e)); }
}

function actorOf(s, pd) { return !pd ? -1 : pd.type === 'draft' ? s.draft.picks.findIndex(x => !x) : pd.p; }

function clickable(s, pd) {
  if (!pd || pd.p !== seat) return [];
  switch (pd.type) {
    case 'setupTown': return emptyTowns(s).filter(id => !TOWNS.some(o => o.region === TOWNS[id].region && s.towns[o.id].owner !== null && s.towns[o.id].owner !== seat));
    case 'activeTown': return emptyTowns(s);
    case 'placeTown': return emptyTowns(s, pd.region);
    case 'loseTown': return ownTowns(s, pd.victim);
    case 'monastery': return ownTowns(s, seat).filter(id => !s.towns[id].monastery);
    case 'action': return ui.pick === 'expand' ? expandTargets(s, seat) : ui.pick === 'viking' ? vikingTowns(s) : [];
  }
  return [];
}

function onTown(town) {
  const pd = current(state);
  if (pd?.type === 'action') { ui[ui.pick] = town; ui.pick = null; render(); }
  else act({ town });
}

const WKEYS = Object.keys(WEATHER_TYPES);
const who = (s, p) => `<b class="who" style="--pc:${THEME.players[p]}">${esc(s.players[p].name)}</b>`;
const characterIndex = c => (c?.princess ? 'estrid' : MARRIAGES.findIndex(m => JSON.stringify(m) === JSON.stringify(c)));

function render() {
  const s = state, pd = current(s);
  const mySeat = local ? actorOf(s, pd) : room.players.findIndex(p => p.uid === net.uid());
  seat = mySeat;
  $('code').textContent = local ? 'partita locale' : `partita ${roomCode}`;
  city.update({ towns: s.towns, activeTown: s.trick?.town ?? null });
  if (s.trick?.town != null && s.trick.town !== lastTown) city.select(s.trick.town);
  lastTown = s.trick?.town ?? null;
  const wk = WKEYS[(s.round * 5 + s.start * 3) % WKEYS.length]; // meteo diverso a ogni round, uguale per tutti
  if (city.weather() !== wk) city.setWeather(wk);
  city.setClickable(clickable(s, pd), onTown);
  renderPlayers(s, pd); renderRound(s, wk); renderPrompt(s, pd); renderTrick(s); renderHand(s, pd);
  $('log').innerHTML = [...s.log].reverse().map(l => `<li>${esc(l)}</li>`).join('');
}

function renderPlayers(s, pd) {
  const stat = (sym, v, label) => `<span class="stat" title="${label}">${icon(sym, 15)}<b>${v}</b></span>`;
  const waiting = !pd ? [] : pd.type === 'draft' ? s.draft.picks.flatMap((x, i) => (x ? [] : [i])) : [pd.p];
  $('players').innerHTML = s.players.map((pl, i) => {
    const terr = pl.claims.map(r => `<span class="terr" style="--rc:${THEME.region[r]}">${REGIONS[r].name}</span>`).join('');
    return `<li class="pl${waiting.includes(i) ? ' turn' : ''}" style="--pc:${THEME.players[i]}">
      <span class="sw"></span>
      <span class="nm">${esc(pl.name)}${i === seat && !local ? '<small>tu</small>' : ''}${i === s.active ? '<span class="mk" title="Ha il segnalino quartiere attivo">▲</span>' : ''}<em>${esc(room.players[i]?.gang || '')}${pl.princess ? ' · con Estrid' : ''}</em></span>
      <span class="pts">${pl.points}</span>
      <span class="row">${stat('C', pl.coins, 'Crediti')}${stat('R', pl.renown, 'Street cred')}${stat('A', pl.raiders, 'Unità di polizia neutralizzate')}${stat('X', pl.church, 'Comunità')}${stat('M', pl.mar + 1, 'Hype')}<span class="stat" title="Carte in mano"><svg viewBox="0 0 40 40" width="15" height="15"><rect x="9" y="5" width="22" height="30" fill="none" stroke="currentColor" stroke-width="4"/></svg><b>${pl.hand.length}</b></span></span>
      ${terr || pl.marriages.length ? `<span class="row terrs">${terr}${pl.marriages.length ? `<span class="terr" style="--rc:${THEME.suit.yellow.fill}">${pl.marriages.length} personaggi</span>` : ''}</span>` : ''}
    </li>`;
  }).join('');
}

function renderRound(s, wk) {
  const total = s.players.length === 3 ? 3 : 4, ci = characterIndex(s.marriage);
  $('round').innerHTML = `<div><span>Round</span><b>${s.round}</b><em>/${total}</em></div>
    <div><span>Polizia in arrivo</span><b>${icon('A', 18)} ${s.area}</b></div>
    ${s.marriage ? `<div class="peek"><span>Personaggio da ingaggiare</span><b>${ci === 'estrid' ? 'Regina Estrid' : `+${s.marriage.points}${s.marriage.region ? ' · ' + REGIONS[s.marriage.region].name : ''}`}</b><figure>${characterSVG(ci)}</figure></div>` : ''}
    <div><span>Meteo</span><b>${WEATHER_TYPES[wk]}</b></div>`;
}

function renderTrick(s) {
  const t = s.trick;
  $('trick').hidden = !t?.plays.length;
  if (!t?.plays.length) return;
  $('trick').innerHTML = `<p class="kicker">Presa in corso</p><div>${t.plays.map(x => `<figure style="--pc:${THEME.players[x.p]}">${cardSVG(x.card)}<figcaption>${esc(s.players[x.p].name)}${t.winner === x.p ? ' ★' : ''}</figcaption></figure>`).join('')}</div>`;
}

function renderHand(s, pd) {
  const el = $('hand');
  if (seat < 0) { el.innerHTML = ''; return; }
  if (pd?.type === 'draft' && !s.draft.picks[seat]) {
    const sel = ui.draft || [];
    el.innerHTML = s.draft.packets[seat].map(v => `<button class="card" data-c="${v}" aria-pressed="${sel.includes(v)}">${cardSVG(v)}</button>`).join('');
    el.querySelectorAll('[data-c]').forEach(b => (b.onclick = () => {
      const v = +b.dataset.c;
      ui.draft = sel.includes(v) ? sel.filter(x => x !== v) : [...sel, v].slice(-2); render();
    }));
    return;
  }
  const hand = s.players[seat].hand, playing = pd?.type === 'play' && pd.p === seat;
  let ok = () => playing;
  if (playing && seat === s.trick.leader) {
    const fits = v => [TOWNS[s.trick.town].color, 'white'].includes(CARDS[v].color);
    if (hand.some(fits)) ok = fits;
  }
  el.innerHTML = hand.map(v => `<button class="card${ok(v) || !playing ? '' : ' off'}" data-c="${v}" ${ok(v) ? '' : 'aria-disabled="true"'}>${cardSVG(v)}</button>`).join('');
  if (playing) el.querySelectorAll('[data-c]').forEach(b => (b.onclick = () => ok(+b.dataset.c) && act({ card: +b.dataset.c })));
}

function renderPrompt(s, pd) {
  const el = $('prompt'), head = (k, h, body = '') => `<p class="kicker">${k}</p><h2>${h}</h2>${body}`;
  if (!pd) { // fine partita
    const rank = s.players.map((p, i) => i).sort((a, b) => s.players[b].points - s.players[a].points);
    el.innerHTML = head('Fine partita', s.winner.length > 1 ? 'Pareggio!' : `Vince ${esc(s.players[s.winner[0]].name)}`,
      `<ol class="rank">${rank.map(i => `<li>${who(s, i)} <span>${s.players[i].points} punti</span></li>`).join('')}</ol>`);
    return;
  }
  if (pd.type === 'draft') {
    const waiting = s.draft.picks.flatMap((x, i) => (x ? [] : [i]));
    if (seat >= 0 && !s.draft.picks[seat]) {
      const n = (ui.draft || []).length;
      el.innerHTML = head(local ? `Tocca a ${esc(s.players[seat].name)}` : 'Draft', 'Scegli 2 storie',
        `<p>Tieni 2 carte dal mazzetto, il resto passa alla banda a sinistra. Già in mano: ${s.players[seat].hand.length}.</p>
         <button id="ok" class="btn wide" ${n === 2 ? '' : 'disabled'}>Tieni queste 2 (${n}/2)</button>`);
      $('ok').onclick = () => act({ cards: ui.draft });
    } else el.innerHTML = head('Draft', 'In attesa', `<p>Stanno scegliendo: ${waiting.map(i => who(s, i)).join(', ')}</p>`);
    return;
  }
  const town = s.trick?.town != null ? TOWNS[s.trick.town] : null;
  if (pd.p !== seat) {
    el.innerHTML = head('Turno di', who(s, pd.p), town ? `<p>Quartiere attivo: <b class="chip" style="--sc:${THEME.suit[town.color].fill};--si:${THEME.suit[town.color].ink}">${esc(town.name)}</b></p>` : '');
    return;
  }
  const mine = local ? `Tocca a ${esc(s.players[seat].name)}` : 'Tocca a te';
  const SIMPLE = {
    setupTown: () => ['Scegli il quartiere di partenza', 'Clicca uno spot libero in una zona dove non ci sono altre bande.'],
    activeTown: () => ['Scegli il quartiere attivo', 'Clicca uno spot libero: chi vince la presa lo conquista. Poi dovrai giocare una storia del suo colore (o Briano Borro).'],
    placeTown: () => [`Prendi un quartiere${pd.region ? ' in ' + REGIONS[pd.region].name : ''}`, 'Clicca uno spot libero.'],
    loseTown: () => ['La polizia presidia un quartiere', pd.victim === seat ? 'Scegli quale dei tuoi quartieri perdi.' : `Scegli quale quartiere di ${esc(s.players[pd.victim].name)} viene presidiato.`],
    monastery: () => ['Avvia un progetto urbano', 'Scegli un tuo quartiere: conterà doppio per il controllo della zona.'],
  };
  if (SIMPLE[pd.type]) { const [h, t] = SIMPLE[pd.type](); el.innerHTML = head(mine, h, `<p>${t}</p>`); return; }
  if (pd.type === 'play') {
    const suit = THEME.suit[town.color];
    el.innerHTML = head(mine, 'Gioca una storia', `<p>Quartiere attivo: <b class="chip" style="--sc:${suit.fill};--si:${suit.ink}">${esc(town.name)}</b> · ${REGIONS[town.region].name}.</p>
      <p>Vince la carta più alta <b>${suit.name.toLowerCase()}</b> o di Briano Borro.${seat === s.trick.leader ? ' Apri tu: devi giocare quel colore o Briano Borro, se puoi.' : ''}</p>`);
    return;
  }
  if (pd.type === 'princess') {
    el.innerHTML = head(mine, 'Regina Estrid', `<p>L'IA libera è dalla tua parte. Scegli come:</p>
      <button class="btn wide" data-c="military">${ESTRID.options.military}</button><p class="note">I quartieri presidiati dalla polizia contano come tuoi per il controllo delle zone e nel punteggio finale delle zone in palio.</p>
      <button class="btn wide" data-c="trade">${ESTRID.options.trade}</button><p class="note">I quartieri presidiati contano come tuoi per il numero di zone a fine partita.</p>
      <button class="btn ghost wide" data-c="spurn">${ESTRID.options.spurn} (+4 punti)</button>`);
    el.querySelectorAll('[data-c]').forEach(b => (b.onclick = () => act({ choice: b.dataset.c })));
    return;
  }
  // azione dopo la presa
  const card = CARDS[pd.card], pl = s.players[seat];
  const opts = pd.won ? [['p', card.primary]] : card.secondary.map((x, i) => [i, x]);
  ui.opt ??= opts[0][0];
  const syms = opts.find(o => o[0] === ui.opt)[1];
  const buy = syms.find(x => 'MAX'.includes(x)), maxExtra = Math.floor(pl.coins / 2);
  ui.extra = Math.min(ui.extra || 0, maxExtra);
  el.innerHTML = head(mine, pd.won ? `Hai vinto con ${pd.card}` : `Hai perso con ${pd.card}`,
    `<p class="note">${esc(STORIES[pd.card])}</p>
    <div class="opts">${opts.map(([k, sy]) => `<button class="opt" data-o="${k}" aria-pressed="${k === ui.opt}">${sy.map(x => `<span title="${SYMBOLS[x]}">${icon(x, 26)}</span>`).join('')}</button>`).join('')}</div>
    <ul class="explain">${[...new Set(syms)].map(x => `<li>${icon(x, 16)} ${SYMBOLS[x]}</li>`).join('')}</ul>
    ${buy ? `<div class="stepper"><span>Extra (2 crediti l'uno)</span><button class="btn small" data-x="-1">−</button><b>${ui.extra}</b><button class="btn small" data-x="1" ${ui.extra >= maxExtra ? 'disabled' : ''}>+</button></div>` : ''}
    ${syms.includes('E') ? `<p><button class="btn ghost small" id="pick-e">${ui.expand != null ? 'Espansione: ' + esc(TOWNS[ui.expand].name) : 'Scegli dove espanderti (facoltativo)'}</button>${ui.expand != null ? ' <button class="link" id="no-e">annulla</button>' : ''}</p>` : ''}
    ${syms.includes('V') && vikingTowns(s).length ? `<p><button class="btn ghost small" id="pick-v">${ui.viking != null ? 'Presidio: ' + esc(TOWNS[ui.viking].name) : 'Scegli il presidio da rimuovere'}</button></p>` : ''}
    ${ui.pick ? '<p class="note">Clicca lo spot sulla mappa.</p>' : ''}
    <button id="ok" class="btn wide">Conferma</button>`);
  el.querySelectorAll('[data-o]').forEach(b => (b.onclick = () => { ui = { opt: b.dataset.o === 'p' ? 'p' : +b.dataset.o }; render(); }));
  el.querySelectorAll('[data-x]').forEach(b => (b.onclick = () => { ui.extra = Math.max(0, Math.min(maxExtra, ui.extra + +b.dataset.x)); render(); }));
  $('pick-e') && ($('pick-e').onclick = () => { ui.pick = 'expand'; render(); });
  $('no-e') && ($('no-e').onclick = () => { ui.expand = null; render(); });
  $('pick-v') && ($('pick-v').onclick = () => { ui.pick = 'viking'; render(); });
  $('ok').onclick = () => act({ opt: ui.opt, extra: ui.extra || 0, expand: ui.expand ?? null, viking: ui.viking });
}

// in partita online lo stato arriva da watchGame -> enterGame -> render
// aggancio per i test automatici nel browser (clic sugli spot senza dover mirare nel 3D)
window.__clickable = () => (state ? clickable(state, current(state)) : []);
window.__pick = town => onTown(town);
