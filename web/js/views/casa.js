// Casa: home con tutti gli impianti (come l'app Casa di Apple) e pagina di ogni impianto
// con operazioni, manuale (guide e documenti) e contatti.
import { computed } from 'vue';
import { db, salva, elimina, caricaFile, puoModificare } from '../store.js';
import { nav, pila, apri, apriDaElenco, stessaPagina } from '../nav.js';
import * as f from '../format.js';
import { COLORE_SEZIONE, ICONE_SEZIONE } from '../icone.js';
import {
    avvisi, prossime, operazioniDi, statoOperazione, TIPI_OPERAZIONE, sezioneDi, nomeContatto, sottotitoloContatto
} from '../logic.js';
import { riassuntoImpianto, riepilogoOperazione, TesseraImpianto, RigaAvviso } from './manutenzione.js';
import { ContattoFoglio } from './contatti.js';

const ordinaTitoli = (a, b) => a.titolo.localeCompare(b.titolo, 'it', { numeric: true });
const testoDaHtml = html => new DOMParser().parseFromString(html ?? '', 'text/html').body.textContent ?? '';

// ---------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------
export const CasaHome = {
    components: { RigaAvviso, TesseraImpianto },
    template: `
      <Pagina titolo="Casa Dolonne" grande :con-indietro="false">
        <template #azioni>
          <button v-if="sezioni.length" class="pulsante-barra" @click="apriRicerca" aria-label="Cerca"><Icona nome="ricerca" :dimensione="20"/></button>
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
              <Riga v-for="o in risultati.operazioni" :key="o.id" :icona="tipo(o).icona" :titolo="o.titolo" :sottotitolo="nomeImpianto(o.sezione_id)" freccia
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
            <!-- Stato della casa in breve -->
            <!-- Stato della casa in breve: solo ciò che c'è, altrimenti "Tutto in regola" -->
            <div class="stato-casa">
              <span v-if="conteggi.scaduti" class="pillola rosso"><Icona nome="avviso" :dimensione="16"/>{{ conteggi.scaduti }} da fare</span>
              <span v-if="conteggi.inScadenza" class="pillola arancione"><Icona nome="orologio" :dimensione="16"/>{{ conteggi.inScadenza }} in scadenza</span>
              <span v-if="elencoProssime.length" class="pillola blu"><Icona nome="calendario" :dimensione="16"/>{{ elencoProssime.length }} in arrivo</span>
              <span v-if="!conteggi.scaduti && !conteggi.inScadenza && !elencoProssime.length" class="pillola verde">
                <Icona nome="sigillo" :dimensione="16"/>Tutto in regola</span>
            </div>

            <Gruppo v-if="elencoAvvisi.length" titolo="Avvisi">
              <RigaAvviso v-for="a in elencoAvvisi" :key="a.id" :avviso="a" :selezionata="selezionata(a.pagina)" @apri="apriDaElenco"/>
            </Gruppo>

            <!-- Impianti -->
            <div v-if="!modificaImpianti" class="gruppo">
              <div class="griglia-impianti">
                <TesseraImpianto v-for="s in sezioni" :key="s.id" :sezione="s"
                                 :selezionata="selezionata({ nome: 'impianto', id: s.id })" @click="apriDaElenco({ nome: 'impianto', id: s.id })"/>
              </div>
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

            <Gruppo v-if="elencoProssime.length" titolo="Prossimi 30 giorni">
              <RigaAvviso v-for="a in elencoProssime" :key="a.id" :avviso="a" :selezionata="selezionata(a.pagina)" @apri="apriDaElenco"/>
            </Gruppo>
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
        return { elencoAvvisi, elencoProssime, conteggi, sezioni };
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
        puoModificare, apriDaElenco,
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
            if (this.nuova) await salva('sezioni', { ...this.nuova, nome: this.nuova.nome.trim(), ordine: this.sezioni.length });
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
            <Riga v-for="o in operazioni" :key="o.id" :icona="tipo(o).icona" quadrata :colore="coloreOperazione(o)"
                  :titolo="o.titolo" :sottotitolo="riepilogoOperazione(o)" freccia @click="apri({ nome: 'operazione', id: o.id })"/>
            <Riga v-if="puoModificare()" azione icona="piuCerchio" titolo="Nuova operazione" @click="nuova = { titolo: '' }"/>
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
          <Gruppo v-if="contratti.length || puoModificare()" titolo="Contratti">
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
                { id: 'contatti', nome: 'Contatti', numero: this.contatti.length + this.contratti.length }
            ];
            // Chi ha sola lettura non vede le schede vuote.
            return puoModificare() ? tutte : tutte.filter(s => s.numero > 0);
        },
        /// Scheda mostrata: quella scelta, se ancora disponibile, altrimenti la prima.
        schedaAttiva() { return this.schede.some(s => s.id === this.scheda) ? this.scheda : this.schede[0]?.id; }
    },
    methods: {
        apri, puoModificare, riepilogoOperazione, nomeContatto, sottotitoloContatto,
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
            const o = await salva('operazioni', { sezione_id: this.id, titolo: this.nuova.titolo.trim(), tipo: 'generica', ordine, passaggi: [] });
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
