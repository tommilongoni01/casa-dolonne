import SwiftUI
import SwiftData

/// Pagine aperte dalla colonna laterale del manuale.
enum PaginaManuale: Hashable {
    case sezione(Sezione)
    case guida(Guida)
}

/// Elenco dei sistemi dello chalet con guide e documenti.
/// Su iPad: sistemi a sinistra, contenuto a destra.
struct ManualeHomeView: View {
    @Environment(\.modelContext) private var contesto
    @Environment(\.puoModificare) private var puoModificare
    @Query(sort: \Sezione.ordine, animation: .default) private var sezioni: [Sezione]
    @Query(animation: .default) private var guide: [Guida]
    @Query(animation: .default) private var documenti: [Documento]
    @State private var ricerca = ""
    @State private var sezioneDaModificare: Sezione?
    @State private var mostraNuovaSezione = false
    @State private var selezione: PaginaManuale?

    var body: some View {
        NavigationSplitView {
            List(selection: $selezione) {
                if ricerca.isEmpty {
                    elencoSezioni
                } else {
                    risultatiRicerca
                }
            }
            .navigationTitle("Manuale")
            .navigationSplitViewColumnWidth(min: 300, ideal: 340, max: 420)
            .searchable(text: $ricerca, prompt: "Cerca guide e documenti")
            .toolbar {
                if puoModificare {
                    ToolbarItem(placement: .primaryAction) {
                        Button("Nuova sezione", systemImage: "plus") { mostraNuovaSezione = true }
                    }
                    ToolbarItem(placement: .topBarLeading) {
                        EditButton()
                    }
                }
            }
            .sheet(isPresented: $mostraNuovaSezione) {
                SezioneModificaView(sezione: nil, ordine: (sezioni.last?.ordine ?? 0) + 1)
            }
            .sheet(item: $sezioneDaModificare) { sezione in
                SezioneModificaView(sezione: sezione, ordine: sezione.ordine)
            }
        } detail: {
            NavigationStack {
                switch selezione {
                case .sezione(let sezione) where sezioni.contains(sezione):
                    SezioneManualeView(sezione: sezione)
                case .guida(let guida) where guide.contains(guida):
                    GuidaView(guida: guida)
                default:
                    ContentUnavailableView("Seleziona un sistema", systemImage: "book",
                                           description: Text("Guide e documenti dei vari impianti."))
                }
            }
            .id(selezione)
        }
    }

    private var elencoSezioni: some View {
        Section {
            ForEach(sezioni) { sezione in
                NavigationLink(value: PaginaManuale.sezione(sezione)) {
                    RigaSezione(sezione: sezione)
                }
                .contextMenu {
                    if puoModificare {
                        Button("Modifica sezione", systemImage: "pencil") { sezioneDaModificare = sezione }
                    }
                }
            }
            .onMove(perform: sposta)
            .onDelete(perform: elimina)
            .moveDisabled(!puoModificare)
            .deleteDisabled(!puoModificare)
        } footer: {
            if puoModificare {
                Text("Tieni premuto su una sezione per rinominarla o cambiarne l'icona.")
            }
        }
    }

    @ViewBuilder
    private var risultatiRicerca: some View {
        let guideTrovate = guide.filter { guida in
            guida.titolo.localizedStandardContains(ricerca)
                || guida.blocchiOrdinati.contains {
                    String($0.testo.characters).localizedStandardContains(ricerca)
                }
        }
        let documentiTrovati = documenti.filter {
            $0.titolo.localizedStandardContains(ricerca) || $0.nomeFile.localizedStandardContains(ricerca)
        }
        if guideTrovate.isEmpty && documentiTrovati.isEmpty {
            ContentUnavailableView.search(text: ricerca)
        }
        if !guideTrovate.isEmpty {
            Section("Guide") {
                ForEach(guideTrovate) { guida in
                    NavigationLink(value: PaginaManuale.guida(guida)) {
                        Label {
                            VStack(alignment: .leading) {
                                Text(guida.titolo)
                                if let sezione = guida.sezione {
                                    Text(sezione.nome).font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        } icon: {
                            Image(systemName: "text.book.closed")
                        }
                    }
                }
            }
        }
        if !documentiTrovati.isEmpty {
            Section("Documenti") {
                ForEach(documentiTrovati) { RigaDocumento(documento: $0) }
            }
        }
    }

    private func sposta(da origine: IndexSet, a destinazione: Int) {
        var riordinate = sezioni
        riordinate.move(fromOffsets: origine, toOffset: destinazione)
        for (indice, sezione) in riordinate.enumerated() { sezione.ordine = indice }
    }

    private func elimina(_ indici: IndexSet) {
        for indice in indici { contesto.delete(sezioni[indice]) }
    }
}

private struct RigaSezione: View {
    let sezione: Sezione

    var body: some View {
        HStack(spacing: 14) {
            IconaQuadrata(simbolo: sezione.icona, colore: sezione.colore, dimensione: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text(sezione.nome)
                Text(riepilogo)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }

    private var riepilogo: String {
        let guide = sezione.guide?.count ?? 0
        let documenti = sezione.documenti?.count ?? 0
        let testoGuide = guide == 1 ? String(localized: "1 guida") : String(localized: "\(guide) guide")
        let testoDocumenti = documenti == 1 ? String(localized: "1 documento") : String(localized: "\(documenti) documenti")
        return "\(testoGuide) · \(testoDocumenti)"
    }
}

/// Crea o modifica nome e icona di una sezione.
struct SezioneModificaView: View {
    @Environment(\.modelContext) private var contesto
    @Environment(\.dismiss) private var chiudi
    let sezione: Sezione?
    let ordine: Int
    @State private var nome: String
    @State private var icona: String

    init(sezione: Sezione?, ordine: Int) {
        self.sezione = sezione
        self.ordine = ordine
        self.nome = sezione?.nome ?? ""
        self.icona = sezione?.icona ?? "wrench.and.screwdriver.fill"
    }

    var body: some View {
        NavigationStack {
            Form {
                TextField("Nome sezione", text: $nome)
                Section("Icona") {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 44))], spacing: 12) {
                        ForEach(IconeSezione.tutte, id: \.self) { simbolo in
                            Button {
                                icona = simbolo
                            } label: {
                                Image(systemName: simbolo)
                                    .font(.title3)
                                    .frame(width: 44, height: 44)
                                    .foregroundStyle(icona == simbolo ? .white : .primary)
                                    .background(icona == simbolo ? AnyShapeStyle(.tint) : AnyShapeStyle(.fill.tertiary),
                                                in: .rect(cornerRadius: 10))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(simbolo)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
            .navigationTitle(sezione == nil ? "Nuova sezione" : "Modifica sezione")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla", role: .cancel) { chiudi() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fine", role: .confirm) {
                        if let sezione {
                            sezione.nome = nome
                            sezione.icona = icona
                        } else {
                            contesto.insert(Sezione(nome: nome, icona: icona, ordine: ordine))
                        }
                        chiudi()
                    }
                    .disabled(nome.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }
}
