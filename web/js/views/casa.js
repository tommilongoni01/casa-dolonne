// Casa: home con tutti gli impianti (come l'app Casa di Apple) e pagina di ogni impianto
// con operazioni, manuale (guide e documenti) e contatti.
import { computed } from 'vue';
import { db, salva, elimina, caricaFile, puoModificare } from '../store.js';
import { nav, pila, apri, apriDaElenco, stessaPagina, cambiaScheda } from '../nav.js';
import * as f from '../format.js';
import { COLORE_SEZIONE, ICONE_SEZIONE } from '../icone.js';
import {
    avvisi, prossime, operazioniDi, statoOperazione, TIPI_OPERAZIONE, sezioneDi, nomeContatto, sottotitoloContatto, calendarioScadenze,
    iconaOperazione, coloreImpianto, vociCosto, anniCosti, totale
} from '../logic.js';
import { riassuntoImpianto, riepilogoOperazione, TesseraImpianto, RigaAvviso } from './manutenzione.js';
import { ContattoFoglio } from './contatti.js';

const ordinaTitoli = (a, b) => a.titolo.localeCompare(b.titolo, 'it', { numeric: true });
const testoDaHtml = html => new DOMParser().parseFromString(html ?? '', 'text/html').body.textContent ?? '';

// ---------------------------------------------------------------------
// Dashboard: stato, avvisi e calendario
// ---------------------------------------------------------------------
const GIORNO_MS = 86_400_000;
const chiaveGiorno = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/// "Oggi", "Domani", "Ieri", "Lun 24 nov"
function nomeGiorno(d) {
    const oggi = f.giorno(new Date()), diff = Math.round((d - oggi) / GIORNO_MS);
    if (diff === 0) return 'Oggi';
    if (diff === 1) return 'Domani';
    if (diff === -1) return 'Ieri';
    const testo = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short',
        year: d.getFullYear() === oggi.getFullYear() ? undefined : 'numeric' }).format(d);
    return testo.charAt(0).toUpperCase() + testo.slice(1);
}

/// Riquadro grande in cima: lo stato della casa in una frase, come nell'app Casa di Apple.
const SchedaStato = {
    props: { avvisi: Array, prossima: Object },
    template: `
      <div class="scheda-stato" :class="'stato-' + stato">
        <span class="scheda-stato-icona"><Icona :nome="icona" :dimensione="30"/></span>
        <span class="scheda-stato-testi">
          <span class="scheda-stato-titolo">{{ titolo }}</span>
          <span class="scheda-stato-dettaglio">{{ dettaglio }}</span>
        </span>
      </div>`,
    computed: {
        conteggio() {
            const n = g => this.avvisi.filter(a => g.includes(a.gravita)).length;
            return { scaduti: n(['scaduto']), inScadenza: n(['inScadenza']), inCorso: n(['inCorso']) };
        },
        stato() { return this.conteggio.scaduti ? 'scaduto' : this.conteggio.inScadenza || this.conteggio.inCorso ? 'inScadenza' : 'ok'; },
        icona() { return { scaduto: 'avviso', inScadenza: 'orologio', ok: 'sigillo' }[this.stato]; },
        titolo() {
            const { scaduti, inScadenza, inCorso } = this.conteggio;
            if (scaduti) return scaduti === 1 ? '1 cosa da fare' : `${scaduti} cose da fare`;
            if (inScadenza) return inScadenza === 1 ? '1 scadenza vicina' : `${inScadenza} scadenze vicine`;
            if (inCorso) return 'Operazione in corso';
            return 'Tutto in regola';
        },
        dettaglio() {
            const altri = [];
            if (this.conteggio.scaduti && this.conteggio.inScadenza) altri.push(`${this.conteggio.inScadenza} in scadenza`);
            if (this.prossima) altri.push(`Prossimo: ${this.prossima.titolo} · ${nomeGiorno(this.prossima.data).toLowerCase()}`);
            return altri.join(' · ') || 'Nessuna scadenza in programma';
        }
    }
};

