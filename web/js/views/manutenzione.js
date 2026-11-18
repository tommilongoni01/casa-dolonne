// Manutenzione: stato della casa, sistemi, contratti e prodotti a scorta.
import { computed } from 'vue';
import { db, salva, elimina, caricaFile, urlFile, puoModificare } from '../store.js';
import { nav, pila, apri, apriDaElenco, indietro, stessaPagina } from '../nav.js';
import * as f from '../format.js';
import {
    avvisi, prossime, operazioniDi, statoOperazione, TIPI_OPERAZIONE, analisiScorta, sottoScorta,
    mostraPrevisioni, movimentiDi, nomeMovimento, CATEGORIE, statoScadenza, nomeContatto, sezioneDi,
    ultimoRiempimento, interventiDi, carichiOrdinati, svuotamentiOrdinati, formatiDi, nomeConfezione, descriviConfezioni,
    prodottiOperazione, operazioneDiProdotto, categoriaPerOperazione, STATI_PRODOTTO, UNITA_MISURA, allarmi, coloreImpianto,
    calcoliAcquisto, fornitoriDi, nomeUnita, prezzoProdotto,
    conAvviso, costoContratto, costoAnnuoContratto, fineContratto, mesiContratto, fornitoreContratto
} from '../logic.js';
import { COLORE_SEZIONE } from '../icone.js';
import { backend } from '../backend.js';

const COLORE_GRAVITA = { scaduto: 'var(--rosso)', inScadenza: 'var(--arancione)', inCorso: 'var(--blu)', info: 'var(--secondario)' };
const STATO_GRAVITA = { scaduto: 'scaduta', inScadenza: 'inScadenza', inCorso: 'inScadenza', info: 'ok' };

/// Contenuto della riga di un avviso.
export const RigaAvviso = {
    props: { avviso: Object, selezionata: Boolean },
    template: `
      <Riga :icona="avviso.icona" :colore="colore" :titolo="avviso.titolo" :sottotitolo="avviso.dettaglio"
            :selezionata="selezionata" freccia @click="$emit('apri', avviso.pagina)">
        <template #fine>
          <Cronometro v-if="avviso.gravita === 'inCorso'" :da="avviso.data" class="secondario" style="color:var(--blu)"/>
          <BadgeScadenza v-else-if="avviso.data" :data="avviso.data" :stato="stato"/>
        </template>
      </Riga>`,
    emits: ['apri'],
    computed: {
        colore() { return COLORE_GRAVITA[this.avviso.gravita]; },
        stato() { return STATO_GRAVITA[this.avviso.gravita]; }
    }
};

// ---------------------------------------------------------------------
// Riquadri degli impianti (come l'app Casa di Apple)
// ---------------------------------------------------------------------
/// "oggi", "tra 5 giorni", "tra 4 mesi", "tra 2 anni"
function traQuanto(data) {
    const giorni = f.giorniTra(new Date(), data);
    if (giorni <= 0) return 'oggi';
    if (giorni === 1) return 'domani';
    if (giorni < 45) return `tra ${giorni} giorni`;
    if (giorni < 548) return `tra ${Math.round(giorni / 30.4)} mesi`;
    return `tra ${Math.round(giorni / 365)} anni`;
}

/// Dati principali di un'operazione da mostrare nel riquadro dell'impianto (al massimo uno).
function datoChiave(o) {
    if (o.tipo === 'ph') {
        const ultima = db.misure_ph.slice().sort((a, b) => b.data.localeCompare(a.data))[0];
        return ultima ? `pH ${f.ph(ultima.dosimetro ?? ultima.scuba)}` : null;
    }
    if (o.tipo === 'cenere') {
        const ultimo = svuotamentiOrdinati()[0];
        return ultimo ? `Cenere ${f.giorniTrascorsi(ultimo.data)} gg fa` : null;
    }
    if (o.tipo === 'cambioAcqua') {
        const inCorso = db.processi_acqua.find(p => !p.fine);
        return inCorso ? `${inCorso.tipo === 'svuotamento' ? 'Svuotamento' : 'Riempimento'} in corso` : null;
    }
    const prodotti = prodottiOperazione(o);
    if (prodotti.length === 1) {
        const p = prodotti[0], a = analisiScorta(p);
        return `${o.titolo} ${f.quantita(a.giacenza, p.unita)}`;
    }
    return null;
}

/// Stato (rosso/arancione/verde/grigio), dati principali e prossima scadenza di un impianto.
export function riassuntoImpianto(sezione) {
    const operazioni = operazioniDi(sezione);
    const elenco = avvisi({ sezione });
    const stato = !operazioni.length ? 'vuoto'
        : elenco.some(a => a.gravita === 'scaduto') ? 'scaduto'
        : elenco.some(a => a.gravita === 'inScadenza' || a.gravita === 'inCorso') ? 'inScadenza' : 'ok';
    const etichetta = {
        vuoto: 'Nessuna operazione',
        scaduto: `${elenco.filter(a => a.gravita === 'scaduto').length} da fare`,
        inScadenza: elenco.length === 1 ? '1 avviso' : `${elenco.length} avvisi`,
        ok: 'In regola'
    }[stato];
    const dati = operazioni.map(datoChiave).filter(Boolean).slice(0, 2);
    const future = operazioni.flatMap(o => allarmi(o)).filter(a => a.stato === 'ok' && a.data);
    const prossima = future.sort((a, b) => a.data - b.data)[0];
    return { stato, etichetta, dati, prossima: prossima ? `${prossima.titolo.replace(` · ${sezione.nome}`, '').replace(` ${sezione.nome}`, '')} ${traQuanto(prossima.data)}` : '' };
}

export const TesseraImpianto = {
    props: { sezione: Object, selezionata: Boolean },
    template: `
      <button class="tessera-impianto" :class="['stato-' + r.stato, { selezionata }]">
        <span class="ti-testa">
          <IconaQuadrata :nome="sezione.icona" :dimensione="34"/>
          <span v-if="r.stato === 'scaduto' || r.stato === 'inScadenza'" class="ti-stato"><i></i>{{ r.etichetta }}</span>
        </span>
        <span class="ti-nome">{{ sezione.nome }}</span>
        <span v-for="d in r.dati" :key="d" class="ti-dato">{{ d }}</span>
        <span v-if="r.prossima" class="ti-prossima"><Icona nome="calendario" :dimensione="13"/>{{ r.prossima }}</span>
      </button>`,
    computed: { r() { return riassuntoImpianto(this.sezione); } }
};

// ---------------------------------------------------------------------
// Codici QR da stampare e attaccare sugli impianti
// ---------------------------------------------------------------------
/// Indirizzo che apre direttamente un impianto (anche da fotocamera).
export const indirizzoImpianto = sezione => `${location.origin}${location.pathname}#casa/impianto:${sezione.id}`;

/// SVG del codice QR (libreria qrcode-generator, in vendor/qrcode.js).
function svgQR(testo) {
    const qr = window.qrcode(0, 'M');
    qr.addData(testo);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}

