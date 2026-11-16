// Manutenzione: stato della casa, sistemi, contratti e prodotti a scorta.
import { computed } from 'vue';
import { db, salva, elimina, caricaFile, urlFile, puoModificare } from '../store.js';
import { nav, pila, apri, apriDaElenco, indietro, stessaPagina } from '../nav.js';
import * as f from '../format.js';
import {
    avvisi, prossime, operazioniDi, statoOperazione, TIPI_OPERAZIONE, analisiScorta, sottoScorta,
    mostraPrevisioni, movimentiDi, nomeMovimento, CATEGORIE, statoScadenza, nomeContatto, sezioneDi,
    ultimoRiempimento, interventiDi, carichiOrdinati, svuotamentiOrdinati, formatiDi, nomeConfezione, descriviConfezioni,
    prodottiOperazione, operazioneDiProdotto, categoriaPerOperazione, STATI_PRODOTTO, allarmi
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
        const autonomia = mostraPrevisioni(p) && a.autonomia !== null ? ` · ${a.autonomia} gg` : '';
        return `${o.titolo} ${f.quantita(a.giacenza, p.unita)}${autonomia}`;
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
          <span class="ti-stato"><i></i>{{ r.etichetta }}</span>
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
export const indirizzoImpianto = sezione => `${location.origin}${location.pathname}#manutenzione/sistema:${sezione.id}`;

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
// Home
// ---------------------------------------------------------------------
export const ManutenzioneHome = {
    components: { RigaAvviso, TesseraImpianto },
    template: `
      <Pagina titolo="Manutenzione" grande :con-indietro="false">
        <Vuoto v-if="!sezioni.length" icona="casa" titolo="Ancora nessun dato"
               testo="Chi può modificare apre Impostazioni → Carica contenuti iniziali: verranno creati sistemi, operazioni, guide e carichi pellet."/>
        <div v-if="sezioni.length" class="riepilogo">
          <div class="tessera" :class="{ rosso: conteggi.scaduti }">
            <Icona nome="avviso"/><span class="tessera-numero">{{ conteggi.scaduti }}</span><span class="tessera-titolo">Da fare subito</span>
          </div>
          <div class="tessera" :class="{ arancione: conteggi.inScadenza }">
            <Icona nome="orologio"/><span class="tessera-numero">{{ conteggi.inScadenza }}</span><span class="tessera-titolo">In scadenza / in corso</span>
          </div>
          <div class="tessera" :class="{ blu: elencoProssime.length }">
            <Icona nome="calendario"/><span class="tessera-numero">{{ elencoProssime.length }}</span><span class="tessera-titolo">In arrivo</span>
          </div>
        </div>

        <Gruppo titolo="Avvisi">
          <Riga v-if="!elencoAvvisi.length" icona="sigillo" colore="var(--verde)" titolo="Tutto in regola"/>
          <RigaAvviso v-for="a in elencoAvvisi" :key="a.id" :avviso="a" :selezionata="selezionata(a.pagina)" @apri="apriDaElenco"/>
        </Gruppo>

        <Gruppo v-if="elencoProssime.length" titolo="Prossimi 30 giorni">
          <RigaAvviso v-for="a in elencoProssime" :key="a.id" :avviso="a" :selezionata="selezionata(a.pagina)" @apri="apriDaElenco"/>
        </Gruppo>

        <div v-if="sezioni.length" class="gruppo">
          <h3 class="gruppo-titolo">Impianti</h3>
          <div class="griglia-impianti">
            <TesseraImpianto v-for="s in sezioni" :key="s.id" :sezione="s"
                             :selezionata="selezionata({ nome: 'sistema', id: s.id })" @click="apriDaElenco({ nome: 'sistema', id: s.id })"/>
          </div>
        </div>

      </Pagina>`,
    setup() {
        const elencoAvvisi = computed(() => avvisi());
        const elencoProssime = computed(() => prossime());
        const conteggi = computed(() => ({
            scaduti: elencoAvvisi.value.filter(a => a.gravita === 'scaduto').length,
            inScadenza: elencoAvvisi.value.filter(a => a.gravita === 'inScadenza' || a.gravita === 'inCorso').length
        }));
        const sezioni = computed(() => db.sezioni.slice().sort((a, b) => a.ordine - b.ordine));
        return {
            db, sezioni, elencoAvvisi, elencoProssime, conteggi, apriDaElenco,
            selezionata: pagina => nav.largo && stessaPagina(pila()[0], pagina),
            riepilogoSistema(s) {
                const n = operazioniDi(s).length;
                return n === 0 ? 'Nessuna operazione' : n === 1 ? '1 operazione' : `${n} operazioni`;
            },
            avvisiSistema: s => elencoAvvisi.value.filter(a => a.sezione_id === s.id).length
        };
    }
};

// ---------------------------------------------------------------------
// Pagina di un sistema
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

export const Sistema = {
    components: { RigaAvviso },
    props: { id: String },
    template: `
      <Pagina v-if="sezione" :titolo="sezione.nome">
        <template #azioni>
          <button v-if="puoModificare()" class="pulsante-barra" @click="nuova = { titolo: '' }" aria-label="Nuova operazione"><Icona nome="piu"/></button>
        </template>
        <Gruppo v-if="elencoAvvisi.length" titolo="Avvisi">
          <RigaAvviso v-for="a in elencoAvvisi" :key="a.id" :avviso="a" @apri="apri"/>
        </Gruppo>
        <Gruppo titolo="Operazioni">
          <Riga v-if="!operazioni.length" titolo="Nessuna operazione per questo sistema" class="secondario"/>
          <Riga v-for="o in operazioni" :key="o.id" :icona="tipo(o).icona" quadrata :colore="coloreOperazione(o)"
                :titolo="o.titolo" :sottotitolo="riepilogoOperazione(o)" freccia @click="apri({ nome: 'operazione', id: o.id })"/>
        </Gruppo>
        <Gruppo v-if="contratti.length" titolo="Contratti">
          <RigaContratto v-for="c in contratti" :key="c.id" :contratto="c" @click="apri({ nome: 'contratto', id: c.id })"/>
        </Gruppo>
        <Gruppo>
          <Riga icona="qr" titolo="Codice QR da stampare" sottotitolo="Da attaccare vicino all'impianto per aprire subito questa pagina"
                freccia @click="apri({ nome: 'codiciQR', id: sezione.id })"/>
        </Gruppo>

        <Foglio v-if="nuova" titolo="Nuova operazione" :conferma-disabilitata="!nuova.titolo.trim()"
                @annulla="nuova = null" @conferma="creaOperazione">
          <Gruppo nota="Un'operazione con descrizione, passaggi, note e collegamento al manuale.">
            <CampoTesto v-model="nuova.titolo" segnaposto="Titolo (es. Controllo filtri)"/>
          </Gruppo>
        </Foglio>
      </Pagina>
      <PaginaMancante v-else/>`,
    data() { return { nuova: null }; },
    computed: {
        sezione() { return sezioneDi(this.id); },
        operazioni() { return this.sezione ? operazioniDi(this.sezione) : []; },
        elencoAvvisi() { return this.sezione ? avvisi({ sezione: this.sezione }) : []; },
        contratti() { return db.contratti.filter(c => c.sezione_id === this.id); }
    },
    methods: {
        apri, puoModificare, riepilogoOperazione,
        tipo: o => TIPI_OPERAZIONE[o.tipo] ?? TIPI_OPERAZIONE.generica,
        coloreOperazione(o) {
            const s = statoOperazione(o);
            if (s === 'scaduta') return 'var(--rosso)';
            if (s === 'inScadenza') return 'var(--arancione)';
            if (o.tipo === 'cambioAcqua' && db.processi_acqua.some(p => !p.fine)) return 'var(--blu)';
            return COLORE_SEZIONE[this.sezione.icona] ?? 'var(--accento)';
        },
        async creaOperazione() {
            const ordine = Math.max(-1, ...this.operazioni.map(o => o.ordine)) + 1;
            const o = await salva('operazioni', { sezione_id: this.id, titolo: this.nuova.titolo.trim(), tipo: 'generica', ordine });
            this.nuova = null;
            apri({ nome: 'operazione', id: o.id });
        }
    }
};

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
        <template #fine><BadgeScadenza v-if="contratto.scadenza" :data="contratto.scadenza" :stato="stato"/></template>
      </Riga>`,
    computed: {
        dettaglio() {
            const fornitore = db.contatti.find(c => c.id === this.contratto.fornitore_id);
            return [fornitore && nomeContatto(fornitore), sezioneDi(this.contratto.sezione_id)?.nome].filter(Boolean).join(' · ');
        },
        stato() { return statoScadenza(this.contratto.scadenza, this.contratto.preavviso_giorni); }
    }
};

export const Contratti = {
    components: { RigaContratto },
    template: `
      <Pagina titolo="Contratti">
        <template #azioni>
          <button v-if="puoModificare()" class="pulsante-barra" @click="nuovo = true" aria-label="Nuovo contratto"><Icona nome="piu"/></button>
        </template>
        <Vuoto v-if="!contratti.length" icona="documento" titolo="Nessun contratto" testo="Aggiungi i contratti di manutenzione degli impianti."/>
        <Gruppo v-else>
          <RigaContratto v-for="c in contratti" :key="c.id" :contratto="c" @click="apri({ nome: 'contratto', id: c.id })"/>
          <Riga titolo="Totale annuo" :valore="f.euro(totale)"/>
        </Gruppo>
        <ContrattoFoglio v-if="nuovo" @chiudi="nuovo = false"/>
      </Pagina>`,
    data() { return { nuovo: false }; },
    computed: {
        contratti() { return db.contratti.slice().sort((a, b) => a.titolo.localeCompare(b.titolo)); },
        totale() { return this.contratti.reduce((s, c) => s + (Number(c.costo_annuo) || 0), 0); }
    },
    methods: { apri, puoModificare },
    setup() { return { f }; }
};

export const ContrattoPagina = {
    props: { id: String },
    template: `
      <Pagina v-if="contratto" :titolo="contratto.titolo">
        <template #azioni>
          <button v-if="puoModificare()" class="pulsante-barra" @click="modifica = true">Modifica</button>
        </template>
        <Gruppo>
          <Riga v-if="contratto.numero" titolo="Numero" :valore="contratto.numero"/>
          <Riga v-if="contratto.inizio" titolo="Inizio" :valore="f.data(contratto.inizio)"/>
          <Riga v-if="contratto.scadenza" titolo="Scadenza">
            <template #fine><BadgeScadenza :data="contratto.scadenza" :stato="stato"/></template>
          </Riga>
          <Riga titolo="Rinnovo automatico" :valore="contratto.rinnovo_automatico ? 'Sì' : 'No'"/>
          <Riga v-if="contratto.costo_annuo" titolo="Costo annuo" :valore="f.euro(contratto.costo_annuo)"/>
          <Riga v-if="sezione" titolo="Sistema" :valore="sezione.nome"/>
        </Gruppo>
        <Gruppo v-if="fornitore" titolo="Fornitore">
          <Riga icona="persona" :titolo="nomeContatto(fornitore)" freccia @click="apriContatto"/>
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
        fornitore() { return db.contatti.find(c => c.id === this.contratto?.fornitore_id); },
        stato() { return statoScadenza(this.contratto.scadenza, this.contratto.preavviso_giorni); }
    },
    methods: {
        puoModificare, nomeContatto,
        async apriAllegato() { window.open(await urlFile(this.contratto.allegato), '_blank'); },
        apriContatto() { nav.scheda = 'contatti'; apriDaElenco({ nome: 'contatto', id: this.fornitore.id }); }
    },
    setup() { return { f }; }
};

