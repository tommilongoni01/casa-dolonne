// Logica dell'app (calcoli su scorte, allarmi, stato della casa), indipendente dall'interfaccia.
import { db } from './store.js';
import { COLORE_SEZIONE } from './icone.js';
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

/// Simbolo di un'operazione: quello scelto, altrimenti quello del suo tipo.
export const iconaOperazione = o => o?.icona || TIPI_OPERAZIONE[o?.tipo]?.icona || 'lista';

/// Colore di un impianto (quello della sua icona), usato per i simboli di operazioni e prodotti.
export const coloreImpianto = sezioneId => COLORE_SEZIONE[db.sezioni.find(s => s.id === sezioneId)?.icona] ?? 'var(--accento)';

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
// A parità di data (dal più recente): consumo, acquisto, rettifica. In ordine cronologico quindi
// prima la rettifica (lettura della giacenza), poi l'acquisto, poi il consumo.
const ORDINE_MOVIMENTI = { consumo: 0, acquisto: 1, rettifica: 2 };
/// Unità con cui si mostra la scorta: il pellet si acquista in quintali ma il deposito si legge in kg.
export function unitaScorta(p) {
    return p?.categoria === 'pellet' && p.unita === 'q' ? { unita: 'kg', fattore: 100 } : { unita: p?.unita ?? '', fattore: 1 };
}
/// Quantità di scorta (nell'unità del prodotto) scritta nell'unità di lettura: 21,2 q → "2.120 kg".
export const quantitaScorta = (p, valore) => quantita(Number(valore) * unitaScorta(p).fattore, unitaScorta(p).unita);

/// Letture del deposito pellet (kg sul pannello della caldaia), dalla più recente.
export const lettureDeposito = prodotto => db.letture_deposito.filter(l => l.prodotto_id === prodotto.id)
    .sort((a, b) => b.momento.localeCompare(a.momento));

/// Piani dell'impianto di riscaldamento e stati possibili, per le letture del deposito.
export const PIANI = ['Spa', 'P-1', 'P0', 'P1'];
export const STATI_PIANO = [['off', 'Off'], ['standby', 'Stand-by'], ['on', 'On']];

const isoLocale = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function movimentiDi(prodotto) {
    return db.movimenti.filter(m => m.prodotto_id === prodotto.id)
        .sort((a, b) => (b.data || '').localeCompare(a.data || '') || ORDINE_MOVIMENTI[a.tipo] - ORDINE_MOVIMENTI[b.tipo]);
}

