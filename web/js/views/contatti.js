// Contatti: rubrica di tecnici e fornitori, raggruppata per sistema o in ordine alfabetico.
import { db, salva, salvaMolti, elimina, puoModificare } from '../store.js';
import { nav, pila, apri, apriDaElenco, indietro, stessaPagina } from '../nav.js';
import { nomeContatto, sottotitoloContatto, iniziali } from '../logic.js';

const ordinaNomi = (a, b) => nomeContatto(a).localeCompare(nomeContatto(b), 'it');

export const Avatar = {
    props: { contatto: Object, dimensione: { type: Number, default: 40 } },
    template: `<span class="avatar" :style="{ width: dimensione + 'px', height: dimensione + 'px', fontSize: dimensione * 0.4 + 'px' }">{{ iniziali(contatto) }}</span>`,
    methods: { iniziali }
};

export const ContattiLista = {
    components: { Avatar },
    template: `
      <Pagina titolo="Contatti" grande :con-indietro="false">
        <template #azioni>
          <label v-if="puoModificare()" class="pulsante-barra" aria-label="Importa vCard"><Icona nome="importa"/>
            <input type="file" accept=".vcf,text/vcard,text/x-vcard" multiple hidden @change="importaVCard"></label>
          <button v-if="puoModificare()" class="pulsante-barra" @click="nuovo = true" aria-label="Nuovo contatto"><Icona nome="piu"/></button>
        </template>
        <label class="campo-ricerca"><Icona nome="ricerca" :dimensione="18"/><input v-model="ricerca" placeholder="Cerca nome, azienda, ruolo" type="search"></label>
        <div class="segmenti">
          <button :class="{ attivo: per === 'sistema' }" @click="per = 'sistema'">Per sistema</button>
          <button :class="{ attivo: per === 'alfabetico' }" @click="per = 'alfabetico'">A–Z</button>
        </div>
        <Vuoto v-if="!db.contatti.length" icona="persone" colore="var(--verde)" azione="Nuovo contatto" @azione="nuovo = true" titolo="Nessun contatto" testo="Aggiungi tecnici e fornitori dei vari impianti, o importa un file vCard dalla Rubrica."/>
        <Gruppo v-if="preferiti.length && !ricerca" titolo="Preferiti">
          <RigaContattoLista v-for="c in preferiti" :key="c.id" :contatto="c"/>
        </Gruppo>
        <template v-if="per === 'sistema'">
          <template v-for="g in gruppiSistema" :key="g.id">
            <Gruppo v-if="g.contatti.length" :titolo="g.nome">
              <RigaContattoLista v-for="c in g.contatti" :key="c.id" :contatto="c"/>
            </Gruppo>
          </template>
        </template>
        <template v-else>
          <Gruppo v-for="g in gruppiLettera" :key="g.lettera" :titolo="g.lettera">
            <RigaContattoLista v-for="c in g.contatti" :key="c.id" :contatto="c"/>
          </Gruppo>
        </template>
        <ContattoFoglio v-if="nuovo" @chiudi="nuovo = false"/>
      </Pagina>`,
    data() { return { ricerca: '', per: localStorage.getItem('casaDolonne.contattiPer') ?? 'sistema', nuovo: false }; },
    watch: { per(v) { localStorage.setItem('casaDolonne.contattiPer', v); } },
    computed: {
        db() { return db; },
        filtrati() {
            const q = this.ricerca.trim().toLowerCase();
            return db.contatti.filter(c => !q || [nomeContatto(c), c.azienda, c.ruolo, c.note].some(t => (t ?? '').toLowerCase().includes(q))).sort(ordinaNomi);
        },
        preferiti() { return this.filtrati.filter(c => c.preferito); },
        gruppiSistema() {
            const gruppi = db.sezioni.slice().sort((a, b) => a.ordine - b.ordine)
                .map(s => ({ id: s.id, nome: s.nome, contatti: this.filtrati.filter(c => (c.sezioni ?? []).includes(s.id)) }));
            gruppi.push({ id: 'altri', nome: 'Altri contatti', contatti: this.filtrati.filter(c => !(c.sezioni ?? []).length) });
            return gruppi;
        },
        gruppiLettera() {
            const mappa = new Map();
            for (const c of this.filtrati) {
                const prima = nomeContatto(c)[0]?.toUpperCase() ?? '#';
                const lettera = /[A-ZÀ-Ý]/.test(prima) ? prima : '#';
                if (!mappa.has(lettera)) mappa.set(lettera, []);
                mappa.get(lettera).push(c);
            }
            return [...mappa.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([lettera, contatti]) => ({ lettera, contatti }));
        }
    },
    methods: {
        puoModificare,
        async importaVCard(e) {
            try {
                const nuovi = [];
                for (const file of e.target.files) nuovi.push(...leggiVCard(await file.text()));
                const daAggiungere = nuovi.filter(n => !db.contatti.some(c =>
                    nomeContatto(c).toLowerCase() === nomeContatto(n).toLowerCase()
                    && (cifre(c.cellulare + c.telefono) === cifre(n.cellulare + n.telefono) || (n.email && c.email.toLowerCase() === n.email.toLowerCase()))));
                await salvaMolti('contatti', daAggiungere);
                alert(daAggiungere.length ? `Contatti aggiunti: ${daAggiungere.length}. Aprili per collegarli ai sistemi.`
                                          : 'Nessun contatto nuovo: quelli scelti erano già presenti.');
            } catch (err) { alert(`Importazione non riuscita: ${err.message}`); }
            finally { e.target.value = ''; }
        }
    }
};