export const CodiciQR = {
    props: { id: String },
    template: `
      <Pagina :titolo="id ? 'Codice QR' : 'Codici QR degli impianti'">
        <template #azioni>
          <button class="pulsante-barra" @click="stampa"><Icona nome="stampa" :dimensione="20"/> Stampa</button>
        </template>
        <Gruppo nota="Stampa e attacca il codice vicino all'impianto (caldaia, locale piscina, quadro elettrico…): inquadrandolo con la fotocamera dell'iPhone si apre direttamente la sua pagina, con operazioni, guide e contatti. La prima volta, nel browser, chiede l'accesso con email e codice.">
        </Gruppo>
        <div ref="area" class="codici-qr">
          <div v-for="s in impianti" :key="s.id" class="cartellino-qr">
            <div class="cartellino-testa"><img src="icone/icona-180.png" alt=""><span>Casa Dolonne</span></div>
            <div class="cartellino-nome"><IconaQuadrata :nome="s.icona" :dimensione="30"/>{{ s.nome }}</div>
            <div class="cartellino-codice" v-html="qr(s)"></div>
            <div class="cartellino-nota">Inquadra con la fotocamera per aprire istruzioni, operazioni e contatti</div>
          </div>
        </div>
      </Pagina>`,
    computed: {
        impianti() {
            const tutte = db.sezioni.slice().sort((a, b) => a.ordine - b.ordine);
            return this.id ? tutte.filter(s => s.id === this.id) : tutte;
        }
    },
    methods: {
        qr: s => svgQR(indirizzoImpianto(s)),
        /// Stampa solo i cartellini: copia temporanea fuori dall'app, nascosta sullo schermo.
        stampa() {
            const copia = document.createElement('div');
            copia.id = 'stampa';
            copia.innerHTML = this.$refs.area.outerHTML;
            document.body.append(copia);
            document.body.classList.add('in-stampa');
            const fine = () => { copia.remove(); document.body.classList.remove('in-stampa'); window.removeEventListener('afterprint', fine); };
            window.addEventListener('afterprint', fine);
            setTimeout(() => window.print(), 100);
        }
    }
};

// ---------------------------------------------------------------------
// Riepilogo delle operazioni (usato nella pagina dell'impianto)
// ---------------------------------------------------------------------
/// Riassunto dei dati live mostrato sotto il nome dell'operazione.
export function riepilogoOperazione(o) {
    const parti = [];
    switch (o.tipo) {
        case 'ph': {
            const ultima = db.misure_ph.slice().sort((a, b) => b.data.localeCompare(a.data))[0];
            if (ultima) parti.push(`pH ${f.ph(ultima.dosimetro ?? ultima.scuba)}`);
            const n = prodottiOperazione(o).length;
            if (n) parti.push(n === 1 ? '1 prodotto' : `${n} prodotti`);
            break;
        }
        case 'ossigeno': {
            const ultimo = ultimoRiempimento(o);
            if (ultimo) parti.push(`Ultimo riempimento ${f.giorniTrascorsi(ultimo)} giorni fa`);
            break;
        }
        case 'cambioAcqua': {
            const inCorso = db.processi_acqua.find(p => !p.fine);
            const ultimo = db.processi_acqua.slice().sort((a, b) => b.inizio.localeCompare(a.inizio))[0];
            if (inCorso) parti.push(`${inCorso.tipo === 'svuotamento' ? 'Svuotamento' : 'Riempimento'} in corso`);
            else if (ultimo) parti.push(`Ultimo il ${f.dataBreve(ultimo.inizio)}`);
            break;
        }
        case 'pellet': {
            const ultimo = carichiOrdinati()[0];
            if (ultimo) parti.push(`Ultimo carico il ${f.dataBreve(ultimo.data)} · ${f.quantita(ultimo.quantita, 'q')}`);
            break;
        }
        case 'cenere': {
            const ultimo = svuotamentiOrdinati()[0];
            if (ultimo) parti.push(`Ultimo svuotamento ${f.giorniTrascorsi(ultimo.data)} giorni fa`);
            break;
        }
        case 'storico': {
            const ultimo = interventiDi(o)[0];
            parti.push(ultimo ? `Ultima il ${f.dataBreve(ultimo.data)}` : 'Nessuna manutenzione registrata');
            break;
        }
        default:
            if (o.passaggi?.length) parti.push(`${o.passaggi.length} passaggi`);
    }
    const prodotti = prodottiOperazione(o);
    if (prodotti.length === 1 && o.tipo !== 'ph') parti.push(`scorta ${f.quantita(analisiScorta(prodotti[0]).giacenza, prodotti[0].unita)}`);
    return parti.join(' · ');
}

export const PaginaMancante = {
    template: `<Pagina titolo=""><Vuoto icona="avviso" titolo="Elemento non trovato" testo="Potrebbe essere stato eliminato."/></Pagina>`
};

// ---------------------------------------------------------------------
// Contratti
// ---------------------------------------------------------------------
export const RigaContratto = {
    props: { contratto: Object },
    template: `
      <Riga icona="documento" :titolo="contratto.titolo" :sottotitolo="dettaglio" freccia>
        <template #fine><BadgeScadenza v-if="fine && conAvviso(contratto)" :data="fine" :stato="stato"/></template>
      </Riga>`,
    computed: {
        fine() { return fineContratto(this.contratto); },
        dettaglio() {
            const c = this.contratto;
            return [fornitoreContratto(c), c.obbligo_legge ? 'obbligo di legge' : '', costoContratto(c) ? f.euro(costoAnnuoContratto(c)) + '/anno' : '']
                .filter(Boolean).join(' · ');
        },
        stato() { return statoScadenza(this.fine, this.contratto.preavviso_giorni); }
    },
    methods: { conAvviso }
};

/// Scheda Contratti: tutti i contratti, divisi per impianto.
export const Contratti = {
    components: { RigaContratto },
    template: `
      <Pagina titolo="Contratti" grande :con-indietro="false">
        <template #azioni>
          <button v-if="puoModificare()" class="pulsante-barra" @click="nuovo = true" aria-label="Nuovo contratto"><Icona nome="piu"/></button>
        </template>
        <Vuoto v-if="!db.contratti.length" icona="documento" titolo="Nessun contratto" testo="Aggiungi i contratti di manutenzione, assistenza e verifica degli impianti."/>
        <template v-else>
          <Gruppo v-for="g in gruppi" :key="g.id" :titolo="g.nome">
            <RigaContratto v-for="c in g.contratti" :key="c.id" :contratto="c" :selezionata="selezionata(c)" @click="apriDaElenco({ nome: 'contratto', id: c.id })"/>
          </Gruppo>
          <Gruppo><Riga titolo="Costo annuo di tutti i contratti" :valore="f.euro(totale)" style="font-weight:600"/></Gruppo>
        </template>
        <ContrattoFoglio v-if="nuovo" @chiudi="nuovo = false"/>
      </Pagina>`,
    data() { return { nuovo: false }; },
    computed: {
        db() { return db; },
        gruppi() {
            const ordinati = db.contratti.slice().sort((a, b) => a.titolo.localeCompare(b.titolo));
            const gruppi = db.sezioni.slice().sort((a, b) => a.ordine - b.ordine)
                .map(s => ({ id: s.id, nome: s.nome, contratti: ordinati.filter(c => c.sezione_id === s.id) }));
            gruppi.push({ id: 'nessuno', nome: 'Senza impianto', contratti: ordinati.filter(c => !sezioneDi(c.sezione_id)) });
            return gruppi.filter(g => g.contratti.length);
        },
        totale() { return db.contratti.reduce((t, c) => t + costoAnnuoContratto(c), 0); }
    },
    methods: {
        apriDaElenco, puoModificare,
        selezionata(c) { return nav.largo && stessaPagina(pila()[0], { nome: 'contratto', id: c.id }); }
    },
    setup() { return { f }; }
};

