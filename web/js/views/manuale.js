// Manuale: sistemi, guide scritte da noi (testo formattato e foto) e documenti del fornitore.
import { nextTick } from 'vue';
import { db, salva, elimina, caricaFile, urlFile, puoModificare } from '../store.js';
import { nav, pila, apri, apriDaElenco, indietro, stessaPagina } from '../nav.js';
import * as f from '../format.js';
import { ICONE_SEZIONE } from '../icone.js';
import { nomeContatto, sottotitoloContatto } from '../logic.js';

const ordinaTitoli = (a, b) => a.titolo.localeCompare(b.titolo, 'it', { numeric: true });

/// Tiene solo la formattazione semplice delle guide (grassetto, corsivo, titoli, elenchi, link).
export function pulisciHtml(html) {
    const permessi = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'H3', 'P', 'BR', 'UL', 'OL', 'LI', 'A', 'DIV', 'SPAN']);
    const doc = new DOMParser().parseFromString(`<div>${html ?? ''}</div>`, 'text/html');
    const visita = nodo => {
        for (const figlio of [...nodo.children]) {
            if (!permessi.has(figlio.tagName)) { figlio.replaceWith(...figlio.childNodes); continue; }
            for (const attr of [...figlio.attributes]) {
                if (!(figlio.tagName === 'A' && attr.name === 'href' && /^(https?:|mailto:|tel:)/.test(attr.value))) figlio.removeAttribute(attr.name);
            }
            if (figlio.tagName === 'A') { figlio.setAttribute('target', '_blank'); figlio.setAttribute('rel', 'noopener'); }
            visita(figlio);
        }
    };
    visita(doc.body.firstChild);
    return doc.body.firstChild.innerHTML;
}

const testoDaHtml = html => new DOMParser().parseFromString(html ?? '', 'text/html').body.textContent ?? '';

