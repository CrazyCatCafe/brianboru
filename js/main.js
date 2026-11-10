// Brian Boru · Milano 2077: accesso, lobby, amici e partita (online o locale).
import { botMove } from './game/bot.js';
import { estridPreview, zoneControl, draftDir, move as applyMove, current, emptyTowns, leadTowns, ownTowns, expandTargets, vikingTowns, newGame } from './game/engine.js';
import { CARDS, MARRIAGES, TOWNS, REGIONS, MARRIAGE_TRACK } from './game/data.js';
import { THEME, THEME_REPLACED, PIXEL_SCALE } from './milano/theme.js';
import { cardSVG, characterSVG, characterArt, cardLabel } from './milano/card.js';
import { icon, setIconSet, logo, LOGO_NAMES, factionLogo, FACTION_COLORS } from './milano/icons.js';
import { ESTRID, SYMBOLS, FACTION_MOTTO } from './milano/lore.js';
import { createCity, WEATHER_TYPES, QUALITY } from './milano/city3d.js';
import { connect, BOT_NAMES } from './milano/online.js';
import { pixelSwap } from './milano/pixelfx.js';
import { createSfx } from './milano/sfx.js';

setIconSet('pixel'); // tutto in pixel art: simboli delle carte e loghi
const $ = id => document.getElementById(id);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const SCREENS = ['auth', 'nick', 'lobby', 'game'];
let actx = null, sfx = null, phaseNow = null, song = null, outGain = null; // audio e fase mostrata (servono già a show)
const show = name => { SCREENS.forEach(s => ($(s).hidden = s !== name)); $('loading').hidden = true; if (name !== 'game') { song?.pause(); song = null; phaseNow = null; } }; // fuori dalla partita: musica della lobby
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
const isBot = i => !!room?.players?.[i]?.bot;
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
// box del menu uno sotto l'altro: cliccando si apre il cassetto con le opzioni (uno alla volta, si ricorda l'ultimo)
const MENU_PX = {
  online: ['....##....', '...#..#...', '..#.##.#..', '....##....', '...####...', '....##....', '...#..#...', '..#....#..', '.#......#.', '##########'], // antenna
  locale: ['....oo....', '....##....', '.########.', '.#..##..#.', '.#.o##o.#.', '.########.', '.##....##.', '.########.', '..#....#..', '.###..###.'], // bot
  amici: ['..##...##.', '.####.####', '.####.####', '..##...##.', '..........', '.####.####', '##########', '##########', '##########', '##########'], // due persone
};
const menuIcon = (k, c) => `<svg viewBox="0 0 40 40" shape-rendering="crispEdges" aria-hidden="true">${MENU_PX[k].flatMap((r, y) => [...r].map((ch, x) => (ch === '#' || ch === 'o' ? `<rect x="${x * 4}" y="${y * 4}" width="4" height="4" fill="${ch === 'o' ? '#ffd400' : c}"/>` : ''))).join('')}</svg>`;
function renderMenuIcons() {
  document.querySelectorAll('.accb').forEach(sec => {
    const ic = sec.querySelector('[data-ic]'), k = ic.dataset.ic;
    if (k === 'profilo') { sec.style.setProperty('--c', FACTION_COLORS[gang()] === '#1b1b1b' ? '#cfd6dc' : FACTION_COLORS[gang()]); ic.innerHTML = factionLogo(gang(), 50); }
    else ic.innerHTML = menuIcon(k, getComputedStyle(sec).getPropertyValue('--c').trim());
  });
}
function openAcc(id, toggle = false) {
  document.querySelectorAll('.accb').forEach(sec => {
    const on = sec.id === id && !(toggle && sec.classList.contains('open'));
    sec.classList.toggle('open', on); sec.querySelector('.drawer').hidden = !on;
    sec.querySelector('.mhead').setAttribute('aria-expanded', String(on)); sec.querySelector('.arr').textContent = on ? '▾' : '▸';
  });
  try { localStorage.setItem('bb-acc', document.querySelector('.accb.open')?.id || ''); } catch {}
}
document.querySelectorAll('.accb .mhead').forEach(h => (h.onclick = () => openAcc(h.parentElement.id, true)));
// numero di bot: pulsanti al posto del menu a tendina
document.querySelectorAll('select[data-seg]').forEach(sel => {
  const seg = document.createElement('span'); seg.className = 'seg'; seg.setAttribute('role', 'group');
  const draw = () => { seg.innerHTML = [...sel.options].map(o => `<button type="button" aria-pressed="${o.value === sel.value}">${o.value}</button>`).join(''); seg.querySelectorAll('button').forEach(b => (b.onclick = () => { sel.value = b.textContent; draw(); })); };
  sel.hidden = true; sel.after(seg); draw();
});
if (!net) { renderMenuIcons(); openAcc('p-solo'); } // senza Firebase: solo la partita locale, già aperta
let lobbyReady = false, friends = [];
function enterLobby() {
  renderMenuIcons();
  let last = ''; try { last = localStorage.getItem('bb-acc') ?? ''; } catch {}
  openAcc(last && $(last) && getComputedStyle($(last)).display !== 'none' ? last : net ? 'p-create' : 'p-solo');
  show('lobby');
  $('me').innerHTML = `<b>${esc(me.nick)}</b>`;
  $('pf-nick').textContent = me.nick; $('sub-profile').textContent = me.nick; $('pf-mail').textContent = net.email();
  if ($('solo-name').value === 'Tu') $('solo-name').value = me.nick;
  const saved = localStorage.getItem('bb-gang'), sv = saved && document.querySelector(`[name=gang][value="${saved}"]`); if (sv) sv.checked = true;
  if (lobbyReady) return;
  lobbyReady = true;
  net.goOnline();
  net.watchFriends(list => { friends = list; renderFriends(); });
  net.watchInvites(renderInvites);
  net.watchMyGames(renderMyGames);
  const code = location.hash.slice(1).toUpperCase();
  if (/^[A-Z]{5}$/.test(code)) openRoom(code, true).catch(e => toast(friendly(e)));
}
document.querySelectorAll('#p-create [name=gang]').forEach(r => { // la stessa scelta anche nel cassetto Partita locale (offline c'è solo quello)
  const lab = r.parentElement.cloneNode(true), c = lab.querySelector('input'); c.name = 'gang-l'; c.id = '';
  $('gang-local').appendChild(lab);
  c.onchange = () => { r.checked = true; r.onchange(); };
});
const syncGang = () => document.querySelectorAll('[name=gang-l]').forEach(c => (c.checked = c.value === gang()));
document.querySelectorAll('[name=gang]').forEach(r => (r.onchange = () => { localStorage.setItem('bb-gang', gang()); renderMenuIcons(); syncGang(); }));
syncGang();

