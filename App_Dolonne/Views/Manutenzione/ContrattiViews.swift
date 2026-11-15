import SwiftUI
import SwiftData
import QuickLook

struct ContrattiListaView: View {
    @Environment(\.modelContext) private var contesto
    @Environment(\.puoModificare) private var puoModificare
    @Query(sort: \Contratto.titolo, animation: .default) private var contratti: [Contratto]
    @State private var mostraNuovo = false

    var body: some View {
        List {
            ForEach(contratti) { contratto in
                NavigationLink {
                    ContrattoDettaglioView(contratto: contratto)
                } label: {
                    RigaContratto(contratto: contratto)
                }
            }
            .onDelete { indici in
                for indice in indici { contesto.delete(contratti[indice]) }
            }
            .deleteDisabled(!puoModificare)

            if !contratti.isEmpty {
                LabeledContent("Totale annuo", value: contratti.reduce(0) { $0 + $1.costoAnnuo }.euro)
                    .font(.subheadline.weight(.semibold))
            }
        }
        .overlay {
            if contratti.isEmpty {
                ContentUnavailableView("Nessun contratto", systemImage: "doc.text",
                                       description: Text("Aggiungi i contratti di manutenzione degli impianti."))
            }
        }
        .navigationTitle("Contratti")
        .toolbar {
            if puoModificare {
                ToolbarItem(placement: .primaryAction) {
                    Button("Nuovo contratto", systemImage: "plus") { mostraNuovo = true }
                }
            }
        }
        .sheet(isPresented: $mostraNuovo) {
            ContrattoModificaView(contratto: nil)
        }
    }
}

struct RigaContratto: View {
    let contratto: Contratto

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(contratto.titolo)
                let dettagli = [contratto.fornitore?.nomeCompleto, contratto.sezione?.nome].compactMap { $0 }
                if !dettagli.isEmpty {
                    Text(dettagli.joined(separator: " · "))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            if let scadenza = contratto.dataScadenza {
                BadgeScadenza(data: scadenza, stato: contratto.stato)
            }
        }
    }
}

struct ContrattoDettaglioView: View {
    @Environment(\.puoModificare) private var puoModificare
    let contratto: Contratto
    @State private var mostraModifica = false
    @State private var anteprima: URL?

    var body: some View {
        List {
            Section {
                if !contratto.numero.isEmpty {
                    LabeledContent("Numero", value: contratto.numero)
                }
                LabeledContent("Inizio", value: contratto.dataInizio.formatted(date: .long, time: .omitted))
                if let scadenza = contratto.dataScadenza {
                    LabeledContent("Scadenza") {
                        BadgeScadenza(data: scadenza, stato: contratto.stato)
                    }
                }
                LabeledContent("Rinnovo automatico", value: contratto.rinnovoAutomatico
                               ? String(localized: "Sì") : String(localized: "No"))
                if contratto.costoAnnuo > 0 {
                    LabeledContent("Costo annuo", value: contratto.costoAnnuo.euro)
                }
                if let sezione = contratto.sezione {
                    LabeledContent("Sistema", value: sezione.nome)
                }
            }

            if let fornitore = contratto.fornitore {
                Section("Fornitore") {
                    NavigationLink {
                        ContattoDettaglioView(contatto: fornitore)
                    } label: {
                        HStack(spacing: 12) {
                            AvatarContatto(contatto: fornitore, dimensione: 36)
                            Text(fornitore.nomeCompleto)
                        }
                    }
                }
            }

            if let attivita = contratto.attivita, !attivita.isEmpty {
                Section("Attività coperte") {
                    ForEach(attivita) { voce in
                        NavigationLink {
                            AttivitaDettaglioView(attivita: voce)
                        } label: {
                            RigaAttivita(attivita: voce)
                        }
                    }
                }
            }

            if contratto.allegato != nil {
                Section("Documento") {
                    Button {
                        anteprima = FileTemporanei.url(per: contratto.allegato, nomeFile: contratto.nomeAllegato)
                    } label: {
                        Label(contratto.nomeAllegato.isEmpty ? String(localized: "Apri contratto") : contratto.nomeAllegato,
                              systemImage: "doc.richtext")
                    }
                }
            }

            if !contratto.note.isEmpty {
                Section("Note") { Text(contratto.note) }
            }
        }
        .navigationTitle(contratto.titolo)
        .quickLookPreview($anteprima)
        .toolbar {
            if puoModificare {
                ToolbarItem(placement: .primaryAction) {
                    Button("Modifica") { mostraModifica = true }
                }
            }
        }
        .sheet(isPresented: $mostraModifica) {
            ContrattoModificaView(contratto: contratto)
        }
    }
}

struct ContrattoModificaView: View {
    struct Bozza {
        var titolo = ""
        var numero = ""
        var dataInizio = Date.now
        var haScadenza = true
        var dataScadenza = Calendar.current.date(byAdding: .year, value: 1, to: .now) ?? .now
        var costoAnnuo: Double?
        var rinnovoAutomatico = false
        var giorniPreavviso = 30
        var note = ""
        var fornitore: Contatto?
        var sezione: Sezione?
        var allegato: Data?
        var nomeAllegato = ""
    }