/// Avviso come scheda (in fila orizzontale su iPhone, in griglia su schermi larghi).
const SchedaAvviso = {
    props: { avviso: Object },
    emits: ['apri'],
    template: `
      <button class="scheda-avviso" :class="'gravita-' + avviso.gravita" @click="$emit('apri', avviso.pagina)">
        <span class="scheda-avviso-testa">
          <IconaQuadrata :nome="sezione?.icona ?? avviso.icona" :dimensione="28"/>
          <span class="scheda-avviso-sistema">{{ sezione?.nome ?? '' }}</span>
          <Cronometro v-if="avviso.gravita === 'inCorso'" :da="avviso.data" class="scheda-avviso-quando"/>
          <span v-else-if="avviso.data" class="scheda-avviso-quando">{{ quando }}</span>
        </span>
        <span class="scheda-avviso-titolo">{{ titolo }}</span>
        <span class="scheda-avviso-dettaglio">{{ avviso.dettaglio }}</span>
      </button>`,
    computed: {
        sezione() { return sezioneDi(this.avviso.sezione_id); },
        /// Senza il nome dell'impianto, già scritto in alto nella scheda.
        titolo() {
            const nome = this.sezione?.nome;
            return nome ? this.avviso.titolo.replace(` · ${nome}`, '').replace(new RegExp(` ${nome}$`), '') : this.avviso.titolo;
        },
        quando() {
            const giorni = Math.round((f.giorno(this.avviso.data) - f.giorno(new Date())) / GIORNO_MS);
            if (giorni < 0) return giorni === -1 ? 'da ieri' : `da ${-giorni} giorni`;
            return giorni === 0 ? 'oggi' : giorni === 1 ? 'domani' : `tra ${giorni} giorni`;
        }
    }
};

/// Calendario del mese con i pallini sulle scadenze e, sotto, l'agenda (del giorno scelto o dei prossimi giorni).
const CalendarioCasa = {
    components: { RigaAvviso },
    props: { voci: Array },
    emits: ['apri'],
    template: `
      <section class="gruppo calendario-casa">
        <h3 class="gruppo-titolo calendario-agenda-titolo" style="margin-top:0">
          {{ scelto ? nomeGiorno(dataScelta) : 'Prossimi interventi' }}
          <button v-if="scelto" type="button" class="pulsante-testo" @click="scelto = null">Mostra i prossimi</button>
        </h3>
        <div class="gruppo-celle">
          <Riga v-if="!agenda.length" :titolo="scelto ? 'Niente in programma' : 'Nessuna scadenza in programma'" class="secondario"/>
          <template v-for="g in agenda" :key="g.chiave">
            <div v-if="!scelto" class="agenda-giorno">{{ nomeGiorno(g.data) }}</div>
            <RigaAvviso v-for="v in g.voci" :key="v.id" :avviso="v" @apri="p => $emit('apri', p)"/>
          </template>
        </div>
        <div class="calendario-testa" style="margin-top:18px">
          <h3 class="gruppo-titolo" style="margin:0">{{ titoloMese }}</h3>
          <span class="calendario-frecce">
            <button v-if="!meseCorrente" type="button" class="pulsante-testo" @click="vaiOggi">Oggi</button>
            <button type="button" class="pulsante-barra" @click="sposta(-1)" aria-label="Mese precedente"><Icona nome="indietro" :dimensione="18"/></button>
            <button type="button" class="pulsante-barra" @click="sposta(1)" aria-label="Mese successivo"><Icona nome="avanti" :dimensione="18"/></button>
          </span>
        </div>
        <div class="gruppo-celle calendario-corpo">
          <div class="calendario-griglia">
            <span v-for="g in ['L', 'M', 'M', 'G', 'V', 'S', 'D']" class="calendario-settimana">{{ g }}</span>
            <button v-for="c in celle" :key="c.chiave" type="button" class="calendario-giorno"
                    :class="{ fuori: !c.delMese, oggi: c.oggi, scelto: c.chiave === scelto }" @click="scegli(c)">
              <span class="calendario-numero">{{ c.data.getDate() }}</span>
              <span class="calendario-pallini"><i v-for="v in c.voci.slice(0, 3)" :key="v.id" :class="'gravita-' + v.gravita"></i></span>
            </button>
          </div>
        </div>
      </section>`,
    data() { const oggi = new Date(); return { mese: new Date(oggi.getFullYear(), oggi.getMonth(), 1), scelto: null }; },
    computed: {
        perGiorno() {
            const mappa = {};
            for (const v of this.voci) (mappa[chiaveGiorno(v.data)] ??= []).push(v);
            return mappa;
        },
        titoloMese() {
            const t = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(this.mese);
            return t.charAt(0).toUpperCase() + t.slice(1);
        },
        meseCorrente() { const o = new Date(); return this.mese.getMonth() === o.getMonth() && this.mese.getFullYear() === o.getFullYear(); },
        /// 6 settimane da lunedì, con i giorni dei mesi vicini in grigio.
        celle() {
            const inizio = new Date(this.mese), scarto = (inizio.getDay() + 6) % 7;
            inizio.setDate(1 - scarto);
            const oggi = chiaveGiorno(new Date());
            return Array.from({ length: 42 }, (_, i) => {
                const data = new Date(inizio.getFullYear(), inizio.getMonth(), inizio.getDate() + i), chiave = chiaveGiorno(data);
                return { data, chiave, delMese: data.getMonth() === this.mese.getMonth(), oggi: chiave === oggi, voci: this.perGiorno[chiave] ?? [] };
            });
        },
        dataScelta() { return this.celle.find(c => c.chiave === this.scelto)?.data ?? null; },
        /// Giorno scelto, oppure le prossime scadenze (comprese quelle in ritardo) raggruppate per giorno.
        agenda() {
            if (this.scelto) return [{ chiave: this.scelto, data: this.dataScelta, voci: this.perGiorno[this.scelto] ?? [] }];
            const oggi = f.giorno(new Date());
            const voci = this.voci.filter(v => v.data >= oggi || v.gravita === 'scaduto').slice(0, 8);
            const gruppi = [];
            for (const v of voci) {
                const chiave = chiaveGiorno(v.data);
                if (gruppi.at(-1)?.chiave === chiave) gruppi.at(-1).voci.push(v); else gruppi.push({ chiave, data: v.data, voci: [v] });
            }
            return gruppi;
        }
    },
    methods: {
        nomeGiorno,
        sposta(d) { this.mese = new Date(this.mese.getFullYear(), this.mese.getMonth() + d, 1); },
        vaiOggi() { const o = new Date(); this.mese = new Date(o.getFullYear(), o.getMonth(), 1); this.scelto = null; },
        scegli(c) {
            this.scelto = this.scelto === c.chiave ? null : c.chiave;
            if (!c.delMese) this.mese = new Date(c.data.getFullYear(), c.data.getMonth(), 1);
        }
    }
};

