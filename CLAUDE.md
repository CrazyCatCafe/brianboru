# Brian Boru, versione digitale

Gioco da tavolo online multiplayer, reskin "Milano 2077". Sito statico (GitHub Pages) + Firebase (Auth Google/email, Realtime Database).

## Regole di lavoro
- Skill installate in `.claude/skills/`: `ponytail` (soluzione più piccola che funziona) e `impeccable` (qualità UI: `/impeccable init`, `audit`, `polish`...).
- Niente build step né framework finché non serve: HTML + CSS + ES modules, Firebase SDK da CDN.
- Asset: `assets/milano` (mappa e dati 3D), `assets/docs` (regolamento originale), `assets/incoming` (nuovi caricamenti da smistare).
- Il grafo dei quartieri viene da `assets/milano/mappa.json` (`node tools/build-board.mjs` rigenera `js/game/board.js`).
- Set di icone scelto: Pieno. Glossario dell'ambientazione in `js/milano/lore.js`.
- La logica di gioco (regole) vive in `js/game/`, separata dalla UI e da Firebase, così si testa da sola.
- `js/firebase-config.js` si committa: la config web di Firebase è pubblica per design, la sicurezza sta in `database.rules.json`.
- Lavorare sempre su `main`, niente branch di sviluppo.
- `npm test` deve passare prima di ogni push.
