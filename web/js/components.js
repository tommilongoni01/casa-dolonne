// Componenti dell'interfaccia in stile iOS (liste raggruppate, pannelli, campi, grafici).
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { svg, COLORE_SEZIONE } from './icone.js';
import { leggiNumero, numeroCampo, dataBreve } from './format.js';
import { indietro, nav, pila, diviso } from './nav.js';
import { puoModificare } from './store.js';

export const Icona = {
    props: { nome: String, dimensione: { type: Number, default: 22 } },
    template: `<span class="icona" v-html="html"></span>`,
    computed: { html() { return svg(this.nome, this.dimensione); } }
};

export const IconaQuadrata = {
    components: { Icona },
    props: { nome: String, colore: String, dimensione: { type: Number, default: 30 } },
    template: `<span class="icona-quadrata" :style="stile"><Icona :nome="nome" :dimensione="Math.round(dimensione * 0.6)"/></span>`,
    computed: {
        stile() {
            const colore = this.colore ?? COLORE_SEZIONE[this.nome] ?? 'var(--accento)';
            return { width: `${this.dimensione}px`, height: `${this.dimensione}px`, background: colore,
                     borderRadius: `${this.dimensione * 0.24}px` };
        }
    }
};

/// Pagina con barra di navigazione (titolo grande nelle pagine principali, piccolo nei dettagli).
export const Pagina = {
    components: { Icona },
    // titoloSottile: il titolo è già grande nella pagina e compare nella barra solo scorrendo (come nelle app Apple).
    props: { titolo: String, grande: Boolean, conIndietro: { type: Boolean, default: true }, titoloSottile: Boolean },
    template: `
      <div class="pagina">
        <header class="barra" :class="{ grande }">
          <div class="barra-riga">
            <button v-if="mostraIndietro" class="pulsante-barra indietro" @click="vaiIndietro" aria-label="Indietro">
              <Icona nome="indietro"/>
            </button>
            <div class="barra-titolo" v-if="!grande" :class="{ nascosto: titoloSottile && !scorsa }">{{ titolo }}</div>
            <div class="barra-azioni"><slot name="azioni"/></div>
          </div>
          <h1 v-if="grande" class="titolo-grande">{{ titolo }}</h1>
        </header>
        <main class="contenuto" @scroll.passive="e => scorsa = e.target.scrollTop > 56"><slot/></main>
      </div>`,
    data() { return { scorsa: false }; },
    computed: {
        // Su iPad la prima pagina di dettaglio è quella scelta nell'elenco a sinistra: niente "Indietro".
        mostraIndietro() { return this.conIndietro && !this.grande && (!diviso() || pila().length > 1); }
    },
    methods: { vaiIndietro() { indietro(); } }
};

/// Riga in fondo agli elenchi lunghi: di norma si vede solo la voce più recente (v-model:aperto).
export const RigaEspandi = {
    props: { totale: Number, aperto: Boolean },
    emits: ['update:aperto'],
    template: `
      <Riga v-if="totale > 1" azione :icona="aperto ? 'frecciaSu' : 'frecciaGiu'"
            :titolo="aperto ? 'Mostra solo il più recente' : 'Mostra tutti (' + totale + ')'" @click="$emit('update:aperto', !aperto)"/>`
};

export const Gruppo = {
    // Le note spiegano come modificare: si vedono solo a chi può modificare, salvo "nota-sempre" (es. legenda di un grafico).
    props: { titolo: String, nota: String, notaSempre: Boolean },
    template: `
      <section class="gruppo">
        <h2 v-if="titolo || $slots.intestazione" class="gruppo-titolo"><slot name="intestazione">{{ titolo }}</slot></h2>
        <div class="gruppo-celle"><slot/></div>
        <p v-if="(nota || $slots.nota) && (notaSempre || puoModificare())" class="gruppo-nota"><slot name="nota">{{ nota }}</slot></p>
      </section>`,
    methods: { puoModificare }
};

