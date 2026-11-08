// Brian Boru · Milano 2077: accesso, lobby, amici e partita (online o locale).
import { move as applyMove, current, emptyTowns, ownTowns, expandTargets, vikingTowns, newGame } from './game/engine.js';
import { CARDS, MARRIAGES, TOWNS, REGIONS, MARRIAGE_TRACK } from './game/data.js';
import { THEME } from './milano/theme.js';
import { cardSVG, characterSVG } from './milano/card.js';
import { icon, setIconSet } from './milano/icons.js';
import { STORIES, ESTRID, SYMBOLS, CHARACTERS } from './milano/lore.js';
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
    'PERMISSION_DENIED': 'Permesso negato dal database: controlla le regole' }[c]
    || (/permission denied/i.test(e.message) ? 'Il database rifiuta l\'accesso: vanno pubblicate le regole di database.rules.json' : e.message);
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
else net.onAuth(async user => {
  if (!user) return show('auth');
  if (user.isAnonymous) return net.signOut(); // accesso anonimo del vecchio prototipo: serve un account vero
  try { me = await net.profile(); } catch (e) { // es. regole del database non pubblicate: non lasciare la pagina vuota
    console.error(e); show('auth'); $('auth-msg').textContent = friendly(e); return;
  }
  if (!me) return show('nick');
  enterLobby();
});

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
$('logout').onclick = $('nick-out').onclick = guard(() => net.signOut());

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
  unwatch?.(); roomCode = code; location.hash = code; local = false; seenN = null;
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
  seenN = null; enterGame(newGame(names));
});
$('to-lobby').onclick = () => { if (local) { local = false; state = null; } show(!net || me ? 'lobby' : 'auth'); };

// ---------- partita ----------
async function enterGame(s) {
  if ($('game').hidden) show('game');
  if (!city) {
    $('loading').hidden = false;
    city = await createCity($('city'), $('labels'), { compass: $('compass') });
    $('loading').hidden = true;
  }
  state = s; ingestEvents(s); render();
}
$('compass').onclick = () => city?.resetView();

async function act(...moves) { // più mosse di fila (es. quartiere attivo + carta)
  try {
    for (const m of moves) {
      if (local) state = applyMove(state, seat, m);
      else await net.act(roomCode, m);
    }
    ui = {};
    if (local) { ingestEvents(state); render(); }
  } catch (e) { console.error(e); toast(friendly(e)); }
}

function actorOf(s, pd) { return !pd ? -1 : pd.type === 'draft' ? s.draft.picks.findIndex(x => !x) : pd.p; }

