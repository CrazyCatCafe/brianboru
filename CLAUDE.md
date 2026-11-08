# Brian Boru, versione digitale

Gioco da tavolo online multiplayer. Sito statico (GitHub Pages) + Firebase (Firestore per lo stato di gioco, Auth anonima per i giocatori).

## Regole di lavoro
- Skill installate in `.claude/skills/`: `ponytail` (soluzione più piccola che funziona) e `impeccable` (qualità UI: `/impeccable init`, `audit`, `polish`...).
- Niente build step né framework finché non serve: HTML + CSS + ES modules, Firebase SDK da CDN.
- Gli asset del gioco (board, carte, pedine) vanno in `assets/`.
- La logica di gioco (regole) vive in `js/game/`, separata dalla UI e da Firebase, così si testa da sola.
- `js/firebase-config.js` NON è committato con segreti: la config web di Firebase è pubblica per design, la sicurezza sta nelle Firestore rules.
