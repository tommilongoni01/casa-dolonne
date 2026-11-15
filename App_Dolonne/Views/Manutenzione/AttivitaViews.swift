import SwiftUI
import SwiftData

/// Elenco delle attività ricorrenti raggruppate per sistema.
struct AttivitaListaView: View {
    @Environment(\.modelContext) private var contesto
    @Environment(\.puoModificare) private var puoModificare
    @Query(animation: .default) private var attivita: [AttivitaManutenzione]
    @State private var mostraNuova = false

    var body: some View {
        List {
            let gruppi = Dictionary(grouping: attivita) { $0.sezione?.nome ?? String(localized: "Generale") }
            ForEach(gruppi.keys.sorted(), id: \.self) { gruppo in
                let elenco = (gruppi[gruppo] ?? []).sorted { $0.prossimaScadenza < $1.prossimaScadenza }
                Section(gruppo) {
                    ForEach(elenco) { voce in
                        NavigationLink {
                            AttivitaDettaglioView(attivita: voce)
                        } label: {
                            RigaAttivita(attivita: voce)
                        }
                    }
                    .onDelete { indici in
                        for indice in indici { contesto.delete(elenco[indice]) }
                    }
                    .deleteDisabled(!puoModificare)
                }
            }
        }
        .overlay {
            if attivita.isEmpty {
                ContentUnavailableView(
                    "Nessuna attività",
                    systemImage: "calendar.badge.plus",
                    description: Text("Aggiungi manutenzioni periodiche, ispezioni e verifiche per ricevere promemoria.")
                )
            }
        }
        .navigationTitle("Manutenzioni")
        .toolbar {
            if puoModificare {
                ToolbarItem(placement: .primaryAction) {
                    Button("Nuova attività", systemImage: "plus") { mostraNuova = true }
                }
            }
        }
        .sheet(isPresented: $mostraNuova) {
            AttivitaModificaView(attivita: nil)
        }
    }
}

struct RigaAttivita: View {
    let attivita: AttivitaManutenzione

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(attivita.titolo)
                Text(attivita.descrizioneIntervallo)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if attivita.attiva {
                BadgeScadenza(data: attivita.prossimaScadenza, stato: attivita.stato)
            } else {
                Text("Sospesa").font(.caption).foregroundStyle(.secondary)
            }
        }
    }
}

/// Dettaglio di un'attività con lo storico degli interventi.
struct AttivitaDettaglioView: View {
    @Environment(\.modelContext) private var contesto
    @Environment(\.puoModificare) private var puoModificare
    let attivita: AttivitaManutenzione
    @State private var mostraModifica = false
    @State private var mostraNuovoIntervento = false
    @State private var interventoDaModificare: Intervento?

    var body: some View {
        List {
            Section {
                LabeledContent("Prossima scadenza") {
                    BadgeScadenza(data: attivita.prossimaScadenza, stato: attivita.stato)
                }
                LabeledContent("Tipo") { Text(attivita.tipo.nome) }
                LabeledContent("Frequenza", value: attivita.descrizioneIntervallo)
                if let ultimo = attivita.ultimoIntervento {
                    LabeledContent("Ultima esecuzione", value: ultimo.data.formatted(date: .long, time: .omitted))
                }
                if let sezione = attivita.sezione {
                    LabeledContent("Sistema", value: sezione.nome)
                }
                if let contratto = attivita.contratto {
                    NavigationLink {
                        ContrattoDettaglioView(contratto: contratto)
                    } label: {
                        LabeledContent("Contratto", value: contratto.titolo)
                    }
                }
                if !attivita.descrizione.isEmpty {
                    Text(attivita.descrizione)
                }
            }

            if puoModificare {
                Section {
                    Button("Registra intervento eseguito", systemImage: "checkmark.circle.fill") {
                        mostraNuovoIntervento = true
                    }
                }
            }

            Section("Storico interventi") {
                if attivita.interventiOrdinati.isEmpty {
                    Text("Nessun intervento registrato").foregroundStyle(.secondary)
                }
                ForEach(attivita.interventiOrdinati) { intervento in
                    Button {
                        if puoModificare { interventoDaModificare = intervento }
                    } label: {
                        RigaIntervento(intervento: intervento)
                    }
                    .tint(.primary)
                }
                .onDelete { indici in
                    let elenco = attivita.interventiOrdinati
                    for indice in indici { contesto.delete(elenco[indice]) }
                }
                .deleteDisabled(!puoModificare)

                let spesa = attivita.interventiOrdinati.reduce(0) { $0 + $1.costo }
                if spesa > 0 {
                    LabeledContent("Spesa totale", value: spesa.euro)
                        .font(.subheadline.weight(.semibold))
                }
            }
        }
        .navigationTitle(attivita.titolo)
        .toolbar {
            if puoModificare {
                ToolbarItem(placement: .primaryAction) {
                    Button("Modifica") { mostraModifica = true }
                }
            }
        }
        .sheet(isPresented: $mostraModifica) {
            AttivitaModificaView(attivita: attivita)
        }
        .sheet(isPresented: $mostraNuovoIntervento) {
            InterventoModificaView(intervento: nil, attivita: attivita)
        }
        .sheet(item: $interventoDaModificare) { intervento in
            InterventoModificaView(intervento: intervento, attivita: attivita)
        }
    }
}

