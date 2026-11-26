// Scheda di un'operazione (pH, ossigeno, cambio acqua, pellet, cenere, storico manutenzioni, generica).
import { db, stato, salva, elimina, caricaFile, urlFile, puoModificare } from '../store.js';
import { riduciFoto } from './manuale.js';
import { nav, apri, apriDaElenco, indietro } from '../nav.js';
import * as f from '../format.js';
import {
    TIPI_OPERAZIONE, allarmi, tipologieDi, interventiDi, ultimoInterventoDi, prossimaScadenza,
    statoScadenza, analisiProcesso, calcoliCarico, carichiOrdinati, svuotamentiOrdinati, consumoCenere,
    prodottoDi, prodottiOperazione, operazioneDiProdotto, categoriaPerOperazione, sezioneDi, nomeMovimento, nomeEsecuzione,
    coloreImpianto, fornitoreContratto, lettureDeposito, PIANI, STATI_PIANO, analisiScorta, sottoScorta,
    unitaScorta, quantitaScorta, movimentiDi, nomeBimestre, mesiBimestre, nomeMeseLungo, nomeMeseAnno, periodoBimestre, bolletteOrdinate, bollettaDi,
    dataBolletta, serieEnergia, sommaEnergia, altriCostiEnergia
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

        <template v-if="!registro">
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
            <template v-if="o.tipo === 'pellet' && prodottoScelto.categoria === 'pellet'">
              <DepositoPellet :prodotto="prodottoScelto" :key="'d' + prodottoScelto.id"/>
              <Pellet :operazione="o"/>
            </template>
            <SezioniScorta v-else :prodotto="prodottoScelto" :key="prodottoScelto.id" con-grafici/>
          </template>

          <!-- Altre operazioni specifiche (misure pH, cambio acqua, carichi pellet, cenere) -->
          <template v-if="['ph', 'cambioAcqua', 'cenere'].includes(o.tipo) || (o.tipo === 'pellet' && !prodottoScelto)">
            <h2 class="sezione-operazione">{{ usaProdotti ? 'Altre operazioni' : 'Registro' }}</h2>
            <MisurePH v-if="o.tipo === 'ph'"/>
            <CambioAcqua v-if="o.tipo === 'cambioAcqua'"/>
            <Pellet v-if="o.tipo === 'pellet' && !prodottoScelto" :operazione="o"/>
            <Cenere v-if="o.tipo === 'cenere'"/>
          </template>
        </template>
        <template v-else>
          <Bollette v-if="o.tipo === 'bollette'" :operazione="o"/>
          <Storico v-else :operazione="o"/>
        </template>

        <template v-if="!registro && (puoModificare() || avvisiImpostati)">
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
        /// Manutenzioni e categorie di lavori: solo registro (niente prodotti, scorte e avvisi).
        registro() { return ['storico', 'lavori', 'bollette'].includes(this.o.tipo); },
        usaProdotti() { return !['storico', 'lavori', 'bollette', 'cambioAcqua', 'cenere'].includes(this.o.tipo); },
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
        <Gruppo v-if="operazione.tipo !== 'storico'"><Riga distruttiva titolo="Elimina operazione" @click="eliminaOperazione"/></Gruppo>
        <p v-else class="gruppo-nota">Manutenzioni è l'operazione standard di ogni impianto e non si può eliminare.</p>
      </Foglio>`,
    data() {
        return { titolo: this.operazione.titolo ?? '', icona: this.operazione.icona || '', descrizione: this.operazione.descrizione ?? '',
                 passaggi: [...(this.operazione.passaggi ?? [])], note: this.operazione.note ?? '' };
    },
    computed: { iconaTipo() { return TIPI_OPERAZIONE[this.operazione.tipo]?.icona ?? 'lista'; } },
    methods: {
        coloreImpianto,
        sposta(i, d) { const [p] = this.passaggi.splice(i, 1); this.passaggi.splice(i + d, 0, p); },
        async eliminaOperazione() {
            const n = db.interventi.filter(i => i.operazione_id === this.operazione.id).length;
            const extra = n ? ` e i suoi ${n} interventi` : '';
            if (!confirm(`Eliminare l'operazione "${this.operazione.titolo}"${extra}? I prodotti collegati restano nel Magazzino.`)) return;
            this.$emit('chiudi');
            indietro();
            // I prodotti collegati restano nel magazzino, scollegati.
            for (const p of db.prodotti.filter(p => p.operazione_id === this.operazione.id)) await salva('prodotti', { ...p, operazione_id: null });
            await elimina('operazioni', this.operazione.id);
        },
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
          <CampoNumero v-if="p.scorta_minima > 0 && modifica" etichetta="Sotto" :unita="unitaScorta(p).unita"
                       :model-value="Number(p.scorta_minima) * unitaScorta(p).fattore"
                       @fine="v => v > 0 && v / unitaScorta(p).fattore !== Number(p.scorta_minima) && salva('prodotti', { ...p, scorta_minima: v / unitaScorta(p).fattore })"/>
          <Riga v-else-if="p.scorta_minima > 0" titolo="Sotto" :valore="quantitaScorta(p, p.scorta_minima)"/>
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
        salva, unitaScorta, quantitaScorta,
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
      <MovimentoFoglio v-if="foglio" :prodotto-iniziale="prodottoDelCarico" tipo="acquisto" :movimento="foglio" @chiudi="foglio = null"/>`,
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

/// Deposito del pellet: giacenza, acquisti e letture del pannello (kg) con lo stato dei piani.
const DepositoPellet = {
    props: { prodotto: Object },
    template: `
      <Gruppo titolo="Scorta">
        <div class="valore-grande">
          <div class="etichetta">Pellet nel deposito</div>
          <div class="numero" :class="{ rosso: basso }">{{ quantitaScorta(prodotto, giacenza) }}</div>
          <div v-if="basso" class="arancione-t" style="font-size:14px">Sotto la scorta minima ({{ quantitaScorta(prodotto, prodotto.scorta_minima) }})</div>
        </div>
        <Riga v-if="letture[0]" titolo="Ultima lettura" :valore="f.dataOra(letture[0].momento) + ' · ' + f.quantita(letture[0].kg, 'kg')"/>
        <Riga v-else titolo="Nessuna lettura del deposito" class="secondario"/>
        <template v-if="carico">
          <Riga titolo="Ultimo carico" :valore="f.data(carico.data) + ' · ' + f.quantita(carico.quantita, prodotto.unita)"/>
          <Riga titolo="Costo al quintale" :valore="f.euro(calcoliCarico(carico).prezzo)"/>
          <Riga titolo="Spesa (IVA incl.)" :valore="f.euro(carico.costo)"/>
        </template>
      </Gruppo>
      <Azioni v-if="puoModificare()" :voci="[{ id: 'acquisto', nome: 'Acquisto', icona: 'carrello' }, { id: 'lettura', nome: 'Nuova lettura', icona: 'righello' }]"
              @scegli="t => t === 'acquisto' ? (acquisto = true) : (lettura = {})"/>
      <Gruppo v-if="letture.length > 1" titolo="Andamento del deposito"
              :nota="Number(prodotto.scorta_minima) > 0 ? 'La linea tratteggiata è la scorta minima.' : ''" nota-sempre>
        <Grafico :serie="[{ nome: 'Deposito', colore: 'var(--arancione)', punti: punti }]" :formato-y="v => f.numero(v) + ' kg'"
                 :min-y="0" :max-y="3600"
                 :riferimento="Number(prodotto.scorta_minima) > 0 ? prodotto.scorta_minima * 100 : null" valori/>
      </Gruppo>
      <Gruppo v-if="letture.length" titolo="Letture del deposito">
        <Riga v-for="(l, i) in (tutti ? letture : letture.slice(0, 1))" :key="l.id" :titolo="f.dataOra(l.momento)" :sottotitolo="descriviPiani(l)"
              @click="puoModificare() && (lettura = { voce: l })">
          <template #fine>
            <span class="riga-valore">{{ f.quantita(l.kg, 'kg') }}<br v-if="delta(i) !== null">
              <small v-if="delta(i) !== null" class="secondario">{{ delta(i) >= 0 ? '−' : '+' }}{{ f.quantita(Math.abs(delta(i)), 'kg') }}</small></span>
          </template>
        </Riga>
        <RigaEspandi :totale="letture.length" v-model:aperto="tutti"/>
      </Gruppo>
      <MovimentoFoglio v-if="acquisto" :prodotto-iniziale="prodotto" tipo="acquisto" @chiudi="acquisto = false"/>
      <Foglio v-if="lettura" :titolo="lettura.voce ? 'Modifica lettura' : 'Nuova lettura'" :conferma-disabilitata="b.kg === null"
              @annulla="lettura = null" @conferma="salvaLettura">
        <Gruppo nota="I kg indicati dal pannello della caldaia (Deposito).">
          <CampoData v-model="b.momento" etichetta="Data e ora" con-ora/>
          <CampoNumero v-model="b.kg" etichetta="Pellet nel deposito" unita="kg"/>
        </Gruppo>
        <Gruppo titolo="Impianto">
          <CampoScelta v-for="p in PIANI" :key="p" v-model="b.piani[p]" :etichetta="p" :opzioni="statiPiano"/>
        </Gruppo>
        <Gruppo titolo="Note"><CampoTesto v-model="b.note" multilinea segnaposto="Note"/></Gruppo>
        <Gruppo v-if="lettura.voce"><Riga distruttiva titolo="Elimina lettura" @click="eliminaLettura"/></Gruppo>
      </Foglio>`,
    data() { return { acquisto: false, lettura: null, tutti: false, b: {}, PIANI }; },
    watch: {
        lettura(v) {
            if (!v) return;
            const l = v.voce ?? {}, ultima = this.letture[0];
            // Nuova lettura: data e ora di adesso, stato dei piani come nell'ultima lettura.
            const piani = Object.fromEntries(PIANI.map(p => [p, (l.piani ?? ultima?.piani ?? {})[p] ?? 'off']));
            this.b = { momento: l.momento ?? new Date().toISOString(), kg: l.kg != null ? Number(l.kg) : null, piani, note: l.note ?? '' };
        }
    },
    computed: {
        letture() { return lettureDeposito(this.prodotto); },
        carico() { return movimentiDi(this.prodotto).find(m => m.tipo === 'acquisto') ?? null; },
        giacenza() { return analisiScorta(this.prodotto).giacenza; },
        basso() { return sottoScorta(this.prodotto); },
        punti() { return [...this.letture].reverse().map(l => ({ x: new Date(l.momento), y: Number(l.kg) })); },
        statiPiano() { return STATI_PIANO.map(([valore, nome]) => ({ valore, nome })); }
    },
    methods: {
        puoModificare, quantitaScorta, calcoliCarico,
        /// Consumo rispetto alla lettura precedente (positivo = pellet bruciato).
        delta(i) { const prima = this.letture[i + 1]; return prima ? Number(prima.kg) - Number(this.letture[i].kg) : null; },
        descriviPiani(l) {
            const nomi = Object.fromEntries(STATI_PIANO);
            const accesi = PIANI.filter(p => (l.piani ?? {})[p] && l.piani[p] !== 'off').map(p => `${p} ${nomi[l.piani[p]].toLowerCase()}`);
            return [accesi.join(' · ') || (Object.keys(l.piani ?? {}).length ? 'Tutto spento' : ''), l.note].filter(Boolean).join(' · ');
        },
        async salvaLettura() {
            await salva('letture_deposito', { ...(this.lettura.voce ?? {}), id: this.lettura.voce?.id, prodotto_id: this.prodotto.id,
                                             momento: this.b.momento, kg: this.b.kg, piani: this.b.piani, note: this.b.note.trim() });
            this.lettura = null;
        },
        async eliminaLettura() {
            if (!confirm('Eliminare la lettura?')) return;
            await elimina('letture_deposito', this.lettura.voce.id);
            this.lettura = null;
        }
    },
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
// Bollette luce: fornitura, andamento in stile app Borsa, confronto per mese, numeri chiave ed elenco
// ---------------------------------------------------------------------
const numeroONull = v => v === null || v === undefined || v === '' ? null : Number(v);
const formatoPrezzo = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/// "0,27 €/kWh"
const prezzoKwh = v => `${formatoPrezzo.format(v)} €/kWh`;
const INTERVALLI = [
    { id: '6M', mesi: 6, nome: 'Ultimi 6 mesi', prima: 'ai 6 mesi prima' },
    { id: '1A', mesi: 12, nome: 'Ultimo anno', prima: "all'anno prima" },
    { id: '2A', mesi: 24, nome: 'Ultimi 2 anni', prima: 'ai 2 anni prima' },
    { id: '5A', mesi: 60, nome: 'Ultimi 5 anni', prima: 'ai 5 anni prima' },
    { id: 'Tutto', mesi: null }
];
const MISURE = {
    kwh: { nome: 'Consumo', unita: 'kWh', colore: '#FF9F0A', valore: m => m.kwh, somma: t => t.kwh, testo: v => f.quantita(Math.round(v), 'kWh'), asse: v => f.numero(v) },
    euro: { nome: 'Costo', unita: '', colore: '#0A84FF', valore: m => m.euro, somma: t => t.euro, testo: v => f.euro(v), asse: v => f.numero(v) + ' €' },
    prezzo: { nome: 'Prezzo', unita: '€/kWh', colore: '#BF5AF2', valore: m => (m.kwh > 0 && m.euro !== null ? m.euro / m.kwh : null), somma: t => t.prezzo,
              testo: v => prezzoKwh(v), asse: v => formatoPrezzo.format(v) }
};
const CAMPI_FORNITURA = [
    ['pod', 'POD'], ['codice_contatore', 'Codice contatore'], ['fornitore', 'Fornitore'], ['numero_cliente', 'Numero cliente'],
    ['codice_fiscale', 'C.F. / Partita IVA'], ['indirizzo', 'Indirizzo di fornitura']
];

const Bollette = {
    props: { operazione: Object },
    template: `
      <!-- Dati della fornitura: si scrivono a mano, restano solo nel database -->
      <Gruppo titolo="Fornitura">
        <Riga v-for="[k, nome] in campiFornitura" v-show="fornitura[k]" :key="k" :titolo="nome" :valore="fornitura[k]"/>
        <Riga v-if="fornitura.potenza_impegnata" titolo="Potenza impegnata" :valore="f.numero(fornitura.potenza_impegnata) + ' kW'"/>
        <Riga v-if="!haFornitura" titolo="Nessun dato della fornitura" class="secondario"/>
        <Riga v-if="puoModificare()" azione icona="matita" :titolo="haFornitura ? 'Modifica dati della fornitura' : 'Aggiungi i dati della fornitura'" @click="apriFornitura"/>
      </Gruppo>

      <template v-if="serie.length">
        <h2 class="sezione-operazione">Andamento</h2>
        <div class="scheda-borsa">
          <div class="segmenti">
            <button v-for="(m, k) in MISURE" :key="k" :class="{ attivo: misura === k }" @click="misura = k">{{ m.nome }}</button>
          </div>
          <div class="borsa-testa">
            <small>{{ testa.etichetta }}</small>
            <b>{{ testa.valore }}</b>
            <span v-if="testa.variazione" class="borsa-variazione" :class="testa.verso">{{ testa.variazione }}</span>
          </div>
          <GraficoBorsa :punti="punti" :colore="coloreLinea" :formato="MISURE[misura].asse" :media="mediaFinestra" :zero="misura !== 'prezzo'" :unita="MISURE[misura].unita" @scorri="i => scorso = i"/>
          <div class="segmenti segmenti-intervallo">
            <button v-for="r in intervalli" :key="r.id" :class="{ attivo: intervallo === r.id }" @click="intervallo = r.id">{{ r.id }}</button>
          </div>
          <p class="borsa-nota">{{ notaGrafico }}</p>
        </div>

        <h2 class="sezione-operazione">Confronto per mese</h2>
        <div class="segmenti">
          <button :class="{ attivo: misuraConfronto === 'kwh' }" @click="misuraConfronto = 'kwh'">Consumo</button>
          <button :class="{ attivo: misuraConfronto === 'euro' }" @click="misuraConfronto = 'euro'">Costo</button>
        </div>
        <Gruppo nota="Lo stesso mese negli ultimi anni: tocca un mese per leggere i valori." nota-sempre>
          <BarreAnni :serie="serieAnni" :formato="misuraConfronto === 'kwh' ? v => f.quantita(Math.round(v), 'kWh') : v => f.euro(v)"/>
        </Gruppo>

        <h2 class="sezione-operazione">Numeri chiave</h2>
        <div class="numeri-chiave">
          <div v-for="n in numeriChiave" :key="n.nome"><small>{{ n.nome }}</small><b>{{ n.valore }}</b><span v-if="n.dettaglio">{{ n.dettaglio }}</span></div>
        </div>
      </template>

      <h2 class="sezione-operazione">Bollette</h2>
      <div v-if="anni.length > 1" class="segmenti segmenti-anni">
        <button v-for="a in anni" :key="a" :class="{ attivo: a === anno }" @click="annoScelto = a">{{ a }}</button>
      </div>
      <Gruppo>
        <Riga v-if="puoModificare()" azione icona="piuCerchio" titolo="Nuova bolletta o altro costo" @click="foglio = {}"/>
        <Riga v-if="!vociAnno.length" titolo="Nessuna bolletta registrata" class="secondario"/>
        <Riga v-for="b in vociAnno" :key="b.id" :icona="b.tipo === 'altro' ? 'carrello' : 'lampadina'" :colore="b.tipo === 'altro' ? 'var(--secondario)' : '#FFB800'"
              :titolo="titoloVoce(b)" :sottotitolo="dettaglio(b)"
              :valore="b.importo !== null && b.importo !== undefined ? f.euro(b.importo) : '–'" :freccia="puoModificare()" @click="puoModificare() && (foglio = { voce: b })"/>
      </Gruppo>

      <Foglio v-if="foglio" :titolo="foglio.voce ? 'Modifica' : 'Nuova voce'" :conferma-disabilitata="altro ? !b.dal : !b.anno || !b.bimestre"
              @annulla="foglio = null" @conferma="salvaBolletta">
        <Gruppo :nota="doppione ? 'Esiste già una bolletta per questo bimestre: salvando la sostituisci.' : ''">
          <CampoScelta v-model="b.tipo" etichetta="Tipo" :opzioni="[{ valore: 'bimestre', nome: 'Bimestre' }, { valore: 'altro', nome: 'Altro (es. allacciamento)' }]"/>
          <template v-if="!altro">
            <CampoScelta :model-value="b.anno" etichetta="Anno" :opzioni="opzioniAnni" @update:model-value="v => cambiaPeriodo(Number(v), b.bimestre)"/>
            <CampoScelta :model-value="b.bimestre" etichetta="Bimestre" :opzioni="opzioniBimestri" @update:model-value="v => cambiaPeriodo(b.anno, Number(v))"/>
            <CampoData v-model="b.dal" etichetta="Dal"/>
            <CampoData v-model="b.al" etichetta="Al"/>
          </template>
          <CampoData v-else v-model="b.dal" etichetta="Data"/>
          <CampoTesto v-model="b.fornitore" etichetta="Fornitore" segnaposto="Es. Eni Plenitude"/>
        </Gruppo>
        <Gruppo :nota="altro ? '' : 'Il totale da pagare in prima pagina.'">
          <CampoNumero v-model="b.importo" etichetta="Importo" unita="€"/>
        </Gruppo>
        <Gruppo v-if="!altro" nota="Consumo totale fatturato del periodo. I kWh dei singoli mesi sono nella tabella “Letture e consumi”: se li lasci vuoti il consumo si divide in base ai giorni.">
          <CampoNumero v-model="b.kwh" etichetta="Consumo" unita="kWh"/>
          <CampoNumero v-model="b.kwh_mese1" :etichetta="'Di cui ' + nomeMeseLungo((b.bimestre - 1) * 2)" unita="kWh"/>
          <CampoNumero v-model="b.kwh_mese2" :etichetta="'Di cui ' + nomeMeseLungo((b.bimestre - 1) * 2 + 1)" unita="kWh"/>
        </Gruppo>
        <Gruppo :titolo="altro ? 'Descrizione' : 'Note'"><CampoTesto v-model="b.note" multilinea :segnaposto="altro ? 'Es. allacciamento, aumento di potenza…' : 'Note'"/></Gruppo>
        <Gruppo v-if="foglio.voce"><Riga distruttiva titolo="Elimina" @click="eliminaBolletta"/></Gruppo>
      </Foglio>

      <Foglio v-if="bozzaFornitura" titolo="Fornitura" @annulla="bozzaFornitura = null" @conferma="salvaFornitura">
        <Gruppo nota="Questi dati restano solo nel database della famiglia.">
          <CampoTesto v-for="[k, nome] in campiFornitura" :key="k" v-model="bozzaFornitura[k]" :etichetta="nome"/>
          <CampoNumero v-model="bozzaFornitura.potenza_impegnata" etichetta="Potenza impegnata" unita="kW"/>
        </Gruppo>
      </Foglio>`,
    data() {
        return { foglio: null, b: {}, annoScelto: null, misura: 'kwh', misuraConfronto: 'kwh', intervallo: '1A', scorso: null,
                 bozzaFornitura: null, MISURE, campiFornitura: CAMPI_FORNITURA };
    },
    computed: {
        fornitura() { return this.operazione.fornitura ?? {}; },
        haFornitura() { return CAMPI_FORNITURA.some(([k]) => this.fornitura[k]) || !!this.fornitura.potenza_impegnata; },
        altro() { return this.b.tipo === 'altro'; },
        serie() { return serieEnergia(); },
        intervalli() { return INTERVALLI.filter(r => r.mesi === null || r.mesi < this.serie.length + 6); },
        finestraIntervallo() { return INTERVALLI.find(r => r.id === this.intervallo) ?? INTERVALLI[1]; },
        /// Mesi mostrati: gli ultimi N fino all'ultima bolletta.
        finestra() { const n = this.finestraIntervallo.mesi; return n ? this.serie.slice(-n) : this.serie; },
        /// Gli N mesi prima, per la variazione (solo se ci sono tutti).
        finestraPrima() {
            const n = this.finestraIntervallo.mesi;
            if (!n || this.serie.length < 2 * n) return null;
            return this.serie.slice(-2 * n, -n);
        },
        punti() { const m = MISURE[this.misura]; return this.finestra.map(p => ({ x: p.data, y: m.valore(p) })); },
        totaleFinestra() { return sommaEnergia(this.finestra); },
        totalePrima() { return this.finestraPrima ? sommaEnergia(this.finestraPrima) : null; },
        /// Media mensile del periodo (linea tratteggiata); per il prezzo è il prezzo medio.
        mediaFinestra() {
            if (this.misura === 'prezzo') return this.totaleFinestra.prezzo;
            const v = this.punti.map(p => p.y).filter(y => y !== null);
            return v.length ? v.reduce((t, y) => t + y, 0) / v.length : null;
        },
        variazione() {
            const m = MISURE[this.misura], ora = m.somma(this.totaleFinestra), prima = this.totalePrima ? m.somma(this.totalePrima) : null;
            if (ora === null || prima === null || !(prima > 0)) return null;
            return (ora - prima) / prima * 100;
        },
        /// Consumare o spendere meno è un bene: verde se scende, rosso se sale (al contrario della Borsa).
        coloreLinea() { const v = this.variazione; return v === null || Math.round(v) === 0 ? MISURE[this.misura].colore : v < 0 ? 'var(--verde)' : 'var(--rosso)'; },
        testa() {
            const m = MISURE[this.misura];
            if (this.scorso !== null && this.finestra[this.scorso]) {
                const p = this.finestra[this.scorso], v = m.valore(p);
                return { etichetta: nomeMeseAnno(p.chiave), valore: v !== null ? m.testo(v) : '–' };
            }
            const r = this.finestraIntervallo;
            const etichetta = (r.mesi ? r.nome : 'Dal ' + nomeMeseAnno(this.serie[0].chiave)) + (this.misura === 'prezzo' ? ' · prezzo medio' : '');
            const v = m.somma(this.totaleFinestra), x = this.variazione;
            if (x === null) return { etichetta, valore: v !== null ? m.testo(v) : '–' };
            const p = Math.round(x);
            return { etichetta, valore: m.testo(v), verso: p === 0 ? '' : p < 0 ? 'meglio' : 'peggio',
                     variazione: p === 0 ? 'Uguale rispetto ' + r.prima : `${p < 0 ? '▼' : '▲'} ${Math.abs(p)}% rispetto ${r.prima}` };
        },
        notaGrafico() {
            return this.misura === 'euro' ? "Il costo di ogni mese è l'importo del bimestre diviso in base ai kWh. Gli altri costi (allacciamenti…) non sono nel grafico."
                : this.misura === 'prezzo' ? 'Prezzo pagato per ogni kWh, tutto compreso (importo ÷ consumo).'
                : 'La linea tratteggiata è la media mensile del periodo. Scorri sul grafico per leggere ogni mese.';
        },
        /// Ultimi quattro anni con dati, dal più vecchio (più chiaro) al più recente.
        serieAnni() {
            const anni = [...new Set(this.serie.map(p => Number(p.chiave.slice(0, 4))))].slice(-4);
            const colore = this.misuraConfronto === 'kwh' ? '#FF9F0A' : '#0A84FF', opacita = [100, 72, 46, 26];
            return anni.map((anno, i) => ({
                anno, colore: `color-mix(in srgb, ${colore} ${opacita[anni.length - 1 - i]}%, var(--cella))`,
                valori: Array.from({ length: 12 }, (_, m) => {
                    const p = this.serie.find(x => x.chiave === `${anno}-${String(m + 1).padStart(2, '0')}`);
                    return p ? (this.misuraConfronto === 'kwh' ? p.kwh : p.euro) : null;
                })
            }));
        },
        numeriChiave() {
            const tutto = sommaEnergia(this.serie), anno = sommaEnergia(this.serie.slice(-12));
            const conKwh = this.serie.filter(p => p.kwh !== null), conEuro = this.serie.filter(p => p.euro !== null);
            const alto = conKwh.reduce((a, p) => (!a || p.kwh > a.kwh ? p : a), null);
            const basso = conKwh.reduce((a, p) => (!a || p.kwh < a.kwh ? p : a), null);
            const caro = db.bollette.filter(b => b.tipo !== 'altro' && Number(b.importo) > 0).sort((a, b) => b.importo - a.importo)[0];
            const altri = altriCostiEnergia().reduce((t, b) => t + (Number(b.importo) || 0), 0);
            const voci = [
                { nome: 'Consumo totale', valore: f.quantita(Math.round(tutto.kwh), 'kWh'), dettaglio: 'dal ' + nomeMeseAnno(this.serie[0].chiave) },
                { nome: 'Costo totale', valore: f.euro(tutto.euro + altri), dettaglio: altri ? `di cui altri costi ${f.euro(altri)}` : 'bollette' },
                { nome: 'Ultimi 12 mesi', valore: f.quantita(Math.round(anno.kwh), 'kWh'), dettaglio: f.euro(anno.euro) },
                { nome: 'Media mensile', valore: f.quantita(Math.round(tutto.kwh / Math.max(1, conKwh.length)), 'kWh'), dettaglio: f.euro(tutto.euro / Math.max(1, conEuro.length)) },
                { nome: 'Prezzo medio', valore: tutto.prezzo ? prezzoKwh(tutto.prezzo) : '–', dettaglio: anno.prezzo ? `ultimi 12 mesi ${prezzoKwh(anno.prezzo)}` : '' }
            ];
            if (alto) voci.push({ nome: 'Mese con più consumo', valore: f.quantita(Math.round(alto.kwh), 'kWh'), dettaglio: nomeMeseAnno(alto.chiave) });
            if (basso) voci.push({ nome: 'Mese con meno consumo', valore: f.quantita(Math.round(basso.kwh), 'kWh'), dettaglio: nomeMeseAnno(basso.chiave) });
            if (caro) voci.push({ nome: 'Bolletta più cara', valore: f.euro(caro.importo), dettaglio: nomeBimestre(caro.anno, caro.bimestre) });
            if (this.fornitura.potenza_impegnata) voci.push({ nome: 'Potenza impegnata', valore: f.numero(this.fornitura.potenza_impegnata) + ' kW', dettaglio: this.fornitura.fornitore || '' });
            return voci;
        },
        tutte() { return bolletteOrdinate(); },
        anni() { return [...new Set(this.tutte.map(b => Number(dataBolletta(b).slice(0, 4))))].sort((a, b) => b - a); },
        anno() { return this.anni.includes(this.annoScelto) ? this.annoScelto : this.anni[0]; },
        vociAnno() { return this.tutte.filter(b => Number(dataBolletta(b).slice(0, 4)) === this.anno); },
        opzioniAnni() {
            const oggi = new Date().getFullYear(), primo = Math.min(oggi - 5, ...db.bollette.map(b => b.anno ?? oggi));
            return Array.from({ length: oggi + 2 - primo }, (_, i) => oggi + 1 - i).map(a => ({ valore: a, nome: String(a) }));
        },
        opzioniBimestri() { return [1, 2, 3, 4, 5, 6].map(n => ({ valore: n, nome: `${n} · ${mesiBimestre(n)}` })); },
        doppione() { if (this.altro) return false; const d = bollettaDi(this.b.anno, this.b.bimestre); return d && d.id !== this.foglio?.voce?.id; }
    },
    watch: {
        intervallo() { this.scorso = null; },
        misura() { this.scorso = null; },
        foglio(v) {
            if (!v) return;
            const x = v.voce;
            if (x) {
                this.b = { ...x, tipo: x.tipo || 'bimestre', fornitore: x.fornitore ?? '', importo: numeroONull(x.importo), kwh: numeroONull(x.kwh),
                           kwh_mese1: numeroONull(x.kwh_mese1), kwh_mese2: numeroONull(x.kwh_mese2), note: x.note ?? '' };
                return;
            }
            // Nuova: il bimestre dopo l'ultima bolletta, altrimenti quello appena concluso.
            const ultima = this.tutte.find(b => b.tipo !== 'altro');
            let anno, bim;
            if (ultima) { anno = ultima.bimestre === 6 ? ultima.anno + 1 : ultima.anno; bim = ultima.bimestre % 6 + 1; }
            else { const d = new Date(), corrente = Math.floor(d.getMonth() / 2) + 1; anno = corrente === 1 ? d.getFullYear() - 1 : d.getFullYear(); bim = corrente === 1 ? 6 : corrente - 1; }
            this.b = { tipo: 'bimestre', anno, bimestre: bim, ...periodoBimestre(anno, bim), fornitore: ultima?.fornitore || this.fornitura.fornitore || '',
                       importo: null, kwh: null, kwh_mese1: null, kwh_mese2: null, note: '' };
        },
        'b.tipo'(t, prima) {
            // Passando ad "Altro" la data proposta è oggi.
            if (t === 'altro' && prima === 'bimestre' && !this.foglio?.voce) this.b.dal = f.oggiISO();
        }
    },
    methods: {
        puoModificare, nomeMeseLungo,
        cambiaPeriodo(anno, bimestre) { this.b = { ...this.b, anno, bimestre, ...periodoBimestre(anno, bimestre) }; },
        titoloVoce(b) { return b.tipo === 'altro' ? (b.note?.trim() || 'Altro costo') : `${b.bimestre} · ${mesiBimestre(b.bimestre)}`; },
        dettaglio(b) {
            if (b.tipo === 'altro') return [f.data(b.dal), b.fornitore].filter(Boolean).join(' · ');
            const kwh = numeroONull(b.kwh), prima = bollettaDi(b.anno - 1, b.bimestre), kPrima = numeroONull(prima?.kwh);
            const varia = kwh !== null && kPrima > 0 ? Math.round((kwh - kPrima) / kPrima * 100) : null;
            const prezzo = kwh > 0 && numeroONull(b.importo) !== null ? prezzoKwh(b.importo / kwh) : '';
            return [kwh !== null ? f.quantita(kwh, 'kWh') : '', prezzo, varia !== null ? `${varia > 0 ? '+' : varia < 0 ? '−' : ''}${Math.abs(varia)}% kWh vs ${b.anno - 1}` : '',
                    b.fornitore, b.note].filter(Boolean).join(' · ');
        },
        apriFornitura() { this.bozzaFornitura = { ...Object.fromEntries(CAMPI_FORNITURA.map(([k]) => [k, ''])), potenza_impegnata: null, ...this.fornitura }; },
        async salvaFornitura() {
            const pulita = Object.fromEntries(Object.entries(this.bozzaFornitura).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
            await salva('operazioni', { ...this.operazione, fornitura: pulita });
            this.bozzaFornitura = null;
        },
        async salvaBolletta() {
            const b = { ...this.b, fornitore: (this.b.fornitore ?? '').trim(), note: (this.b.note ?? '').trim() };
            if (b.tipo === 'altro') Object.assign(b, { anno: Number(b.dal.slice(0, 4)), bimestre: null, al: b.dal, kwh: null, kwh_mese1: null, kwh_mese2: null });
            // Totale non scritto ma mesi sì: il totale è la loro somma.
            else if (b.kwh === null && (b.kwh_mese1 !== null || b.kwh_mese2 !== null)) b.kwh = (b.kwh_mese1 ?? 0) + (b.kwh_mese2 ?? 0);
            const esistente = b.tipo === 'altro' ? null : bollettaDi(b.anno, b.bimestre);
            const id = this.foglio.voce?.id ?? esistente?.id;
            if (this.foglio.voce && esistente && esistente.id !== this.foglio.voce.id) await elimina('bollette', esistente.id);
            await salva('bollette', { ...b, id, operazione_id: this.operazione.id });
            this.annoScelto = Number(dataBolletta(b).slice(0, 4));
            this.foglio = null;
        },
        async eliminaBolletta() {
            if (!confirm('Eliminare questa voce?')) return;
            await elimina('bollette', this.foglio.voce.id);
            this.foglio = null;
        }
    },
    setup() { return { f }; }
};

// ---------------------------------------------------------------------
// Storico manutenzioni
// ---------------------------------------------------------------------
const Storico = {
    props: { operazione: Object },
    template: `
      <h2 class="sezione-operazione">{{ lavori ? 'Registro lavori' : 'Registro interventi' }}</h2>
      <Gruppo>
        <Riga v-if="!interventi.length" :titolo="lavori ? 'Nessun lavoro registrato' : 'Nessun intervento registrato'" class="secondario"/>
        <Riga v-for="i in (tutti ? interventi : interventi.slice(0, 3))" :key="i.id" :titolo="i.titolo || f.data(i.data)"
              :sottotitolo="(i.titolo ? f.dataBreve(i.data) + ' · ' : '') + dettaglioIntervento(i)"
              @click="puoModificare() ? (foglio = { voce: i }) : (dettaglio = i)">
          <template #fine>
            <span class="riga-valore"><span v-if="Number(i.costo)">{{ f.euro(i.costo) }}</span><br v-if="Number(i.costo) && (i.allegati ?? []).length">
              <small v-if="(i.allegati ?? []).length" class="secondario">{{ i.allegati.length }} allegat{{ i.allegati.length === 1 ? 'o' : 'i' }}</small></span>
          </template>
        </Riga>
        <Riga v-if="interventi.length > 3" azione :icona="tutti ? 'frecciaSu' : 'frecciaGiu'" :titolo="tutti ? 'Mostra meno' : 'Mostra tutti (' + interventi.length + ')'" @click="tutti = !tutti"/>
        <Riga v-if="puoModificare()" azione icona="piuCerchio" :titolo="lavori ? 'Registra lavoro' : 'Registra intervento'" @click="foglio = {}"/>
      </Gruppo>
      <Gruppo v-if="lavori && interventi.some(i => Number(i.costo))"><Riga titolo="Spesa totale" :valore="f.euro(spesa)" style="font-weight:600"/></Gruppo>
      <AllegatiFoglio v-if="dettaglio" :intervento="dettaglio" @chiudi="dettaglio = null"/>
      <h2 v-if="!lavori && (contratti.length || puoModificare())" class="sezione-operazione">Archivio contratti</h2>
      <Gruppo v-if="!lavori && (contratti.length || puoModificare())" nota="Le scadenze e gli avvisi si impostano nel contratto.">
        <Riga v-if="!contratti.length" titolo="Nessun contratto" class="secondario"/>
        <RigaContratto v-for="c in contratti" :key="c.id" :contratto="c" @click="apri({ nome: 'contratto', id: c.id })"/>
        <Riga v-if="puoModificare()" azione icona="documento" titolo="Aggiungi contratto" @click="nuovoContratto = true"/>
      </Gruppo>
      <Gruppo v-if="operazione.note" titolo="Note"><div class="riga testo-descrizione">{{ operazione.note }}</div></Gruppo>
      <InterventoFoglio v-if="foglio" :operazione="operazione" :intervento="foglio.voce" @chiudi="foglio = null"/>
      <ContrattoFoglio v-if="nuovoContratto" :sezione-id="operazione.sezione_id" @chiudi="nuovoContratto = false"/>`,
    data() { return { foglio: null, nuovoContratto: false, tutti: false, dettaglio: null }; },
    computed: {
        tipologie() { return tipologieDi(this.operazione); },
        interventi() { return interventiDi(this.operazione); },
        lavori() { return this.operazione.tipo === 'lavori'; },
        spesa() { return this.interventi.reduce((t, i) => t + (Number(i.costo) || 0), 0); },
        sezione() { return sezioneDi(this.operazione.sezione_id); },
        contratti() { return db.contratti.filter(c => c.sezione_id === this.operazione.sezione_id); }
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
        /// "Termoidraulica Rossi · da contratto · cambio filtri"
        dettaglioIntervento(i) {
            const chi = i.eseguito_da === 'proprio' ? `In proprio${i.esecutore ? ' (' + i.esecutore + ')' : ''}` : i.esecutore;
            const contratto = db.contratti.find(c => c.id === i.contratto_id);
            return [chi, contratto ? 'contratto ' + contratto.titolo : '', i.note].filter(Boolean).join(' · ');
        }
    },
    setup() { return { f }; }
};

const InterventoFoglio = {
    props: { operazione: Object, intervento: Object },
    emits: ['chiudi'],
    template: `
      <Foglio :titolo="lavori ? (intervento ? 'Modifica lavoro' : 'Nuovo lavoro') : (intervento ? 'Modifica intervento' : 'Nuovo intervento')"
              :conferma-disabilitata="caricamento || (lavori && !b.titolo.trim())" @annulla="$emit('chiudi')" @conferma="salvaIntervento">
        <Gruppo>
          <CampoData v-model="b.data" etichetta="Data"/>
          <CampoTesto v-model="b.titolo" etichetta="Titolo" :segnaposto="lavori ? 'es. Riverniciatura garage' : 'facoltativo'"/>
          <CampoScelta v-if="!lavori" v-model="b.contratto_id" etichetta="Legato al contratto" :opzioni="opzioniContratti"/>
        </Gruppo>
        <Gruppo titolo="Eseguito da">
          <CampoScelta v-model="b.eseguito_da" etichetta="Eseguito da" :opzioni="[{ valore: 'ditta', nome: 'Ditta / fornitore' }, { valore: 'proprio', nome: 'In proprio' }]"/>
          <CampoTesto v-if="b.eseguito_da === 'ditta'" v-model="b.esecutore" etichetta="Fornitore" segnaposto="Nome della ditta"/>
          <CampoScelta v-else v-model="b.esecutore" etichetta="Familiare" :opzioni="familiari"/>
        </Gruppo>
        <Gruppo titolo="Descrizione intervento"><CampoTesto v-model="b.note" multilinea segnaposto="Cosa è stato fatto, pezzi sostituiti…"/></Gruppo>
        <Gruppo titolo="Costo" :nota="b.contratto_id ? 'Coperto dal contratto: indica solo eventuali costi extra (es. consumabili).' : ''">
          <CampoNumero v-model="b.costo" etichetta="Costo" unita="€" segnaposto="0"/>
        </Gruppo>
        <Gruppo titolo="Foto e fatture">
          <Riga v-for="(a, k) in b.allegati" :key="a.percorso" :icona="a.nome && /\.pdf$/i.test(a.nome) ? 'documento' : 'foto'" :titolo="a.nome" freccia
                @click="apriAllegato(a)">
            <template #fine><button type="button" class="scollega" @click.stop="b.allegati.splice(k, 1)" aria-label="Togli allegato">−</button></template>
          </Riga>
          <label class="riga toccabile azione"><span class="riga-icona"><Icona nome="graffetta"/></span>
            <span class="riga-testi">{{ caricamento ? 'Caricamento…' : 'Allega foto o fattura' }}</span>
            <input type="file" multiple accept="image/*,application/pdf" hidden @change="allega">
          </label>
        </Gruppo>
        <Gruppo v-if="intervento"><Riga distruttiva :titolo="lavori ? 'Elimina lavoro' : 'Elimina intervento'" @click="eliminaIntervento"/></Gruppo>
      </Foglio>`,
    data() {
        const i = this.intervento ?? {};
        const contratti = db.contratti.filter(c => c.sezione_id === this.operazione.sezione_id);
        return { b: {
            data: i.data ?? f.oggiISO(), tipologia_id: i.tipologia_id ?? tipologieDi(this.operazione)[0]?.id ?? null, note: i.note ?? '',
            contratto_id: i.id ? (i.contratto_id ?? null) : (contratti.length === 1 ? contratti[0].id : null),
            eseguito_da: i.eseguito_da ?? 'ditta', esecutore: i.esecutore ?? (contratti.length === 1 && !i.id ? fornitoreContratto(contratti[0]) : ''),
            costo: i.costo ? Number(i.costo) : null, titolo: i.titolo ?? '', allegati: [...(i.allegati ?? [])]
        }, caricamento: false };
    },
    watch: {
        // Scegliendo il contratto, il fornitore è quello del contratto.
        'b.contratto_id'(id) {
            const c = db.contratti.find(c => c.id === id);
            if (c && this.b.eseguito_da === 'ditta' && !this.b.esecutore) this.b.esecutore = fornitoreContratto(c);
        },
        'b.eseguito_da'(v) { this.b.esecutore = v === 'proprio' ? (stato.membro?.nome || '') : ''; }
    },
    computed: {
        lavori() { return this.operazione.tipo === 'lavori'; },
        tipologie() { return tipologieDi(this.operazione); },
        opzioniContratti() {
            return [{ valore: null, nome: 'No' }, ...db.contratti.filter(c => c.sezione_id === this.operazione.sezione_id)
                .map(c => ({ valore: c.id, nome: c.titolo }))];
        },
        familiari() {
            const nomi = db.membri.map(m => m.nome || m.email).filter(Boolean);
            if (this.b.esecutore && !nomi.includes(this.b.esecutore)) nomi.push(this.b.esecutore);
            return [{ valore: '', nome: 'Scegli' }, ...nomi.map(n => ({ valore: n, nome: n }))];
        }
    },
    methods: {
        async allega(e) {
            this.caricamento = true;
            try {
                for (const file of e.target.files) {
                    const daCaricare = file.type.startsWith('image/') ? await riduciFoto(file) : file;
                    this.b.allegati.push({ percorso: await caricaFile(daCaricare, 'interventi'), nome: file.name });
                }
            } catch (err) { alert('Caricamento non riuscito: ' + (err?.message ?? err)); }
            finally { this.caricamento = false; e.target.value = ''; }
        },
        async apriAllegato(a) {
            const finestra = window.open('', '_blank');
            const url = await urlFile(a.percorso);
            if (finestra) finestra.location = url; else location.href = url;
        },
        async salvaIntervento() {
            await salva('interventi', { ...(this.intervento ?? {}), ...this.b, id: this.intervento?.id, operazione_id: this.operazione.id,
                                       esecutore: (this.b.esecutore ?? '').trim(), costo: this.b.costo ?? 0, titolo: this.b.titolo.trim(),
                                       contratto_id: this.lavori ? null : this.b.contratto_id });
            this.$emit('chiudi');
        },
        async eliminaIntervento() { if (confirm("Eliminare l'intervento?")) { await elimina('interventi', this.intervento.id); this.$emit('chiudi'); } }
    }
};

/// Intervento o lavoro in sola lettura: dati e allegati da aprire.
const AllegatiFoglio = {
    props: { intervento: Object },
    emits: ['chiudi'],
    template: `
      <Foglio :titolo="intervento.titolo || 'Intervento'" solo-chiudi @annulla="$emit('chiudi')">
        <Gruppo>
          <Riga titolo="Data" :valore="f.data(intervento.data)"/>
          <Riga titolo="Eseguito da" :valore="intervento.eseguito_da === 'proprio' ? 'In proprio' + (intervento.esecutore ? ' (' + intervento.esecutore + ')' : '') : (intervento.esecutore || '–')"/>
          <Riga v-if="Number(intervento.costo)" titolo="Costo" :valore="f.euro(intervento.costo)"/>
        </Gruppo>
        <Gruppo v-if="intervento.note" titolo="Descrizione"><div class="riga testo-descrizione">{{ intervento.note }}</div></Gruppo>
        <Gruppo v-if="(intervento.allegati ?? []).length" titolo="Foto e fatture">
          <Riga v-for="a in intervento.allegati" :key="a.percorso" :icona="/\.pdf$/i.test(a.nome) ? 'documento' : 'foto'" :titolo="a.nome" freccia @click="apri(a)"/>
        </Gruppo>
      </Foglio>`,
    methods: {
        async apri(a) {
            const finestra = window.open('', '_blank');
            const url = await urlFile(a.percorso);
            if (finestra) finestra.location = url; else location.href = url;
        }
    },
    setup() { return { f }; }
};

// Le sezioni vengono registrate come componenti locali della pagina operazione.
OperazionePagina.components = { MisurePH, CambioAcqua, Pellet, Cenere, Storico, Bollette, NotificheOperazione, DescrizioneFoglio, DepositoPellet };
CambioAcqua.components = { AvvioFoglio };
MisurePH.components = { MisuraFoglio };
Storico.components = { InterventoFoglio, AllegatiFoglio };