/// Giacenza letta prima di un acquisto (es. pellet nel silo prima del carico), se indicata.
export const giacenzaPrima = m => {
    const v = m.dettagli?.precarico;
    return v === null || v === undefined || v === '' ? null : Number(v);
};

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
        if (m.tipo === 'acquisto') {
            // La giacenza letta prima dell'acquisto vale come una rettifica: il calo è stato consumato.
            const prima = giacenzaPrima(m);
            if (prima !== null) {
                if (giacenza - prima > 0) { consumato += giacenza - prima; ultimaDataConsumo = m.data; }
                giacenza = prima;
                andamento.push({ data: m.data, valore: giacenza, lettura: true });
            }
            giacenza += q; acquistato += q; costo += Number(m.costo) || 0;
        }
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
        andamento.push({ data: m.data, valore: giacenza, lettura: m.tipo === 'rettifica' });
    }
    // Se i consumi non si registrano (es. pellet) la giacenza è affidabile solo dalla prima lettura in poi.
    const primaLettura = andamento.findIndex(p => p.lettura);
    const senzaConsumi = !ordinati.some(m => m.tipo === 'consumo');
    if (senzaConsumi && primaLettura > 0) andamento.splice(0, primaLettura);
    // Pellet: la giacenza vera è l'ultima lettura del deposito (kg sul pannello) più i carichi dei giorni successivi.
    const lettura = prodotto.categoria === 'pellet' ? lettureDeposito(prodotto)[0] : null;
    if (lettura) {
        const giornoLettura = isoLocale(new Date(lettura.momento));
        const dopo = ordinati.filter(m => m.tipo === 'acquisto' && m.data > giornoLettura).reduce((t, m) => t + (Number(m.quantita) || 0), 0);
        giacenza = Number(lettura.kg) / 100 + dopo;
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

/// Unità di misura dei prodotti (valore salvato → nome nel menu).
export const UNITA_MISURA = [
    ['kg', 'Chilogrammi (kg)'], ['g', 'Grammi (g)'], ['q', 'Quintali (q)'], ['t', 'Tonnellate (t)'],
    ['l', 'Litri (l)'], ['ml', 'Millilitri (ml)'], ['m³', 'Metri cubi (m³)'], ['pz', 'Pezzi (pz)'], ['sacchi', 'Sacchi']
];

/// "Chilogrammi (kg)" → per il menu delle unità.
export const nomeUnita = u => UNITA_MISURA.find(([v]) => v === u)?.[1] ?? u;

/// Fornitori di un prodotto: [{ nome, link }] (anche dai vecchi campi fornitore/fornitore_link).
export function fornitoriDi(p) {
    const elenco = (p?.fornitori ?? []).filter(x => x?.nome?.trim());
    if (!elenco.length && p?.fornitore?.trim()) return [{ nome: p.fornitore.trim(), link: p.fornitore_link ?? '' }];
    return elenco;
}

/// Calcolo di un acquisto come nel foglio "costo prodotto": importo, sconto %, trasporto, IVA %.
export function calcoliAcquisto({ quantita, prezzo, sconto, trasporto, iva }) {
    const importo = (Number(quantita) || 0) * (Number(prezzo) || 0);
    const scontato = importo * (1 - (Number(sconto) || 0) / 100);
    const imponibile = scontato + (Number(trasporto) || 0);
    const imposta = imponibile * (Number(iva) || 0) / 100;
    return { importo, scontato, imponibile, imposta, totale: imponibile + imposta };
}

/// Prezzo del prodotto per unità di magazzino, con IVA e sconto ma senza trasporto (per il grafico dei prezzi).
export function prezzoProdotto(m) {
    const d = m.dettagli ?? {}, q = Number(m.quantita) || 0;
    if (!q) return null;
    if (d.prezzo_unitario == null) return (Number(m.costo) || 0) / q;
    const formato = Number(d.formato) || 1;
    return d.prezzo_unitario / formato * (1 - (Number(d.sconto) || 0) / 100) * (1 + (Number(d.iva_percentuale) || 0) / 100);
}

export const STATI_PRODOTTO = ['Liquido', 'Polvere', 'Granulare', 'Pastiglie', 'Solido', 'Gas'];

/// Prodotti del magazzino collegati a un'operazione (es. Ossigeno → UNIOXY POOL; pH → pH-, pH+).
export function prodottiOperazione(operazione) {
    if (!operazione) return [];
    const collegati = db.prodotti.filter(p => p.operazione_id === operazione.id);
    // Dati precedenti al magazzino: l'operazione puntava a un solo prodotto.
    const vecchio = !collegati.length && db.prodotti.find(p => p.id === operazione.prodotto_id);
    return (vecchio ? [vecchio] : collegati).sort((a, b) => a.ordine - b.ordine || a.nome.localeCompare(b.nome));
}

/// Operazione a cui è collegato un prodotto.
export const operazioneDiProdotto = p => !p?.id ? null
    : db.operazioni.find(o => p.operazione_id && o.id === p.operazione_id)
      ?? db.operazioni.find(o => o.prodotto_id === p.id) ?? null;

/// Categoria del prodotto ricavata dall'operazione (serve per i nomi dei movimenti e le previsioni).
export const categoriaPerOperazione = o => ({ ossigeno: 'ossigeno', ph: 'ph', pellet: 'pellet' })[o?.tipo] ?? 'altro';

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
    const ids = prodottiOperazione(operazione).map(p => p.id);
    if (!ids.length) return null;
    return db.movimenti.filter(m => ids.includes(m.prodotto_id) && m.tipo === 'consumo')
        .map(m => m.data).sort().at(-1) ?? null;
}

// ---------------------------------------------------------------------
// Contratti
// ---------------------------------------------------------------------
/// Avviso di scadenza attivo (preavviso_giorni = -1 vuol dire "nessun avviso").
export const conAvviso = c => Number(c.preavviso_giorni ?? 30) >= 0;

