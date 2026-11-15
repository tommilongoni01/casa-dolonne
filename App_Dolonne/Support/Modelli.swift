import SwiftData

/// Elenco di tutti i modelli salvati, condiviso tra app e anteprime.
enum Modelli {
    static let tutti: [any PersistentModel.Type] = [
        Sezione.self, Contatto.self,
        Guida.self, BloccoGuida.self, Documento.self,
        Contratto.self, AttivitaManutenzione.self, Intervento.self,
        Prodotto.self, Movimento.self,
        Operazione.self, MisuraPH.self, ProcessoAcqua.self, LetturaLivello.self,
        CaricoPellet.self, SvuotamentoCeneri.self, InterventoStorico.self, TipologiaIntervento.self
    ]

    /// Contenitore in memoria per le anteprime di Xcode.
    static func anteprima() -> ModelContainer {
        let schema = Schema(tutti)
        return try! ModelContainer(for: schema, configurations: ModelConfiguration(isStoredInMemoryOnly: true))
    }
}
