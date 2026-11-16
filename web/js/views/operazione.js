// Scheda di un'operazione (pH, ossigeno, cambio acqua, pellet, cenere, storico manutenzioni, generica).
import { db, salva, elimina, caricaFile, puoModificare } from '../store.js';
import { nav, apri, apriDaElenco, indietro } from '../nav.js';
import * as f from '../format.js';
import {
    TIPI_OPERAZIONE, allarmi, tipologieDi, interventiDi, ultimoInterventoDi, prossimaScadenza,
    statoScadenza, analisiProcesso, calcoliCarico, carichiOrdinati, svuotamentiOrdinati, consumoCenere,
    prodottoDi, prodottiOperazione, operazioneDiProdotto, categoriaPerOperazione, sezioneDi, nomeMovimento, nomeEsecuzione,
    coloreImpianto
} from '../logic.js';

// ---------------------------------------------------------------------
// Pagina principale
// ---------------------------------------------------------------------
export const OperazionePagina = {
    props: { id: String },
    template: `
      <Pagina v-if="o" :titolo="o.titolo">
        <template #azioni>
          <button v-if="puoModificare()" class="pulsante-barra" @click="descrizione = true">Modifica</button>
        </template>
        <!-- Descrizione in sola lettura: si modifica solo con "Modifica" in alto -->
        <Gruppo v-if="o.descrizione || o.passaggi?.length || puoModificare()" titolo="Descrizione">
          <div class="riga" style="flex-direction:column;align-items:stretch;gap:10px">
            <span v-if="!o.descrizione && !o.passaggi?.length" class="secondario">Nessuna descrizione: tocca Modifica in alto per aggiungerla.</span>
            <span v-if="o.descrizione" class="testo-descrizione">{{ o.descrizione }}</span>
            <span v-for="(p, i) in o.passaggi" :key="i" class="passaggio"><span class="passaggio-numero">{{ i + 1 }}</span><span>{{ p }}</span></span>
          </div>
        </Gruppo>

        <Gruppo v-if="allarmiAttivi.length">
          <Riga v-for="a in allarmiAttivi" :key="a.id" icona="campana" :colore="a.stato === 'scaduta' ? 'var(--rosso)' : 'var(--arancione)'"
                :titolo="a.stato === 'scaduta' ? a.titolo + ': da fare' : a.titolo + ': entro il ' + f.data(a.data)" :sottotitolo="a.dettaglio"/>
        </Gruppo>

        <template v-if="o.tipo !== 'storico'">
          <!-- Prodotti: quelli del magazzino usati in questa operazione (si collegano dal Magazzino) -->
          <template v-if="usaProdotti && (prodottiScorta.length || puoModificare())">
            <h2 class="sezione-operazione">Prodotti</h2>
            <Gruppo :nota="prodottiScorta.length ? '' : 'Per collegare un prodotto aprilo nel Magazzino e scegli questa operazione in “Impianto e operazione”.'">
              <Riga v-if="!prodottiScorta.length" titolo="Nessun prodotto collegato" class="secondario"/>
              <RigaProdotto v-for="p in prodottiScorta" :key="p.id" :prodotto="p" @click="apri({ nome: 'prodotto', id: p.id })"/>
            </Gruppo>
          </template>

          <!-- Gestione scorte: giacenza, acquisti, consumi e grafici -->
          <template v-if="usaProdotti && prodottoScelto">
            <h2 class="sezione-operazione">Gestione scorte</h2>
            <div v-if="prodottiScorta.length > 1" class="segmenti">
              <button v-for="p in prodottiScorta" :key="p.id" :class="{ attivo: p.id === prodottoScelto.id }" @click="scelto = p.id">{{ p.nome }}</button>
            </div>
            <SezioniScorta :prodotto="prodottoScelto" :key="prodottoScelto.id" con-grafici/>
          </template>

          <!-- Altre operazioni specifiche (misure pH, cambio acqua, carichi pellet, cenere) -->
          <template v-if="['ph', 'cambioAcqua', 'pellet', 'cenere'].includes(o.tipo)">
            <h2 class="sezione-operazione">{{ usaProdotti ? 'Altre operazioni' : 'Registro' }}</h2>
            <MisurePH v-if="o.tipo === 'ph'"/>
            <CambioAcqua v-if="o.tipo === 'cambioAcqua'"/>
            <Pellet v-if="o.tipo === 'pellet'" :operazione="o"/>
            <Cenere v-if="o.tipo === 'cenere'"/>
          </template>
        </template>
        <Storico v-else :operazione="o"/>

        <template v-if="puoModificare() || avvisiImpostati">
          <h2 class="sezione-operazione">Avvisi</h2>
          <NotificheOperazione :operazione="o"/>
        </template>

        <h2 v-if="guida || puoModificare()" class="sezione-operazione">Manuale</h2>
        <Gruppo v-if="guida || puoModificare()">
          <Riga v-if="guida" icona="libro" :titolo="guida.titolo" freccia @click="apriGuida"/>
          <CampoScelta v-if="puoModificare()" :etichetta="guida ? 'Cambia guida' : 'Collega una guida'" :model-value="o.guida_id"
                       :opzioni="opzioniGuide" @update:model-value="v => salva('operazioni', { ...o, guida_id: v })"/>
          <Riga v-else-if="!guida" icona="libro" titolo="Nessuna guida collegata" class="secondario"/>
        </Gruppo>

        <DescrizioneFoglio v-if="descrizione" :operazione="o" @chiudi="descrizione = false"/>
      </Pagina>
      <PaginaMancante v-else/>`,
    data() { return { descrizione: false, scelto: null }; },
    computed: {
        o() { return db.operazioni.find(o => o.id === this.id); },
        /// Cambio acqua e svuotamento cenere sono operazioni manuali, senza prodotti.
        usaProdotti() { return !['storico', 'cambioAcqua', 'cenere'].includes(this.o.tipo); },
        /// Per chi ha sola lettura la sezione Avvisi compare solo se c'è almeno un avviso impostato.
        avvisiImpostati() {
            return this.o.giorni_allarme > 0 || this.prodottiScorta.some(p => Number(p.scorta_minima) > 0)
                || tipologieDi(this.o).some(t => t.mesi_avviso > 0);
        },
        prodottiScorta() { return prodottiOperazione(this.o); },
        prodottoScelto() { return this.prodottiScorta.find(p => p.id === this.scelto) ?? this.prodottiScorta[0] ?? null; },
        guida() { return db.guide.find(g => g.id === this.o?.guida_id); },
        allarmiAttivi() { return allarmi(this.o).filter(a => a.stato !== 'ok'); },
        opzioniGuide() {
            const opzioni = [{ valore: null, nome: 'Nessuna' }];
            for (const s of db.sezioni.slice().sort((a, b) => a.ordine - b.ordine)) {
                for (const g of db.guide.filter(g => g.sezione_id === s.id).sort((a, b) => a.titolo.localeCompare(b.titolo, 'it', { numeric: true }))) {
                    opzioni.push({ valore: g.id, nome: `${s.nome} · ${g.titolo}` });
                }
            }
            return opzioni;
        }
    },
    methods: {
        puoModificare, apri, salva,
        apriGuida() { apri({ nome: 'guida', id: this.guida.id }); }
    },
    setup() { return { f }; }
};