/// Nome del fornitore del contratto (campo libero, oppure il contatto collegato nei contratti vecchi).
export function fornitoreContratto(c) {
    if (c.fornitore?.trim()) return c.fornitore.trim();
    const k = db.contatti.find(x => x.id === c.fornitore_id);
    return k ? nomeContatto(k) : '';
}

/// Durata in mesi: dai campi durata, altrimenti da inizio e fine.
export function mesiContratto(c) {
    if (Number(c.durata_valore) > 0) return Number(c.durata_valore) * (c.durata_unita === 'mesi' ? 1 : 12);
    if (c.inizio && c.scadenza) return Math.max(1, Math.round(giorniTra(c.inizio, c.scadenza) / 30.44));
    return 12;
}

/// Costo complessivo del contratto con IVA (i vecchi contratti avevano solo il costo annuo).
export function costoContratto(c) {
    if (c.costo != null) return Number(c.costo) * (1 + (Number(c.iva_percentuale) || 0) / 100);
    return (Number(c.costo_annuo) || 0) * mesiContratto(c) / 12;
}

export const costoAnnuoContratto = c => costoContratto(c) / mesiContratto(c) * 12;

/// Fine del contratto: quella indicata, altrimenti inizio + durata.
export function fineContratto(c) {
    if (c.scadenza) return giorno(c.scadenza);
    return c.inizio ? aggiungiMesi(c.inizio, mesiContratto(c)) : null;
}

/// Quota del costo del contratto che cade in un anno (i contratti pluriennali si spalmano mese per mese).
export function costoContrattoNellAnno(c, anno) {
    if (!c.inizio) return 0;
    const inizio = giorno(c.inizio), mesi = mesiContratto(c), mensile = costoContratto(c) / mesi;
    let quota = 0;
    for (let i = 0; i < mesi; i++) {
        const m = new Date(inizio.getFullYear(), inizio.getMonth() + i, 1);
        if (m.getFullYear() === anno) quota += mensile;
    }
    return quota;
}

// ---------------------------------------------------------------------
// Costi
// ---------------------------------------------------------------------
/// Voci di costo di un anno: contratti (quota dell'anno), interventi e acquisti di prodotti, con il loro impianto.
export function vociCosto(anno) {
    const voci = [];
    for (const c of db.contratti) {
        const importo = costoContrattoNellAnno(c, anno);
        if (importo > 0) voci.push({ id: 'c' + c.id, tipo: 'contratti', sezione_id: c.sezione_id ?? null, titolo: c.titolo,
            dettaglio: [fornitoreContratto(c), mesiContratto(c) > 12 ? 'quota annuale' : ''].filter(Boolean).join(' · '),
            data: c.inizio, importo, pagina: { nome: 'contratto', id: c.id } });
    }
    for (const i of db.interventi) {
        if (!i.data || Number(i.data.slice(0, 4)) !== anno || !(Number(i.costo) > 0)) continue;
        const o = db.operazioni.find(o => o.id === i.operazione_id);
        const t = db.tipologie.find(t => t.id === i.tipologia_id);
        voci.push({ id: 'i' + i.id, tipo: 'interventi', sezione_id: o?.sezione_id ?? null, titolo: t?.nome ?? 'Manutenzione',
            dettaglio: [i.esecutore, i.note].filter(Boolean).join(' · '), data: i.data, importo: Number(i.costo),
            pagina: o ? { nome: 'operazione', id: o.id } : null });
    }
    for (const m of db.movimenti) {
        if (m.tipo !== 'acquisto' || !m.data || Number(m.data.slice(0, 4)) !== anno || !(Number(m.costo) > 0)) continue;
        const p = db.prodotti.find(p => p.id === m.prodotto_id);
        const o = p ? operazioneDiProdotto(p) : null;
        voci.push({ id: 'm' + m.id, tipo: 'prodotti', sezione_id: o?.sezione_id ?? null, titolo: p?.nome ?? 'Prodotto',
            dettaglio: [quantita(m.quantita, p?.unita ?? ''), m.fornitore].filter(Boolean).join(' · '), data: m.data,
            importo: Number(m.costo), pagina: o ? { nome: 'operazione', id: o.id } : null });
    }
    return voci.sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''));
}