const otherGangs = () => FACTION_NAMES.filter(g => g !== gang());
document.querySelectorAll('[name=gang]').forEach(r => { r.insertAdjacentHTML('afterend', factionLogo(r.value, 42)); const c = FACTION_COLORS[r.value]; r.parentElement.style.setProperty('--fc', c === '#1b1b1b' ? '#cfd6dc' : c); }); // fazioni come box col loro logo e colore
$('create').onclick = guard(async () => openRoom(await net.createGame(gang(), +$('create-bots').value, otherGangs())));
async function openRoom(code, join = true) {
  if (join) await net.joinGame(code, gang());
  unwatch?.(); roomCode = code; location.hash = code; local = false; seenN = null; openAcc('p-create');
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
    <ol class="list">${room.players.map(p => `<li><span><b>${esc(p.nick)}</b> <em>${esc(p.gang)}</em>${p.uid === room.host ? ' <small>host</small>' : ''}${p.bot ? ' <small>bot</small>' : ''}</span>${p.bot && host ? `<button class="btn ghost small" data-rmbot="${p.uid}">Togli</button>` : ''}</li>`).join('')}</ol>
    ${host && room.players.length < 5 ? '<button class="btn ghost small" id="addbot">Aggiungi un bot</button>' : ''}
    <p class="note">Link da condividere: <a href="${location.href}">${esc(location.href)}</a></p>
    ${friends.filter(f => f.st === 'ok' && !inRoom.has(f.id)).map(f => `<button class="btn ghost small" data-inv="${f.id}">Invita ${esc(f.nick)}</button>`).join(' ')}
    <div class="row">${host ? `<button id="start" class="btn" ${room.players.length < 3 ? 'disabled' : ''}>Inizia (${room.players.length}/5)</button>` : '<span class="note">In attesa che l\'host avvii…</span>'}
      <button id="leave" class="btn ghost">${host ? 'Chiudi' : 'Esci'}</button></div>`;
  r.querySelectorAll('[data-inv]').forEach(b => (b.onclick = guard(async () => { await net.invite(b.dataset.inv, roomCode); toast('Invito inviato'); })));
  $('start') && ($('start').onclick = guard(() => net.startGame(roomCode)));
  $('addbot') && ($('addbot').onclick = guard(() => net.addBot(roomCode, otherGangs().find(g => !room.players.some(p => p.gang === g)) || '')));
  r.querySelectorAll('[data-rmbot]').forEach(b => (b.onclick = guard(() => net.removeBot(roomCode, b.dataset.rmbot))));
  $('leave').onclick = guard(async () => { await net.leaveGame(roomCode); leaveRoomUi(); });
}
// le mie partite: apri, cancella (se le hai create tu) o esci (se sei stato invitato)
const STATUS = { lobby: 'in attesa', play: 'in corso', end: 'finita' };
function renderMyGames(list) {
  const mine = g => g.host === net.uid(), live = list.filter(g => g.status === 'play').length;
  myGamesN = live; onlineSub();
  $('mygames').innerHTML = list.length ? list.map(g => `<li><span><b>${g.code}</b> · ${STATUS[g.status] || g.status} · ${g.players.map(p => esc(p.nick)).join(', ')}</span>
    <span><button class="btn small" data-open="${g.code}">Apri</button> <button class="btn ghost small" data-${mine(g) ? 'del' : 'out'}="${g.code}">${mine(g) ? 'Cancella' : 'Esci'}</button></span></li>`).join('') : '<li class="empty">Nessuna partita.</li>';
  $('mygames').querySelectorAll('[data-open]').forEach(b => (b.onclick = guard(() => openRoom(b.dataset.open))));
  $('mygames').querySelectorAll('[data-del]').forEach(b => (b.onclick = guard(async () => { if (confirm(`Cancellare la partita ${b.dataset.del} per tutti?`)) await net.closeGame(b.dataset.del); })));
  $('mygames').querySelectorAll('[data-out]').forEach(b => (b.onclick = guard(async () => {
    const g = list.find(x => x.code === b.dataset.out);
    if (!confirm(`Uscire dalla partita ${g.code}?`)) return;
    if (g.status === 'lobby') await net.leaveGame(g.code); else await net.hideGame(g.code);
  })));
}
let myGamesN = 0, invitesN = 0;
const onlineSub = () => ($('sub-online').textContent = [myGamesN ? `${myGamesN} ${myGamesN === 1 ? 'partita' : 'partite'} in corso` : '', invitesN ? `${invitesN} ${invitesN === 1 ? 'invito' : 'inviti'}` : ''].filter(Boolean).join(' · ') || 'Crea una partita e invita gli amici');
function renderInvites(list) {
  invitesN = list.length; onlineSub();
  $('invites').innerHTML = list.length ? list.map(i => `<li><span><b>${esc(i.from)}</b> ti invita (${esc(i.code)})</span>
    <span><button class="btn small" data-go="${esc(i.code)}">Entra</button> <button class="btn ghost small" data-no="${esc(i.code)}">Ignora</button></span></li>`).join('') : '<li class="empty">Nessun invito.</li>';
  $('invites').querySelectorAll('[data-go]').forEach(b => (b.onclick = guard(async () => { await openRoom(b.dataset.go); net.dismissInvite(b.dataset.go); })));
  $('invites').querySelectorAll('[data-no]').forEach(b => (b.onclick = guard(() => net.dismissInvite(b.dataset.no))));
}
function renderFriends() {
  const ok = friends.filter(f => f.st === 'ok'), on = ok.filter(f => f.online).length;
  $('sub-friends').textContent = ok.length ? `${ok.length} ${ok.length === 1 ? 'amico' : 'amici'} · ${on} online` : friends.length ? 'Richieste in sospeso' : 'Ancora nessun amico';
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
  const humans = [$('solo-name').value.trim() || 'Tu'], bots = +$('local-bots').value;
  const names = [...humans, ...Array.from({ length: bots }, (_, i) => BOT_NAMES[i])];
  unwatch?.(); unwatch = null; local = true; roomCode = null; human = 0; // una partita online lasciata aperta non deve più riportarti lì
  const gangs = [gang(), ...otherGangs()]; // tu la fazione scelta, i bot le altre: ognuno il colore della sua
  room = { players: names.map((nick, i) => ({ nick, gang: gangs[i], bot: i >= humans.length })) };
  seenN = null; enterGame(newGame(names));
});
$('to-lobby').onclick = () => {
  if (!confirm(local ? 'Uscire dalla partita? La partita locale andrà persa.' : 'Uscire dalla partita? Potrai rientrare dalla lobby.')) return;
  leaveGame();
};
// uscita dalla partita: si smette di seguirla (online) e si azzera tutto, così la prossima partita parte pulita
function leaveGame() {
  unwatch?.(); unwatch = null; roomCode = room = null; history.replaceState(null, '', location.pathname); $('room').hidden = true;
  local = false; state = null; clearTimeout(botTimer);
  showing = null; queue = []; step = 0; acked = null; seenN = null; ui = {};
  loading = false; loadDone = allReady = crashing = false; loadId++; $('loadscreen').hidden = true; ['stage', 'loadscreen'].forEach(k => { $(k).style.filter = ''; $(k).style.opacity = ''; }); $('loadscreen').classList.remove('last');
  show(!net || me ? 'lobby' : 'auth');
}

// ---------- meteo vero di Milano (Open-Meteo, senza chiave) ----------
// codice WMO → testo, icona e meteo della mappa 3D (che segue quello vero)
const WMO = [[0, 'Sereno', '☀', 'sereno'], [1, 'Poco nuvoloso', '🌤', 'sereno'], [3, 'Nuvoloso', '☁', 'nuvoloso'], [48, 'Nebbia', '🌫', 'nuvoloso'], [57, 'Pioggerella', '🌦', 'pioggia'],
  [67, 'Pioggia', '🌧', 'pioggia'], [77, 'Neve', '❄', 'nuvoloso'], [82, 'Rovesci', '🌧', 'pioggia'], [86, 'Neve', '❄', 'nuvoloso'], [99, 'Temporale', '⛈', 'temporale']];
let meteo = null;
async function loadMeteo() {
  try {
    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=45.4642&longitude=9.19&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&timezone=Europe%2FRome');
    const c = (await r.json()).current; meteo = { t: Math.round(c.temperature_2m), h: Math.round(c.relative_humidity_2m), v: Math.round(c.wind_speed_10m), w: WMO.find(([k]) => c.weather_code <= k) || WMO[0] };
  } catch { meteo = meteo || null; }
  renderMeteo();
  if (state && !$('game').hidden) render(); // la mappa cambia meteo con quello vero
}
// icone del meteo disegnate a linee, come nello schizzo: goccia (umidità), vento, e il cielo (sereno, nuvoloso, pioggia, temporale)
const MI = {
  goccia: '<path d="M10 2C7 7 4 10 4 13a6 6 0 0 0 12 0c0-3-3-6-6-11Z"/>',
  vento: '<path d="M2 7h11a3 3 0 1 0-3-3M2 12h15a3 3 0 1 1-3 3M2 17h7"/>',
  sereno: '<circle cx="10" cy="10" r="4"/><path d="M10 1v3M10 16v3M1 10h3M16 10h3M3.6 3.6l2.1 2.1M14.3 14.3l2.1 2.1M3.6 16.4l2.1-2.1M14.3 5.7l2.1-2.1"/>',
  nuvoloso: '<path d="M5 15h10a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.6 1.4A3 3 0 0 0 5 15Z"/>',
  pioggia: '<path d="M5 12h10a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.6 1.4A3 3 0 0 0 5 12Z"/><path d="M6 15l-1 3M10 15l-1 3M14 15l-1 3"/>',
  temporale: '<path d="M5 12h10a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.6 1.4A3 3 0 0 0 5 12Z"/><path d="M10 13l-2 3h3l-2 3"/>',
};
const mi = (k, t) => `<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${MI[k]}</svg>${t ? `<span>${t}</span>` : ''}`;
function renderMeteo() {
  const ora = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }).format(new Date()).replace(':', '.');
  $('b-meteo').innerHTML = `<b class="tit">Meteo</b><b class="where">Milano ${ora}</b>${meteo ? `<span class="row">
    <span class="mv" title="Umidità">${mi('goccia', meteo.h + '%')}</span><span class="mv" title="Vento">${mi('vento', meteo.v + ' km/h')}</span>
    <span class="mv sky" title="${meteo.w[1]}">${mi(meteo.w[3])}</span><b class="temp" title="Temperatura">${meteo.t}°</b></span>` : ''}`; // meteo non arrivato: restano luogo e ora, niente scritta d'errore
}
loadMeteo(); setInterval(loadMeteo, 15 * 60 * 1000); setInterval(renderMeteo, 30 * 1000);

// ---------- bot (partita locale) ----------
function botTurn(s, pd) {
  clearTimeout(botTimer);
  if (!pd || showing || loading || !isBot(actorOf(s, pd))) return;
  // online i bot li muove il computer di chi ha creato la partita; se lui non c'è, dopo un po' li muove un altro giocatore
  const delay = pd.type === 'draft' ? 800 : 1100, backup = !local && room?.host !== net?.uid();
  botTimer = setTimeout(async () => {
    const r = botMove(state); if (!r) return;
    if (!local) { try { await net.act(roomCode, r[1], r[0], state.moveN || 0); } catch (e) { if (e.message !== 'stale') console.error('bot', e); } return; }
    try { state = applyMove(state, r[0], r[1]); } catch (e) { console.error('bot', e); return; }
    ingestEvents(state); render();
  }, backup ? delay + 8000 + 2000 * Math.max(0, seat) : delay);
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
  state = s; if (s.setupDone || s.round) startSong(); ingestEvents(s); render(); // partita già cominciata: la musica parte subito
}
// carta riassuntiva: i numeri da 1 a 25 col loro colore (giallo, rosso, blu in colonna; Briano Borro su tutta la riga).
// In evidenza le carte che hai in mano, sbiadite quelle già giocate nel round.
const REF_ORDER = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12], [13], [14, 15, 16], [17, 18, 19], [20], [21], [22], [23, 24, 25]];
function renderRef() {
  const s = state, mine = new Set(s?.players[seat]?.hand || []);
  const played = new Set([...(s?.trick?.plays || []).map(x => x.card), ...(s?.playedRound || [])]);
  const chip = v => { const c = CARDS[v].color; return `<span class="rc ${c}${mine.has(v) ? ' mine' : ''}${played.has(v) ? ' gone' : ''}" title="${v} · ${cardLabel(v)}">${v}</span>`; };
  $('ref-grid').innerHTML = REF_ORDER.map(row => `<div class="rrow${row.length === 1 ? ' wide' : ''}">${row.map(chip).join('')}</div>`).join('');
}
// strumenti (grafica, pixel) riducibili a icona; si ricorda la scelta
$('tools').open = false; // si apre solo se la vuoi, sopra le altre box: non cambia la grandezza di niente
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
// ---------- audio: musica e effetti, ognuno con il suo Sì/No (la scelta resta sul dispositivo) ----------
const audioOn = k => { try { return localStorage.getItem('bb-' + k) !== 'no'; } catch { return true; } };
function audioWake() { // i browser non suonano prima di un clic: tutto parte al primo tocco
  if (!actx) {
    try { actx = new AudioContext(); } catch { return; }
    outGain = actx.createGain(); outGain.connect(actx.destination); // volume degli effetti
    sfx = createSfx(actx, outGain);
  }
  if (actx.state === 'suspended') actx.resume();
  outGain.gain.setTargetAtTime(volume() / 100, actx.currentTime, 0.05);
  if (song) { song.volume = volume() / 100; audioOn('music') ? song.play().catch(() => {}) : song.pause(); }
}
// volume generale 0-100, resta sul dispositivo
const volume = () => { try { const v = +localStorage.getItem('bb-vol'); return localStorage.getItem('bb-vol') === null ? 80 : Math.max(0, Math.min(100, v)); } catch { return 80; } };
// colonna sonora: una sola canzone, parte all'inizio della partita (Panoramica) e ricomincia quando finisce; uscendo si ferma
function startSong() {
  if (song) return;
  song = new Audio('assets/milano/audio/i-like-the-night.mp3'); song.loop = true; song.preload = 'auto';
  audioWake();
}
const sound = name => { if (sfx && audioOn('sfx')) sfx.play(name); };
addEventListener('pointerdown', e => { audioWake(); if (e.target.closest?.('button, .btn, summary')) sound('ui'); }, true);
function renderAudio() { // interruttori nel pannello "Grafica e audio" e nella Panoramica di gioco
  document.querySelectorAll('[data-aud]').forEach(g => g.querySelectorAll('[data-on]').forEach(b => {
    const k = g.dataset.aud; b.setAttribute('aria-pressed', String(+b.dataset.on === +audioOn(k)));
    b.onclick = () => { try { localStorage.setItem('bb-' + k, +b.dataset.on ? 'si' : 'no'); } catch {} audioWake(); renderAudio(); };
  }));
  document.querySelectorAll('[data-vol]').forEach(r => { r.value = volume(); r.oninput = () => { try { localStorage.setItem('bb-vol', r.value); } catch {} audioWake(); document.querySelectorAll('[data-vol]').forEach(o => o !== r && (o.value = r.value)); }; });
}
renderAudio();
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
  document.querySelectorAll('[data-quality]').forEach(el => {
    el.innerHTML = Object.keys(QUALITY).map(k => `<button data-q="${k}" aria-pressed="${k === q.level}">${QUALITY[k].label}</button>`).join(''); // in automatico si accende il livello in uso
    el.querySelectorAll('[data-q]').forEach(b => (b.onclick = () => { city.setQuality(b.dataset.q); try { localStorage.setItem('bb-quality', b.dataset.q); } catch {} renderQuality(); }));
  });
}

async function act(...moves) { // più mosse di fila (es. quartiere in gioco + carta)
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
const FLASH_ROW = { C: 'crediti', P: 'crediti', E: 'crediti', A: 'guerrilla', X: 'community', R: 'cred' };
function onTown(town) {
  const pd = current(state);
  if (pd?.type === 'action') { const k = ui.pick || (expandTargets(state, seat).includes(town) && actionSyms(state, pd).includes('E') ? 'expand' : 'viking'); ui[k] = town; ui.pick = null; } else ui.town = town;
  render();
}

const WKEYS = Object.keys(WEATHER_TYPES);
const who = (s, p) => `<b class="who" style="--pc:${THEME.players[p]}">${pmark(p)}${esc(s.players[p].name)}</b>`;
const characterIndex = c => (c?.princess ? 'estrid' : MARRIAGES.findIndex(m => JSON.stringify(m) === JSON.stringify(c)));
const characterName = c => (!c ? 'il personaggio' : c.princess ? 'IA libera' : `+${c.points} punti${c.renown ? ' +1 street cred' : ''}${c.region ? ' · ' + REGIONS[c.region].name : ''}`); // le carte Hype non hanno nome: si descrivono con l'effetto
const CHIP_BG = { blue: '#1666d0', red: '#d42424' }; // fondo più scuro dove la scritta è bianca: si legge (contrasto ≥ 4,5)
const townChip = id => { const t = TOWNS[id], su = THEME.suit[t.color]; return `<b class="chip" style="--sc:${CHIP_BG[t.color] || su.fill};--si:${su.ink}">${esc(t.name)}</b>`; };

// ---------- fasi del round ----------
const PHASES = [['prep', 'Preparazione'], ['draft', 'Draft'], ['trick', 'Azioni'], ['party', 'Underground Party'], ['guerrilla', 'Guerrilla'], ['community', 'Community Projects'], ['uprising', 'Uprising']];
const PEND_PHASE = { setupTown: 'setup', draft: 'draft', activeTown: 'trick', play: 'trick', action: 'trick', princess: 'party', placeTown: 'party', loseTown: 'guerrilla', monastery: 'community' };
const PHASE_LOGO = { draft: 'carte', trick: 'punti', party: 'hype', guerrilla: 'guerrilla', community: 'community', uprising: 'uprising', prep: 'polizia', setup: 'quartiere' };
function phaseBanner(k) {
  const name = [['setup', 'Setup'], ...PHASES].find(p => p[0] === k)?.[1];
  if (!name || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const el = $('phasebanner');
  el.innerHTML = `<div class="pb">${PHASE_LOGO[k] ? logo(PHASE_LOGO[k], 34) : ''}<b>${name}</b></div>`;
  el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); sound('phase');
  document.body.classList.add('phasefly'); // finché il cartello non arriva, il box non ha titolo
  clearTimeout(phaseBanner.t); phaseBanner.t = setTimeout(() => { document.body.classList.remove('phasefly'); pixelSwap(document.querySelector('#stage h2 .ttl') || document.querySelector('#stage h2'), name); }, 1700); // atterrato: il nome della fase si sgretola nel titolo vero
  requestAnimationFrame(() => { // il box viene disegnato dopo: si legge dove sta il suo titolo e ci si vola sopra
    const pb = el.querySelector('.pb'), h = document.querySelector('#stage h2 .phchip') || document.querySelector('#stage h2'), a = pb.getBoundingClientRect(), t = h?.getBoundingClientRect();
    const end = t && t.width ? `translate(${t.left - a.left}px, ${t.top + t.height / 2 - (a.top + a.height / 2)}px) scale(${Math.min(1, t.height / a.height * 1.4)})` : 'translateY(-140px) scale(.5)';
    const ease = 'cubic-bezier(.2, .8, .2, 1)';
    pb.animate([{ opacity: 0, transform: 'translateX(-40vw)', easing: ease }, { opacity: 1, transform: 'none', offset: .2 }, { opacity: 1, transform: 'none', offset: .62, easing: 'cubic-bezier(.6, 0, .3, 1)' }, { opacity: 1, transform: end, offset: .95 }, { opacity: 0, transform: end }],
      { duration: 1700, fill: 'both' });
  });
}
function renderPhases(s, pd) {
  const cur = showing ? SHOW_PHASE[showing.k] || showing.k : pd ? PEND_PHASE[pd.type] : 'uprising';
  if (cur !== phaseNow && phaseNow !== null) { if (!['prep', 'pregame'].includes(showing?.k)) phaseBanner(cur); // sulle schermate a tutto schermo niente banner
    hypeLit = false; city?.highlight(null); $('peekcard').hidden = true; } // cambio di fase: cartello grande, e si spegne l'illuminazione della fase prima
  phaseNow = cur;
  const SHORT = { party: 'Party', guerrilla: 'Guerrilla', community: 'Community', uprising: 'Uprising' }; // nomi brevi quando lo schermo è stretto
  const list = cur === 'setup' ? [['setup', 'Setup'], ...PHASES] : PHASES; // il setup si vede solo a inizio partita
  $('phases').innerHTML = list.map(([k, l], i) => `<span class="chev${k === cur ? ' on' : ''}${i >= list.length - 4 ? ' up' : ''}" data-short="${SHORT[k] || l}"${k === cur ? ' aria-current="step"' : ''}>${k === 'trick' && s.trick && s.stage === 'trick' ? (s.trick.last ? '<b class="lasttag">Ultima presa</b>' : `<small class="tn">presa ${s.trickNo} di ${s.tricksTotal}</small>`) : ''}${l}<span class="pos"> · ${i + 1} di ${list.length}</span></span>`).join('');
}

// ---------- racconto dell'upkeep: un evento alla volta, a passi ----------
let seenN = null, queue = [], showing = null, step = 0, timer = null;
function ingestEvents(s) {
  const n = s.eventN || 0;
  if (seenN === null) { seenN = s.round <= 1 && !s.trick && !s.players.some(p => p.hand.length) ? 0 : n; if (seenN === n) return; } // a inizio partita si vede tutto; entrando a partita in corso non si rivede il passato
  queue.push(...(s.events || []).filter(e => e.n > seenN)); seenN = n;
  if (!showing) nextEvent();
}
function tick() { clearTimeout(timer); } // niente avanza da solo: serve sempre Avanti
function nextEvent() { showing = queue.shift() || null; step = 0; clearTimeout(timer); if (showing) tick(); if (state) render(); }
function advance() {
  if (!showing) return;
  if (step + 1 >= steps(showing).length && ACK_ALL.has(showing.k)) { // preparazione e party: tutti devono cliccare Avanti
    acked = showing.n; if (!local && room) net.ack(roomCode, showing.n);
    if (!showing) return; // l'ultimo Avanti può aver già chiuso il racconto (aggiornamento immediato dal database)
    if (waitingAcks().length) { render(); return; }
  }
  if (++step >= steps(showing).length) endEvent(); else { tick(); render(); }
}
// fine di un racconto: dopo la Panoramica parte il caricamento con la canzone; la partita comincia allo stacco della musica
// Panoramica: canzone e caricamento partono subito, intanto tutti cliccano Pronto; si entra in gioco al 100% se sono tutti pronti, altrimenti appena l'ultimo clicca
let loadDone = false, allReady = false;
function endEvent() {
  if (showing?.k !== 'pregame') return nextEvent();
  allReady = true; if (loadDone) goGame(); else render();
}
// un secondo e mezzo prima di entrare: Panoramica e caricamento si sgretolano in pixel sempre più grossi
let crashing = false;
function goGame() {
  if (crashing) return; crashing = true; const id = loadId;
  const f = $('pxcrash'), [flood, comp, , , morph] = f.children, t0 = performance.now(), D = 1500;
  ['stage', 'loadscreen'].forEach(k => ($(k).style.filter = 'url(#pxcrash)'));
  (function step() {
    if (id !== loadId) return;
    const k = Math.min(1, (performance.now() - t0) / D), z = Math.round(2 + 46 * k * k); // lato del pixel che cresce
    flood.setAttribute('x', z / 2); flood.setAttribute('y', z / 2); comp.setAttribute('width', z); comp.setAttribute('height', z); morph.setAttribute('radius', z / 2);
    ['stage', 'loadscreen'].forEach(n => ($(n).style.opacity = String(1 - Math.max(0, k - 0.6) / 0.4)));
    if (k < 1) requestAnimationFrame(step); else startGame();
  })();
}
function startGame() {
  ['stage', 'loadscreen'].forEach(k => { $(k).style.filter = ''; $(k).style.opacity = ''; }); crashing = false;
  const el = $('loadscreen'); el.hidden = true; el.classList.remove('last'); el.querySelector('.lsline').textContent = '';
  loading = false; loadDone = allReady = false; nextEvent();
  const st = $('stage'); st.classList.remove('dropflash'); void st.offsetWidth; st.classList.add('dropflash'); // Scegli il quartiere di partenza, con un lampo
}
const DROP = 23.5; // secondi: lo stacco della canzone dopo l'intro
const LOAD_LINES = ['Analisi disparità di reddito e reclutamento forza lavoro sotto la soglia di povertà…', 'Mappatura quartieri, sincronizzazione droni di pattugliamento…',
  'Attivazione protocolli di riconoscimento facciale biometrico…', 'Perdita di autorità della Prefettura…', 'Addestramento unità paramilitari di quartiere…',
  'Rilevato evento catalizzatore ad alta tensione.', 'Prepararsi allo scontro.'];
let loading = false, loadId = 0;
function startLoading() {
  if (loading) return; loading = true; const id = ++loadId; // uscendo dalla partita il caricamento si ferma
  startSong(); song.currentTime = 0; audioWake(); // la canzone parte da capo con il caricamento
  const el = $('loadscreen'), line = el.querySelector('.lsline'), bar = el.querySelector('.lsbar'), fill = bar.querySelector('i'), pct = el.querySelector('.lspct');
  el.hidden = false;
  const t0 = performance.now(); let shown = -1, best = 0;
  (function tickLoad() {
    if (id !== loadId || !loading) return; // in gioco (o uscendo) il caricamento si ferma
    const wall = (performance.now() - t0) / 1000, t = song && !song.paused && song.currentTime > 0 ? Math.max(wall - 1.5, Math.min(wall + 1.5, song.currentTime)) : wall; // in pari con la musica (se suona), senza salti
    const k = Math.floor((t - 2.5) / 3), i = Math.max(0, Math.min(LOAD_LINES.length - 1, k)); // una frase ogni 3 secondi, l'ultima fino allo stacco
    if (t >= 2.5 && i !== shown) { shown = i; line.textContent = LOAD_LINES[i]; line.classList.remove('in'); void line.offsetWidth; line.classList.add('in'); if (i === LOAD_LINES.length - 1) el.classList.add('last'); }
    const x = Math.min(1, t / DROP), fake = Math.min(99, Math.round(100 * (x + 0.04 * Math.sin(t * 2.3) * (1 - x)))); // finto caricamento: avanza a strappi
    best = Math.max(best, fake); fill.style.width = best + '%'; pct.textContent = best + '%'; bar.setAttribute('aria-valuenow', best);
    if (allReady && t >= DROP - 1.5) goGame(); // tutti pronti: il crash finisce proprio allo stacco
    if (t < DROP) return requestAnimationFrame(tickLoad);
    fill.style.width = '100%'; pct.textContent = '100%'; bar.setAttribute('aria-valuenow', 100);
    loadDone = true; if (allReady) goGame(); else render(); // chi non ha cliccato Pronto fa aspettare tutti
  })();
}
// chi deve ancora cliccare Avanti alla fine del party (in locale lo schermo è uno solo: basta un clic)
let acked = null;
function waitingAcks() {
  if (!showing || !ACK_ALL.has(showing.k) || local || !room) return [];
  return room.players.map((p, i) => [p, i]).filter(([p]) => !p.bot && (room.acks?.[p.uid] ?? -1) < showing.n).map(([, i]) => i);
}
const ACK_ALL = new Set(['pregame', 'prep', 'party', 'final']);
const SHOW_PHASE = { pregame: 'setup', discard: 'trick', setup: 'setup', final: 'uprising', estrid: 'party' };
function checkAcks() { if (ACK_ALL.has(showing?.k) && acked === showing.n && !waitingAcks().length) { acked = null; endEvent(); } }

function hypeTrack(pos, { mark = null, note = '', me = -1, from = 0 } = {}) { // pos[i] = casella del giocatore i (0..9); la 0 (partenza) non si mostra
  const cells = MARRIAGE_TRACK.map((b, c) => (c === 0 ? '' : `<div class="hcell${c === mark ? ' mark' : ''}${b ? ' bonus' : ''}" title="Casella ${c}">
    <span class="b">${hypeBonus(b, c, 15)}</span><span class="tok">${pos.map((p, i) => (p === c && i !== me ? pmark(i) : '')).join('')}</span></div>`)).join('');
  const n = Math.max(1, mark - from), go = me >= 0 && mark > 0 // il tuo logo, grande, avanza casella per casella
    ? `<span class="hgo" style="--to:${mark - 1};--from:${from - 1};animation-duration:${n * 0.28}s;animation-timing-function:steps(${n}, end)">${pmark(me)}</span>` : '';
  return `<div class="htrk"><div class="hcells">${cells}</div>${go}</div>${note}`;
}
// guerrilla: casco della polizia con le unità in allerta e una barra per banda (unità neutralizzate), animabili
function guerBoard(e, order, vals, { grow = false, lose = new Set(), raid = false, gone = false, hi = null, from = null } = {}) {
  const s = state, max = Math.max(1, ...e.raiders, ...vals), his = [].concat(hi ?? []);
  return `<div class="gboard"><div class="gpol${raid ? ' raid' : ''}${gone ? ' gone' : ''}">${logo('polizia', 30)}<b>${e.area}</b><span>in allerta</span></div>
    <div class="gbars">${order.map(i => `<div class="gb${lose.has(i) ? ' lose' : ''}${his.includes(i) ? ' hi' : ''}"><span class="nm">${who(s, i)}</span>
      <span class="bar"><i style="--pc:${THEME.players[i]};--w:${vals[i] / max * 100}%;${from ? `--fw:${from[i] / max * 100}%` : ''}" class="${grow ? 'grow' : ''}${from ? ' shrink' : ''}"></i></span><b>${vals[i]}</b></div>`).join('')}</div></div>`;
}
// track dell'hype in orizzontale con le pedine posizionate: si possono animare (zoom d'ingresso, pedina che torna indietro)
// tabella del punteggio finale: colonne svelate fino a "upto", la colonna corrente accesa, totale che sale
const FINAL_COLS = e => [
  ['start', 'Punti in partita', i => e.start[i]], ['coins', 'Crediti', i => e.coins[i]], ['active', 'Fazione Attiva', i => e.active[i]],
  ['renown', 'Street cred', i => e.renown[i]], ['zones', 'Municipi', i => e.zonePts[i]], ['presence', 'Presenza', i => e.presence[i]],
];
function finalTable(e, cols, upto, zoneK = null) {
  const s = state, zonePart = i => (zoneK === null ? e.zonePts[i] : e.zones.slice(0, zoneK + 1).reduce((a, x) => a + (x.owner === i ? x.pts : x.half.includes(i) ? Math.floor(x.pts / 2) : 0), 0));
  const val = (c, i) => (c[0] === 'zones' ? zonePart(i) : c[2](i));
  const tot = i => cols.slice(0, Math.min(upto, 5) + 1).reduce((a, c) => a + val(c, i), 0);
  const order = s.players.map((p, i) => i).sort((a, b) => (upto >= 6 ? e.rank.indexOf(a) - e.rank.indexOf(b) : 0));
  return `<table class="ftable"><thead><tr><th></th>${cols.map((c, k) => `<th class="${k === upto ? 'cur' : ''}"${c[0] === 'active' ? ' title="Fazione Attiva"' : ''}>${c[1]}</th>`).join('')}<th>Totale</th></tr></thead>
    <tbody>${order.map(i => `<tr class="${upto >= 6 && e.winner.includes(i) ? 'champ' : ''}${i === seat ? ' me' : ''}"><td>${who(s, i)}${upto >= 6 && e.winner.includes(i) ? ' ' + logo('punti', 16) : ''}</td>${cols.map((c, k) => {
      const v = k > upto ? '' : val(c, i);
      return `<td class="${k === upto ? 'cur' : ''}${k === upto && v > 0 && k ? ' got' : ''}">${v === '' ? '' : k ? (v ? '+' + v : '·') : v}${k === 5 && k <= upto ? `<small> (${e.regions[i]} zone)</small>` : ''}</td>`;
    }).join('')}<td class="tot">${tot(i)}</td></tr>`).join('')}</tbody></table>`;
}
function tieNote(e) {
  const t = e.total, w = e.winner[0], second = e.rank[1];
  return t[second] === t[w] ? `<p>Pari punti con ${who(state, second)}: vince chi controlla più zone, poi chi ha più carte Hype.</p>` : `<p>${who(state, w)} vince con <b>${t[w]} punti</b>.</p>`;
}
function partyTrack(pos, { zoom = false, hi = null, from = {}, bonus = null } = {}) {
  const cells = MARRIAGE_TRACK.map((b, c) => `<div class="pc${b ? ' bonus' : ''}${bonus !== null && pos[bonus] === c ? ' got' : ''}"><span class="n">${c || 'Via'}</span><span class="b">${b === 'CC' ? icon('C', 12) + icon('C', 12) : b ? icon(b, 13) : ''}</span></div>`).join('');
  const stack = {};
  const toks = pos.map((p, i) => { const k = stack[p] = (stack[p] ?? -1) + 1; return `<i class="pt${i === hi ? ' hi' : ''}" style="--pc:${THEME.players[i]};--x:${p};--y:${k};${from[i] != null ? `--fx:${from[i]};` : ''}"${from[i] != null ? ' data-move' : ''} title="${esc(state.players[i].name)}">${factionLogo(gangOf(i), 10)}</i>`; }).join('');
  return `<div class="ptrack${zoom ? ' zoom' : ''}"><div class="cells">${cells}</div>${toks}</div>`;
}
const BONUS = { C: '+1 credito', CC: '+2 crediti', R: '+1 street cred', T: 'prende un quartiere libero a scelta' };
function steps(e) {
  const s = state, list = arr => arr.join('');
  switch (e.k) {
    case 'final': { // punteggio finale, una voce alla volta, con la tabella che si riempie
      const z = e.zones, cols = FINAL_COLS(e);
      const out = [{ t: 'Fine partita', b: finalTable(e, cols, 0) + '<p>Si contano i punti finali, una voce alla volta. Ognuno parte dai punti fatti in partita.</p>' }];
      out.push({ t: 'Crediti', b: finalTable(e, cols, 1) + (e.coinsTie ? '<p>Più fazioni pareggiano per i crediti: nessuno prende il punto.</p>' : `<p>${who(s, e.coins.indexOf(1))} ha più crediti: <b class="ptsup">+1 punto</b>.</p>`) });
      out.push({ t: 'Fazione Attiva', b: finalTable(e, cols, 2) + `<p>${who(s, e.active.indexOf(1))} è la Fazione Attiva: <b class="ptsup">+1 punto</b>.</p>` });
      out.push({ t: 'Street cred', b: finalTable(e, cols, 3) + '<p>Ogni street cred vale <b>1 punto</b>.</p>' });
      if (!z.length) out.push({ t: 'Municipi', b: finalTable(e, cols, 4) + '<p>Nessun municipio è in palio: nessun punto.</p>' });
      z.forEach((x, k) => out.push({ zone: x.r, t: `Municipio ${REGIONS[x.r].name}`, b: finalTable(e, cols, 4, k) + (x.owner !== null
        ? `<p>${who(s, x.owner)} controlla ${REGIONS[x.r].name}: <b class="ptsup">+${x.pts} punti</b>.</p>`
        : x.half.length ? `<p>Nessuno la controlla: ${x.half.map(i => who(s, i)).join(', ')} ${x.half.length > 1 ? 'pareggiano' : 'ha'} per più quartieri e ${x.half.length > 1 ? 'prendono' : 'prende'} metà dei punti: <b class="ptsup">+${Math.floor(x.pts / 2)}</b>.</p>`
        : '<p>Nessuna fazione ha quartieri qui: nessun punto.</p>') }));
      out.push({ t: 'Presenza nelle zone', b: finalTable(e, cols, 5) + `<p>Punti per il numero di zone in cui hai almeno un quartiere:</p><table class="ptable regscore"><tr><td>Zone</td>${['1–2', '3–4', '5', '6', '7', '8'].map(x => `<td>${x}</td>`).join('')}</tr><tr><td>Punti</td>${[0, 1, 3, 5, 7, 10].map(x => `<td>${x}</td>`).join('')}</tr></table>` });
      out.push({ t: e.winner.length > 1 ? 'Pareggio!' : `Vince ${esc(s.players[e.winner[0]].name)}!`, b: finalTable(e, cols, 6) + (e.winner.length > 1 ? '<p>Pari punti, zone controllate e carte Hype: vittoria condivisa.</p>' : tieNote(e)) });
      return out;
    }
    case 'estrid': return [{ t: `${esc(s.players[e.p].name)} e la Regina Estrid`, b: `<p>${who(s, e.p)} ha ingaggiato l'IA libera e sceglie <b>${ESTRID.options[e.choice]}</b>.</p><p>${{
      military: 'Scudo: a fine partita i quartieri presidiati dalla polizia contano come suoi per il controllo delle zone in palio.',
      trade: 'Rete: a fine partita i quartieri presidiati dalla polizia contano come suoi per il numero di zone in cui è presente.',
      spurn: 'La lascia libera e prende subito <b class="ptsup">+4 punti</b>.' }[e.choice]}</p>` }];
    case 'discard': return [{ t: 'Fine delle azioni', b: `<p>Ognuno scarta la carta che gli è rimasta in mano.</p><div class="trickrow discards">${e.cards.map((cs, i) => cs.map(v => `<figure style="--pc:${THEME.players[i]}">${miniCard(v)}<figcaption>${pmark(i)}${esc(s.players[i].name)}</figcaption></figure>`).join('')).join('')}</div>` }];
    case 'pregame': return [{ vs: true, t: 'Panoramica di gioco', b: '' }];
    case 'setup': return [{ t: `${esc(s.players[e.p].name)} parte da ${esc(TOWNS[e.town].name)}`, b: `<p>${who(s, e.p)} sceglie ${townChip(e.town)} in <b>${REGIONS[TOWNS[e.town].region].name}</b>. <button class="btn ghost small goto" data-goto="${e.town}">Portami lì</button></p>` }];
    case 'prep': return [{ vs: true, t: `Round ${e.round}`, b: '' }]; // tra un round e l'altro: punteggi provvisori, Fazione Attiva, polizia e Hype
    case 'party': { // la track in orizzontale si avvicina; dal più avanti: usa la carta, torna all'inizio, gli altri prendono i bonus
      const c = e.card, W = e.winner, after = e.track.map((p, i) => (i === W ? 0 : p));
      if (W === null) return [{ t: 'Underground Party', b: partyTrack(e.track, { zoom: true }) + '<p>Nessuno ha hype: il personaggio se ne va.</p>' }];
      const eff = c.princess ? 'sceglie come usare la Regina Estrid' : `+${c.points} punti${c.renown ? ', +1 street cred' : ''}${c.region ? `, un quartiere in ${REGIONS[c.region].name}` : ''}`;
      const order = s.players.map((p, i) => i).filter(i => i !== W).sort((a, b) => e.track[b] - e.track[a]);
      const bonusOf = i => e.bonuses.find(x => x.p === i)?.b;
      const res = (upto, cardHi) => `<div class="partyres"><figure class="${cardHi ? 'hi' : ''}">${characterSVG(characterIndex(c))}</figure><table class="ptable">
        <tr class="win${upto >= 0 ? ' on' : ''}"><td>${who(s, W)}</td><td>${upto >= 0 ? `ingaggia il personaggio: ${eff}${e.before && !c.princess ? ` · <b class="ptsup">punti ${e.before[W]} → ${e.before[W] + c.points}</b>` : ''}${upto >= 1 ? ' · torna alla partenza' : ''}` : 'ottiene più hype'}</td></tr>
        ${order.map((i, k) => `<tr class="${upto >= 2 + k ? 'on' : 'dim'}"><td>${who(s, i)}</td><td>${upto >= 2 + k ? (bonusOf(i) ? BONUS[bonusOf(i)] : 'nessun bonus') : ''}</td></tr>`).join('')}</table></div>`;
      const out = [
        { t: 'Underground Party', b: partyTrack(e.track, { zoom: true }) + '<p>Chi è più avanti nell\'hype ingaggia il personaggio.</p>' },
        { t: `${esc(s.players[W].name)} ottiene più hype`, b: partyTrack(e.track, { hi: W }) + res(0, true) },
        { t: `${esc(s.players[W].name)} torna all'inizio`, b: partyTrack(after, { hi: W, from: { [W]: e.track[W] } }) + res(1) },
      ];
      order.forEach((i, k) => out.push({ t: bonusOf(i) ? `${esc(s.players[i].name)}: ${BONUS[bonusOf(i)]}` : `${esc(s.players[i].name)}: nessun bonus`,
        b: partyTrack(after, { hi: i, bonus: i }) + res(2 + k) }));
      return out;
    }
    case 'guerrilla': { // animata: la polizia arriva, le barre delle unità neutralizzate crescono, retata, premi, ritirata
      const n = s.players.length, order = s.players.map((p, i) => i).sort((a, b) => e.raiders[a] - e.raiders[b]);
      const after = e.raiders.map((r, i) => (i === e.first ? 0 : r)).map((r, i) => (e.ties.includes(i) ? r - 1 : r));
      const lost = new Set(e.losses.map(l => l.victim));
      const out = [{ t: 'Guerrilla', b: guerBoard(e, order, e.raiders, { grow: true }) + `<p>Chi ha neutralizzato meno unità rischia la retata.</p>` }];
      out.push(e.area > 0
        ? { t: 'Retata!', b: guerBoard(e, order, e.raiders, { lose: lost, raid: true }) + `<p>${e.area} ${e.area === 1 ? 'poliziotto attacca' : 'poliziotti attaccano'}: ${e.raiders.every(r => r === 0) ? 'tutti sono a 0 in Guerrilla, tutti perdono un quartiere.' : 'chi ha la Guerrilla più bassa perde un quartiere.'}</p>` + (e.losses.length ? `<ul class="plain">${list(e.losses.map(l => `<li>${who(s, l.victim)} perde un quartiere${l.chooser !== l.victim ? ` · lo sceglie ${who(s, l.chooser)}` : ''}</li>`))}</ul>` : '<p>Nessuno ha quartieri da perdere.</p>') }
        : { t: 'Polizia respinta', b: guerBoard(e, order, e.raiders, { gone: true }) + '<p>Non ci sono più poliziotti: non succede nulla!</p>' });
      const quiet = Math.max(...e.raiders) === 0; // nessuno ha neutralizzato poliziotti
      if (quiet) { // niente premi né ritirata: un passo solo (due se c'è la retata)
        const last = out[out.length - 1]; last.b += '<p>Nessuno ha neutralizzato poliziotti: niente street cred e niente punti.</p>';
        if (e.area === 0) return [{ t: 'Guerrilla', b: guerBoard(e, order, e.raiders, { gone: true }) + '<p>Nessuna retata e nessuno ha neutralizzato poliziotti: non succede niente.</p>' }];
        return out;
      }
      out.push(e.first !== null
        ? { t: `${esc(s.players[e.first].name)} guida la guerriglia`, b: guerBoard(e, order, e.raiders, { hi: e.first }) + `<p>${who(s, e.first)}: +1 street cred (ora ${e.renown[e.first] + 1}) e <b class="ptsup">+${e.gain} punti</b>, uno per ogni street cred · punti ${e.before[e.first]} → ${e.before[e.first] + e.gain}. Rimette tutte le sue unità.</p>` }
        : Math.max(...e.raiders) === 0
          ? { t: 'Nessun premio', b: guerBoard(e, order, e.raiders, {}) + '<p>Nessuno ha neutralizzato poliziotti: nessuno guida la guerriglia, niente street cred e niente punti.</p>' }
          : { t: 'Pareggio', b: guerBoard(e, order, e.raiders, {}) + '<p>Quando più giocatori pareggiano per la Guerrilla più alta, chi ha il valore di Guerrilla più basso sceglie il proprio quartiere con retata.</p>' });
      if (e.ties.length) out.push({ t: '+1 punto', b: guerBoard(e, order, e.raiders, { hi: e.ties }) + `<p>${e.ties.map(i => who(s, i)).join(', ')}: più unità rimaste, +1 punto e ne rimette una.</p>` });
      if (after.some((r, i) => r !== e.raiders[i])) out.push({ t: 'La polizia si ritira', b: guerBoard(e, order, after, { from: e.raiders }) + '<p>Le unità rimaste restano per il prossimo round.</p>' }); // solo se qualcosa cambia
      return out;
    }
    case 'community': {
      if (e.church.every(c => c === 0)) return [{ t: 'Community Projects', b: '<p>Nessuno ha punti community: nessun progetto urbano in questo round.</p>' }];
      const out = [{ t: 'Community Projects', b: `<ul class="plain">${list(e.church.map((c, i) => `<li>${who(s, i)} ${c} di comunità</li>`))}</ul>` }];
      if (e.first !== null) out.push({ t: `${who(s, e.first)} guida la comunità`, b: '<p>Avvia un progetto urbano e diventa la Fazione Attiva.</p>' });
      else out[0].b += '<p><b>Pareggio</b>: niente progetto principale.</p>'; // pareggio: nello stesso passo
      if (e.ties.length) out.push({ t: '+1 punto', b: `<p>${e.ties.map(i => who(s, i)).join(', ')}</p>` });
      if (e.fours.length) out.push({ t: 'Progetti con 4 o più', b: `<p>${e.fours.map(i => who(s, i)).join(', ')} avviano un progetto urbano.</p>` });
      return out;
    }
    case 'uprising': return (() => { const st = [
      { t: 'Uprising', b: e.flips.length ? `<p>Ora in palio: ${e.flips.map(r => `<b>${REGIONS[r].name}</b>`).join(', ')}.</p>` : '<p>Nessuna nuova zona in palio.</p>' },
      ...(e.values && Object.keys(e.values).length ? [{ t: 'Valore nelle zone in palio', b: `<ul class="plain">${list(Object.entries(e.values).map(([r, z]) => {
        const res = z.max === 0 ? 'nessuna fazione' : z.tie ? (z.owner !== null ? `resta a ${who(s, z.owner)}` : 'contesa') : `controlla ${who(s, z.owner)}`;
        return `<li><b>${REGIONS[r].name}</b>: ${Object.entries(z.values).sort(([, a], [, b]) => b - a).map(([i, x]) => `${pname(s, Number(i))} ${x}`).join(' · ') || '—'} → ${res}</li>`;
      }))}</ul>` }] : []),
      { t: 'Controllo delle zone', b: e.changes.length ? `<ul class="plain">${list(e.changes.map(c => `<li><b>${REGIONS[c.r].name}</b>: ${c.owner === null ? 'nessuno la controlla' : `${who(s, c.owner)}${c.from != null ? ` (la toglie a ${who(s, c.from)})` : ''} · vale <b class="ptsup">${REGIONS[c.r].points} punti</b>`}</li>`))}</ul><p class="note">I punti dei municipi sono provvisori: si vedono nella riga col pugno e si contano a fine partita, a chi li controlla in quel momento.</p>` : '<p>Nessun cambio di controllo.</p>' },
    ];
      const vals = e.values && Object.keys(e.values).length;
      if (!vals) return [{ t: 'Uprising', b: st[0].b.replace('</p>', ' Nessun cambio di controllo.</p>') }]; // niente zone in palio: un passo solo
      return st.filter((x, k) => !(k === 0 && !e.flips.length) && !(x.t === 'Controllo delle zone' && !e.changes.length)); // via i passi senza novità
    })();
  }
  return [];
}