export const DescrizioneFoglio = {
    props: { operazione: Object },
    emits: ['chiudi'],
    template: `
      <Foglio titolo="Modifica operazione" :conferma-disabilitata="!titolo.trim()" @annulla="$emit('chiudi')" @conferma="salvaDescrizione">
        <Gruppo><CampoTesto v-model="titolo" etichetta="Titolo" segnaposto="Nome dell'operazione"/></Gruppo>
        <Gruppo titolo="Simbolo">
          <SceltaIcona v-model="icona" :colore="coloreImpianto(operazione.sezione_id)" :predefinita="iconaTipo"/>
        </Gruppo>
        <Gruppo titolo="Descrizione breve"><CampoTesto v-model="descrizione" multilinea segnaposto="A cosa serve, quando va fatta…"/></Gruppo>
        <Gruppo titolo="Passaggi" nota="Svuota un passaggio per eliminarlo.">
          <label v-for="(p, i) in passaggi" :key="i" class="campo">
            <span class="campo-etichetta secondario">{{ i + 1 }}.</span>
            <input v-model="passaggi[i]" placeholder="Passaggio" style="text-align:left">
            <button type="button" class="secondario" @click="sposta(i, -1)" :disabled="i === 0" aria-label="Sposta su"><Icona nome="frecciaSu" :dimensione="18"/></button>
          </label>
          <Riga azione icona="piu" titolo="Aggiungi passaggio" @click="passaggi.push('')"/>
        </Gruppo>
        <Gruppo titolo="Note"><CampoTesto v-model="note" multilinea segnaposto="Note sull'impianto, codici, riferimenti…"/></Gruppo>
      </Foglio>`,
    data() {
        return { titolo: this.operazione.titolo ?? '', icona: this.operazione.icona || '', descrizione: this.operazione.descrizione ?? '',
                 passaggi: [...(this.operazione.passaggi ?? [])], note: this.operazione.note ?? '' };
    },
    computed: { iconaTipo() { return TIPI_OPERAZIONE[this.operazione.tipo]?.icona ?? 'lista'; } },
    methods: {
        coloreImpianto,
        sposta(i, d) { const [p] = this.passaggi.splice(i, 1); this.passaggi.splice(i + d, 0, p); },
        async salvaDescrizione() {
            await salva('operazioni', {
                ...this.operazione, titolo: this.titolo.trim(), icona: this.icona === this.iconaTipo ? '' : this.icona,
                descrizione: this.descrizione.trim(), note: this.note.trim(),
                passaggi: this.passaggi.map(p => p.trim()).filter(Boolean)
            });
            this.$emit('chiudi');
        }
    }
};