// ---------------------------------------------------------------------
// Elenco dei sistemi
// ---------------------------------------------------------------------
export const ManualeHome = {
    template: `
      <Pagina titolo="Manuale" grande :con-indietro="false">
        <template #azioni>
          <button v-if="puoModificare()" class="pulsante-barra" @click="modificaSezioni = !modificaSezioni">{{ modificaSezioni ? 'Fine' : 'Modifica' }}</button>
          <button v-if="puoModificare()" class="pulsante-barra" @click="nuova = { nome: '', icona: 'chiave' }" aria-label="Nuova sezione"><Icona nome="piu"/></button>
        </template>
        <label class="campo-ricerca"><Icona nome="ricerca" :dimensione="18"/><input v-model="ricerca" placeholder="Cerca guide e documenti" type="search"></label>
        <template v-if="!ricerca.trim()">
          <Gruppo :nota="modificaSezioni ? 'Tocca una sezione per rinominarla, cambiarne l\\'icona o spostarla.' : ''">
            <Riga v-for="(s, i) in sezioni" :key="s.id" :icona="s.icona" quadrata :titolo="s.nome" :sottotitolo="riepilogo(s)"
                  :freccia="!modificaSezioni" :selezionata="!modificaSezioni && selezionata({ nome: 'sezione', id: s.id })"
                  @click="modificaSezioni ? (modifica = { ...s }) : apriDaElenco({ nome: 'sezione', id: s.id })">
              <template v-if="modificaSezioni" #fine>
                <span class="strumenti" style="margin:0">
                  <button type="button" :disabled="i === 0" @click.stop="sposta(i, -1)">↑</button>
                  <button type="button" :disabled="i === sezioni.length - 1" @click.stop="sposta(i, 1)">↓</button>
                </span>
              </template>
            </Riga>
          </Gruppo>
        </template>
        <template v-else>
          <Vuoto v-if="!guideTrovate.length && !documentiTrovati.length" icona="ricerca" :titolo="'Nessun risultato per “' + ricerca + '”'"/>
          <Gruppo v-if="guideTrovate.length" titolo="Guide">
            <Riga v-for="g in guideTrovate" :key="g.id" icona="libro" :titolo="g.titolo" :sottotitolo="nomeSezione(g.sezione_id)" freccia
                  :selezionata="selezionata({ nome: 'guida', id: g.id })" @click="apriDaElenco({ nome: 'guida', id: g.id })"/>
          </Gruppo>
          <Gruppo v-if="documentiTrovati.length" titolo="Documenti">
            <RigaDocumento v-for="d in documentiTrovati" :key="d.id" :documento="d"/>
          </Gruppo>
        </template>

        <Foglio v-if="nuova || modifica" :titolo="nuova ? 'Nuova sezione' : 'Modifica sezione'"
                :conferma-disabilitata="!(nuova || modifica).nome.trim()" @annulla="nuova = modifica = null" @conferma="salvaSezione">
          <Gruppo><CampoTesto v-model="(nuova || modifica).nome" segnaposto="Nome sezione"/></Gruppo>
          <Gruppo titolo="Icona">
            <div class="riga" style="flex-wrap:wrap;gap:10px">
              <button v-for="i in icone" :key="i" type="button" @click="(nuova || modifica).icona = i"
                      :style="{ outline: (nuova || modifica).icona === i ? '3px solid var(--accento)' : 'none', borderRadius: '9px', outlineOffset: '2px' }">
                <IconaQuadrata :nome="i" :dimensione="40"/>
              </button>
            </div>
          </Gruppo>
          <Gruppo v-if="modifica"><Riga distruttiva titolo="Elimina sezione" @click="eliminaSezione"/></Gruppo>
        </Foglio>
      </Pagina>`,
    data() { return { ricerca: '', nuova: null, modifica: null, modificaSezioni: false, icone: ICONE_SEZIONE }; },
    computed: {
        sezioni() { return db.sezioni.slice().sort((a, b) => a.ordine - b.ordine); },
        guideTrovate() {
            const q = this.ricerca.trim().toLowerCase();
            return db.guide.filter(g => g.titolo.toLowerCase().includes(q)
                || (g.blocchi ?? []).some(b => b.tipo === 'testo' && testoDaHtml(b.html).toLowerCase().includes(q))).sort(ordinaTitoli);
        },
        documentiTrovati() {
            const q = this.ricerca.trim().toLowerCase();
            return db.documenti.filter(d => d.titolo.toLowerCase().includes(q) || d.nome_file.toLowerCase().includes(q));
        }
    },
    methods: {
        puoModificare, apriDaElenco,
        selezionata(p) { return nav.largo && stessaPagina(pila()[0], p); },
        nomeSezione(id) { return db.sezioni.find(s => s.id === id)?.nome ?? ''; },
        riepilogo(s) {
            const g = db.guide.filter(x => x.sezione_id === s.id).length, d = db.documenti.filter(x => x.sezione_id === s.id).length;
            return `${g === 1 ? '1 guida' : g + ' guide'} · ${d === 1 ? '1 documento' : d + ' documenti'}`;
        },
        async sposta(i, d) {
            const elenco = [...this.sezioni];
            const [s] = elenco.splice(i, 1);
            elenco.splice(i + d, 0, s);
            await Promise.all(elenco.map((voce, ordine) => voce.ordine !== ordine ? salva('sezioni', { ...voce, ordine }) : null));
        },
        async salvaSezione() {
            if (this.nuova) await salva('sezioni', { ...this.nuova, nome: this.nuova.nome.trim(), ordine: this.sezioni.length });
            else await salva('sezioni', { ...this.modifica, nome: this.modifica.nome.trim() });
            this.nuova = this.modifica = null;
        },
        async eliminaSezione() {
            if (!confirm(`Eliminare "${this.modifica.nome}" con tutte le sue guide, documenti e operazioni?`)) return;
            await elimina('sezioni', this.modifica.id);
            this.modifica = null;
        }
    }
};

// ---------------------------------------------------------------------
// Documenti
// ---------------------------------------------------------------------
export const RigaDocumento = {
    props: { documento: Object },
    template: `
      <Riga :icona="icona" :titolo="documento.titolo" :sottotitolo="dettaglio" freccia @click="apriDocumento"/>`,
    computed: {
        icona() { return /\.(jpe?g|png|heic|gif)$/i.test(this.documento.nome_file) ? 'foto' : 'documento'; },
        dettaglio() { return [this.documento.nome_file, f.dimensioneFile(this.documento.dimensione)].filter(Boolean).join(' · '); }
    },
    methods: {
        async apriDocumento() {
            // La finestra va aperta subito (nel gesto del tocco), poi le si assegna l'indirizzo firmato.
            const finestra = window.open('', '_blank');
            const url = await urlFile(this.documento.percorso);
            if (finestra) finestra.location = url; else location.href = url;
        }
    }
};