// ---------------------------------------------------------------------
// Costi della casa e degli impianti
// ---------------------------------------------------------------------
const NOMI_VOCE = { contratti: 'Contratti', interventi: 'Interventi', prodotti: 'Prodotti acquistati' };

export const CostiPagina = {
    components: { RigaAvviso },
    props: { id: String },
    template: `
      <Pagina :titolo="sezione ? 'Costi · ' + sezione.nome : 'Costi della casa'">
        <div class="segmenti segmenti-anni">
          <button v-for="a in anni" :key="a" :class="{ attivo: a === anno }" @click="anno = a">{{ a }}</button>
        </div>
        <div class="valore-grande totale-costi">
          <div class="etichetta">{{ sezione ? 'Spesa per ' + sezione.nome : 'Spesa totale della casa' }} nel {{ anno }}</div>
          <div class="numero">{{ f.euro(totale(voci)) }}</div>
        </div>

        <Gruppo titolo="Per voce" nota="I contratti pluriennali sono divisi per anno; i prodotti contano nell'anno in cui li compri." nota-sempre>
          <Riga v-for="t in tipi" :key="t" :titolo="NOMI_VOCE[t]" :valore="f.euro(totale(voci.filter(v => v.tipo === t)))"/>
        </Gruppo>

        <Gruppo v-if="!sezione" titolo="Per impianto">
          <Riga v-if="!perImpianto.length" titolo="Nessun costo in questo anno" class="secondario"/>
          <Riga v-for="g in perImpianto" :key="g.id" :icona="g.icona" quadrata :titolo="g.nome" :sottotitolo="g.dettaglio"
                :valore="f.euro(g.totale)" :freccia="g.id !== 'nessuno'" @click="g.id !== 'nessuno' && apri({ nome: 'costi', id: g.id })"/>
        </Gruppo>

        <Gruppo v-if="andamento.length > 1" titolo="Negli anni">
          <Grafico :serie="[{ nome: 'Spesa', colore: 'var(--accento)', punti: andamento }]" :formato-y="v => f.euro(v).replace(',00', '')" valori per-anno/>
        </Gruppo>

        <Gruppo :titolo="'Spese del ' + anno">
          <Riga v-if="!voci.length" titolo="Nessuna spesa registrata" class="secondario"/>
          <Riga v-for="v in (tutte ? voci : voci.slice(0, 5))" :key="v.id" :icona="ICONE_VOCE[v.tipo]" :titolo="v.titolo"
                :sottotitolo="[v.data ? f.dataBreve(v.data) : '', sezione ? '' : nomeImpianto(v.sezione_id), v.dettaglio].filter(Boolean).join(' · ')"
                :valore="f.euro(v.importo)" :freccia="!!v.pagina" @click="v.pagina && apri(v.pagina)"/>
          <Riga v-if="voci.length > 5" azione :icona="tutte ? 'frecciaSu' : 'frecciaGiu'" :titolo="tutte ? 'Mostra meno' : 'Mostra tutte (' + voci.length + ')'" @click="tutte = !tutte"/>
        </Gruppo>
      </Pagina>`,
    data() { return { anno: new Date().getFullYear(), tutte: false, NOMI_VOCE, tipi: ['contratti', 'interventi', 'prodotti'],
                      ICONE_VOCE: { contratti: 'documento', interventi: 'chiave', prodotti: 'carrello' } }; },
    computed: {
        sezione() { return this.id ? sezioneDi(this.id) : null; },
        anni() { return anniCosti(); },
        voci() { const v = vociCosto(this.anno); return this.sezione ? v.filter(x => x.sezione_id === this.sezione.id) : v; },
        perImpianto() {
            const gruppi = db.sezioni.slice().sort((a, b) => a.ordine - b.ordine).map(s => ({ id: s.id, nome: s.nome, icona: s.icona, voci: this.voci.filter(v => v.sezione_id === s.id) }));
            gruppi.push({ id: 'nessuno', nome: 'Senza impianto', icona: 'lista', voci: this.voci.filter(v => !sezioneDi(v.sezione_id)) });
            return gruppi.filter(g => g.voci.length).map(g => ({
                ...g, totale: totale(g.voci),
                dettaglio: this.tipi.map(t => [t, totale(g.voci.filter(v => v.tipo === t))]).filter(([, x]) => x > 0)
                    .map(([t, x]) => `${NOMI_VOCE[t].split(' ')[0]} ${f.euro(x)}`).join(' · ')
            })).sort((a, b) => b.totale - a.totale);
        },
        andamento() {
            return [...this.anni].reverse().map(a => {
                const v = vociCosto(a);
                return { x: new Date(a, 6, 1), y: totale(this.sezione ? v.filter(x => x.sezione_id === this.sezione.id) : v) };
            });
        }
    },
    methods: { apri, totale, nomeImpianto: id => sezioneDi(id)?.nome ?? '' },
    setup() { return { f }; }
};