export const ContrattoPagina = {
    props: { id: String },
    template: `
      <Pagina v-if="contratto" :titolo="contratto.titolo">
        <template #azioni>
          <button v-if="puoModificare()" class="pulsante-barra" @click="modifica = true">Modifica</button>
        </template>
        <Gruppo titolo="Contratto">
          <Riga titolo="Fornitore" :valore="fornitore || '–'"/>
          <Riga titolo="Impianto" :valore="sezione?.nome || '–'"/>
          <Riga v-if="contratto.numero" titolo="Numero" :valore="contratto.numero"/>
          <Riga titolo="Obbligo di legge" :valore="contratto.obbligo_legge ? 'Sì' : 'No'"/>
        </Gruppo>
        <Gruppo titolo="Durata">
          <Riga titolo="Durata" :valore="durata"/>
          <Riga v-if="contratto.inizio" titolo="Inizio" :valore="f.data(contratto.inizio)"/>
          <Riga v-if="fine" titolo="Fine">
            <template #fine><BadgeScadenza :data="fine" :stato="stato"/></template>
          </Riga>
          <Riga titolo="Tacito rinnovo" :valore="contratto.rinnovo_automatico ? 'Sì' : 'No'"/>
          <Riga titolo="Avviso di scadenza" :valore="conAvviso(contratto) ? contratto.preavviso_giorni + ' giorni prima' : 'No'"/>
        </Gruppo>
        <Gruppo titolo="Costi">
          <Riga v-if="contratto.costo != null" titolo="Costo" :valore="f.euro(contratto.costo)"/>
          <Riga v-if="contratto.iva_percentuale" titolo="IVA" :valore="f.numero(contratto.iva_percentuale) + '%'"/>
          <Riga titolo="Costo totale" :valore="f.euro(costoContratto(contratto))" style="font-weight:600"/>
          <Riga v-if="mesi > 12" titolo="Costo per anno" :valore="f.euro(costoAnnuoContratto(contratto))"/>
        </Gruppo>
        <Gruppo v-if="contratto.allegato" titolo="Documento">
          <Riga icona="documento" :titolo="contratto.nome_allegato || 'Apri contratto'" freccia @click="apriAllegato"/>
        </Gruppo>
        <Gruppo v-if="contratto.note" titolo="Note"><div class="riga testo-descrizione">{{ contratto.note }}</div></Gruppo>
        <ContrattoFoglio v-if="modifica" :contratto="contratto" @chiudi="modifica = false"/>
      </Pagina>
      <PaginaMancante v-else/>`,
    data() { return { modifica: false }; },
    computed: {
        contratto() { return db.contratti.find(c => c.id === this.id); },
        sezione() { return sezioneDi(this.contratto?.sezione_id); },
        fornitore() { return fornitoreContratto(this.contratto); },
        fine() { return fineContratto(this.contratto); },
        mesi() { return mesiContratto(this.contratto); },
        durata() { return descriviDurata(this.mesi); },
        stato() { return statoScadenza(this.fine, this.contratto.preavviso_giorni); }
    },
    methods: {
        puoModificare, conAvviso, costoContratto, costoAnnuoContratto,
        async apriAllegato() { window.open(await urlFile(this.contratto.allegato), '_blank'); }
    },
    setup() { return { f }; }
};

/// "2 anni", "6 mesi", "1 anno e 6 mesi"
export function descriviDurata(mesi) {
    const a = Math.floor(mesi / 12), m = mesi % 12;
    const anni = a ? (a === 1 ? '1 anno' : `${a} anni`) : '', resto = m ? (m === 1 ? '1 mese' : `${m} mesi`) : '';
    return [anni, resto].filter(Boolean).join(' e ') || '–';
}