/// Riga di una lista. Con @click diventa toccabile (con freccia se `freccia`).
export const Riga = {
    components: { Icona, IconaQuadrata },
    props: {
        titolo: [String, Number], sottotitolo: String, valore: [String, Number],
        icona: String, colore: String, quadrata: Boolean, freccia: Boolean,
        selezionata: Boolean, distruttiva: Boolean, azione: Boolean, disabilitata: Boolean
    },
    // Il gestore @click passato dal genitore arriva direttamente sul pulsante (attributo ereditato).
    template: `
      <component :is="toccabile ? 'button' : 'div'" class="riga" :type="toccabile ? 'button' : null"
                 :class="{ toccabile, selezionata, distruttiva, azione }" :disabled="disabilitata">
        <span v-if="icona" class="riga-icona">
          <IconaQuadrata v-if="quadrata" :nome="icona" :colore="colore"/>
          <Icona v-else :nome="icona" :style="colore ? { color: colore } : null"/>
        </span>
        <span class="riga-testi">
          <span class="riga-titolo"><slot name="titolo">{{ titolo }}</slot></span>
          <span v-if="sottotitolo || $slots.sottotitolo" class="riga-sottotitolo"><slot name="sottotitolo">{{ sottotitolo }}</slot></span>
          <slot/>
        </span>
        <span v-if="valore !== undefined && valore !== null && valore !== ''" class="riga-valore">{{ valore }}</span>
        <slot name="fine"/>
        <span v-if="freccia" class="riga-freccia"><Icona nome="avanti" :dimensione="16"/></span>
      </component>`,
    computed: { toccabile() { return !!this.$attrs.onClick; } },
    inheritAttrs: true
};

export const BadgeScadenza = {
    props: { data: [Date, String], stato: String },
    template: `<span class="badge" :class="stato">{{ testo }}</span>`,
    computed: { testo() { return dataBreve(this.data); } }
};

export const Vuoto = {
    components: { Icona },
    props: { icona: String, titolo: String, testo: String },
    template: `
      <div class="vuoto">
        <Icona :nome="icona || 'lista'" :dimensione="44"/>
        <div class="vuoto-titolo">{{ titolo }}</div>
        <div class="vuoto-testo" v-if="testo">{{ testo }}</div>
        <slot/>
      </div>`
};

/// Pannello modale con Annulla / Fine, come i fogli di iOS.
export const Foglio = {
    props: {
        titolo: String, conferma: { type: String, default: 'Fine' },
        confermaDisabilitata: Boolean, soloChiudi: Boolean, largo: Boolean
    },
    // "conferma" non è dichiarato in emits: così il gestore resta in $attrs e se ne può attendere la Promise.
    emits: ['annulla'],
    template: `
      <Teleport to="body">
        <div class="foglio-sfondo" @click.self="$emit('annulla')">
          <div class="foglio" :class="{ largo }" role="dialog" :aria-label="titolo">
            <header class="foglio-barra">
              <button class="pulsante-testo" @click="$emit('annulla')">{{ soloChiudi ? 'Chiudi' : 'Annulla' }}</button>
              <div class="foglio-titolo">{{ titolo }}</div>
              <button v-if="!soloChiudi" class="pulsante-testo forte" :disabled="confermaDisabilitata || inCorso"
                      @click="confermaFoglio">{{ inCorso ? '…' : conferma }}</button>
              <span v-else class="pulsante-testo segnaposto"></span>
            </header>
            <div class="foglio-contenuto"><slot/></div>
          </div>
        </div>
      </Teleport>`,
    data() { return { inCorso: false }; },
    methods: {
        // Nome diverso dal prop "conferma" (testo del pulsante): con lo stesso nome Vue usa il prop e il clic non fa nulla.
        async confermaFoglio() {
            // Il genitore può restituire una Promise: il pulsante resta disattivato finché non finisce.
            this.inCorso = true;
            try { await this.$attrs.onConferma?.(); }
            catch (errore) { alert('Salvataggio non riuscito: ' + (errore?.message ?? errore)); }
            finally { this.inCorso = false; }
        }
    },
    inheritAttrs: false,
    mounted() { document.body.classList.add('con-foglio'); },
    unmounted() { if (!document.querySelector('.foglio')) document.body.classList.remove('con-foglio'); }
};