// ---------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------
export const CasaHome = {
    components: { RigaAvviso, TesseraImpianto, SchedaStato, SchedaAvviso, CalendarioCasa },
    template: `
      <Pagina titolo="Casa Dolonne" grande :con-indietro="false">
        <template #azioni>
          <button v-if="sezioni.length" class="pulsante-barra" @click="apriRicerca" aria-label="Cerca"><Icona nome="ricerca" :dimensione="20"/></button>
          <button class="pulsante-barra" @click="cambiaScheda('impostazioni')" aria-label="Impostazioni"><Icona nome="ingranaggio" :dimensione="20"/></button>
          <button v-if="puoModificare() && sezioni.length" class="pulsante-barra" @click="modificaImpianti = !modificaImpianti">{{ modificaImpianti ? 'Fine' : 'Modifica' }}</button>
          <button v-if="puoModificare()" class="pulsante-barra" @click="nuova = { nome: '', icona: 'chiave' }" aria-label="Nuovo impianto"><Icona nome="piu"/></button>
        </template>
        <Vuoto v-if="!sezioni.length" icona="casa" titolo="Ancora nessun impianto"
               testo="Chi può modificare apre Impostazioni → Carica contenuti iniziali: verranno creati impianti, operazioni, guide e carichi pellet."/>

        <template v-if="sezioni.length">
          <!-- Ricerca: si apre dalla lente in alto -->
          <label v-if="cercando" class="campo-ricerca"><Icona nome="ricerca" :dimensione="18"/>
            <input ref="ricerca" v-model="ricerca" placeholder="Cerca impianti, operazioni, guide, documenti, prodotti" type="search"
                   @keyup.esc="chiudiRicerca" @blur="!ricerca.trim() && chiudiRicerca()">
            <button type="button" class="pulsante-testo" style="padding:0 2px" @mousedown.prevent @click="chiudiRicerca">Annulla</button>
          </label>

          <!-- Ricerca unica -->
          <template v-if="ricerca.trim()">
            <Vuoto v-if="!risultati.totale" icona="ricerca" :titolo="'Nessun risultato per “' + ricerca.trim() + '”'"/>
            <Gruppo v-if="risultati.impianti.length" titolo="Impianti">
              <Riga v-for="s in risultati.impianti" :key="s.id" :icona="s.icona" quadrata :titolo="s.nome" freccia
                    @click="apriDaElenco({ nome: 'impianto', id: s.id })"/>
            </Gruppo>
            <Gruppo v-if="risultati.operazioni.length" titolo="Operazioni">
              <Riga v-for="o in risultati.operazioni" :key="o.id" :icona="iconaOperazione(o)" :titolo="o.titolo" :sottotitolo="nomeImpianto(o.sezione_id)" freccia
                    @click="apriOperazione(o)"/>
            </Gruppo>
            <Gruppo v-if="risultati.guide.length" titolo="Guide">
              <Riga v-for="g in risultati.guide" :key="g.id" icona="libro" :titolo="g.titolo" :sottotitolo="nomeImpianto(g.sezione_id)" freccia
                    @click="apriDaElenco({ nome: 'guida', id: g.id })"/>
            </Gruppo>
            <Gruppo v-if="risultati.documenti.length" titolo="Documenti">
              <RigaDocumento v-for="d in risultati.documenti" :key="d.id" :documento="d"/>
            </Gruppo>
            <Gruppo v-if="risultati.prodotti.length" titolo="Prodotti">
              <RigaProdotto v-for="p in risultati.prodotti" :key="p.id" :prodotto="p" con-operazione
                            @click="apriDaElenco({ nome: 'prodotto', id: p.id })"/>
            </Gruppo>
          </template>

          <template v-else>
            <div class="cruscotto">
              <div class="cruscotto-stato">
                <SchedaStato :avvisi="elencoAvvisi" :prossima="prossimaScadenza"/>
                <!-- Avvisi come schede -->
                <div v-if="elencoAvvisi.length" class="schede-avvisi">
                  <SchedaAvviso v-for="a in elencoAvvisi" :key="a.id" :avviso="a" @apri="apriDaElenco"/>
                </div>
              </div>

              <!-- Impianti -->
              <div class="cruscotto-impianti">
                <div v-if="!modificaImpianti" class="griglia-impianti">
                  <TesseraImpianto v-for="s in sezioni" :key="s.id" :sezione="s"
                                   :selezionata="selezionata({ nome: 'impianto', id: s.id })" @click="apriDaElenco({ nome: 'impianto', id: s.id })"/>
                </div>
                <Gruppo v-else titolo="Impianti" nota="Tocca un impianto per rinominarlo, cambiarne l'icona o eliminarlo; con le frecce cambi l'ordine.">
                  <Riga v-for="(s, i) in sezioni" :key="s.id" :icona="s.icona" quadrata :titolo="s.nome" @click="modifica = { ...s }">
                    <template #fine>
                      <span class="strumenti" style="margin:0">
                        <button type="button" :disabled="i === 0" @click.stop="sposta(i, -1)" aria-label="Sposta su">↑</button>
                        <button type="button" :disabled="i === sezioni.length - 1" @click.stop="sposta(i, 1)" aria-label="Sposta giù">↓</button>
                      </span>
                    </template>
                  </Riga>
                </Gruppo>
                <button class="scheda-costi" style="margin-top:14px;width:100%" @click="apriDaElenco({ nome: 'costi' })">
                  <IconaQuadrata nome="carrello" colore="var(--accento)" :dimensione="34"/>
                  <span class="scheda-costi-testi"><span class="secondario">Costi {{ annoCorrente }}</span><b>{{ f.euro(costiAnno) }}</b></span>
                  <Icona nome="avanti" :dimensione="16" class="secondario"/>
                </button>
              </div>

              <!-- Calendario degli interventi -->
              <div class="cruscotto-calendario">
                <CalendarioCasa :voci="scadenze" @apri="apriDaElenco"/>
              </div>
            </div>
          </template>
        </template>

        <Foglio v-if="nuova || modifica" :titolo="nuova ? 'Nuovo impianto' : 'Modifica impianto'"
                :conferma-disabilitata="!(nuova || modifica).nome.trim()" @annulla="nuova = modifica = null" @conferma="salvaImpianto">
          <Gruppo><CampoTesto v-model="(nuova || modifica).nome" segnaposto="Nome impianto (es. Irrigazione)"/></Gruppo>
          <Gruppo titolo="Icona">
            <div class="riga" style="flex-wrap:wrap;gap:10px">
              <button v-for="i in icone" :key="i" type="button" @click="(nuova || modifica).icona = i"
                      :style="{ outline: (nuova || modifica).icona === i ? '3px solid var(--accento)' : 'none', borderRadius: '9px', outlineOffset: '2px' }">
                <IconaQuadrata :nome="i" :dimensione="40"/>
              </button>
            </div>
          </Gruppo>
          <Gruppo v-if="modifica"><Riga distruttiva titolo="Elimina impianto" @click="eliminaImpianto"/></Gruppo>
        </Foglio>
      </Pagina>`,
    data() { return { ricerca: '', cercando: false, nuova: null, modifica: null, modificaImpianti: false, icone: ICONE_SEZIONE }; },
    setup() {
        const elencoAvvisi = computed(() => avvisi());
        const elencoProssime = computed(() => prossime());
        const conteggi = computed(() => ({
            scaduti: elencoAvvisi.value.filter(a => a.gravita === 'scaduto').length,
            inScadenza: elencoAvvisi.value.filter(a => a.gravita === 'inScadenza' || a.gravita === 'inCorso').length
        }));
        const sezioni = computed(() => db.sezioni.slice().sort((a, b) => a.ordine - b.ordine));
        const scadenze = computed(() => calendarioScadenze());
        // Prossima scadenza futura non ancora in allarme (per il riquadro dello stato).
        const prossimaScadenza = computed(() => scadenze.value.find(v => v.gravita === 'info' && v.data >= f.giorno(new Date())) ?? null);
        const annoCorrente = new Date().getFullYear();
        const costiAnno = computed(() => totale(vociCosto(annoCorrente)));
        return { elencoAvvisi, elencoProssime, conteggi, sezioni, scadenze, prossimaScadenza, annoCorrente, costiAnno, f };
    },
    computed: {
        risultati() {
            const q = this.ricerca.trim().toLowerCase();
            const trova = (...testi) => testi.some(t => (t ?? '').toLowerCase().includes(q));
            const r = {
                impianti: this.sezioni.filter(s => trova(s.nome)),
                operazioni: db.operazioni.filter(o => trova(o.titolo, o.descrizione, ...(o.passaggi ?? []))).sort(ordinaTitoli),
                guide: db.guide.filter(g => trova(g.titolo) || (g.blocchi ?? []).some(b => b.tipo === 'testo' && trova(testoDaHtml(b.html)))).sort(ordinaTitoli),
                documenti: db.documenti.filter(d => trova(d.titolo, d.nome_file)).sort(ordinaTitoli),
                prodotti: db.prodotti.filter(p => trova(p.nome, p.codice, p.fornitore)).sort((a, b) => a.nome.localeCompare(b.nome))
            };
            r.totale = Object.values(r).reduce((n, v) => n + v.length, 0);
            return r;
        }
    },
    methods: {
        puoModificare, apriDaElenco, iconaOperazione, cambiaScheda,
        tipo: o => TIPI_OPERAZIONE[o.tipo] ?? TIPI_OPERAZIONE.generica,
        nomeImpianto: id => sezioneDi(id)?.nome ?? '',
        selezionata(p) { return nav.largo && stessaPagina(pila()[0], p); },
        async apriRicerca() {
            this.cercando = true;
            await this.$nextTick();
            this.$refs.ricerca?.focus();
        },
        chiudiRicerca() { this.ricerca = ''; this.cercando = false; },
        apriOperazione(o) { apriDaElenco({ nome: 'impianto', id: o.sezione_id }); apri({ nome: 'operazione', id: o.id }); },
        async sposta(i, d) {
            const elenco = [...this.sezioni];
            const [s] = elenco.splice(i, 1);
            elenco.splice(i + d, 0, s);
            await Promise.all(elenco.map((voce, ordine) => voce.ordine !== ordine ? salva('sezioni', { ...voce, ordine }) : null));
        },
        async salvaImpianto() {
            if (this.nuova) {
                // Ogni impianto nasce con l'operazione standard "Manutenzioni" (Principale ogni 12 mesi, Cliente).
                const s = await salva('sezioni', { ...this.nuova, nome: this.nuova.nome.trim(), ordine: this.sezioni.length });
                const o = await salva('operazioni', { sezione_id: s.id, titolo: 'Manutenzioni', tipo: 'storico', ordine: 0, passaggi: [], descrizione: '' });
                await salva('tipologie', { operazione_id: o.id, nome: 'Principale', mesi_avviso: 12, ordine: 0 });
                await salva('tipologie', { operazione_id: o.id, nome: 'Cliente', mesi_avviso: 0, ordine: 1 });
            }
            else await salva('sezioni', { ...this.modifica, nome: this.modifica.nome.trim() });
            this.nuova = this.modifica = null;
        },
        async eliminaImpianto() {
            if (!confirm(`Eliminare "${this.modifica.nome}" con tutte le sue operazioni, guide e documenti?`)) return;
            await elimina('sezioni', this.modifica.id);
            this.modifica = null;
        }
    }
};