// ---------- niente scroll: i pannelli rimpiccioliscono il contenuto finché ci sta, le carte in mano si sovrappongono ----------
function fitZoom(el) {
  if (!el || el.hidden || !el.getClientRects().length) return; // (offsetParent è null per gli elementi fissi)
  el.style.setProperty('--fit', 1);
  for (let k = 0, z = 1; k < 4 && el.scrollHeight > el.clientHeight + 1; k++) {
    z = Math.max(0.45, z * (el.clientHeight / el.scrollHeight) * 0.98); el.style.setProperty('--fit', z);
  }
}
function fitHand() {
  const el = $('hand'), cards = [...el.querySelectorAll(':scope > .card')];
  cards.forEach(c => (c.style.marginLeft = ''));
  if (cards.length < 2) return;
  const gap = parseFloat(getComputedStyle(el).columnGap) || 0, kept = el.querySelector('.kept')?.offsetWidth || 0;
  const free = el.clientWidth - parseFloat(getComputedStyle(el).paddingLeft) * 2 - kept, need = cards.reduce((a, c) => a + c.offsetWidth, 0) + gap * (cards.length - 1);
  if (need <= free) return;
  const over = (need - free) / (cards.length - 1);
  cards.slice(1).forEach(c => (c.style.marginLeft = `${-over}px`)); // si sovrappongono: la carta sotto il dito sale (CSS)
}
const fitAll = () => { fitZoom($('stage')); fitZoom($('board')); fitHand(); };
addEventListener('resize', () => state && !$('game').hidden && fitAll());

