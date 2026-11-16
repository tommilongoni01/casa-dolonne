// Avvio della web app Casa Dolonne.
import { createApp, computed } from 'vue';
import { componenti } from './components.js';
import { db, stato, avvia, puoModificare } from './store.js';
import { nav, pila, cambiaScheda, SCHEDE } from './nav.js';
import { avvisi } from './logic.js';
import { Accesso, NonAutorizzato } from './views/accesso.js';
import * as manutenzione from './views/manutenzione.js';
import * as operazione from './views/operazione.js';
import * as manuale from './views/manuale.js';
import * as contatti from './views/contatti.js';
import * as impostazioni from './views/impostazioni.js';

// Errori visibili sullo schermo: utili quando l'app è installata sulla Home e non c'è la console.
const riquadroErrori = document.getElementById('errori');
function mostraErrore(testo) {
    riquadroErrori.style.display = 'block';
    riquadroErrori.textContent = `${testo}\n\n${riquadroErrori.textContent}`.slice(0, 3000);
    setTimeout(() => { riquadroErrori.style.display = 'none'; }, 12000);
}
window.addEventListener('error', e => mostraErrore(e.message));
window.addEventListener('unhandledrejection', e => mostraErrore(e.reason?.message ?? String(e.reason)));

const RADICI = {
    manutenzione: manutenzione.ManutenzioneHome,
    magazzino: manutenzione.Magazzino,
    manuale: manuale.ManualeHome,
    contatti: contatti.ContattiLista,
    impostazioni: impostazioni.Impostazioni
};

/// Pagine apribili nella pila di una scheda (nome → componente con prop "id").
const PAGINE = {
    sistema: manutenzione.Sistema,
    contratti: manutenzione.Contratti,
    contratto: manutenzione.ContrattoPagina,
    prodotti: manutenzione.Magazzino,
    prodotto: manutenzione.ProdottoPagina,
    operazione: operazione.OperazionePagina,
    processo: operazione.ProcessoPagina,
    sezione: manuale.SezionePagina,
    guida: manuale.GuidaPagina,
    contatto: contatti.ContattoPagina,
    famiglia: impostazioni.Famiglia
};

const ETICHETTE = {
    manutenzione: { nome: 'Manutenzione', icona: 'chiave' },
    magazzino: { nome: 'Magazzino', icona: 'scatola' },
    manuale: { nome: 'Manuale', icona: 'libro' },
    contatti: { nome: 'Contatti', icona: 'persone' },
    impostazioni: { nome: 'Impostazioni', icona: 'ingranaggio' }
};

const PaginaDellaPila = {
    props: { pagina: Object },
    template: `<component :is="componente" v-bind="pagina" />`,
    computed: { componente() { return PAGINE[this.pagina.nome] ?? manutenzione.PaginaMancante; } }
};