/// Allarmi modificabili direttamente nella scheda.
export const NotificheOperazione = {
    props: { operazione: Object },
    template: `
      <Gruppo :nota="nota">
        <template v-if="periodico">
          <Interruttore :etichetta="etichettaPeriodico" :model-value="o.giorni_allarme > 0" :disabilitato="!modifica"
                        @update:model-value="v => aggiorna({ giorni_allarme: v ? giorniPredefiniti : 0 })"/>
          <Passo v-if="o.giorni_allarme > 0" :model-value="o.giorni_allarme" :min="1" :max="730" :disabilitato="!modifica"
                 @update:model-value="v => aggiorna({ giorni_allarme: v })">Dopo {{ o.giorni_allarme }} giorni</Passo>
        </template>
        <template v-for="p in prodotti" :key="p.id">
          <Interruttore :etichetta="prodotti.length > 1 ? 'Scorta minima · ' + p.nome : 'Avviso di scorta minima'" :model-value="p.scorta_minima > 0"
                        :disabilitato="!modifica" @update:model-value="v => salva('prodotti', { ...p, scorta_minima: v ? sogliaPredefinita(p) : 0 })"/>
          <!-- Salva solo a fine modifica: salvando a ogni tasto l'aggiornamento in tempo reale riscriveva il campo. -->
          <CampoNumero v-if="p.scorta_minima > 0 && modifica" etichetta="Sotto" :unita="p.unita" :model-value="Number(p.scorta_minima)"
                       @fine="v => v > 0 && v !== Number(p.scorta_minima) && salva('prodotti', { ...p, scorta_minima: v })"/>
          <Riga v-else-if="p.scorta_minima > 0" titolo="Sotto" :valore="f.quantita(p.scorta_minima, p.unita)"/>
        </template>
        <template v-if="o.tipo === 'storico'">
          <Passo v-for="t in tipologie" :key="t.id" :model-value="t.mesi_avviso" :min="0" :max="120" :disabilitato="!modifica"
                 @update:model-value="v => salva('tipologie', { ...t, mesi_avviso: v })">
            <span @click="rinomina(t)">{{ t.nome }}</span><br>
            <small class="secondario">{{ t.mesi_avviso ? 'Ogni ' + t.mesi_avviso + ' mesi' : 'Nessun avviso' }}</small>
          </Passo>
          <Riga v-if="modifica" azione icona="piu" titolo="Aggiungi tipologia" @click="aggiungiTipologia"/>
        </template>
        <Riga v-if="!periodico && o.tipo !== 'storico'" class="secondario" titolo="Collega un prodotto per impostare gli avvisi di scorta"/>
      </Gruppo>`,
    computed: {
        o() { return this.operazione; },
        prodotto() { return prodottoDi(this.o.prodotto_id); },
        prodotti() { return prodottiOperazione(this.o); },
        /// Avviso periodico: per le operazioni con prodotti e per quelle che si ripetono (cenere, cambio acqua).
        periodico() { return this.prodotti.length > 0 || ['cenere', 'cambioAcqua'].includes(this.o.tipo); },
        nomeConsumo() { return nomeEsecuzione(this.o); },
        etichettaPeriodico() { return `Avviso periodico dopo l'ultimo ${this.nomeConsumo}`; },
        giorniPredefiniti() { return { cenere: 14, cambioAcqua: 365 }[this.o.tipo] ?? 20; },
        tipologie() { return tipologieDi(this.o); },
        modifica() { return puoModificare(); },
        nota() {
            if (this.o.tipo === 'storico') return "Ogni tipologia ha la sua scadenza, calcolata dall'ultimo intervento dello stesso tipo. Tocca il nome per rinominarla. Con 0 mesi non c'è avviso.";
            if (this.periodico) {
                const scorta = this.prodotti.length ? ' Scorta minima: segnala quando la giacenza scende sotto la soglia.' : '';
                return `Avviso periodico: ricorda di ripetere l'operazione N giorni dopo l'ultimo ${this.nomeConsumo}.${scorta}`;
            }
            return '';
        }
    },
    methods: {
        salva,
        sogliaPredefinita: p => p.categoria === 'ossigeno' ? 50 : 5,
        aggiorna(campi) { salva('operazioni', { ...this.o, ...campi }); },
        async aggiungiTipologia() {
            const nome = prompt('Nome della tipologia (es. Verifica periodica)');
            if (!nome?.trim()) return;
            await salva('tipologie', { operazione_id: this.o.id, nome: nome.trim(), mesi_avviso: 12, ordine: this.tipologie.length });
        },
        async rinomina(t) {
            if (!this.modifica) return;
            const nome = prompt('Nuovo nome', t.nome);
            if (nome === null) return;
            if (!nome.trim()) {
                const collegati = db.interventi.some(i => i.tipologia_id === t.id);
                if (!collegati && confirm(`Eliminare la tipologia "${t.nome}"?`)) await elimina('tipologie', t.id);
                return;
            }
            await salva('tipologie', { ...t, nome: nome.trim() });
        }
    },
    setup() { return { f }; }
};

// ---------------------------------------------------------------------
// pH
// ---------------------------------------------------------------------
const MisurePH = {
    template: `
      <Gruppo titolo="Misure pH">
        <template v-if="ultima">
          <div class="due-valori">
            <div><div class="secondario" style="font-size:13px">Dosimetro</div><div class="numero" :class="colore(ultima.dosimetro)">{{ f.ph(ultima.dosimetro) }}</div></div>
            <div><div class="secondario" style="font-size:13px">Scuba</div><div class="numero" :class="colore(ultima.scuba)">{{ f.ph(ultima.scuba) }}</div></div>
          </div>
          <Riga titolo="Ultima misura" :valore="f.data(ultima.data)"/>
        </template>
        <Riga v-else titolo="Nessuna misura registrata" class="secondario"/>
        <Riga v-if="puoModificare()" azione icona="piuCerchio" titolo="Registra misura" @click="foglio = {}"/>
      </Gruppo>
      <Gruppo v-if="misure.length > 1" nota="La fascia verde indica l'intervallo ideale 6,8 – 7,8." nota-sempre>
        <Grafico :serie="serie" :fascia="{ min: 6.8, max: 7.8 }" :formato-y="v => f.ph(v)" valori/>
      </Gruppo>
      <Gruppo v-if="misure.length" titolo="Storico misure">
        <Riga v-for="m in (tutti ? misure : misure.slice(0, 1))" :key="m.id" :titolo="f.data(m.data)" :sottotitolo="m.note"
              :valore="'Dosimetro ' + f.ph(m.dosimetro) + ' · Scuba ' + f.ph(m.scuba)"
              @click="puoModificare() && (foglio = { voce: m })"/>
        <RigaEspandi :totale="misure.length" v-model:aperto="tutti"/>
      </Gruppo>
      <MisuraFoglio v-if="foglio" :misura="foglio.voce" @chiudi="foglio = null"/>`,
    data() { return { foglio: null, tutti: false }; },
    computed: {
        misure() { return db.misure_ph.slice().sort((a, b) => b.data.localeCompare(a.data)); },
        ultima() { return this.misure[0]; },
        serie() {
            const punti = campo => this.misure.filter(m => m[campo] !== null && m[campo] !== undefined)
                .map(m => ({ x: f.giorno(m.data), y: Number(m[campo]) }));
            return [{ nome: 'Dosimetro', colore: 'var(--accento)', punti: punti('dosimetro') },
                    { nome: 'Scuba', colore: 'var(--arancione)', punti: punti('scuba') }].filter(s => s.punti.length);
        }
    },
    methods: {
        puoModificare,
        colore(v) {
            if (v === null || v === undefined) return 'secondario';
            return v >= 6.8 && v <= 7.8 ? 'verde' : v >= 6.6 && v <= 8.0 ? 'arancione-t' : 'rosso-t';
        }
    },
    setup() { return { f }; }
};

const MisuraFoglio = {
    props: { misura: Object },
    emits: ['chiudi'],
    template: `
      <Foglio :titolo="misura ? 'Modifica misura' : 'Nuova misura'" :conferma-disabilitata="b.dosimetro === null && b.scuba === null"
              @annulla="$emit('chiudi')" @conferma="salvaMisura">
        <Gruppo><CampoData v-model="b.data" etichetta="Data"/></Gruppo>
        <Gruppo titolo="Valori pH">
          <CampoNumero v-model="b.dosimetro" etichetta="Dosimetro"/>
          <CampoNumero v-model="b.scuba" etichetta="Scuba"/>
        </Gruppo>
        <Gruppo titolo="Note"><CampoTesto v-model="b.note" multilinea segnaposto="Note (es. aggiunto correttore)"/></Gruppo>
        <Gruppo v-if="misura"><Riga distruttiva titolo="Elimina misura" @click="eliminaMisura"/></Gruppo>
      </Foglio>`,
    data() {
        const m = this.misura ?? {};
        return { b: { data: m.data ?? f.oggiISO(), dosimetro: m.dosimetro ?? null, scuba: m.scuba ?? null, note: m.note ?? '' } };
    },
    methods: {
        async salvaMisura() { await salva('misure_ph', { ...this.b, id: this.misura?.id }); this.$emit('chiudi'); },
        async eliminaMisura() { if (confirm('Eliminare la misura?')) { await elimina('misure_ph', this.misura.id); this.$emit('chiudi'); } }
    }
};