// ---------------------------------------------------------------------
// Pagina di una sezione
// ---------------------------------------------------------------------
export const SezionePagina = {
    props: { id: String },
    template: `
      <Pagina v-if="sezione" :titolo="sezione.nome">
        <template #azioni>
          <button v-if="puoModificare()" class="pulsante-barra" @click="nuovaGuida" aria-label="Nuova guida"><Icona nome="piu"/></button>
        </template>
        <Gruppo titolo="Guide">
          <Riga v-if="!guide.length" titolo="Nessuna guida" class="secondario"/>
          <Riga v-for="g in guide" :key="g.id" icona="libro" :titolo="g.titolo || 'Senza titolo'"
                :sottotitolo="'Aggiornata il ' + f.dataBreve(g.aggiornata)" freccia @click="apri({ nome: 'guida', id: g.id })"/>
        </Gruppo>
        <Gruppo titolo="Documenti del fornitore">
          <Riga v-if="!documenti.length" titolo="Nessun documento" class="secondario"/>
          <RigaDocumento v-for="d in documenti" :key="d.id" :documento="d"/>
          <label v-if="puoModificare()" class="riga toccabile azione"><span class="riga-icona"><Icona nome="importa"/></span>
            <span class="riga-testi">{{ caricamento ? 'Caricamento…' : 'Importa documento (PDF o foto)' }}</span>
            <input type="file" multiple accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx" hidden @change="importa">
          </label>
        </Gruppo>
        <Gruppo v-if="contatti.length" titolo="Contatti">
          <Riga v-for="c in contatti" :key="c.id" icona="persona" :titolo="nomeContatto(c)" :sottotitolo="sottotitoloContatto(c)" freccia
                @click="apri({ nome: 'contatto', id: c.id })"/>
        </Gruppo>
      </Pagina>
      <PaginaMancante v-else/>`,
    data() { return { caricamento: false }; },
    computed: {
        sezione() { return db.sezioni.find(s => s.id === this.id); },
        guide() { return db.guide.filter(g => g.sezione_id === this.id).sort(ordinaTitoli); },
        documenti() { return db.documenti.filter(d => d.sezione_id === this.id).sort(ordinaTitoli); },
        contatti() { return db.contatti.filter(c => (c.sezioni ?? []).includes(this.id)).sort((a, b) => nomeContatto(a).localeCompare(nomeContatto(b))); }
    },
    methods: {
        puoModificare, apri, nomeContatto, sottotitoloContatto,
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

// ---------------------------------------------------------------------
// Guida: lettura e modifica
// ---------------------------------------------------------------------
export const GuidaPagina = {
    props: { id: String, modifica: [Boolean, String] },
    template: `
      <Pagina v-if="guida" :titolo="inModifica ? 'Modifica guida' : ''">
        <template #azioni>
          <button v-if="puoModificare() && !inModifica" class="pulsante-barra" @click="inizia">Modifica</button>
          <button v-if="inModifica" class="pulsante-barra" style="font-weight:600" :disabled="salvataggio" @click="termina">{{ salvataggio ? 'Salvo…' : 'Fine' }}</button>
        </template>

        <article v-if="!inModifica" class="guida">
          <h1>{{ guida.titolo || 'Senza titolo' }}</h1>
          <div class="aggiornata">Aggiornata il {{ f.data(guida.aggiornata) }}</div>
          <Vuoto v-if="!(guida.blocchi ?? []).length" icona="libro" titolo="Guida vuota" testo="Tocca Modifica per scrivere il contenuto."/>
          <template v-for="(b, i) in guida.blocchi" :key="i">
            <div v-if="b.tipo === 'testo'" class="blocco-testo" v-html="pulisci(b.html)"></div>
            <figure v-else class="blocco-immagine" style="margin:0 0 16px" @click="ingrandisci(b)">
              <ImmagineFile :percorso="b.percorso" :alt="b.didascalia"/>
              <figcaption v-if="b.didascalia">{{ b.didascalia }}</figcaption>
            </figure>
          </template>
        </article>

        <div v-else>
          <input class="titolo-guida" v-model="bozza.titolo" placeholder="Titolo della guida">
          <div v-for="(b, i) in bozza.blocchi" :key="b.chiave" class="editor-blocco">
            <template v-if="b.tipo === 'testo'">
              <div class="strumenti">
                <button type="button" @mousedown.prevent="comando('bold')"><b>G</b></button>
                <button type="button" @mousedown.prevent="comando('italic')"><i>C</i></button>
                <button type="button" @mousedown.prevent="comando('underline')"><u>S</u></button>
                <button type="button" @mousedown.prevent="comando('formatBlock', 'h3')">Titolo</button>
                <button type="button" @mousedown.prevent="comando('formatBlock', 'p')">Testo</button>
                <button type="button" @mousedown.prevent="comando('insertUnorderedList')">• Elenco</button>
                <button type="button" @mousedown.prevent="comando('insertOrderedList')">1. Elenco</button>
              </div>
              <div class="editor-testo blocco-testo" contenteditable="true" data-segnaposto="Scrivi qui…"
                   :ref="el => registra(el, b)" @input="b.html = $event.target.innerHTML"></div>
            </template>
            <template v-else>
              <ImmagineFile :percorso="b.percorso"/>
              <input v-model="b.didascalia" placeholder="Didascalia (facoltativa)" class="campo" style="width:100%;margin-top:8px;border-radius:8px;background:var(--riempimento)">
            </template>
            <div class="strumenti" style="justify-content:flex-end;margin:8px 0 0">
              <button type="button" :disabled="i === 0" @click="sposta(i, -1)">↑</button>
              <button type="button" :disabled="i === bozza.blocchi.length - 1" @click="sposta(i, 1)">↓</button>
              <button type="button" style="color:var(--rosso)" @click="bozza.blocchi.splice(i, 1)">Elimina</button>
            </div>
          </div>
          <div class="azioni">
            <button class="azione-grande" @click="aggiungiTesto"><Icona nome="testo"/><span>Aggiungi testo</span></button>
            <label class="azione-grande"><Icona nome="foto"/><span>{{ caricamento ? 'Caricamento…' : 'Aggiungi foto' }}</span>
              <input type="file" accept="image/*" multiple hidden @change="aggiungiFoto"></label>
          </div>
          <Gruppo><Riga distruttiva titolo="Elimina guida" @click="eliminaGuida"/></Gruppo>
        </div>

        <div v-if="zoom" class="foglio-sfondo" style="align-items:center;background:rgba(0,0,0,.92)" @click="zoom = null">
          <div style="max-width:96vw;max-height:92vh;overflow:auto;touch-action:pinch-zoom">
            <ImmagineFile :percorso="zoom.percorso" style="max-width:none;width:100%"/>
            <p style="color:#fff;text-align:center">{{ zoom.didascalia }}</p>
          </div>
        </div>
      </Pagina>
      <PaginaMancante v-else/>`,
    data() { return { inModifica: false, bozza: null, salvataggio: false, caricamento: false, zoom: null, editor: new Map() }; },
    computed: { guida() { return db.guide.find(g => g.id === this.id); } },
    mounted() { if (this.modifica && this.guida) this.inizia(); },
    methods: {
        puoModificare, pulisci: pulisciHtml,
        inizia() {
            let n = 0;
            this.bozza = { titolo: this.guida.titolo, blocchi: (this.guida.blocchi ?? []).map(b => ({ ...b, chiave: n++ })) };
            this.inModifica = true;
        },
        registra(el, blocco) {
            // Il contenuto iniziale si imposta una sola volta, poi lo gestisce il browser.
            if (el && !this.editor.has(blocco.chiave)) { el.innerHTML = pulisciHtml(blocco.html); this.editor.set(blocco.chiave, el); }
        },
        comando(nome, valore) { document.execCommand(nome, false, valore); },
        sposta(i, d) { const [b] = this.bozza.blocchi.splice(i, 1); this.bozza.blocchi.splice(i + d, 0, b); },
        aggiungiTesto() { this.bozza.blocchi.push({ tipo: 'testo', html: '', chiave: Date.now() }); },
        async aggiungiFoto(e) {
            this.caricamento = true;
            try {
                for (const file of e.target.files) {
                    const ridotta = await riduciFoto(file);
                    const percorso = await caricaFile(ridotta, 'guide');
                    this.bozza.blocchi.push({ tipo: 'immagine', percorso, didascalia: '', chiave: Date.now() + Math.random() });
                }
            } catch (err) { alert(`Caricamento non riuscito: ${err.message}`); }
            finally { this.caricamento = false; e.target.value = ''; }
        },
        async termina() {
            this.salvataggio = true;
            try {
                const blocchi = this.bozza.blocchi
                    .map(({ chiave, ...b }) => b.tipo === 'testo' ? { tipo: 'testo', html: pulisciHtml(b.html) } : b)
                    .filter(b => b.tipo !== 'testo' || testoDaHtml(b.html).trim());
                await salva('guide', { ...this.guida, titolo: this.bozza.titolo.trim(), blocchi, aggiornata: new Date().toISOString() });
                this.inModifica = false; this.editor.clear();
            } finally { this.salvataggio = false; }
        },
        async eliminaGuida() {
            if (!confirm('Eliminare questa guida?')) return;
            await elimina('guide', this.guida.id);
            indietro();
        },
        ingrandisci(b) { this.zoom = b; }
    },
    setup() { return { f }; }
};

/// Riduce le foto a un lato massimo di 2000 px in JPEG, per contenere lo spazio occupato.
async function riduciFoto(file) {
    try {
        const immagine = await createImageBitmap(file);
        const fattore = Math.min(1, 2000 / Math.max(immagine.width, immagine.height));
        const tela = document.createElement('canvas');
        tela.width = Math.round(immagine.width * fattore); tela.height = Math.round(immagine.height * fattore);
        tela.getContext('2d').drawImage(immagine, 0, 0, tela.width, tela.height);
        const blob = await new Promise(r => tela.toBlob(r, 'image/jpeg', 0.82));
        return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    } catch {
        return file;
    }
}

export const componentiManuale = { RigaDocumento };
