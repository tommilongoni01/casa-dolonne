import Foundation
import SwiftData

/// Un sistema / impianto dello chalet (es. Caldaia, Piscina, Ascensore).
/// È la struttura condivisa da Contatti, Manuale e Manutenzione.
@Model
final class Sezione {
    var nome: String = ""
    var icona: String = "wrench.and.screwdriver"
    var ordine: Int = 0

    @Relationship(deleteRule: .cascade, inverse: \Guida.sezione)
    var guide: [Guida]? = []

    @Relationship(deleteRule: .cascade, inverse: \Documento.sezione)
    var documenti: [Documento]? = []

    @Relationship(inverse: \Contatto.sezioni)
    var contatti: [Contatto]? = []

    @Relationship(deleteRule: .nullify, inverse: \Contratto.sezione)
    var contratti: [Contratto]? = []

    @Relationship(deleteRule: .nullify, inverse: \AttivitaManutenzione.sezione)
    var attivita: [AttivitaManutenzione]? = []

    @Relationship(deleteRule: .cascade, inverse: \Operazione.sezione)
    var operazioni: [Operazione]? = []

    init(nome: String, icona: String = "wrench.and.screwdriver", ordine: Int = 0) {
        self.nome = nome
        self.icona = icona
        self.ordine = ordine
    }

    var guideOrdinate: [Guida] {
        (guide ?? []).sorted { $0.titolo.localizedStandardCompare($1.titolo) == .orderedAscending }
    }

    var documentiOrdinati: [Documento] {
        (documenti ?? []).sorted { $0.titolo.localizedStandardCompare($1.titolo) == .orderedAscending }
    }

    var operazioniOrdinate: [Operazione] {
        (operazioni ?? []).sorted { $0.ordine < $1.ordine }
    }

    var contattiOrdinati: [Contatto] {
        (contatti ?? []).sorted { $0.nomeCompleto.localizedStandardCompare($1.nomeCompleto) == .orderedAscending }
    }
}

/// Icone proposte quando si crea o modifica una sezione.
enum IconeSezione {
    static let tutte: [String] = [
        "drop.fill", "bolt.fill", "flame.fill", "book.closed.fill", "sun.max.fill",
        "figure.pool.swim", "arrow.up.arrow.down.square.fill", "fan.fill", "wind",
        "thermometer.medium", "house.fill", "wrench.and.screwdriver.fill", "lightbulb.fill",
        "shower.fill", "snowflake", "leaf.fill", "lock.fill", "wifi", "tv.fill", "car.fill"
    ]
}
