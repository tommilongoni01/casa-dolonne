// Logica dell'app (calcoli su scorte, allarmi, stato della casa), indipendente dall'interfaccia.
import { db } from './store.js';
import { giorno, aggiungiGiorni, aggiungiMesi, giorniTra, giorniTrascorsi, dataBreve, quantita } from './format.js';

// ---------------------------------------------------------------------
// Tipi e categorie
// ---------------------------------------------------------------------
export const TIPI_OPERAZIONE = {
    ph: { nome: 'pH', icona: 'provetta' },
    ossigeno: { nome: 'Ossigeno', icona: 'bolle' },
    cambioAcqua: { nome: 'Cambio acqua', icona: 'ciclo' },
    pellet: { nome: 'Pellet', icona: 'fiamma' },
    cenere: { nome: 'Svuotamento cenere', icona: 'cestino' },
    storico: { nome: 'Storico manutenzioni', icona: 'chiave' },
    generica: { nome: 'Operazione', icona: 'lista' }
};

export const CATEGORIE = {
    ossigeno: 'Ossigeno', ph: 'Correttore pH', flocculante: 'Flocculante', pellet: 'Pellet', altro: 'Altro'
};

export const nomeMovimento = (tipo, categoria) => ({
    acquisto: 'Acquisto',
    consumo: ['ossigeno', 'ph', 'flocculante'].includes(categoria) ? 'Riempimento' : 'Consumo',
    rettifica: 'Rettifica giacenza'
})[tipo];

// ---------------------------------------------------------------------
// Scadenze
// ---------------------------------------------------------------------
/// 'scaduta' | 'inScadenza' | 'ok'
export function statoScadenza(scadenza, preavvisoGiorni) {
    const mancano = giorniTra(new Date(), scadenza);
    if (mancano < 0) return 'scaduta';
    return mancano <= Math.max(0, preavvisoGiorni) ? 'inScadenza' : 'ok';
}

const ORDINE_STATI = { scaduta: 0, inScadenza: 1, ok: 2 };

// ---------------------------------------------------------------------
// Scorte
// ---------------------------------------------------------------------
export function movimentiDi(prodotto) {
    return db.movimenti.filter(m => m.prodotto_id === prodotto.id)
        .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
}

// Confezioni (es. taniche da 5 l e da 1 l): il prodotto ne elenca i formati,
// ogni movimento indica quante confezioni di ciascun formato.
/// Formati del prodotto, dal più grande.
export const formatiDi = prodotto => (prodotto?.confezioni ?? []).map(Number).filter(v => v > 0).sort((a, b) => b - a);

export const nomeConfezione = (prodotto, numero) => prodotto?.unita === 'l'
    ? (numero === 1 ? 'tanica' : 'taniche')
    : (numero === 1 ? 'confezione' : 'confezioni');

/// "2 taniche da 5 l · 1 tanica da 1 l"
export function descriviConfezioni(prodotto, confezioni) {
    return (confezioni ?? []).filter(c => c.numero > 0)
        .map(c => `${c.numero} ${nomeConfezione(prodotto, c.numero)} da ${quantita(c.litri, prodotto.unita)}`).join(' · ');
}