// cronaca: nomi delle bande nel loro colore e in grassetto, "gioca N" col colore della carta
function logLine(s, l) {
  let h = esc(l);
  s.players.forEach((p, i) => { const n = esc(p.name); if (n) h = h.split(n).join(`<b style="color:${THEME.players[i] === '#1b1b1b' ? '#cfd6dc' : THEME.players[i]}">${n}</b>`); });
  return h.replace(/gioca (\d+)/g, (m, v) => { const c = CARDS[+v]?.color; return `gioca <b class="lc" style="color:${c === 'white' ? '#fff' : THEME.suit[c]?.fill}">${v}</b>`; });
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
  if (loading && !crashing && showing?.k !== 'pregame') { loading = false; loadDone = allReady = false; loadId++; $('loadscreen').hidden = true; } // la Panoramica è finita: il caricamento non resta a metà
  applyColors(s.players.length);
  const key = JSON.stringify(pd) + (pd?.type === 'draft' ? s.draft.packets.join('|') : '');
  if (key !== pendKey) { pendKey = key; if (!local || pd?.type !== 'draft') ui = {}; } // nuova decisione: via le scelte provvisorie
  if (local && !isBot(actorOf(s, pd)) && actorOf(s, pd) >= 0) human = actorOf(s, pd);
  seat = local ? human : room.players.findIndex(p => p.uid === net.uid()); // in locale si vede sempre la mano di una persona, mai quella dei bot
  botTurn(s, pd);
  $('code').textContent = local ? 'partita locale' : `partita ${roomCode}`;
  city.update({ towns: s.towns, activeTown: s.trick?.town ?? null, claims: s.claims, names: s.players.map(p => p.name), factions: s.players.map((p, i) => room?.players?.[i]?.gang || FACTION_NAMES[i % FACTION_NAMES.length]) });
  // si illumina solo la scelta provvisoria di chi sta giocando: finito il suo turno, si spegne
  city.select(showing?.k === 'setup' ? showing.town : pd && pd.p === seat && !showing ? (ui.town ?? ui.expand ?? ui.viking ?? null) : null); // si vede il quartiere di partenza appena scelto
  const wk = meteo?.w[3] || WKEYS[(s.round * 5 + s.start * 3) % WKEYS.length]; // meteo vero di Milano; se non arriva, uno a round
  if (city.weather() !== wk) city.setWeather(wk);
  const picks = clickable(s, pd);
  city.setClickable(picks, onTown);
  city.setFireworks(pd?.type === 'action' && pd.p === seat && !showing && (ui.pick === 'expand' || (!ui.pick && actionSyms(s, pd).includes('E'))) ? picks.filter(id => expandTargets(s, seat).includes(id)) : []); // dove ci si può espandere: fuochi d'artificio
  // scelta sulla mappa: pannello a striscia e camera sugli spot validi (una volta per scelta)
  mapPicking = picks.length > 0 && (pd.type !== 'action' || !!ui.pick);
  document.body.classList.toggle('map-pick', mapPicking);
  const pk = picks.length ? JSON.stringify([pd?.type, ui.pick, picks.length]) : null;
  // niente zoom: la mappa resta com'è, si illuminano le zone dove si può scegliere
  framedKey = pk;
  document.querySelectorAll('[data-sort]').forEach(b => b.setAttribute('aria-pressed', b.dataset.sort === handSort));
  renderPhases(s, pd); renderBoard(s, pd); renderTurn(s, pd, wk); renderStage(s, pd); renderHand(s, pd);
  fitAll();
  if (fkey) document.querySelector(fkey)?.focus({ preventScroll: true }); // il focus non si perde quando il pannello si aggiorna
  const tEl = $('stage').querySelector('h2 .ttl') || $('stage').querySelector('h2'), said = tEl?.textContent || '';
  if (said !== lastSaid) { // titolo nuovo: la scritta vecchia si sgretola e la nuova si ricompone (mentre vola il cartello di fase ci pensa lui)
    if (lastSaid && !document.body.classList.contains('phasefly')) pixelSwap(tEl, lastSaid);
    $('announce').textContent = said; lastSaid = said;
  } // lo screen reader sente solo il titolo nuovo
  $('log').innerHTML = [...s.log].reverse().map(l => `<li>${logLine(s, l)}</li>`).join('');
}

