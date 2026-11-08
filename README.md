# Brian Boru

Versione digitale online del gioco da tavolo Brian Boru, da giocare con gli amici.

- Hosting: GitHub Pages (sito statico)
- Stato partita in tempo reale: Firebase Firestore

## Sviluppo locale
```bash
python3 -m http.server 8000
```
Apri http://localhost:8000.

## Setup Firebase (da fare una volta)
1. Crea un progetto su console.firebase.google.com, aggiungi una Web app.
2. Abilita Firestore e Authentication → Anonymous.
3. Copia `js/firebase-config.example.js` in `js/firebase-config.js` e incolla la tua config.
