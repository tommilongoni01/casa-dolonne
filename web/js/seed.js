// Contenuti iniziali: sistemi, prodotti, operazioni, guide della Caldaia (con foto e PDF) e carichi pellet.
// Gli stessi dati dell'app iOS. Si caricano una sola volta, da un account editor.
import { backend } from './backend.js';
import { db, salva, salvaMolti, caricaTutto } from './store.js';

const SEZIONI = [
    ['Impianto idraulico', 'goccia'], ['Impianto elettrico', 'fulmine'], ['Caldaia', 'fiamma'],
    ['Istruzioni generali', 'libro'], ['Impianto fotovoltaico', 'sole'], ['Piscina', 'piscina'],
    ['Ascensore', 'ascensore'], ['UTA', 'ventola'], ['VMC', 'vento']
];

const PRINCIPALE_CLIENTE = [['Principale', 12], ['Cliente', 0]];

const escape = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/// Paragrafi del file convertito dal Word → HTML semplice della guida.
function paragrafiInHtml(paragrafi) {
    return paragrafi.filter(p => p.runs.some(r => r.t.trim())).map(p => {
        const testo = p.runs.map(r => {
            let t = escape(r.t);
            if (r.b) t = `<b>${t}</b>`;
            if (r.i) t = `<i>${t}</i>`;
            if (r.link) t = `<a href="${escape(r.link)}">${t}</a>`;
            return t;
        }).join('');
        return p.stile === 'titoletto' ? `<h3>${testo}</h3>` : `<p>${testo}</p>`;
    }).join('');
}

/// Carica un file della cartella seed nello spazio file condiviso (in prova usa direttamente il file locale).
async function caricaSeed(nome, cartella) {
    if (backend.modo === 'prova') return `seed/${nome}`;
    const risposta = await fetch(`seed/${nome}`);
    const blob = await risposta.blob();
    const tipo = nome.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
    return backend.carica(new File([blob], nome, { type: tipo }), `${cartella}/${nome}`);
}

export async function inizializzaDati(avanzamento = () => {}) {
    if (db.sezioni.length) throw new Error('I contenuti iniziali sono già stati caricati.');
    // I file iniziali sono privati e non vengono pubblicati su GitHub: il caricamento si fa dal Mac.
    const prova = await fetch('seed/contenuti_manuale.json', { method: 'HEAD' }).catch(() => null);
    if (!prova?.ok) {
        throw new Error("I contenuti iniziali non sono disponibili su questo indirizzo. Caricali una volta dal Mac (vedi LEGGIMI, punto 3).");
    }

    avanzamento('Sistemi…');
    const sezioni = await salvaMolti('sezioni', SEZIONI.map(([nome, icona], ordine) => ({ nome, icona, ordine })));
    const id = nome => sezioni.find(s => s.nome === nome).id;

    avanzamento('Prodotti…');
    const ossigeno = await salva('prodotti', { nome: 'Ossigeno attivo', categoria: 'ossigeno', unita: 'l', scorta_minima: 50, confezioni: [5, 1], ordine: 0 });
    await salva('prodotti', { nome: 'pH-', categoria: 'ph', unita: 'kg', scorta_minima: 0, ordine: 1 });
    await salva('prodotti', { nome: 'pH+', categoria: 'ph', unita: 'kg', scorta_minima: 0, ordine: 2 });

    avanzamento('Operazioni…');
    const operazioni = [
        ['Piscina', 'pH', 'ph', {}], ['Piscina', 'Ossigeno', 'ossigeno', { prodotto_id: ossigeno.id, giorni_allarme: 20 }],
        ['Piscina', 'Cambio acqua', 'cambioAcqua', {}], ['Piscina', 'Storico manutenzioni', 'storico', {}, [['Manutenzione fornitore', 0]]],
        ['Caldaia', 'Pellet', 'pellet', {}], ['Caldaia', 'Svuotamento cenere', 'cenere', {}],
        ['Caldaia', 'Storico manutenzioni', 'storico', {}, PRINCIPALE_CLIENTE],
        ['UTA', 'Storico manutenzioni', 'storico', {}, [['Manutenzione', 12]]],
        ['VMC', 'Storico manutenzioni', 'storico', {}, [['Manutenzione', 12]]],
        ['Ascensore', 'Storico manutenzioni', 'storico', {}, [['Manutenzione impianto', 6], ['Verifica periodica', 24]]],
        ['Impianto fotovoltaico', 'Storico manutenzioni', 'storico', {}, PRINCIPALE_CLIENTE],
        ['Impianto idraulico', 'Storico manutenzioni', 'storico', {}, PRINCIPALE_CLIENTE],
        ['Impianto elettrico', 'Storico manutenzioni', 'storico', {}, PRINCIPALE_CLIENTE]
    ];
    const ordini = {};
    for (const [sezione, titolo, tipo, extra, tipologie] of operazioni) {
        ordini[sezione] = (ordini[sezione] ?? -1) + 1;
        const o = await salva('operazioni', { sezione_id: id(sezione), titolo, tipo, ordine: ordini[sezione], passaggi: [], ...extra });
        if (tipologie) {
            await salvaMolti('tipologie', tipologie.map(([nome, mesi_avviso], ordine) => ({ operazione_id: o.id, nome, mesi_avviso, ordine })));
        }
    }

    avanzamento('Guide e documenti della Caldaia…');
    const manuale = await (await fetch('seed/contenuti_manuale.json')).json();
    for (const voce of manuale.sezioni) {
        const sezioneId = id(voce.sezione);
        for (const documento of voce.documenti) {
            const percorso = await caricaSeed(documento.file, 'documenti');
            await salva('documenti', { sezione_id: sezioneId, titolo: documento.titolo, nome_file: documento.file, percorso, dimensione: 128457 });
        }
        let n = 0;
        for (const guida of voce.guide) {
            avanzamento(`Guida ${++n} di ${voce.guide.length}…`);
            const blocchi = [];
            for (const b of guida.blocchi) {
                if (b.testo) blocchi.push({ tipo: 'testo', html: paragrafiInHtml(b.testo) });
                else if (b.immagine) blocchi.push({ tipo: 'immagine', percorso: await caricaSeed(b.immagine, 'manuale'), didascalia: b.didascalia ?? '' });
            }
            await salva('guide', { sezione_id: sezioneId, titolo: guida.titolo, blocchi, aggiornata: new Date().toISOString() });
        }
    }

    avanzamento('Carichi pellet…');
    const pellet = await (await fetch('seed/carichi_pellet.json')).json();
    await salvaMolti('carichi_pellet', pellet.carichi.map(c => ({
        data: c.data, fornitore: c.fornitore, quintali: c.quintali, prezzo_quintale: c.prezzoQuintale,
        iva_percentuale: c.ivaPercentuale, precarico: c.precarico ?? null, note: ''
    })));

    await caricaTutto();
    avanzamento('Fatto');
}
