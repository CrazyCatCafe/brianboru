# Brian Boru

Versione digitale online del gioco da tavolo Brian Boru (Peer Sylvester, Osprey Games), da giocare con gli amici.
Prototipo: regole complete, grafica provvisoria sopra la foto del tabellone.

- Hosting: GitHub Pages (sito statico, nessun build step)
- Partite online: Firebase Auth anonima + Firestore
- Modalità "stesso dispositivo" senza alcuna configurazione

Deploy: vedi [DEPLOY.md](DEPLOY.md).

## Sviluppo locale
```bash
python3 -m http.server 8000
```
Apri http://localhost:8000.

```bash
npm test
```
Simula 600 partite complete (3, 4 e 5 giocatori) con mosse casuali e controlla gli invarianti delle regole.

## Struttura
- `js/game/data.js`: città, regioni, strade, carte, tracciati.
- `js/game/engine.js`: regole come funzioni pure (`newGame`, `move`).
- `js/net.js`: Firebase (sala d'attesa, mosse in transazione).
- `js/app.js`, `css/style.css`, `index.html`: interfaccia.
- `assets/board`, `assets/docs`: tabellone e regolamenti originali.
