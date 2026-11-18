// Navigazione: una pila di pagine per ogni scheda, riflessa nell'indirizzo (#scheda/pagina:id/...).
// Su iPad la prima pagina della pila va nella colonna di destra; su iPhone la pila si sovrappone all'elenco.
import { reactive, watch } from 'vue';

export const SCHEDE = ['casa', 'magazzino', 'contratti', 'contatti', 'impostazioni'];

export const nav = reactive({
    scheda: 'casa',
    pile: Object.fromEntries(SCHEDE.map(s => [s, []])),
    largo: window.matchMedia('(min-width: 860px)').matches
});

window.matchMedia('(min-width: 860px)').addEventListener('change', e => { nav.largo = e.matches; });

export const pila = () => nav.pile[nav.scheda];

/// Elenco e dettaglio affiancati (schermo largo). La Casa usa invece tutta la larghezza,
/// come l'app Casa di Apple: le pagine degli impianti si aprono sopra la home.
export const diviso = () => nav.largo && nav.scheda !== 'casa';

/// Apre una pagina sopra quella attuale.
export function apri(pagina) {
    pila().push(pagina);
}

/// Apre una pagina dall'elenco principale: su iPad sostituisce il contenuto della colonna di destra.
export function apriDaElenco(pagina) {
    nav.pile[nav.scheda] = [pagina];
}

export function indietro() {
    pila().pop();
}

export function cambiaScheda(scheda) {
    if (nav.scheda === scheda) nav.pile[scheda] = []; // secondo tocco: torna all'inizio
    nav.scheda = scheda;
}

export const stessaPagina = (a, b) => !!a && !!b && a.nome === b.nome && a.id === b.id;

// ---- Indirizzo ------------------------------------------------------------
function codifica() {
    const pagine = pila().map(p => p.id ? `${p.nome}:${p.id}` : p.nome);
    return '#' + [nav.scheda, ...pagine].join('/');
}

// Indirizzi della versione precedente (schede Manutenzione e Manuale, pagine sistema/sezione),
// ad esempio nei codici QR già stampati: portano alla scheda Casa e alla pagina dell'impianto.
const VECCHIE_SCHEDE = { manutenzione: 'casa', manuale: 'casa' };
const VECCHIE_PAGINE = { sistema: 'impianto', sezione: 'impianto' };

function decodifica(hash) {
    let [scheda, ...pagine] = hash.replace(/^#/, '').split('/').filter(Boolean);
    scheda = VECCHIE_SCHEDE[scheda] ?? scheda;
    if (!SCHEDE.includes(scheda)) return;
    nav.scheda = scheda;
    nav.pile[scheda] = pagine.map(p => {
        const [vecchio, id] = p.split(':');
        const nome = VECCHIE_PAGINE[vecchio] ?? vecchio;
        return id ? { nome, id } : { nome };
    });
}

decodifica(location.hash);
let daIndirizzo = false;
window.addEventListener('hashchange', () => {
    if (location.hash === codifica()) return;
    daIndirizzo = true;
    decodifica(location.hash);
});
watch(() => codifica(), nuovo => {
    if (daIndirizzo) { daIndirizzo = false; return; }
    if (location.hash !== nuovo) history.replaceState(null, '', nuovo);
});