// ---------------------------------------------------------------------
// Cambio acqua
// ---------------------------------------------------------------------
const CambioAcqua = {
    template: `
      <Gruppo v-if="inCorso.length" titolo="In corso">
        <Riga v-for="p in inCorso" :key="p.id" :icona="p.tipo === 'svuotamento' ? 'giu' : 'su'" colore="var(--blu)"
              :titolo="p.tipo === 'svuotamento' ? 'Svuotamento' : 'Riempimento'"
              :sottotitolo="f.numero(analisiProcesso(p).livello) + ' cm · ' + f.numero(analisiProcesso(p).variazione) + ' cm di variazione'"
              freccia @click="apri({ nome: 'processo', id: p.id })">
          <template #fine><Cronometro :da="p.inizio" style="color:var(--blu)"/></template>
        </Riga>
      </Gruppo>
      <Azioni v-if="puoModificare()" :voci="[{ id: 'svuotamento', nome: 'Avvia svuotamento', icona: 'giu' }, { id: 'riempimento', nome: 'Avvia riempimento', icona: 'su' }]"
              @scegli="t => avvio = t"/>
      <Gruppo titolo="Storico">
        <Riga v-if="!conclusi.length" titolo="Nessun processo registrato" class="secondario"/>
        <Riga v-for="p in (tutti ? conclusi : conclusi.slice(0, 1))" :key="p.id" :icona="p.tipo === 'svuotamento' ? 'giu' : 'su'"
              :titolo="p.tipo === 'svuotamento' ? 'Svuotamento' : 'Riempimento'" :sottotitolo="f.data(p.inizio)"
              :valore="f.numero(analisiProcesso(p).variazione) + ' cm · ' + f.durata(analisiProcesso(p).durata)"
              freccia @click="apri({ nome: 'processo', id: p.id })"/>
        <RigaEspandi :totale="conclusi.length" v-model:aperto="tutti"/>
      </Gruppo>
      <AvvioFoglio v-if="avvio" :tipo="avvio" :ultimo-livello="ultimoLivello" @chiudi="avvio = null"/>`,
    data() { return { avvio: null, tutti: false }; },
    computed: {
        processi() { return db.processi_acqua.slice().sort((a, b) => b.inizio.localeCompare(a.inizio)); },
        inCorso() { return this.processi.filter(p => !p.fine); },
        conclusi() { return this.processi.filter(p => p.fine); },
        ultimoLivello() { return this.processi[0] ? analisiProcesso(this.processi[0]).livello : 0; }
    },
    methods: { apri, puoModificare, analisiProcesso },
    setup() { return { f }; }
};

const AvvioFoglio = {
    props: { tipo: String, ultimoLivello: Number },
    emits: ['chiudi'],
    template: `
      <Foglio :titolo="'Avvia ' + tipo" conferma="Avvia" :conferma-disabilitata="b.livello === null" @annulla="$emit('chiudi')" @conferma="avvia">
        <Gruppo nota="Il livello pieno è 0 cm; svuotando scende a -5, -10 cm… Con il livello obiettivo l'app stima quando terminerà.">
          <CampoData v-model="b.inizio" etichetta="Inizio" con-ora/>
          <CampoNumero v-model="b.livello" etichetta="Livello iniziale" unita="cm" negativi/>
          <CampoNumero v-model="b.obiettivo" etichetta="Livello obiettivo" unita="cm" negativi/>
          <CampoNumero v-model="b.temperatura" etichetta="Temperatura acqua" unita="°C"/>
        </Gruppo>
        <Gruppo titolo="Note"><CampoTesto v-model="b.note" multilinea segnaposto="Note"/></Gruppo>
      </Foglio>`,
    data() {
        return { b: {
            inizio: new Date().toISOString(), livello: this.tipo === 'svuotamento' ? 0 : this.ultimoLivello,
            obiettivo: this.tipo === 'riempimento' ? 0 : null, temperatura: null, note: ''
        } };
    },
    methods: {
        async avvia() {
            const p = await salva('processi_acqua', {
                tipo: this.tipo, inizio: this.b.inizio, livello_iniziale: this.b.livello, livello_obiettivo: this.b.obiettivo,
                temperatura_iniziale: this.b.temperatura, note: this.b.note, letture: []
            });
            this.$emit('chiudi');
            apri({ nome: 'processo', id: p.id });
        }
    }
};

