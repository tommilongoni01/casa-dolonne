import Foundation
import SwiftData

/// Carico di pellet acquistato (quantità in quintali).
@Model
final class CaricoPellet {
    var data: Date = Date.now
    var fornitore: String = ""
    var quintali: Double = 0
    /// Prezzo al quintale IVA esclusa.
    var prezzoQuintale: Double = 0
    var ivaPercentuale: Double = 22
    /// Pellet presente nel deposito prima del carico, in quintali.
    var precarico: Double?
    var note: String = ""

    init(data: Date = .now) {
        self.data = data
    }

    var imponibile: Double { quintali * prezzoQuintale }
    var iva: Double { imponibile * ivaPercentuale / 100 }
    var totale: Double { imponibile + iva }
    var postcarico: Double? { precarico.map { $0 + quintali } }
}

/// Svuotamento del cassetto ceneri, con il pellet a scorta in quel momento.
@Model
final class SvuotamentoCeneri {
    var data: Date = Date.now
    /// Pellet a scorta nel deposito al momento dello svuotamento, in kg.
    var scortaKg: Double?
    var note: String = ""

    init(data: Date = .now) {
        self.data = data
    }
}

/// Tipologia di intervento di uno storico manutenzioni, con la sua periodicità
/// (es. Ascensore: "Manutenzione impianto" ogni 6 mesi, "Verifica periodica" ogni 24 mesi).
@Model
final class TipologiaIntervento {
    var nome: String = ""
    /// Avviso N mesi dopo l'ultimo intervento di questa tipologia (0 = nessun avviso).
    var mesiAvviso: Int = 0
    var ordine: Int = 0
    var operazione: Operazione?

    @Relationship(deleteRule: .nullify, inverse: \InterventoStorico.tipologia)
    var interventi: [InterventoStorico]? = []

    init(nome: String, mesiAvviso: Int, ordine: Int) {
        self.nome = nome
        self.mesiAvviso = mesiAvviso
        self.ordine = ordine
    }

    var ultimoIntervento: InterventoStorico? {
        (interventi ?? []).max { $0.data < $1.data }
    }

    /// Prossima scadenza: ultimo intervento + periodicità.
    var prossimaScadenza: Date? {
        guard mesiAvviso > 0, let ultimo = ultimoIntervento else { return nil }
        let calendario = Calendar.current
        return calendario.date(byAdding: .month, value: mesiAvviso, to: calendario.startOfDay(for: ultimo.data))
    }

    var descrizionePeriodicita: String {
        guard mesiAvviso > 0 else { return String(localized: "Nessun avviso") }
        if mesiAvviso % 12 == 0 {
            let anni = mesiAvviso / 12
            return anni == 1 ? String(localized: "Ogni anno") : String(localized: "Ogni \(anni) anni")
        }
        return mesiAvviso == 1 ? String(localized: "Ogni mese") : String(localized: "Ogni \(mesiAvviso) mesi")
    }
}

/// Intervento nello storico manutenzioni di un sistema.
@Model
final class InterventoStorico {
    var data: Date = Date.now
    /// Tipo usato prima delle tipologie configurabili (solo per la migrazione dei dati).
    var tipoRaw: String = TipoInterventoStorico.principale.rawValue
    var note: String = ""
    var operazione: Operazione?
    var tipologia: TipologiaIntervento?

    init(data: Date = .now, tipo: TipoInterventoStorico = .principale) {
        self.data = data
        self.tipoRaw = tipo.rawValue
    }

    var tipo: TipoInterventoStorico {
        get { TipoInterventoStorico(rawValue: tipoRaw) ?? .principale }
        set { tipoRaw = newValue.rawValue }
    }
}

enum TipoInterventoStorico: String, CaseIterable, Identifiable {
    /// Manutenzione del tecnico (fa partire il conteggio dell'avviso).
    case principale
    /// Manutenzione ordinaria fatta da noi.
    case cliente

    var id: String { rawValue }

    var nome: LocalizedStringResource {
        switch self {
        case .principale: "Principale"
        case .cliente: "Cliente"
        }
    }
}