function clickable(s, pd) {
  if (!pd || pd.p !== seat || showing) return [];
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
// clic su uno spot: è solo una scelta provvisoria, si cambia cliccando altrove e si conferma col pulsante (o giocando la carta)
function onTown(town) {
  const pd = current(state);
  if (pd?.type === 'action') { ui[ui.pick] = town; ui.pick = null; } else ui.town = town;
  render();
}

const WKEYS = Object.keys(WEATHER_TYPES);
const who = (s, p) => `<b class="who" style="--pc:${THEME.players[p]}">${esc(s.players[p].name)}</b>`;
const characterIndex = c => (c?.princess ? 'estrid' : MARRIAGES.findIndex(m => JSON.stringify(m) === JSON.stringify(c)));
const characterName = c => (c?.princess ? ESTRID.name : CHARACTERS[characterIndex(c)]?.name || 'un personaggio');
const townChip = id => { const t = TOWNS[id], su = THEME.suit[t.color]; return `<b class="chip" style="--sc:${su.fill};--si:${su.ink}">${esc(t.name)}</b>`; };

// ---------- fasi del round ----------
const PHASES = [['prep', 'Preparazione'], ['draft', 'Draft'], ['trick', 'Azioni'], ['party', 'Underground Party'], ['guerrilla', 'Guerrilla'], ['community', 'Community Projects'], ['uprising', 'Uprising']];
const PEND_PHASE = { setupTown: 'prep', draft: 'draft', activeTown: 'trick', play: 'trick', action: 'trick', princess: 'party', placeTown: 'party', loseTown: 'guerrilla', monastery: 'community' };
function renderPhases(s, pd) {
  const cur = showing ? showing.k : pd ? PEND_PHASE[pd.type] : 'uprising';
  $('phases').innerHTML = PHASES.map(([k, l], i) => `${i === 3 ? '<span class="upkeep">Upkeep</span>' : ''}<span class="ph${k === cur ? ' on' : ''}">${l}</span>`).join('');
}

// ---------- racconto dell'upkeep: un evento alla volta, a passi ----------
let seenN = null, queue = [], showing = null, step = 0, timer = null;
function ingestEvents(s) {
  const n = s.eventN || 0;
  if (seenN === null) { seenN = n; return; } // entrando a partita in corso non si rivede il passato
  queue.push(...(s.events || []).filter(e => e.n > seenN)); seenN = n;
  if (!showing) nextEvent();
}
function nextEvent() { showing = queue.shift() || null; step = 0; clearTimeout(timer); if (showing) timer = setTimeout(advance, 2800); if (state) render(); }
function advance() { if (!showing) return; if (++step >= steps(showing).length) nextEvent(); else { clearTimeout(timer); timer = setTimeout(advance, 2800); render(); } }

function hypeTrack(pos, { mark = null, note = '' } = {}) { // pos[i] = casella del giocatore i (0..9)
  return `<div class="track">${MARRIAGE_TRACK.map((b, c) => `<div class="cell${c === mark ? ' mark' : ''}">
    <span class="n">${c + 1}</span><span class="b">${b === 'CC' ? icon('C', 13) + icon('C', 13) : b ? icon(b, 14) : ''}</span>
    <span class="tok">${pos.map((p, i) => (p === c ? `<i style="--pc:${THEME.players[i]}" title="${esc(state.players[i].name)}"></i>` : '')).join('')}</span></div>`).join('')}</div>${note}`;
}
const BONUS = { C: '+1 credito', CC: '+2 crediti', R: '+1 street cred', T: 'prende un quartiere libero a scelta' };
function steps(e) {
  const s = state, list = arr => arr.join('');
  switch (e.k) {
    case 'prep': return [{ t: `Round ${e.round}${e.final ? ' · ultimo' : ''}`, b: `<p>Arrivano <b>${e.police}</b> unità di polizia: in allerta ora ce ne sono ${e.area}.</p><p>Personaggio da ingaggiare: <b>${characterName(e.character)}</b>.</p>` }];
    case 'party': {
      const after = e.track.map((p, i) => (i === e.winner ? 0 : p)), out = [{ t: 'La track dell\'hype', b: hypeTrack(e.track) + '<p>Chi è più avanti ingaggia il personaggio.</p>' }];
      if (e.winner === null) return [...out, { t: 'Nessun ingaggio', b: `<p>Nessuno ha hype: ${characterName(e.card)} se ne va.</p>` }];
      out.push({ t: `Vince ${who(s, e.winner)}`, b: `<p>Ingaggia <b>${characterName(e.card)}</b>.</p>` });
      out.push({ t: `${who(s, e.winner)} torna all'inizio`, b: hypeTrack(after) });
      if (e.bonuses.length) out.push({ t: 'Bonus della track', b: `<ul class="plain">${list(e.bonuses.map(x => `<li>${who(s, x.p)} ${BONUS[x.b]}</li>`))}</ul>` });
      const c = e.card;
      out.push({ t: 'Effetto del personaggio', b: c.princess ? `<p>${who(s, e.winner)} sceglie come usare la Regina Estrid.</p>`
        : `<p>${who(s, e.winner)} prende <b>${c.points} punti</b>${c.renown ? ' e +1 street cred' : ''}${c.region ? ` e un quartiere in <b>${REGIONS[c.region].name}</b>` : ''}.</p>` });
      return out;
    }
    case 'guerrilla': {
      const out = [{ t: 'Guerrilla', b: `<p>Polizia in allerta: <b>${e.area}</b>.</p><ul class="plain">${list(e.raiders.map((r, i) => `<li>${who(s, i)} ha neutralizzato ${r} unità</li>`))}</ul>` }];
      out.push(e.area > 0 ? { t: 'Retata!', b: e.losses.length ? `<ul class="plain">${list(e.losses.map(l => `<li>${who(s, l.victim)} perde un quartiere${l.chooser !== l.victim ? ` (sceglie ${who(s, l.chooser)})` : ''}</li>`))}</ul>` : '<p>Nessuno ha quartieri da perdere.</p>' }
        : { t: 'Polizia respinta', b: '<p>Nessuna unità in allerta: nessuna retata.</p>' });
      out.push(e.first !== null ? { t: `${who(s, e.first)} guida la guerriglia`, b: `<p>+1 street cred e <b>+${e.gain} punti</b> (uno per ogni street cred).</p>` } : { t: 'Nessun capo', b: '<p>Pareggio o nessuna unità: niente premio principale.</p>' });
      if (e.ties.length) out.push({ t: '+1 punto', b: `<p>${e.ties.map(i => who(s, i)).join(', ')}: chi ha più unità rimaste.</p>` });
      return out;
    }
    case 'community': {
      const out = [{ t: 'Community Projects', b: `<ul class="plain">${list(e.church.map((c, i) => `<li>${who(s, i)} ${c} di comunità</li>`))}</ul>` }];
      out.push(e.first !== null ? { t: `${who(s, e.first)} guida la comunità`, b: '<p>Avvia un progetto urbano e prende il segnalino quartiere attivo.</p>' } : { t: 'Nessun capo', b: '<p>Pareggio o nessuno: niente progetto principale.</p>' });
      if (e.ties.length) out.push({ t: '+1 punto', b: `<p>${e.ties.map(i => who(s, i)).join(', ')}</p>` });
      if (e.fours.length) out.push({ t: 'Progetti con 4 o più', b: `<p>${e.fours.map(i => who(s, i)).join(', ')} avviano un progetto urbano.</p>` });
      return out;
    }
    case 'uprising': return [
      { t: 'Uprising', b: e.flips.length ? `<p>Ora in palio: ${e.flips.map(r => `<b>${REGIONS[r].name}</b>`).join(', ')}.</p>` : '<p>Nessuna nuova zona in palio.</p>' },
      { t: 'Controllo delle zone', b: e.changes.length ? `<ul class="plain">${list(e.changes.map(c => `<li><b>${REGIONS[c.r].name}</b>: ${c.owner === null ? 'nessuno' : who(s, c.owner)}</li>`))}</ul>` : '<p>Nessun cambio di controllo.</p>' },
    ];
  }
  return [];
}

// ---------- rendering ----------
let handSort = localStorage.getItem('bb-sort') || 'num';
document.querySelectorAll('[data-sort]').forEach(b => (b.onclick = () => { handSort = b.dataset.sort; localStorage.setItem('bb-sort', handSort); render(); }));
const SUIT_ORDER = { yellow: 0, red: 1, blue: 2, white: 3 };
const sorted = cards => [...cards].sort((a, b) => (handSort === 'color' ? SUIT_ORDER[CARDS[a].color] - SUIT_ORDER[CARDS[b].color] : 0) || a - b);

let pendKey = null;
function render() {
  const s = state, pd = current(s);
  const key = JSON.stringify(pd) + (pd?.type === 'draft' ? s.draft.packets.join('|') : '');
  if (key !== pendKey) { pendKey = key; if (!local || pd?.type !== 'draft') ui = {}; } // nuova decisione: via le scelte provvisorie
  seat = local ? actorOf(s, pd) : room.players.findIndex(p => p.uid === net.uid());
  $('code').textContent = local ? 'partita locale' : `partita ${roomCode}`;
  city.update({ towns: s.towns, activeTown: s.trick?.town ?? null });
  // si illumina solo la scelta provvisoria di chi sta giocando: finito il suo turno, si spegne
  city.select(pd && pd.p === seat && !showing ? (ui.town ?? ui.expand ?? ui.viking ?? null) : null);
  const wk = WKEYS[(s.round * 5 + s.start * 3) % WKEYS.length]; // meteo diverso a ogni round, uguale per tutti
  if (city.weather() !== wk) city.setWeather(wk);
  city.setClickable(clickable(s, pd), onTown);
  document.querySelectorAll('[data-sort]').forEach(b => b.setAttribute('aria-pressed', b.dataset.sort === handSort));
  renderPhases(s, pd); renderPlayers(s, pd); renderTurn(s, pd, wk); renderStage(s, pd); renderHand(s, pd);
  $('hype').innerHTML = `<span class="lbl">Hype</span>${hypeTrack(s.players.map(p => p.mar))}`;
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
      <span class="row">${stat('C', pl.coins, 'Crediti')}${stat('R', pl.renown, 'Street cred')}${stat('A', pl.raiders, 'Unità di polizia neutralizzate')}${stat('X', pl.church, 'Comunità')}<span class="stat" title="Carte in mano"><svg viewBox="0 0 40 40" width="15" height="15"><rect x="9" y="5" width="22" height="30" fill="none" stroke="currentColor" stroke-width="4"/></svg><b>${pl.hand.length}</b></span></span>
      ${terr || pl.marriages.length ? `<span class="row terrs">${terr}${pl.marriages.map(m => `<span class="terr" style="--rc:${THEME.suit.yellow.fill}">${esc(characterName(m))}</span>`).join('')}</span>` : ''}
    </li>`;
  }).join('');
}

function renderTurn(s, pd, wk) {
  const total = s.players.length === 3 ? 3 : 4, ci = s.marriage ? characterIndex(s.marriage) : null;
  const turn = !pd ? '<b>Partita finita</b>' : pd.type === 'draft' ? `Draft: ${s.draft.picks.flatMap((x, i) => (x ? [] : [who(s, i)])).join(', ')}` : `Turno di ${who(s, pd.p)}${pd.p === seat && !local ? ' <small>(tu)</small>' : ''}`;
  $('turn').innerHTML = `<p class="kicker">Turno</p><p class="big">${turn}</p>
    <dl><dt>Round</dt><dd>${s.round}/${total}</dd><dt>Polizia in allerta</dt><dd>${icon('A', 15)} ${s.area}</dd><dt>Meteo</dt><dd>${WEATHER_TYPES[wk]}</dd>
    ${s.marriage ? `<dt>Personaggio</dt><dd class="peek">${esc(characterName(s.marriage))}<figure>${characterSVG(ci)}</figure></dd>` : ''}</dl>`;
}

function renderHand(s, pd) {
  const el = $('hand');
  if (seat < 0) { el.innerHTML = ''; return; }
  const card = (v, attrs = '', cls = '') => `<button class="card${cls}" data-c="${v}" ${attrs}>${cardSVG(v)}</button>`;
  if (pd?.type === 'draft' && !s.draft.picks[seat] && !showing) {
    const sel = ui.draft || [], kept = sorted(s.players[seat].hand);
    el.innerHTML = (kept.length ? `<div class="kept"><span>Già tenute</span><div>${kept.map(v => `<figure>${cardSVG(v)}</figure>`).join('')}</div></div>` : '') +
      sorted(s.draft.packets[seat]).map(v => card(v, `aria-pressed="${sel.includes(v)}"`)).join('');
    el.querySelectorAll('[data-c]').forEach(b => (b.onclick = () => {
      const v = +b.dataset.c;
      ui.draft = sel.includes(v) ? sel.filter(x => x !== v) : [...sel, v].slice(-2); render();
    }));
    return;
  }
  const hand = sorted(s.players[seat].hand), mine = pd && pd.p === seat && !showing;
  const choosingTown = mine && pd.type === 'activeTown', playing = mine && pd.type === 'play';
  const color = playing ? TOWNS[s.trick.town].color : choosingTown && ui.town != null ? TOWNS[ui.town].color : null;
  const leading = choosingTown || (playing && seat === s.trick.leader);
  const fits = v => [color, 'white'].includes(CARDS[v].color);
  const ok = v => (playing || (choosingTown && ui.town != null)) && (!leading || fits(v) || !hand.some(fits));
  el.innerHTML = hand.map(v => card(v, ok(v) ? '' : 'aria-disabled="true"', ok(v) || !(playing || choosingTown) ? '' : ' off')).join('');
  el.querySelectorAll('[data-c]').forEach(b => (b.onclick = () => {
    const v = +b.dataset.c;
    if (!ok(v)) return choosingTown && ui.town == null && toast('Prima scegli il quartiere attivo sulla mappa');
    if (choosingTown) act({ town: ui.town }, { card: v }); else act({ card: v });
  }));
}

function trickRow(s) {
  const t = s.trick;
  if (!t?.plays.length) return '';
  return `<div class="trickrow">${t.plays.map(x => `<figure style="--pc:${THEME.players[x.p]}">${cardSVG(x.card)}<figcaption>${esc(s.players[x.p].name)}${t.winner === x.p ? ' ★ vince' : ''}</figcaption></figure>`).join('')}</div>`;
}

function hypePreview(s, pl, syms, extra) { // dove arriva il disco sulla track, con la regola delle caselle occupate
  const nM = syms.filter(x => x === 'M').length;
  if (!nM) return '';
  const others = s.players.filter(o => o !== pl).map(o => o.mar);
  let pos = Math.min(9, pl.mar + nM + extra);
  const aim = pos;
  while (pos > 0 && others.includes(pos)) pos--;
  const note = pos === aim ? `<p>Arrivi alla casella <b>${pos + 1}</b>.</p>`
    : `<p>La casella ${aim + 1} è occupata: scendi alla <b>${pos + 1}</b>. Con 2 crediti in più fai un passo in più.</p>`;
  return hypeTrack(s.players.map((o, i) => (o === pl ? pos : o.mar)), { mark: pos, note });
}

function renderStage(s = state, pd = current(state)) {
  const el = $('stage'), head = (k, h, body = '') => `<p class="kicker">${k}</p><h2>${h}</h2>${body}`;
  if (showing) {
    const st = steps(showing), cur = st[Math.min(step, st.length - 1)];
    el.innerHTML = head(`${PHASES.find(p => p[0] === showing.k)?.[1] || ''} · ${step + 1}/${st.length}`, cur.t, cur.b) +
      `<div class="row end"><button class="btn ghost small" id="skip">Salta</button><button class="btn small" id="next">Avanti ›</button></div>`;
    $('next').onclick = advance; $('skip').onclick = () => { queue = []; nextEvent(); };
    return;
  }
  if (!pd) { // fine partita
    const rank = s.players.map((p, i) => i).sort((a, b) => s.players[b].points - s.players[a].points);
    el.innerHTML = head('Fine partita', s.winner.length > 1 ? 'Pareggio!' : `Vince ${esc(s.players[s.winner[0]].name)}`,
      `<ol class="rank">${rank.map(i => `<li>${who(s, i)} <span>${s.players[i].points} punti</span></li>`).join('')}</ol>`);
    return;
  }
  const trick = trickRow(s);
  if (pd.type === 'draft') {
    if (seat >= 0 && !s.draft.picks[seat]) {
      const n = (ui.draft || []).length;
      el.innerHTML = head(local ? `Tocca a ${esc(s.players[seat].name)}` : 'Draft', 'Scegli 2 carte',
        `<p>Tieni 2 carte dal mazzetto: il resto passa alla banda a sinistra. A sinistra vedi quelle che hai già tenuto.</p>
         <button id="ok" class="btn wide" ${n === 2 ? '' : 'disabled'}>Tieni queste 2 (${n}/2)</button>`);
      $('ok').onclick = () => act({ cards: ui.draft });
    } else el.innerHTML = head('Draft', 'In attesa', `<p>Stanno scegliendo: ${s.draft.picks.flatMap((x, i) => (x ? [] : [who(s, i)])).join(', ')}</p>`);
    return;
  }
  const town = s.trick?.town != null ? s.trick.town : null;
  if (pd.p !== seat) {
    el.innerHTML = trick + head('Turno di', who(s, pd.p), town != null ? `<p>Quartiere attivo: ${townChip(town)} · ${REGIONS[TOWNS[town].region].name}</p>` : '');
    return;
  }
  const mine = local ? `Tocca a ${esc(s.players[seat].name)}` : 'Tocca a te';
  const confirmTown = (title, text) => {
    el.innerHTML = head(mine, title, `<p>${text}</p><p>Scelta: ${ui.town != null ? townChip(ui.town) : '<em>clicca uno spot evidenziato</em>'}</p>
      <button id="ok" class="btn wide" ${ui.town != null ? '' : 'disabled'}>Conferma</button>`);
    $('ok').onclick = () => act({ town: ui.town });
  };
  switch (pd.type) {
    case 'setupTown': return confirmTown('Quartiere di partenza', 'Scegli uno spot libero in una zona dove non ci sono altre bande. Puoi cambiare scelta prima di confermare.');
    case 'placeTown': return confirmTown(`Prendi un quartiere${pd.region ? ' in ' + REGIONS[pd.region].name : ''}`, 'Scegli uno spot libero evidenziato.');
    case 'loseTown': return confirmTown('La polizia presidia un quartiere', pd.victim === seat ? 'Scegli quale dei tuoi quartieri perdi.' : `Scegli quale quartiere di ${esc(s.players[pd.victim].name)} viene presidiato.`);
    case 'monastery': return confirmTown('Avvia un progetto urbano', 'Scegli un tuo quartiere: conterà doppio per il controllo della zona.');
    case 'activeTown':
      el.innerHTML = head(mine, 'Scegli il quartiere attivo', `<p>Clicca uno spot libero (puoi cambiarlo), poi <b>gioca una carta</b> del suo colore o di Briano Borro per confermare.</p>
        <p>Scelta: ${ui.town != null ? `${townChip(ui.town)} · ${REGIONS[TOWNS[ui.town].region].name}` : '<em>nessuna</em>'}</p>`);
      return;
    case 'play': {
      const su = THEME.suit[TOWNS[town].color];
      el.innerHTML = trick + head(mine, 'Gioca una carta', `<p>Quartiere attivo: ${townChip(town)} · vince la carta più alta <b>${su.name.toLowerCase()}</b> o di Briano Borro.</p>`);
      return;
    }
    case 'princess':
      el.innerHTML = head(mine, 'Regina Estrid', `<p>L'IA libera è dalla tua parte. Scegli come:</p>
        <div class="choices"><button class="btn" data-c="military">${ESTRID.options.military}</button><button class="btn" data-c="trade">${ESTRID.options.trade}</button><button class="btn ghost" data-c="spurn">${ESTRID.options.spurn} (+4 punti)</button></div>
        <p class="note">${ESTRID.options.military}: i quartieri presidiati dalla polizia contano come tuoi per il controllo delle zone. ${ESTRID.options.trade}: contano come tuoi per il numero di zone a fine partita.</p>`);
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
  el.innerHTML = trick + head(mine, `${pd.won ? 'Hai vinto' : 'Hai perso'} con ${pd.card} · ${esc(STORIES[pd.card])}`,
    `<div class="opts">${opts.map(([k, sy]) => `<button class="opt" data-o="${k}" aria-pressed="${k === ui.opt}"><small>${k === 'p' ? 'VINCI' : k ? 'OPPURE' : 'PERDI'}</small>${sy.map(x => `<span title="${SYMBOLS[x]}">${icon(x, 24)}</span>`).join('')}</button>`).join('')}</div>
    <ul class="explain">${[...new Set(syms)].map(x => `<li>${icon(x, 16)} ${SYMBOLS[x]}</li>`).join('')}</ul>
    ${buy ? `<div class="stepper"><span>Passi extra: 2 crediti l'uno (hai ${pl.coins} crediti)</span><button class="btn small" data-x="-1">−</button><b>${ui.extra}</b><button class="btn small" data-x="1" ${ui.extra >= maxExtra ? 'disabled' : ''}>+</button></div>` : ''}
    ${hypePreview(s, pl, syms, buy === 'M' ? ui.extra : 0)}
    ${syms.includes('E') ? `<p><button class="btn ghost small" id="pick-e">${ui.expand != null ? 'Espansione: ' + esc(TOWNS[ui.expand].name) + ' (cambia)' : 'Scegli dove espanderti (facoltativo, 5 crediti)'}</button>${ui.expand != null ? ' <button class="link" id="no-e">annulla</button>' : ''}</p>` : ''}
    ${syms.includes('V') && vikingTowns(s).length ? `<p><button class="btn ghost small" id="pick-v">${ui.viking != null ? 'Presidio: ' + esc(TOWNS[ui.viking].name) + ' (cambia)' : 'Scegli il presidio da rimuovere'}</button></p>` : ''}
    ${ui.pick ? '<p class="note">Clicca uno degli spot evidenziati sulla mappa.</p>' : ''}
    <button id="ok" class="btn wide">Conferma</button>`);
  el.querySelectorAll('[data-o]').forEach(b => (b.onclick = () => { ui = { opt: b.dataset.o === 'p' ? 'p' : +b.dataset.o }; render(); }));
  el.querySelectorAll('[data-x]').forEach(b => (b.onclick = () => { ui.extra = Math.max(0, Math.min(maxExtra, ui.extra + +b.dataset.x)); render(); }));
  $('pick-e') && ($('pick-e').onclick = () => { ui.pick = 'expand'; render(); });
  $('no-e') && ($('no-e').onclick = () => { ui.expand = null; render(); });
  $('pick-v') && ($('pick-v').onclick = () => { ui.pick = 'viking'; render(); });
  $('ok').onclick = () => act({ opt: ui.opt, extra: buy ? ui.extra : 0, expand: ui.expand ?? null, viking: ui.viking });
}

// aggancio per i test automatici nel browser (clic sugli spot senza dover mirare nel 3D)
window.__clickable = () => (state ? clickable(state, current(state)) : []);
window.__pick = town => onTown(town);
window.__ui = () => ui;
