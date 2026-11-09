// node js/game/engine.test.js — gioca partite complete con mosse casuali legali e controlla invarianti.
import assert from 'node:assert/strict';
import { newGame, move, current, emptyTowns, leadTowns, ownTowns, expandTargets, vikingTowns } from './engine.js';
import { TOWNS, CARDS, REGIONS } from './data.js';
import { botMove as smartBot } from './bot.js';

let leadFit = 0, leadMiss = 0;
const pick = a => a[Math.floor(Math.random() * a.length)];

function botMove(s) {
  const pd = current(s);
  const town = list => ({ town: pick(list) });
  switch (pd.type) {
    case 'draft': {
      const p = s.draft.picks.findIndex(x => !x);
      return [p, { cards: s.draft.packets[p].slice(0, 2) }];
    }
    case 'setupTown': return [pd.p, town(emptyTowns(s).filter(id =>
      !TOWNS.some(o => o.region === TOWNS[id].region && s.towns[o.id].owner !== null)))];
    case 'activeTown': return [pd.p, town(leadTowns(s, pd.p))];
    case 'play': {
      const hand = s.players[pd.p].hand, color = TOWNS[s.trick.town].color;
      const fits = hand.filter(c => CARDS[c].color === color || CARDS[c].color === 'white');
      if (pd.p === s.trick.leader && fits.length) leadFit++; else if (pd.p === s.trick.leader) leadMiss++;
      return [pd.p, { card: pick(pd.p === s.trick.leader && fits.length ? fits : hand) }];
    }
    case 'action': {
      const card = CARDS[pd.card], pl = s.players[pd.p];
      const opt = pd.won ? 'p' : pick(card.secondary.map((_, i) => i));
      const syms = opt === 'p' ? card.primary : card.secondary[opt];
      const m = { opt, extra: 0 };
      if (syms.includes('M') && pl.coins >= 4 && pl.mar + syms.filter(x => x === 'M').length < 9) m.extra = 1;
      if (syms.includes('E') && pl.coins + syms.filter(x => x === 'C').length >= 5) m.expand = pick([null, ...expandTargets(s, pd.p)]);
      if (syms.includes('V')) m.viking = pick(vikingTowns(s));
      return [pd.p, m];
    }
    case 'placeTown': return [pd.p, town(emptyTowns(s, pd.region))];
    case 'loseTown': return [pd.p, town(ownTowns(s, pd.victim))];
    case 'monastery': return [pd.p, town(ownTowns(s, pd.p).filter(id => !s.towns[id].monastery))];
    case 'princess': return [pd.p, { choice: pick(['military', 'trade', 'spurn']) }];
  }
}

for (const n of [3, 4, 5]) {
  for (let g = 0; g < 200; g++) {
    let s = newGame(Array.from({ length: n }, (_, i) => 'P' + i), g * 7 + n);
    let steps = 0;
    while (s.stage !== 'end') {
      const [p, m] = botMove(s);
      s = move(s, p, m);
      assert.ok(++steps < 2000, 'partita bloccata');
      assert.ok(s.players.every(pl => pl.coins >= 0 && pl.points >= 0 && pl.raiders >= 0 && pl.church >= 0 && pl.mar >= 0 && pl.mar <= 9));
      assert.ok(s.area >= 0);
    }
    assert.equal(s.round, n === 3 ? 3 : 4);
    assert.ok(s.winner.length >= 1);
    const kinds = new Set(s.events.map(e => e.k));
    for (const k of ['party', 'guerrilla', 'community', 'uprising']) assert.ok(kinds.has(k), 'manca evento ' + k);
    assert.equal(JSON.stringify(JSON.parse(JSON.stringify(s))), JSON.stringify(s)); // serializzabile per Firebase
  }
}

// mosse illegali
let s = newGame(['A', 'B', 'C'], 1);
const p = current(s).p;
assert.throws(() => move(s, (p + 1) % 3, { town: 0 }), /Tocca a/);
assert.throws(() => move(s, p, { town: 999 }));
assert.equal(Object.keys(CARDS).length, 25);
assert.equal(Object.keys(REGIONS).length, 8);
// chi apre: solo quartieri di un colore che ha in mano (o tutti con una bianca), poi solo quel colore o bianca
for (let seed = 1, checked = 0; checked < 50; seed++) {
  let g = newGame(['A', 'B', 'C'], seed);
  while (current(g).type !== 'activeTown') { const [q, m] = botMove(g); g = move(g, q, m); }
  const L = current(g).p, hand = g.players[L].hand;
  if (hand.some(c => CARDS[c].color === 'white')) continue;
  const colors = new Set(hand.map(c => CARDS[c].color));
  const bad = emptyTowns(g).find(id => !colors.has(TOWNS[id].color));
  if (bad === undefined) continue;
  assert.throws(() => move(g, L, { town: bad }), /colore/);
  const town = leadTowns(g, L)[0], color = TOWNS[town].color;
  g = move(g, L, { town });
  const off = hand.find(c => CARDS[c].color !== color);
  if (off) assert.throws(() => move(g, L, { card: off }), /Chi apre/);
  checked++;
}
assert.equal(leadMiss, 0, 'chi apre senza carte giocabili');
// i bot del gioco finiscono partite intere senza mosse illegali
for (let g = 0; g < 60; g++) {
  let b = newGame(['A', 'B', 'C', 'D', 'E'].slice(0, 3 + (g % 3)), 9000 + g), n = 0;
  while (b.stage !== 'end') { const [q, m] = smartBot(b); b = move(b, q, m); assert.ok(++n < 2000, 'bot bloccato'); }
}
// regola della casa: si pagano passi in più solo per l'hype
{
  let g = newGame(['A', 'B', 'C'], 3);
  for (let n = 0; n < 2000 && g.stage !== 'end'; n++) {
    const pd = current(g);
    if (pd.type === 'action') {
      const card = CARDS[pd.card], opt = pd.won ? 'p' : 0, sy = opt === 'p' ? card.primary : card.secondary[0];
      if (!sy.includes('M') && (sy.includes('X') || sy.includes('A'))) { g.players[pd.p].coins = 9; assert.throws(() => move(g, pd.p, { opt, extra: 1 }), /hype/); break; }
    }
    const [q, m] = botMove(g); g = move(g, q, m);
  }
}
console.log('ok: 600 partite simulate, 60 partite tra bot');
