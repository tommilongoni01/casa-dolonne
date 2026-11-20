// Manuale degli impianti: guide scritte da noi (testo formattato e foto) e documenti del fornitore.
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
export async function riduciFoto(file) {
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
