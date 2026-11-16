// Icone SVG semplici in stile SF Symbols (tratto arrotondato, 24×24).
const P = {
    // sistemi
    goccia: '<path d="M12 3c3.5 4.5 6 7.8 6 11a6 6 0 0 1-12 0c0-3.2 2.5-6.5 6-11z"/>',
    fulmine: '<path d="M13 2 5 13h6l-1 9 8-11h-6l1-9z"/>',
    fiamma: '<path d="M12 2c.6 3.4 2.9 5.4 4.7 7.9C18.2 12 19 13.7 19 15.6a7 7 0 0 1-14 0c0-2.6 1.3-4.7 3.1-6.3.2 2 1 3.4 2.4 4.2-.4-3.8.3-7.6 1.5-11.5z"/>',
    libro: '<path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5z"/><path d="M6 19h12v2H6"/>',
    sole: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    piscina: '<path d="M3 17c1.5 0 1.5 1 3 1s1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1"/><path d="M3 13c1.5 0 1.5 1 3 1s1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1"/><circle cx="15" cy="6" r="2"/><path d="m6 11 4-4 3 3"/>',
    ascensore: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="m9 10 3-3 3 3M9 14l3 3 3-3"/>',
    scudo: '<path d="M12 2.5 4.5 5.5v6c0 4.6 3.2 8.6 7.5 10 4.3-1.4 7.5-5.4 7.5-10v-6z"/><circle cx="12" cy="10.5" r="2"/><path d="M12 12.5v3.5"/>',
    germoglio: '<path d="M12 21v-8.5"/><path d="M12 12.5c0-4.6 3-8 8.5-8.5-.5 5.4-4 8.5-8.5 8.5z"/><path d="M12 15.5c0-3.6-2.4-6.1-7-6.5.4 4.2 3 6.5 7 6.5z"/>',
    ventola: '<circle cx="12" cy="12" r="1.5"/><path d="M12 10.5c0-4 1-7 4-7 2 0 2.5 3-1 5.5M13.5 12c4 0 7 1 7 4 0 2-3 2.5-5.5-1M12 13.5c0 4-1 7-4 7-2 0-2.5-3 1-5.5M10.5 12c-4 0-7-1-7-4 0-2 3-2.5 5.5 1"/>',
    vento: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8"/>',
    casa: '<path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    chiave: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5z"/>',
    // azioni e stati
    provetta: '<path d="M9 3h6M10 3v12a2 2 0 0 0 4 0V3"/><path d="M10 10h4"/>',
    bolle: '<circle cx="8" cy="14" r="4"/><circle cx="16" cy="8" r="3"/><circle cx="17" cy="17" r="2"/>',
    ciclo: '<path d="M20 11a8 8 0 0 0-14.3-4.3L4 9M4 13a8 8 0 0 0 14.3 4.3L20 15"/><path d="M4 4v5h5M20 20v-5h-5"/>',
    cestino: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    lista: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>',
    documento: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
    scatola: '<path d="M3 7 12 3l9 4v10l-9 4-9-4z"/><path d="m3 7 9 4 9-4M12 11v10"/>',
    giu: '<path d="M12 4v14M6 12l6 6 6-6M5 21h14"/>',
    su: '<path d="M12 20V6M6 12l6-6 6 6M5 3h14"/>',
    piu: '<path d="M12 5v14M5 12h14"/>',
    piuCerchio: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    meno: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
    carrello: '<path d="M3 4h2l2.5 11h10L20 7H6.2"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
    righello: '<path d="M4 16 16 4l4 4L8 20z"/><path d="m8 12 2 2M11 9l2 2M14 6l2 2"/>',
    bandiera: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    avviso: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
    orologio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    stampa: '<path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7" rx="1"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4h-4"/>',
    spunta: '<path d="m5 12 5 5 9-11"/>',
    sigillo: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    campana: '<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4z"/><path d="M10 21h4"/>',
    matita: '<path d="M4 20h4L20 8l-4-4L4 16z"/><path d="m14 6 4 4"/>',
    graffetta: '<path d="M8 12.5 14 6.5a3 3 0 0 1 4.2 4.2L10 19a5 5 0 0 1-7-7l8-8"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6L11.5 7"/><path d="M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1.5-1.5"/>',
    persona: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    persone: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 13.5a7 7 0 0 1 4 6.5"/>',
    ingranaggio: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    telefono: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
    messaggio: '<path d="M4 5h16v11H9l-5 4z"/>',
    posta: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    whatsapp: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9c0 3 3 6 6 6l1-1.5-2-1-1 1c-1-.5-2-1.5-2.5-2.5l1-1-1-2z"/>',
    mappa: '<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    globo: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
    stella: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
    ricerca: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    indietro: '<path d="m15 5-7 7 7 7"/>',
    avanti: '<path d="m9 5 7 7-7 7"/>',
    chiudi: '<path d="M6 6l12 12M18 6 6 18"/>',
    foto: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 8"/>',
    testo: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    frecciaSu: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    frecciaGiu: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    frecciaGiu: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    esci: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>',
    luna: '<path d="M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z"/>',
    barraLaterale: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    importa: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>'
};

export const ICONE_SEZIONE = ['goccia', 'fulmine', 'fiamma', 'libro', 'sole', 'piscina', 'ascensore', 'ventola',
    'vento', 'scudo', 'germoglio', 'casa', 'chiave'];

/// Colore dell'icona di ogni sistema, come nell'app Impostazioni di iOS.
export const COLORE_SEZIONE = {
    goccia: '#0A84FF', fulmine: '#FFB800', fiamma: '#FF9500', libro: '#8E8E93', sole: '#34C759',
    piscina: '#32ADE6', ascensore: '#5856D6', ventola: '#30B0C7', vento: '#00C7BE', casa: '#A2845E',
    scudo: '#FF3B30', germoglio: '#30A14E',
    chiave: 'var(--accento)'
};

export function svg(nome, dimensione = 22) {
    return `<svg width="${dimensione}" height="${dimensione}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[nome] ?? P.lista}</svg>`;
}