export const ContrattoFoglio = {
    props: { contratto: Object, sezioneId: String },
    emits: ['chiudi'],
    template: `
      <Foglio :titolo="contratto ? 'Modifica contratto' : 'Nuovo contratto'" :conferma-disabilitata="!b.titolo.trim()"
              @annulla="$emit('chiudi')" @conferma="salvaContratto">
        <Gruppo>
          <CampoTesto v-model="b.titolo" etichetta="Nome" segnaposto="es. Manutenzione caldaia"/>
          <CampoTesto v-model="b.fornitore" etichetta="Fornitore" segnaposto="Nome della ditta"/>
          <CampoScelta v-model="b.sezione_id" etichetta="Impianto" :opzioni="opzioniSezioni"/>
          <CampoTesto v-model="b.numero" etichetta="Numero" segnaposto="facoltativo"/>
          <Interruttore v-model="b.obbligo_legge" etichetta="Obbligo di legge"/>
        </Gruppo>
        <Gruppo titolo="Durata" :nota="b.durata_valore ? 'La fine si calcola da inizio e durata; puoi comunque modificarla.' : ''">
          <CampoNumero v-model="b.durata_valore" etichetta="Durata" segnaposto="es. 2"/>
          <CampoScelta v-model="b.durata_unita" etichetta="In" :opzioni="[{ valore: 'mesi', nome: 'Mesi' }, { valore: 'anni', nome: 'Anni' }]"/>
          <CampoData v-model="b.inizio" etichetta="Inizio"/>
          <CampoData v-model="b.scadenza" etichetta="Fine"/>
          <Interruttore v-model="b.rinnovo_automatico" etichetta="Tacito rinnovo"/>
        </Gruppo>
        <Gruppo titolo="Avviso di scadenza">
          <Interruttore v-model="b.avviso" etichetta="Avvisami prima della scadenza"/>
          <Passo v-if="b.avviso" v-model="b.preavviso_giorni" :min="0" :max="180" :passo="5">{{ b.preavviso_giorni }} giorni prima</Passo>
        </Gruppo>
        <Gruppo titolo="Costi" nota="Costo per tutta la durata del contratto, IVA esclusa. Nei costi annuali i contratti pluriennali vengono divisi per anno.">
          <CampoNumero v-model="b.costo" etichetta="Costo" unita="€"/>
          <CampoNumero v-model="b.iva_percentuale" etichetta="IVA" unita="%" segnaposto="0"/>
          <Riga titolo="Costo totale" :valore="f.euro(totale)" style="font-weight:600"/>
        </Gruppo>
        <Gruppo titolo="Documento">
          <Riga v-if="b.allegato" icona="documento" :titolo="b.nome_allegato"/>
          <label class="riga toccabile azione"><span class="riga-icona"><Icona nome="graffetta"/></span>
            <span class="riga-testi">{{ b.allegato ? 'Sostituisci documento' : 'Allega PDF o foto' }}</span>
            <input type="file" accept="application/pdf,image/*" hidden @change="scegliFile">
          </label>
        </Gruppo>
        <Gruppo titolo="Note"><CampoTesto v-model="b.note" multilinea segnaposto="Note"/></Gruppo>
        <Gruppo v-if="contratto"><Riga distruttiva titolo="Elimina contratto" @click="eliminaContratto"/></Gruppo>
      </Foglio>`,
    data() {
        const c = this.contratto ?? {};
        return {
            file: null,
            b: {
                titolo: c.titolo ?? '', numero: c.numero ?? '', fornitore: c.id ? fornitoreContratto(c) : '',
                sezione_id: c.sezione_id ?? this.sezioneId ?? null, inizio: c.inizio ?? f.oggiISO(), scadenza: c.scadenza ?? null,
                durata_valore: c.durata_valore ?? null, durata_unita: c.durata_unita || 'anni',
                avviso: c.id ? conAvviso(c) : true, preavviso_giorni: Math.max(0, Number(c.preavviso_giorni ?? 30)),
                rinnovo_automatico: c.rinnovo_automatico ?? false, obbligo_legge: c.obbligo_legge ?? false,
                costo: c.costo ?? (c.costo_annuo ? Number(c.costo_annuo) : null), iva_percentuale: c.iva_percentuale ?? null,
                note: c.note ?? '', allegato: c.allegato ?? '', nome_allegato: c.nome_allegato ?? ''
            }
        };
    },
    watch: {
        // Con inizio e durata la fine si calcola da sola.
        'b.durata_valore'() { this.calcolaFine(); },
        'b.durata_unita'() { this.calcolaFine(); },
        'b.inizio'() { this.calcolaFine(); }
    },
    computed: {
        totale() { return (Number(this.b.costo) || 0) * (1 + (Number(this.b.iva_percentuale) || 0) / 100); },
        opzioniSezioni() {
            return [{ valore: null, nome: 'Nessuno' }, ...db.sezioni.slice().sort((a, b) => a.ordine - b.ordine).map(s => ({ valore: s.id, nome: s.nome }))];
        }
    },
    methods: {
        calcolaFine() {
            if (!this.b.inizio || !(this.b.durata_valore > 0)) return;
            const mesi = this.b.durata_valore * (this.b.durata_unita === 'mesi' ? 1 : 12);
            const d = f.aggiungiMesi(this.b.inizio, mesi);
            this.b.scadenza = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        },
        scegliFile(e) { this.file = e.target.files[0]; if (this.file) { this.b.nome_allegato = this.file.name; this.b.allegato = 'nuovo'; } },
        async salvaContratto() {
            const { avviso, ...campi } = this.b;
            const record = {
                ...(this.contratto ?? {}), ...campi, id: this.contratto?.id, titolo: campi.titolo.trim(), fornitore: campi.fornitore.trim(),
                preavviso_giorni: avviso ? campi.preavviso_giorni : -1, costo_annuo: 0
            };
            if (this.file) record.allegato = await caricaFile(this.file, 'contratti');
            await salva('contratti', record);
            this.$emit('chiudi');
        },
        async eliminaContratto() {
            if (!confirm('Eliminare il contratto?')) return;
            this.$emit('chiudi');
            await elimina('contratti', this.contratto.id);
            indietro();
        }
    },
    setup() { return { f }; }
};

// ---------------------------------------------------------------------
// Prodotti a scorta
// ---------------------------------------------------------------------
/// Riga di catalogo: nome, codice, stato e confezioni (le scorte si gestiscono nelle operazioni).
export const RigaProdotto = {
    props: { prodotto: Object, conOperazione: Boolean },
    template: `<Riga :icona="prodotto.icona || 'scatola'" quadrata :colore="colore" :titolo="prodotto.nome" :sottotitolo="sottotitolo" freccia/>`,
    computed: {
        colore() { return coloreImpianto(operazioneDiProdotto(this.prodotto)?.sezione_id); },
        sottotitolo() {
            const p = this.prodotto;
            return [p.codice, this.conOperazione && operazioneDiProdotto(p)?.titolo, p.stato, descriviFormati(p)].filter(Boolean).join(' · ');
        }
    }
};

/// Magazzino: archivio dei prodotti (dati, fornitore, schede tecniche), diviso per impianto.
export const Magazzino = {
    template: `
      <Pagina titolo="Magazzino" grande :con-indietro="false">
        <template #azioni>
          <button v-if="puoModificare()" class="pulsante-barra" @click="nuovo = true" aria-label="Nuovo prodotto"><Icona nome="piu"/></button>
        </template>
        <label v-if="db.prodotti.length > 4" class="campo-ricerca"><Icona nome="ricerca" :dimensione="18"/>
          <input v-model="ricerca" placeholder="Cerca nome, codice, fornitore" type="search"></label>
        <Vuoto v-if="!db.prodotti.length" icona="scatola" titolo="Magazzino vuoto"
               testo="Aggiungi i prodotti che usate (ossigeno, correttori pH…) e collegali all'operazione in cui si usano: acquisti e consumi si registrano lì."/>
        <Gruppo v-for="g in gruppi" :key="g.id" :titolo="g.nome">
          <RigaProdotto v-for="p in g.prodotti" :key="p.id" :prodotto="p" con-operazione
                        :selezionata="selezionata(p)" @click="apriDaElenco({ nome: 'prodotto', id: p.id })"/>
        </Gruppo>
        <ProdottoFoglio v-if="nuovo" @chiudi="nuovo = false"/>
      </Pagina>`,
    data() { return { nuovo: false, ricerca: '' }; },
    computed: {
        db() { return db; },
        gruppi() {
            const testo = this.ricerca.trim().toLowerCase();
            const prodotti = db.prodotti.filter(p => !testo || [p.nome, p.codice, ...fornitoriDi(p).map(x => x.nome)].some(v => (v ?? '').toLowerCase().includes(testo)))
                .sort((a, b) => a.ordine - b.ordine || a.nome.localeCompare(b.nome));
            const gruppi = db.sezioni.slice().sort((a, b) => a.ordine - b.ordine).map(s => ({
                id: s.id, nome: s.nome, prodotti: prodotti.filter(p => operazioneDiProdotto(p)?.sezione_id === s.id)
            }));
            gruppi.push({ id: 'nessuno', nome: 'Da collegare a un impianto', prodotti: prodotti.filter(p => !operazioneDiProdotto(p)) });
            return gruppi.filter(g => g.prodotti.length);
        }
    },
    methods: {
        apriDaElenco, puoModificare,
        selezionata(p) { return nav.largo && stessaPagina(pila()[0], { nome: 'prodotto', id: p.id }); }
    }
};

