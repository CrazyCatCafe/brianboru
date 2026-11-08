// Firebase: auth anonima + un documento Firestore per partita (games/{codice}).
// Lo stato è salvato come stringa JSON: Firestore non accetta array annidati.
import { newGame, move } from './game/engine.js';

const BASE = 'https://www.gstatic.com/firebasejs/10.12.2/';

export async function connect(config) {
  const [{ initializeApp }, { getAuth, signInAnonymously }, fs] = await Promise.all(
    ['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'].map(f => import(BASE + f)));
  const app = initializeApp(config);
  const { user } = await signInAnonymously(getAuth(app));
  const db = fs.getFirestore(app), uid = user.uid;
  const ref = code => fs.doc(db, 'games', code);
  const tx = (code, fn) => fs.runTransaction(db, async t => {
    const d = await t.get(ref(code));
    if (!d.exists()) throw new Error('Partita inesistente');
    const upd = fn(d.data());
    if (upd) t.update(ref(code), upd);
  });

  return {
    uid,
    async create(name) {
      const code = Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');
      await fs.setDoc(ref(code), { host: uid, uids: [uid], players: [{ uid, name }], state: null, created: fs.serverTimestamp() });
      return code;
    },
    join: (code, name) => tx(code, g => {
      if (g.players.some(p => p.uid === uid)) return null; // rientro
      if (g.state) throw new Error('Partita già iniziata');
      if (g.players.length >= 5) throw new Error('Partita piena');
      return { uids: [...g.uids, uid], players: [...g.players, { uid, name }] };
    }),
    start: code => tx(code, g => {
      if (g.host !== uid) throw new Error('Solo chi ha creato la partita può avviarla');
      return { state: JSON.stringify(newGame(g.players.map(p => p.name))) };
    }),
    act: (code, m) => tx(code, g => {
      const me = g.players.findIndex(p => p.uid === uid);
      return { state: JSON.stringify(move(JSON.parse(g.state), me, m)) };
    }),
    watch: (code, cb) => fs.onSnapshot(ref(code), d => cb(d.data())),
  };
}
