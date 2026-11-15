import Foundation
import SwiftData

/// Prodotto di consumo con scorta (pellet, ossigeno, correttore pH, flocculante…).
@Model
final class Prodotto {
    var nome: String = ""
    var categoriaRaw: String = CategoriaProdotto.altro.rawValue
    var unita: String = "pz"
    var scortaMinima: Double = 0
    var note: String = ""
    var ordine: Int = 0
    /// Consumo mensile indicato a mano (es. 10–12 l al mese); se assente viene calcolato dai movimenti.
    var consumoMensileFisso: Double?

    @Relationship(deleteRule: .cascade, inverse: \Movimento.prodotto)
    var movimenti: [Movimento]? = []

    @Relationship(deleteRule: .nullify, inverse: \Operazione.prodotto)
    var operazioni: [Operazione]? = []

    init(nome: String, categoria: CategoriaProdotto, unita: String, ordine: Int = 0) {
        self.nome = nome
        self.categoriaRaw = categoria.rawValue
        self.unita = unita
        self.ordine = ordine
    }

    var categoria: CategoriaProdotto {
        get { CategoriaProdotto(rawValue: categoriaRaw) ?? .altro }
        set { categoriaRaw = newValue.rawValue }
    }

    var movimentiOrdinati: [Movimento] {
        (movimenti ?? []).sorted { $0.data > $1.data }
    }

    var analisi: AnalisiScorta {
        AnalisiScorta(movimenti: movimenti ?? [], consumoMensileFisso: consumoMensileFisso)
    }

    var sottoScorta: Bool {
        scortaMinima > 0 && analisi.giacenza <= scortaMinima
    }

    /// Consumo medio e autonomia hanno senso per i consumi regolari (ossigeno, pellet…), non per il pH.
    var mostraPrevisioni: Bool { categoria != .ph }
}

/// Movimento di magazzino di un prodotto.
@Model
final class Movimento {
    var data: Date = Date.now
    var tipoRaw: String = TipoMovimento.consumo.rawValue
    var quantita: Double = 0
    /// Costo totale del movimento (solo per gli acquisti).
    var costo: Double = 0
    var fornitore: String = ""
    /// Nome commerciale del prodotto acquistato.
    var descrizioneProdotto: String = ""
    var note: String = ""
    var prodotto: Prodotto?

    init(tipo: TipoMovimento, data: Date = .now, quantita: Double = 0) {
        self.tipoRaw = tipo.rawValue
        self.data = data
        self.quantita = quantita
    }

    var tipo: TipoMovimento {
        get { TipoMovimento(rawValue: tipoRaw) ?? .consumo }
        set { tipoRaw = newValue.rawValue }
    }
}

enum CategoriaProdotto: String, CaseIterable, Identifiable {
    case pellet
    case ossigeno
    case ph
    case flocculante
    case altro

    var id: String { rawValue }

    var nome: LocalizedStringResource {
        switch self {
        case .pellet: "Pellet"
        case .ossigeno: "Ossigeno"
        case .ph: "Correttore pH"
        case .flocculante: "Flocculante"
        case .altro: "Altro"
        }
    }

    var icona: String {
        switch self {
        case .pellet: "flame.fill"
        case .ossigeno: "bubbles.and.sparkles.fill"
        case .ph: "testtube.2"
        case .flocculante: "drop.triangle.fill"
        case .altro: "shippingbox.fill"
        }
    }

    var diPiscina: Bool { self == .ossigeno || self == .ph || self == .flocculante }
}

enum TipoMovimento: String, CaseIterable, Identifiable {
    /// Carico di magazzino: aumenta la scorta, con costo.
    case acquisto
    /// Utilizzo: diminuisce la scorta della quantità indicata.
    case consumo
    /// Conteggio fisico: imposta la giacenza al valore rilevato.
    case conteggio

    var id: String { rawValue }

    var nome: LocalizedStringResource {
        switch self {
        case .acquisto: "Acquisto"
        case .consumo: "Consumo"
        case .conteggio: "Rettifica giacenza"
        }
    }

