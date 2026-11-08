# Piano di deployment

Architettura: sito statico su **GitHub Pages** + **Firebase** (Auth anonima e Firestore) per lo stato delle partite online.
Costo: zero. Il piano gratuito Spark di Firebase basta largamente per un gruppo di amici.

```
Browser (GitHub Pages)  ──  Firebase Auth (anonimo)
        │
        └── Firestore: games/{CODICE} = { host, uids, players, state(JSON) }
             ogni mossa = transazione: legge lo stato, applica le regole (js/game/engine.js), riscrive
```

## 1. GitHub Pages (5 minuti)
1. Repo su GitHub → **Settings → Pages**.
2. In "Build and deployment", Source: **Deploy from a branch**, Branch: **main**, cartella **/ (root)**, poi **Save**.
3. Dopo 1–2 minuti il sito è su `https://crazycatcafe.github.io/brianboru/`.

Da subito funziona la modalità **"Stesso dispositivo"**: tutti i giocatori a turno sullo stesso schermo.

## 2. Firebase (10 minuti)
1. Vai su https://console.firebase.google.com e scegli **Aggiungi progetto** (Google Analytics non serve).
2. **Build → Authentication → Inizia → Sign-in method → Anonimo → Abilita**.
3. **Authentication → Impostazioni → Domini autorizzati → Aggiungi dominio**: `crazycatcafe.github.io`.
4. **Build → Firestore Database → Crea database**: località `eur3 (europe-west)`, avvio in **modalità produzione**.
5. **Firestore → Regole**: incolla il contenuto di [`firestore.rules`](firestore.rules) e scegli **Pubblica**.
6. **Impostazioni progetto (⚙) → Le tue app → Web (`</>`)**: registra l'app con un nome qualsiasi, senza Hosting, e copia l'oggetto `firebaseConfig`.

## 3. Collegare il sito a Firebase
1. Copia `js/firebase-config.example.js` in `js/firebase-config.js` e incolla i valori.
2. Fai commit e push su `main`.

La config web di Firebase **non è un segreto**: è pubblica per design e finisce comunque nel browser di chi gioca. La protezione sta nelle regole Firestore (solo chi partecipa a una partita può modificarla) e nei domini autorizzati.
Facoltativo: in Google Cloud Console → Credenziali, limita la API key ai referrer `https://crazycatcafe.github.io/*` e `http://localhost:*`.

## 4. Giocare
1. Apri il sito, scrivi il tuo nome e scegli **Crea partita**.
2. Manda il link della sala d'attesa agli amici (contiene il codice).
3. Quando ci sono 3–5 giocatori, chi ha creato la partita sceglie **Inizia la partita**.

Ricaricando la pagina si rientra nella partita: l'identità anonima resta salvata nel browser.

## Limiti noti del prototipo
- **Informazioni nascoste**: le mani sono nello stato condiviso. Chi apre gli strumenti sviluppatore può sbirciarle. Va bene tra amici; la correzione è spostare le mani in documenti per giocatore o in una Cloud Function (piano Blaze).
- **Fiducia nei client**: ogni client applica le regole nel proprio browser. Un giocatore smaliziato potrebbe scrivere uno stato falso. Si risolve con la stessa Cloud Function.
- **Mappa**: regioni e strade sono state ricavate dalla foto del tabellone, quindi vanno verificate (`js/game/data.js`).
- **Nessuna pulizia automatica** delle vecchie partite in Firestore: con l'uso tra amici restano nei limiti gratuiti per anni.
