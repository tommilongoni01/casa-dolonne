import SwiftUI
import SwiftData

/// Rubrica dei contatti, raggruppabile per sistema o in ordine alfabetico.
struct ContattiListaView: View {
    enum Raggruppamento: String, CaseIterable, Identifiable {
        case sistema
        case alfabetico
        var id: String { rawValue }
    }

    @Environment(\.modelContext) private var contesto
    @Environment(\.puoModificare) private var puoModificare
    @Query(animation: .default) private var contatti: [Contatto]
    @Query(sort: \Sezione.ordine, animation: .default) private var sezioni: [Sezione]
    @AppStorage("raggruppamentoContatti") private var raggruppamento: Raggruppamento = .sistema
    @State private var ricerca = ""
    @State private var mostraNuovo = false
    @State private var mostraRubrica = false
    @State private var esitoImportazione: Int?

    @State private var selezione: Contatto?

    var body: some View {
        NavigationSplitView {
            List(selection: $selezione) {
                if !preferiti.isEmpty && ricerca.isEmpty {
                    Section("Preferiti") {
                        ForEach(preferiti) { RigaContatto(contatto: $0) }
                    }
                }
                switch raggruppamento {
                case .sistema: sezioniPerSistema
                case .alfabetico: sezioniAlfabetiche
                }
            }
            .navigationTitle("Contatti")
            .navigationSplitViewColumnWidth(min: 300, ideal: 340, max: 420)
            .animation(.default, value: contatti.count)
            .searchable(text: $ricerca, prompt: "Cerca nome, azienda, ruolo")
            .overlay {
                if contatti.isEmpty {
                    ContentUnavailableView(
                        "Nessun contatto",
                        systemImage: "person.crop.circle.badge.plus",
                        description: Text("Aggiungi tecnici e fornitori dei vari impianti.")
                    )
                } else if filtrati.isEmpty {
                    ContentUnavailableView.search(text: ricerca)
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Picker("Raggruppa", selection: $raggruppamento) {
                        Label("Per sistema", systemImage: "square.grid.2x2").tag(Raggruppamento.sistema)
                        Label("A–Z", systemImage: "textformat.abc").tag(Raggruppamento.alfabetico)
                    }
                    .pickerStyle(.menu)
                }
                if puoModificare {
                    ToolbarItem(placement: .primaryAction) {
                        Menu("Aggiungi", systemImage: "plus") {
                            Button("Nuovo contatto", systemImage: "person.badge.plus") { mostraNuovo = true }
                            Button("Importa dalla Rubrica", systemImage: "person.crop.rectangle.stack") {
                                mostraRubrica = true
                            }
                        }
                    }
                }
            }
            .sheet(isPresented: $mostraNuovo) {
                ContattoModificaView(contatto: nil)
            }
            .background {
                SelettoreRubrica(mostra: $mostraRubrica) { scelti in
                    esitoImportazione = ImportazioneRubrica.importa(scelti, esistenti: contatti, in: contesto)
                }
                .frame(width: 0, height: 0)
            }
            .alert("Importazione dalla Rubrica", isPresented: Binding {
                esitoImportazione != nil
            } set: { if !$0 { esitoImportazione = nil } }) {
                Button("OK") {}
            } message: {
                if let esitoImportazione {
                    Text(esitoImportazione == 0
                         ? "Nessun contatto nuovo: quelli scelti erano già presenti."
                         : "Contatti aggiunti: \(esitoImportazione). Aprili per collegarli ai sistemi.")
                }
            }
        } detail: {
            NavigationStack {
                if let selezione, contatti.contains(selezione) {
                    ContattoDettaglioView(contatto: selezione)
                } else {
                    ContentUnavailableView("Nessun contatto selezionato", systemImage: "person.crop.circle")
                }
            }
            .id(selezione)
        }
    }

    @ViewBuilder
    private var sezioniPerSistema: some View {
        ForEach(sezioni) { sezione in
            let elenco = filtrati.filter { contatto in
                contatto.sezioni?.contains { $0.persistentModelID == sezione.persistentModelID } ?? false
            }
            if !elenco.isEmpty {
                Section {
                    ForEach(elenco) { RigaContatto(contatto: $0) }
                } header: {
                    Label(sezione.nome, systemImage: sezione.icona)
                        .foregroundStyle(sezione.colore)
                }
            }
        }
        let senzaSistema = filtrati.filter { ($0.sezioni ?? []).isEmpty }
        if !senzaSistema.isEmpty {
            Section("Altri contatti") {
                ForEach(senzaSistema) { RigaContatto(contatto: $0) }
                    .onDelete { elimina(senzaSistema, $0) }
                    .deleteDisabled(!puoModificare)
            }
        }
    }

    @ViewBuilder
    private var sezioniAlfabetiche: some View {
        let gruppi = Dictionary(grouping: filtrati, by: \.letteraIndice)
        ForEach(gruppi.keys.sorted(), id: \.self) { lettera in
            let elenco = gruppi[lettera] ?? []
            Section(lettera) {
                ForEach(elenco) { RigaContatto(contatto: $0) }
                    .onDelete { elimina(elenco, $0) }
                    .deleteDisabled(!puoModificare)
            }
        }
    }

    private var filtrati: [Contatto] {
        let ordinati = contatti.sorted {
            $0.nomeCompleto.localizedStandardCompare($1.nomeCompleto) == .orderedAscending
        }
        guard !ricerca.isEmpty else { return ordinati }
        return ordinati.filter { contatto in
            [contatto.nomeCompleto, contatto.azienda, contatto.ruolo, contatto.note]
                .contains { $0.localizedStandardContains(ricerca) }
        }
    }

    private var preferiti: [Contatto] { filtrati.filter(\.preferito) }

    private func elimina(_ elenco: [Contatto], _ indici: IndexSet) {
        for indice in indici { contesto.delete(elenco[indice]) }
    }
}

/// Riga della rubrica con avatar e sottotitolo.
struct RigaContatto: View {
    let contatto: Contatto

    var body: some View {
        NavigationLink(value: contatto) {
            HStack(spacing: 12) {
                AvatarContatto(contatto: contatto, dimensione: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(contatto.nomeCompleto)
                        .font(.body.weight(.medium))
                    if !contatto.sottotitolo.isEmpty {
                        Text(contatto.sottotitolo)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }
}

struct AvatarContatto: View {
    let contatto: Contatto
    let dimensione: CGFloat

    var body: some View {
        Text(contatto.iniziali)
            .font(.system(size: dimensione * 0.4, weight: .semibold, design: .rounded))
            .foregroundStyle(.white)
            .frame(width: dimensione, height: dimensione)
            .background(.gray.gradient, in: .circle)
            .accessibilityHidden(true)
    }
}