/// Giacenza, consumi e costi calcolati dai movimenti (nessuna stima: giacenza reale).
export function analisiScorta(prodotto) {
    const ordinati = movimentiDi(prodotto).slice().reverse();
    let giacenza = 0, acquistato = 0, consumato = 0, costo = 0;
    let primaData = ordinati[0]?.data ?? null, ultimaDataConsumo = null;
    const andamento = [];
    // Confezioni presenti per formato: { 5: 3, 1: 2 }.
    const confezioni = {};
    for (const m of ordinati) {
        const q = Number(m.quantita) || 0;
        const righe = (m.confezioni ?? []).filter(c => Number(c.litri) > 0);
        if (m.tipo === 'acquisto') { giacenza += q; acquistato += q; costo += Number(m.costo) || 0; }
        else if (m.tipo === 'consumo') { giacenza -= q; consumato += q; ultimaDataConsumo = m.data; }
        else if (m.tipo === 'rettifica') {
            const differenza = giacenza - q;
            if (differenza > 0) { consumato += differenza; ultimaDataConsumo = m.data; }
            giacenza = q;
            // Una rettifica con le confezioni fissa il conteggio di tutti i formati.
            if (righe.length) for (const k of Object.keys(confezioni)) confezioni[k] = 0;
        }
        for (const c of righe) {
            const n = Number(c.numero) || 0;
            const segno = m.tipo === 'consumo' ? -1 : 1;
            confezioni[c.litri] = (m.tipo === 'rettifica' ? 0 : (confezioni[c.litri] ?? 0)) + segno * n;
        }
        andamento.push({ data: m.data, valore: giacenza });
    }
    let consumoGiornaliero = null;
    const fisso = Number(prodotto.consumo_mensile) || 0;
    if (fisso > 0) consumoGiornaliero = fisso / 30.4;
    else if (primaData && ultimaDataConsumo && consumato > 0) {
        const giorni = giorniTra(primaData, ultimaDataConsumo);
        if (giorni >= 1) consumoGiornaliero = consumato / giorni;
    }
    const attuale = Math.max(0, giacenza);
    const autonomia = consumoGiornaliero > 0 ? Math.floor(attuale / consumoGiornaliero) : null;
    return {
        giacenza: attuale,
        ultimoMovimento: ordinati.at(-1)?.data ?? null,
        acquistato, consumato, costo,
        costoMedio: acquistato > 0 ? costo / acquistato : null,
        consumoMensile: consumoGiornaliero ? consumoGiornaliero * 30.4 : null,
        consumoImpostato: fisso > 0,
        autonomia,
        confezioni: formatiDi(prodotto).map(litri => ({ litri, numero: Math.max(0, confezioni[litri] ?? 0) })),
        esaurimento: autonomia !== null ? aggiungiGiorni(new Date(), autonomia) : null,
        andamento
    };
}

/// Prodotti a scorta gestiti da un'operazione: tutti i prodotti pH per l'operazione pH, altrimenti quello collegato.
export function prodottiOperazione(operazione) {
    if (!operazione) return [];
    if (operazione.tipo === 'ph') {
        return db.prodotti.filter(p => p.categoria === 'ph').sort((a, b) => a.ordine - b.ordine || a.nome.localeCompare(b.nome));
    }
    const p = db.prodotti.find(p => p.id === operazione.prodotto_id);
    return p ? [p] : [];
}

export const sottoScorta = p => (Number(p.scorta_minima) || 0) > 0 && analisiScorta(p).giacenza <= Number(p.scorta_minima);
export const mostraPrevisioni = p => p.categoria !== 'ph';

// ---------------------------------------------------------------------
// Operazioni e allarmi
// ---------------------------------------------------------------------
export const sezioneDi = id => db.sezioni.find(s => s.id === id);
export const prodottoDi = id => db.prodotti.find(p => p.id === id);

export function operazioniDi(sezione) {
    return db.operazioni.filter(o => o.sezione_id === sezione.id).sort((a, b) => a.ordine - b.ordine);
}

export function tipologieDi(operazione) {
    return db.tipologie.filter(t => t.operazione_id === operazione.id).sort((a, b) => a.ordine - b.ordine);
}

export function interventiDi(operazione) {
    return db.interventi.filter(i => i.operazione_id === operazione.id)
        .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
}

export function ultimoInterventoDi(tipologia) {
    return db.interventi.filter(i => i.tipologia_id === tipologia.id)
        .sort((a, b) => (b.data || '').localeCompare(a.data || ''))[0] ?? null;
}

export function prossimaScadenza(tipologia) {
    const ultimo = ultimoInterventoDi(tipologia);
    if (!tipologia.mesi_avviso || !ultimo) return null;
    return aggiungiMesi(ultimo.data, tipologia.mesi_avviso);
}

export function ultimoRiempimento(operazione) {
    if (!operazione.prodotto_id) return null;
    return db.movimenti.filter(m => m.prodotto_id === operazione.prodotto_id && m.tipo === 'consumo')
        .map(m => m.data).sort().at(-1) ?? null;
}

/// Allarmi di un'operazione: riempimento dopo N giorni e scadenze delle tipologie di manutenzione.
export function allarmi(operazione) {
    const elenco = [];
    const ultimo = ultimoRiempimento(operazione);
    if (operazione.giorni_allarme > 0 && ultimo) {
        const data = aggiungiGiorni(ultimo, operazione.giorni_allarme);
        elenco.push({
            id: 'riempimento', data, preavviso: 2,
            titolo: `Riempimento ${operazione.titolo.toLowerCase()}`,
            dettaglio: `Ultimo riempimento ${giorniTrascorsi(ultimo)} giorni fa`
        });
    }
    const tipologie = tipologieDi(operazione);
    const sistema = sezioneDi(operazione.sezione_id)?.nome ?? operazione.titolo;
    for (const t of tipologie) {
        const data = prossimaScadenza(t);
        if (!data) continue;
        elenco.push({
            id: t.id, data, preavviso: 14,
            titolo: tipologie.length > 1 ? `${t.nome} · ${sistema}` : `Manutenzione ${sistema}`,
            dettaglio: `Ultima il ${dataBreve(ultimoInterventoDi(t).data)}`
        });
    }
    for (const a of elenco) a.stato = statoScadenza(a.data, a.preavviso);
    return elenco.sort((a, b) => a.data - b.data);
}

