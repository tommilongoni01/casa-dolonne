# Casa Dolonne – web app

Manutenzione, manuali e contatti dello chalet, condivisi con tutta la famiglia.
Si apre dal browser e si installa sulla Home di iPad e iPhone ("Aggiungi a Home"); non scade mai ed è gratuita.

- **Dati condivisi:** [Supabase](https://supabase.com) (piano gratuito: database, accesso via email, file).
- **Pubblicazione:** [GitHub Pages](https://pages.github.com) (gratuito).
- **Finché Supabase non è configurato** l'app funziona in *modalità prova*, con dati salvati solo nel browser.

---

## 1. Supabase (dati e accesso) – circa 10 minuti

1. Crea un account gratuito su **supabase.com** → **New project**.
   - Nome: `casa-dolonne` · Regione: *Central EU (Frankfurt)* · scegli una password del database e conservala.
2. Apri **SQL Editor → New query**, incolla tutto il file [`supabase/schema.sql`](../supabase/schema.sql) e premi **Run**.
3. Sempre nel SQL Editor registra il primo familiare che potrà modificare (es. tuo padre), poi **Run**:
   ```sql
   insert into membri (email, nome, ruolo) values ('email.di.papa@esempio.it', 'Papà', 'editor');
   ```
   Se vuoi poter modificare anche tu, aggiungi una seconda riga con la tua email.
4. Supabase permette di modificare i modelli email solo con un server email proprio. Si usa Gmail, gratis:
   - Sul tuo account Google attiva la *Verifica in due passaggi*, poi apri **myaccount.google.com/apppasswords**, crea una password per l'app "Supabase" e copia le 16 lettere.
   - Su Supabase: **Authentication → Emails → SMTP Settings → Enable custom SMTP**:
     Sender email = il tuo indirizzo Gmail · Sender name = `Casa Dolonne` · Host = `smtp.gmail.com` · Port = `587` · Username = il tuo indirizzo Gmail · Password = le 16 lettere senza spazi → **Save**.

   Poi in **Authentication → Emails → Templates → Magic Link** sostituisci il testo con questo, così l'email contiene il codice a 6 cifre (sulle web app installate sulla Home i link di accesso non funzionano):
   ```html
   <h2>Casa Dolonne</h2>
   <p>Il tuo codice di accesso è:</p>
   <h1 style="letter-spacing:4px">{{ .Token }}</h1>
   <p>Scade tra un'ora.</p>
   ```
   Fai lo stesso nel modello **Confirm signup** (serve al primo accesso di ogni persona).
5. Copia l'indirizzo e la chiave del progetto e incollali in [`web/js/config.js`](js/config.js):
   - **Project URL**: pulsante verde **Connect** in alto (oppure **Settings → Data API**), del tipo `https://xxxxxxxx.supabase.co`.
   - **Publishable key**: **Settings → API Keys**, riga *default*, inizia con `sb_publishable_`. **Non** usare la *Secret key*.
   ```js
   export const CONFIG = {
       supabaseUrl: 'https://xxxxxxxx.supabase.co',
       supabaseChiave: 'sb_publishable_...'
   };
   ```
   La chiave *publishable* è pubblica per natura: i dati sono protetti dalle regole del database (solo i familiari registrati leggono, solo gli editor modificano).

## 2. GitHub (pubblicazione) – circa 10 minuti

1. Crea un account gratuito su **github.com** e un repository nuovo, per esempio `casa-dolonne` (può essere privato solo con piano a pagamento per Pages: lascialo **pubblico**; i dati restano privati in Supabase).
2. Collega e carica il progetto dal Terminale, nella cartella `App_Dolonne`:
   ```bash
   git remote add origin https://github.com/TUO-NOME/casa-dolonne.git
   git push -u origin main
   ```
3. Nel repository: **Settings → Pages → Source: GitHub Actions**.
4. La pubblicazione parte da sola a ogni modifica della cartella `web/`. Dopo un paio di minuti l'app è su
   `https://TUO-NOME.github.io/casa-dolonne/`.
5. Torna su Supabase → **Authentication → URL Configuration** e imposta **Site URL** con quell'indirizzo.

Il file `.github/workflows/risveglio.yml` fa una piccola richiesta due volte a settimana: Supabase gratuito sospende i progetti dopo 7 giorni senza attività.

## 3. Primo avvio (dal Mac, una volta sola)

Le foto e i PDF delle guide e i carichi pellet sono **privati** (c'è anche lo screenshot del login meinETA con la password): stanno nella cartella `web/seed/`, che **non** viene pubblicata su GitHub (vedi `.gitignore`). Si caricano in Supabase dal Mac, dove restano visibili solo ai familiari registrati.

1. Nel Terminale: `cd ~/Documents/App_Dolonne/web && python3 -m http.server 8765`
2. Apri **http://127.0.0.1:8765** in Safari sul Mac, inserisci l'email *editor* e il codice ricevuto.
3. **Impostazioni → Carica contenuti iniziali**: crea sistemi, operazioni, guide della Caldaia con foto e PDF e i 16 carichi di pellet.
4. **Impostazioni → Famiglia → +**: aggiungi gli altri familiari con *Sola lettura* (o *Può modificare*).
5. Chiudi il Terminale (Ctrl+C). Da qui in poi tutti usano l'indirizzo pubblicato.

## 4. Sui dispositivi della famiglia

Apri `https://TUO-NOME.github.io/casa-dolonne/` in Safari → pulsante **Condividi** → **Aggiungi alla schermata Home**.
Al primo avvio ognuno inserisce la propria email e il codice ricevuto; poi resta collegato.

## Modifiche all'app

1. Le modifiche si fanno nei file della cartella `web/` (anche chiedendole a Claude in Xcode).
2. **Prova sul Mac** prima di pubblicare: `cd ~/Documents/App_Dolonne/web && python3 -m http.server 8765` e apri http://127.0.0.1:8765.
3. **Se la modifica richiede nuovi campi nel database** c'è un file `supabase/aggiornamento-….sql`: va eseguito una volta nel SQL Editor di Supabase **prima** di pubblicare.
4. **Pubblica** dal Terminale: `cd ~/Documents/App_Dolonne && git push`. Dopo un paio di minuti tutti i dispositivi ricevono la nuova versione alla prossima apertura dell'app (eventualmente chiudila e riaprila).

I dati (letture, acquisti, guide…) non passano da qui: sono in Supabase e si aggiornano subito per tutti.

## Limiti del piano gratuito

| Servizio | Limite | Per noi |
|---|---|---|
| Supabase database | 500 MB | Ampiamente sufficiente (testi e numeri) |
| Supabase file | 1 GB | Le guide della Caldaia occupano ~10 MB |
| Email di accesso (Gmail) | 500 al giorno | Si entra una volta per dispositivo |
| GitHub Pages | 1 GB, 100 GB di traffico al mese | Ampiamente sufficiente |

## Struttura

```
web/
├── index.html, manifest.webmanifest, sw.js   pagina, installazione sulla Home, funzionamento offline
├── css/app.css                                stile iOS, tema chiaro e scuro
├── js/
│   ├── config.js        indirizzo e chiave di Supabase
│   ├── backend.js       Supabase oppure modalità prova
│   ├── store.js         dati condivisi, aggiornamento in tempo reale
│   ├── logic.js         scorte, allarmi, stato della casa, pellet, cenere, cambio acqua
│   ├── seed.js          contenuti iniziali
│   └── views/           schermate (manutenzione, operazioni, manuale, contatti, impostazioni)
├── seed/                guide, foto e PDF iniziali, carichi pellet
└── vendor/              Vue 3 e Supabase JS (copie locali)
```

Per provarla sul Mac: `python3 -m http.server 8765` nella cartella `web`, poi apri `http://127.0.0.1:8765`.
