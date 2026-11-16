// Stato condiviso dell'app: dati di tutte le tabelle, utente collegato e ruolo.
import { reactive } from 'vue';
import { backend, TABELLE, nuovoId } from './backend.js';

export const db = reactive(Object.fromEntries(TABELLE.map(t => [t, []])));

export const stato = reactive({
    pronto: false,
    utente: null,          // { email }
    membro: null,          // riga di "membri" dell'utente, se è un familiare
    errore: '',
    modo: backend.modo
});

export const puoModificare = () => stato.membro?.ruolo === 'editor';

let smettiDiAscoltare = null;

export async function avvia() {
    try {
        stato.utente = await backend.sessione();
        if (stato.utente) await caricaTutto();
    } catch (e) {
        stato.errore = e.message;
    } finally {
        stato.pronto = true;
    }
}

export async function caricaTutto() {
    const risultati = await Promise.all(TABELLE.map(t => backend.leggi(t).catch(() => [])));
    TABELLE.forEach((t, i) => { db[t] = risultati[i]; });
    stato.membro = db.membri.find(m => m.email.toLowerCase() === stato.utente?.email) ?? null;
    smettiDiAscoltare?.();
    smettiDiAscoltare = backend.ascolta(aggiornaTabella);
}

/// Ricarica una tabella (es. dopo una modifica fatta da un altro familiare).
export async function aggiornaTabella(tabella) {
    try {
        db[tabella] = await backend.leggi(tabella);
        if (tabella === 'membri') {
            stato.membro = db.membri.find(m => m.email.toLowerCase() === stato.utente?.email) ?? null;
        }
    } catch (e) {
        console.warn(e);
    }
}

/// Salva (crea o aggiorna) una riga e aggiorna subito i dati locali.
export async function salva(tabella, riga) {
    const record = { ...riga };
    if (tabella !== 'membri' && !record.id) record.id = nuovoId();
    const salvata = await backend.salva(tabella, record);
    const k = tabella === 'membri' ? 'email' : 'id';
    const indice = db[tabella].findIndex(r => r[k] === salvata[k]);
    if (indice >= 0) db[tabella][indice] = salvata; else db[tabella].push(salvata);
    return salvata;
}

export async function salvaMolti(tabella, righe) {
    const salvate = await backend.salvaMolti(tabella, righe);
    await aggiornaTabella(tabella);
    return salvate;
}

export async function elimina(tabella, id) {
    await backend.elimina(tabella, id);
    await caricaTutto();
}

export async function caricaFile(file, cartella) {
    const pulito = (file.name || 'file').normalize('NFD').replace(/[^\w.\-]+/g, '_');
    return backend.carica(file, `${cartella}/${nuovoId()}-${pulito}`);
}

/// "statico/…" = file pubblicato con il sito (es. schede tecniche dei produttori), il resto sta nello spazio file privato.
export const urlFile = percorso => percorso?.startsWith('statico/') ? Promise.resolve(percorso.slice('statico/'.length)) : backend.url(percorso);

export async function inviaCodice(email) {
    await backend.inviaCodice(email.trim().toLowerCase());
}

export async function verificaCodice(email, codice) {
    await backend.verificaCodice(email.trim().toLowerCase(), codice.trim());
    stato.utente = await backend.sessione();
    await caricaTutto();
}

export async function esci() {
    smettiDiAscoltare?.();
    await backend.esci();
    stato.utente = null;
    stato.membro = null;
    TABELLE.forEach(t => { db[t] = []; });
}

// Ricarica tutto quando l'app torna in primo piano (le web app su iPad restano "congelate").
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && stato.utente) caricaTutto();
});