export const ProcessoPagina = {
    props: { id: String },
    template: `
      <Pagina v-if="p" :titolo="p.tipo === 'svuotamento' ? 'Svuotamento' : 'Riempimento'">
        <template #azioni>
          <button v-if="puoModificare()" class="pulsante-barra" @click="dati = true">Modifica</button>
        </template>
        <Gruppo>
          <div class="valore-grande" style="display:flex;justify-content:space-between;align-items:flex-end">
            <div><div class="etichetta">{{ p.fine ? 'Durata totale' : 'Tempo trascorso' }}</div>
              <div class="numero"><Cronometro v-if="!p.fine" :da="p.inizio"/><span v-else>{{ f.durata(a.durata) }}</span></div></div>
            <div style="text-align:right"><div class="etichetta">Livello</div><div class="numero" style="font-size:26px">{{ f.numero(a.livello) }} cm</div></div>
          </div>
          <Riga titolo="Inizio" :valore="f.dataOra(p.inizio)"/>
          <Riga v-if="p.fine" titolo="Fine" :valore="f.dataOra(p.fine)"/>
          <Riga titolo="Livello iniziale" :valore="f.numero(p.livello_iniziale) + ' cm'"/>
          <Riga :titolo="p.tipo === 'svuotamento' ? 'Centimetri svuotati' : 'Centimetri riempiti'" :valore="f.numero(a.variazione) + ' cm'"/>
          <Riga v-if="a.velocita" titolo="Velocità media" :valore="f.numero(Math.abs(a.velocita)) + ' cm/h'"/>
          <Riga v-if="p.livello_obiettivo !== null" titolo="Livello obiettivo" :valore="f.numero(p.livello_obiettivo) + ' cm'"/>
          <Riga v-if="a.arrivo" titolo="Arrivo stimato" :valore="f.ora(a.arrivo)"/>
          <Riga v-if="p.temperatura_iniziale !== null" titolo="Temperatura iniziale" :valore="f.numero(p.temperatura_iniziale) + ' °C'"/>
          <Riga v-if="p.temperatura_finale !== null && p.temperatura_finale !== undefined" titolo="Temperatura finale" :valore="f.numero(p.temperatura_finale) + ' °C'"/>
        </Gruppo>
        <template v-if="!p.fine && puoModificare()">
          <div style="margin-top:18px"><button class="pulsante-pieno" @click="lettura = {}"><Icona nome="righello"/> Registra livello</button></div>
          <button class="pulsante-secondario" @click="fine = true">Termina {{ p.tipo }}</button>
        </template>
        <Gruppo v-if="a.punti.length > 1" titolo="Andamento livello">
          <Grafico :serie="[{ nome: 'Livello', colore: 'var(--blu)', punti: a.punti.map(x => ({ x: x.ora, y: x.livello })) }]"
                   :riferimento="p.livello_obiettivo ?? undefined" :formato-y="v => f.numero(v) + ' cm'" valori/>
        </Gruppo>
        <Gruppo titolo="Letture">
          <Riga titolo="Inizio" :sottotitolo="f.dataOra(p.inizio)" :valore="f.numero(p.livello_iniziale) + ' cm'"/>
          <Riga v-for="(l, i) in letture" :key="l.ora + i" :titolo="quando(l.ora)"
                :sottotitolo="'+' + f.durata(new Date(l.ora) - new Date(p.inizio))"
                :valore="f.numero(l.livello) + ' cm (' + delta(i) + ')'" @click="puoModificare() && (lettura = { indice: i })"/>
          <Riga v-if="p.fine && p.livello_finale !== null" titolo="Fine" :sottotitolo="quando(p.fine)" :valore="f.numero(p.livello_finale) + ' cm'"/>
        </Gruppo>
        <Gruppo v-if="p.note" titolo="Note"><div class="riga testo-descrizione">{{ p.note }}</div></Gruppo>
        <Gruppo v-if="puoModificare()"><Riga distruttiva titolo="Elimina processo" @click="eliminaProcesso"/></Gruppo>

        <Foglio v-if="lettura" :titolo="lettura.indice !== undefined ? 'Modifica lettura' : 'Registra livello'"
                conferma="Salva" :conferma-disabilitata="bl.livello === null || primaDellInizio(bl.ora)" @annulla="lettura = null" @conferma="salvaLettura">
          <Gruppo :nota="primaDellInizio(bl.ora) ? avvisoData : ''" nota-sempre>
            <CampoData v-model="bl.ora" etichetta="Ora" con-ora/>
            <CampoNumero v-model="bl.livello" etichetta="Livello" unita="cm" negativi/>
          </Gruppo>
          <div class="azioni" style="margin-top:10px">
            <button v-for="d in [-5, -1, 1, 5]" :key="d" class="azione-grande" style="font-size:17px" @click="bl.livello = (bl.livello ?? 0) + d">{{ d > 0 ? '+' + d : d }}</button>
          </div>
          <Gruppo v-if="lettura.indice !== undefined"><Riga distruttiva titolo="Elimina lettura" @click="eliminaLettura"/></Gruppo>
        </Foglio>

        <Foglio v-if="fine" titolo="Termina processo" :conferma-disabilitata="bf.livello === null || primaDellInizio(bf.fine)"
                @annulla="fine = false" @conferma="salvaFine">
          <Gruppo :nota="primaDellInizio(bf.fine) ? avvisoData : ''" nota-sempre>
            <CampoData v-model="bf.fine" etichetta="Fine" con-ora/>
            <CampoNumero v-model="bf.livello" etichetta="Livello finale" unita="cm" negativi/>
            <CampoNumero v-model="bf.temperatura" etichetta="Temperatura acqua" unita="°C"/>
            <Riga titolo="Tempo totale" :valore="f.durata(new Date(bf.fine) - new Date(p.inizio))"/>
          </Gruppo>
          <Gruppo titolo="Note"><CampoTesto v-model="bf.note" multilinea segnaposto="Note"/></Gruppo>
        </Foglio>
        <Foglio v-if="dati" titolo="Dati del processo" :conferma-disabilitata="bd.livello === null || fineSbagliata"
                @annulla="dati = false" @conferma="salvaDati">
          <Gruppo titolo="Inizio">
            <CampoData v-model="bd.inizio" etichetta="Inizio" con-ora/>
            <CampoNumero v-model="bd.livello" etichetta="Livello iniziale" unita="cm" negativi/>
            <CampoNumero v-model="bd.obiettivo" etichetta="Livello obiettivo" unita="cm" negativi/>
            <CampoNumero v-model="bd.temperatura" etichetta="Temperatura acqua" unita="°C"/>
          </Gruppo>
          <Gruppo v-if="p.fine" titolo="Fine" :nota="fineSbagliata ? avvisoFine : ''" nota-sempre>
            <CampoData v-model="bd.fine" etichetta="Fine" con-ora/>
            <CampoNumero v-model="bd.livelloFinale" etichetta="Livello finale" unita="cm" negativi/>
            <CampoNumero v-model="bd.temperaturaFinale" etichetta="Temperatura acqua" unita="°C"/>
            <Riga titolo="Tempo totale" :valore="f.durata(new Date(bd.fine) - new Date(bd.inizio))"/>
          </Gruppo>
          <Gruppo titolo="Note"><CampoTesto v-model="bd.note" multilinea segnaposto="Note"/></Gruppo>
        </Foglio>
      </Pagina>
      <PaginaMancante v-else/>`,
    data() { return { lettura: null, fine: false, dati: false, bl: {}, bf: {}, bd: {} }; },
    computed: {
        fineSbagliata() { return !!(this.p.fine && this.bd.fine && new Date(this.bd.fine) < new Date(this.bd.inizio)); },
        avvisoFine() { return "La fine è prima dell'inizio: controlla giorno e ora."; },
        avvisoData() { return `È prima dell'inizio del processo (${f.dataOra(this.p.inizio)}): controlla giorno e ora.`; },
        p() { return db.processi_acqua.find(p => p.id === this.id); },
        a() { return analisiProcesso(this.p); },
        letture() { return [...(this.p.letture ?? [])].sort((a, b) => a.ora.localeCompare(b.ora)); }
    },
    watch: {
        lettura(v) {
            if (!v) return;
            const esistente = v.indice !== undefined ? this.letture[v.indice] : null;
            this.bl = { ora: esistente?.ora ?? new Date().toISOString(), livello: esistente?.livello ?? this.a.livello };
        },
        dati(v) {
            if (!v) return;
            this.bd = { inizio: this.p.inizio, livello: Number(this.p.livello_iniziale), obiettivo: this.p.livello_obiettivo ?? null,
                        temperatura: this.p.temperatura_iniziale ?? null, fine: this.p.fine ?? null,
                        livelloFinale: this.p.livello_finale ?? null, temperaturaFinale: this.p.temperatura_finale ?? null, note: this.p.note ?? '' };
        },
        fine(v) {
            if (!v) return;
            this.bf = { fine: this.p.fine ?? new Date().toISOString(), livello: this.p.livello_finale ?? this.a.livello,
                        temperatura: this.p.temperatura_finale ?? null, note: this.p.note ?? '' };
        }
    },
    methods: {
        puoModificare,
        /// Ora della lettura, con il giorno se è diverso da quello di inizio.
        quando(v) { return new Date(v).toDateString() === new Date(this.p.inizio).toDateString() ? f.ora(v) : f.dataOra(v); },
        primaDellInizio(v) { return !!v && new Date(v) < new Date(this.p.inizio); },
        async salvaDati() {
            const b = this.bd;
            await salva('processi_acqua', {
                ...this.p, inizio: b.inizio, livello_iniziale: b.livello, livello_obiettivo: b.obiettivo, temperatura_iniziale: b.temperatura,
                note: b.note, ...(this.p.fine ? { fine: b.fine, livello_finale: b.livelloFinale, temperatura_finale: b.temperaturaFinale } : {})
            });
            this.dati = false;
        },
        delta(i) {
            const prima = i === 0 ? Number(this.p.livello_iniziale) : Number(this.letture[i - 1].livello);
            const d = Number(this.letture[i].livello) - prima;
            return `${d >= 0 ? '+' : '−'}${f.numero(Math.abs(d))}`;
        },
        async salvaLettura() {
            const letture = [...this.letture];
            const voce = { ora: this.bl.ora, livello: this.bl.livello };
            if (this.lettura.indice !== undefined) letture[this.lettura.indice] = voce; else letture.push(voce);
            await salva('processi_acqua', { ...this.p, letture });
            this.lettura = null;
        },
        async eliminaLettura() {
            const letture = this.letture.filter((_, i) => i !== this.lettura.indice);
            await salva('processi_acqua', { ...this.p, letture });
            this.lettura = null;
        },
        async salvaFine() {
            await salva('processi_acqua', { ...this.p, fine: this.bf.fine, livello_finale: this.bf.livello,
                                            temperatura_finale: this.bf.temperatura, note: this.bf.note });
            this.fine = false;
        },
        async eliminaProcesso() {
            if (!confirm('Eliminare questo processo e le sue letture?')) return;
            await elimina('processi_acqua', this.p.id);
            indietro();
        }
    },
    setup() { return { f }; }
};