// ---- Campi ----------------------------------------------------------------
export const CampoTesto = {
    props: { etichetta: String, modelValue: String, segnaposto: String, multilinea: Boolean, tipo: { type: String, default: 'text' } },
    emits: ['update:modelValue'],
    template: `
      <label class="campo" :class="{ multilinea }">
        <span v-if="etichetta" class="campo-etichetta">{{ etichetta }}</span>
        <textarea v-if="multilinea" :value="modelValue" :placeholder="segnaposto" rows="3"
                  @input="$emit('update:modelValue', $event.target.value)"></textarea>
        <input v-else :type="tipo" :value="modelValue" :placeholder="segnaposto ?? etichetta"
               @input="$emit('update:modelValue', $event.target.value)">
      </label>`
};

export const CampoNumero = {
    props: { etichetta: String, modelValue: Number, unita: String, segnaposto: String, negativi: Boolean },
    // 'fine': valore definitivo, quando si esce dal campo o si preme Invio.
    emits: ['update:modelValue', 'fine'],
    template: `
      <label class="campo">
        <span class="campo-etichetta">{{ etichetta }}</span>
        <input class="numero" :value="testo" :inputmode="negativi ? 'text' : 'decimal'" :placeholder="segnaposto ?? '–'"
               @input="aggiorna($event.target.value)" @change="$emit('fine', leggi(testo))" @keyup.enter="$event.target.blur()"
               @blur="testo = mostra(modelValue)">
        <span v-if="unita" class="campo-unita">{{ unita }}</span>
      </label>`,
    data() { return { testo: numeroCampo(this.modelValue) }; },
    watch: { modelValue(v) { if (leggiNumero(this.testo) !== v) this.testo = numeroCampo(v); } },
    methods: {
        aggiorna(testo) { this.testo = testo; this.$emit('update:modelValue', leggiNumero(testo)); },
        mostra: numeroCampo,
        leggi: leggiNumero
    }
};

export const CampoData = {
    props: { etichetta: String, modelValue: String, conOra: Boolean },
    emits: ['update:modelValue'],
    // Con l'ora: due campi separati (giorno e ora), più affidabili del campo unico su iPhone, iPad e Mac.
    template: `
      <label class="campo">
        <span class="campo-etichetta">{{ etichetta }}</span>
        <span class="campo-data-ora">
          <input type="date" class="data" :value="giorno" @input="cambiaGiorno($event.target.value)" @change="cambiaGiorno($event.target.value)">
          <input v-if="conOra" type="time" class="data" :value="orario" @input="cambiaOra($event.target.value)" @change="cambiaOra($event.target.value)">
        </span>
      </label>`,
    computed: {
        locale() { return this.modelValue ? new Date(this.modelValue) : null; },
        giorno() {
            if (!this.modelValue) return '';
            if (!this.conOra) return this.modelValue.slice(0, 10);
            const d = this.locale, due = n => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
        },
        orario() {
            if (!this.locale) return '';
            const due = n => String(n).padStart(2, '0');
            return `${due(this.locale.getHours())}:${due(this.locale.getMinutes())}`;
        }
    },
    methods: {
        cambiaGiorno(v) {
            if (!v) return;
            if (!this.conOra) { if (v !== this.modelValue) this.$emit('update:modelValue', v); return; }
            this.emetti(v, this.orario || '12:00');
        },
        cambiaOra(v) { if (v) this.emetti(this.giorno || new Date().toISOString().slice(0, 10), v); },
        /// Giorno e ora locali → istante ISO.
        emetti(giorno, ora) {
            const [a, m, g] = giorno.split('-').map(Number), [h, min] = ora.split(':').map(Number);
            const iso = new Date(a, m - 1, g, h, min).toISOString();
            if (iso !== this.modelValue) this.$emit('update:modelValue', iso);
        }
    }
};