const App = {
    components: { Accesso, NonAutorizzato, PaginaDellaPila },
    template: `
      <div v-if="!stato.pronto" class="caricamento">Caricamento…</div>
      <Accesso v-else-if="!stato.utente"/>
      <NonAutorizzato v-else-if="!stato.membro"/>
      <div v-else class="app" :class="{ largo: nav.largo }">
        <div v-if="stato.modo === 'prova'" class="striscia-prova">Modalità prova · i dati restano solo su questo dispositivo</div>
        <div class="colonne">
          <!-- Schermo largo: barra laterale come nelle app Apple per Mac e iCloud.com -->
          <aside v-if="nav.largo" class="barra-laterale">
            <div class="marchio"><img src="icone/icona-180.png" alt=""><span>Casa Dolonne</span></div>
            <nav class="laterale-voci">
              <button v-for="s in schede" :key="s" class="laterale-voce" :class="{ attiva: nav.scheda === s }"
                      :title="etichette[s].nome" @click="cambiaScheda(s)">
                <Icona :nome="etichette[s].icona" :dimensione="20"/>
                <span class="laterale-nome">{{ etichette[s].nome }}</span>
                <span v-if="s === 'manutenzione' && numeroAvvisi" class="contatore-avvisi">{{ numeroAvvisi }}</span>
              </button>
            </nav>
            <div class="laterale-utente" :title="stato.membro.email">
              <span class="avatar" style="width:32px;height:32px;font-size:13px">{{ (stato.membro.nome || stato.membro.email).slice(0, 1).toUpperCase() }}</span>
              <span class="laterale-nome">
                <span>{{ stato.membro.nome || stato.membro.email }}</span>
                <small>{{ puoModificare() ? 'Può modificare' : 'Sola lettura' }}</small>
              </span>
            </div>
          </aside>
          <div class="colonna-elenco">
            <component :is="radice" :key="nav.scheda"/>
            <div v-if="!nav.largo && cima" class="sovrapposta" :key="chiaveCima">
              <PaginaDellaPila :pagina="cima"/>
            </div>
          </div>
          <div v-if="nav.largo" class="colonna-dettaglio">
            <PaginaDellaPila v-if="cima" :pagina="cima" :key="chiaveCima"/>
            <div v-else class="pagina"><Vuoto :icona="etichette[nav.scheda].icona" :titolo="segnaposto"/></div>
          </div>
        </div>
        <nav v-if="!nav.largo" class="schede">
          <button v-for="s in schede" :key="s" class="scheda" :class="{ attiva: nav.scheda === s }" @click="cambiaScheda(s)">
            <Icona :nome="etichette[s].icona" :dimensione="24"/>
            <span>{{ etichette[s].nome }}</span>
            <span v-if="s === 'manutenzione' && numeroAvvisi" class="contatore-avvisi">{{ numeroAvvisi }}</span>
          </button>
        </nav>
      </div>`,
    setup() {
        const cima = computed(() => pila().at(-1));
        const segnaposti = {
            manutenzione: 'Scegli un sistema o un avviso', magazzino: 'Scegli un prodotto', manuale: 'Scegli un sistema',
            contatti: 'Nessun contatto selezionato', impostazioni: ''
        };
        return {
            stato, nav, cima, cambiaScheda, schede: SCHEDE, etichette: ETICHETTE, puoModificare,
            radice: computed(() => RADICI[nav.scheda]),
            chiaveCima: computed(() => `${nav.scheda}-${pila().length}-${cima.value?.nome}-${cima.value?.id ?? ''}`),
            segnaposto: computed(() => segnaposti[nav.scheda]),
            numeroAvvisi: computed(() => avvisi().filter(a => a.gravita === 'scaduto').length)
        };
    }
};

const app = createApp(App);
const globali = { ...componenti, ...manutenzione.componentiManutenzione, RigaAvviso: manutenzione.RigaAvviso, ...manuale.componentiManuale };
for (const [nome, componente] of Object.entries(globali)) app.component(nome, componente);
app.config.errorHandler = (errore) => { console.error(errore); mostraErrore(errore?.message ?? String(errore)); };
app.mount('#app');

avvia().then(async () => {
    // In modalità prova i contenuti iniziali vengono creati da soli, così l'app si può provare subito.
    if (stato.modo === 'prova' && !db.sezioni.length) {
        const { inizializzaDati } = await import('./seed.js');
        await inizializzaDati();
    }
    apriPercorsoDiProva();
});

/// Solo per i test in modalità prova: ?percorso=manutenzione/sistema:Caldaia/operazione:Pellet apre le pagine per nome.
function apriPercorsoDiProva() {
    const percorso = new URLSearchParams(location.search).get('percorso');
    if (!percorso || stato.modo !== 'prova') return;
    const [scheda, ...pagine] = percorso.split('/');
    const cerca = (elenco, campo, testo) => elenco.find(x => (x[campo] ?? '').toLowerCase().startsWith(testo.toLowerCase()));
    let sezione = null;
    nav.scheda = scheda;
    nav.pile[scheda] = pagine.map(p => {
        const [nome, testo] = p.split(':');
        let voce = null;
        if (nome === 'sistema' || nome === 'sezione') voce = sezione = cerca(db.sezioni, 'nome', testo);
        else if (nome === 'operazione') voce = cerca(db.operazioni.filter(o => !sezione || o.sezione_id === sezione.id), 'titolo', testo);
        else if (nome === 'guida') voce = cerca(db.guide, 'titolo', testo);
        else if (nome === 'prodotto') voce = cerca(db.prodotti, 'nome', testo);
        else if (nome === 'contatto') voce = cerca(db.contatti, 'nome', testo);
        else if (nome === 'processo') voce = db.processi_acqua[0];
        return voce ? { nome, id: voce.id } : { nome };
    });
}

if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}