// ---------------------------------------------------------------------
// Pellet
// ---------------------------------------------------------------------
/// Registro carichi del pellet: gli acquisti del prodotto Pellet (si registrano con "Acquisto" in Gestione scorte).
const Pellet = {
    props: { operazione: Object },
    template: `
      <Gruppo titolo="Ultimo carico">
        <template v-if="ultimo">
          <Riga titolo="Data" :valore="f.data(ultimo.data)"/>
          <Riga titolo="Quantità acquistata" :valore="f.quantita(ultimo.quantita, unita)"/>
          <Riga titolo="Costo al quintale" :valore="f.euro(calcoliCarico(ultimo).prezzo)"/>
          <Riga titolo="Spesa (IVA incl.)" :valore="f.euro(ultimo.costo)"/>
          <Riga v-if="calcoliCarico(ultimo).postcarico !== null" titolo="Deposito dopo il carico" :valore="f.quantita(calcoliCarico(ultimo).postcarico, unita)"/>
        </template>
        <Riga v-else titolo="Nessun carico registrato" class="secondario"/>
      </Gruppo>
      <p v-if="!prodotto" class="gruppo-nota">Collega il prodotto Pellet dal magazzino (sezione Prodotti) per registrare i carichi con “Acquisto”.</p>
      <Gruppo v-if="carichi.length" titolo="Registro carichi" nota="Tocca una riga per modificarla">
        <div class="tabella-scorri">
          <table class="tabella">
            <thead><tr><th>Data</th><th>Fornitore</th><th>Quantità</th><th>Costo al quintale</th><th>Aliquota IVA</th><th>IVA</th><th>Totale</th><th>Pre carico</th><th>Post carico</th></tr></thead>
            <tbody>
              <tr v-for="c in (tutti ? carichi : carichi.slice(0, 1))" :key="c.id" @click="puoModificare() && (foglio = c)">
                <td>{{ f.dataTabella(c.data) }}</td><td>{{ c.fornitore || '–' }}</td><td>{{ f.quantita(c.quantita, unita) }}</td>
                <td>{{ f.euro(calcoliCarico(c).prezzo) }}</td><td>{{ f.numero(calcoliCarico(c).aliquota) }}%</td><td>{{ f.euro(calcoliCarico(c).iva) }}</td>
                <td><b>{{ f.euro(c.costo) }}</b></td>
                <td>{{ calcoliCarico(c).precarico !== null ? f.quantita(calcoliCarico(c).precarico, unita) : '–' }}</td>
                <td>{{ calcoliCarico(c).postcarico !== null ? f.quantita(calcoliCarico(c).postcarico, unita) : '–' }}</td>
              </tr>
            </tbody>
            <tfoot><tr><td>Totale</td><td></td><td>{{ f.quantita(totaleQuintali, unita) }}</td><td></td><td></td><td></td><td>{{ f.euro(totaleSpesa) }}</td><td></td><td></td></tr></tfoot>
          </table>
        </div>
        <RigaEspandi :totale="carichi.length" v-model:aperto="tutti"/>
      </Gruppo>
      <Gruppo v-if="carichi.length > 1" titolo="Costo al quintale nel tempo (IVA esclusa)">
        <Grafico :serie="[{ nome: 'Costo al quintale', colore: 'var(--arancione)', punti: carichi.map(c => ({ x: f.giorno(c.data), y: calcoliCarico(c).prezzo })) }]"
                 :formato-y="v => f.numero(v) + ' €'"/>
      </Gruppo>
      <MovimentoFoglio v-if="foglio" :prodotto="prodottoDelCarico" tipo="acquisto" :movimento="foglio" @chiudi="foglio = null"/>`,
    data() { return { foglio: null, tutti: false }; },
    computed: {
        prodotto() { return prodottiOperazione(this.operazione).find(p => p.categoria === 'pellet') ?? null; },
        prodottoDelCarico() { return db.prodotti.find(p => p.id === this.foglio?.prodotto_id); },
        unita() { return this.prodotto?.unita ?? 'q'; },
        carichi() { return carichiOrdinati(); },
        ultimo() { return this.carichi[0]; },
        totaleQuintali() { return this.carichi.reduce((s, c) => s + (Number(c.quantita) || 0), 0); },
        totaleSpesa() { return this.carichi.reduce((s, c) => s + (Number(c.costo) || 0), 0); }
    },
    methods: { puoModificare, calcoliCarico },
    setup() { return { f }; }
};

