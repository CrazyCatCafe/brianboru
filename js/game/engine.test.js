// node js/game/engine.test.js — gioca partite complete con mosse casuali legali e controlla invarianti.
import assert from 'node:assert/strict';
import { newGame, move, current, emptyTowns, ownTowns, expandTargets, vikingTowns } from './engine.js';
import { TOWNS, CARDS, REGIONS } from './data.js';

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
    case 'activeTown': return [pd.p, town(emptyTowns(s))];
    case 'play': {
      const hand = s.players[pd.p].hand, color = TOWNS[s.trick.town].color;
      const fits = hand.filter(c => CARDS[c].color === color || CARDS[c].color === 'white');
      return [pd.p, { card: pick(pd.p === s.trick.leader && fits.length ? fits : hand) }];
    }
    case 'action': {
      const card = CARDS[pd.card], pl = s.players[pd.p];
      const opt = pd.won ? 'p' : pick(card.secondary.map((_, i) => i));
      const syms = opt === 'p' ? card.primary : card.secondary[opt];
      const m = { opt, extra: 0 };
      if (syms.includes('X') && pl.coins >= 4) m.extra = 1;
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
console.log('ok: 600 partite simulate');
