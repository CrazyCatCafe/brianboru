// Motore delle regole: funzioni pure su uno stato JSON-serializzabile.
// newGame(names, seed) -> stato; move(stato, giocatore, mossa) -> nuovo stato (lancia Error se illegale).
import { REGIONS, TOWNS, ROADS, CARDS, MARRIAGES, PRINCESS, VIKINGS, MARRIAGE_TRACK, REGION_SCORE } from './data.js';

const clone = o => JSON.parse(JSON.stringify(o));
const fail = msg => { throw new Error(msg); };

function rand(s) { // mulberry32, il seme vive nello stato
  let t = (s.seed = (s.seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(s, a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand(s) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const log = (s, msg) => { s.log.push(msg); if (s.log.length > 80) s.log.shift(); };
// Eventi strutturati per raccontare le fasi nell'interfaccia: s.eventN cresce sempre, s.events tiene gli ultimi
const event = (s, e) => { s.eventN = (s.eventN || 0) + 1; (s.events ??= []).push({ n: s.eventN, ...e }); if (s.events.length > 24) s.events.shift(); };
const name = (s, p) => s.players[p].name;

export const neighbours = id => ROADS.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : []));
export const emptyTowns = (s, region) => TOWNS.filter(t => s.towns[t.id].owner === null && (!region || t.region === region)).map(t => t.id);
// Quartieri che chi apre può scegliere: deve poter giocare quel colore o una carta Briano Borro (bianca).
// Se nessun quartiere libero è giocabile (caso non previsto dal regolamento) li può scegliere tutti.
export function leadTowns(s, p) {
  const colors = new Set(s.players[p].hand.map(c => CARDS[c].color)), free = emptyTowns(s);
  const ok = colors.has('white') ? free : free.filter(id => colors.has(TOWNS[id].color));
  return ok.length ? ok : free;
}
export const ownTowns = (s, p) => TOWNS.filter(t => s.towns[t.id].owner === p && !s.towns[t.id].viking).map(t => t.id);
export const expandTargets = (s, p) => [...new Set(ownTowns(s, p).flatMap(neighbours))].filter(id => s.towns[id].owner === null);
export const vikingTowns = s => TOWNS.filter(t => s.towns[t.id].viking).map(t => t.id);
export const current = s => s.pending[0] || null;

export function newGame(names, seed = Date.now()) {
  const n = names.length;
  if (n < 3 || n > 5) fail('Servono da 3 a 5 giocatori');
  const s = {
    seed: seed | 0, round: 0, stage: 'setup', setupDone: 0, final: false, winner: null,
    players: names.map(name => ({
      name, points: 10, coins: 3, renown: 1, raiders: 0, church: 0, mar: 0,
      claims: [], marriages: [], princess: null, hand: [],
    })),
    towns: TOWNS.map(() => ({ owner: null, viking: false, monastery: false })),
    claims: Object.fromEntries(Object.keys(REGIONS).map(r => [r, { up: false, owner: null }])),
    area: 0, marriage: null, pending: [], trick: null, draft: null, log: [],
  };
  s.vikingDeck = shuffle(s, [...VIKINGS]);
  s.marriageDeck = [PRINCESS, ...shuffle(s, clone(MARRIAGES)).slice(0, n === 3 ? 2 : 3)]; // pop() dalla cima
  s.active = Math.floor(rand(s) * n);
  s.start = s.active;
  log(s, `Inizia ${name(s, s.active)}.`);
  advance(s);
  return s;
}

// ---------- flusso automatico: avanza finché serve una decisione ----------
function advance(s) {
  while (!s.pending.length && s.stage !== 'end') STAGES[s.stage](s);
}

const STAGES = {
  setup(s) {
    if (s.setupDone < s.players.length) s.pending.push({ type: 'setupTown', p: (s.start + s.setupDone) % s.players.length });
    else s.stage = 'prep';
  },
  prep(s) {
    s.round++;
    const v = s.vikingDeck.pop();
    s.area += v;
    s.marriage = s.marriageDeck.pop();
    s.final = s.marriageDeck.length === 0;
    log(s, `Round ${s.round}: arrivano ${v} unità di polizia.${s.final ? ' Ultimo round!' : ''}`);
    event(s, { k: 'prep', round: s.round, police: v, area: s.area, character: s.marriage, final: s.final });
    const n = s.players.length, per = { 3: 8, 4: 6, 5: 5 }[n];
    const deck = shuffle(s, Object.keys(CARDS).map(Number));
    s.draft = { packets: s.players.map((_, i) => deck.slice(i * per, (i + 1) * per)), picks: s.players.map(() => null) };
    s.players.forEach(pl => (pl.hand = []));
    s.stage = 'draft';
  },
  draft(s) {
    const d = s.draft;
    if (d.packets[0].length <= 2) { // le ultime 1-2 carte vanno direttamente in mano
      d.packets.forEach((pk, i) => s.players[i].hand.push(...pk));
      s.draft = null;
      s.stage = 'trick';
      return;
    }
    s.pending.push({ type: 'draft' });
  },
  trick(s) {
    const n = s.players.length;
    if (!s.trick) {
      if (s.players.every(pl => pl.hand.length <= 1) || !emptyTowns(s).length) {
        s.players.forEach(pl => (pl.hand = []));
        s.stage = 'marriage';
        return;
      }
      s.trick = { leader: s.active, town: null, plays: [], order: null, done: 0 };
      s.pending.push({ type: 'activeTown', p: s.active });
      return;
    }
    const t = s.trick;
    if (t.plays.length < n) { s.pending.push({ type: 'play', p: (t.leader + t.plays.length) % n }); return; }
    if (!t.order) {
      const color = TOWNS[t.town].color;
      const valid = t.plays.filter(pl => CARDS[pl.card].color === color || CARDS[pl.card].color === 'white');
      t.winner = valid.length ? valid.sort((a, b) => b.card - a.card)[0].p : null; // null: chi apriva non aveva il colore
      t.order = [...t.plays].sort((a, b) => a.card - b.card);
      log(s, t.winner === null ? 'Nessuno vince la presa.' : `${name(s, t.winner)} vince la presa.`);
    }
    if (t.done < n) { const { p, card } = t.order[t.done]; s.pending.push({ type: 'action', p, card, won: p === t.winner }); return; }
    s.lastTrick = { town: t.town, winner: t.winner, results: t.results || [] }; // resta visibile finché non parte la presa dopo
    s.trick = null;
  },
  marriage(s) {
    const pls = s.players, top = Math.max(...pls.map(pl => pl.mar));
    const card = s.marriage, track = pls.map(pl => pl.mar), ev = { k: 'party', track, card, winner: null, bonuses: [], before: pls.map(pl => pl.points) };
    s.marriage = null;
    if (top === 0) log(s, 'Nessuno ha abbastanza hype: il personaggio se ne va.');
    else {
      const w = pls.findIndex(pl => pl.mar === top), pl = pls[w];
      ev.winner = w;
      pl.marriages.push(card);
      log(s, `${name(s, w)} ingaggia ${card.princess ? 'la Regina Estrid' : 'un personaggio'}.`);
      if (card.princess) s.pending.push({ type: 'princess', p: w });
      else {
        pl.points += card.points;
        pl.renown += card.renown || 0;
        if (card.region && emptyTowns(s, card.region).length) s.pending.push({ type: 'placeTown', p: w, region: card.region });
      }
      pls.forEach((o, i) => {
        if (i === w) return;
        const b = MARRIAGE_TRACK[o.mar];
        if (b) ev.bonuses.push({ p: i, b });
        if (b === 'C') o.coins += 1;
        if (b === 'CC') o.coins += 2;
        if (b === 'R') o.renown += 1;
        if (b === 'T' && emptyTowns(s).length) s.pending.push({ type: 'placeTown', p: i, region: null });
      });
      pl.mar = 0;
    }
    event(s, ev);
    s.stage = 'battle';
  },
  battle(s) {
    const pls = s.players, r = pls.map(pl => pl.raiders), ev = { k: 'guerrilla', area: s.area, raiders: [...r], losses: [], before: pls.map(pl => pl.points), renown: pls.map(pl => pl.renown) };
    if (s.area > 0) {
      const min = Math.min(...r), max = Math.max(...r), most = r.flatMap((x, i) => (x === max ? [i] : []));
      log(s, 'Retata della polizia!');
      r.forEach((x, i) => {
        if (x !== min || !ownTowns(s, i).length) return;
        const chooser = most.length === 1 && most[0] !== i ? most[0] : i;
        s.pending.push({ type: 'loseTown', p: chooser, victim: i });
        ev.losses.push({ victim: i, chooser });
      });
    } else log(s, 'La polizia è stata respinta.');
    s.area = 0;
    Object.assign(ev, spoils(s, 'raiders', p => { pls[p].renown++; pls[p].points += pls[p].renown; ev.gain = pls[p].renown; pls[p].raiders = 0; }));
    event(s, ev);
    s.stage = 'church';
  },
  church(s) {
    const pls = s.players, n = pls.length, ev = { k: 'community', church: pls.map(pl => pl.church), fours: [] };
    Object.assign(ev, spoils(s, 'church', p => {
      if (ownTowns(s, p).some(id => !s.towns[id].monastery)) s.pending.push({ type: 'monastery', p });
      s.active = p;
      pls[p].church = 0;
    }));
    for (let k = 0; k < n; k++) {
      const p = (s.active + k) % n;
      if (pls[p].church >= 4 && ownTowns(s, p).some(id => !s.towns[id].monastery)) {
        s.pending.push({ type: 'monastery', p });
        pls[p].church = 0;
        ev.fours.push(p);
      }
    }
    event(s, ev);
    s.stage = 'claim';
  },
  claim(s) {
    const ev = { k: 'uprising', flips: [], changes: [] };
    for (const [r, c] of Object.entries(REGIONS)) {
      const cl = s.claims[r], counts = regionCounts(s, r, 'military');
      const total = Object.values(regionCounts(s, r)).reduce((a, b) => a + b, 0);
      if (!cl.up && total >= c.threshold) { cl.up = true; ev.flips.push(r); log(s, `${c.name} è in palio.`); }
      if (!cl.up) continue;
      const max = Math.max(...Object.values(counts)), top = Object.keys(counts).filter(k => counts[k] === max);
      if (top.length !== 1) continue;
      const owner = top[0] === 'V' ? null : Number(top[0]);
      if (owner !== cl.owner) { cl.owner = owner; ev.changes.push({ r, owner }); log(s, `${c.name}: ${owner === null ? 'nessuno la controlla' : 'la controlla ' + name(s, owner)}.`); }
    }
    s.players.forEach((pl, i) => (pl.claims = Object.keys(REGIONS).filter(r => s.claims[r].owner === i)));
    event(s, ev);
    if (s.final) { score(s); s.stage = 'end'; } else s.stage = 'prep';
  },
};

// Premi per "chi ha di più" (vichinghi e chiesa): unico primo -> first(p); poi i primi a pari merito +1 punto e -1 segnalino.
function spoils(s, key, first) {
  const pls = s.players, res = { first: null, ties: [] };
  let max = Math.max(...pls.map(pl => pl[key])), top = pls.flatMap((pl, i) => (pl[key] === max ? [i] : []));
  if (max > 0 && top.length === 1) { res.first = top[0]; first(top[0]); }
  max = Math.max(...pls.map(pl => pl[key]));
  if (max > 0) pls.forEach((pl, i) => { if (pl[key] === max) { pl.points++; pl[key]--; res.ties.push(i); } });
  return res;
}

// Città per "giocatore" in una regione (monastero = 2); 'V' = vichinghi. mode: 'military'|'trade' accorpa i vichinghi alla Principessa.
function regionCounts(s, region, mode) {
  const ally = mode ? s.players.findIndex(pl => pl.princess === mode) : -1;
  const counts = {};
  TOWNS.filter(t => t.region === region).forEach(t => {
    const st = s.towns[t.id];
    if (st.owner === null) return;
    const k = st.viking ? (ally >= 0 ? ally : 'V') : st.owner;
    counts[k] = (counts[k] || 0) + (st.monastery ? 2 : 1);
  });
  return counts;
}

function score(s) {
  // ogni voce del punteggio finale viene registrata per raccontarla passo per passo
  const pls = s.players, coinsMax = Math.max(...pls.map(pl => pl.coins)), zero = () => pls.map(() => 0);
  const ev = { k: 'final', start: pls.map(pl => pl.points), coins: zero(), active: zero(), renown: zero(), zones: [], zonePts: zero(), presence: zero(), regions: zero() };
  const richest = pls.filter(pl => pl.coins === coinsMax);
  if (richest.length === 1) ev.coins[pls.indexOf(richest[0])] = 1;
  ev.coinsTie = richest.length > 1;
  ev.active[s.active] = 1;
  pls.forEach((pl, i) => (ev.renown[i] = pl.renown));
  for (const [r, c] of Object.entries(REGIONS)) {
    const cl = s.claims[r];
    if (!cl.up) continue;
    if (cl.owner !== null) { ev.zonePts[cl.owner] += c.points; ev.zones.push({ r, owner: cl.owner, pts: c.points, half: [] }); continue; }
    const counts = regionCounts(s, r, 'military'), max = Math.max(0, ...Object.values(counts)), half = [];
    if (max > 0) pls.forEach((pl, i) => { if (counts[i] === max) { ev.zonePts[i] += Math.floor(c.points / 2); half.push(i); } });
    ev.zones.push({ r, owner: null, pts: c.points, half });
  }
  pls.forEach((pl, i) => {
    const regs = new Set(TOWNS.filter(t => {
      const st = s.towns[t.id];
      return st.owner !== null && (st.viking ? pl.princess === 'trade' : st.owner === i);
    }).map(t => t.region));
    ev.regions[i] = regs.size; ev.presence[i] = REGION_SCORE[regs.size];
  });
  pls.forEach((pl, i) => (pl.points += ev.coins[i] + ev.active[i] + ev.renown[i] + ev.zonePts[i] + ev.presence[i]));
  const rank = pls.map((pl, i) => i).sort((a, b) =>
    pls[b].points - pls[a].points || pls[b].claims.length - pls[a].claims.length || pls[b].marriages.length - pls[a].marriages.length);
  const best = pls[rank[0]];
  s.winner = rank.filter(i => pls[i].points === best.points && pls[i].claims.length === best.claims.length && pls[i].marriages.length === best.marriages.length);
  ev.total = pls.map(pl => pl.points); ev.winner = s.winner; ev.rank = rank;
  event(s, ev);
  log(s, `Fine partita! Vince ${s.winner.map(i => name(s, i)).join(' e ')}.`);
}

// ---------- mosse ----------
export function move(state, p, m) {
  const s = clone(state), pend = current(s);
  if (!pend) fail('La partita è finita');
  if (pend.type === 'draft') draftPick(s, p, m);
  else {
    if (pend.p !== p) fail(`Tocca a ${name(s, pend.p)}`);
    MOVES[pend.type](s, p, m, pend);
    s.pending.shift();
  }
  advance(s);
  return s;
}

function draftPick(s, p, m) {
  const d = s.draft, cards = m.cards || [];
  if (d.picks[p]) fail('Hai già scelto');
  if (cards.length !== 2 || cards[0] === cards[1] || !cards.every(c => d.packets[p].includes(c))) fail('Scegli 2 carte dal tuo mazzetto');
  d.picks[p] = cards;
  if (d.picks.some(x => !x)) return;
  const n = s.players.length;
  d.packets = d.packets.map((pk, i) => pk.filter(c => !d.picks[i].includes(c)));
  d.picks.forEach((pk, i) => s.players[i].hand.push(...pk));
  d.packets = d.packets.map((_, i) => d.packets[(i - 1 + n) % n]); // passa a sinistra
  d.picks = d.picks.map(() => null);
  s.pending.shift();
}

function needTown(s, id, ok, msg) {
  if (!Number.isInteger(id) || !TOWNS[id] || !ok(s.towns[id], TOWNS[id])) fail(msg);
}

const MOVES = {
  setupTown(s, p, { town }) {
    needTown(s, town, (st, t) => st.owner === null &&
      !TOWNS.some(o => o.region === t.region && s.towns[o.id].owner !== null && s.towns[o.id].owner !== p),
    'Scegli un quartiere libero in una zona senza altre bande');
    s.towns[town].owner = p;
    s.setupDone++;
    log(s, `${name(s, p)} parte da ${TOWNS[town].name} (${REGIONS[TOWNS[town].region].name}).`);
    event(s, { k: 'setup', p, town });
  },
  activeTown(s, p, { town }) {
    if (!leadTowns(s, p).includes(town)) fail('Scegli un quartiere libero di un colore che hai in mano (o qualsiasi, con una carta Briano Borro)');
    s.trick.town = town;
  },
  play(s, p, { card }) {
    const hand = s.players[p].hand, t = s.trick, color = TOWNS[t.town].color;
    if (!hand.includes(card)) fail('Carta non in mano');
    if (p === t.leader) {
      const fits = c => CARDS[c].color === color || CARDS[c].color === 'white';
      if (!fits(card) && hand.some(fits)) fail('Chi apre deve giocare il colore del quartiere o Briano Borro');
    }
    hand.splice(hand.indexOf(card), 1);
    t.plays.push({ p, card });
    log(s, `${name(s, p)} gioca ${card}.`);
  },
  action(s, p, m, pend) {
    const card = CARDS[pend.card];
    let syms;
    if (m.opt === 'p') { if (!pend.won) fail('Solo chi vince la presa usa l\'azione VINCI'); syms = card.primary; }
    else { if (pend.won) fail('Hai vinto: usa l\'azione VINCI'); syms = card.secondary[m.opt] || fail('Azione non valida'); }
    const pl = s.players[p], extra = Math.max(0, m.extra | 0);
    if (extra && !syms.includes('M')) fail('Si pagano passi in più solo per l\'hype'); // regola della casa: niente acquisti extra per polizia e comunità
    const was = { coins: pl.coins, points: pl.points, mar: pl.mar, raiders: pl.raiders, church: pl.church };
    syms.forEach((sym, i) => {
      const last = syms.lastIndexOf(sym) === i, buy = n => { if (pl.coins < 2 * n) fail('Crediti insufficienti'); pl.coins -= 2 * n; return n; };
      if (sym === 'T') { s.towns[s.trick.town].owner = p; s.active = p; }
      if (sym === 'C') pl.coins++;
      if (sym === 'P') { if (pl.coins) pl.coins--; else pl.points = Math.max(0, pl.points - 2); }
      if (sym === 'X') pl.church += 1;
      if (sym === 'A') {
        const k = Math.min(s.area, 1);
        s.area -= k; pl.raiders += k;
      }
      if (sym === 'M') {
        const steps = 1 + (last ? extra : 0);
        if (last && pl.mar + steps > 9 && extra) fail('Oltre il massimo dell\'hype');
        if (last) buy(extra);
        pl.mar = Math.min(9, pl.mar + steps);
      }
      if (sym === 'E' && m.expand != null) {
        if (pl.coins < 5) fail('Servono 5 crediti per espandersi');
        if (!expandTargets(s, p).includes(m.expand)) fail('Quartiere non collegato a un tuo quartiere');
        pl.coins -= 5; s.towns[m.expand].owner = p;
      }
      if (sym === 'V' && vikingTowns(s).length) {
        needTown(s, m.viking, st => st.viking, 'Scegli un quartiere con un presidio di polizia');
        s.towns[m.viking].viking = false;
      }
    });
    if (syms.includes('M')) while (pl.mar > 0 && s.players.some((o, i) => i !== p && o.mar === pl.mar)) pl.mar--;
    // cosa ha fatto, per mostrarlo a tutti: crediti, punti, hype, guerrilla, community, quartieri
    const d = k => pl[k] - was[k], pays = syms.filter(x => x === 'P').length;
    (s.trick.results ??= []).push({ p, card: pend.card, won: !!pend.won, coins: d('coins'), points: d('points'), hype: d('mar'), raiders: d('raiders'), church: d('church'),
      renown: syms.filter(x => x === 'R').length, take: syms.includes('T') ? s.trick.town : null, expand: syms.includes('E') ? m.expand ?? null : null,
      viking: syms.includes('V') ? m.viking ?? null : null, bought: syms.includes('M') ? extra : 0, paid: pays });
    s.trick.done++;
  },
  placeTown(s, p, { town }, pend) {
    needTown(s, town, (st, t) => st.owner === null && (!pend.region || t.region === pend.region), 'Scegli un quartiere libero valido');
    s.towns[town].owner = p;
  },
  loseTown(s, p, { town }, pend) {
    needTown(s, town, st => st.owner === pend.victim && !st.viking, `Scegli un quartiere di ${name(s, pend.victim)}`);
    s.towns[town].viking = true;
    log(s, `La polizia presidia un quartiere di ${name(s, pend.victim)}.`);
  },
  monastery(s, p, { town }) {
    needTown(s, town, st => st.owner === p && !st.viking && !st.monastery, 'Scegli un tuo quartiere senza progetto urbano');
    s.towns[town].monastery = true;
    log(s, `${name(s, p)} avvia un progetto urbano.`);
  },
  princess(s, p, { choice }) {
    if (!['military', 'trade', 'spurn'].includes(choice)) fail('Scelta non valida');
    if (choice === 'spurn') s.players[p].points += 4; else s.players[p].princess = choice;
  },
};