// ---------------------------------------------------------------------
// Svuotamento cenere
// ---------------------------------------------------------------------
const Cenere = {
    template: `
      <Gruppo titolo="Svuotamento cenere">
        <template v-if="svuotamenti[0]">
          <Riga titolo="Ultimo svuotamento" :valore="f.data(svuotamenti[0].data)"/>
          <Riga titolo="Giorni trascorsi" :valore="f.giorniTrascorsi(svuotamenti[0].data)"/>
        </template>
        <Riga v-else titolo="Nessuno svuotamento registrato" class="secondario"/>
        <Riga v-if="puoModificare()" azione icona="piuCerchio" titolo="Registra svuotamento" @click="foglio = {}"/>
      </Gruppo>
      <Gruppo v-if="svuotamenti.length" titolo="Storico" nota="Il consumo è calcolato dalla scorta dello svuotamento precedente, più i carichi di pellet registrati nel frattempo.">
        <Riga v-for="(s, i) in (tutti ? svuotamenti : svuotamenti.slice(0, 1))" :key="s.id" :titolo="f.data(s.data)" :sottotitolo="s.note"
              @click="puoModificare() && (foglio = { voce: s })">
          <template #fine>
            <span class="riga-valore">{{ s.scorta_kg !== null ? f.quantita(s.scorta_kg, 'kg') : '–' }}
              <br v-if="consumo(i) !== null"><small v-if="consumo(i) !== null">consumati {{ f.quantita(consumo(i), 'kg') }}</small></span>
          </template>
        </Riga>
        <RigaEspandi :totale="svuotamenti.length" v-model:aperto="tutti"/>
      </Gruppo>
      <Foglio v-if="foglio" :titolo="foglio.voce ? 'Modifica svuotamento' : 'Svuotamento cenere'" @annulla="foglio = null" @conferma="salvaSvuotamento">
        <Gruppo nota="Il carico in kg indicato dal pannello della caldaia (Deposito) al momento dello svuotamento.">
          <CampoData v-model="b.data" etichetta="Data"/>
          <CampoNumero v-model="b.scorta_kg" etichetta="Pellet a scorta" unita="kg"/>
        </Gruppo>
        <Gruppo titolo="Note"><CampoTesto v-model="b.note" multilinea segnaposto="Note"/></Gruppo>
        <Gruppo v-if="foglio.voce"><Riga distruttiva titolo="Elimina" @click="eliminaSvuotamento"/></Gruppo>
      </Foglio>`,
    data() { return { foglio: null, b: {}, tutti: false }; },
    computed: { svuotamenti() { return svuotamentiOrdinati(); } },
    watch: {
        foglio(v) { if (v) { const s = v.voce ?? {}; this.b = { data: s.data ?? f.oggiISO(), scorta_kg: s.scorta_kg ?? null, note: s.note ?? '' }; } }
    },
    methods: {
        puoModificare,
        consumo(i) { return consumoCenere(this.svuotamenti[i + 1], this.svuotamenti[i]); },
        async salvaSvuotamento() { await salva('svuotamenti_cenere', { ...this.b, id: this.foglio.voce?.id }); this.foglio = null; },
        async eliminaSvuotamento() { if (confirm('Eliminare lo svuotamento?')) { await elimina('svuotamenti_cenere', this.foglio.voce.id); this.foglio = null; } }
    },
    setup() { return { f }; }
};