    /// Per i prodotti della piscina il consumo è il "riempimento" del dosatore/vasca.
    func nome(per categoria: CategoriaProdotto) -> LocalizedStringResource {
        if self == .consumo && categoria.diPiscina { return "Riempimento" }
        return nome
    }

    var icona: String {
        switch self {
        case .acquisto: "cart.fill.badge.plus"
        case .consumo: "minus.circle.fill"
        case .conteggio: "list.number"
        }
    }
}

/// Calcoli su giacenza, consumi e costi a partire dai movimenti.
struct AnalisiScorta {
    struct Punto: Identifiable {
        let id = UUID()
        let data: Date
        let valore: Double
    }

    /// Giacenza dopo l'ultimo movimento registrato.
    private(set) var giacenzaRegistrata: Double = 0
    private(set) var dataUltimoMovimento: Date?
    private(set) var totaleAcquistato: Double = 0
    private(set) var totaleConsumato: Double = 0
    private(set) var costoTotale: Double = 0
    /// Andamento della giacenza nel tempo (un punto per movimento).
    private(set) var andamento: [Punto] = []
    /// Consumi (espliciti o dedotti dai conteggi) con la loro data.
    private(set) var consumi: [Punto] = []
    private var primaData: Date?
    private var ultimaDataConsumo: Date?
    private var consumoMensileFisso: Double?

    init(movimenti: [Movimento], consumoMensileFisso: Double? = nil) {
        self.consumoMensileFisso = consumoMensileFisso
        let ordinati = movimenti.sorted { $0.data < $1.data }
        primaData = ordinati.first?.data
        var giacenza = 0.0
        for movimento in ordinati {
            switch movimento.tipo {
            case .acquisto:
                giacenza += movimento.quantita
                totaleAcquistato += movimento.quantita
                costoTotale += movimento.costo
            case .consumo:
                giacenza -= movimento.quantita
                registraConsumo(movimento.quantita, data: movimento.data)
            case .conteggio:
                // La differenza tra quanto atteso e quanto contato è consumo.
                let differenza = giacenza - movimento.quantita
                if differenza > 0 { registraConsumo(differenza, data: movimento.data) }
                giacenza = movimento.quantita
            }
            andamento.append(Punto(data: movimento.data, valore: giacenza))
        }
        giacenzaRegistrata = giacenza
        dataUltimoMovimento = ordinati.last?.data
    }

    private mutating func registraConsumo(_ quantita: Double, data: Date) {
        totaleConsumato += quantita
        consumi.append(Punto(data: data, valore: quantita))
        ultimaDataConsumo = data
    }

    /// Giacenza attuale: quella risultante dai movimenti registrati (nessuna stima).
    var giacenza: Double { max(0, giacenzaRegistrata) }

    /// `true` se il consumo medio è quello impostato a mano.
    var consumoImpostato: Bool { (consumoMensileFisso ?? 0) > 0 }

    /// Consumo medio giornaliero: quello impostato a mano (mensile / 30,4)
    /// oppure calcolato dal primo movimento all'ultimo consumo registrato.
    var consumoMedioGiornaliero: Double? {
        if let consumoMensileFisso, consumoMensileFisso > 0 { return consumoMensileFisso / 30.4 }
        guard let primaData, let ultimaDataConsumo, totaleConsumato > 0 else { return nil }
        let giorni = ultimaDataConsumo.timeIntervalSince(primaData) / 86_400
        guard giorni >= 1 else { return nil }
        return totaleConsumato / giorni
    }

    var consumoMedioMensile: Double? { consumoMedioGiornaliero.map { $0 * 30.4 } }

    /// Giorni di autonomia: giacenza attuale diviso consumo medio.
    var giorniAutonomia: Int? {
        guard let media = consumoMedioGiornaliero, media > 0 else { return nil }
        return Int(giacenza / media)
    }

    var costoMedioUnitario: Double? {
        totaleAcquistato > 0 ? costoTotale / totaleAcquistato : nil
    }
}
