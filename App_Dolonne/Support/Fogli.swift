import SwiftUI
import SwiftData
import UniformTypeIdentifiers

/// Tutti i pannelli di inserimento/modifica usati nelle operazioni di manutenzione.
///
/// I pannelli vengono presentati da un unico punto, a livello di pagina (`ospitaFogli()`),
/// e non dalle righe della lista: le righe vengono ricreate quando i dati cambiano e
/// un pannello agganciato a una riga si chiuderebbe da solo o farebbe crashare l'app.
enum Foglio: Identifiable {
    case misuraPH(MisuraPH?)
    case movimento(TipoMovimento, Prodotto, Movimento?)
    case avvioProcesso(TipoProcessoAcqua, ultimoLivello: Double?)
    case caricoPellet(CaricoPellet?)
    case ceneri(SvuotamentoCeneri?)
    case interventoStorico(Operazione, InterventoStorico?)
    case contratto(Sezione)
    case nuovoProdotto(CategoriaProdotto)

    var id: String {
        switch self {
        case .misuraPH(let voce): "misura-\(Self.chiave(voce))"
        case .movimento(let tipo, _, let voce): "movimento-\(tipo.rawValue)-\(Self.chiave(voce))"
        case .avvioProcesso(let tipo, _): "processo-\(tipo.rawValue)"
        case .caricoPellet(let voce): "pellet-\(Self.chiave(voce))"
        case .ceneri(let voce): "ceneri-\(Self.chiave(voce))"
        case .interventoStorico(_, let voce): "storico-\(Self.chiave(voce))"
        case .contratto(let sezione): "contratto-\(Self.chiave(sezione))"
        case .nuovoProdotto(let categoria): "prodotto-\(categoria.rawValue)"
        }
    }

    private static func chiave(_ modello: (any PersistentModel)?) -> String {
        modello.map { "\($0.persistentModelID.hashValue)" } ?? "nuovo"
    }

    @ViewBuilder
    var vista: some View {
        switch self {
        case .misuraPH(let voce): MisuraPHModificaView(misura: voce)
        case .movimento(let tipo, let prodotto, let voce): MovimentoModificaView(movimento: voce, tipo: tipo, prodotto: prodotto)
        case .avvioProcesso(let tipo, let livello): AvvioProcessoView(tipo: tipo, ultimoLivello: livello)
        case .caricoPellet(let voce): CaricoPelletModificaView(carico: voce)
        case .ceneri(let voce): SvuotamentoCeneriModificaView(svuotamento: voce)
        case .interventoStorico(let operazione, let voce): InterventoStoricoModificaView(operazione: operazione, intervento: voce)
        case .contratto(let sezione): ContrattoModificaView(contratto: nil, sezionePredefinita: sezione)
        case .nuovoProdotto(let categoria): ProdottoModificaView(prodotto: nil, ordine: 100, categoriaPredefinita: categoria)
        }
    }
}

/// Oggetto stabile condiviso dalla pagina: le sezioni lo usano per chiedere un pannello
/// senza osservarne lo stato, quindi non vengono ridisegnate quando un pannello si apre.
@Observable
final class PresentatoreFogli {
    var foglio: Foglio?
    /// Sezione in cui salvare i documenti scelti con l'importazione file.
    var sezioneImportazione: Sezione?
    var mostraImportazione = false
    var erroreImportazione: String?

    func apri(_ foglio: Foglio) {
        self.foglio = foglio
    }

    func importaDocumenti(in sezione: Sezione) {
        sezioneImportazione = sezione
        mostraImportazione = true
    }
}

private struct OspiteFogli: ViewModifier {
    @Environment(\.modelContext) private var contesto
    @State private var presentatore = PresentatoreFogli()

    func body(content: Content) -> some View {
        @Bindable var presentatore = presentatore
        content
            .environment(presentatore)
            .sheet(item: $presentatore.foglio) { $0.vista }
            .fileImporter(isPresented: $presentatore.mostraImportazione,
                          allowedContentTypes: [.pdf, .image, .data],
                          allowsMultipleSelection: true) { risultato in
                importa(risultato)
            }
            .alert("Importazione non riuscita", isPresented: Binding {
                presentatore.erroreImportazione != nil
            } set: { if !$0 { presentatore.erroreImportazione = nil } }) {
                Button("OK") {}
            } message: {
                Text(presentatore.erroreImportazione ?? "")
            }
    }

    private func importa(_ risultato: Result<[URL], any Error>) {
        guard let sezione = presentatore.sezioneImportazione else { return }
        switch risultato {
        case .success(let urls):
            for url in urls {
                let accesso = url.startAccessingSecurityScopedResource()
                defer { if accesso { url.stopAccessingSecurityScopedResource() } }
                do {
                    let dati = try Data(contentsOf: url)
                    let titolo = url.deletingPathExtension().lastPathComponent
                    contesto.insert(Documento(titolo: titolo, nomeFile: url.lastPathComponent, dati: dati, sezione: sezione))
                } catch {
                    presentatore.erroreImportazione = error.localizedDescription
                }
            }
        case .failure(let errore):
            presentatore.erroreImportazione = errore.localizedDescription
        }
    }
}

extension View {
    /// Rende questa pagina il punto da cui vengono presentati i pannelli delle operazioni.
    func ospitaFogli() -> some View {
        modifier(OspiteFogli())
    }
}
