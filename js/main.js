// Brian Boru · Milano 2077: accesso, lobby, amici e partita (online o locale).
import { move as applyMove, current, emptyTowns, leadTowns, ownTowns, expandTargets, vikingTowns, newGame } from './game/engine.js';
import { CARDS, MARRIAGES, TOWNS, REGIONS, MARRIAGE_TRACK } from './game/data.js';
import { THEME, THEME_REPLACED, PIXEL_SCALE } from './milano/theme.js';
import { cardSVG, characterSVG } from './milano/card.js';
import { icon, setIconSet } from './milano/icons.js';
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
$('to-lobby').onclick = () => {
  const b = $('to-lobby');
  if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Esci davvero?'; setTimeout(() => { delete b.dataset.sure; b.textContent = 'Lobby'; }, 3000); return; }
  delete b.dataset.sure; b.textContent = 'Lobby';
  if (local) { local = false; state = null; }
  show(!net || me ? 'lobby' : 'auth');
};

// ---------- partita ----------
async function enterGame(s) {
  if ($('game').hidden) show('game');
  if (!city) {
    $('loading').hidden = false;
    let quality = 'auto'; try { quality = localStorage.getItem('bb-quality') || 'auto'; } catch {}
    city = await createCity($('city'), $('labels'), { compass: $('compass'), quality, theme: THEME_REPLACED, pixel: innerWidth < 900 ? PIXEL_SCALE * 1.5 : PIXEL_SCALE }); // sugli schermi piccoli pixel più fini
    renderQuality();
    $('loading').hidden = true;
  }
  state = s; ingestEvents(s); render();
}
$('compass').onclick = () => city?.resetView();
$('help').onclick = () => {
  $('glossary-list').innerHTML = Object.entries(SYMBOLS).map(([k, t]) => `<li>${icon(k, 22, 'currentColor', HOLE)}<span>${t}</span></li>`).join('');
  $('glossary').showModal();
};
$('board-toggle').onclick = () => { const open = document.body.classList.toggle('board-open'); $('board-toggle').setAttribute('aria-expanded', open); };
function renderQuality() { // grafica: Auto scende da sola se il computer fatica
  const q = city.quality();
  $('quality').innerHTML = ['auto', ...Object.keys(QUALITY)].map(k => `<button data-q="${k}" aria-pressed="${k === q.setting}">${k === 'auto' ? `Auto${q.setting === 'auto' ? ' · ' + QUALITY[q.level].label : ''}` : QUALITY[k].label}</button>`).join('');
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
let phaseNow = null;
const PEND_PHASE = { setupTown: 'prep', draft: 'draft', activeTown: 'trick', play: 'trick', action: 'trick', princess: 'party', placeTown: 'party', loseTown: 'guerrilla', monastery: 'community' };
function renderPhases(s, pd) {
  const cur = showing ? showing.k : pd ? PEND_PHASE[pd.type] : 'uprising';
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
const STEP_MS = 4500;
const held = () => $('stage').matches(':hover, :focus-within'); // chi sta leggendo ferma il racconto
function tick() { clearTimeout(timer); timer = setTimeout(() => (held() ? tick() : advance()), STEP_MS); }
function nextEvent() { showing = queue.shift() || null; step = 0; clearTimeout(timer); if (showing) tick(); if (state) render(); }
function advance() { if (!showing) return; if (++step >= steps(showing).length) nextEvent(); else { tick(); render(); } }

function hypeTrack(pos, { mark = null, note = '' } = {}) { // pos[i] = casella del giocatore i (0..9)
  return `<div class="track">${MARRIAGE_TRACK.map((b, c) => `<div class="cell${c === mark ? ' mark' : ''}" title="Casella ${c + 1}">
    <span class="b">${b === 'CC' ? icon('C', 13) + icon('C', 13) : b ? icon(b, 14) : ''}</span>
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
      out.push({ t: `${esc(s.players[e.winner].name)} ingaggia ${characterName(e.card)}`, b: `<p>${who(s, e.winner)} è più avanti di tutti nell'hype.</p>` });
      out.push({ t: `${esc(s.players[e.winner].name)} riparte dall'inizio`, b: hypeTrack(after) });
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

let pendKey = null, mapPicking = false, framedKey = null, lastSaid = '';
function render() {
  const f = document.activeElement, fkey = f && (f.id ? '#' + f.id : f.dataset?.c ? `[data-c="${f.dataset.c}"]` : f.dataset?.o ? `[data-o="${f.dataset.o}"]` : f.dataset?.x ? `[data-x="${f.dataset.x}"]` : null);
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
  const picks = clickable(s, pd);
  city.setClickable(picks, onTown);
  // scelta sulla mappa: pannello a striscia e camera sugli spot validi (una volta per scelta)
  mapPicking = picks.length > 0 && (pd.type !== 'action' || !!ui.pick);
  document.body.classList.toggle('map-pick', mapPicking);
  const pk = picks.length ? JSON.stringify([pd?.type, ui.pick, picks.length]) : null;
  if (pk && pk !== framedKey && picks.length < 30) city.frame(picks);
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
const ascBy = (s, key) => s.players.map((p, i) => i).sort((a, b) => s.players[a][key] - s.players[b][key]);
const openRows = new Set();
// carta del personaggio in hype: si apre di fianco alla plancia, senza coprire gli altri riquadri
function bindPeek(s) {
  const b = $('b-party').querySelector('.peek'), card = $('peekcard');
  card.hidden = true;
  if (!b) return;
  const show = on => {
    if (on) {
      card.innerHTML = characterSVG(characterIndex(s.marriage));
      const r = $('b-party').getBoundingClientRect();
      card.style.left = `${Math.min(r.right + 8, innerWidth - 196)}px`;
      card.style.top = `${Math.max(8, Math.min(r.top, innerHeight - 290))}px`;
    }
    card.hidden = !on;
  };
  b.onmouseenter = b.onfocus = () => show(true);
  b.onmouseleave = b.onblur = () => show(false);
  b.onclick = () => show(card.hidden);
}
const BONUS_TIP = { C: '+1 credito', CC: '+2 crediti', R: '+1 street cred', T: 'un quartiere a scelta' };
function renderBoard(s, pd) {
  const waiting = !pd ? [] : pd.type === 'draft' ? s.draft.picks.flatMap((x, i) => (x ? [] : [i])) : [pd.p];
  const on = (id, k) => ($(id).className = `box${phaseNow === k ? ' on' : ''}`);
  // bande: in vista solo i punti vittoria; il resto si apre toccando la riga
  $('b-players').innerHTML = `<h3>Bande</h3><ul>${s.players.map((p, i) => `<li class="${waiting.includes(i) ? 'turn' : ''}"><details ${openRows.has(i) ? 'open' : ''} data-row="${i}"><summary>
      ${pname(s, i)}${i === seat && !local ? '<small>tu</small>' : ''}${i === s.active ? `<span class="mk" title="Segnalino quartiere attivo">${icon('T', 12, 'currentColor', HOLE)}</span>` : ''}
      <span class="num pts" title="Punti vittoria">${p.points}</span></summary>
      <dl class="more"><dt>Banda</dt><dd>${esc(room.players[i]?.gang || '')}</dd><dt>Street cred</dt><dd>${p.renown}</dd><dt>Carte in mano</dt><dd>${p.hand.length}</dd>
      ${p.claims.length ? `<dt>Zone</dt><dd>${p.claims.map(r => REGIONS[r].name).join(', ')}</dd>` : ''}${p.marriages.length ? `<dt>Personaggi</dt><dd>${p.marriages.map(characterName).join(', ')}</dd>` : ''}${p.princess ? '<dt>Estrid</dt><dd>alleata</dd>' : ''}</dl></details></li>`).join('')}</ul>`;
  $('b-players').querySelectorAll('details').forEach(d => (d.ontoggle = () => (d.open ? openRows.add(+d.dataset.row) : openRows.delete(+d.dataset.row))));
  // crediti: riquadro a parte, con la moneta gialla
  $('b-coins').innerHTML = `<h3>Crediti</h3><ul>${s.players.map((p, i) => `<li>${pname(s, i)}<span class="num coin">${icon('C', 15, THEME.suit.yellow.fill, HOLE)}${p.coins}</span></li>`).join('')}</ul>`;
  // underground party: solo caselle
  on('b-party', 'party');
  $('b-party').innerHTML = `<h3>Underground Party</h3><div class="party"><div class="cells">${MARRIAGE_TRACK.map((b, c) =>
    `<span class="cell${b ? ' bonus' : ''}" title="Casella ${c + 1}: ${b ? BONUS_TIP[b] : 'nessun bonus'}"><span class="g">${b ? icon(b === 'CC' ? 'C' : b, 11, 'currentColor', HOLE) + (b === 'CC' ? '<sup>2</sup>' : '') : ''}</span>${s.players.map((p, i) => (p.mar === c ? pdot(i) : '')).join('')}</span>`).join('')}</div>
    ${s.marriage ? `<button class="peek" type="button" aria-label="Vedi il personaggio: ${esc(characterName(s.marriage))}">${characterSVG(characterIndex(s.marriage))}</button>` : ''}</div>
    ${s.marriage ? `<p class="sub">Hype: <b>${esc(characterName(s.marriage))}</b></p>` : ''}`;
  bindPeek(s);
  // guerrilla: polizia totale, bande in ordine crescente di unità neutralizzate
  on('b-guerrilla', 'guerrilla');
  $('b-guerrilla').innerHTML = `<h3>Guerrilla</h3><p class="big">${icon('A', 16, 'currentColor', HOLE)} <span>Polizia in allerta</span> <b>${s.area}</b></p>
    <ol>${ascBy(s, 'raiders').map(i => `<li>${pname(s, i)}<span class="num">${s.players[i].raiders}</span></li>`).join('')}</ol>`;
  // community projects: bande in ordine crescente di comunità
  on('b-community', 'community');
  $('b-community').innerHTML = `<h3>Community Projects</h3>
    <ol>${ascBy(s, 'church').map(i => `<li>${pname(s, i)}<span class="num">${icon('X', 13, 'currentColor', HOLE)}${s.players[i].church}</span></li>`).join('')}</ol>`;
  // uprising: zone sbloccate e chi le tiene
  on('b-uprising', 'uprising');
  const up = Object.entries(s.claims).filter(([, c]) => c.up);
  $('b-uprising').innerHTML = `<h3>Uprising <em>zone in palio</em></h3>${up.length ? `<ul>${up.map(([r, c]) =>
    `<li><i class="rz" style="--rc:${THEME.region[r]}"></i><b>${REGIONS[r].name}</b><span class="own">${c.owner === null ? 'contesa' : pname(s, c.owner)}</span></li>`).join('')}</ul>` : '<p class="sub">Nessuna zona ancora in palio.</p>'}`;
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
  if (coarse && ui.armed !== v) { ui.armed = v; return render(); } // touch: primo tocco seleziona, il secondo (o il pulsante) gioca
  if (choosingTown) act({ town: ui.town }, { card: v }); else act({ card: v });
}

function trickRow(s) {
  const t = s.trick;
  if (!t?.plays.length) return '';
  return `<div class="trickrow">${t.plays.map(x => `<figure class="${t.winner === x.p ? 'win' : ''}" style="--pc:${THEME.players[x.p]}">${cardSVG(x.card)}<figcaption>${esc(s.players[x.p].name)}${t.winner === x.p ? '<em>vince la presa</em>' : ''}</figcaption></figure>`).join('')}</div>`;
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

// elenco degli spot validi: la stessa scelta della mappa, fattibile anche da tastiera e lettore di schermo
function spotPicker(ids, value) {
  if (!ids.length) return '';
  const byRegion = {};
  ids.forEach(id => (byRegion[TOWNS[id].region] ??= []).push(id));
  return `<label class="spotpick">Oppure dall'elenco <select id="spot"><option value="">Scegli…</option>${Object.entries(byRegion).map(([r, list]) =>
    `<optgroup label="${REGIONS[r].name}">${list.map(id => `<option value="${id}" ${id === value ? 'selected' : ''}>${esc(TOWNS[id].name)} · ${SUIT_WORD[TOWNS[id].color]}</option>`).join('')}</optgroup>`).join('')}</select></label>`;
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
  // titolo prima, informazioni di contorno sotto (niente etichetta sopra il titolo)
  const head = (h, meta = '', body = '') => `<h2>${h}</h2>${meta ? `<p class="meta">${meta}</p>` : ''}${body}`;
  const mineTurn = pd && pd.p === seat && !showing && !(pd.type === 'draft' && s.draft.picks[seat]);
  el.classList.toggle('mine', !!mineTurn || (pd?.type === 'draft' && seat >= 0 && !s.draft.picks[seat] && !showing));
  el.classList.toggle('compact', !!mapPicking);
  if (showing) {
    const st = steps(showing), cur = st[Math.min(step, st.length - 1)];
    el.innerHTML = head(cur.t, `${PHASES.find(p => p[0] === showing.k)?.[1] || ''} · passo ${step + 1} di ${st.length}`, cur.b) +
      `<div class="row end"><button class="btn ghost small" id="skipall">Salta tutto</button><button class="btn ghost small" id="skip">Salta questa fase</button><button class="btn small" id="next" aria-keyshortcuts="Space">Avanti</button></div>`;
    $('next').onclick = advance; $('skip').onclick = () => nextEvent(); $('skipall').onclick = () => { queue = []; nextEvent(); };
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
      town != null ? `Quartiere attivo: ${townChip(town)} · ${REGIONS[TOWNS[town].region].name}` : '');
    return;
  }
  const picks = clickable(s, pd);
  const confirmTown = (title, text) => {
    el.innerHTML = head(title, mine, `<p>${text}</p><p class="pickline">Scelta: ${ui.town != null ? townChip(ui.town) : '<em>clicca uno spot evidenziato</em>'}</p>${spotPicker(picks, ui.town)}
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
        <p class="pickline">Scelta: ${ui.town != null ? `${townChip(ui.town)} · ${REGIONS[TOWNS[ui.town].region].name}` : '<em>nessuna</em>'}</p>${spotPicker(picks, ui.town)}
        ${ui.armed != null && ui.town != null ? `<button id="playarmed" class="btn wide">Gioca la carta ${ui.armed}</button>` : ''}`);
      bindArmed(true); return;
    case 'play': {
      const word = SUIT_WORD[TOWNS[town].color];
      el.innerHTML = trick + head('Gioca una carta', `${mine} · Quartiere attivo: ${townChip(town)}`,
        `<p>Vince la carta di ${word} più alta, oppure una di Briano Borro.${seat === s.trick.leader ? ' Apri tu: gioca ' + word + ' o Briano Borro.' : ''}</p>
        ${ui.armed != null ? `<button id="playarmed" class="btn wide">Gioca la carta ${ui.armed}</button>` : ''}`);
      bindArmed(false); return;
    }
    case 'princess':
      el.innerHTML = head('Regina Estrid', mine, `<p>L'IA libera è dalla tua parte. Scegli come usarla:</p>
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
  const count = k => syms.filter(x => x === k).length;
  const after = pl.coins + count('C') - count('P') - (buy ? ui.extra * 2 : 0) - (ui.expand != null ? 5 : 0);
  const title = pd.won ? `Presa vinta con ${pd.card}` : `Mossa di riserva con ${pd.card}`;
  if (mapPicking) { // scelta sulla mappa in corso: pannello ridotto a una striscia
    el.innerHTML = head(ui.pick === 'expand' ? 'Dove ti espandi?' : 'Quale presidio rimuovi?', `${title} · gli spot validi sono evidenziati`,
      `${spotPicker(picks, ui[ui.pick])}<div class="row end"><button class="btn ghost small" id="nopick">Annulla</button></div>`);
    $('nopick').onclick = () => { ui.pick = null; render(); };
    return;
  }
  el.innerHTML = trick + head(title, `${mine} · Carta ${pd.card}`,
    `<div class="opts" role="radiogroup" aria-label="Azione">${opts.map(([k, sy]) => `<button class="opt" role="radio" data-o="${k}" aria-checked="${k === ui.opt}" aria-pressed="${k === ui.opt}"><small>${k === 'p' ? 'Vinci' : k ? 'Oppure' : 'Riserva'}</small>${sy.map(x => `<span title="${SYMBOLS[x]}">${icon(x, 24, 'currentColor', HOLE)}</span>`).join('')}</button>`).join('')}</div>
    <ul class="explain">${[...new Set(syms)].map(x => `<li>${icon(x, 16, 'currentColor', HOLE)} ${SYMBOLS[x]}</li>`).join('')}</ul>
    ${buy ? `<div class="stepper"><span>Passi extra, 2 crediti l'uno</span><button class="btn small" data-x="-1" aria-label="Un passo in meno">−</button><b>${ui.extra}</b><button class="btn small" data-x="1" aria-label="Un passo in più" ${ui.extra >= maxExtra ? 'disabled' : ''}>+</button></div>` : ''}
    ${hypePreview(s, pl, syms, buy === 'M' ? ui.extra : 0)}
    ${syms.includes('E') ? `<p><button class="btn ghost small" id="pick-e">${ui.expand != null ? 'Espansione: ' + esc(TOWNS[ui.expand].name) + ' (cambia)' : 'Scegli dove espanderti (facoltativo, 5 crediti)'}</button>${ui.expand != null ? ' <button class="link" id="no-e">annulla</button>' : ''}</p>` : ''}
    ${syms.includes('V') && vikingTowns(s).length ? `<p><button class="btn ghost small" id="pick-v">${ui.viking != null ? 'Presidio: ' + esc(TOWNS[ui.viking].name) + ' (cambia)' : 'Scegli il presidio da rimuovere'}</button></p>` : ''}
    <p class="balance">Crediti: <b>${pl.coins}</b> → <b class="${after < 0 ? 'neg' : ''}">${Math.max(0, after)}</b>${after < 0 ? ' · non bastano' : ''}</p>
    <button id="ok" class="btn wide" aria-keyshortcuts="Enter" ${after < 0 ? 'disabled' : ''}>Conferma</button>`);
  el.querySelectorAll('[data-o]').forEach(b => (b.onclick = () => { ui = { opt: b.dataset.o === 'p' ? 'p' : +b.dataset.o }; render(); }));
  el.querySelectorAll('[data-x]').forEach(b => (b.onclick = () => { ui.extra = Math.max(0, Math.min(maxExtra, ui.extra + +b.dataset.x)); render(); }));
  $('pick-e') && ($('pick-e').onclick = () => { ui.pick = 'expand'; render(); });
  $('no-e') && ($('no-e').onclick = () => { ui.expand = null; render(); });
  $('pick-v') && ($('pick-v').onclick = () => { ui.pick = 'viking'; render(); });
  $('ok').onclick = () => act({ opt: ui.opt, extra: buy ? ui.extra : 0, expand: ui.expand ?? null, viking: ui.viking });
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