// ---------- plancia a sinistra (schizzo): bande, hype, guerrilla, comunità, uprising ----------
const pdot = i => `<i class="pd" style="--pc:${THEME.players[i]}"></i>`;
// quadratino del giocatore: il logo della sua fazione, bordato del suo colore (al posto del quadrato a tinta unita)
const pmark = i => `<span class="pmark" style="--pc:${THEME.players[i]}">${factionLogo(gangOf(i), 12)}</span>`;
const gangOf = i => room?.players?.[i]?.gang || FACTION_NAMES[i % FACTION_NAMES.length];
// il colore di ogni giocatore è quello della sua fazione (se due avessero la stessa fazione, si torna ai colori per posto)
const SEAT_COLORS = [...THEME.players];
function applyColors(n) {
  const gs = Array.from({ length: n }, (_, i) => gangOf(i)), ok = new Set(gs).size === n && gs.every(g => FACTION_COLORS[g]);
  gs.forEach((g, i) => (THEME.players[i] = ok ? FACTION_COLORS[g] : SEAT_COLORS[i]));
}
const ftok = i => `<span class="ftok" style="--pc:${THEME.players[i]}">${factionLogo(gangOf(i), 10)}</span>`; // segnalino: logo della fazione col bordo del colore del giocatore
const pname = (s, i) => `${pmark(i)}<b>${esc(s.players[i].name)}</b>`;
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
function hypeMini(s, card = s.marriage) { // la carta Hype anche accanto al cartello del municipio che influenzerà
  document.querySelectorAll('.rlabel .hymini').forEach(x => x.remove());
  const k = card && !card.princess ? card.region : null;
  const lab = k && document.querySelector(`.rlabel[data-region="${k}"]`);
  if (lab) lab.insertAdjacentHTML('beforeend', `<span class="hymini" title="La carta Hype dà un quartiere qui">Hype</span>`);
}
function renderHypeCard() { $('hypecard').hidden = true; document.body.classList.remove('has-hype'); } // la carta Hype ora sta sotto la track della plancia
function bindPeek(s) { // "Vedi carta": la carta Hype si apre accanto alla plancia e la sua zona si accende sulla mappa
  const b = $('b-players').querySelector('.peek'), card = $('peekcard');
  if (!b) { card.hidden = true; hypeLit = false; city?.highlight(null); return; }
  const k = s.marriage.princess ? null : s.marriage.region;
  const show = on => {
    hypeLit = on;
    if (on) {
      card.innerHTML = characterSVG(characterIndex(s.marriage));
      const r = $('b-players').getBoundingClientRect();
      card.style.left = `${Math.min(r.right + 8, innerWidth - 196)}px`;
      card.style.top = `${Math.max(8, Math.min(r.top, innerHeight - 290))}px`;
    }
    card.hidden = !on; b.setAttribute('aria-pressed', String(on)); b.textContent = on ? 'Chiudi carta' : 'Vedi carta';
    city?.highlight(on && k ? k : null);
  };
  b.onclick = () => show(card.hidden);
  show(hypeLit);
}
// track dell'hype: logo del bonus a colori in alto (la casella 1 è la partenza, la 10 ha il logo dell'Hype)
const hypeBonus = (b, c, z = 12) => c === 9 ? logo('hype', z) : !b ? '' : b === 'CC' ? logo('crediti', z) + logo('crediti', z) : logo({ C: 'crediti', R: 'cred', T: 'quartiere' }[b], z); // crediti gialli, street cred, quartiere
// riassunto della carta Hype: punti con la coppa, zona col triangolo (o street cred, o IA libera)
// Regina Estrid: cosa daresti adesso con ciascuna scelta
function estridNow(s, p) {
  const e = estridPreview(s, p), zl = z => z.length ? z.map(x => `${REGIONS[x.r].name} (${x.pts})`).join(', ') : 'nessuna';
  return `<ul class="estrid">
    <li><b>${ESTRID.options.military}</b>: zone in palio che controlleresti adesso: ${zl(e.military.after)} → <b class="ptsup">${e.military.ptsAfter} punti</b>${e.military.ptsNow !== e.military.ptsAfter ? ` (ora ${e.military.ptsNow})` : ' (come adesso)'}.</li>
    <li><b>${ESTRID.options.trade}</b>: sei presente in <b>${e.trade.now}</b> zone, con i presidi in <b>${e.trade.after}</b> → presenza da ${e.trade.ptsNow} a <b class="ptsup">${e.trade.ptsAfter} punti</b> a fine partita.</li>
    <li><b>${ESTRID.options.spurn}</b>: <b class="ptsup">+4 punti</b> subito.</li></ul>`;
}
function hypeSummary(s, c) {
  if (c.princess) return '<span class="hs">IA libera: tre scelte</span>';
  const k = c.region, own = k ? s.claims[k]?.owner ?? null : null;
  return `<span class="hs">+${c.points}${logo('punti', 13)}</span>${k ? `<span class="hs"><i class="tri" style="--rc:${THEME.region[k]}" aria-hidden="true"><i></i><i></i><i></i><i></i></i>${REGIONS[k].name}${own !== null ? ` <em>(${esc(s.players[own].name)})</em>` : ''}</span>` : ''}${c.renown ? '<span class="hs">+1 street cred</span>' : ''}`;
}
const lastVals = {}, lastDelta = {}; // ultimi valori mostrati nella plancia, per animare i cambi
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
  const lab = (kind, k) => phaseNow === k && k ? `<span class="rowchev">${logo(kind, 16)}<span>${LOGO_NAMES[kind]}</span></span>` // riga della fase in corso: freccia rossa come nella barra
    : `${logo(kind, 16)}${bigBoard ? `<span class="lname">${LOGO_NAMES[kind]}</span>` : ''}`;
  const fl = new Set(actionSyms(s, pd).map(x => FLASH_ROW[x]));
  const gotPts = showing?.k === 'party' && showing.winner !== null && step >= 1 ? showing.winner : -1; // party: i punti del personaggio lampeggiano sulla plancia
  const shown = bigBoard ? s.players.map((p, i) => i) : [Math.max(0, seat)]; // rimpicciolita: solo la tua colonna
  const cell = (kind, p, i, key) => { // valore che cambia: piccolo salto e "+N" che sale e svanisce
    const v = typeof key === 'function' ? key(p) : p[key], id = kind + i, old = lastVals[id], now = performance.now();
    if (old !== undefined && old !== v) { lastDelta[id] = { d: v - old, t: now }; if (i === seat) sound(v > old && (kind === 'crediti' || kind === 'punti') ? 'coin' : 'ui'); }
    lastVals[id] = v;
    const ch = lastDelta[id], age = ch ? (now - ch.t) / 1000 : 9; // l'animazione continua anche se la plancia si ridisegna
    return age > 1.6 ? v : `<span class="bump" style="animation-delay:-${age}s">${v}</span><span class="delta ${ch.d > 0 ? 'up' : 'down'}" style="animation-delay:-${age}s">${ch.d > 0 ? '+' : '−'}${Math.abs(ch.d)}</span>`;
  };
  const row = (kind, key, k) => `<tr class="${phaseNow === k ? 'on' : ''}${fl.has(kind) ? ' flash' : ''}"><th scope="row">${lab(kind, k)}</th>${shown.map(i => [s.players[i], i]).map(([p, i]) => `<td class="${key === 'points' ? 'pts' : ''}${key === 'points' && i === gotPts ? ' got' : ''}">${cell(kind, p, i, key)}</td>`).join('')}</tr>`;
  const tip = (p, i) => [p.name, isBot(i) ? 'bot' : i === seat && !local ? 'tu' : '', room.players[i]?.gang, `street cred ${p.renown}`, `${p.hand.length} carte in mano`,
    p.claims.length ? 'zone: ' + p.claims.map(r => REGIONS[r].name).join(', ') : '', p.marriages.length ? 'personaggi: ' + p.marriages.map(characterName).join(', ') : '',
    p.princess ? 'Estrid alleata' : '', i === s.active ? 'Fazione Attiva' : ''].filter(Boolean).join(' · ');
  $('b-players').innerHTML = `<button class="zoom" type="button" aria-pressed="${bigBoard}" aria-label="${bigBoard ? 'Rimpicciolisci la plancia' : 'Ingrandisci la plancia'}">${bigBoard ? '−' : '+'}</button>
    <div class="vgrid"><table aria-label="Fazioni">
    <thead><tr class="draftdir${['prep', 'draft'].includes(phaseNow) ? ' on' : ''}" title="${esc(dirTitle(s))}"><td></td><td colspan="${shown.length}"><span class="dl">Draft</span> ${dirArrow(s)}</td></tr><tr><td></td>${shown.map(i => [s.players[i], i]).map(([p, i]) => `<th scope="col"><span class="ini${waiting.includes(i) ? ' turn' : ''}${i === s.active ? ' act' : ''}" style="--pc:${THEME.players[i]}" title="${esc(tip(p, i))}">${factionLogo(gangOf(i), 12)}${esc(shortName(p.name))}</span>${i === s.active ? '<small class="actlbl">Attiva</small>' : ''}</th>`).join('')}</tr></thead>
    <tbody>${row('punti', 'points')}${row('uprising', p => p.claims.reduce((a, r) => a + REGIONS[r].points, 0), 'uprising')}${row('crediti', 'coins')}${row('cred', 'renown')}${row('guerrilla', 'raiders', 'guerrilla')}${row('community', 'church', 'community')}</tbody>
    <tfoot><tr${phaseNow === 'guerrilla' ? ' class="on"' : ''}><th scope="row">${lab('polizia', 'guerrilla')}</th><td colspan="${shown.length}">${s.area}</td></tr></tfoot>
    </table>
    </div>
    <div class="htrack${phaseNow === 'party' ? ' on' : ''}${actionSyms(s, pd).includes('M') ? ' flash' : ''}" role="img" aria-label="Hype: ${s.players.map(p => `${esc(p.name)} ${p.mar ? 'casella ' + p.mar : 'alla partenza'}`).join(', ')}">${MARRIAGE_TRACK.map((b, c) => (c === 0 ? '' : // la casella di partenza non si mostra: chi è a 0 non è ancora sul tracciato
      `<span class="hc${b ? ' bonus' : ''}" title="Hype ${c}: ${b ? BONUS_TIP[b] : 'nessun bonus'}"><span class="g">${hypeBonus(b, c)}</span><span class="pw">${s.players.map((p, i) => (p.mar === c ? (bigBoard ? ftok(i) : pdot(i)) : '')).join('')}</span></span>`)).join('')}</div>
    ${s.marriage ? `<div class="hstrip"><b class="tag">Hype</b>${hypeSummary(s, s.marriage)}<button class="peek btn ghost small" type="button">Vedi carta</button></div>` : ''}`;
  $('b-players').querySelector('.zoom').onclick = () => { // si allarga (o stringe) con un'animazione; allargando, le colonne degli altri entrano una alla volta
    const box = $('b-players'), w0 = box.offsetWidth;
    bigBoard = !bigBoard; try { localStorage.setItem('bb-board', bigBoard ? 'big' : 'small'); } catch {} render();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const w1 = $('b-players').offsetWidth;
    $('b-players').animate([{ width: w0 + 'px', overflow: 'hidden' }, { width: w1 + 'px', overflow: 'hidden' }], { duration: 500, easing: 'cubic-bezier(.2, .8, .2, 1)' });
    if (bigBoard) $('b-players').querySelectorAll('.vgrid tr').forEach(tr => [...tr.children].slice(1).forEach((c, k) =>
      c.animate([{ opacity: 0, transform: 'translateX(-12px)' }, { opacity: 1, transform: 'none' }], { duration: 350, delay: 120 + k * 90, fill: 'backwards' })));
  };
  bindPeek(s); renderHypeCard(s); hypeMini(s); renderRef();
  // uprising: zone sbloccate e chi le tiene
  on('b-uprising', 'uprising');
  const up = Object.entries(s.claims).filter(([, c]) => c.up).sort(([, a], [, b]) => (a.owner ?? 99) - (b.owner ?? 99)); // zone raggruppate per banda, contese in fondo
  $('b-uprising').innerHTML = `<h3>${logo('uprising')}Uprising</h3>${up.length ? `<ul>${up.map(([r, c]) =>
    `<li><i class="rz" style="--rc:${c.owner === null ? THEME.region[r] : THEME.players[c.owner]}"></i><b>${REGIONS[r].name}</b><span class="own">${c.owner === null ? noOwner(s, r) : pname(s, c.owner)}</span></li>`).join('')}</ul>` : ''}`;
}