private struct RigaIntervento: View {
    let intervento: Intervento

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(intervento.data, format: .dateTime.day().month(.wide).year())
                    .font(.body.weight(.medium))
                Spacer()
                if intervento.costo > 0 {
                    Text(intervento.costo.euro).foregroundStyle(.secondary)
                }
            }
            let dettagli = [intervento.descrizione, intervento.eseguitoDa].filter { !$0.isEmpty }
            if !dettagli.isEmpty {
                Text(dettagli.joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

/// Crea o modifica un'attività ricorrente.
struct AttivitaModificaView: View {
    struct Bozza {
        var titolo = ""
        var descrizione = ""
        var tipo: TipoAttivita = .manutenzione
        var intervalloValore = 12
        var intervalloUnita: UnitaIntervallo = .mesi
        var primaScadenza = Date.now
        var giorniPreavviso = 7
        var attiva = true
        var sezione: Sezione?
        var contratto: Contratto?
    }

    @Environment(\.modelContext) private var contesto
    @Environment(\.dismiss) private var chiudi
    @Query(sort: \Sezione.ordine, animation: .default) private var sezioni: [Sezione]
    @Query(sort: \Contratto.titolo, animation: .default) private var contratti: [Contratto]

    let attivita: AttivitaManutenzione?
    @State private var bozza: Bozza

    init(attivita: AttivitaManutenzione?, sezionePredefinita: Sezione? = nil) {
        self.attivita = attivita
        var bozza = Bozza()
        bozza.sezione = sezionePredefinita
        if let attivita {
            bozza.titolo = attivita.titolo
            bozza.descrizione = attivita.descrizione
            bozza.tipo = attivita.tipo
            bozza.intervalloValore = attivita.intervalloValore
            bozza.intervalloUnita = attivita.intervalloUnita
            bozza.primaScadenza = attivita.primaScadenza
            bozza.giorniPreavviso = attivita.giorniPreavviso
            bozza.attiva = attivita.attiva
            bozza.sezione = attivita.sezione
            bozza.contratto = attivita.contratto
        }
        self.bozza = bozza
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Titolo (es. pulizia caldaia)", text: $bozza.titolo)
                    Picker("Tipo", selection: $bozza.tipo) {
                        ForEach(TipoAttivita.allCases) { Text($0.nome).tag($0) }
                    }
                    Picker("Sistema", selection: $bozza.sezione) {
                        Text("Nessuno").tag(Sezione?.none)
                        ForEach(sezioni) { Text($0.nome).tag(Optional($0)) }
                    }
                    Picker("Contratto", selection: $bozza.contratto) {
                        Text("Nessuno").tag(Contratto?.none)
                        ForEach(contratti) { Text($0.titolo).tag(Optional($0)) }
                    }
                }

                Section {
                    Stepper("Ogni \(bozza.intervalloValore)", value: $bozza.intervalloValore, in: 1...365)
                    Picker("Unità", selection: $bozza.intervalloUnita) {
                        ForEach(UnitaIntervallo.allCases) { Text($0.nome).tag($0) }
                    }
                    if (attivita?.interventi ?? []).isEmpty {
                        DatePicker("Prima scadenza", selection: $bozza.primaScadenza, displayedComponents: .date)
                    }
                } header: {
                    Text("Frequenza")
                } footer: {
                    Text("La prossima scadenza viene calcolata dall'ultimo intervento registrato.")
                }

                Section("Promemoria") {
                    Stepper("Avvisa \(bozza.giorniPreavviso) giorni prima",
                            value: $bozza.giorniPreavviso, in: 0...90)
                    Toggle("Attività attiva", isOn: $bozza.attiva)
                }

                Section("Descrizione") {
                    TextField("Cosa va fatto, materiali, note…", text: $bozza.descrizione, axis: .vertical)
                        .lineLimit(3...)
                }
            }
            .navigationTitle(attivita == nil ? "Nuova attività" : "Modifica attività")
            .navigationBarTitleDisplayMode(.inline)
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

    private func salva() {
        let destinazione = attivita ?? AttivitaManutenzione()
        if attivita == nil { contesto.insert(destinazione) }
        destinazione.titolo = bozza.titolo
        destinazione.descrizione = bozza.descrizione
        destinazione.tipo = bozza.tipo
        destinazione.intervalloValore = bozza.intervalloValore
        destinazione.intervalloUnita = bozza.intervalloUnita
        destinazione.primaScadenza = bozza.primaScadenza
        destinazione.giorniPreavviso = bozza.giorniPreavviso
        destinazione.attiva = bozza.attiva
        destinazione.sezione = bozza.sezione
        destinazione.contratto = bozza.contratto
        Task { await Notifiche.aggiorna(contesto: contesto) }
        chiudi()
    }
}

/// Registra o modifica un intervento eseguito.
struct InterventoModificaView: View {
    @Environment(\.modelContext) private var contesto
    @Environment(\.dismiss) private var chiudi
    let intervento: Intervento?
    let attivita: AttivitaManutenzione
    @State private var data: Date
    @State private var descrizione: String
    @State private var eseguitoDa: String
    @State private var costo: Double?
    @State private var note: String

    init(intervento: Intervento?, attivita: AttivitaManutenzione) {
        self.intervento = intervento
        self.attivita = attivita
        self.data = intervento?.data ?? .now
        self.descrizione = intervento?.descrizione ?? ""
        self.eseguitoDa = intervento?.eseguitoDa ?? attivita.contratto?.fornitore?.nomeCompleto ?? ""
        self.costo = intervento.map { $0.costo == 0 ? nil : $0.costo } ?? nil
        self.note = intervento?.note ?? ""
    }

    var body: some View {
        NavigationStack {
            Form {
                DatePicker("Data", selection: $data, displayedComponents: .date)
                TextField("Cosa è stato fatto", text: $descrizione)
                TextField("Eseguito da", text: $eseguitoDa)
                CampoNumero(titolo: "Costo", valore: $costo, unita: "€")
                Section("Note") {
                    TextField("Note", text: $note, axis: .vertical)
                        .lineLimit(2...)
                }
                if intervento == nil {
                    Section {
                        LabeledContent("Prossima scadenza",
                                       value: attivita.intervalloUnita.aggiungi(attivita.intervalloValore, a: data)
                                        .formatted(date: .long, time: .omitted))
                    }
                }
            }
            .navigationTitle(intervento == nil ? "Nuovo intervento" : "Modifica intervento")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla", role: .cancel) { chiudi() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fine", role: .confirm) { salva() }
                }
            }
        }
    }

    private func salva() {
        let destinazione = intervento ?? Intervento()
        if intervento == nil {
            contesto.insert(destinazione)
            destinazione.attivita = attivita
        }
        destinazione.data = data
        destinazione.descrizione = descrizione
        destinazione.eseguitoDa = eseguitoDa
        destinazione.costo = costo ?? 0
        destinazione.note = note
        Task { await Notifiche.aggiorna(contesto: contesto) }
        chiudi()
    }
}
