# Brian Boru, versione digitale

Gioco da tavolo online multiplayer. Sito statico (GitHub Pages) + Firebase (Realtime Database per lo stato di gioco, Auth anonima per i giocatori).

## Regole di lavoro
- Skill installate in `.claude/skills/`: `ponytail` (soluzione più piccola che funziona) e `impeccable` (qualità UI: `/impeccable init`, `audit`, `polish`...).
- Niente build step né framework finché non serve: HTML + CSS + ES modules, Firebase SDK da CDN.
- Asset: `assets/board` (tabellone), `assets/docs` (regolamento e schede), `assets/incoming` (nuovi caricamenti da smistare).
- La logica di gioco (regole) vive in `js/game/`, separata dalla UI e da Firebase, così si testa da sola.
- `js/firebase-config.js` si committa: la config web di Firebase è pubblica per design, la sicurezza sta in `database.rules.json`.
- Lavorare sempre su `main`, niente branch di sviluppo.
- `npm test` deve passare prima di ogni push.
