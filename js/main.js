// Brian Boru · Milano 2077: accesso, lobby, amici e partita (online o locale).
import { botMove } from './game/bot.js';
import { move as applyMove, current, emptyTowns, leadTowns, ownTowns, expandTargets, vikingTowns, newGame } from './game/engine.js';
import { CARDS, MARRIAGES, TOWNS, REGIONS, MARRIAGE_TRACK } from './game/data.js';
import { THEME, THEME_REPLACED, PIXEL_SCALE } from './milano/theme.js';
import { cardSVG, characterSVG, characterArt } from './milano/card.js';
import { icon, setIconSet, logo, LOGO_NAMES } from './milano/icons.js';
import { ESTRID, SYMBOLS, CHARACTERS } from './milano/lore.js';
import { createCity, WEATHER_TYPES, QUALITY } from './milano/city3d.js';
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
let human = 0, botTimer = null; // partita locale: ultimo posto umano, timer della mossa del bot
const isBot = i => local && !!room?.players[i]?.bot;
let state = null, seat = -1, local = false, ui = {}, city = null, lastTown = null;
const FACTION_NAMES = ['Technoborghesi', 'Punk', 'Partite Iva', 'Startuppers', 'Le Sciure'];
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
  const saved = localStorage.getItem('bb-gang'), sv = saved && document.querySelector(`[name=gang][value="${saved}"]`); if (sv) sv.checked = true;
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
    else { enterGame(JSON.parse(g.state)); checkAcks(); }
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
  const humans = $('local-names').value.split('\n').map(s => s.trim()).filter(Boolean), bots = +$('local-bots').value;
  const names = [...humans, ...Array.from({ length: bots }, (_, i) => `Bot ${i + 1}`)];
  if (!humans.length) throw new Error('Scrivi almeno il tuo nome');
  if (names.length < 3 || names.length > 5) throw new Error(`Servono da 3 a 5 giocatori in tutto, bot compresi (ora ${names.length})`);
  local = true; roomCode = null; human = 0;
  room = { players: names.map((nick, i) => ({ nick, gang: FACTION_NAMES[i % FACTION_NAMES.length], bot: i >= humans.length })) };
  seenN = null; enterGame(newGame(names));
});
$('to-lobby').onclick = () => {
  if (!confirm(local ? 'Uscire dalla partita? La partita locale andrà persa.' : 'Uscire dalla partita? Potrai rientrare dalla lobby.')) return;
  if (local) { local = false; state = null; clearTimeout(botTimer); }
  show(!net || me ? 'lobby' : 'auth');
};

// ---------- bot (partita locale) ----------
function botTurn(s, pd) {
  clearTimeout(botTimer);
  if (!local || !pd || showing || !isBot(actorOf(s, pd))) return;
  botTimer = setTimeout(() => {
    const r = botMove(state); if (!r) return;
    try { state = applyMove(state, r[0], r[1]); } catch (e) { console.error('bot', e); return; }
    ingestEvents(state); render();
  }, pd.type === 'draft' ? 300 : 1100);
}

// ---------- partita ----------
async function enterGame(s) {
  if ($('game').hidden) show('game');
  if (!city) {
    $('loading').hidden = false;
    let quality = 'auto'; try { quality = localStorage.getItem('bb-quality') || 'auto'; } catch {}
    city = await createCity($('city'), $('labels'), { quality, theme: THEME_REPLACED, pixel: pixelOn() ? pixelScale() : 0 });
    renderQuality(); renderPixel();
    $('loading').hidden = true;
  }
  state = s; ingestEvents(s); render();
}
$('help').onclick = () => {
  $('glossary-list').innerHTML = Object.entries(SYMBOLS).map(([k, t]) => `<li>${icon(k, 22, 'currentColor', HOLE)}<span>${t}</span></li>`).join('');
  $('glossary').showModal();
};
// la plancia è larga quanto la sua griglia: barra delle fasi e pannello centrale partono dopo
new ResizeObserver(() => { if (innerWidth >= 900) document.body.style.setProperty('--board-w', $('board').offsetWidth + 'px'); else document.body.style.removeProperty('--board-w'); }).observe($('board'));
$('board-toggle').onclick = () => { const open = document.body.classList.toggle('board-open'); $('board-toggle').setAttribute('aria-expanded', open); };
// pixel art solo sulla mappa, si può spegnere; la scelta resta sul dispositivo
const pixelOn = () => { try { return localStorage.getItem('bb-pixel') !== 'no'; } catch { return true; } };
const pixelScale = () => (innerWidth < 900 ? Math.min(1, PIXEL_SCALE * 1.5) : PIXEL_SCALE); // sugli schermi piccoli pixel più fini
function renderPixel() {
  const on = pixelOn();
  document.body.classList.toggle('noscan', !on);
  $('pixel').querySelectorAll('[data-px]').forEach(b => {
    b.setAttribute('aria-pressed', String(+b.dataset.px === +on));
    b.onclick = () => { try { localStorage.setItem('bb-pixel', +b.dataset.px ? 'si' : 'no'); } catch {} city.setPixel(+b.dataset.px ? pixelScale() : 0); renderPixel(); };
  });
}
function renderQuality() { // grafica: Auto scende da sola se il computer fatica
  const q = city.quality();
  $('quality').innerHTML = Object.keys(QUALITY).map(k => `<button data-q="${k}" aria-pressed="${k === q.level}">${QUALITY[k].label}</button>`).join(''); // in automatico si accende il livello in uso
  $('quality').querySelectorAll('[data-q]').forEach(b => (b.onclick = () => { city.setQuality(b.dataset.q); try { localStorage.setItem('bb-quality', b.dataset.q); } catch {} renderQuality(); }));
}

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
    case 'activeTown': return leadTowns(s, seat);
    case 'placeTown': return emptyTowns(s, pd.region);
    case 'loseTown': return ownTowns(s, pd.victim);
    case 'monastery': return ownTowns(s, seat).filter(id => !s.towns[id].monastery);
    case 'action': { // con l'opzione scelta lampeggiano subito gli spot dove espandersi o i presidi da togliere
      if (ui.pick) return ui.pick === 'expand' ? expandTargets(s, seat) : vikingTowns(s);
      const sy = actionSyms(s, pd);
      return [...(sy.includes('E') && s.players[seat].coins + sy.filter(x => x === 'C').length >= 5 ? expandTargets(s, seat) : []), ...(sy.includes('V') ? vikingTowns(s) : [])];
    }
  }
  return [];
}
// clic su uno spot: è solo una scelta provvisoria, si cambia cliccando altrove e si conferma col pulsante (o giocando la carta)
// simboli dell'azione che si sta scegliendo (per far lampeggiare righe della plancia e spot della mappa)
function actionSyms(s, pd) {
  if (pd?.type !== 'action' || pd.p !== seat || showing || ui.opt == null) return [];
  const card = CARDS[pd.card];
  return (ui.opt === 'p' ? card.primary : card.secondary[ui.opt]) || [];
}
const SHORT_SYM = { T: 'quartiere', C: '+1 credito', P: '−1 credito', M: '+1 hype', A: '+1 guerrilla', X: '+1 community', V: 'via un presidio', R: '+1 street cred' };
// testo esatto di un simbolo ripetuto n volte: "+3 crediti", non "+1 credito"
function exactText(x, n, pl) {
  switch (x) {
    case 'C': return n > 1 ? `+${n} crediti` : '+1 credito';
    case 'P': return pl.coins >= n ? `Paghi ${n} ${n > 1 ? 'crediti' : 'credito'}` : `Paghi ${n} ${n > 1 ? 'crediti' : 'credito'}: ne hai ${pl.coins}, il resto lo paghi con 2 punti vittoria l'uno`;
    case 'M': return `Sali di ${n} nell'hype (2 crediti per ogni passo in più)`;
    case 'A': return `Neutralizzi ${n} unità di polizia`;
    case 'X': return `+${n} alla comunità`;
    case 'R': return `+${n} street cred`;
    default: return SYMBOLS[x];
  }
}
const FLASH_ROW = { C: 'crediti', P: 'crediti', E: 'crediti', A: 'guerrilla', X: 'community', R: 'punti' };
function onTown(town) {
  const pd = current(state);
  if (pd?.type === 'action') { const k = ui.pick || (expandTargets(state, seat).includes(town) && actionSyms(state, pd).includes('E') ? 'expand' : 'viking'); ui[k] = town; ui.pick = null; } else ui.town = town;
  render();
}