const RigaContattoLista = {
    components: { Avatar },
    props: { contatto: Object },
    template: `
      <Riga :selezionata="selezionata" @click="apriDaElenco({ nome: 'contatto', id: contatto.id })">
        <template #titolo><span style="display:flex;align-items:center;gap:12px"><Avatar :contatto="contatto"/>
          <span><span style="display:block">{{ nomeContatto(contatto) }}</span>
          <span v-if="sottotitoloContatto(contatto)" class="riga-sottotitolo">{{ sottotitoloContatto(contatto) }}</span></span></span></template>
      </Riga>`,
    computed: { selezionata() { return nav.largo && stessaPagina(pila()[0], { nome: 'contatto', id: this.contatto.id }); } },
    methods: { nomeContatto, sottotitoloContatto, apriDaElenco }
};
ContattiLista.components.RigaContattoLista = RigaContattoLista;

const cifre = t => (t ?? '').replace(/[^\d+]/g, '');

export const ContattoPagina = {
    components: { Avatar },
    props: { id: String },
    template: `
      <Pagina v-if="c" titolo="">
        <template #azioni>
          <button v-if="puoModificare()" class="pulsante-barra" @click="salva('contatti', { ...c, preferito: !c.preferito })"
                  :aria-label="c.preferito ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'"
                  :style="{ color: c.preferito ? 'var(--arancione)' : null }"><Icona nome="stella"/></button>
          <button v-if="puoModificare()" class="pulsante-barra" @click="modifica = true">Modifica</button>
        </template>
        <div class="scheda-contatto">
          <Avatar :contatto="c" :dimensione="96"/>
          <h2>{{ nomeContatto(c) }}</h2>
          <div v-if="sottotitoloContatto(c)" class="secondario">{{ sottotitoloContatto(c) }}</div>
          <div class="azioni-contatto">
            <component :is="tel ? 'a' : 'span'" :href="tel ? 'tel:' + tel : null"><Icona nome="telefono"/>chiama</component>
            <component :is="tel ? 'a' : 'span'" :href="tel ? 'sms:' + tel : null"><Icona nome="messaggio"/>messaggio</component>
            <component :is="whatsapp ? 'a' : 'span'" :href="whatsapp" target="_blank"><Icona nome="whatsapp"/>WhatsApp</component>
            <component :is="c.email ? 'a' : 'span'" :href="c.email ? 'mailto:' + c.email : null"><Icona nome="posta"/>email</component>
          </div>
        </div>
        <Gruppo>
          <a v-if="c.cellulare" class="riga toccabile" :href="'tel:' + cifre(c.cellulare)"><span class="riga-testi"><span class="riga-sottotitolo">cellulare</span><span style="color:var(--accento)">{{ c.cellulare }}</span></span></a>
          <a v-if="c.telefono" class="riga toccabile" :href="'tel:' + cifre(c.telefono)"><span class="riga-testi"><span class="riga-sottotitolo">telefono</span><span style="color:var(--accento)">{{ c.telefono }}</span></span></a>
          <a v-if="c.email" class="riga toccabile" :href="'mailto:' + c.email"><span class="riga-testi"><span class="riga-sottotitolo">email</span><span style="color:var(--accento)">{{ c.email }}</span></span></a>
          <a v-if="c.sito_web" class="riga toccabile" :href="sito" target="_blank"><span class="riga-testi"><span class="riga-sottotitolo">sito web</span><span style="color:var(--accento)">{{ c.sito_web }}</span></span></a>
          <a v-if="c.indirizzo" class="riga toccabile" :href="'https://maps.apple.com/?q=' + encodeURIComponent(c.indirizzo)" target="_blank"><span class="riga-testi"><span class="riga-sottotitolo">indirizzo</span><span style="color:var(--accento)">{{ c.indirizzo }}</span></span></a>
        </Gruppo>
        <Gruppo v-if="sistemi.length" titolo="Sistemi di riferimento">
          <Riga v-for="s in sistemi" :key="s.id" :icona="s.icona" quadrata :titolo="s.nome" freccia @click="apriSistema(s)"/>
        </Gruppo>
        <Gruppo v-if="contratti.length" titolo="Contratti">
          <RigaContratto v-for="k in contratti" :key="k.id" :contratto="k" @click="apri({ nome: 'contratto', id: k.id })"/>
        </Gruppo>
        <Gruppo v-if="c.note" titolo="Note"><div class="riga testo-descrizione">{{ c.note }}</div></Gruppo>
        <ContattoFoglio v-if="modifica" :contatto="c" @chiudi="modifica = false"/>
      </Pagina>
      <PaginaMancante v-else/>`,
    data() { return { modifica: false }; },
    computed: {
        c() { return db.contatti.find(c => c.id === this.id); },
        tel() { return cifre(this.c.cellulare || this.c.telefono); },
        whatsapp() {
            let n = this.tel.replace('+', '');
            if (!n) return null;
            if (n.startsWith('00')) n = n.slice(2);
            else if (!this.tel.startsWith('+')) n = '39' + n;
            return `https://wa.me/${n}`;
        },
        sito() { return /^https?:/.test(this.c.sito_web) ? this.c.sito_web : `https://${this.c.sito_web}`; },
        sistemi() { return db.sezioni.filter(s => (this.c.sezioni ?? []).includes(s.id)).sort((a, b) => a.ordine - b.ordine); },
        contratti() { return db.contratti.filter(k => k.fornitore_id === this.id); }
    },
    methods: {
        puoModificare, salva, apri, nomeContatto, sottotitoloContatto, cifre,
        apriSistema(s) { nav.scheda = 'casa'; apriDaElenco({ nome: 'impianto', id: s.id }); }
    }
};

