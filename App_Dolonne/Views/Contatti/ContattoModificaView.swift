import SwiftUI
import SwiftData

/// Crea o modifica un contatto. Le modifiche si applicano solo premendo "Fine".
struct ContattoModificaView: View {
    /// Copia di lavoro dei campi, così "Annulla" non altera il contatto.
    struct Bozza {
        var nome = ""
        var cognome = ""
        var azienda = ""
        var ruolo = ""
        var cellulare = ""
        var telefono = ""
        var email = ""
        var sitoWeb = ""
        var indirizzo = ""
        var note = ""
        var sezioni: Set<PersistentIdentifier> = []
    }

    @Environment(\.modelContext) private var contesto
    @Environment(\.dismiss) private var chiudi
    @Query(sort: \Sezione.ordine, animation: .default) private var tutteLeSezioni: [Sezione]

    let contatto: Contatto?
    @State private var bozza: Bozza

    init(contatto: Contatto?) {
        self.contatto = contatto
        var bozza = Bozza()
        if let contatto {
            bozza.nome = contatto.nome
            bozza.cognome = contatto.cognome
            bozza.azienda = contatto.azienda
            bozza.ruolo = contatto.ruolo
            bozza.cellulare = contatto.cellulare
            bozza.telefono = contatto.telefono
            bozza.email = contatto.email
            bozza.sitoWeb = contatto.sitoWeb
            bozza.indirizzo = contatto.indirizzo
            bozza.note = contatto.note
            bozza.sezioni = Set((contatto.sezioni ?? []).map(\.persistentModelID))
        }
        self.bozza = bozza
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Nome", text: $bozza.nome)
                        .textContentType(.givenName)
                    TextField("Cognome", text: $bozza.cognome)
                        .textContentType(.familyName)
                    TextField("Azienda", text: $bozza.azienda)
                        .textContentType(.organizationName)
                    TextField("Ruolo (es. tecnico caldaia)", text: $bozza.ruolo)
                }

                Section("Recapiti") {
                    TextField("Cellulare", text: $bozza.cellulare)
                        .keyboardType(.phonePad)
                        .textContentType(.telephoneNumber)
                    TextField("Telefono", text: $bozza.telefono)
                        .keyboardType(.phonePad)
                    TextField("Email", text: $bozza.email)
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .textInputAutocapitalization(.never)
                    TextField("Sito web", text: $bozza.sitoWeb)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                    TextField("Indirizzo", text: $bozza.indirizzo, axis: .vertical)
                        .textContentType(.fullStreetAddress)
                }

                Section("Sistemi di riferimento") {
                    ForEach(tutteLeSezioni) { sezione in
                        Toggle(isOn: selezione(sezione)) {
                            Label {
                                Text(sezione.nome)
                            } icon: {
                                IconaQuadrata(simbolo: sezione.icona, colore: sezione.colore, dimensione: 28)
                            }
                        }
                    }
                }

                Section("Note") {
                    TextField("Note", text: $bozza.note, axis: .vertical)
                        .lineLimit(3...)
                }
            }
            .navigationTitle(contatto == nil ? "Nuovo contatto" : "Modifica contatto")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla", role: .cancel) { chiudi() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fine", role: .confirm) { salva() }
                        .disabled(nomeVuoto)
                }
            }
        }
    }

    private var nomeVuoto: Bool {
        [bozza.nome, bozza.cognome, bozza.azienda].allSatisfy { $0.trimmingCharacters(in: .whitespaces).isEmpty }
    }

    private func selezione(_ sezione: Sezione) -> Binding<Bool> {
        Binding {
            bozza.sezioni.contains(sezione.persistentModelID)
        } set: { attivo in
            if attivo {
                bozza.sezioni.insert(sezione.persistentModelID)
            } else {
                bozza.sezioni.remove(sezione.persistentModelID)
            }
        }
    }

    private func salva() {
        let destinazione = contatto ?? Contatto()
        if contatto == nil { contesto.insert(destinazione) }
        destinazione.nome = bozza.nome
        destinazione.cognome = bozza.cognome
        destinazione.azienda = bozza.azienda
        destinazione.ruolo = bozza.ruolo
        destinazione.cellulare = bozza.cellulare
        destinazione.telefono = bozza.telefono
        destinazione.email = bozza.email
        destinazione.sitoWeb = bozza.sitoWeb
        destinazione.indirizzo = bozza.indirizzo
        destinazione.note = bozza.note
        destinazione.sezioni = tutteLeSezioni.filter { bozza.sezioni.contains($0.persistentModelID) }
        chiudi()
    }
}