/// Anni con almeno un costo, dal più recente (sempre compreso l'anno in corso).
export function anniCosti() {
    const anni = new Set([new Date().getFullYear()]);
    for (const m of db.movimenti) if (m.tipo === 'acquisto' && m.data && Number(m.costo) > 0) anni.add(Number(m.data.slice(0, 4)));
    for (const i of db.interventi) if (i.data && Number(i.costo) > 0) anni.add(Number(i.data.slice(0, 4)));
    for (const c of db.contratti) {
        if (!c.inizio) continue;
        const inizio = giorno(c.inizio), mesi = mesiContratto(c);
        for (let k = 0; k < mesi; k += 12) anni.add(new Date(inizio.getFullYear(), inizio.getMonth() + k, 1).getFullYear());
        anni.add(new Date(inizio.getFullYear(), inizio.getMonth() + mesi - 1, 1).getFullYear());
    }
    return [...anni].sort((a, b) => b - a);
}

export const totale = voci => voci.reduce((t, v) => t + v.importo, 0);

/// Data dell'ultima volta che l'operazione è stata fatta (per l'avviso periodico).
export function ultimaEsecuzione(operazione) {
    if (operazione.tipo === 'cenere') return svuotamentiOrdinati()[0]?.data ?? null;
    if (operazione.tipo === 'cambioAcqua') {
        return db.processi_acqua.map(p => (p.fine ?? p.inizio)?.slice(0, 10)).filter(Boolean).sort().at(-1) ?? null;
    }
    return ultimoRiempimento(operazione);
}

/// "svuotamento", "cambio acqua", "riempimento", "consumo"…
export function nomeEsecuzione(operazione) {
    if (operazione.tipo === 'cenere') return 'svuotamento';
    if (operazione.tipo === 'cambioAcqua') return 'cambio acqua';
    return nomeMovimento('consumo', prodottiOperazione(operazione)[0]?.categoria).toLowerCase();
}

/// Allarmi di un'operazione: riempimento dopo N giorni e scadenze delle tipologie di manutenzione.
export function allarmi(operazione) {
    const elenco = [];
    const ultimo = ultimaEsecuzione(operazione);
    if (operazione.giorni_allarme > 0 && ultimo) {
        const data = aggiungiGiorni(ultimo, operazione.giorni_allarme);
        const nome = nomeEsecuzione(operazione);
        elenco.push({
            id: 'periodico', data, preavviso: 2,
            titolo: operazione.tipo === 'ossigeno' ? `Riempimento ${operazione.titolo.toLowerCase()}` : operazione.titolo,
            dettaglio: `Ultimo ${nome} ${giorniTrascorsi(ultimo)} giorni fa`
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
                icona: iconaOperazione(o), titolo: a.titolo, dettaglio: a.dettaglio,
                data: a.data, sezione_id: o.sezione_id, pagina: { nome: 'operazione', id: o.id }
            });
        }
    }
    for (const c of contratti) {
        if (!c.scadenza || !conAvviso(c)) continue;
        const s = statoScadenza(c.scadenza, c.preavviso_giorni);
        if (s === 'ok') continue;
        elenco.push({
            id: `contratto-${c.id}`, gravita: s === 'scaduta' ? 'scaduto' : 'inScadenza', icona: 'documento',
            titolo: c.titolo, dettaglio: 'Scadenza contratto', data: giorno(c.scadenza), sezione_id: c.sezione_id,
            pagina: { nome: 'contratto', id: c.id }
        });
    }
    const prodotti = sezione ? db.prodotti.filter(p => operazioni.includes(operazioneDiProdotto(p))) : db.prodotti;
    for (const p of prodotti.filter(sottoScorta)) {
        elenco.push({
            id: `scorta-${p.id}`, gravita: 'inScadenza', icona: 'scatola',
            titolo: `Scorta bassa: ${p.nome}`, dettaglio: `Restano ${quantitaScorta(p, analisiScorta(p).giacenza)}`,
            data: null,
            // Le scorte si gestiscono nell'operazione: l'avviso apre quella (o il prodotto, se non è collegato).
            pagina: operazioneDiProdotto(p) ? { nome: 'operazione', id: operazioneDiProdotto(p).id } : { nome: 'prodotto', id: p.id },
            sezione_id: operazioneDiProdotto(p)?.sezione_id ?? null
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
                id: `op-${o.id}-${a.id}`, gravita: 'info', icona: iconaOperazione(o),
                titolo: a.titolo, dettaglio: a.dettaglio, data: a.data, pagina: { nome: 'operazione', id: o.id }
            });
        }
    }
    for (const c of db.contratti) {
        if (!c.scadenza || !conAvviso(c)) continue;
        const d = giorno(c.scadenza);
        if (statoScadenza(d, c.preavviso_giorni) !== 'ok' || d > limite) continue;
        elenco.push({ id: `contratto-${c.id}`, gravita: 'info', icona: 'documento', titolo: c.titolo,
                      dettaglio: 'Scadenza contratto', data: d, pagina: { nome: 'contratto', id: c.id } });
    }
    return elenco.sort((a, b) => a.data - b.data);
}