// ---------------------------------------------------------------------
// Storico manutenzioni
// ---------------------------------------------------------------------
const Storico = {
    props: { operazione: Object },
    template: `
      <Gruppo titolo="Scadenze">
        <Riga v-if="!tipologie.length" titolo="Nessuna tipologia: aggiungila nelle Notifiche qui sotto." class="secondario"/>
        <Riga v-for="t in tipologie" :key="t.id" :titolo="t.nome" :sottotitolo="sottotitolo(t)">
          <template #fine><BadgeScadenza v-if="scadenza(t)" :data="scadenza(t)" :stato="stato(t)"/></template>
        </Riga>
        <Riga v-if="puoModificare() && tipologie.length" azione icona="piuCerchio" titolo="Registra manutenzione" @click="foglio = {}"/>
      </Gruppo>
      <Gruppo v-if="interventi.length" titolo="Interventi">
        <Riga v-for="i in (tutti ? interventi : interventi.slice(0, 1))" :key="i.id" :titolo="f.data(i.data)" :sottotitolo="i.note"
              @click="puoModificare() && (foglio = { voce: i })">
          <template #fine><span v-if="tipologie.length > 1" class="badge ok" style="color:var(--accento);background:var(--riempimento)">{{ nomeTipologia(i) }}</span></template>
        </Riga>
        <RigaEspandi :totale="interventi.length" v-model:aperto="tutti"/>
      </Gruppo>
      <Gruppo v-if="contratti.length || puoModificare()" titolo="Contratto di manutenzione" nota="Con una data di scadenza ricevi l'avviso prima che il contratto scada.">
        <Riga v-if="!contratti.length" titolo="Nessun contratto" class="secondario"/>
        <RigaContratto v-for="c in contratti" :key="c.id" :contratto="c" @click="apri({ nome: 'contratto', id: c.id })"/>
        <Riga v-if="puoModificare()" azione icona="documento" titolo="Aggiungi contratto" @click="nuovoContratto = true"/>
      </Gruppo>
      <Gruppo v-if="documenti.length || puoModificare()" titolo="Manuali e documenti" :nota="'I documenti allegati compaiono anche nel Manuale, sezione ' + (sezione?.nome ?? '') + '.'">
        <Riga v-if="!documenti.length" titolo="Nessun documento" class="secondario"/>
        <RigaDocumento v-for="d in documenti" :key="d.id" :documento="d"/>
        <label v-if="puoModificare()" class="riga toccabile azione"><span class="riga-icona"><Icona nome="graffetta"/></span>
          <span class="riga-testi">{{ caricamento ? 'Caricamento…' : 'Allega manuale o documento' }}</span>
          <input type="file" multiple hidden @change="allega">
        </label>
      </Gruppo>
      <Gruppo v-if="operazione.note" titolo="Note"><div class="riga testo-descrizione">{{ operazione.note }}</div></Gruppo>
      <InterventoFoglio v-if="foglio" :operazione="operazione" :intervento="foglio.voce" @chiudi="foglio = null"/>
      <ContrattoFoglio v-if="nuovoContratto" :sezione-id="operazione.sezione_id" @chiudi="nuovoContratto = false"/>`,
    data() { return { foglio: null, nuovoContratto: false, caricamento: false, tutti: false }; },
    computed: {
        tipologie() { return tipologieDi(this.operazione); },
        interventi() { return interventiDi(this.operazione); },
        sezione() { return sezioneDi(this.operazione.sezione_id); },
        contratti() { return db.contratti.filter(c => c.sezione_id === this.operazione.sezione_id); },
        documenti() { return db.documenti.filter(d => d.sezione_id === this.operazione.sezione_id).sort((a, b) => a.titolo.localeCompare(b.titolo)); }
    },
    methods: {
        apri, puoModificare,
        scadenza: t => prossimaScadenza(t),
        stato: t => statoScadenza(prossimaScadenza(t), 14),
        sottotitolo(t) {
            const periodicita = t.mesi_avviso ? (t.mesi_avviso % 12 === 0 ? (t.mesi_avviso === 12 ? 'Ogni anno' : `Ogni ${t.mesi_avviso / 12} anni`) : `Ogni ${t.mesi_avviso} mesi`) : 'Nessun avviso';
            const ultimo = ultimoInterventoDi(t);
            return `${periodicita} · ${ultimo ? 'ultima il ' + f.dataBreve(ultimo.data) : 'nessun intervento registrato'}`;
        },
        nomeTipologia(i) { return db.tipologie.find(t => t.id === i.tipologia_id)?.nome ?? ''; },
        async allega(e) {
            this.caricamento = true;
            try {
                for (const file of e.target.files) {
                    const percorso = await caricaFile(file, 'documenti');
                    await salva('documenti', { sezione_id: this.operazione.sezione_id, titolo: file.name.replace(/\.[^.]+$/, ''),
                                               nome_file: file.name, percorso, dimensione: file.size });
                }
            } finally { this.caricamento = false; e.target.value = ''; }
        }
    },
    setup() { return { f }; }
};

const InterventoFoglio = {
    props: { operazione: Object, intervento: Object },
    emits: ['chiudi'],
    template: `
      <Foglio :titolo="intervento ? 'Modifica manutenzione' : 'Nuova manutenzione'" @annulla="$emit('chiudi')" @conferma="salvaIntervento">
        <Gruppo>
          <CampoData v-model="b.data" etichetta="Data"/>
          <CampoScelta v-if="tipologie.length > 1" v-model="b.tipologia_id" etichetta="Tipo" :opzioni="tipologie.map(t => ({ valore: t.id, nome: t.nome }))"/>
        </Gruppo>
        <Gruppo titolo="Note"><CampoTesto v-model="b.note" multilinea segnaposto="Cosa è stato fatto, chi l'ha fatto…"/></Gruppo>
        <Gruppo v-if="intervento"><Riga distruttiva titolo="Elimina intervento" @click="eliminaIntervento"/></Gruppo>
      </Foglio>`,
    data() {
        const i = this.intervento ?? {};
        return { b: { data: i.data ?? f.oggiISO(), tipologia_id: i.tipologia_id ?? tipologieDi(this.operazione)[0]?.id ?? null, note: i.note ?? '' } };
    },
    computed: { tipologie() { return tipologieDi(this.operazione); } },
    methods: {
        async salvaIntervento() { await salva('interventi', { ...this.b, id: this.intervento?.id, operazione_id: this.operazione.id }); this.$emit('chiudi'); },
        async eliminaIntervento() { if (confirm("Eliminare l'intervento?")) { await elimina('interventi', this.intervento.id); this.$emit('chiudi'); } }
    }
};

// Le sezioni vengono registrate come componenti locali della pagina operazione.
OperazionePagina.components = { MisurePH, CambioAcqua, Pellet, Cenere, Storico, NotificheOperazione, DescrizioneFoglio };
CambioAcqua.components = { AvvioFoglio };
MisurePH.components = { MisuraFoglio };
Storico.components = { InterventoFoglio };