// zona in palio senza padrone: "contesa" solo se in testa c'è parità, "polizia" se ci sono solo presidi
function noOwner(s, r) { const z = zoneControl(s, r); return z.max === 0 ? 'polizia' : z.tie ? `contesa ${z.max}–${z.max}` : 'nessuno'; }
function renderTurn(s, pd, wk) {
  const total = s.players.length === 3 ? 3 : 4;
  const told = showing ? [['setup', 'Setup'], ...PHASES].find(p => p[0] === (SHOW_PHASE[showing.k] || showing.k))?.[1] : null; // si sta raccontando: niente turni futuri
  const turn = told ? `<span>Racconto</span> ${told}` : !pd ? 'Partita finita' : pd.type === 'draft' ? `<span>Draft</span> ${s.draft.picks.flatMap((x, i) => (x ? [] : [pmark(i)])).join('')}` : pd.p === seat ? `<span>Tocca a</span> ${pmark(seat)}<b>te</b>` : `<span>Turno di</span> ${pname(s, pd.p)}`;
  const turnWas = $('turn').querySelector('.big')?.textContent.trim() || '';
  $('turn').innerHTML = `<p class="big">${turn}</p><p class="sub">${(showing ? showing.round ?? s.round : s.round) ? `Round ${showing ? showing.round ?? s.round : s.round} di ${total}` : 'Preparazione della partita'} · ${WEATHER_TYPES[wk]}</p>`;
  pixelSwap($('turn').querySelector('.big'), turnWas, { hideCls: 'pxswap-turn' }); // chi gioca cambia: la scritta si sgretola e si ricompone
}

const SUIT_WORD = { red: 'Guerrilla', blue: 'Community Projects', yellow: 'Underground Party' };
const coarse = matchMedia('(pointer: coarse)').matches; // su touch la carta in presa va confermata

