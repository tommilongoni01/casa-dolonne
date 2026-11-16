// Impostazioni: aspetto, account, familiari e contenuti iniziali.
import { db, stato, salva, elimina, esci, puoModificare } from '../store.js';
import { nav, pila, apriDaElenco, stessaPagina } from '../nav.js';
import { backend } from '../backend.js';
import { inizializzaDati } from '../seed.js';

export const Impostazioni = {
    template: `
      <Pagina titolo="Impostazioni" grande :con-indietro="false">
        <Gruppo nota="Automatico segue l'impostazione chiaro/scuro del dispositivo.">
          <CampoScelta etichetta="Aspetto" :model-value="tema" :opzioni="temi" @update:model-value="cambiaTema"/>
        </Gruppo>

        <Gruppo titolo="Account">
          <Riga icona="persona" :titolo="stato.membro?.nome || stato.utente?.email" :sottotitolo="stato.utente?.email"
                :valore="stato.membro?.ruolo === 'editor' ? 'Può modificare' : 'Sola lettura'"/>
          <Riga v-if="puoModificare()" icona="persone" titolo="Famiglia" :valore="db.membri.length" freccia
                :selezionata="nav.largo && stessaPagina(pila()[0], { nome: 'famiglia' })" @click="apriDaElenco({ nome: 'famiglia' })"/>
          <Riga v-if="stato.modo === 'supabase'" icona="esci" titolo="Esci" @click="esciConferma"/>
        </Gruppo>

        <Gruppo v-if="db.sezioni.length" titolo="Impianti" nota="Cartellini con codice QR da stampare e attaccare vicino a ogni impianto.">
          <Riga icona="qr" titolo="Codici QR degli impianti" freccia
                :selezionata="nav.largo && stessaPagina(pila()[0], { nome: 'codiciQR' })" @click="apriDaElenco({ nome: 'codiciQR' })"/>
        </Gruppo>

        <Gruppo v-if="puoModificare() && !db.sezioni.length" titolo="Contenuti iniziali"
                nota="Crea i sistemi e le operazioni e carica le guide della Caldaia (con foto e PDF) e i 16 carichi di pellet. Va fatto una sola volta.">
          <Riga azione icona="importa" :titolo="avanzamento || 'Carica contenuti iniziali'" :disabilitata="!!avanzamento" @click="inizializza"/>
        </Gruppo>

        <Gruppo v-if="stato.modo === 'prova'" titolo="Modalità prova"
                nota="I dati sono salvati solo in questo browser. Quando Supabase sarà configurato, i dati veri saranno condivisi con la famiglia.">
          <Riga distruttiva titolo="Azzera i dati di prova" @click="azzera"/>
        </Gruppo>

        <Gruppo titolo="Informazioni">
          <Riga titolo="Versione" valore="1.0 (web)"/>
          <Riga titolo="Dati" :valore="stato.modo === 'supabase' ? 'Condivisi (Supabase)' : 'Solo su questo dispositivo'"/>
        </Gruppo>
      </Pagina>`,
    data() {
        return {
            tema: localStorage.getItem('casaDolonne.tema') ?? 'automatico', avanzamento: '',
            temi: [{ valore: 'automatico', nome: 'Automatico' }, { valore: 'chiaro', nome: 'Chiaro' }, { valore: 'scuro', nome: 'Scuro' }]
        };
    },
    methods: {
        puoModificare, apriDaElenco, stessaPagina, pila,
        cambiaTema(v) {
            this.tema = v;
            localStorage.setItem('casaDolonne.tema', v);
            if (v === 'automatico') delete document.documentElement.dataset.tema;
            else document.documentElement.dataset.tema = v;
        },
        async inizializza() {
            try { await inizializzaDati(t => { this.avanzamento = t; }); }
            catch (e) { alert(e.message); }
            finally { this.avanzamento = ''; }
        },
        async esciConferma() { if (confirm('Vuoi uscire? Per rientrare servirà un nuovo codice via email.')) await esci(); },
        azzera() {
            if (!confirm('Cancellare tutti i dati di prova?')) return;
            backend.azzera();
            location.reload();
        }
    },
    setup() { return { db, stato, nav }; }
};

export const Famiglia = {
    template: `
      <Pagina titolo="Famiglia">
        <template #azioni>
          <button class="pulsante-barra" @click="nuovo = { email: '', nome: '', ruolo: 'lettore' }" aria-label="Aggiungi familiare"><Icona nome="piu"/></button>
        </template>
        <Gruppo nota="Chi è in questo elenco può entrare nell'app con la propria email. Gli editor possono anche modificare i dati.">
          <Riga v-for="m in membri" :key="m.email" icona="persona" :titolo="m.nome || m.email" :sottotitolo="m.email"
                :valore="m.ruolo === 'editor' ? 'Può modificare' : 'Sola lettura'" freccia @click="modifica = { ...m }"/>
        </Gruppo>
        <Foglio v-if="nuovo || modifica" :titolo="nuovo ? 'Nuovo familiare' : 'Modifica familiare'"
                :conferma-disabilitata="!/^\\S+@\\S+\\.\\S+$/.test((nuovo || modifica).email.trim())"
                @annulla="nuovo = modifica = null" @conferma="salvaMembro">
          <Gruppo>
            <CampoTesto v-if="nuovo" v-model="nuovo.email" segnaposto="Email" tipo="email"/>
            <Riga v-else titolo="Email" :valore="modifica.email"/>
            <CampoTesto v-model="(nuovo || modifica).nome" segnaposto="Nome"/>
            <CampoScelta v-model="(nuovo || modifica).ruolo" etichetta="Ruolo" :opzioni="ruoli"/>
          </Gruppo>
          <Gruppo v-if="modifica && modifica.email !== stato.utente.email"><Riga distruttiva titolo="Rimuovi dalla famiglia" @click="rimuovi"/></Gruppo>
        </Foglio>
      </Pagina>`,
    data() {
        return { nuovo: null, modifica: null,
                 ruoli: [{ valore: 'lettore', nome: 'Sola lettura' }, { valore: 'editor', nome: 'Può modificare' }] };
    },
    computed: { membri() { return db.membri.slice().sort((a, b) => (a.nome || a.email).localeCompare(b.nome || b.email)); } },
    methods: {
        async salvaMembro() {
            const m = this.nuovo ?? this.modifica;
            if (this.modifica?.email === stato.utente.email && m.ruolo !== 'editor' && !confirm('Togli a te stesso la possibilità di modificare?')) return;
            await salva('membri', { email: m.email.trim().toLowerCase(), nome: m.nome.trim(), ruolo: m.ruolo });
            this.nuovo = this.modifica = null;
        },
        async rimuovi() {
            if (!confirm(`Rimuovere ${this.modifica.email}?`)) return;
            await elimina('membri', this.modifica.email);
            this.modifica = null;
        }
    },
    setup() { return { stato }; }
};
