import Foundation
import SwiftData

/// Operazione da eseguire su un sistema (es. pH della piscina, pellet della caldaia).
/// Ogni operazione ha una descrizione con i passaggi, dei dati "live" che dipendono
/// dal tipo, un eventuale allarme e un collegamento alla guida del manuale.
@Model
final class Operazione {
    var titolo: String = ""
    var tipoRaw: String = TipoOperazione.generica.rawValue
    var descrizione: String = ""
    var passaggi: [String] = []
    var ordine: Int = 0
    /// Allarme dopo N giorni dall'ultimo riempimento del prodotto (0 = nessun allarme).
    var giorniAllarme: Int = 0
    /// Avviso dopo N mesi dall'ultima manutenzione principale (0 = nessun avviso).
    var mesiAllarme: Int = 0
    /// Nello storico manutenzioni distingue tra manutenzione principale e cliente.
    var conTipologie: Bool = false

    var sezione: Sezione?
    var prodotto: Prodotto?
    var guida: Guida?

    @Relationship(deleteRule: .cascade, inverse: \InterventoStorico.operazione)
    var interventi: [InterventoStorico]? = []

    @Relationship(deleteRule: .cascade, inverse: \TipologiaIntervento.operazione)
    var tipologie: [TipologiaIntervento]? = []

    /// Note libere sull'operazione.
    var note: String = ""

    init(titolo: String, tipo: TipoOperazione, sezione: Sezione?, ordine: Int = 0) {
        self.titolo = titolo
        self.tipoRaw = tipo.rawValue
        self.sezione = sezione
        self.ordine = ordine
    }

    var tipo: TipoOperazione {
        get { TipoOperazione(rawValue: tipoRaw) ?? .generica }
        set { tipoRaw = newValue.rawValue }
    }

    var interventiOrdinati: [InterventoStorico] {
        (interventi ?? []).sorted { $0.data > $1.data }
    }

    /// Data dell'ultimo riempimento (consumo) del prodotto collegato.
    var ultimoRiempimento: Date? {
        (prodotto?.movimenti ?? []).filter { $0.tipo == .consumo }.map(\.data).max()
    }

    var tipologieOrdinate: [TipologiaIntervento] {
        (tipologie ?? []).sorted { $0.ordine < $1.ordine }
    }

    /// Data dell'ultimo intervento registrato nello storico.
    var ultimoIntervento: Date? { interventiOrdinati.first?.data }

    /// Tutti gli allarmi attivi dell'operazione: riempimento (es. ossigeno dopo 20 giorni)
    /// e una scadenza per ogni tipologia di manutenzione con periodicità.
    var allarmi: [AllarmeOperazione] {
        var elenco: [AllarmeOperazione] = []
        let calendario = Calendar.current
        if giorniAllarme > 0, let ultimoRiempimento,
           let data = calendario.date(byAdding: .day, value: giorniAllarme, to: calendario.startOfDay(for: ultimoRiempimento)) {
            elenco.append(AllarmeOperazione(
                id: "riempimento", titolo: String(localized: "Riempimento \(titolo.lowercased())"),
                dettaglio: String(localized: "Ultimo riempimento \(ultimoRiempimento.giorniTrascorsi) giorni fa"),
                data: data, giorniPreavviso: 2, preavvisoNotifica: false))
        }
        for tipologia in tipologieOrdinate {
            guard let data = tipologia.prossimaScadenza, let ultimo = tipologia.ultimoIntervento else { continue }
            let nomeSistema = sezione?.nome ?? titolo
            elenco.append(AllarmeOperazione(
                id: "tipologia-\(tipologia.persistentModelID.hashValue)",
                titolo: tipologieOrdinate.count > 1 ? "\(tipologia.nome) · \(nomeSistema)" : String(localized: "Manutenzione \(nomeSistema)"),
                dettaglio: String(localized: "Ultima il \(ultimo.data.formatted(date: .abbreviated, time: .omitted))"),
                data: data, giorniPreavviso: 14, preavvisoNotifica: true))
        }
        return elenco.sorted { $0.data < $1.data }
    }

    /// Il primo allarme in ordine di data.
    var prossimoAllarme: AllarmeOperazione? { allarmi.first }

    var dataAllarme: Date? { prossimoAllarme?.data }

    /// Lo stato peggiore tra gli allarmi.
    var statoAllarme: StatoScadenza? { allarmi.map(\.stato).min() }
}

/// Un allarme di un'operazione (riempimento o scadenza di una tipologia di manutenzione).
struct AllarmeOperazione: Identifiable {
    let id: String
    let titolo: String
    let dettaglio: String
    let data: Date
    /// Giorni prima in cui diventa arancione.
    let giorniPreavviso: Int
    /// Se `true` arriva anche una notifica nel giorno del preavviso.
    let preavvisoNotifica: Bool

    /// Arancione nel periodo di preavviso, rosso dal giorno dell'allarme in poi.
    var stato: StatoScadenza {
        if data <= .now { return .scaduta }
        return StatoScadenza.calcola(scadenza: data, preavvisoGiorni: giorniPreavviso)
    }
}

enum TipoOperazione: String, CaseIterable, Identifiable {
    case ph
    case ossigeno
    case cambioAcqua
    case pellet
    case ceneri
    case storicoManutenzioni
    case generica

    var id: String { rawValue }

    var nome: LocalizedStringResource {
        switch self {
        case .ph: "pH"
        case .ossigeno: "Ossigeno"
        case .cambioAcqua: "Cambio acqua"
        case .pellet: "Pellet"
        case .ceneri: "Svuotamento cenere"
        case .storicoManutenzioni: "Storico manutenzioni"
        case .generica: "Operazione"
        }
    }

    var icona: String {
        switch self {
        case .ph: "testtube.2"
        case .ossigeno: "bubbles.and.sparkles.fill"
        case .cambioAcqua: "arrow.triangle.2.circlepath"
        case .pellet: "flame.fill"
        case .ceneri: "trash.fill"
        case .storicoManutenzioni: "wrench.and.screwdriver.fill"
        case .generica: "checklist"
        }
    }

    /// Categoria del prodotto a scorta usato dall'operazione, se presente.
    var categoriaProdotto: CategoriaProdotto? {
        switch self {
        case .ph: .ph
        case .ossigeno: .ossigeno
        default: nil
        }
    }

    /// Le operazioni che possono avere un prodotto a scorta collegato.
    /// (Il pH gestisce più prodotti, ognuno con la sua scheda.)
    var usaProdotto: Bool { self == .ossigeno || self == .generica }
}