export function statoOperazione(operazione) {
    const stati = allarmi(operazione).map(a => a.stato);
    if (prodottiOperazione(operazione).some(sottoScorta)) stati.push('scaduta');
    return stati.sort((a, b) => ORDINE_STATI[a] - ORDINE_STATI[b])[0] ?? null;
}

// ---------------------------------------------------------------------
// Stato della casa
// ---------------------------------------------------------------------
/// gravita: 'scaduto' | 'inScadenza' | 'inCorso' | 'info'
export function avvisi({ sezione = null } = {}) {
    const elenco = [];
    const operazioni = sezione ? operazioniDi(sezione) : db.operazioni;
    const contratti = db.contratti.filter(c => !sezione || c.sezione_id === sezione.id);

    const conCambioAcqua = !sezione || operazioni.some(o => o.tipo === 'cambioAcqua');
    if (conCambioAcqua) {
        for (const p of db.processi_acqua.filter(p => !p.fine)) {
            elenco.push({
                id: `processo-${p.id}`, gravita: 'inCorso', icona: p.tipo === 'svuotamento' ? 'giu' : 'su',
                titolo: `${p.tipo === 'svuotamento' ? 'Svuotamento' : 'Riempimento'} piscina in corso`,
                dettaglio: 'Tocca per registrare il livello', data: new Date(p.inizio),
                pagina: { nome: 'processo', id: p.id }
            });
        }
    }
    for (const o of operazioni) {
        for (const a of allarmi(o)) {
            if (a.stato === 'ok') continue;
            elenco.push({
                id: `op-${o.id}-${a.id}`, gravita: a.stato === 'scaduta' ? 'scaduto' : 'inScadenza',
                icona: TIPI_OPERAZIONE[o.tipo]?.icona ?? 'lista', titolo: a.titolo, dettaglio: a.dettaglio,
                data: a.data, sezione_id: o.sezione_id, pagina: { nome: 'operazione', id: o.id }
            });
        }
    }
    for (const c of contratti) {
        if (!c.scadenza) continue;
        const s = statoScadenza(c.scadenza, c.preavviso_giorni);
        if (s === 'ok') continue;
        elenco.push({
            id: `contratto-${c.id}`, gravita: s === 'scaduta' ? 'scaduto' : 'inScadenza', icona: 'documento',
            titolo: c.titolo, dettaglio: 'Scadenza contratto', data: giorno(c.scadenza), sezione_id: c.sezione_id,
            pagina: { nome: 'contratto', id: c.id }
        });
    }
    const prodotti = sezione
        ? db.prodotti.filter(p => operazioni.some(o => o.prodotto_id === p.id || (o.tipo === 'ph' && p.categoria === 'ph')))
        : db.prodotti;
    for (const p of prodotti.filter(sottoScorta)) {
        elenco.push({
            id: `scorta-${p.id}`, gravita: 'inScadenza', icona: 'scatola',
            titolo: `Scorta bassa: ${p.nome}`, dettaglio: `Restano ${quantita(analisiScorta(p).giacenza, p.unita)}`,
            data: null, pagina: { nome: 'prodotto', id: p.id },
            sezione_id: db.operazioni.find(o => o.prodotto_id === p.id)?.sezione_id
                ?? (p.categoria === 'ph' ? db.operazioni.find(o => o.tipo === 'ph')?.sezione_id : null)
        });
    }
    const peso = { scaduto: 0, inScadenza: 1, inCorso: 2, info: 3 };
    return elenco.sort((a, b) => (peso[a.gravita] - peso[b.gravita]) || ((a.data ?? Infinity) - (b.data ?? Infinity)));
}

