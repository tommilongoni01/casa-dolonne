import Foundation
import SwiftData

/// Contratto di manutenzione / assistenza con un fornitore.
@Model
final class Contratto {
    var titolo: String = ""
    var numero: String = ""
    var dataInizio: Date = Date.now
    var dataScadenza: Date?
    var costoAnnuo: Double = 0
    var rinnovoAutomatico: Bool = false
    var giorniPreavviso: Int = 30
    var note: String = ""
    @Attribute(.externalStorage) var allegato: Data?
    var nomeAllegato: String = ""

    var fornitore: Contatto?
    var sezione: Sezione?

    @Relationship(deleteRule: .nullify, inverse: \AttivitaManutenzione.contratto)
    var attivita: [AttivitaManutenzione]? = []

    init(titolo: String = "") {
        self.titolo = titolo
    }

    var stato: StatoScadenza {
        guard let dataScadenza else { return .ok }
        return StatoScadenza.calcola(scadenza: dataScadenza, preavvisoGiorni: giorniPreavviso)
    }
}

/// Attività ricorrente (manutenzione, ispezione, verifica di legge…).
/// La prossima scadenza si calcola dall'ultimo intervento registrato.
@Model
final class AttivitaManutenzione {
    var titolo: String = ""
    var descrizione: String = ""
    var tipoRaw: String = TipoAttivita.manutenzione.rawValue
    var intervalloValore: Int = 12
    var intervalloUnitaRaw: String = UnitaIntervallo.mesi.rawValue
    /// Usata come scadenza quando non è ancora stato registrato alcun intervento.
    var primaScadenza: Date = Date.now
    var giorniPreavviso: Int = 7
    var attiva: Bool = true

    var sezione: Sezione?
    var contratto: Contratto?

    @Relationship(deleteRule: .cascade, inverse: \Intervento.attivita)
    var interventi: [Intervento]? = []

    init(titolo: String = "") {
        self.titolo = titolo
    }

    var tipo: TipoAttivita {
        get { TipoAttivita(rawValue: tipoRaw) ?? .manutenzione }
        set { tipoRaw = newValue.rawValue }
    }

    var intervalloUnita: UnitaIntervallo {
        get { UnitaIntervallo(rawValue: intervalloUnitaRaw) ?? .mesi }
        set { intervalloUnitaRaw = newValue.rawValue }
    }

    var interventiOrdinati: [Intervento] {
        (interventi ?? []).sorted { $0.data > $1.data }
    }

    var ultimoIntervento: Intervento? { interventiOrdinati.first }

    var prossimaScadenza: Date {
        guard let ultimo = ultimoIntervento else { return primaScadenza }
        return intervalloUnita.aggiungi(intervalloValore, a: ultimo.data)
    }

    var stato: StatoScadenza {
        guard attiva else { return .ok }
        return StatoScadenza.calcola(scadenza: prossimaScadenza, preavvisoGiorni: giorniPreavviso)
    }

    var descrizioneIntervallo: String {
        String(localized: "Ogni \(intervalloValore) \(intervalloUnita.nome)")
    }
}

/// Registrazione di un intervento eseguito su un'attività.
@Model
final class Intervento {
    var data: Date = Date.now
    var descrizione: String = ""
    var eseguitoDa: String = ""
    var costo: Double = 0
    var note: String = ""
    var attivita: AttivitaManutenzione?

    init(data: Date = .now) {
        self.data = data
    }
}

enum TipoAttivita: String, CaseIterable, Identifiable {
    case manutenzione
    case ispezione
    case verifica
    case pulizia

    var id: String { rawValue }

    var nome: LocalizedStringResource {
        switch self {
        case .manutenzione: "Manutenzione"
        case .ispezione: "Ispezione"
        case .verifica: "Verifica periodica"
        case .pulizia: "Pulizia"
        }
    }
}

enum UnitaIntervallo: String, CaseIterable, Identifiable {
    case giorni
    case settimane
    case mesi
    case anni

    var id: String { rawValue }

    var nome: String {
        switch self {
        case .giorni: String(localized: "giorni")
        case .settimane: String(localized: "settimane")
        case .mesi: String(localized: "mesi")
        case .anni: String(localized: "anni")
        }
    }

    func aggiungi(_ valore: Int, a data: Date) -> Date {
        let componente: Calendar.Component = switch self {
        case .giorni: .day
        case .settimane: .weekOfYear
        case .mesi: .month
        case .anni: .year
        }
        return Calendar.current.date(byAdding: componente, value: valore, to: data) ?? data
    }
}

/// Stato di una scadenza rispetto a oggi.
enum StatoScadenza: Int, Comparable {
    case scaduta = 0
    case inScadenza = 1
    case ok = 2

    static func < (lhs: StatoScadenza, rhs: StatoScadenza) -> Bool { lhs.rawValue < rhs.rawValue }

    static func calcola(scadenza: Date, preavvisoGiorni: Int, oggi: Date = .now) -> StatoScadenza {
        let calendario = Calendar.current
        let inizioOggi = calendario.startOfDay(for: oggi)
        let giorno = calendario.startOfDay(for: scadenza)
        if giorno < inizioOggi { return .scaduta }
        let giorniMancanti = calendario.dateComponents([.day], from: inizioOggi, to: giorno).day ?? 0
        return giorniMancanti <= max(preavvisoGiorni, 0) ? .inScadenza : .ok
    }
}
