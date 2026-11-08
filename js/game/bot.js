// Bot semplice per provare il gioco: mosse sempre legali, con qualche regola di buon senso.
// botMove(state) -> [giocatore, mossa] per la decisione in sospeso (come move() di engine.js).
import { current, emptyTowns, leadTowns, ownTowns, expandTargets, vikingTowns } from './engine.js';
import { TOWNS, CARDS } from './data.js';

const pick = a => a[Math.floor(Math.random() * a.length)];
const best = (list, score) => list.reduce((a, b) => (score(b) > score(a) ? b : a));
const fits = (c, color) => CARDS[c].color === color || CARDS[c].color === 'white';
// quanto vale un quartiere per p: meglio nelle zone dove ha già quartieri, così si avvicina al controllo
const zoneScore = (s, p, id) => TOWNS.filter(t => t.region === TOWNS[id].region && s.towns[t.id].owner === p).length + Math.random() * 0.5;

export function botMove(s) {
  const pd = current(s);
  if (!pd) return null;
  if (pd.type === 'draft') {
    const p = s.draft.picks.findIndex(x => !x), pk = s.draft.packets[p];
    const val = c => (CARDS[c].color === 'white' ? 30 : c); // tiene le carte alte e quelle di Briano Borro
    return [p, { cards: [...pk].sort((a, b) => val(b) - val(a)).slice(0, 2) }];
  }
  const p = pd.p, pl = s.players[p];
  switch (pd.type) {
    case 'setupTown': {
      const ok = emptyTowns(s).filter(id => !TOWNS.some(o => o.region === TOWNS[id].region && s.towns[o.id].owner !== null && s.towns[o.id].owner !== p));
      return [p, { town: pick(ok) }];
    }
    case 'activeTown': { // apre dove ha la carta più alta di quel colore, preferendo le sue zone
      const top = color => Math.max(0, ...pl.hand.filter(c => fits(c, color)).map(c => c));
      return [p, { town: best(leadTowns(s, p), id => top(TOWNS[id].color) + zoneScore(s, p, id) * 3) }];
    }
    case 'play': {
      const t = s.trick, color = TOWNS[t.town].color, hand = pl.hand;
      if (p === t.leader) { const ok = hand.filter(c => fits(c, color)); return [p, { card: Math.max(...(ok.length ? ok : hand)) }]; }
      const high = Math.max(0, ...t.plays.filter(x => fits(x.card, color)).map(x => x.card));
      const win = hand.filter(c => fits(c, color) && c > high);
      // se può vincere usa la carta vincente più bassa, altrimenti si libera della più bassa (agisce per prima)
      return [p, { card: win.length ? Math.min(...win) : Math.min(...hand) }];
    }
    case 'action': {
      const card = CARDS[pd.card];
      const opt = pd.won ? 'p' : best(card.secondary.map((_, i) => i), i => card.secondary[i].length + Math.random());
      const syms = opt === 'p' ? card.primary : card.secondary[opt];
      const m = { opt, extra: 0 };
      if (syms.includes('E') && pl.coins + syms.filter(x => x === 'C').length >= 5) {
        const tg = expandTargets(s, p); if (tg.length) m.expand = best(tg, id => zoneScore(s, p, id));
      }
      if (syms.includes('V') && vikingTowns(s).length) m.viking = best(vikingTowns(s), id => (s.towns[id].owner === p ? 2 : 0) + Math.random());
      return [p, m];
    }
    case 'placeTown': return [p, { town: best(emptyTowns(s, pd.region), id => zoneScore(s, p, id)) }];
    case 'loseTown': return [p, { town: pick(ownTowns(s, pd.victim)) }];
    case 'monastery': return [p, { town: pick(ownTowns(s, p).filter(id => !s.towns[id].monastery)) }];
    case 'princess': return [p, { choice: pick(['military', 'trade', 'spurn']) }];
  }
  return null;
}
