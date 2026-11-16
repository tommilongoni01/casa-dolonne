// Formati in italiano, con il punto delle migliaia sempre presente (1.430,00 €).
const formatoEuro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always' });
const formatoNumero = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2, useGrouping: 'always' });
const formatoUnDecimale = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 2 });

export const euro = v => formatoEuro.format(Number(v) || 0);
export const numero = v => formatoNumero.format(Number(v) || 0);
export const quantita = (v, unita) => `${numero(v)} ${unita}`;
export const ph = v => (v === null || v === undefined || v === '') ? '–' : formatoUnDecimale.format(Number(v));

/// Legge un numero scritto con la virgola o con il punto. Restituisce null se vuoto.
export function leggiNumero(testo) {
    if (testo === null || testo === undefined) return null;
    const pulito = String(testo).trim().replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
    if (pulito === '' || pulito === '-') return null;
    const valore = Number(pulito);
    return Number.isFinite(valore) ? valore : null;
}

/// Numero da mostrare in un campo di testo modificabile.
export const numeroCampo = v => (v === null || v === undefined || v === '') ? '' : String(v).replace('.', ',');

// ---- Date ------------------------------------------------------------
// Le date senza ora sono stringhe "AAAA-MM-GG": le trattiamo come giorni locali.
export function giorno(valore) {
    if (!valore) return null;
    if (valore instanceof Date) return new Date(valore.getFullYear(), valore.getMonth(), valore.getDate());
    if (/^\d{4}-\d{2}-\d{2}$/.test(valore)) {
        const [a, m, g] = valore.split('-').map(Number);
        return new Date(a, m - 1, g);
    }
    const d = new Date(valore);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function oggiISO() { return isoGiorno(new Date()); }

export function isoGiorno(data) {
    const d = giorno(data);
    const due = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
}

export function aggiungiGiorni(data, n) {
    const d = giorno(data); d.setDate(d.getDate() + n); return d;
}

export function aggiungiMesi(data, n) {
    const d = giorno(data); const g = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + n);
    const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(g, ultimo));
    return d;
}

export function giorniTra(da, a) {
    return Math.round((giorno(a) - giorno(da)) / 86_400_000);
}

export const giorniTrascorsi = data => giorniTra(data, new Date());

const fData = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
const fDataBreve = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
const fDataTabella = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: '2-digit', year: '2-digit' });
const fOra = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });
const fDataOra = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const data = v => v ? fData.format(giorno(v)) : '–';
export const dataBreve = v => v ? fDataBreve.format(giorno(v)) : '–';
export const dataTabella = v => v ? fDataTabella.format(giorno(v)) : '–';
export const ora = v => v ? fOra.format(new Date(v)) : '–';
export const dataOra = v => v ? fDataOra.format(new Date(v)) : '–';

/// "1 h 20 min" a partire da millisecondi.
export function durata(ms) {
    const minuti = Math.max(0, Math.round(ms / 60000));
    const giorni = Math.floor(minuti / 1440), h = Math.floor((minuti % 1440) / 60), m = minuti % 60;
    // Oltre un giorno: "2 g 3 h" (i minuti non servono più).
    if (giorni > 0) return h ? `${giorni} g ${h} h` : `${giorni} g`;
    if (h === 0) return `${m} min`;
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/// Cronometro "1:02:03".
export function cronometro(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const due = n => String(n).padStart(2, '0');
    return `${h}:${due(m)}:${due(sec)}`;
}

export function dimensioneFile(byte) {
    if (!byte) return '';
    if (byte < 1024 * 1024) return `${numero(byte / 1024)} KB`;
    return `${numero(byte / 1024 / 1024)} MB`;
}