let lastPacket = '', dealtAt = 0, keptSeen = new Map(); // quando sono arrivate: l'animazione continua anche se la mano si ridisegna
// senso del draft del round in corso (in preparazione, quello del round che arriva)
const roundDir = s => s.draft?.dir ?? draftDir(s.stage === 'setup' ? 1 : s.round + (s.stage === 'prep' ? 1 : 0));
function dirTitle(s) {
  const n = s.players.length, d = roundDir(s), a = s.players[0].name, b = s.players[(n + d) % n].name;
  return `Draft: le carte passano ${d > 0 ? 'al giocatore a destra' : 'al giocatore a sinistra'} (da ${a} a ${b})`;
}
const dirArrow = s => `<span class="dar">senso <b>${roundDir(s) > 0 ? '→' : '←'}</b></span>`;
const dirText = (s, d) => { const n = s.players.length; return `${d > 0 ? '→' : '←'} da ${esc(s.players[0].name)} a ${esc(s.players[(n + d) % n].name)}`; };
function renderHand(s, pd) {
  const el = $('hand');
  document.querySelector('.handbar').hidden = !s.players[seat]?.hand.length && !s.draft; // niente "1·2" accanto a una mano vuota
  if (seat < 0) { el.innerHTML = ''; return; }
  const card = (v, attrs = '', cls = '') => `<button class="card${cls}" data-c="${v}" ${attrs}>${cardSVG(v)}</button>`;
  const keptBox = cards => { // carte tenute: quelle appena scelte arrivano da destra e si rimpiccioliscono
    if (!s.players[seat].hand.length && !s.draft?.picks[seat]) keptSeen = new Map();
    const now = performance.now(); cards.forEach(v => keptSeen.has(v) || keptSeen.set(v, now));
    const anim = v => { const age = now - keptSeen.get(v); return age < 800 ? ` class="in" style="animation-delay:-${age}ms"` : ''; };
    return cards.length ? `<div class="kept" aria-label="Carte già tenute"><span>Già tenute</span><div>${cards.map(v => `<figure${anim(v)}>${cardSVG(v)}</figure>`).join('')}</div></div>` : '';
  };
  if (pd?.type === 'draft' && !s.draft.picks[seat] && !showing) {
    const sel = ui.draft || [], kept = sorted(s.players[seat].hand), pk = s.draft.packets[seat].join(','), age = pk !== lastPacket ? 0 : performance.now() - dealtAt; // mazzetto nuovo: arriva dal lato di chi lo passa
    if (pk !== lastPacket) { lastPacket = pk; dealtAt = performance.now(); }
    const n = s.draft.packets[seat].length, dealt = age < 800 + n * 120;
    el.style.setProperty('--from', (s.draft.dir ?? 1) > 0 ? -1 : 1);
    el.innerHTML = keptBox(kept) +
      sorted(s.draft.packets[seat]).map((v, i) => card(v, `aria-pressed="${sel.includes(v)}" aria-keyshortcuts="${i + 1}"${dealt ? ` style="animation-delay:${i * 120 - age}ms"` : ''}`, dealt ? ' deal' : '')).join('');
    el.querySelectorAll('[data-c]').forEach(b => (b.onclick = () => {
      const v = +b.dataset.c;
      if (sel.includes(v)) ui.draft = sel.filter(x => x !== v);
      else if (sel.length < 2) ui.draft = [...sel, v];
      else return toast('Hai già 2 carte: togline una per cambiarla');
      render();
    }));
    return;
  }
  if (pd?.type === 'draft' && s.draft.picks[seat]) { // in attesa degli altri: le 2 scelte vanno tra le tenute, il resto del mazzetto aspetta di partire
    const rest = s.draft.packets[seat].filter(v => !s.draft.picks[seat].includes(v));
    el.innerHTML = keptBox(sorted([...s.players[seat].hand, ...s.draft.picks[seat]])) + sorted(rest).map(v => card(v, 'aria-disabled="true"', ' leaving')).join('');
    el.querySelectorAll('[data-c]').forEach(b => (b.onclick = () => toast('Aspetta che gli altri scelgano le loro carte')));
    return;
  }
  const hand = sorted(s.players[seat].hand), mine = pd && pd.p === seat && !showing;
  const choosingTown = mine && pd.type === 'activeTown', playing = mine && pd.type === 'play';
  const color = playing ? TOWNS[s.trick.town].color : choosingTown && ui.town != null ? TOWNS[ui.town].color : null;
  const leading = choosingTown || (playing && seat === s.trick.leader);
  const fits = v => [color, 'white'].includes(CARDS[v].color);
  const ok = v => (playing || (choosingTown && ui.town != null)) && (!leading || fits(v) || !hand.some(fits));
  const dim = v => !ok(v) && (playing || (choosingTown && ui.town != null)); // senza quartiere scelto le carte restano a colori
  const lastHand = mine && s.trick?.last && hand.length === 2 && (playing || choosingTown); // ultima presa: la carta che non giochi si scarta
  el.innerHTML = hand.map((v, i) => card(v, `${ok(v) ? '' : 'aria-disabled="true"'} aria-pressed="${ui.armed === v}" aria-keyshortcuts="${i + 1}"`, (dim(v) ? ' off' : '') + (lastHand && ui.armed != null && ui.armed !== v ? ' discard' : ''))).join('');
  el.querySelectorAll('[data-c]').forEach(b => (b.onclick = () => playCard(+b.dataset.c, ok, choosingTown)));
}
function playCard(v, ok, choosingTown) {
  if (!ok(v)) return choosingTown && ui.town == null ? toast('Prima scegli il quartiere in gioco sulla mappa o dall\'elenco')
    : state.pending[0]?.p !== seat || showing ? toast('Non è il tuo turno di giocare una carta') : toast('Chi apre la presa deve giocare il colore del quartiere in gioco o una carta bianca di Briano Borro');
  if (ui.armed !== v) { ui.armed = v; render(); } // il clic seleziona; si gioca solo con il pulsante "Gioca la carta"
}

// cosa hanno fatto gli altri con le carte della presa, con le parole del gioco (Crediti, Hype, Guerrilla, Community, Punti)
function resultText(s, r) {
  const parts = [], n = (v, one, many) => `${v} ${v === 1 ? one : many}`;
  if (r.take != null) parts.push(`conquista ${townChip(r.take)}`);
  const coins = r.coins + (r.expand != null ? 5 : 0) + r.bought * 2;
  if (coins > 0) parts.push(`+${n(coins, 'credito', 'crediti')}`);
  if (coins < 0) parts.push(`paga ${n(-coins, 'credito', 'crediti')}`);
  if (r.points < 0) parts.push(`paga ${-r.points} punti`);
  if (r.bought) parts.push(`paga ${r.bought * 2} crediti per ${n(r.bought, 'passo', 'passi')} in più`);
  if (r.hype > 0) parts.push(`+${r.hype} Hype`);
  if (r.raiders > 0) parts.push(`+${r.raiders} Guerrilla`);
  if (r.church > 0) parts.push(`+${r.church} Community`);
  if (r.renown) parts.push(`+${r.renown} street cred`);
  if (r.expand != null) parts.push(`paga 5 crediti e si espande a ${townChip(r.expand)}`);
  if (r.viking != null) parts.push(`rimuove il presidio a ${townChip(r.viking)}`);
  return `${who(s, r.p)} ${r.won ? 'vince la presa' : 'gioca'} con la ${r.card}: ${parts.join(' · ') || 'niente'}`;
}
function resultsList(s) {
  if (showing || s.stage !== 'trick') return ''; // in upkeep il riepilogo della presa non serve più
  const list = s.trick?.results?.length ? s.trick.results : !s.trick?.plays?.length ? s.lastTrick?.results : null;
  return list?.length ? `<ul class="results">${list.map(r => `<li>${resultText(s, r)}</li>`).join('')}</ul>` : '';
}
// carta in versione compatta (presa in corso): numero nel colore del seme, poi Vinci / Perdi / Oppure coi simboli, senza illustrazione
function miniCard(v) {
  const k = CARDS[v], su = k.color === 'white' ? { fill: '#111', ink: '#fff' } : THEME.suit[k.color];
  const row = (lab, sy) => `<span class="r"><small>${lab}</small>${sy.map(x => icon(x, 13, '#111', '#f4f1ea')).join('')}</span>`;
  return `<div class="mc" style="--sc:${su.fill};--si:${su.ink}"><b class="n">${v}</b>${row('Vinci', k.primary)}${k.secondary.map((x, i) => row(i ? 'Oppure' : 'Perdi', x)).join('')}</div>`;
}
let trickSeen = {};
function trickRow(s) {
  const t = s.trick;
  if (!t?.plays.length) return '';
  const now = current(s), acting = now?.type === 'action' || now?.type === 'play' ? now.p : null;
  const fresh = t.plays.length > (trickSeen.n || 0) && trickSeen.key === t.leader + ':' + t.town ? t.plays.length - 1 : -1; if (fresh >= 0) sound('card'); // carta appena giocata: arriva in volo
  trickSeen = { n: t.plays.length, key: t.leader + ':' + t.town };
  return `<div class="trickrow">${t.plays.map((x, j) => `<figure class="${j === fresh ? (x.p === seat ? 'arrive mine' : 'arrive') + ' ' : ''}${t.winner === x.p ? 'win' : ''}${x.p === acting && now.type === 'action' && x.card === now.card ? ' now' : ''}" style="--pc:${THEME.players[x.p]}">${miniCard(x.card)}<figcaption>${pmark(x.p)}${esc(s.players[x.p].name)}${t.winner === x.p ? '<em>vince la presa</em>' : ''}</figcaption></figure>`).join('')}</div>`;
}

function hypePreview(s, pl, syms, extra) { // dove arriva il disco sulla track, con la regola delle caselle occupate
  const nM = syms.filter(x => x === 'M').length;
  if (!nM) return '';
  const others = s.players.filter(o => o !== pl).map(o => o.mar);
  let pos = Math.min(9, pl.mar + nM + extra);
  const aim = pos;
  while (pos > 0 && others.includes(pos)) pos--;
  const note = pos === aim ? `<p>Arrivi alla casella <b>${pos}</b>.</p>`
    : extra > 0 ? `<p class="warn" role="alert">Attenzione: paghi ${extra * 2} crediti ma la casella ${aim} è occupata, scendi alla <b>${pos}</b>.</p>`
    : `<p>La casella ${aim} è occupata: scendi alla <b>${pos}</b>. Con 2 crediti in più fai un passo in più.</p>`;
  return hypeTrack(s.players.map((o, i) => (o === pl ? pos : o.mar)), { mark: pos, note, me: s.players.indexOf(pl), from: pl.mar });
}

function endRecap(s) { // riepilogo di fine partita: come si è vinto
  const rank = s.players.map((p, i) => i).sort((a, b) => s.players[b].points - s.players[a].points);
  const towns = i => s.towns.filter(t => t.owner === i && !t.viking).length, projects = i => s.towns.filter(t => t.owner === i && t.monastery).length;
  return `<ol class="recap">${rank.map((i, k) => { const p = s.players[i]; return `<li class="${s.winner.includes(i) ? 'champ' : ''}">
    <span class="pos">${k + 1}</span>${pname(s, i)}<span class="num pts">${p.points}</span>
    <span class="facts">${towns(i)} quartieri · ${projects(i)} progetti · ${p.renown} street cred${p.claims.length ? ' · zone: ' + p.claims.map(r => REGIONS[r].name).join(', ') : ''}${p.marriages.length ? ' · ' + p.marriages.map(characterName).join(', ') : ''}</span></li>`; }).join('')}</ol>`;
}