const WKEYS = Object.keys(WEATHER_TYPES);
const who = (s, p) => `<b class="who" style="--pc:${THEME.players[p]}">${esc(s.players[p].name)}</b>`;
const characterIndex = c => (c?.princess ? 'estrid' : MARRIAGES.findIndex(m => JSON.stringify(m) === JSON.stringify(c)));
const characterName = c => (!c ? 'il personaggio' : c.princess ? 'IA libera' : `+${c.points} punti${c.renown ? ' +1 street cred' : ''}${c.region ? ' · ' + REGIONS[c.region].name : ''}`); // le carte Hype non hanno nome: si descrivono con l'effetto
const townChip = id => { const t = TOWNS[id], su = THEME.suit[t.color]; return `<b class="chip" style="--sc:${su.fill};--si:${su.ink}">${esc(t.name)}</b>`; };

// ---------- fasi del round ----------
const PHASES = [['prep', 'Preparazione'], ['draft', 'Draft'], ['trick', 'Azioni'], ['party', 'Underground Party'], ['guerrilla', 'Guerrilla'], ['community', 'Community Projects'], ['uprising', 'Uprising']];
let phaseNow = null;
const PEND_PHASE = { setupTown: 'prep', draft: 'draft', activeTown: 'trick', play: 'trick', action: 'trick', princess: 'party', placeTown: 'party', loseTown: 'guerrilla', monastery: 'community' };
function renderPhases(s, pd) {
  const cur = showing ? SHOW_PHASE[showing.k] || showing.k : pd ? PEND_PHASE[pd.type] : 'uprising';
  phaseNow = cur;
  const SHORT = { party: 'Party', guerrilla: 'Guerrilla', community: 'Community', uprising: 'Uprising' }; // nomi brevi quando lo schermo è stretto
  $('phases').innerHTML = PHASES.map(([k, l], i) => `<span class="chev${k === cur ? ' on' : ''}${i >= 3 ? ' up' : ''}" data-short="${SHORT[k] || l}"${k === cur ? ' aria-current="step"' : ''}>${l}<span class="pos"> · ${i + 1} di ${PHASES.length}</span></span>`).join('');
  $('phases').querySelector('.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
}

// ---------- racconto dell'upkeep: un evento alla volta, a passi ----------
let seenN = null, queue = [], showing = null, step = 0, timer = null;
function ingestEvents(s) {
  const n = s.eventN || 0;
  if (seenN === null) { seenN = n; return; } // entrando a partita in corso non si rivede il passato
  queue.push(...(s.events || []).filter(e => e.n > seenN)); seenN = n;
  if (!showing) nextEvent();
}
function tick() { clearTimeout(timer); } // niente avanza da solo: serve sempre Avanti
function nextEvent() { showing = queue.shift() || null; step = 0; clearTimeout(timer); if (showing) tick(); if (state) render(); }
function advance() {
  if (!showing) return;
  if (step + 1 >= steps(showing).length && ACK_ALL.has(showing.k)) { // preparazione e party: tutti devono cliccare Avanti
    acked = showing.n; if (!local && room) net.ack(roomCode, showing.n);
    if (waitingAcks().length) { render(); return; }
  }
  if (++step >= steps(showing).length) nextEvent(); else { tick(); render(); }
}
// chi deve ancora cliccare Avanti alla fine del party (in locale lo schermo è uno solo: basta un clic)
let acked = null;
function waitingAcks() {
  if (!showing || !ACK_ALL.has(showing.k) || local || !room) return [];
  return room.players.map((p, i) => [p, i]).filter(([p]) => (room.acks?.[p.uid] ?? -1) < showing.n).map(([, i]) => i);
}
const ACK_ALL = new Set(['prep', 'party']);
const SHOW_PHASE = { setup: 'prep' };
function checkAcks() { if (ACK_ALL.has(showing?.k) && acked === showing.n && !waitingAcks().length) { acked = null; nextEvent(); } }

function hypeTrack(pos, { mark = null, note = '' } = {}) { // pos[i] = casella del giocatore i (0..9)
  return `<div class="track">${MARRIAGE_TRACK.map((b, c) => `<div class="cell${c === mark ? ' mark' : ''}" title="Casella ${c + 1}">
    <span class="b">${b === 'CC' ? icon('C', 13) + icon('C', 13) : b ? icon(b, 14) : ''}</span>
    <span class="tok">${pos.map((p, i) => (p === c ? `<i style="--pc:${THEME.players[i]}" title="${esc(state.players[i].name)}"></i>` : '')).join('')}</span></div>`).join('')}</div>${note}`;
}
// track dell'hype in orizzontale con le pedine posizionate: si possono animare (zoom d'ingresso, pedina che torna indietro)
function partyTrack(pos, { zoom = false, hi = null, from = {}, bonus = null } = {}) {
  const cells = MARRIAGE_TRACK.map((b, c) => `<div class="pc${b ? ' bonus' : ''}${bonus !== null && pos[bonus] === c ? ' got' : ''}"><span class="n">${c + 1}</span><span class="b">${b === 'CC' ? icon('C', 12) + icon('C', 12) : b ? icon(b, 13) : ''}</span></div>`).join('');
  const stack = {};
  const toks = pos.map((p, i) => { const k = stack[p] = (stack[p] ?? -1) + 1; return `<i class="pt${i === hi ? ' hi' : ''}" style="--pc:${THEME.players[i]};--x:${p};--y:${k};${from[i] != null ? `--fx:${from[i]};` : ''}"${from[i] != null ? ' data-move' : ''} title="${esc(state.players[i].name)}"></i>`; }).join('');
  return `<div class="ptrack${zoom ? ' zoom' : ''}"><div class="cells">${cells}</div>${toks}</div>`;
}
const BONUS = { C: '+1 credito', CC: '+2 crediti', R: '+1 street cred', T: 'prende un quartiere libero a scelta' };
function steps(e) {
  const s = state, list = arr => arr.join('');
  switch (e.k) {
    case 'setup': return [{ t: `${esc(s.players[e.p].name)} parte da ${esc(TOWNS[e.town].name)}`, b: `<p>${who(s, e.p)} sceglie ${townChip(e.town)} in <b>${REGIONS[TOWNS[e.town].region].name}</b>. <button class="btn ghost small goto" data-goto="${e.town}">Portami lì</button></p>` }];
    case 'prep': return [{ t: `Round ${e.round}${e.final ? ' · ultimo' : ''}`, b: `<div class="prep"><div class="pol">${logo('polizia', 34)}<b>+${e.police}</b><span class="cap">polizia in arrivo · in allerta ${e.area}</span></div>
      <div class="hy"><span class="cap">In Hype</span>${hypeCardHTML(e.character, s)}</div></div>` }];
    case 'party': { // la track in orizzontale si avvicina; dal più avanti: usa la carta, torna all'inizio, gli altri prendono i bonus
      const c = e.card, W = e.winner, after = e.track.map((p, i) => (i === W ? 0 : p));
      if (W === null) return [{ t: 'Underground Party', b: partyTrack(e.track, { zoom: true }) + '<p>Nessuno ha hype: il personaggio se ne va.</p>' }];
      const eff = c.princess ? 'sceglie come usare la Regina Estrid' : `+${c.points} punti${c.renown ? ', +1 street cred' : ''}${c.region ? `, un quartiere in ${REGIONS[c.region].name}` : ''}`;
      const order = s.players.map((p, i) => i).filter(i => i !== W).sort((a, b) => e.track[b] - e.track[a]);
      const bonusOf = i => e.bonuses.find(x => x.p === i)?.b;
      const res = (upto, cardHi) => `<div class="partyres"><figure class="${cardHi ? 'hi' : ''}">${characterSVG(characterIndex(c))}</figure><table class="ptable">
        <tr class="win${upto >= 0 ? ' on' : ''}"><td>${who(s, W)}</td><td>${upto >= 0 ? `ingaggia il personaggio: ${eff}${upto >= 1 ? ' · torna alla casella 1' : ''}` : 'ottiene più hype'}</td></tr>
        ${order.map((i, k) => `<tr class="${upto >= 2 + k ? 'on' : 'dim'}"><td>${who(s, i)}</td><td>${upto >= 2 + k ? (bonusOf(i) ? BONUS[bonusOf(i)] : 'nessun bonus') + ' · resta dov\'è' : ''}</td></tr>`).join('')}</table></div>`;
      const out = [
        { t: 'Underground Party', b: partyTrack(e.track, { zoom: true }) + '<p>Chi è più avanti nell\'hype ingaggia il personaggio.</p>' },
        { t: `${esc(s.players[W].name)} ottiene più hype`, b: partyTrack(e.track, { hi: W }) + res(0, true) },
        { t: `${esc(s.players[W].name)} torna all'inizio`, b: partyTrack(after, { hi: W, from: { [W]: e.track[W] } }) + res(1) },
      ];
      order.forEach((i, k) => out.push({ t: bonusOf(i) ? `${esc(s.players[i].name)}: ${BONUS[bonusOf(i)]}` : `${esc(s.players[i].name)}: nessun bonus`,
        b: partyTrack(after, { hi: i, bonus: i }) + res(2 + k) }));
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

let pendKey = null, mapPicking = false, framedKey = null, lastSaid = '';
function render() {
  const f = document.activeElement, fkey = f && (f.id ? '#' + f.id : f.dataset?.c ? `[data-c="${f.dataset.c}"]` : f.dataset?.o ? `[data-o="${f.dataset.o}"]` : f.dataset?.x ? `[data-x="${f.dataset.x}"]` : null);
  const s = state, pd = current(s);
  const key = JSON.stringify(pd) + (pd?.type === 'draft' ? s.draft.packets.join('|') : '');
  if (key !== pendKey) { pendKey = key; if (!local || pd?.type !== 'draft') ui = {}; } // nuova decisione: via le scelte provvisorie
  if (local && !isBot(actorOf(s, pd)) && actorOf(s, pd) >= 0) human = actorOf(s, pd);
  seat = local ? human : room.players.findIndex(p => p.uid === net.uid()); // in locale si vede sempre la mano di una persona, mai quella dei bot
  botTurn(s, pd);
  $('code').textContent = local ? 'partita locale' : `partita ${roomCode}`;
  city.update({ towns: s.towns, activeTown: s.trick?.town ?? null, claims: s.claims, names: s.players.map(p => p.name) });
  // si illumina solo la scelta provvisoria di chi sta giocando: finito il suo turno, si spegne
  city.select(showing?.k === 'setup' ? showing.town : pd && pd.p === seat && !showing ? (ui.town ?? ui.expand ?? ui.viking ?? null) : null); // si vede il quartiere di partenza appena scelto
  const wk = WKEYS[(s.round * 5 + s.start * 3) % WKEYS.length]; // meteo diverso a ogni round, uguale per tutti
  if (city.weather() !== wk) city.setWeather(wk);
  const picks = clickable(s, pd);
  city.setClickable(picks, onTown);
  // scelta sulla mappa: pannello a striscia e camera sugli spot validi (una volta per scelta)
  mapPicking = picks.length > 0 && (pd.type !== 'action' || !!ui.pick);
  document.body.classList.toggle('map-pick', mapPicking);
  const pk = picks.length ? JSON.stringify([pd?.type, ui.pick, picks.length]) : null;
  if (pk && pk !== framedKey && picks.length < 30 && pd?.type !== 'action') city.frame(picks); // espansione: si segnalano gli spot, niente zoom
  framedKey = pk;
  document.querySelectorAll('[data-sort]').forEach(b => b.setAttribute('aria-pressed', b.dataset.sort === handSort));
  renderPhases(s, pd); renderBoard(s, pd); renderTurn(s, pd, wk); renderStage(s, pd); renderHand(s, pd);
  if (fkey) document.querySelector(fkey)?.focus({ preventScroll: true }); // il focus non si perde quando il pannello si aggiorna
  const said = $('stage').querySelector('h2')?.textContent || '';
  if (said !== lastSaid) { $('announce').textContent = said; lastSaid = said; } // lo screen reader sente solo il titolo nuovo
  $('log').innerHTML = [...s.log].reverse().map(l => `<li>${esc(l)}</li>`).join('');
}

// ---------- plancia a sinistra (schizzo): bande, hype, guerrilla, comunità, uprising ----------
const pdot = i => `<i class="pd" style="--pc:${THEME.players[i]}"></i>`;
const pname = (s, i) => `${pdot(i)}<b>${esc(s.players[i].name)}</b>`;
// carta del personaggio in hype: si apre di fianco alla plancia, senza coprire gli altri riquadri
// carta del personaggio in Hype: sempre visibile accanto alla plancia, sotto la barra delle fasi.
// Niente descrizione: nome, punti con la coppa, zona con il triangolo che ruota (e chi la controlla). Cliccandola si illumina la zona.
let hypeLit = false;
function hypeCardHTML(c, s) { // carta Hype senza nome: illustrazione, punti con la coppa, zona col triangolo 3D (e chi la controlla)
  const i = characterIndex(c), m = c.princess ? null : c, k = m?.region, own = k ? s.claims[k]?.owner ?? null : null;
  return `<span class="lab">Hype</span>${characterArt(i)}
    ${m ? `<span class="rw"><span>+${m.points}${logo('punti', 13)}</span>${m.renown ? `<span>+1 street cred</span>` : ''}</span>` : '<span class="rw">IA libera: tre scelte</span>'}
    ${k ? `<span class="zone"><i class="tri" style="--rc:${THEME.region[k]}" aria-hidden="true"><i></i><i></i><i></i><i></i></i>${REGIONS[k].name}${own !== null ? ` <em>(${esc(s.players[own].name)})</em>` : ''}</span>` : ''}`;
}
function renderHypeCard(s) {
  const el = $('hypecard'), c = s.marriage;
  el.hidden = !c; document.body.classList.toggle('has-hype', !!c);
  if (!c) { city?.highlight(null); return; }
  const k = c.princess ? null : c.region;
  el.innerHTML = hypeCardHTML(c, s);
  el.setAttribute('aria-pressed', String(hypeLit && !!k));
  el.title = k ? `Clic: illumina ${REGIONS[k].name} sulla mappa` : '';
  el.onclick = () => { if (!k) return; hypeLit = !hypeLit; city.highlight(hypeLit ? k : null); renderHypeCard(state); };
  city.highlight(hypeLit && k ? k : null);
}
function bindPeek(s) {
  const b = $('b-players').querySelector('.peek'), card = $('peekcard');
  card.hidden = true;
  if (!b) return;
  const show = on => {
    if (on) {
      card.innerHTML = characterSVG(characterIndex(s.marriage));
      const r = $('b-players').getBoundingClientRect();
      card.style.left = `${Math.min(r.right + 8, innerWidth - 196)}px`;
      card.style.top = `${Math.max(8, Math.min(r.top, innerHeight - 290))}px`;
    }
    card.hidden = !on;
  };
  b.onmouseenter = b.onfocus = () => show(true);
  b.onmouseleave = b.onblur = () => show(false);
  b.onclick = () => show(card.hidden);
}
let bigBoard = (() => { try { return localStorage.getItem('bb-board') === 'big'; } catch { return false; } })();
const shortName = n => ([...n].length > 7 ? [...n].slice(0, 6).join('') + '.' : n); // nomi lunghi: quello che ci sta, poi il punto
// iniziale della banda; se due coincidono (Bot 1, Bot 2) si aggiunge l'ultimo carattere: B1, B2
const initial = (s, i) => {
  const first = n => [...n][0]?.toUpperCase() || '?', me = first(s.players[i].name);
  return s.players.some((p, j) => j !== i && first(p.name) === me) ? me + [...s.players[i].name].at(-1) : me;
};
const BONUS_TIP = { C: '+1 credito', CC: '+2 crediti', R: '+1 street cred', T: 'un quartiere a scelta' };
function renderBoard(s, pd) {
  const waiting = !pd ? [] : pd.type === 'draft' ? s.draft.picks.flatMap((x, i) => (x ? [] : [i])) : [pd.p];
  const on = (id, k) => ($(id).className = `box${phaseNow === k ? ' on' : ''}`);
  // bande: griglia verticale, una colonna per banda e una riga per logo; accanto l'Hype in verticale.
  // Il tastino ingrandisce: compaiono i nomi (al massimo 7 caratteri, poi il punto) e i nomi dei loghi.
  $('b-players').classList.toggle('big', bigBoard); document.body.classList.toggle('board-big', bigBoard);
  const lab = kind => `${logo(kind, 16)}${bigBoard ? `<span class="lname">${LOGO_NAMES[kind]}</span>` : ''}`;
  const fl = new Set(actionSyms(s, pd).map(x => FLASH_ROW[x]));
  const row = (kind, key, k) => `<tr class="${phaseNow === k ? 'on' : ''}${fl.has(kind) ? ' flash' : ''}"><th scope="row">${lab(kind)}</th>${s.players.map(p => `<td${key === 'points' ? ' class="pts"' : ''}>${p[key]}</td>`).join('')}</tr>`;
  const tip = (p, i) => [p.name, isBot(i) ? 'bot' : i === seat && !local ? 'tu' : '', room.players[i]?.gang, `street cred ${p.renown}`, `${p.hand.length} carte in mano`,
    p.claims.length ? 'zone: ' + p.claims.map(r => REGIONS[r].name).join(', ') : '', p.marriages.length ? 'personaggi: ' + p.marriages.map(characterName).join(', ') : '',
    p.princess ? 'Estrid alleata' : '', i === s.active ? 'ha il segnalino del quartiere attivo' : ''].filter(Boolean).join(' · ');
  $('b-players').innerHTML = `<button class="zoom" type="button" aria-pressed="${bigBoard}" aria-label="${bigBoard ? 'Rimpicciolisci la plancia' : 'Ingrandisci la plancia'}">${bigBoard ? '−' : '+'}</button>
    <div class="vgrid"><table aria-label="Bande">
    <thead><tr><td></td>${s.players.map((p, i) => `<th scope="col"><span class="ini${waiting.includes(i) ? ' turn' : ''}" style="--pc:${THEME.players[i]}" title="${esc(tip(p, i))}">${esc(bigBoard ? shortName(p.name) : initial(s, i))}</span>${i === s.active ? `<i class="mk" title="Segnalino quartiere attivo">${icon('T', 11, 'currentColor', HOLE)}</i>` : ''}</th>`).join('')}</tr></thead>
    <tbody>${row('punti', 'points')}${row('crediti', 'coins')}${row('guerrilla', 'raiders', 'guerrilla')}${row('community', 'church', 'community')}</tbody>
    <tfoot><tr${phaseNow === 'guerrilla' ? ' class="on"' : ''}><th scope="row">${lab('polizia')}</th><td colspan="${s.players.length}">${s.area}</td></tr></tfoot>
    </table>
    <div class="vhype${phaseNow === 'party' ? ' on' : ''}${actionSyms(s, pd).includes('M') ? ' flash' : ''}" style="--np:${s.players.length}" role="img" aria-label="Hype: ${s.players.map(p => `${esc(p.name)} casella ${p.mar + 1}`).join(', ')}">${MARRIAGE_TRACK.map((b, c) => [b, c]).reverse().map(([b, c]) =>
      `<span class="vc${b ? ' bonus' : ''}" title="Hype ${c + 1}: ${b ? BONUS_TIP[b] : 'nessun bonus'}"><span class="g">${b ? icon(b === 'CC' ? 'C' : b, 10, 'currentColor', HOLE) + (b === 'CC' ? '<sup>2</sup>' : '') : ''}</span>${s.players.map((p, i) => (p.mar === c ? pdot(i) : '')).join('')}</span>`).join('')}</div></div>
    ${s.marriage ? `<p class="sub hypeline narrow-only">Hype: <b>${esc(characterName(s.marriage))}</b><button class="peek" type="button" aria-label="Vedi il personaggio: ${esc(characterName(s.marriage))}">${characterSVG(characterIndex(s.marriage))}</button></p>` : ''}`;
  $('b-players').querySelector('.zoom').onclick = () => { bigBoard = !bigBoard; try { localStorage.setItem('bb-board', bigBoard ? 'big' : 'small'); } catch {} render(); };
  bindPeek(s); renderHypeCard(s);
  // uprising: zone sbloccate e chi le tiene
  on('b-uprising', 'uprising');
  const up = Object.entries(s.claims).filter(([, c]) => c.up);
  $('b-uprising').innerHTML = `<h3>${logo('uprising')}Uprising <em>zone in palio</em></h3>${up.length ? `<ul>${up.map(([r, c]) =>
    `<li><i class="rz" style="--rc:${c.owner === null ? THEME.region[r] : THEME.players[c.owner]}"></i><b>${REGIONS[r].name}</b><span class="own">${c.owner === null ? 'contesa' : pname(s, c.owner)}</span></li>`).join('')}</ul>` : ''}`;
}

function renderTurn(s, pd, wk) {
  const total = s.players.length === 3 ? 3 : 4;
  const turn = !pd ? 'Partita finita' : pd.type === 'draft' ? `<span>Draft</span> ${s.draft.picks.flatMap((x, i) => (x ? [] : [pdot(i)])).join('')}` : `<span>Turno di</span> ${pname(s, pd.p)}${pd.p === seat && !local ? ' <small>tu</small>' : ''}`;
  $('turn').innerHTML = `<p class="big">${turn}</p><p class="sub">Round ${s.round} di ${total} · ${WEATHER_TYPES[wk]}</p>`;
}

const SUIT_WORD = { red: 'Guerrilla', blue: 'Community Projects', yellow: 'Underground Party' };
const coarse = matchMedia('(pointer: coarse)').matches; // su touch la carta in presa va confermata

function renderHand(s, pd) {
  const el = $('hand');
  if (seat < 0) { el.innerHTML = ''; return; }
  const card = (v, attrs = '', cls = '') => `<button class="card${cls}" data-c="${v}" ${attrs}>${cardSVG(v)}</button>`;
  if (pd?.type === 'draft' && !s.draft.picks[seat] && !showing) {
    const sel = ui.draft || [], kept = sorted(s.players[seat].hand);
    el.innerHTML = (kept.length ? `<div class="kept" aria-label="Carte già tenute"><span>Già tenute</span><div>${kept.map(v => `<figure>${cardSVG(v)}</figure>`).join('')}</div></div>` : '') +
      sorted(s.draft.packets[seat]).map((v, i) => card(v, `aria-pressed="${sel.includes(v)}" aria-keyshortcuts="${i + 1}"`)).join('');
    el.querySelectorAll('[data-c]').forEach(b => (b.onclick = () => {
      const v = +b.dataset.c;
      if (sel.includes(v)) ui.draft = sel.filter(x => x !== v);
      else if (sel.length < 2) ui.draft = [...sel, v];
      else return toast('Hai già 2 carte: togline una per cambiarla');
      render();
    }));
    return;
  }
  const hand = sorted(s.players[seat].hand), mine = pd && pd.p === seat && !showing;
  const choosingTown = mine && pd.type === 'activeTown', playing = mine && pd.type === 'play';
  const color = playing ? TOWNS[s.trick.town].color : choosingTown && ui.town != null ? TOWNS[ui.town].color : null;
  const leading = choosingTown || (playing && seat === s.trick.leader);
  const fits = v => [color, 'white'].includes(CARDS[v].color);
  const ok = v => (playing || (choosingTown && ui.town != null)) && (!leading || fits(v) || !hand.some(fits));
  const dim = v => !ok(v) && (playing || (choosingTown && ui.town != null)); // senza quartiere scelto le carte restano a colori
  el.innerHTML = hand.map((v, i) => card(v, `${ok(v) ? '' : 'aria-disabled="true"'} aria-pressed="${ui.armed === v}" aria-keyshortcuts="${i + 1}"`, dim(v) ? ' off' : '')).join('');
  el.querySelectorAll('[data-c]').forEach(b => (b.onclick = () => playCard(+b.dataset.c, ok, choosingTown)));
}
function playCard(v, ok, choosingTown) {
  if (!ok(v)) return choosingTown && ui.town == null ? toast('Prima scegli il quartiere attivo sulla mappa o dall\'elenco') : toast('Questa carta non si può giocare adesso');
  if (ui.armed !== v) { ui.armed = v; return render(); } // ogni scelta va confermata: il clic seleziona, il pulsante gioca
  if (choosingTown) act({ town: ui.town }, { card: v }); else act({ card: v });
}

function trickRow(s) {
  const t = s.trick;
  if (!t?.plays.length) return '';
  const now = current(s), acting = now?.type === 'action' || now?.type === 'play' ? now.p : null;
  return `<div class="trickrow">${t.plays.map(x => `<figure class="${t.winner === x.p ? 'win' : ''}${x.p === acting && now.type === 'action' && x.card === now.card ? ' now' : ''}" style="--pc:${THEME.players[x.p]}">${cardSVG(x.card)}<figcaption>${esc(s.players[x.p].name)}${t.winner === x.p ? '<em>vince la presa</em>' : ''}</figcaption></figure>`).join('')}</div>`;
}

function hypePreview(s, pl, syms, extra) { // dove arriva il disco sulla track, con la regola delle caselle occupate
  const nM = syms.filter(x => x === 'M').length;
  if (!nM) return '';
  const others = s.players.filter(o => o !== pl).map(o => o.mar);
  let pos = Math.min(9, pl.mar + nM + extra);
  const aim = pos;
  while (pos > 0 && others.includes(pos)) pos--;
  const note = pos === aim ? `<p>Arrivi alla casella <b>${pos + 1}</b>.</p>`
    : extra > 0 ? `<p class="warn" role="alert">Attenzione: paghi ${extra * 2} crediti ma la casella ${aim + 1} è occupata, scendi alla <b>${pos + 1}</b>.</p>`
    : `<p>La casella ${aim + 1} è occupata: scendi alla <b>${pos + 1}</b>. Con 2 crediti in più fai un passo in più.</p>`;
  return hypeTrack(s.players.map((o, i) => (o === pl ? pos : o.mar)), { mark: pos, note });
}

function endRecap(s) { // riepilogo di fine partita: come si è vinto
  const rank = s.players.map((p, i) => i).sort((a, b) => s.players[b].points - s.players[a].points);
  const towns = i => s.towns.filter(t => t.owner === i && !t.viking).length, projects = i => s.towns.filter(t => t.owner === i && t.monastery).length;
  return `<ol class="recap">${rank.map((i, k) => { const p = s.players[i]; return `<li class="${s.winner.includes(i) ? 'champ' : ''}">
    <span class="pos">${k + 1}</span>${pname(s, i)}<span class="num pts">${p.points}</span>
    <span class="facts">${towns(i)} quartieri · ${projects(i)} progetti · ${p.renown} street cred${p.claims.length ? ' · zone: ' + p.claims.map(r => REGIONS[r].name).join(', ') : ''}${p.marriages.length ? ' · ' + p.marriages.map(characterName).join(', ') : ''}</span></li>`; }).join('')}</ol>`;
}

function renderStage(s = state, pd = current(state)) {
  const el = $('stage');
  el.onclick = e => { const g = e.target.closest('[data-goto]'); if (g) city.focusTown(+g.dataset.goto); }; // "Portami lì"
  // titolo prima, informazioni di contorno sotto (niente etichetta sopra il titolo)
  const head = (h, meta = '', body = '') => `<h2>${h}</h2>${meta ? `<p class="meta">${meta}</p>` : ''}${body}`;
  const mineTurn = pd && pd.p === seat && !showing && !(pd.type === 'draft' && s.draft.picks[seat]);
  el.classList.toggle('mine', !!mineTurn || (pd?.type === 'draft' && seat >= 0 && !s.draft.picks[seat] && !showing));
  el.classList.toggle('compact', !!mapPicking);
  if (showing) {
    const st = steps(showing), cur = st[Math.min(step, st.length - 1)];
    el.innerHTML = head(cur.t, `${PHASES.find(p => p[0] === (SHOW_PHASE[showing.k] || showing.k))?.[1] || ''} · passo ${step + 1} di ${st.length}`, cur.b) +
      (waitingAcks().length && acked === showing.n ? `<p class="waitack">In attesa che clicchino Avanti: ${waitingAcks().map(i => `<span class="blink">${who(s, i)}</span>`).join(' ')}</p>`
        : `<div class="row end"><button class="btn small" id="next" aria-keyshortcuts="Space">Avanti</button></div>`);
    $('next') && ($('next').onclick = advance);
    return;
  }
  if (!pd) { // fine partita
    el.innerHTML = head(s.winner.length > 1 ? 'Pareggio' : `Vince ${esc(s.players[s.winner[0]].name)}`, 'Fine partita', endRecap(s));
    return;
  }
  const trick = trickRow(s);
  const mine = local ? `Tocca a ${esc(s.players[seat]?.name || '')}` : 'Tocca a te';
  if (pd.type === 'draft') {
    if (seat >= 0 && !s.draft.picks[seat]) {
      const n = (ui.draft || []).length;
      el.innerHTML = head('Scegli 2 carte', `Draft · ${mine}`,
        `<p>Tieni 2 carte dal mazzetto: le altre passano alla banda successiva. In basso a sinistra trovi quelle già tenute.</p>
         <button id="ok" class="btn wide" ${n === 2 ? '' : 'disabled'} aria-keyshortcuts="Enter">${n === 2 ? 'Tieni queste 2' : n === 1 ? 'Scegli ancora 1 carta' : 'Scegli 2 carte'}</button>`);
      $('ok').onclick = () => act({ cards: ui.draft });
    } else el.innerHTML = head('In attesa del draft', 'Draft', `<p>Stanno scegliendo: ${s.draft.picks.flatMap((x, i) => (x ? [] : [who(s, i)])).join(', ')}</p>`);
    return;
  }
  const town = s.trick?.town != null ? s.trick.town : null;
  if (pd.p !== seat) {
    const w = s.trick?.winner;
    el.innerHTML = trick + head(w != null && s.trick.plays.length === s.players.length ? `Presa a ${esc(s.players[w].name)}` : `Turno di ${esc(s.players[pd.p].name)}`,
      town != null ? `Quartiere attivo: ${townChip(town)} · ${REGIONS[TOWNS[town].region].name} <button class="btn ghost small goto" data-goto="${town}">Portami lì</button>` : '');
    return;
  }
  const picks = clickable(s, pd);
  const confirmTown = (title, text) => {
    el.innerHTML = head(title, mine, `<p>${text}</p><p class="pickline">Scelta: ${ui.town != null ? townChip(ui.town) : '<em>clicca uno spot evidenziato</em>'}</p>
      <button id="ok" class="btn wide" ${ui.town != null ? '' : 'disabled'} aria-keyshortcuts="Enter">Conferma</button>`);
    $('ok').onclick = () => act({ town: ui.town });
  };
  switch (pd.type) {
    case 'setupTown': return confirmTown('Quartiere di partenza', 'Uno spot libero in una zona senza altre bande. Puoi cambiare idea fino a Conferma.');
    case 'placeTown': return confirmTown(`Prendi un quartiere${pd.region ? ' in ' + REGIONS[pd.region].name : ''}`, 'Uno spot libero tra quelli evidenziati.');
    case 'loseTown': return confirmTown('Retata: un quartiere passa alla polizia', pd.victim === seat
      ? 'Scegli quale dei tuoi quartieri lasciare. Resta tuo sotto il presidio: lo riprendi rimuovendo il presidio con una carta di Briano Borro.'
      : `Scegli quale quartiere di ${esc(s.players[pd.victim].name)} viene presidiato.`);
    case 'monastery': return confirmTown('Avvia un progetto urbano', 'Scegli un tuo quartiere: conterà doppio per il controllo della zona.');
    case 'activeTown':
      el.innerHTML = head('Scegli il quartiere attivo', mine, `<p>Clicca uno spot libero di un colore che hai in mano (qualsiasi, se hai una carta di Briano Borro), poi <b>gioca una carta</b> di quel colore o di Briano Borro per confermare.</p>
        <p class="pickline">Scelta: ${ui.town != null ? `${townChip(ui.town)} · ${REGIONS[TOWNS[ui.town].region].name}` : '<em>nessuna</em>'}</p>
        ${ui.armed != null && ui.town != null ? `<button id="playarmed" class="btn wide">Gioca la carta ${ui.armed}</button>` : ''}`);
      bindArmed(true); return;
    case 'play': {
      const word = SUIT_WORD[TOWNS[town].color];
      el.innerHTML = trick + head('Gioca una carta', `${mine} · Quartiere attivo: ${townChip(town)} <button class="btn ghost small goto" data-goto="${town}">Portami lì</button>`,
        `${seat === s.trick.leader ? `<p>Apri tu: gioca ${word} o Briano Borro.</p>` : ''}
        ${ui.armed != null ? `<button id="playarmed" class="btn wide">Gioca la carta ${ui.armed}</button>` : ''}`);
      bindArmed(false); return;
    }
    case 'princess':
      el.innerHTML = head('Regina Estrid', mine, `<p>L'IA libera è dalla tua parte. Scegli come usarla:</p>
        <div class="choices">${['military', 'trade', 'spurn'].map(k => `<button class="btn ${ui.choice === k ? '' : 'ghost'}" data-c="${k}" aria-pressed="${ui.choice === k}">${ESTRID.options[k]}${k === 'spurn' ? ' (+4 punti)' : ''}</button>`).join('')}</div>
        <button id="ok" class="btn wide" ${ui.choice ? '' : 'disabled'} aria-keyshortcuts="Enter">${ui.choice ? 'Conferma: ' + ESTRID.options[ui.choice] : 'Scegli un\'opzione'}</button>
        <p class="note">${ESTRID.options.military}: i quartieri presidiati dalla polizia contano come tuoi per il controllo delle zone. ${ESTRID.options.trade}: contano come tuoi per il numero di zone a fine partita.</p>`);
      el.querySelectorAll('[data-c]').forEach(b => (b.onclick = () => { ui.choice = b.dataset.c; render(); }));
      $('ok').onclick = () => act({ choice: ui.choice });
      return;
  }
  // azione dopo la presa
  const card = CARDS[pd.card], pl = s.players[seat];
  const opts = pd.won ? [['p', card.primary]] : card.secondary.map((x, i) => [i, x]);
  if (opts.length === 1) ui.opt ??= opts[0][0]; // con più opzioni nessuna è scelta finché non la tocchi
  const syms = ui.opt == null ? [] : opts.find(o => o[0] === ui.opt)[1];
  const buy = syms.find(x => x === 'M'), maxExtra = Math.floor(pl.coins / 2);
  ui.extra = Math.min(ui.extra || 0, maxExtra);
  const count = k => syms.filter(x => x === k).length;
  const after = Math.max(0, pl.coins + count('C') - count('P')) - (buy ? ui.extra * 2 : 0) - (ui.expand != null ? 5 : 0); // il "paga" senza crediti costa punti, non blocca
  const title = pd.won ? `Presa vinta con ${pd.card}` : `Mossa di riserva con ${pd.card}`;
  if (mapPicking) { // scelta sulla mappa in corso: pannello ridotto a una striscia
    el.innerHTML = head(ui.pick === 'expand' ? 'Dove ti espandi?' : 'Quale presidio rimuovi?', `${title} · gli spot validi sono evidenziati`,
      `<div class="row end"><button class="btn ghost small" id="nopick">Annulla</button></div>`);
    $('nopick').onclick = () => { ui.pick = null; render(); };
    return;
  }
  el.innerHTML = trick + head(title, `${mine} · Carta ${pd.card}${s.trick?.town != null ? ` · ${townChip(s.trick.town)} <button class="btn ghost small goto" data-goto="${s.trick.town}">Portami lì</button>` : ''}`,
    `<div class="opts" role="radiogroup" aria-label="Azione">${opts.map(([k, sy]) => `<button class="opt" role="radio" data-o="${k}" aria-checked="${k === ui.opt}" aria-pressed="${k === ui.opt}">${k === 'p' ? '<small>Vinci</small>' : ''}${sy.map(x => `<span title="${SYMBOLS[x]}">${icon(x, 24, 'currentColor', HOLE)}</span>`).join('')}</button>`).join('')}</div>
    <ul class="explain">${[...new Set(syms)].map(x => `<li>${icon(x, 16, 'currentColor', HOLE)} ${exactText(x, count(x), pl)}</li>`).join('')}</ul>
    ${buy ? `<div class="stepper"><span>Passi extra, 2 crediti l'uno</span><button class="btn small" data-x="-1" aria-label="Un passo in meno">−</button><b>${ui.extra}</b><button class="btn small" data-x="1" aria-label="Un passo in più" ${ui.extra >= maxExtra ? 'disabled' : ''}>+</button></div>` : ''}
    ${hypePreview(s, pl, syms, buy === 'M' ? ui.extra : 0)}
    ${syms.includes('E') ? `<p><button class="btn ghost small" id="pick-e">${ui.expand != null ? 'Espansione: ' + esc(TOWNS[ui.expand].name) + ' (cambia)' : 'Scegli dove espanderti (facoltativo, 5 crediti)'}</button>${ui.expand != null ? ' <button class="link" id="no-e">annulla</button>' : ''}</p>` : ''}
    ${syms.includes('V') && vikingTowns(s).length ? `<p><button class="btn ghost small" id="pick-v">${ui.viking != null ? 'Presidio: ' + esc(TOWNS[ui.viking].name) + ' (cambia)' : 'Scegli il presidio da rimuovere'}</button></p>` : ''}
    <p class="balance">Crediti: <b>${pl.coins}</b> → <b class="${after < 0 ? 'neg' : ''}">${Math.max(0, after)}</b>${after < 0 ? ' · non bastano' : ''}</p>
    ${ui.opt == null ? '<p class="note">Scegli una delle opzioni: sulla plancia e sulla mappa lampeggia quello che cambia.</p>' : ''}
    <button id="ok" class="btn wide" aria-keyshortcuts="Enter" ${after < 0 || ui.opt == null ? 'disabled' : ''}>${ui.opt == null ? 'Scegli un\'opzione' : `Conferma: ${[...new Set(syms)].filter(x => x !== 'E' || ui.expand != null).map(x => (x === 'E' ? 'espansione a ' + esc(TOWNS[ui.expand].name) : (count(x) > 1 && 'CP'.includes(x) ? SHORT_SYM[x].replace('1 credito', count(x) + ' crediti') : SHORT_SYM[x].replace('1', count(x))))).join(' · ')}`}</button>`);
  el.querySelectorAll('[data-o]').forEach(b => (b.onclick = () => { ui = { opt: b.dataset.o === 'p' ? 'p' : +b.dataset.o }; render(); }));
  el.querySelectorAll('[data-x]').forEach(b => (b.onclick = () => { ui.extra = Math.max(0, Math.min(maxExtra, ui.extra + +b.dataset.x)); render(); }));
  $('pick-e') && ($('pick-e').onclick = () => { ui.pick = 'expand'; render(); });
  $('no-e') && ($('no-e').onclick = () => { ui.expand = null; render(); });
  $('pick-v') && ($('pick-v').onclick = () => { ui.pick = 'viking'; render(); });
  const move = { opt: ui.opt, extra: buy ? ui.extra : 0, expand: ui.expand ?? null, viking: ui.viking };
  const lost = Math.max(0, count('P') - (pl.coins + count('C'))) * 2; // simboli "paga" senza crediti: 2 punti vittoria l'uno
  $('ok').onclick = () => (lost ? (ui.review = true, render()) : act(move));
  if (ui.review) { // scelta importante: riepilogo con Annulla e Conferma prima di passare la mano
    el.innerHTML = trick + head('Paghi in punti vittoria', `${mine} · Carta ${pd.card}`, `<p>Non hai crediti abbastanza: perdi <b>${lost} punti vittoria</b> (da ${pl.points} a ${Math.max(0, pl.points - lost)}).</p>
      <div class="row end"><button class="btn ghost" id="undo">Annulla</button><button class="btn" id="ok" aria-keyshortcuts="Enter">Conferma</button></div>`);
    $('undo').onclick = () => { ui.review = false; render(); };
    $('ok').onclick = () => act(move);
  }
}
const HOLE = '#0d1114'; // il "foro" delle icone piene deve essere scuro su un pannello scuro
function bindArmed(choosingTown) {
  const b = $('playarmed');
  if (b) b.onclick = () => { const v = ui.armed; if (choosingTown) act({ town: ui.town }, { card: v }); else act({ card: v }); };
  const sel = $('spot');
  if (sel) sel.onchange = () => sel.value !== '' && onTown(+sel.value);
}

// ---------- tastiera: 1-9 carte, Invio conferma, Spazio avanza il racconto, Esc annulla ----------
addEventListener('keydown', e => {
  if ($('game').hidden || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
  if (e.key === ' ' && $('next')) { e.preventDefault(); advance(); return; }
  if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') { const ok = $('ok') || $('playarmed'); if (ok && !ok.disabled) { e.preventDefault(); ok.click(); } return; }
  if (e.key === 'Escape') { if (ui.pick) ui.pick = null; else if (ui.armed != null) ui.armed = null; else if (ui.town != null) ui.town = null; else return; render(); return; }
  if (/^[1-9]$/.test(e.key)) { const c = $('hand').querySelectorAll('.card')[+e.key - 1]; if (c) { e.preventDefault(); c.focus(); c.click(); } }
});

// aggancio per i test automatici nel browser (clic sugli spot senza dover mirare nel 3D)
window.__clickable = () => (state ? clickable(state, current(state)) : []);
window.__pick = town => onTown(town);
window.__ui = () => ui;
