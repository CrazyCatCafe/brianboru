# Brian Boru · Milano 2077

Versione digitale online del gioco da tavolo Brian Boru (Peer Sylvester, Osprey Games), ambientata in una Milano cyberpunk:
bande di technoborghesi e punk si contendono i quartieri tra retate della polizia, progetti di comunità e rave clandestini.

- Città 3D con edifici reali (OpenStreetMap), Three.js incluso nel repo
- Account Google/email, amici, inviti, lobby e partite online su Firebase Realtime Database
- Partita locale sullo stesso dispositivo

Deploy: [DEPLOY.md](DEPLOY.md). Prompt per le illustrazioni: [docs/prompt-illustrazioni.md](docs/prompt-illustrazioni.md).

## Sviluppo
```bash
python3 -m http.server 8000
```
Apri http://localhost:8000.

```bash
npm test
```
Simula 600 partite complete sul grafo di Milano e controlla le regole.

## Struttura
- `js/game/`: regole (`engine.js`), carte (`data.js`), grafo dei quartieri (`board.js`, generato).
- `js/milano/`: tema, icone, carte, illustrazioni, città 3D (`city3d.js`), Firebase (`online.js`).
- `js/main.js`, `index.html`, `css/milano.css`: l'app.
- `assets/milano/`: mappa e dati 3D; `assets/docs/`: regolamento originale.