    @Environment(\.modelContext) private var contesto
    @Environment(\.dismiss) private var chiudi
    @Query(sort: \Sezione.ordine, animation: .default) private var sezioni: [Sezione]
    @Query(animation: .default) private var contatti: [Contatto]

    let contratto: Contratto?
    @State private var bozza: Bozza
    @State private var mostraImportazione = false

    init(contratto: Contratto?, sezionePredefinita: Sezione? = nil) {
        self.contratto = contratto
        var bozza = Bozza()
        bozza.sezione = sezionePredefinita
        if let contratto {
            bozza.titolo = contratto.titolo
            bozza.numero = contratto.numero
            bozza.dataInizio = contratto.dataInizio
            bozza.haScadenza = contratto.dataScadenza != nil
            bozza.dataScadenza = contratto.dataScadenza ?? bozza.dataScadenza
            bozza.costoAnnuo = contratto.costoAnnuo == 0 ? nil : contratto.costoAnnuo
            bozza.rinnovoAutomatico = contratto.rinnovoAutomatico
            bozza.giorniPreavviso = contratto.giorniPreavviso
            bozza.note = contratto.note
            bozza.fornitore = contratto.fornitore
            bozza.sezione = contratto.sezione
            bozza.allegato = contratto.allegato
            bozza.nomeAllegato = contratto.nomeAllegato
        }
        self.bozza = bozza
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Titolo (es. Assistenza caldaia)", text: $bozza.titolo)
                    TextField("Numero contratto", text: $bozza.numero)
                    Picker("Fornitore", selection: $bozza.fornitore) {
                        Text("Nessuno").tag(Contatto?.none)
                        ForEach(contattiOrdinati) { Text($0.nomeCompleto).tag(Optional($0)) }
                    }
                    Picker("Sistema", selection: $bozza.sezione) {
                        Text("Nessuno").tag(Sezione?.none)
                        ForEach(sezioni) { Text($0.nome).tag(Optional($0)) }
                    }
                }

                Section("Durata") {
                    DatePicker("Inizio", selection: $bozza.dataInizio, displayedComponents: .date)
                    Toggle("Ha una scadenza", isOn: $bozza.haScadenza)
                    if bozza.haScadenza {
                        DatePicker("Scadenza", selection: $bozza.dataScadenza, displayedComponents: .date)
                        Stepper("Avvisa \(bozza.giorniPreavviso) giorni prima",
                                value: $bozza.giorniPreavviso, in: 0...180, step: 5)
                    }
                    Toggle("Rinnovo automatico", isOn: $bozza.rinnovoAutomatico)
                }

                Section("Costi") {
                    CampoNumero(titolo: "Costo annuo", valore: $bozza.costoAnnuo, unita: "€")
                }

                Section("Documento") {
                    if bozza.allegato != nil {
                        Label(bozza.nomeAllegato, systemImage: "doc.richtext")
                        Button("Rimuovi documento", role: .destructive) {
                            bozza.allegato = nil
                            bozza.nomeAllegato = ""
                        }
                    } else {
                        Button("Allega PDF o foto", systemImage: "paperclip") { mostraImportazione = true }
                    }
                }

                Section("Note") {
                    TextField("Note", text: $bozza.note, axis: .vertical)
                        .lineLimit(3...)
                }
            }
            .navigationTitle(contratto == nil ? "Nuovo contratto" : "Modifica contratto")
            .navigationBarTitleDisplayMode(.inline)
            .fileImporter(isPresented: $mostraImportazione, allowedContentTypes: [.pdf, .image]) { risultato in
                guard case .success(let url) = risultato else { return }
                let accesso = url.startAccessingSecurityScopedResource()
                defer { if accesso { url.stopAccessingSecurityScopedResource() } }
                if let dati = try? Data(contentsOf: url) {
                    bozza.allegato = dati
                    bozza.nomeAllegato = url.lastPathComponent
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla", role: .cancel) { chiudi() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fine", role: .confirm) { salva() }
                        .disabled(bozza.titolo.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    private var contattiOrdinati: [Contatto] {
        contatti.sorted { $0.nomeCompleto.localizedStandardCompare($1.nomeCompleto) == .orderedAscending }
    }

    private func salva() {
        let destinazione = contratto ?? Contratto()
        if contratto == nil { contesto.insert(destinazione) }
        destinazione.titolo = bozza.titolo
        destinazione.numero = bozza.numero
        destinazione.dataInizio = bozza.dataInizio
        destinazione.dataScadenza = bozza.haScadenza ? bozza.dataScadenza : nil
        destinazione.costoAnnuo = bozza.costoAnnuo ?? 0
        destinazione.rinnovoAutomatico = bozza.rinnovoAutomatico
        destinazione.giorniPreavviso = bozza.giorniPreavviso
        destinazione.note = bozza.note
        destinazione.fornitore = bozza.fornitore
        destinazione.sezione = bozza.sezione
        destinazione.allegato = bozza.allegato
        destinazione.nomeAllegato = bozza.nomeAllegato
        Task { await Notifiche.aggiorna(contesto: contesto) }
        chiudi()
    }
}