export const ContrattoFoglio = {
    props: { contratto: Object, sezioneId: String },
    emits: ['chiudi'],
    template: `
      <Foglio :titolo="contratto ? 'Modifica contratto' : 'Nuovo contratto'" :conferma-disabilitata="!b.titolo.trim()"
              @annulla="$emit('chiudi')" @conferma="salvaContratto">
        <Gruppo>
          <CampoTesto v-model="b.titolo" segnaposto="Titolo (es. Assistenza caldaia)"/>
          <CampoTesto v-model="b.numero" etichetta="Numero"/>
          <CampoScelta v-model="b.fornitore_id" etichetta="Fornitore" :opzioni="opzioniContatti"/>
          <CampoScelta v-model="b.sezione_id" etichetta="Sistema" :opzioni="opzioniSezioni"/>
        </Gruppo>
        <Gruppo titolo="Durata">
          <CampoData v-model="b.inizio" etichetta="Inizio"/>
          <CampoData v-model="b.scadenza" etichetta="Scadenza"/>
          <Passo v-model="b.preavviso_giorni" :min="0" :max="180" :passo="5">Avvisa {{ b.preavviso_giorni }} giorni prima</Passo>
          <Interruttore v-model="b.rinnovo_automatico" etichetta="Rinnovo automatico"/>
        </Gruppo>
        <Gruppo titolo="Costi"><CampoNumero v-model="b.costo_annuo" etichetta="Costo annuo" unita="€"/></Gruppo>
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
                titolo: c.titolo ?? '', numero: c.numero ?? '', fornitore_id: c.fornitore_id ?? null,
                sezione_id: c.sezione_id ?? this.sezioneId ?? null, inizio: c.inizio ?? f.oggiISO(),
                scadenza: c.scadenza ?? null, preavviso_giorni: c.preavviso_giorni ?? 30,
                rinnovo_automatico: c.rinnovo_automatico ?? false, costo_annuo: c.costo_annuo ?? null,
                note: c.note ?? '', allegato: c.allegato ?? '', nome_allegato: c.nome_allegato ?? ''
            }
        };
    },
    computed: {
        opzioniContatti() {
            return [{ valore: null, nome: 'Nessuno' },
                ...db.contatti.map(c => ({ valore: c.id, nome: nomeContatto(c) })).sort((a, b) => a.nome.localeCompare(b.nome))];
        },
        opzioniSezioni() {
            return [{ valore: null, nome: 'Nessuno' }, ...db.sezioni.slice().sort((a, b) => a.ordine - b.ordine).map(s => ({ valore: s.id, nome: s.nome }))];
        }
    },
    methods: {
        scegliFile(e) { this.file = e.target.files[0]; if (this.file) { this.b.nome_allegato = this.file.name; this.b.allegato = 'nuovo'; } },
        async salvaContratto() {
            const record = { ...this.b, id: this.contratto?.id, costo_annuo: this.b.costo_annuo ?? 0 };
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
    }
};

// ---------------------------------------------------------------------
// Prodotti a scorta
// ---------------------------------------------------------------------
/// Riga di catalogo: nome, codice, stato e confezioni (le scorte si gestiscono nelle operazioni).
export const RigaProdotto = {
    props: { prodotto: Object, conOperazione: Boolean },
    template: `<Riga icona="scatola" :titolo="prodotto.nome" :sottotitolo="sottotitolo" freccia/>`,
    computed: {
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
            const prodotti = db.prodotti.filter(p => !testo || [p.nome, p.codice, p.fornitore].some(v => (v ?? '').toLowerCase().includes(testo)))
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
          <Riga titolo="Fornitore" :valore="prodotto.fornitore || '–'" :sottotitolo="prodotto.fornitore_link"
                :freccia="!!prodotto.fornitore_link" @click="prodotto.fornitore_link && apriSito()"/>
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
        confezioni() { return descriviFormati(this.prodotto); }
    },
    methods: {
        puoModificare,
        apriSito() {
            const link = this.prodotto.fornitore_link;
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
      <Gruppo :titolo="'Scorta · ' + prodotto.nome">
        <div class="valore-grande">
          <div class="etichetta">Giacenza attuale</div>
          <div class="numero" :class="{ rosso: basso }">{{ f.quantita(a.giacenza, prodotto.unita) }}</div>
          <div v-if="basso" class="arancione-t" style="font-size:14px">Sotto la scorta minima ({{ f.quantita(prodotto.scorta_minima, prodotto.unita) }})</div>
        </div>
        <Riga v-for="c in a.confezioni" :key="c.litri" :titolo="maiuscola(nomeConfezione(prodotto, 2)) + ' da ' + f.quantita(c.litri, prodotto.unita)"
              :valore="String(c.numero)"/>
        <Riga v-if="a.ultimoMovimento" titolo="Ultimo movimento" :valore="f.data(a.ultimoMovimento)"/>
        <template v-if="previsioni">
          <Riga v-if="a.consumoMensile" titolo="Consumo medio" :sottotitolo="a.consumoImpostato ? 'impostato' : 'calcolato dai riempimenti'"
                :valore="f.quantita(a.consumoMensile, prodotto.unita) + ' al mese'"/>
          <Riga v-if="a.autonomia !== null" titolo="Autonomia" :valore="a.autonomia + ' giorni (fino al ' + f.dataBreve(a.esaurimento) + ')'"/>
        </template>
        <Riga titolo="Totale acquistato" :valore="f.quantita(a.acquistato, prodotto.unita)"/>
        <Riga titolo="Totale consumato" :valore="f.quantita(a.consumato, prodotto.unita)"/>
        <Riga v-if="a.costo" titolo="Spesa totale" :valore="f.euro(a.costo)"/>
        <Riga v-if="a.costoMedio" titolo="Costo medio" :valore="f.euro(a.costoMedio) + ' / ' + prodotto.unita"/>
        <CampoNumero v-if="previsioni && puoModificare()" etichetta="Consumo previsto" :unita="prodotto.unita + '/mese'"
                     :model-value="prodotto.consumo_mensile ?? null" segnaposto="dai consumi"
                     @fine="v => salva('prodotti', { ...prodotto, consumo_mensile: v > 0 ? v : null })"/>
      </Gruppo>
      <Azioni v-if="puoModificare()" :voci="azioni" @scegli="t => movimento = { tipo: t }"/>
      <Gruppo v-if="conGrafici && a.andamento.length > 1" titolo="Andamento giacenza"
              :nota="Number(prodotto.scorta_minima) > 0 ? 'La linea tratteggiata è la scorta minima.' : ''">
        <Grafico :serie="[{ nome: 'Giacenza', colore: 'var(--accento)', punti: a.andamento.map(p => ({ x: f.giorno(p.data), y: p.valore })) }]"
                 :riferimento="Number(prodotto.scorta_minima) > 0 ? Number(prodotto.scorta_minima) : null"
                 :gradini="movimenti.some(m => m.tipo === 'consumo')"/>
      </Gruppo>
      <Gruppo v-if="conGrafici && consumiMensili.length > 1" :titolo="nomeMovimento('consumo', prodotto.categoria) + ' per mese'">
        <Grafico :serie="[{ nome: 'Consumo', colore: 'var(--arancione)', punti: consumiMensili }]"/>
      </Gruppo>
      <Gruppo :titolo="'Acquisti e ' + nomeMovimento('consumo', prodotto.categoria).toLowerCase()">
        <Riga v-if="!movimenti.length" titolo="Nessun movimento registrato" class="secondario"/>
        <Riga v-for="m in movimenti" :key="m.id" :icona="icona(m.tipo)" :colore="colore(m.tipo)"
              :titolo="nomeMovimento(m.tipo, prodotto.categoria)" :sottotitolo="sottotitolo(m)"
              @click="puoModificare() && (movimento = { tipo: m.tipo, voce: m })">
          <template #fine>
            <span class="riga-valore">{{ segno(m.tipo) }}{{ f.quantita(m.quantita, prodotto.unita) }}<br v-if="m.costo">
              <small v-if="m.costo" class="secondario">{{ f.euro(m.costo) }}</small></span>
          </template>
        </Riga>
      </Gruppo>
      <MovimentoFoglio v-if="movimento" :prodotto="prodotto" :tipo="movimento.tipo" :movimento="movimento.voce" @chiudi="movimento = null"/>`,
    data() { return { movimento: null }; },
    computed: {
        a() { return analisiScorta(this.prodotto); },
        basso() { return sottoScorta(this.prodotto); },
        previsioni() { return mostraPrevisioni(this.prodotto); },
        movimenti() { return movimentiDi(this.prodotto); },
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
      <Gruppo v-if="documenti.length || puoModificare()" :titolo="'Schede tecniche · ' + prodotto.nome"
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
    props: { prodotto: Object, tipo: String, movimento: Object },
    emits: ['chiudi'],
    template: `
      <Foglio :titolo="nomeMovimento(tipo, prodotto.categoria)" :conferma-disabilitata="quantitaFinale === null"
              @annulla="$emit('chiudi')" @conferma="salvaMovimento">
        <Gruppo :nota="nota">
          <CampoData v-model="b.data" etichetta="Data"/>
          <CampoTesto v-if="tipo === 'acquisto'" v-model="b.descrizione_prodotto" segnaposto="Prodotto acquistato (nome, marca)"/>
        </Gruppo>
        <Gruppo v-if="formati.length" :titolo="maiuscola(nomeConfezione(prodotto, 2))" :nota="notaConfezioni">
          <Passo v-for="litri in formati" :key="litri" v-model="b.numeri[litri]" :min="0">
            Da {{ f.quantita(litri, prodotto.unita) }}<br>
            <small class="secondario">{{ b.numeri[litri] }} {{ nomeConfezione(prodotto, b.numeri[litri]) }}</small>
          </Passo>
        </Gruppo>
        <Gruppo>
          <Riga v-if="conConfezioni" :titolo="etichettaQuantita" :valore="f.quantita(quantitaFinale, prodotto.unita)" style="font-weight:600"/>
          <CampoNumero v-else v-model="b.quantita" :etichetta="etichettaQuantita" :unita="prodotto.unita"/>
        </Gruppo>
        <Gruppo v-if="tipo === 'acquisto'" titolo="Acquisto">
          <template v-if="conConfezioni">
            <CampoNumero v-for="litri in formatiUsati" :key="litri" v-model="b.prezzi[litri]"
                         :etichetta="'Costo ' + nomeConfezione(prodotto, 1) + ' da ' + f.quantita(litri, prodotto.unita)" unita="€"/>
          </template>
          <CampoNumero v-else v-model="b.prezzo" :etichetta="'Costo al ' + prodotto.unita + (b.iva ? ' (IVA esclusa)' : '')" unita="€"/>
          <CampoNumero v-model="b.iva" etichetta="IVA" unita="%" segnaposto="inclusa"/>
          <Riga v-if="b.iva" titolo="IVA in euro" :valore="f.euro(totale - imponibile)"/>
          <Riga titolo="Costo totale" :valore="f.euro(totale)" style="font-weight:600"/>
          <CampoTesto v-model="b.fornitore" segnaposto="Fornitore"/>
        </Gruppo>
        <Gruppo v-if="tipo === 'acquisto' && prodotto.categoria === 'pellet'" titolo="Deposito"
                nota="Facoltativo: pellet presente nel silo prima del carico (lo indica il pannello della caldaia). Serve a calcolare consumo e autonomia.">
          <CampoNumero v-model="b.precarico" etichetta="Prima del carico" :unita="prodotto.unita"/>
          <Riga v-if="b.precarico !== null" titolo="Dopo il carico" :valore="f.quantita(b.precarico + (quantitaFinale || 0), prodotto.unita)"/>
        </Gruppo>
        <Gruppo titolo="Note"><CampoTesto v-model="b.note" multilinea segnaposto="Note"/></Gruppo>
        <Gruppo v-if="movimento"><Riga distruttiva titolo="Elimina" @click="eliminaMovimento"/></Gruppo>
      </Foglio>`,
    data() {
        const m = this.movimento ?? {};
        const numeri = {}, prezzi = {};
        for (const litri of formatiDi(this.prodotto)) {
            const c = (m.confezioni ?? []).find(c => Number(c.litri) === litri);
            numeri[litri] = Number(c?.numero) || 0;
            prezzi[litri] = c?.prezzo ?? null;
        }
        const conConfezioni = Object.values(numeri).some(n => n > 0);
        // IVA: quella del movimento, altrimenti quella dell'ultimo acquisto dello stesso prodotto.
        const precedente = movimentiDi(this.prodotto).find(x => x.tipo === 'acquisto' && x.dettagli?.iva_percentuale != null);
        const iva = m.id ? (m.dettagli?.iva_percentuale ?? null) : (precedente?.dettagli.iva_percentuale ?? null);
        return { b: {
            iva, precarico: m.dettagli?.precarico ?? null,
            data: m.data ?? f.oggiISO(), quantita: m.quantita ?? null, fornitore: m.fornitore ?? (this.prodotto.fornitore || ''),
            descrizione_prodotto: m.descrizione_prodotto ?? '', note: m.note ?? '', numeri, prezzi,
            prezzo: !conConfezioni && m.costo && m.quantita
                ? (m.dettagli?.prezzo_unitario ?? m.costo / m.quantita / (1 + (Number(iva) || 0) / 100)) : null
        } };
    },
    computed: {
        formati() { return formatiDi(this.prodotto); },
        formatiUsati() { return this.formati.filter(l => this.b.numeri[l] > 0); },
        conConfezioni() { return this.formatiUsati.length > 0; },
        /// Con le confezioni la quantità è la loro somma, altrimenti quella scritta a mano.
        quantitaFinale() {
            return this.conConfezioni ? this.formati.reduce((t, l) => t + l * this.b.numeri[l], 0) : this.b.quantita;
        },
        /// Costo IVA esclusa (se l'IVA è vuota i prezzi si intendono IVA inclusa).
        imponibile() {
            if (this.conConfezioni) return this.formatiUsati.reduce((t, l) => t + this.b.numeri[l] * (this.b.prezzi[l] || 0), 0);
            return (this.b.quantita || 0) * (this.b.prezzo || 0);
        },
        totale() { return this.imponibile * (1 + (Number(this.b.iva) || 0) / 100); },
        etichettaQuantita() { return this.tipo === 'rettifica' ? 'Quantità presente' : 'Quantità'; },
        notaConfezioni() {
            const nome = nomeConfezione(this.prodotto, 2);
            if (this.tipo === 'rettifica') return `Quante ${nome} ci sono adesso. Se ne resta una aperta, lasciale a zero e scrivi la quantità a mano.`;
            return `La quantità si calcola dalle ${nome}. Lasciale a zero per scriverla a mano (es. una ${nomeConfezione(this.prodotto, 1)} usata a metà).`;
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
        nomeMovimento, nomeConfezione,
        maiuscola: t => t.charAt(0).toUpperCase() + t.slice(1),
        async salvaMovimento() {
            const acquisto = this.tipo === 'acquisto';
            // La rettifica registra tutti i formati (anche a zero): fissa il conteggio delle confezioni.
            const formati = this.tipo === 'rettifica' ? this.formati : this.formatiUsati;
            const confezioni = formati.map(litri => ({
                litri, numero: this.b.numeri[litri],
                ...(acquisto && this.b.prezzi[litri] !== null ? { prezzo: this.b.prezzi[litri] } : {})
            }));
            await salva('movimenti', {
                id: this.movimento?.id, prodotto_id: this.prodotto.id, tipo: this.tipo, data: this.b.data,
                quantita: this.quantitaFinale, costo: acquisto ? this.totale : 0, fornitore: acquisto ? this.b.fornitore : '',
                descrizione_prodotto: acquisto ? this.b.descrizione_prodotto : '', note: this.b.note, confezioni,
                dettagli: acquisto ? {
                    ...(this.movimento?.dettagli ?? {}),
                    prezzo_unitario: this.conConfezioni ? null : this.b.prezzo, iva_percentuale: this.b.iva, precarico: this.b.precarico
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
        <Gruppo titolo="Prodotto" :nota="'Confezioni: formati in cui si compra, separati da virgola (5, 1 = taniche da 5 e da 1 ' + (b.unita || 'unità') + '). Negli acquisti e nei consumi si indica il numero di confezioni. Vuoto se è sfuso.'">
          <CampoScelta v-model="b.stato" etichetta="Stato" :opzioni="stati"/>
          <CampoTesto v-model="b.unita" etichetta="Unità di misura" segnaposto="kg, l, pz…"/>
          <CampoTesto v-model="b.formati" etichetta="Confezioni da" :segnaposto="'es. 5, 1 (' + (b.unita || 'unità') + ')'"/>
        </Gruppo>
        <Gruppo titolo="Fornitore">
          <CampoTesto v-model="b.fornitore" segnaposto="Nome fornitore"/>
          <CampoTesto v-model="b.fornitore_link" segnaposto="Sito (es. https://www.gecostore.it)" tipo="url"/>
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
            nome: p.nome ?? '', codice: p.codice ?? '', stato: p.stato ?? '', unita: p.unita ?? 'kg',
            operazione_id: p.operazione_id ?? operazioneDiProdotto(p)?.id ?? this.operazioneId ?? null,
            fornitore: p.fornitore ?? '', fornitore_link: p.fornitore_link ?? '',
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
                categoria: categoriaPerOperazione(operazione),
                fornitore_link: campi.fornitore_link.trim(),
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