export const ProdottoPagina = {
    props: { id: String },
    template: `
      <Pagina v-if="prodotto" :titolo="prodotto.nome">
        <template #azioni>
          <button v-if="puoModificare()" class="pulsante-barra" @click="impostazioni = true">Modifica</button>
        </template>
        <Gruppo titolo="Scheda prodotto">
          <Riga titolo="Codice" :valore="prodotto.codice || '–'"/>
          <Riga titolo="Impianto" :valore="impianto || 'Non collegato'"/>
          <Riga titolo="Stato" :valore="prodotto.stato || '–'"/>
          <Riga titolo="Confezioni" :valore="confezioni"/>
          <Riga v-if="!fornitori.length" titolo="Fornitore" valore="–"/>
          <Riga v-for="(x, i) in fornitori" :key="i" :titolo="fornitori.length > 1 ? 'Fornitore ' + (i + 1) : 'Fornitore'" :valore="x.nome"
                :sottotitolo="x.link" :freccia="!!x.link" @click="x.link && apriSito(x.link)"/>
          <div v-if="prodotto.note" class="riga testo-descrizione">{{ prodotto.note }}</div>
        </Gruppo>
        <SchedeTecniche :prodotto="prodotto"/>
        <ProdottoFoglio v-if="impostazioni" :prodotto="prodotto" @chiudi="impostazioni = false"/>
      </Pagina>
      <PaginaMancante v-else/>`,
    data() { return { impostazioni: false }; },
    computed: {
        prodotto() { return db.prodotti.find(p => p.id === this.id); },
        operazione() { return operazioneDiProdotto(this.prodotto); },
        impianto() {
            if (!this.operazione) return '';
            return [sezioneDi(this.operazione.sezione_id)?.nome, this.operazione.titolo].filter(Boolean).join(' · ');
        },
        confezioni() { return descriviFormati(this.prodotto); },
        fornitori() { return fornitoriDi(this.prodotto); }
    },
    methods: {
        puoModificare,
        apriSito(link) {
            window.open(/^https?:\/\//i.test(link) ? link : 'https://' + link, '_blank', 'noopener');
        }
    }
};

/// "Taniche da 5 l e 1 l", oppure solo l'unità di misura.
export function descriviFormati(p) {
    const formati = formatiDi(p);
    if (!formati.length) return `Sfuso · ${p.unita}`;
    const nome = nomeConfezione(p, 2);
    return `${nome.charAt(0).toUpperCase() + nome.slice(1)} da ${formati.map(l => f.quantita(l, p.unita)).join(' e ')}`;
}

/// Giacenza, pulsanti movimento, grafico e storico di un prodotto.
export const SezioniScorta = {
    props: { prodotto: Object, conGrafici: Boolean },
    template: `
      <Gruppo titolo="Scorta">
        <div class="valore-grande">
          <div class="etichetta">Giacenza attuale</div>
          <div class="numero" :class="{ rosso: basso }">{{ f.quantita(a.giacenza, prodotto.unita) }}</div>
          <div v-if="basso" class="arancione-t" style="font-size:14px">Sotto la scorta minima ({{ f.quantita(prodotto.scorta_minima, prodotto.unita) }})</div>
        </div>
        <Riga v-if="a.ultimoMovimento" titolo="Ultimo movimento" :valore="f.data(a.ultimoMovimento)"/>
        <Riga titolo="Totale acquistato" :valore="f.quantita(a.acquistato, prodotto.unita)"/>
        <Riga titolo="Totale consumato" :valore="f.quantita(a.consumato, prodotto.unita)"/>
        <Riga v-if="a.costo" titolo="Spesa totale" :valore="f.euro(a.costo)"/>
        <Riga v-if="a.costoMedio" titolo="Costo medio" :valore="f.euro(a.costoMedio) + ' / ' + prodotto.unita"/>
      </Gruppo>
      <Azioni v-if="puoModificare()" :voci="azioni" @scegli="t => movimento = { tipo: t }"/>
      <Gruppo v-if="conGrafici && a.andamento.length > 1" titolo="Andamento giacenza"
              :nota="Number(prodotto.scorta_minima) > 0 ? 'La linea tratteggiata è la scorta minima.' : ''" nota-sempre>
        <Grafico :serie="[{ nome: 'Giacenza', colore: 'var(--accento)', punti: a.andamento.map(p => ({ x: f.giorno(p.data), y: p.valore })) }]"
                 :riferimento="Number(prodotto.scorta_minima) > 0 ? Number(prodotto.scorta_minima) : null"
                 :gradini="movimenti.some(m => m.tipo === 'consumo')"/>
      </Gruppo>
      <Gruppo v-if="conGrafici && prezzi.length > 1" titolo="Prezzo nel tempo" nota="Prezzo del prodotto con IVA, senza trasporto." nota-sempre>
        <Grafico :serie="[{ nome: 'Prezzo', colore: 'var(--verde)', punti: prezzi }]" :formato-y="v => f.numero(v) + ' €'" valori/>
      </Gruppo>
      <Gruppo v-if="conGrafici && consumiMensili.length > 1" :titolo="nomeMovimento('consumo', prodotto.categoria) + ' per mese'">
        <Grafico :serie="[{ nome: 'Consumo', colore: 'var(--arancione)', punti: consumiMensili }]"/>
      </Gruppo>
      <Gruppo :titolo="'Acquisti e ' + nomeMovimento('consumo', prodotto.categoria).toLowerCase()">
        <Riga v-if="!movimenti.length" titolo="Nessun movimento registrato" class="secondario"/>
        <Riga v-for="m in (tutti ? movimenti : movimenti.slice(0, 1))" :key="m.id" :icona="icona(m.tipo)" :colore="colore(m.tipo)"
              :titolo="nomeMovimento(m.tipo, prodotto.categoria)" :sottotitolo="sottotitolo(m)"
              @click="puoModificare() && (movimento = { tipo: m.tipo, voce: m })">
          <template #fine>
            <span class="riga-valore">{{ segno(m.tipo) }}{{ f.quantita(m.quantita, prodotto.unita) }}<br v-if="m.costo">
              <small v-if="m.costo" class="secondario">{{ f.euro(m.costo) }}</small></span>
          </template>
        </Riga>
        <RigaEspandi :totale="movimenti.length" v-model:aperto="tutti"/>
      </Gruppo>
      <MovimentoFoglio v-if="movimento" :prodotto-iniziale="prodotto" :tipo="movimento.tipo" :movimento="movimento.voce" @chiudi="movimento = null"/>`,
    data() { return { movimento: null, tutti: false }; },
    computed: {
        a() { return analisiScorta(this.prodotto); },
        basso() { return sottoScorta(this.prodotto); },
        previsioni() { return mostraPrevisioni(this.prodotto); },
        movimenti() { return movimentiDi(this.prodotto); },
        /// Prezzo per unità di ogni acquisto (es. €/kg), dal più vecchio.
        prezzi() {
            return this.movimenti.filter(m => m.tipo === 'acquisto').map(m => ({ x: f.giorno(m.data), y: prezzoProdotto(m) }))
                .filter(p => p.y != null).reverse();
        },
        /// Totale consumato in ogni mese (dal primo all'ultimo mese con movimenti).
        consumiMensili() {
            const perMese = {};
            for (const m of this.movimenti) if (m.tipo === 'consumo' && m.data) {
                const k = m.data.slice(0, 7);
                perMese[k] = (perMese[k] ?? 0) + (Number(m.quantita) || 0);
            }
            const chiavi = Object.keys(perMese).sort();
            if (!chiavi.length) return [];
            const punti = [];
            for (let d = f.giorno(chiavi[0] + '-01'); d <= f.giorno(chiavi.at(-1) + '-01'); d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
                const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                punti.push({ x: d, y: perMese[k] ?? 0 });
            }
            return punti;
        },
        azioni() {
            return [
                { id: 'acquisto', nome: 'Acquisto', icona: 'carrello' },
                { id: 'consumo', nome: nomeMovimento('consumo', this.prodotto.categoria), icona: 'meno' },
                { id: 'rettifica', nome: 'Rettifica giacenza', icona: 'lista' }
            ];
        }
    },
    methods: {
        puoModificare, nomeMovimento, nomeConfezione, salva,
        maiuscola: t => t.charAt(0).toUpperCase() + t.slice(1),
        icona: t => ({ acquisto: 'carrello', consumo: 'meno', rettifica: 'lista' })[t],
        colore: t => ({ acquisto: 'var(--verde)', consumo: 'var(--arancione)', rettifica: 'var(--blu)' })[t],
        segno: t => ({ acquisto: '+', consumo: '−', rettifica: '= ' })[t],
        sottotitolo(m) {
            return [f.dataBreve(m.data), descriviConfezioni(this.prodotto, m.confezioni), m.descrizione_prodotto, m.fornitore, m.note]
                .filter(Boolean).join(' · ');
        }
    },
    setup() { return { f }; }
};

/// Schede tecniche (e altri documenti) allegate a un prodotto a scorta.
export const SchedeTecniche = {
    props: { prodotto: Object },
    template: `
      <Gruppo v-if="documenti.length || puoModificare()" titolo="Schede tecniche"
              :nota="documenti.length && puoModificare() ? 'Per eliminare una scheda tocca Modifica nella pagina del prodotto.' : ''">
        <RigaDocumento v-for="d in documenti" :key="d.id" :documento="d"/>
        <label v-if="puoModificare()" class="riga toccabile azione"><span class="riga-icona"><Icona nome="graffetta"/></span>
          <span class="riga-testi">{{ caricamento ? 'Caricamento…' : 'Allega scheda tecnica' }}</span>
          <input type="file" multiple hidden accept=".pdf,image/*" @change="allega">
        </label>
      </Gruppo>`,
    data() { return { caricamento: false }; },
    computed: { documenti() { return schedeDi(this.prodotto); } },
    methods: {
        puoModificare,
        async allega(e) {
            this.caricamento = true;
            try {
                for (const file of e.target.files) {
                    const percorso = await caricaFile(file, 'schede');
                    await salva('documenti', { prodotto_id: this.prodotto.id, sezione_id: null, titolo: file.name.replace(/\.[^.]+$/, ''),
                                               nome_file: file.name, percorso, dimensione: file.size });
                }
            } catch (errore) {
                alert('Caricamento non riuscito: ' + (errore?.message ?? errore));
            } finally { this.caricamento = false; e.target.value = ''; }
        }
    }
};

export const schedeDi = prodotto => db.documenti.filter(d => d.prodotto_id === prodotto.id).sort((a, b) => a.titolo.localeCompare(b.titolo));

export const MovimentoFoglio = {
    // prodottoIniziale: prodotto da cui si apre il foglio. Per un movimento nuovo si può scegliere un altro prodotto
    // della stessa operazione (es. pH- / pH+): unità, confezioni, prezzi, IVA e fornitori si aggiornano in base alla scelta.
    props: { prodottoIniziale: Object, tipo: String, movimento: Object },
    emits: ['chiudi'],
    template: `
      <Foglio :titolo="nomeMovimento(tipo, prodotto.categoria)" :conferma-disabilitata="!(quantitaFinale > 0) && tipo !== 'rettifica'"
              @annulla="$emit('chiudi')" @conferma="salvaMovimento">
        <Gruppo :nota="nota">
          <CampoScelta v-if="!movimento && opzioniProdotto.length > 1" v-model="sceltoId" etichetta="Prodotto" :opzioni="opzioniProdotto"/>
          <Riga v-else titolo="Prodotto" :valore="prodotto.nome + (prodotto.codice ? ' · ' + prodotto.codice : '')"/>
          <CampoData v-model="b.data" etichetta="Data"/>
          <template v-if="acquisto">
            <CampoScelta v-if="opzioniFornitori.length > 1" v-model="b.fornitore" etichetta="Fornitore" :opzioni="opzioniFornitori"/>
            <CampoTesto v-if="opzioniFornitori.length <= 1 || b.fornitore === ALTRO" v-model="b.fornitoreLibero" etichetta="Fornitore" segnaposto="Nome fornitore"/>
          </template>
        </Gruppo>
        <Gruppo :nota="notaQuantita">
          <CampoScelta v-if="opzioniUnita.length > 1" v-model="b.unita" etichetta="Unità di misura" :opzioni="opzioniUnita"/>
          <CampoNumero v-model="b.quantita" :etichetta="etichettaQuantita" :unita="unitaBreve"/>
          <Riga v-if="b.unita !== 'base' && quantitaFinale" titolo="In magazzino" :valore="segno + f.quantita(quantitaFinale, prodotto.unita)"/>
        </Gruppo>
        <Gruppo v-if="acquisto" titolo="Costo">
          <CampoNumero v-model="b.prezzo" :etichetta="'Prezzo per ' + unitaBreve" unita="€"/>
          <Riga titolo="Importo" :valore="f.euro(c.importo)"/>
          <CampoNumero v-model="b.sconto" etichetta="Sconto" unita="%" segnaposto="0"/>
          <Riga v-if="b.sconto" titolo="Importo scontato" :valore="f.euro(c.scontato)"/>
          <CampoNumero v-model="b.trasporto" etichetta="Trasporto" unita="€" segnaposto="0"/>
          <CampoNumero v-model="b.iva" etichetta="IVA" unita="%" segnaposto="inclusa"/>
          <Riga titolo="Imponibile" :valore="f.euro(c.imponibile)"/>
          <Riga v-if="b.iva" titolo="Imposta" :valore="f.euro(c.imposta)"/>
          <Riga titolo="Costo totale" :valore="f.euro(c.totale)" style="font-weight:600"/>
        </Gruppo>
        <Gruppo v-if="acquisto && prodotto.categoria === 'pellet'" titolo="Deposito"
                nota="Facoltativo: pellet presente nel silo prima del carico, come lo indica il pannello della caldaia.">
          <CampoNumero v-model="b.precarico" etichetta="Prima del carico" :unita="prodotto.unita"/>
          <Riga v-if="b.precarico !== null" titolo="Dopo il carico" :valore="f.quantita(b.precarico + (quantitaFinale || 0), prodotto.unita)"/>
        </Gruppo>
        <Gruppo titolo="Note"><CampoTesto v-model="b.note" multilinea segnaposto="Note"/></Gruppo>
        <Gruppo v-if="movimento"><Riga distruttiva titolo="Elimina" @click="eliminaMovimento"/></Gruppo>
      </Foglio>`,
    data() { return { sceltoId: this.prodottoIniziale.id, b: {}, ALTRO: '__altro__' }; },
    created() { this.b = this.campi(); },
    watch: {
        /// Nuovo prodotto scelto: i campi che dipendono dal prodotto ripartono, data e note restano.
        sceltoId() { const { data, note } = this.b; this.b = { ...this.campi(), data, note }; }
    },
    computed: {
        prodotto() { return db.prodotti.find(p => p.id === this.sceltoId) ?? this.prodottoIniziale; },
        acquisto() { return this.tipo === 'acquisto'; },
        /// Prodotti del magazzino collegati alla stessa operazione.
        opzioniProdotto() {
            const operazione = operazioneDiProdotto(this.prodottoIniziale);
            const prodotti = operazione ? prodottiOperazione(operazione) : [this.prodottoIniziale];
            return prodotti.map(p => ({ valore: p.id, nome: p.codice ? `${p.nome} · ${p.codice}` : p.nome }));
        },
        /// Unità con cui si inserisce la quantità: confezioni del prodotto oppure la sua unità di misura.
        opzioniUnita() {
            const p = this.prodotto;
            return [...formatiDi(p).map(l => ({ valore: String(l), nome: `${nomeConfezione(p, 2)} da ${f.quantita(l, p.unita)}` })),
                    { valore: 'base', nome: nomeUnita(p.unita) }];
        },
        formato() { return this.b.unita === 'base' ? 1 : Number(this.b.unita) || 1; },
        unitaBreve() { return this.b.unita === 'base' ? this.prodotto.unita : nomeConfezione(this.prodotto, 1); },
        quantitaFinale() { return this.b.quantita == null ? null : this.b.quantita * this.formato; },
        segno() { return { acquisto: '+', consumo: '−', rettifica: '= ' }[this.tipo]; },
        opzioniFornitori() {
            const nomi = fornitoriDi(this.prodotto).map(x => x.nome);
            if (this.b.fornitore && this.b.fornitore !== this.ALTRO && !nomi.includes(this.b.fornitore)) nomi.push(this.b.fornitore);
            return [...nomi.map(n => ({ valore: n, nome: n })), { valore: this.ALTRO, nome: 'Altro…' }];
        },
        c() { return calcoliAcquisto({ quantita: this.b.quantita, prezzo: this.b.prezzo, sconto: this.b.sconto, trasporto: this.b.trasporto, iva: this.b.iva }); },
        etichettaQuantita() { return this.tipo === 'rettifica' ? 'Quantità presente' : 'Quantità'; },
        notaQuantita() {
            if (this.b.unita === 'base' || this.opzioniUnita.length < 2) return '';
            return `La quantità è il numero di ${nomeConfezione(this.prodotto, 2)}; in magazzino si conta in ${this.prodotto.unita}.`;
        },
        nota() {
            return {
                acquisto: 'Il carico si aggiunge alla scorta.',
                consumo: 'La quantità utilizzata (o messa in piscina) viene sottratta dalla scorta.',
                rettifica: 'Forza la giacenza al valore indicato, ad esempio dopo aver controllato quanto è rimasto davvero.'
            }[this.tipo];
        }
    },
    methods: {
        /// Campi del modulo per il prodotto scelto (e per il movimento da modificare).
        campi() {
            const m = this.movimento ?? {}, d = m.dettagli ?? {}, p = this.prodotto;
            const formati = formatiDi(p);
            // Unità: quella salvata, altrimenti la prima confezione (se c'è) oppure l'unità del prodotto.
            let unita = d.formato ? String(d.formato) : m.id ? 'base' : (formati[0] ? String(formati[0]) : 'base');
            const conf = (m.confezioni ?? []).filter(c => c.numero > 0);
            if (!d.formato && conf.length === 1) unita = String(conf[0].litri);
            const fmt = unita === 'base' ? 1 : Number(unita);
            const precedente = movimentiDi(p).find(x => x.tipo === 'acquisto' && x.dettagli?.iva_percentuale != null);
            const iva = m.id ? (d.iva_percentuale ?? null) : (precedente?.dettagli.iva_percentuale ?? null);
            const nomiFornitori = fornitoriDi(p).map(x => x.nome);
            const fornitore = m.id ? (m.fornitore || '') : (nomiFornitori[0] ?? '');
            // Con fornitori in elenco si usa il menu (il nome salvato resta tra le opzioni), altrimenti il campo libero.
            const prezzoVecchio = m.costo && m.quantita ? m.costo / (m.quantita / fmt) / (1 + (Number(iva) || 0) / 100) : null;
            return {
                data: m.data ?? f.oggiISO(), unita, quantita: m.quantita != null ? m.quantita / fmt : null,
                prezzo: d.prezzo_unitario ?? (d.trasporto == null ? prezzoVecchio : null),
                sconto: d.sconto ?? null, trasporto: d.trasporto ?? null, iva, precarico: d.precarico ?? null,
                fornitore: nomiFornitori.length ? (fornitore || nomiFornitori[0]) : '', fornitoreLibero: nomiFornitori.length ? '' : fornitore,
                note: m.note ?? '', descrizione_prodotto: m.descrizione_prodotto ?? ''
            };
        },
        nomeMovimento,
        async salvaMovimento() {
            const fornitore = this.opzioniFornitori.length > 1 && this.b.fornitore !== this.ALTRO ? this.b.fornitore : this.b.fornitoreLibero.trim();
            const confezioni = this.b.unita !== 'base' && this.b.quantita ? [{ litri: this.formato, numero: this.b.quantita }] : [];
            await salva('movimenti', {
                id: this.movimento?.id, prodotto_id: this.prodotto.id, tipo: this.tipo, data: this.b.data,
                quantita: this.quantitaFinale ?? 0, costo: this.acquisto ? this.c.totale : 0, fornitore: this.acquisto ? fornitore : '',
                descrizione_prodotto: this.b.descrizione_prodotto, note: this.b.note, confezioni,
                dettagli: this.acquisto ? {
                    ...(this.movimento?.dettagli ?? {}), formato: this.b.unita === 'base' ? null : this.formato,
                    prezzo_unitario: this.b.prezzo, sconto: this.b.sconto, trasporto: this.b.trasporto,
                    iva_percentuale: this.b.iva, precarico: this.b.precarico
                } : {}
            });
            this.$emit('chiudi');
        },
        async eliminaMovimento() {
            if (!confirm('Eliminare questo movimento?')) return;
            await elimina('movimenti', this.movimento.id);
            this.$emit('chiudi');
        }
    },
    setup() { return { f }; }
};

export const ProdottoFoglio = {
    props: { prodotto: Object, operazioneId: String },
    emits: ['chiudi'],
    template: `
      <Foglio :titolo="prodotto ? 'Modifica prodotto' : 'Nuovo prodotto'" :conferma-disabilitata="!b.nome.trim()"
              @annulla="$emit('chiudi')" @conferma="salvaProdotto">
        <Gruppo>
          <CampoTesto v-model="b.nome" segnaposto="Nome prodotto"/>
          <CampoTesto v-model="b.codice" etichetta="Codice" segnaposto="es. CK120914S"/>
        </Gruppo>
        <Gruppo nota="L'operazione in cui si usa: lì si registrano acquisti e consumi e si impostano gli avvisi di scorta.">
          <CampoScelta v-model="b.operazione_id" etichetta="Impianto e operazione" :opzioni="operazioni"/>
        </Gruppo>
        <Gruppo titolo="Simbolo" nota="Il colore è quello dell'impianto collegato.">
          <SceltaIcona v-model="b.icona" :colore="coloreScelto" predefinita="scatola"/>
        </Gruppo>
        <Gruppo titolo="Prodotto" :nota="'Confezioni: formati in cui si compra, separati da virgola (5, 1 = taniche da 5 e da 1 ' + (b.unita || 'unità') + '). Negli acquisti e nei consumi si indica il numero di confezioni. Vuoto se è sfuso.'">
          <CampoScelta v-model="b.stato" etichetta="Stato" :opzioni="stati"/>
          <CampoScelta v-model="b.unita" etichetta="Unità di misura" :opzioni="unita"/>
          <CampoTesto v-model="b.formati" etichetta="Confezioni da" :segnaposto="'es. 5, 1 (' + (b.unita || 'unità') + ')'"/>
        </Gruppo>
        <Gruppo titolo="Fornitori" nota="Negli acquisti si sceglie il fornitore da questo elenco. Svuota il nome per toglierlo.">
          <template v-for="(x, i) in b.fornitori" :key="i">
            <CampoTesto v-model="x.nome" :etichetta="'Fornitore ' + (i + 1)" segnaposto="Nome"/>
            <CampoTesto v-model="x.link" segnaposto="Sito (es. https://www.gecostore.it)" tipo="url"/>
          </template>
          <Riga azione icona="piu" titolo="Aggiungi fornitore" @click="b.fornitori.push({ nome: '', link: '' })"/>
        </Gruppo>
        <Gruppo titolo="Note"><CampoTesto v-model="b.note" multilinea segnaposto="Note (dosaggi, avvertenze…)"/></Gruppo>
        <Gruppo v-if="schede.length" titolo="Schede tecniche" nota="Tocca una scheda per eliminarla. Per aggiungerle usa “Allega scheda tecnica” nella pagina del prodotto.">
          <Riga v-for="d in schede" :key="d.id" icona="cestino" colore="var(--rosso)" :titolo="d.titolo" @click="eliminaScheda(d)"/>
        </Gruppo>
        <Gruppo v-if="prodotto"><Riga distruttiva titolo="Elimina prodotto e movimenti" @click="eliminaProdotto"/></Gruppo>
      </Foglio>`,
    data() {
        const p = this.prodotto ?? {};
        return { b: {
            nome: p.nome ?? '', codice: p.codice ?? '', stato: p.stato ?? '', unita: p.unita ?? 'kg', icona: p.icona || '',
            operazione_id: p.operazione_id ?? operazioneDiProdotto(p)?.id ?? this.operazioneId ?? null,
            fornitori: (fornitoriDi(p).length ? fornitoriDi(p) : [{ nome: '', link: '' }]).map(x => ({ nome: x.nome, link: x.link ?? '' })),
            note: p.note ?? '',
            formati: formatiDi(p).map(v => String(v).replace('.', ',')).join(', ')
        } };
    },
    computed: {
        operazioni() {
            const opzioni = [{ valore: null, nome: 'Nessuna' }];
            for (const s of db.sezioni.slice().sort((a, b) => a.ordine - b.ordine)) {
                for (const o of operazioniDi(s).filter(o => o.tipo !== 'storico')) opzioni.push({ valore: o.id, nome: `${s.nome} · ${o.titolo}` });
            }
            return opzioni;
        },
        stati() { return [{ valore: '', nome: '–' }, ...STATI_PRODOTTO.map(v => ({ valore: v, nome: v }))]; },
        /// Unità del menu; un'unità già usata ma non in elenco resta selezionabile.
        unita() {
            const elenco = UNITA_MISURA.map(([valore, nome]) => ({ valore, nome }));
            if (this.b.unita && !elenco.some(u => u.valore === this.b.unita)) elenco.push({ valore: this.b.unita, nome: this.b.unita });
            return elenco;
        },
        coloreScelto() { return coloreImpianto(db.operazioni.find(o => o.id === this.b.operazione_id)?.sezione_id); },
        schede() { return this.prodotto ? schedeDi(this.prodotto) : []; }
    },
    methods: {
        async eliminaScheda(d) {
            if (!confirm(`Eliminare la scheda "${d.titolo}"?`)) return;
            await elimina('documenti', d.id);
            if (!d.percorso.startsWith('statico/')) backend.rimuoviFile(d.percorso).catch(() => {});
        },
        async salvaProdotto() {
            const { formati, ...campi } = this.b;
            const confezioni = [...new Set(formati.split(/[;\s]+|,\s+/).map(f.leggiNumero).filter(v => v > 0))];
            const operazione = db.operazioni.find(o => o.id === campi.operazione_id);
            await salva('prodotti', {
                ...(this.prodotto ?? { scorta_minima: 0, consumo_mensile: null }), ...campi, confezioni, id: this.prodotto?.id,
                categoria: categoriaPerOperazione(operazione), icona: campi.icona === 'scatola' ? '' : campi.icona,
                // I vecchi campi restano allineati al primo fornitore (ricerca, contenuti iniziali).
                fornitori: campi.fornitori.map(x => ({ nome: x.nome.trim(), link: x.link.trim() })).filter(x => x.nome),
                fornitore: campi.fornitori.find(x => x.nome.trim())?.nome.trim() ?? '',
                fornitore_link: campi.fornitori.find(x => x.nome.trim())?.link.trim() ?? '',
                ordine: this.prodotto?.ordine ?? db.prodotti.length
            });
            // L'operazione non punta più al prodotto: il collegamento ora sta nel prodotto.
            const vecchia = db.operazioni.find(o => o.prodotto_id && o.prodotto_id === this.prodotto?.id && o.id !== campi.operazione_id);
            if (vecchia) await salva('operazioni', { ...vecchia, prodotto_id: null });
            this.$emit('chiudi');
        },
        async eliminaProdotto() {
            if (!confirm(`Eliminare "${this.prodotto.nome}" e tutti i suoi movimenti?`)) return;
            this.$emit('chiudi');
            await elimina('prodotti', this.prodotto.id);
            indietro();
        }
    }
};

// Componenti usati anche dalle altre schermate.
export const componentiManutenzione = { TesseraImpianto, RigaContratto, RigaProdotto, SezioniScorta, SchedeTecniche, MovimentoFoglio, ProdottoFoglio, ContrattoFoglio, PaginaMancante };