export const ContattoFoglio = {
    // sezioneId: impianto già selezionato per un contatto nuovo (dalla pagina dell'impianto).
    props: { contatto: Object, sezioneId: String },
    emits: ['chiudi'],
    template: `
      <Foglio :titolo="contatto ? 'Modifica contatto' : 'Nuovo contatto'" :conferma-disabilitata="!(b.nome || b.cognome || b.azienda).trim()"
              @annulla="$emit('chiudi')" @conferma="salvaContatto">
        <Gruppo>
          <CampoTesto v-model="b.nome" segnaposto="Nome"/>
          <CampoTesto v-model="b.cognome" segnaposto="Cognome"/>
          <CampoTesto v-model="b.azienda" segnaposto="Azienda"/>
          <CampoTesto v-model="b.ruolo" segnaposto="Ruolo (es. tecnico caldaia)"/>
        </Gruppo>
        <Gruppo titolo="Recapiti">
          <CampoTesto v-model="b.cellulare" segnaposto="Cellulare" tipo="tel"/>
          <CampoTesto v-model="b.telefono" segnaposto="Telefono" tipo="tel"/>
          <CampoTesto v-model="b.email" segnaposto="Email" tipo="email"/>
          <CampoTesto v-model="b.sito_web" segnaposto="Sito web" tipo="url"/>
          <CampoTesto v-model="b.indirizzo" segnaposto="Indirizzo"/>
        </Gruppo>
        <Gruppo titolo="Sistemi di riferimento">
          <Interruttore v-for="s in sezioni" :key="s.id" :etichetta="s.nome" :model-value="b.sezioni.includes(s.id)"
                        @update:model-value="v => v ? b.sezioni.push(s.id) : b.sezioni.splice(b.sezioni.indexOf(s.id), 1)"/>
        </Gruppo>
        <Gruppo titolo="Note"><CampoTesto v-model="b.note" multilinea segnaposto="Note"/></Gruppo>
        <Gruppo v-if="contatto"><Riga distruttiva titolo="Elimina contatto" @click="eliminaContatto"/></Gruppo>
      </Foglio>`,
    data() {
        const c = this.contatto ?? {};
        const campi = ['nome', 'cognome', 'azienda', 'ruolo', 'cellulare', 'telefono', 'email', 'sito_web', 'indirizzo', 'note'];
        const sezioni = c.sezioni ?? (this.sezioneId ? [this.sezioneId] : []);
        return { b: { ...Object.fromEntries(campi.map(k => [k, c[k] ?? ''])), sezioni: [...sezioni] } };
    },
    computed: { sezioni() { return db.sezioni.slice().sort((a, b) => a.ordine - b.ordine); } },
    methods: {
        async salvaContatto() {
            await salva('contatti', { ...(this.contatto ?? { preferito: false }), ...this.b });
            this.$emit('chiudi');
        },
        async eliminaContatto() {
            if (!confirm('Eliminare il contatto?')) return;
            this.$emit('chiudi');
            await elimina('contatti', this.contatto.id);
            indietro();
        }
    }
};

