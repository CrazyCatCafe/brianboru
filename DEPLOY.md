# Deploy

Architettura: sito statico su **GitHub Pages** + **Firebase** (Authentication e Realtime Database). Costo: zero (piano Spark).

```
Browser (GitHub Pages: index.html, Three.js e font inclusi nel repo)
  ├─ Firebase Auth: Google o email/password (registrazione obbligatoria)
  └─ Realtime Database
       users/{uid}            profilo { nick }
       nicks/{nick}           uid (nickname unici)
       presence/{uid}         online sì/no
       friends/{uid}/{altro}  'out' | 'in' | 'ok'
       invites/{uid}/{codice} invito a una partita
       games/{codice}         { host, status, players, uids, state (JSON) }
```
Ogni mossa è una transazione: legge lo stato, applica le regole (`js/game/engine.js`) nel browser, riscrive.

## 1. Firebase (progetto `brianboru-e3add`)
1. **Authentication → Metodo di accesso**: Google ed Email/password attivi. Anonimo si può disattivare.
2. **Authentication → Impostazioni → Domini autorizzati**: deve esserci `crazycatcafe.github.io`.
3. **Realtime Database → Regole**: incolla il contenuto di [`database.rules.json`](database.rules.json) e scegli **Pubblica**.
   Va ripubblicato ogni volta che il file cambia.

## 2. GitHub Pages
1. Repo → **Settings → Pages**.
2. Source: **Deploy from a branch**, Branch **main**, cartella **/ (root)**, poi **Save**.
3. Dopo 1–2 minuti il gioco è su https://crazycatcafe.github.io/brianboru/

Ogni push su `main` aggiorna il sito da solo.

## 3. Giocare
1. Apri il sito, entra con Google o con email, scegli il nickname.
2. **Amici**: aggiungi gli amici per nickname; loro accettano dalla stessa lista.
3. **Crea partita** (scegli Technoborghesi o Punk), poi **Invita** gli amici dalla sala d'attesa o manda il link.
4. Con 3–5 bande, chi ha creato la partita sceglie **Inizia**.

Pagine di servizio: `preview-milano.html` (mockup) e `catalogo-milano.html` (tutte le carte e i set di icone).

## Rigenerare i dati di Milano
- Grafo di gioco da `assets/milano/mappa.json`: `node tools/build-board.mjs`
- Edifici, acqua, parchi da OpenStreetMap: `tools/extract-pmtiles.py` e `tools/build-milano.py` (servono `pmtiles`, `mapbox-vector-tile`, `shapely`).

## Limiti noti
- **Mani visibili a chi smanetta**: lo stato della partita è condiviso, quindi con gli strumenti sviluppatore si vedono le carte altrui. Tra amici va bene; la correzione è una Cloud Function (piano Blaze).
- **Fiducia nei client**: le regole sono applicate nel browser; il database controlla solo chi può scrivere, non se la mossa è legale.
- **Partite vecchie**: restano nel database; con l'uso tra amici restano nei limiti gratuiti.