export const CampoScelta = {
    props: { etichetta: String, modelValue: [String, Number, null], opzioni: Array },
    emits: ['update:modelValue'],
    template: `
      <label class="campo">
        <span class="campo-etichetta">{{ etichetta }}</span>
        <select :value="modelValue ?? ''" @change="$emit('update:modelValue', $event.target.value || null)">
          <option v-for="o in opzioni" :key="o.valore ?? ''" :value="o.valore ?? ''">{{ o.nome }}</option>
        </select>
      </label>`
};

export const Interruttore = {
    props: { etichetta: String, modelValue: Boolean, disabilitato: Boolean },
    emits: ['update:modelValue'],
    template: `
      <label class="campo interruttore">
        <span class="campo-etichetta pieno">{{ etichetta }}</span>
        <input type="checkbox" role="switch" :checked="modelValue" :disabled="disabilitato"
               @change="$emit('update:modelValue', $event.target.checked)">
      </label>`
};

export const Passo = {
    props: { modelValue: Number, min: { type: Number, default: 0 }, max: { type: Number, default: 999 },
             passo: { type: Number, default: 1 }, disabilitato: Boolean },
    emits: ['update:modelValue'],
    template: `
      <div class="campo passo">
        <span class="campo-etichetta pieno"><slot/></span>
        <span class="passo-pulsanti">
          <button type="button" :disabled="disabilitato || modelValue <= min" @click="cambia(-passo)" aria-label="Diminuisci">−</button>
          <button type="button" :disabled="disabilitato || modelValue >= max" @click="cambia(passo)" aria-label="Aumenta">+</button>
        </span>
      </div>`,
    methods: { cambia(d) { this.$emit('update:modelValue', Math.min(this.max, Math.max(this.min, (this.modelValue || 0) + d))); } }
};

/// Pulsanti grandi affiancati (es. Acquisto / Riempimento / Rettifica).
export const Azioni = {
    components: { Icona },
    props: { voci: Array },
    emits: ['scegli'],
    template: `
      <div class="azioni">
        <button v-for="v in voci" :key="v.id" class="azione-grande" @click="$emit('scegli', v.id)">
          <Icona :nome="v.icona" :dimensione="24"/>
          <span>{{ v.nome }}</span>
        </button>
      </div>`
};

/// Cronometro che si aggiorna ogni secondo.
export const Cronometro = {
    props: { da: [String, Date] },
    template: `<span class="cronometro">{{ testo }}</span>`,
    setup(props) {
        const adesso = ref(Date.now());
        let timer;
        onMounted(() => { timer = setInterval(() => { adesso.value = Date.now(); }, 1000); });
        onUnmounted(() => clearInterval(timer));
        const testo = computed(() => {
            const s = Math.max(0, Math.floor((adesso.value - new Date(props.da)) / 1000));
            const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
            const due = n => String(n).padStart(2, '0');
            return `${h}:${due(m)}:${due(sec)}`;
        });
        return { testo };
    }
};

