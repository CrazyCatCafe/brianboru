// Firebase: account (Google, email), profilo con nickname unico, amici, presenza, inviti, lobby e partite.
// Realtime Database: lo stato della partita è una stringa JSON (il database trasformerebbe gli array in oggetti).
import { newGame, move } from '../game/engine.js';

const BASE = 'https://www.gstatic.com/firebasejs/10.12.2/';
const MAX = 5;

export async function connect(config) {
  const [{ initializeApp }, A, D] = await Promise.all(['firebase-app.js', 'firebase-auth.js', 'firebase-database.js'].map(f => import(BASE + f)));
  const app = initializeApp(config), auth = A.getAuth(app), db = D.getDatabase(app);
  const ref = path => D.ref(db, path);
  const uid = () => auth.currentUser?.uid;
  const nickKey = n => n.trim().toLowerCase();

  async function tx(path, fn) { // transazione; fn lancia Error per annullare con un messaggio
    let err = null;
    await D.runTransaction(ref(path), cur => { try { return fn(cur) ?? undefined; } catch (e) { err = e; return undefined; } });
    if (err) throw err;
  }
  async function gameTx(code, fn) {
    if (!(await D.get(ref('games/' + code))).exists()) throw new Error('Partita inesistente');
    return tx('games/' + code, g => (g ? fn(g) : g)); // a cache vuota il primo tentativo vede null: il server riprova
  }

  const api = {
    onAuth: cb => A.onAuthStateChanged(auth, cb),
    signInGoogle: () => A.signInWithPopup(auth, new A.GoogleAuthProvider()),
    signInEmail: (e, p) => A.signInWithEmailAndPassword(auth, e, p),
    signUpEmail: (e, p) => A.createUserWithEmailAndPassword(auth, e, p),
    resetPassword: e => A.sendPasswordResetEmail(auth, e),
    signOut: () => A.signOut(auth),
    uid,

    async profile() { return (await D.get(ref('users/' + uid()))).val(); },
    async claimNick(nick) {
      nick = nick.trim();
      if (!/^[\p{L}\p{N}_.-]{3,16}$/u.test(nick)) throw new Error('Nickname: da 3 a 16 caratteri, lettere, numeri, _ . -');
      await tx('nicks/' + nickKey(nick), cur => { if (cur && cur !== uid()) throw new Error('Nickname già preso'); return uid(); });
      await D.set(ref('users/' + uid()), { nick, created: D.serverTimestamp() });
    },
    async nickOf(id) { return (await D.get(ref(`users/${id}/nick`))).val() || '???'; },

    goOnline() { // presenza: online finché la connessione è aperta
      const me = ref('presence/' + uid());
      D.onValue(ref('.info/connected'), s => {
        if (!s.val()) return;
        D.onDisconnect(me).set({ online: false, last: D.serverTimestamp() }).then(() => D.set(me, { online: true, last: D.serverTimestamp() }));
      });
    },

    // amici: friends/{me}/{altro} = 'out' (richiesta inviata) | 'in' (ricevuta) | 'ok'
    watchFriends(cb) {
      const seen = {}, nicks = {}, online = {};
      const emit = () => cb(Object.entries(seen).map(([id, st]) => ({ id, st, nick: nicks[id] || '…', online: !!online[id] })));
      return D.onValue(ref('friends/' + uid()), async s => {
        const all = s.val() || {};
        for (const id of Object.keys(seen)) if (!all[id]) delete seen[id];
        for (const [id, st] of Object.entries(all)) {
          seen[id] = st;
          if (!(id in nicks)) {
            nicks[id] = await api.nickOf(id);
            D.onValue(ref(`presence/${id}/online`), p => { online[id] = p.val(); emit(); });
          }
        }
        emit();
      });
    },
    async requestFriend(nick) {
      const id = (await D.get(ref('nicks/' + nickKey(nick)))).val();
      if (!id) throw new Error('Nessun giocatore con questo nickname');
      if (id === uid()) throw new Error('Sei tu!');
      const theirs = (await D.get(ref(`friends/${uid()}/${id}`))).val();
      if (theirs === 'in') return api.acceptFriend(id);
      await D.update(ref(), { [`friends/${uid()}/${id}`]: 'out', [`friends/${id}/${uid()}`]: 'in' });
    },
    acceptFriend: id => D.update(ref(), { [`friends/${uid()}/${id}`]: 'ok', [`friends/${id}/${uid()}`]: 'ok' }),
    removeFriend: id => D.update(ref(), { [`friends/${uid()}/${id}`]: null, [`friends/${id}/${uid()}`]: null }),

    // inviti: invites/{destinatario}/{codice} = { from, at }
    watchInvites: cb => D.onValue(ref('invites/' + uid()), s => cb(Object.entries(s.val() || {}).map(([code, v]) => ({ code, ...v })))),
    async invite(id, code) { await D.set(ref(`invites/${id}/${code}`), { from: (await api.profile()).nick, at: D.serverTimestamp() }); },
    dismissInvite: code => D.remove(ref(`invites/${uid()}/${code}`)),

    // partite
    watchOpenGames: cb => D.onValue(D.query(ref('games'), D.orderByChild('status'), D.equalTo('lobby')),
      s => cb(Object.entries(s.val() || {}).map(([code, g]) => ({ code, ...g, players: Object.values(g.players || {}) })))),
    async createGame(gang) {
      const nick = (await api.profile()).nick;
      const code = Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');
      await D.set(ref('games/' + code), { host: uid(), status: 'lobby', created: D.serverTimestamp(), uids: { [uid()]: true }, players: [{ uid: uid(), nick, gang }] });
      return code;
    },
    async joinGame(code, gang) {
      const nick = (await api.profile()).nick;
      await gameTx(code, g => {
        const players = Object.values(g.players || {});
        if (g.uids?.[uid()]) return null; // già dentro
        if (g.status !== 'lobby') throw new Error('Partita già iniziata');
        if (players.length >= MAX) throw new Error('Partita piena');
        return { ...g, uids: { ...g.uids, [uid()]: true }, players: [...players, { uid: uid(), nick, gang }] };
      });
    },
    leaveGame: code => gameTx(code, g => {
      if (g.status !== 'lobby') return null;
      if (g.host === uid()) return { ...g, status: 'chiusa' }; // chi crea la partita la chiude per tutti
      const uids = { ...g.uids }; delete uids[uid()];
      return { ...g, uids, players: Object.values(g.players || {}).filter(p => p.uid !== uid()) };
    }),
    startGame: code => gameTx(code, g => {
      const players = Object.values(g.players || {});
      if (g.host !== uid()) throw new Error('Solo chi ha creato la partita può avviarla');
      if (players.length < 3) throw new Error('Servono almeno 3 bande');
      return { ...g, status: 'play', state: JSON.stringify(newGame(players.map(p => p.nick))) };
    }),
    act: (code, m) => gameTx(code, g => {
      const me = Object.values(g.players).findIndex(p => p.uid === uid());
      const s = move(JSON.parse(g.state), me, m);
      return { ...g, state: JSON.stringify(s), status: s.stage === 'end' ? 'end' : 'play' };
    }),
    watchGame: (code, cb) => D.onValue(ref('games/' + code), s => s.exists() && cb({ code, ...s.val(), players: Object.values(s.val().players || {}) })),
  };
  return api;
}
