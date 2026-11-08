// Firebase: auth anonima + Realtime Database, un nodo per partita (games/{codice}).
// Lo stato è salvato come stringa JSON: il Realtime Database trasformerebbe gli array in oggetti.
import { newGame, move } from './game/engine.js';

const BASE = 'https://www.gstatic.com/firebasejs/10.12.2/';

export async function connect(config) {
  const [{ initializeApp }, { getAuth, signInAnonymously }, db] = await Promise.all(
    ['firebase-app.js', 'firebase-auth.js', 'firebase-database.js'].map(f => import(BASE + f)));
  const app = initializeApp(config);
  const { user } = await signInAnonymously(getAuth(app));
  const rtdb = db.getDatabase(app), uid = user.uid;
  const ref = code => db.ref(rtdb, 'games/' + code);

  // Transazione: fn(partita) restituisce la partita aggiornata o null per non cambiare nulla.
  async function tx(code, fn) {
    if (!(await db.get(ref(code))).exists()) throw new Error('Partita inesistente'); // scalda la cache locale
    let err = null;
    await db.runTransaction(ref(code), g => {
      if (!g) return g; // primo tentativo a cache vuota: il server ripete con il valore vero
      try { return fn(g) ?? undefined; } catch (e) { err = e; return undefined; } // undefined = annulla
    });
    if (err) throw err;
  }

  return {
    uid,
    async create(name) {
      const code = Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');
      await db.set(ref(code), { host: uid, uids: { [uid]: true }, players: [{ uid, name }], created: db.serverTimestamp() });
      return code;
    },
    join: (code, name) => tx(code, g => {
      if (g.uids[uid]) return null; // rientro
      if (g.state) throw new Error('Partita già iniziata');
      if (g.players.length >= 5) throw new Error('Partita piena');
      return { ...g, uids: { ...g.uids, [uid]: true }, players: [...g.players, { uid, name }] };
    }),
    start: code => tx(code, g => {
      if (g.host !== uid) throw new Error('Solo chi ha creato la partita può avviarla');
      return { ...g, state: JSON.stringify(newGame(g.players.map(p => p.name))) };
    }),
    act: (code, m) => tx(code, g => {
      const me = g.players.findIndex(p => p.uid === uid);
      return { ...g, state: JSON.stringify(move(JSON.parse(g.state), me, m)) };
    }),
    watch: (code, cb) => db.onValue(ref(code), snap => snap.exists() && cb(snap.val())),
  };
}