// Registrato qui perché ContattoFoglio è definito dopo le pagine che lo usano
// (senza registrazione Vue ignora il tag e il pulsante + non apre nulla).
ContattiLista.components.ContattoFoglio = ContattoFoglio;
ContattoPagina.components.ContattoFoglio = ContattoFoglio;

/// Legge uno o più contatti da un file vCard (esportato dall'app Contatti di iOS).
export function leggiVCard(testo) {
    const righe = testo.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
    const contatti = [];
    let c = null;
    const decodifica = v => v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim();
    for (const riga of righe) {
        const i = riga.indexOf(':');
        if (i < 0) continue;
        const [nomeCampo, ...parametri] = riga.slice(0, i).split(';');
        const campo = nomeCampo.replace(/^item\d+\./i, '').toUpperCase();
        const valore = riga.slice(i + 1);
        const tipi = parametri.join(';').toUpperCase();
        if (campo === 'BEGIN') { c = { nome: '', cognome: '', azienda: '', ruolo: '', telefono: '', cellulare: '', email: '', indirizzo: '', sito_web: '', note: '', preferito: false, sezioni: [] }; continue; }
        if (!c) continue;
        if (campo === 'END') { if (nomeContatto(c) !== 'Senza nome') contatti.push(c); c = null; continue; }
        if (campo === 'N') { const [cognome, nome] = valore.split(';'); c.cognome = decodifica(cognome ?? ''); c.nome = decodifica(nome ?? ''); }
        else if (campo === 'FN' && !c.nome && !c.cognome) c.nome = decodifica(valore);
        else if (campo === 'ORG') c.azienda = decodifica(valore.split(';')[0]);
        else if (campo === 'TITLE') c.ruolo = decodifica(valore);
        else if (campo === 'TEL') {
            const numero = decodifica(valore);
            if ((tipi.includes('CELL') || tipi.includes('IPHONE')) && !c.cellulare) c.cellulare = numero;
            else if (!c.telefono) c.telefono = numero;
            else if (!c.cellulare) c.cellulare = numero;
        }
        else if (campo === 'EMAIL' && !c.email) c.email = decodifica(valore);
        else if (campo === 'URL' && !c.sito_web) c.sito_web = decodifica(valore);
        else if (campo === 'ADR' && !c.indirizzo) c.indirizzo = valore.split(';').map(decodifica).filter(Boolean).join(', ');
        else if (campo === 'NOTE') c.note = decodifica(valore);
    }
    return contatti;
}
