import SwiftUI
import SwiftData
import QuickLook
import UniformTypeIdentifiers

/// Contenuto di una sezione: guide scritte da noi, documenti del fornitore e contatti utili.
struct SezioneManualeView: View {
    @Environment(\.modelContext) private var contesto
    @Environment(\.puoModificare) private var puoModificare
    let sezione: Sezione
    @State private var guidaNuova: Guida?
    @State private var mostraImportazione = false
    @State private var erroreImportazione: String?

    var body: some View {
        List {
            Section("Guide") {
                if sezione.guideOrdinate.isEmpty {
                    Text("Nessuna guida")
                        .foregroundStyle(.secondary)
                }
                ForEach(sezione.guideOrdinate) { guida in
                    NavigationLink {
                        GuidaView(guida: guida)
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(guida.titolo.isEmpty ? String(localized: "Senza titolo") : guida.titolo)
                            Text("Aggiornata il \(guida.dataModifica.formatted(date: .abbreviated, time: .omitted))")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .onDelete { indici in
                    let elenco = sezione.guideOrdinate
                    for indice in indici { contesto.delete(elenco[indice]) }
                }
                .deleteDisabled(!puoModificare)
            }

            Section("Documenti del fornitore") {
                if sezione.documentiOrdinati.isEmpty {
                    Text("Nessun documento")
                        .foregroundStyle(.secondary)
                }
                ForEach(sezione.documentiOrdinati) { RigaDocumento(documento: $0) }
                    .onDelete { indici in
                        let elenco = sezione.documentiOrdinati
                        for indice in indici { contesto.delete(elenco[indice]) }
                    }
                    .deleteDisabled(!puoModificare)
            }

            if !sezione.contattiOrdinati.isEmpty {
                Section("Contatti") {
                    ForEach(sezione.contattiOrdinati) { RigaContatto(contatto: $0) }
                }
            }
        }
        .navigationTitle(sezione.nome)
        .navigationDestination(for: Contatto.self) { ContattoDettaglioView(contatto: $0) }
        .toolbar {
            if puoModificare {
                ToolbarItem(placement: .primaryAction) {
                    Menu("Aggiungi", systemImage: "plus") {
                        Button("Nuova guida", systemImage: "square.and.pencil") { creaGuida() }
                        Button("Importa documento", systemImage: "doc.badge.plus") { mostraImportazione = true }
                    }
                }
            }
        }
        .fullScreenCover(item: $guidaNuova) { guida in
            GuidaEditorView(guida: guida)
        }
        .fileImporter(
            isPresented: $mostraImportazione,
            allowedContentTypes: [.pdf, .image, .data],
            allowsMultipleSelection: true
        ) { risultato in
            importa(risultato)
        }
        .alert("Importazione non riuscita", isPresented: Binding {
            erroreImportazione != nil
        } set: { if !$0 { erroreImportazione = nil } }) {
            Button("OK") { erroreImportazione = nil }
        } message: {
            Text(erroreImportazione ?? "")
        }
    }

    private func creaGuida() {
        let guida = Guida(titolo: "", sezione: sezione)
        contesto.insert(guida)
        guidaNuova = guida
    }

    private func importa(_ risultato: Result<[URL], any Error>) {
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
                    erroreImportazione = error.localizedDescription
                }
            }
        case .failure(let errore):
            erroreImportazione = errore.localizedDescription
        }
    }
}

/// Riga di un documento: tocca per aprirlo con Quick Look.
struct RigaDocumento: View {
    @Environment(\.puoModificare) private var puoModificare
    @Bindable var documento: Documento
    @State private var anteprima: URL?
    @State private var mostraRinomina = false

    var body: some View {
        Button {
            anteprima = FileTemporanei.url(per: documento.dati, nomeFile: documento.nomeFile)
        } label: {
            Label {
                VStack(alignment: .leading, spacing: 2) {
                    Text(documento.titolo)
                        .foregroundStyle(.primary)
                    Text(dimensione)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } icon: {
                Image(systemName: documento.icona)
            }
        }
        .quickLookPreview($anteprima)
        .contextMenu {
            if puoModificare {
                Button("Rinomina", systemImage: "pencil") { mostraRinomina = true }
            }
        }
        .alert("Rinomina documento", isPresented: $mostraRinomina) {
            TextField("Titolo", text: $documento.titolo)
            Button("OK") {}
        }
    }

    private var dimensione: String {
        let byte = Int64(documento.dati?.count ?? 0)
        return "\(documento.nomeFile) · \(byte.formatted(.byteCount(style: .file)))"
    }
}