/// Tutte le scadenze con una data (passate in ritardo, imminenti e future), per il calendario della casa.
export function calendarioScadenze() {
    const elenco = [];
    const gravita = stato => stato === 'scaduta' ? 'scaduto' : stato === 'inScadenza' ? 'inScadenza' : 'info';
    for (const o of db.operazioni) {
        for (const a of allarmi(o)) {
            if (!a.data) continue;
            elenco.push({
                id: `op-${o.id}-${a.id}`, gravita: gravita(a.stato), icona: iconaOperazione(o),
                titolo: a.titolo, dettaglio: a.dettaglio, data: giorno(a.data), sezione_id: o.sezione_id,
                pagina: { nome: 'operazione', id: o.id }
            });
        }
    }
    for (const c of db.contratti) {
        if (!c.scadenza || !conAvviso(c)) continue;
        const d = giorno(c.scadenza);
        elenco.push({ id: `contratto-${c.id}`, gravita: gravita(statoScadenza(d, c.preavviso_giorni)), icona: 'documento',
                      titolo: c.titolo, dettaglio: 'Scadenza contratto', data: d, sezione_id: c.sezione_id,
                      pagina: { nome: 'contratto', id: c.id } });
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
/// Prezzo unitario (IVA esclusa), IVA e totale di un acquisto; per il pellet anche il deposito prima e dopo il carico.
export function calcoliCarico(m) {
    const q = Number(m.quantita) || 0;
    const aliquota = Number(m.dettagli?.iva_percentuale) || 0;
    const prezzo = m.dettagli?.prezzo_unitario ?? (q ? (Number(m.costo) || 0) / q / (1 + aliquota / 100) : 0);
    const c = calcoliAcquisto({ quantita: q / (Number(m.dettagli?.formato) || 1), prezzo, sconto: m.dettagli?.sconto, trasporto: m.dettagli?.trasporto, iva: aliquota });
    const imponibile = c.imponibile, iva = c.imposta;
    const prima = giacenzaPrima(m);
    return { prezzo: Number(prezzo) || 0, aliquota, imponibile, iva, totale: imponibile + iva, precarico: prima, postcarico: prima === null ? null : prima + q };
}

/// Carichi di pellet: gli acquisti dei prodotti della categoria pellet, dal più recente.
export const carichiOrdinati = () => {
    const ids = db.prodotti.filter(p => p.categoria === 'pellet').map(p => p.id);
    return db.movimenti.filter(m => m.tipo === 'acquisto' && ids.includes(m.prodotto_id)).sort((a, b) => b.data.localeCompare(a.data));
};
export const svuotamentiOrdinati = () => db.svuotamenti_cenere.slice().sort((a, b) => b.data.localeCompare(a.data));

/// Pellet bruciato tra due svuotamenti (kg), considerando i carichi nel frattempo (1 q = 100 kg).
export function consumoCenere(precedente, attuale) {
    if (!precedente || precedente.scorta_kg == null || attuale.scorta_kg == null) return null;
    const caricati = carichiOrdinati()
        .filter(c => c.data > precedente.data && c.data <= attuale.data)
        .reduce((s, c) => s + (Number(c.quantita) || 0) * 100, 0);
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
