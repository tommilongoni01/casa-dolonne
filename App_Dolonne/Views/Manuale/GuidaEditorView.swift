import SwiftUI
import SwiftData
import PhotosUI
import UIKit

/// Editor di una guida: blocchi di testo formattato e foto, riordinabili.
/// Le modifiche vengono salvate man mano.
struct GuidaEditorView: View {
    @Environment(\.modelContext) private var contesto
    @Environment(\.dismiss) private var chiudi
    @Bindable var guida: Guida
    @State private var fotoSelezionate: [PhotosPickerItem] = []
    @FocusState private var titoloAttivo: Bool

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    TextField("Titolo della guida", text: $guida.titolo, axis: .vertical)
                        .font(.largeTitle.bold())
                        .focused($titoloAttivo)

                    ForEach(guida.blocchiOrdinati) { blocco in
                        BloccoEditor(blocco: blocco,
                                     primo: blocco.persistentModelID == guida.blocchiOrdinati.first?.persistentModelID,
                                     ultimo: blocco.persistentModelID == guida.blocchiOrdinati.last?.persistentModelID,
                                     sposta: { sposta(blocco, di: $0) },
                                     elimina: { elimina(blocco) })
                    }

                    HStack {
                        Button("Aggiungi testo", systemImage: "text.alignleft") { aggiungiTesto() }
                        PhotosPicker(selection: $fotoSelezionate, matching: .images) {
                            Label("Aggiungi foto", systemImage: "photo.badge.plus")
                        }
                    }
                    .buttonStyle(.bordered)
                    .padding(.top, 8)
                }
                .padding()
                .frame(maxWidth: 760)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Modifica guida")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fine", role: .confirm) { termina() }
                }
            }
            .onChange(of: fotoSelezionate) { _, elementi in
                guard !elementi.isEmpty else { return }
                Task { await aggiungiFoto(elementi) }
            }
            .onAppear {
                if guida.titolo.isEmpty { titoloAttivo = true }
                if (guida.blocchi ?? []).isEmpty { aggiungiTesto() }
            }
        }
    }

    private var prossimoOrdine: Int { (guida.blocchiOrdinati.last?.ordine ?? -1) + 1 }

    private func aggiungiTesto() {
        let blocco = BloccoGuida(tipo: .testo, ordine: prossimoOrdine)
        blocco.guida = guida
        contesto.insert(blocco)
    }

    private func aggiungiFoto(_ elementi: [PhotosPickerItem]) async {
        for elemento in elementi {
            guard let dati = try? await elemento.loadTransferable(type: Data.self) else { continue }
            let blocco = BloccoGuida(tipo: .immagine, ordine: prossimoOrdine)
            blocco.immagine = Self.comprimi(dati)
            blocco.guida = guida
            contesto.insert(blocco)
        }
        fotoSelezionate = []
    }

    /// Riduce le foto a un lato massimo di 2000 px in JPEG per contenere lo spazio occupato.
    private static func comprimi(_ dati: Data) -> Data {
        guard let immagine = UIImage(data: dati) else { return dati }
        let latoMassimo: CGFloat = 2000
        let fattore = min(1, latoMassimo / max(immagine.size.width, immagine.size.height))
        let dimensione = CGSize(width: immagine.size.width * fattore, height: immagine.size.height * fattore)
        let ridotta = UIGraphicsImageRenderer(size: dimensione).image { _ in
            immagine.draw(in: CGRect(origin: .zero, size: dimensione))
        }
        return ridotta.jpegData(compressionQuality: 0.8) ?? dati
    }

    private func sposta(_ blocco: BloccoGuida, di passo: Int) {
        var elenco = guida.blocchiOrdinati
        guard let indice = elenco.firstIndex(where: { $0.persistentModelID == blocco.persistentModelID }) else { return }
        let nuovo = indice + passo
        guard elenco.indices.contains(nuovo) else { return }
        elenco.swapAt(indice, nuovo)
        for (posizione, elemento) in elenco.enumerated() { elemento.ordine = posizione }
    }

    private func elimina(_ blocco: BloccoGuida) {
        contesto.delete(blocco)
    }

    private func termina() {
        // Rimuove i blocchi di testo lasciati vuoti.
        for blocco in guida.blocchiOrdinati where blocco.tipo == .testo && blocco.testo.characters.isEmpty {
            contesto.delete(blocco)
        }
        if guida.titolo.trimmingCharacters(in: .whitespaces).isEmpty && (guida.blocchi ?? []).allSatisfy({
            $0.tipo == .testo && $0.testo.characters.isEmpty
        }) {
            contesto.delete(guida)
        } else {
            guida.dataModifica = .now
        }
        try? contesto.save()
        chiudi()
    }
}

/// Un singolo blocco nell'editor, con il menu per spostarlo o eliminarlo.
private struct BloccoEditor: View {
    let blocco: BloccoGuida
    let primo: Bool
    let ultimo: Bool
    let sposta: (Int) -> Void
    let elimina: () -> Void

    var body: some View {
        VStack(alignment: .trailing, spacing: 4) {
            switch blocco.tipo {
            case .testo:
                EditorTestoFormattato(blocco: blocco)
            case .immagine:
                EditorImmagine(blocco: blocco)
            }
            Menu {
                Button("Sposta su", systemImage: "arrow.up") { sposta(-1) }
                    .disabled(primo)
                Button("Sposta giù", systemImage: "arrow.down") { sposta(1) }
                    .disabled(ultimo)
                Button("Elimina blocco", systemImage: "trash", role: .destructive, action: elimina)
            } label: {
                Label("Opzioni blocco", systemImage: "ellipsis.circle")
                    .labelStyle(.iconOnly)
                    .font(.title3)
            }
        }
        .padding(10)
        .background(.fill.quinary, in: .rect(cornerRadius: 12))
    }
}

/// TextEditor con testo formattato; i controlli di formattazione di sistema
/// compaiono nella barra sopra la tastiera e nel menu contestuale.
private struct EditorTestoFormattato: View {
    let blocco: BloccoGuida
    @State private var testo: AttributedString
    @State private var selezione = AttributedTextSelection()

    init(blocco: BloccoGuida) {
        self.blocco = blocco
        self.testo = blocco.testo
    }

    var body: some View {
        TextEditor(text: $testo, selection: $selezione)
            .scrollDisabled(true)
            .frame(minHeight: 100)
            .scrollContentBackground(.hidden)
            .onChange(of: testo) { _, nuovo in
                blocco.testo = nuovo
            }
    }
}

private struct EditorImmagine: View {
    @Bindable var blocco: BloccoGuida

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ImmagineDaDati(dati: blocco.immagine)
                .clipShape(.rect(cornerRadius: 10))
            TextField("Didascalia (facoltativa)", text: $blocco.didascalia)
                .font(.footnote)
        }
    }
}