// ---------------------------------------------------------------------
// Pagina di un impianto
// ---------------------------------------------------------------------
/// Ultima scheda scelta per ogni impianto (resta finché l'app è aperta).
const schedaScelta = {};

export const ImpiantoPagina = {
    components: { RigaAvviso, ContattoFoglio },
    props: { id: String },
    template: `
      <Pagina v-if="sezione" :titolo="sezione.nome" titolo-sottile>
        <template #azioni>
          <button class="pulsante-barra" @click="apri({ nome: 'codiciQR', id: sezione.id })" aria-label="Codice QR"><Icona nome="qr" :dimensione="20"/></button>
        </template>

        <!-- Intestazione: icona, stato e dati principali -->
        <div class="testata-impianto" :class="'stato-' + r.stato">
          <IconaQuadrata :nome="sezione.icona" :dimensione="56"/>
          <div class="testata-testi">
            <h2>{{ sezione.nome }}</h2>
            <span class="ti-stato"><i></i>{{ r.etichetta }}</span>
          </div>
        </div>
        <div v-if="r.dati.length || r.prossima" class="dati-impianto">
          <span v-for="d in r.dati" :key="d" class="pillola">{{ d }}</span>
          <span v-if="r.prossima" class="pillola"><Icona nome="calendario" :dimensione="14"/>{{ r.prossima }}</span>
        </div>

        <Gruppo v-if="elencoAvvisi.length" titolo="Avvisi">
          <RigaAvviso v-for="a in elencoAvvisi" :key="a.id" :avviso="a" @apri="apri"/>
        </Gruppo>

        <div v-if="schede.length > 1" class="segmenti segmenti-impianto">
          <button v-for="s in schede" :key="s.id" :class="{ attivo: schedaAttiva === s.id }" @click="scegli(s.id)">
            {{ s.nome }}<span v-if="s.numero" class="segmento-numero">{{ s.numero }}</span>
          </button>
        </div>

        <!-- Operazioni -->
        <template v-if="schedaAttiva === 'operazioni'">
          <Gruppo>
            <Riga v-if="!operazioni.length" titolo="Nessuna operazione per questo impianto" class="secondario"/>
            <Riga v-for="o in operazioni" :key="o.id" :icona="iconaOperazione(o)" quadrata :colore="coloreOperazione(o)"
                  :titolo="o.titolo" :sottotitolo="riepilogoOperazione(o)" freccia @click="apri({ nome: 'operazione', id: o.id })"/>
            <Riga v-if="puoModificare()" azione icona="piuCerchio" titolo="Nuova operazione" @click="nuova = { titolo: '', icona: '' }"/>
          </Gruppo>
          <Gruppo>
            <Riga icona="carrello" titolo="Costi dell'impianto" :valore="f.euro(costiImpianto)" freccia @click="apri({ nome: 'costi', id: sezione.id })"/>
          </Gruppo>
        </template>

        <!-- Manuale: guide scritte da noi e documenti del fornitore -->
        <template v-if="schedaAttiva === 'manuale'">
          <Gruppo v-if="guide.length || puoModificare()" titolo="Guide">
            <Riga v-if="!guide.length" titolo="Nessuna guida" class="secondario"/>
            <Riga v-for="g in guide" :key="g.id" icona="libro" :titolo="g.titolo || 'Senza titolo'"
                  :sottotitolo="'Aggiornata il ' + f.dataBreve(g.aggiornata)" freccia @click="apri({ nome: 'guida', id: g.id })"/>
            <Riga v-if="puoModificare()" azione icona="piuCerchio" titolo="Nuova guida" @click="nuovaGuida"/>
          </Gruppo>
          <Gruppo v-if="documenti.length || puoModificare()" titolo="Documenti del fornitore">
            <Riga v-if="!documenti.length" titolo="Nessun documento" class="secondario"/>
            <RigaDocumento v-for="d in documenti" :key="d.id" :documento="d"/>
            <label v-if="puoModificare()" class="riga toccabile azione"><span class="riga-icona"><Icona nome="importa"/></span>
              <span class="riga-testi">{{ caricamento ? 'Caricamento…' : 'Importa documento (PDF o foto)' }}</span>
              <input type="file" multiple accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx" hidden @change="importa">
            </label>
          </Gruppo>
        </template>

        <!-- Contatti e contratti -->
        <template v-if="schedaAttiva === 'contatti'">
          <Gruppo v-if="contatti.length || puoModificare()" titolo="Contatti">
            <Riga v-if="!contatti.length" titolo="Nessun contatto" class="secondario"/>
            <Riga v-for="c in contatti" :key="c.id" icona="persona" :titolo="nomeContatto(c)" :sottotitolo="sottotitoloContatto(c)" freccia
                  @click="apri({ nome: 'contatto', id: c.id })">
              <template v-if="puoModificare()" #fine>
                <button type="button" class="scollega" @click.stop="scollega(c)" :aria-label="'Scollega ' + nomeContatto(c)">−</button>
              </template>
            </Riga>
            <CampoScelta v-if="puoModificare() && daCollegare.length" etichetta="Collega dalla rubrica" :model-value="null"
                         :opzioni="[{ valore: null, nome: 'Scegli' }, ...daCollegare]" @update:model-value="collega"/>
            <Riga v-if="puoModificare()" azione icona="piuCerchio" titolo="Nuovo contatto" @click="nuovoContatto = true"/>
          </Gruppo>
        </template>

        <!-- Contratti dell'impianto -->
        <template v-if="schedaAttiva === 'contratti'">
          <Gruppo v-if="contratti.length || puoModificare()">
            <Riga v-if="!contratti.length" titolo="Nessun contratto" class="secondario"/>
            <RigaContratto v-for="c in contratti" :key="c.id" :contratto="c" @click="apri({ nome: 'contratto', id: c.id })"/>
            <Riga v-if="puoModificare()" azione icona="documento" titolo="Aggiungi contratto" @click="nuovoContratto = true"/>
          </Gruppo>
        </template>

        <Foglio v-if="nuova" titolo="Nuova operazione" :conferma-disabilitata="!nuova.titolo.trim()"
                @annulla="nuova = null" @conferma="creaOperazione">
          <Gruppo nota="Un'operazione con descrizione, prodotti, gestione scorte, avvisi e collegamento al manuale.">
            <CampoTesto v-model="nuova.titolo" segnaposto="Titolo (es. Controllo filtri)"/>
          </Gruppo>
          <Gruppo titolo="Simbolo">
            <SceltaIcona v-model="nuova.icona" :colore="coloreImpianto(sezione.id)" predefinita="lista"/>
          </Gruppo>
        </Foglio>
        <ContrattoFoglio v-if="nuovoContratto" :sezione-id="sezione.id" @chiudi="nuovoContratto = false"/>
        <ContattoFoglio v-if="nuovoContatto" :sezione-id="sezione.id" @chiudi="nuovoContatto = false"/>
      </Pagina>
      <PaginaMancante v-else/>`,
    data() { return { nuova: null, nuovoContratto: false, nuovoContatto: false, caricamento: false, scheda: null }; },
    created() { this.scheda = schedaScelta[this.id] ?? (this.operazioni.length ? 'operazioni' : 'manuale'); },
    computed: {
        sezione() { return sezioneDi(this.id); },
        r() { return riassuntoImpianto(this.sezione); },
        costiImpianto() { return totale(vociCosto(new Date().getFullYear()).filter(v => v.sezione_id === this.id)); },
        operazioni() { return this.sezione ? operazioniDi(this.sezione) : []; },
        elencoAvvisi() { return this.sezione ? avvisi({ sezione: this.sezione }) : []; },
        guide() { return db.guide.filter(g => g.sezione_id === this.id).sort(ordinaTitoli); },
        documenti() { return db.documenti.filter(d => d.sezione_id === this.id).sort(ordinaTitoli); },
        contatti() { return db.contatti.filter(c => (c.sezioni ?? []).includes(this.id)).sort((a, b) => nomeContatto(a).localeCompare(nomeContatto(b))); },
        contratti() { return db.contratti.filter(c => c.sezione_id === this.id); },
        daCollegare() {
            return db.contatti.filter(c => !(c.sezioni ?? []).includes(this.id))
                .sort((a, b) => nomeContatto(a).localeCompare(nomeContatto(b)))
                .map(c => ({ valore: c.id, nome: [nomeContatto(c), c.azienda && nomeContatto(c) !== c.azienda ? c.azienda : ''].filter(Boolean).join(' · ') }));
        },
        schede() {
            const tutte = [
                { id: 'operazioni', nome: 'Operazioni', numero: this.operazioni.length },
                { id: 'manuale', nome: 'Manuale', numero: this.guide.length + this.documenti.length },
                { id: 'contratti', nome: 'Contratti', numero: this.contratti.length },
                { id: 'contatti', nome: 'Contatti', numero: this.contatti.length }
            ];
            // Chi ha sola lettura non vede le schede vuote.
            return puoModificare() ? tutte : tutte.filter(s => s.numero > 0);
        },
        /// Scheda mostrata: quella scelta, se ancora disponibile, altrimenti la prima.
        schedaAttiva() { return this.schede.some(s => s.id === this.scheda) ? this.scheda : this.schede[0]?.id; }
    },
    methods: {
        apri, puoModificare, riepilogoOperazione, nomeContatto, sottotitoloContatto, iconaOperazione, coloreImpianto,
        scegli(id) { this.scheda = schedaScelta[this.id] = id; },
        async collega(id) {
            const c = db.contatti.find(c => c.id === id);
            if (c) await salva('contatti', { ...c, sezioni: [...(c.sezioni ?? []), this.id] });
        },
        async scollega(c) {
            if (!confirm(`Scollegare ${nomeContatto(c)} da ${this.sezione.nome}? Il contatto resta in rubrica.`)) return;
            await salva('contatti', { ...c, sezioni: (c.sezioni ?? []).filter(id => id !== this.id) });
        },
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
            const icona = this.nuova.icona && this.nuova.icona !== 'lista' ? this.nuova.icona : '';
            const o = await salva('operazioni', { sezione_id: this.id, titolo: this.nuova.titolo.trim(), tipo: 'generica', ordine, passaggi: [], icona });
            this.nuova = null;
            apri({ nome: 'operazione', id: o.id });
        },
        async nuovaGuida() {
            const g = await salva('guide', { sezione_id: this.id, titolo: '', blocchi: [{ tipo: 'testo', html: '' }], aggiornata: new Date().toISOString() });
            apri({ nome: 'guida', id: g.id, modifica: true });
        },
        async importa(e) {
            this.caricamento = true;
            try {
                for (const file of e.target.files) {
                    const percorso = await caricaFile(file, 'documenti');
                    await salva('documenti', { sezione_id: this.id, titolo: file.name.replace(/\.[^.]+$/, ''), nome_file: file.name, percorso, dimensione: file.size });
                }
            } catch (err) { alert(`Importazione non riuscita: ${err.message}`); }
            finally { this.caricamento = false; e.target.value = ''; }
        }
    },
    setup() { return { f }; }
};
