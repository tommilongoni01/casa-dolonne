import Foundation
import SwiftData

/// Misura del pH con i due strumenti disponibili.
@Model
final class MisuraPH {
    var data: Date = Date.now
    var valoreStrumento1: Double?
    var valoreStrumento2: Double?
    var note: String = ""

    init(data: Date = .now) {
        self.data = data
    }

    var media: Double? {
        let valori = [valoreStrumento1, valoreStrumento2].compactMap { $0 }
        guard !valori.isEmpty else { return nil }
        return valori.reduce(0, +) / Double(valori.count)
    }
}

/// Svuotamento o riempimento della piscina, seguito "live" con letture del livello nel tempo.
@Model
final class ProcessoAcqua {
    var tipoRaw: String = TipoProcessoAcqua.svuotamento.rawValue
    var dataInizio: Date = Date.now
    /// `nil` finché il processo è in corso.
    var dataFine: Date?
    var temperaturaIniziale: Double?
    var temperaturaFinale: Double?
    var livelloIniziale: Double = 0
    var livelloFinale: Double?
    /// Livello da raggiungere, usato per stimare il tempo mancante.
    var livelloObiettivo: Double?
    var note: String = ""

    @Relationship(deleteRule: .cascade, inverse: \LetturaLivello.processo)
    var letture: [LetturaLivello]? = []

    init(tipo: TipoProcessoAcqua, dataInizio: Date = .now) {
        self.tipoRaw = tipo.rawValue
        self.dataInizio = dataInizio
    }

    var tipo: TipoProcessoAcqua { TipoProcessoAcqua(rawValue: tipoRaw) ?? .svuotamento }

    var inCorso: Bool { dataFine == nil }

    var lettureOrdinate: [LetturaLivello] {
        (letture ?? []).sorted { $0.data < $1.data }
    }

    /// Tutti i punti del processo: inizio, letture intermedie e fine.
    var punti: [(data: Date, livello: Double)] {
        var elenco = [(data: dataInizio, livello: livelloIniziale)]
        elenco += lettureOrdinate.map { (data: $0.data, livello: $0.livello) }
        if let dataFine, let livelloFinale { elenco.append((data: dataFine, livello: livelloFinale)) }
        return elenco
    }

    var livelloAttuale: Double { punti.last?.livello ?? livelloIniziale }

    /// Centimetri di variazione dall'inizio (sempre positivi).
    var variazione: Double { abs(livelloAttuale - livelloIniziale) }

    var durata: TimeInterval { (dataFine ?? punti.last?.data ?? dataInizio).timeIntervalSince(dataInizio) }

    /// Velocità media in cm/ora (con segno: negativa se il livello cala).
    var velocita: Double? {
        let ore = durata / 3600
        guard ore > 0.01 else { return nil }
        return (livelloAttuale - livelloIniziale) / ore
    }

    /// Stima di quando verrà raggiunto il livello obiettivo, alla velocità media attuale.
    var arrivoStimato: Date? {
        guard inCorso, let livelloObiettivo, let velocita, velocita != 0,
              let ultimo = punti.last else { return nil }
        let ore = (livelloObiettivo - ultimo.livello) / velocita
        guard ore >= 0 else { return nil }
        return ultimo.data.addingTimeInterval(ore * 3600)
    }
}

/// Lettura del livello dell'acqua durante un processo.
@Model
final class LetturaLivello {
    var data: Date = Date.now
    var livello: Double = 0
    var processo: ProcessoAcqua?

    init(data: Date = .now, livello: Double) {
        self.data = data
        self.livello = livello
    }
}

enum TipoProcessoAcqua: String, CaseIterable, Identifiable {
    case svuotamento
    case riempimento

    var id: String { rawValue }

    var nome: LocalizedStringResource {
        switch self {
        case .svuotamento: "Svuotamento"
        case .riempimento: "Riempimento"
        }
    }

    var icona: String {
        switch self {
        case .svuotamento: "arrow.down.to.line"
        case .riempimento: "arrow.up.to.line"
        }
    }
}