/// Scadenze dei prossimi 30 giorni non ancora in allarme.
export function prossime(giorniAvanti = 30) {
    const limite = aggiungiGiorni(new Date(), giorniAvanti);
    const elenco = [];
    for (const o of db.operazioni) {
        for (const a of allarmi(o)) {
            if (a.stato !== 'ok' || a.data > limite) continue;
            elenco.push({
                id: `op-${o.id}-${a.id}`, gravita: 'info', icona: TIPI_OPERAZIONE[o.tipo]?.icona ?? 'lista',
                titolo: a.titolo, dettaglio: a.dettaglio, data: a.data, pagina: { nome: 'operazione', id: o.id }
            });
        }
    }
    for (const c of db.contratti) {
        if (!c.scadenza) continue;
        const d = giorno(c.scadenza);
        if (statoScadenza(d, c.preavviso_giorni) !== 'ok' || d > limite) continue;
        elenco.push({ id: `contratto-${c.id}`, gravita: 'info', icona: 'documento', titolo: c.titolo,
                      dettaglio: 'Scadenza contratto', data: d, pagina: { nome: 'contratto', id: c.id } });
    }
    return elenco.sort((a, b) => a.data - b.data);
}

// ---------------------------------------------------------------------
// Cambio acqua
// ---------------------------------------------------------------------
export function puntiProcesso(p) {
    const punti = [{ ora: new Date(p.inizio), livello: Number(p.livello_iniziale) || 0 }];
    for (const l of [...(p.letture ?? [])].sort((a, b) => a.ora.localeCompare(b.ora))) {
        punti.push({ ora: new Date(l.ora), livello: Number(l.livello) });
    }
    if (p.fine && p.livello_finale !== null && p.livello_finale !== undefined) {
        punti.push({ ora: new Date(p.fine), livello: Number(p.livello_finale) });
    }
    return punti;
}

export function analisiProcesso(p) {
    const punti = puntiProcesso(p);
    const ultimo = punti.at(-1);
    const fine = p.fine ? new Date(p.fine) : ultimo.ora;
    const durata = fine - new Date(p.inizio);
    const ore = durata / 3_600_000;
    const velocita = ore > 0.01 ? (ultimo.livello - punti[0].livello) / ore : null;
    let arrivo = null;
    const obiettivo = p.livello_obiettivo;
    if (!p.fine && obiettivo !== null && obiettivo !== undefined && velocita) {
        const mancanti = (Number(obiettivo) - ultimo.livello) / velocita;
        if (mancanti >= 0) arrivo = new Date(ultimo.ora.getTime() + mancanti * 3_600_000);
    }
    return {
        punti, livello: ultimo.livello,
        variazione: Math.abs(ultimo.livello - punti[0].livello),
        durata, velocita, arrivo
    };
}

// ---------------------------------------------------------------------
// Pellet e cenere
// ---------------------------------------------------------------------
export function calcoliCarico(c) {
    const imponibile = (Number(c.quintali) || 0) * (Number(c.prezzo_quintale) || 0);
    const iva = imponibile * (Number(c.iva_percentuale) || 0) / 100;
    const pre = c.precarico === null || c.precarico === undefined || c.precarico === '' ? null : Number(c.precarico);
    return { imponibile, iva, totale: imponibile + iva, postcarico: pre === null ? null : pre + (Number(c.quintali) || 0) };
}

export const carichiOrdinati = () => db.carichi_pellet.slice().sort((a, b) => b.data.localeCompare(a.data));
export const svuotamentiOrdinati = () => db.svuotamenti_cenere.slice().sort((a, b) => b.data.localeCompare(a.data));

/// Pellet bruciato tra due svuotamenti (kg), considerando i carichi nel frattempo (1 q = 100 kg).
export function consumoCenere(precedente, attuale) {
    if (!precedente || precedente.scorta_kg == null || attuale.scorta_kg == null) return null;
    const caricati = db.carichi_pellet
        .filter(c => c.data > precedente.data && c.data <= attuale.data)
        .reduce((s, c) => s + (Number(c.quintali) || 0) * 100, 0);
    const valore = Number(precedente.scorta_kg) + caricati - Number(attuale.scorta_kg);
    return valore >= 0 ? valore : null;
}

// ---------------------------------------------------------------------
// Contatti
// ---------------------------------------------------------------------
export function nomeContatto(c) {
    const persona = [c.nome, c.cognome].filter(Boolean).join(' ');
    return persona || c.azienda || 'Senza nome';
}

export function sottotitoloContatto(c) {
    const persona = [c.nome, c.cognome].filter(Boolean).join(' ');
    return (persona ? [c.azienda, c.ruolo] : [c.ruolo]).filter(Boolean).join(' · ');
}

export function iniziali(c) {
    return nomeContatto(c).split(/\s+/).slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase();
}