// coriandoli nei colori delle fazioni (vincitore)
const confetti = () => `<div class="confetti" aria-hidden="true">${Array.from({ length: 36 }, (_, k) => `<i style="--x:${(k * 37) % 100}%;--d:${(k % 9) * 0.15}s;--c:${THEME.players[k % 5]};--r:${(k * 53) % 360}deg"></i>`).join('')}</div>`;
const exitGame = () => leaveGame(); // a partita finita si esce senza conferma
let wasMine = false, vsShown = null;
function renderStage(s = state, pd = current(state)) {
  const el = $('stage');
  if (showing?.k === 'final') city.highlight(steps(showing)[Math.min(step, steps(showing).length - 1)].zone ?? null); // la zona che si sta contando si alza
  el.onclick = e => { const g = e.target.closest('[data-goto]'); if (g) city.focusTown(+g.dataset.goto); }; // "Portami lì"
  // titolo prima, informazioni di contorno sotto (niente etichetta sopra il titolo)
  const chip = () => { const k = phaseNow, nm = [['setup', 'Setup'], ...PHASES].find(p => p[0] === k)?.[1]; return nm ? `<span class="phchip">${PHASE_LOGO[k] ? logo(PHASE_LOGO[k], 18) : ''}${nm}</span>` : ''; }; // la fase, col suo logo, accanto al titolo
  const head = (h, meta = '', body = '') => { // la fase è già nel titolo: sotto non si ripete
    h = { 'Underground Party': 'Chi è più avanti?', Guerrilla: 'Unità neutralizzate', 'Community Projects': 'Punti community', Uprising: 'Zone in palio' }[h] || h; // il titolo non ripete il nome della fase
    const nm = [['setup', 'Setup'], ...PHASES].find(p => p[0] === phaseNow)?.[1]; if (nm && meta.startsWith(nm + ' · ')) meta = meta.slice(nm.length + 3); else if (meta === nm) meta = '';
    return `<h2>${chip()}<span class="ttl">${h}</span></h2>${meta ? `<p class="meta">${meta}</p>` : ''}${body}`;
  };
  const mineTurn = pd && pd.p === seat && !showing && !(pd.type === 'draft' && s.draft.picks[seat]);
  const nowMine = !!mineTurn || (pd?.type === 'draft' && seat >= 0 && !s.draft.picks[seat] && !showing);
  el.classList.toggle('mine', nowMine); $('hand').classList.toggle('mine', nowMine);
  if (nowMine && !wasMine) { sound('turn'); el.classList.remove('turnin'); void el.offsetWidth; el.classList.add('turnin'); } // tocca a te: il riquadro fa un piccolo salto
  wasMine = nowMine;
  el.classList.toggle('compact', !!mapPicking);
  el.classList.remove('strip', 'vs', 'still');
  if (showing) {
    const st = steps(showing), cur = st[Math.min(step, st.length - 1)];
    if (cur.vs) { // Panoramica di gioco (inizio partita) e schermata tra un round e l'altro: box dei giocatori, Pronto
      el.classList.add('vs'); if (vsShown === showing.n) el.classList.add('still'); vsShown = showing.n; // ridisegnando (es. dopo Pronto) i giocatori non rientrano
      const isReady = i => isBot(i) || (local ? acked === showing.n : (room.acks?.[room.players[i]?.uid] ?? -1) >= showing.n);
      const first = showing.k === 'pregame' ? showing.start : s.active, round = showing.k === 'prep';
      const cards = s.players.map((p, i) => `<div class="vscard" style="--pc:${THEME.players[i] === '#1b1b1b' ? '#cfd6dc' : THEME.players[i]};--d:${i * 0.18}s">
        ${i === first ? '<em class="first">Fazione Attiva</em>' : ''}
        <span class="vslogo">${factionLogo(gangOf(i), 84)}</span><b class="vsname">${esc(p.name)}</b><span class="vsfac">${esc(gangOf(i))}</span>
        ${round ? `<span class="vspts"><b>${p.points}</b> punti${p.claims.length ? ` <small>+${p.claims.reduce((a, r) => a + REGIONS[r].points, 0)} municipi</small>` : ''}</span>` : ''}
        <span class="vsready${isReady(i) ? ' ok' : ''}">${isReady(i) ? 'Pronto' : 'In attesa'}</span></div>`).join('');
      const total = s.players.length === 3 ? 3 : 4, n = s.players.length, dir = draftDir(round ? showing.round : 1);
      // senso del draft: i giocatori nell'ordine dei posti, con la freccia grande verso chi riceve le carte
      const chain = s.players.map((p, i) => `${i ? `<b class="dch">${dir > 0 ? '→' : '←'}</b>` : ''}<span class="dnm">${pmark(i)}${esc(p.name)}</span>`).join('');
      const draftLine = `<div class="vline"><span class="vlab">Draft${round ? '' : ' · round 1'}</span><div class="dchain">${chain}</div></div>`;
      const c = showing.character;
      const hypeLine = c ? `<div class="vline"><span class="vval"><b class="tag">Hype</b>${c.princess ? '<b>Regina Estrid</b>' : `<b>+${c.points}</b>${logo('punti', 22)}${c.renown ? `<b>+1</b>${logo('cred', 22)}` : ''}${c.region ? `<span class="rzn" style="--rc:${THEME.region[c.region]}">${REGIONS[c.region].name}</span>` : ''}`}</span></div>` : '';
      const lines = round
        ? `<div class="vline"><span class="vval">${logo('polizia', 30)}Polizia <b>${showing.police}</b></span></div>${hypeLine}${draftLine}`
        : `<div class="vline"><span class="vval">Partita in <b>${total}</b> round</span></div>
           <div class="vline"><span class="vlab">Setup</span><span class="vval">Scegli un quartiere di partenza</span></div>${draftLine}
           <div class="vline"><div class="vsset"><span>Grafica <b class="seg" data-quality></b></span><span>Musica <b class="seg" data-aud="music"><button data-on="1">Sì</button><button data-on="0">No</button></b></span>
            <span>Effetti <b class="seg" data-aud="sfx"><button data-on="1">Sì</button><button data-on="0">No</button></b></span><label>Volume <input type="range" min="0" max="100" data-vol aria-label="Volume"></label></div></div>`;
      const info = `<div class="vsinfo" style="--d0:${n * 0.18 + 0.45}s">${lines}</div>`; // prima entrano i giocatori, poi le informazioni
      el.innerHTML = `<h2>${round ? `Round ${showing.round} di ${total}${showing.final ? ' · ultimo' : ''}` : 'Panoramica di gioco'}</h2><div class="vsrow">${cards}</div>${info}
        <div class="vsgo" style="--d0:${n * 0.18 + 0.9}s">${acked === showing.n && waitingAcks().length ? `<p class="waitack">Aspettiamo: ${waitingAcks().map(i => `<span class="blink">${who(s, i)}</span>`).join(' ')}</p>`
          : !round && acked === showing.n ? '<p class="waitack">Tutti pronti: si parte al 100%</p>'
          : `<button class="btn" id="next" aria-keyshortcuts="Space">Pronto</button>`}</div>`;
      if (!round) { renderQuality(); renderAudio(); startLoading(); }
      if (round) { const k = showing.character && !showing.character.princess ? showing.character.region : null; city.highlight(k); hypeMini(s, showing.character); }
      $('next') && ($('next').onclick = advance);
      return;
    }
    el.innerHTML = head(cur.t, `${showing.k === 'final' ? 'Punteggio finale' : PHASES.find(p => p[0] === (SHOW_PHASE[showing.k] || showing.k))?.[1] || ''} · passo ${step + 1} di ${st.length}`, cur.b) +
      (showing.k === 'final' && step >= st.length - 1 ? (sound('win'), confetti()) + '<div class="row end"><button class="btn" id="endexit">Esci</button></div>' // vincitore: ultima schermata, si esce da qui
        : waitingAcks().length && acked === showing.n ? `<p class="waitack">In attesa che clicchino Avanti: ${waitingAcks().map(i => `<span class="blink">${who(s, i)}</span>`).join(' ')}</p>`
        : `<div class="row end"><button class="btn small" id="next" aria-keyshortcuts="Space">Avanti</button></div>`);
    $('next') && ($('next').onclick = advance);
    $('endexit') && ($('endexit').onclick = exitGame);
    if (showing.k === 'final' && step >= st.length - 1) city.setFireworks(s.towns.map((t, i) => (showing.winner.includes(t.owner) ? i : -1)).filter(i => i >= 0)); // vincitore: fuochi d'artificio sui suoi quartieri
    return;
  }
  if (!pd) { // fine partita
    const fe = s.events.find(x => x.k === 'final');
    el.innerHTML = head(s.winner.length > 1 ? 'Pareggio' : `Vince ${esc(s.players[s.winner[0]].name)}`, 'Fine partita', (fe ? finalTable(fe, FINAL_COLS(fe), 6) : endRecap(s)) + '<div class="row end"><button class="btn" id="endexit">Esci</button></div>');
    $('endexit').onclick = exitGame;
    return;
  }
  const trick = (s.trick?.last && s.stage === 'trick' ? '<div class="lastbanner">Ultima presa del round: la carta che non giochi viene scartata.</div>' : '') + trickRow(s) + resultsList(s);
  const mine = 'Tocca a te'; // in locale l'umano è uno solo: niente "Tocca a Tu"
  if (pd.type === 'draft') {
    if (seat >= 0 && !s.draft.picks[seat]) {
      const n = (ui.draft || []).length;
      el.innerHTML = head('Scegli 2 carte', `Draft · ${mine}`,
        `<p>Tieni 2 carte dal mazzetto: le altre passano a ${who(s, (seat + (s.draft.dir ?? 1) + s.players.length) % s.players.length)} (${(s.draft.dir ?? 1) > 0 ? '→' : '←'}). In basso a sinistra trovi quelle già tenute.</p>
         <button id="ok" class="btn wide" ${n === 2 ? '' : 'disabled'} aria-keyshortcuts="Enter">${n === 2 ? 'Tieni queste 2' : n === 1 ? 'Scegli ancora 1 carta' : 'Scegli 2 carte'}</button>`);
      $('ok').onclick = () => act({ cards: ui.draft });
    } else el.innerHTML = head('In attesa del draft', 'Draft', `<p>Stanno scegliendo: ${s.draft.picks.flatMap((x, i) => (x ? [] : [who(s, i)])).join(', ')}</p>`);
    return;
  }
  const town = s.trick?.town != null ? s.trick.town : null;
  if (pd.p !== seat) {
    const w = s.trick?.winner;
    el.innerHTML = trick + head(w != null && s.trick.plays.length === s.players.length ? `Presa a ${esc(s.players[w].name)}` : `Turno di ${esc(s.players[pd.p].name)}`,
      town != null ? `Quartiere in gioco: ${townChip(town)} · ${REGIONS[TOWNS[town].region].name} <button class="btn ghost small goto" data-goto="${town}">Portami lì</button>` : '');
    return;
  }
  const picks = clickable(s, pd);
  const confirmTown = (title, text) => {
    el.innerHTML = head(title, mine, `<p>${text}</p><p class="pickline">Scelta: ${ui.town != null ? townChip(ui.town) : '<em>clicca uno spot evidenziato</em>'}</p>
      <button id="ok" class="btn wide" ${ui.town != null ? '' : 'disabled'} aria-keyshortcuts="Enter">Conferma</button>`);
    $('ok').onclick = () => act({ town: ui.town });
  };
  switch (pd.type) {
    case 'setupTown': return confirmTown('Quartiere di partenza', 'Uno spot libero in una zona senza altre fazioni. Puoi cambiare idea fino a Conferma.');
    case 'placeTown': return confirmTown(`Prendi un quartiere${pd.region ? ' in ' + REGIONS[pd.region].name : ''}`, 'Uno spot libero tra quelli evidenziati.');
    case 'loseTown': return confirmTown('Retata: un quartiere passa alla polizia', pd.victim === seat
      ? 'Scegli quale dei tuoi quartieri lasciare. Resta tuo sotto il presidio: lo riprendi rimuovendo il presidio con una carta di Briano Borro.'
      : `Scegli quale quartiere di ${esc(s.players[pd.victim].name)} viene presidiato.`);
    case 'monastery': return confirmTown('Avvia un progetto urbano', 'Scegli un tuo quartiere: conterà doppio per il controllo della zona.');
    case 'activeTown':
      el.innerHTML = (s.trick?.last ? '<div class="lastbanner">Ultima presa del round: la carta che non giochi viene scartata.</div>' : '') + resultsList(s) + head('Scegli il quartiere in gioco', mine, `<p>Clicca uno spot libero di un colore che hai in mano (qualsiasi, se hai una carta di Briano Borro), poi <b>gioca una carta</b> di quel colore o di Briano Borro per confermare.</p>
        <p class="pickline">Scelta: ${ui.town != null ? `${townChip(ui.town)} · ${REGIONS[TOWNS[ui.town].region].name}` : '<em>nessuna</em>'}</p>
        ${ui.town == null ? '' : ui.armed != null ? `<button id="playarmed" class="btn wide">Gioca la carta ${ui.armed} in ${esc(TOWNS[ui.town].name)}</button>`
          : '<button class="btn wide nextstep" disabled>Ora scegli la carta da giocare, qui sotto ↓</button>'}`); // scelto il quartiere: il passo dopo sempre visibile
      bindArmed(true); return;
    case 'play': {
      const word = SUIT_WORD[TOWNS[town].color];
      el.innerHTML = trick + head('Gioca una carta', `${mine} · Quartiere in gioco: ${townChip(town)} <button class="btn ghost small goto" data-goto="${town}">Portami lì</button>`,
        `${seat === s.trick.leader ? `<p>Apri tu: gioca ${word} o Briano Borro.</p>` : ''}
        ${ui.armed != null ? `<button id="playarmed" class="btn wide">Gioca la carta ${ui.armed}</button>` : ''}`);
      bindArmed(false); return;
    }
    case 'princess':
      el.innerHTML = head('Regina Estrid', mine, `<p>L'IA libera è dalla tua parte. Scegli come usarla:</p>
        <div class="choices">${['military', 'trade', 'spurn'].map(k => `<button class="btn ${ui.choice === k ? '' : 'ghost'}" data-c="${k}" aria-pressed="${ui.choice === k}">${ESTRID.options[k]}${k === 'spurn' ? ' (+4 punti)' : ''}</button>`).join('')}</div>
        ${estridNow(s, seat)}
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
  const title = pd.won ? `Vinci la presa con la ${pd.card}` : `Scegli l'azione della ${pd.card}`;
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
    ${syms.includes('E') && ui.expand != null ? `<p>Espansione: ${townChip(ui.expand)} <button class="link" id="no-e">annulla</button></p>` : syms.includes('E') && after >= 5 ? '<p class="note">Per espanderti tocca uno dei quartieri coi fuochi d\'artificio (5 crediti).</p>' : ''}
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
  const canExpand = syms.includes('E') && ui.expand == null && after >= 5 && expandTargets(s, seat).length; // potevi espanderti e non l'hai scelto
  $('ok').onclick = () => (lost ? (ui.review = true, render()) : canExpand ? (ui.expandAsk = true, render()) : act(move));
  if (ui.expandAsk) {
    el.innerHTML = trick + head('Ti espandi?', `${mine} · Carta ${pd.card}`, `<p>Con questa carta puoi anche <b>pagare 5 crediti ed espanderti</b> in un quartiere collegato ai tuoi. Hai ${after} crediti.</p>
      <div class="row"><button class="btn ghost" id="onlycoins">Prendi solo i crediti</button><button class="btn" id="goexpand">Scegli dove espanderti</button></div>`);
    $('onlycoins').onclick = () => act(move);
    $('goexpand').onclick = () => { ui.expandAsk = false; ui.pick = 'expand'; render(); };
  }
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
// solo per le prove: fa giocare ai bot anche le mosse della persona finché pred(stato) non è vero
window.__until = pred => { for (let k = 0; k < 3000 && local && state.stage !== 'end' && !pred(state, current(state)); k++) { const r = botMove(state); state = applyMove(state, r[0], r[1]); } seenN = state.eventN; queue = []; showing = null; render(); };
window.__fw = ids => city.setFireworks(ids); // solo per le prove
// solo per le prove: gioca da solo con i bot fino alla fine della partita (in locale)
window.__phase = phaseBanner; // test: fa partire il cartello di fase
window.__autoplay = () => { while (local && state.stage !== 'end') { const r = botMove(state); state = applyMove(state, r[0], r[1]); } ingestEvents(state); render(); };