/// Grafico a linee in SVG. serie: [{ nome, colore, punti: [{ x: Date, y }] }]
export const Grafico = {
    props: {
        serie: Array, altezza: { type: Number, default: 200 },
        fascia: Object,            // { min, max } evidenziata in verde
        riferimento: Number,       // linea tratteggiata (es. livello obiettivo)
        formatoY: { type: Function, default: v => String(Math.round(v * 10) / 10).replace('.', ',') },
        gradini: Boolean,
        valori: Boolean            // scrive il valore misurato accanto a ogni punto
    },
    template: `
      <div class="grafico">
        <svg :viewBox="'0 0 ' + L + ' ' + altezza" :style="{ height: altezza + 'px' }">
          <rect v-if="fascia" :x="sx" :width="L - sx - dx" :y="y(fascia.max)" :height="Math.max(0, y(fascia.min) - y(fascia.max))" class="grafico-fascia"/>
          <g v-for="t in tacche" :key="t">
            <line :x1="sx" :x2="L - dx" :y1="y(t)" :y2="y(t)" class="grafico-griglia"/>
            <text :x="sx - 6" :y="y(t) + 4" text-anchor="end" class="grafico-etichetta">{{ formatoY(t) }}</text>
          </g>
          <line v-if="riferimento !== undefined && riferimento !== null" :x1="sx" :x2="L - dx" :y1="y(riferimento)" :y2="y(riferimento)" class="grafico-riferimento"/>
          <g v-for="(s, si) in serie" :key="s.nome">
            <path :d="percorso(s.punti)" :stroke="s.colore" class="grafico-linea"/>
            <circle v-for="(p, i) in s.punti" :key="i" :cx="x(p.x)" :cy="y(p.y)" r="3.5" :fill="s.colore"/>
            <template v-if="valori">
              <text v-for="e in etichettePunti(s.punti, si)" :key="e.chiave" :x="e.x" :y="e.y" :text-anchor="e.ancora"
                    class="grafico-valore" :fill="s.colore">{{ formatoY(e.valore) }}</text>
            </template>
          </g>
          <text v-for="(e, i) in etichetteX" :key="i" :x="e.x" :y="altezza - 6" :text-anchor="e.ancora" class="grafico-etichetta">{{ e.testo }}</text>
        </svg>
        <div v-if="serie.length > 1" class="grafico-legenda">
          <span v-for="s in serie" :key="s.nome"><i :style="{ background: s.colore }"></i>{{ s.nome }}</span>
        </div>
      </div>`,
    // L = larghezza reale del grafico in pixel: così testi e punti non vengono deformati.
    data() { return { L: 600, dx: 14, sopra: 22, sotto: 26 }; },
    mounted() {
        const misura = () => { const w = this.$el.clientWidth - 16; if (w > 100) this.L = Math.round(w); };
        misura();
        this.osservatore = new ResizeObserver(misura);
        this.osservatore.observe(this.$el);
    },
    unmounted() { this.osservatore?.disconnect(); },
    computed: {
        tutti() { return this.serie.flatMap(s => s.punti); },
        minX() { return Math.min(...this.tutti.map(p => +p.x)); },
        maxX() { return Math.max(...this.tutti.map(p => +p.x)); },
        /// Margine sinistro adatto all'etichetta più lunga dell'asse Y.
        sx() { return 14 + Math.max(...this.tacche.map(t => this.formatoY(t).length)) * 6.6; },
        /// Valori "tondi" per l'asse Y (es. -10, -5, 0 oppure 6,8 · 7 · 7,2…).
        passo() {
            const valori = this.tutti.map(p => p.y);
            if (this.fascia) valori.push(this.fascia.min, this.fascia.max);
            if (this.riferimento !== undefined && this.riferimento !== null) valori.push(this.riferimento);
            let min = Math.min(...valori), max = Math.max(...valori);
            if (min === max) { min -= 1; max += 1; }
            const grezzo = (max - min) / 4, ordine = 10 ** Math.floor(Math.log10(grezzo));
            const passo = [1, 2, 2.5, 5, 10].map(m => m * ordine).find(v => v >= grezzo);
            return { passo, min: Math.floor(min / passo) * passo, max: Math.ceil(max / passo) * passo };
        },
        estremiY() { return [this.passo.min, this.passo.max]; },
        tacche() {
            const { passo, min, max } = this.passo, elenco = [];
            for (let v = min; v <= max + passo / 2; v += passo) elenco.push(Math.round(v * 1000) / 1000);
            return elenco;
        },
        etichetteX() {
            if (!this.tutti.length) return [];
            const span = this.maxX - this.minX;
            const f = new Intl.DateTimeFormat('it-IT', span < 2 * 86_400_000 ? { hour: '2-digit', minute: '2-digit' }
                : span < 120 * 86_400_000 ? { day: 'numeric', month: 'short' } : { month: 'short', year: '2-digit' });
            const passi = this.L > 520 ? [0, 0.25, 0.5, 0.75, 1] : [0, 0.5, 1];
            return passi.map(t => {
                const valore = this.minX + span * t;
                return { x: this.x(valore), testo: f.format(new Date(valore)), ancora: t === 0 ? 'start' : t === 1 ? 'end' : 'middle' };
            });
        }
    },
    methods: {
        x(v) {
            const span = this.maxX - this.minX || 1;
            return this.sx + ((+v - this.minX) / span) * (this.L - this.sx - this.dx);
        },
        y(v) {
            const [min, max] = this.estremiY;
            return this.sopra + (1 - (v - min) / (max - min)) * (this.altezza - this.sopra - this.sotto);
        },
        /// Etichette dei valori: sopra il punto (sotto se il valore scende); con tanti punti solo primo, ultimo, minimo e massimo.
        etichettePunti(punti, indiceSerie = 0) {
            const ordinati = [...punti].sort((a, b) => a.x - b.x);
            let scelti = ordinati.map((p, i) => i);
            if (ordinati.length > 14) {
                const ys = ordinati.map(p => p.y);
                scelti = [...new Set([0, ordinati.length - 1, ys.indexOf(Math.min(...ys)), ys.indexOf(Math.max(...ys))])];
            }
            return scelti.map(i => {
                // Con due serie (es. Dosimetro e Scuba): nello stesso giorno il valore più alto sopra, il più basso sotto.
                const p = ordinati[i], prima = ordinati[i - 1];
                const altro = this.serie.length > 1 ? this.serie[1 - indiceSerie]?.punti.find(q => +q.x === +p.x) : null;
                const scende = altro ? (p.y < altro.y || (p.y === altro.y && indiceSerie === 1)) : prima && p.y < prima.y;
                const x = this.x(p.x), y = this.y(p.y);
                return {
                    // Sotto il punto se il livello scende, ma senza finire sull'asse dei tempi (né fuori in alto).
                    chiave: i, valore: p.y, x,
                    y: (scende && y + 16 < this.altezza - this.sotto) || y - 8 < 12 ? y + 16 : y - 8,
                    ancora: x < this.sx + 20 ? 'start' : x > this.L - this.dx - 20 ? 'end' : 'middle'
                };
            });
        },
        percorso(punti) {
            const ordinati = [...punti].sort((a, b) => a.x - b.x);
            return ordinati.map((p, i) => {
                if (i === 0) return `M${this.x(p.x)},${this.y(p.y)}`;
                return this.gradini
                    ? `H${this.x(p.x)}V${this.y(p.y)}`
                    : `L${this.x(p.x)},${this.y(p.y)}`;
            }).join('');
        }
    }
};

/// Immagine caricata da Supabase Storage (URL firmato) o dalla cartella seed.
export const ImmagineFile = {
    props: { percorso: String, alt: String },
    template: `<img v-if="url" :src="url" :alt="alt || ''" loading="lazy" class="immagine-file"><div v-else class="immagine-segnaposto"></div>`,
    data() { return { url: '' }; },
    watch: { percorso: { immediate: true, async handler(p) { this.url = p ? await (await import('./store.js')).urlFile(p) : ''; } } }
};

export const componenti = {
    Icona, IconaQuadrata, Pagina, Gruppo, Riga, BadgeScadenza, Vuoto, Foglio, CampoTesto, CampoNumero,
    CampoData, CampoScelta, Interruttore, Passo, Azioni, Cronometro, Grafico, ImmagineFile, RigaEspandi
};
