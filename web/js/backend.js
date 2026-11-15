// Accesso ai dati: Supabase (dati condivisi) oppure modalità prova (localStorage).
// Entrambi espongono la stessa interfaccia, così il resto dell'app non sa dove sono i dati.
import { CONFIG } from './config.js';

export const TABELLE = [
    'membri', 'sezioni', 'contatti', 'guide', 'documenti', 'contratti', 'prodotti', 'movimenti',
    'operazioni', 'tipologie', 'interventi', 'misure_ph', 'processi_acqua', 'carichi_pellet',
    'svuotamenti_cenere'
];

const BUCKET = 'file';

export function nuovoId() {
    return crypto.randomUUID ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
}

// Chiave della tabella "membri" è l'email, per le altre è l'id.
const chiave = tabella => tabella === 'membri' ? 'email' : 'id';

// ---------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------
function creaSupabase() {
    const client = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseChiave, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'casaDolonne.sessione' }
    });
    const cacheUrl = new Map();

    const controlla = ({ data, error }) => {
        if (error) throw new Error(error.message);
        return data;
    };

    return {
        modo: 'supabase',
        async sessione() {
            const { data } = await client.auth.getSession();
            return data.session ? { email: data.session.user.email.toLowerCase() } : null;
        },
        async inviaCodice(email) {
            controlla(await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }));
        },
        async verificaCodice(email, codice) {
            controlla(await client.auth.verifyOtp({ email, token: codice, type: 'email' }));
        },
        async esci() {
            await client.auth.signOut();
        },
        async leggi(tabella) {
            return controlla(await client.from(tabella).select('*').limit(10000));
        },
        async salva(tabella, riga) {
            const record = { ...riga };
            if (tabella !== 'membri' && !record.id) record.id = nuovoId();
            const [salvata] = controlla(await client.from(tabella).upsert(record).select());
            return salvata ?? record;
        },
        async salvaMolti(tabella, righe) {
            if (!righe.length) return [];
            const record = righe.map(r => (tabella !== 'membri' && !r.id) ? { ...r, id: nuovoId() } : r);
            return controlla(await client.from(tabella).upsert(record).select());
        },
        async elimina(tabella, id) {
            controlla(await client.from(tabella).delete().eq(chiave(tabella), id));
        },
        async carica(file, percorso) {
            controlla(await client.storage.from(BUCKET).upload(percorso, file, {
                upsert: true, contentType: file.type || undefined
            }));
            return percorso;
        },
        async url(percorso) {
            if (!percorso) return '';
            const salvato = cacheUrl.get(percorso);
            if (salvato && salvato.scade > Date.now()) return salvato.url;
            const dati = controlla(await client.storage.from(BUCKET).createSignedUrl(percorso, 60 * 60 * 6));
            cacheUrl.set(percorso, { url: dati.signedUrl, scade: Date.now() + 1000 * 60 * 60 * 5 });
            return dati.signedUrl;
        },
        async rimuoviFile(percorso) {
            if (percorso) await client.storage.from(BUCKET).remove([percorso]);
        },
        // Avvisa quando un'altra persona (o un altro dispositivo) modifica una tabella.
        ascolta(callback) {
            const canale = client.channel('casa-dolonne');
            for (const tabella of TABELLE) {
                canale.on('postgres_changes', { event: '*', schema: 'public', table: tabella }, () => callback(tabella));
            }
            canale.subscribe();
            return () => client.removeChannel(canale);
        }
    };
}

// ---------------------------------------------------------------------
// Modalità prova: tutto nel localStorage di questo browser.
// ---------------------------------------------------------------------
function creaProva() {
    const CHIAVE = 'casaDolonne.prova';
    const fileTemporanei = new Map();
    let dati = {};
    try { dati = JSON.parse(localStorage.getItem(CHIAVE) || '{}'); } catch { dati = {}; }
    const scrivi = () => {
        try { localStorage.setItem(CHIAVE, JSON.stringify(dati)); } catch (e) { console.warn('Spazio esaurito', e); }
    };
    const righe = tabella => (dati[tabella] ??= []);

    return {
        modo: 'prova',
        async sessione() { return { email: 'prova@casadolonne' }; },
        async inviaCodice() {},
        async verificaCodice() {},
        async esci() {},
        async leggi(tabella) {
            if (tabella === 'membri' && !righe('membri').length) {
                righe('membri').push({ email: 'prova@casadolonne', nome: 'Prova', ruolo: 'editor' });
            }
            return structuredClone(righe(tabella));
        },
        async salva(tabella, riga) {
            const record = structuredClone(riga);
            const k = chiave(tabella);
            if (!record[k]) record[k] = nuovoId();
            const elenco = righe(tabella);
            const indice = elenco.findIndex(r => r[k] === record[k]);
            if (indice >= 0) elenco[indice] = { ...elenco[indice], ...record };
            else elenco.push(record);
            scrivi();
            return structuredClone(indice >= 0 ? elenco[indice] : record);
        },
        async salvaMolti(tabella, nuove) {
            const salvate = [];
            for (const riga of nuove) salvate.push(await this.salva(tabella, riga));
            return salvate;
        },
        async elimina(tabella, id) {
            const k = chiave(tabella);
            dati[tabella] = righe(tabella).filter(r => r[k] !== id);
            // Cancellazioni a cascata principali, come nel database vero.
            const figli = {
                sezioni: [['guide', 'sezione_id'], ['documenti', 'sezione_id'], ['operazioni', 'sezione_id']],
                prodotti: [['movimenti', 'prodotto_id']],
                operazioni: [['tipologie', 'operazione_id'], ['interventi', 'operazione_id']]
            }[tabella] ?? [];
            for (const [figlia, campo] of figli) dati[figlia] = righe(figlia).filter(r => r[campo] !== id);
            scrivi();
        },
        async carica(file, percorso) {
            // In prova i file caricati restano solo finché la pagina è aperta.
            fileTemporanei.set(percorso, URL.createObjectURL(file));
            return percorso;
        },
        async url(percorso) {
            if (!percorso) return '';
            return fileTemporanei.get(percorso) ?? (percorso.startsWith('seed/') ? percorso : '');
        },
        async rimuoviFile(percorso) { fileTemporanei.delete(percorso); },
        ascolta() { return () => {}; },
        azzera() { dati = {}; scrivi(); }
    };
}

export const backend = CONFIG.supabaseUrl && CONFIG.supabaseChiave ? creaSupabase() : creaProva();
