import SwiftUI
import SwiftData

/// Lettura di una guida.
struct GuidaView: View {
    @Environment(\.puoModificare) private var puoModificare
    let guida: Guida
    @State private var inModifica = false
    @State private var immagineIngrandita: BloccoGuida?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(guida.titolo.isEmpty ? String(localized: "Senza titolo") : guida.titolo)
                        .font(.largeTitle.bold())
                    Text("Aggiornata il \(guida.dataModifica.formatted(date: .long, time: .omitted))")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                if guida.blocchiOrdinati.isEmpty {
                    ContentUnavailableView("Guida vuota", systemImage: "text.page",
                                           description: Text("Tocca Modifica per scrivere il contenuto."))
                }

                ForEach(guida.blocchiOrdinati) { blocco in
                    switch blocco.tipo {
                    case .testo:
                        Text(blocco.testo)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .textSelection(.enabled)
                    case .immagine:
                        VStack(alignment: .leading, spacing: 6) {
                            ImmagineDaDati(dati: blocco.immagine)
                                .clipShape(.rect(cornerRadius: 12))
                                .onTapGesture { immagineIngrandita = blocco }
                            if !blocco.didascalia.isEmpty {
                                Text(blocco.didascalia)
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            .padding()
            .frame(maxWidth: 760)
            .frame(maxWidth: .infinity)
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if puoModificare {
                ToolbarItem(placement: .primaryAction) {
                    Button("Modifica") { inModifica = true }
                }
            }
        }
        .fullScreenCover(isPresented: $inModifica) {
            GuidaEditorView(guida: guida)
        }
        .fullScreenCover(item: $immagineIngrandita) { blocco in
            ImmagineSchermoIntero(blocco: blocco)
        }
    }
}

/// Foto a schermo intero con zoom.
private struct ImmagineSchermoIntero: View {
    @Environment(\.dismiss) private var chiudi
    let blocco: BloccoGuida
    @State private var scala: CGFloat = 1

    var body: some View {
        NavigationStack {
            ImmagineDaDati(dati: blocco.immagine)
                .scaleEffect(scala)
                .gesture(MagnifyGesture().onChanged { scala = max(1, $0.magnification) })
                .onTapGesture(count: 2) { withAnimation { scala = scala > 1 ? 1 : 2.5 } }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(.black)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Chiudi", role: .close) { chiudi() }
                    }
                }
                .navigationTitle(blocco.didascalia)
                .navigationBarTitleDisplayMode(.inline)
        }
    }
}

#Preview("Guida importata") {
    let container = Modelli.anteprima()
    UserDefaults.standard.removeObject(forKey: "versioneContenutiImportati")
    DatiIniziali.creaSeNecessario(in: container.mainContext)
    ImportazioneContenuti.importaSeNecessario(in: container.mainContext)
    UserDefaults.standard.removeObject(forKey: "versioneContenutiImportati")
    let guide = (try? container.mainContext.fetch(FetchDescriptor<Guida>(sortBy: [SortDescriptor(\.titolo)]))) ?? []
    return NavigationStack {
        if guide.count > 1 { GuidaView(guida: guide[1]) }
    }
    .modelContainer(container)
}
