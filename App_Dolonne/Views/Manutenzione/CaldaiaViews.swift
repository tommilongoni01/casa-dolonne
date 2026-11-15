import SwiftUI
import SwiftData
import Charts

// MARK: - Pellet

/// Tabella dei carichi di pellet con riepilogo dei costi.
struct SezioniPellet: View {
    @Environment(\.modelContext) private var contesto
    @Environment(\.puoModificare) private var puoModificare
    @Environment(PresentatoreFogli.self) private var presentatore: PresentatoreFogli?
    @Query(sort: \CaricoPellet.data, order: .reverse, animation: .default) private var carichi: [CaricoPellet]

    var body: some View {
        Group {
            Section {
                if let ultimo = carichi.first {
                    LabeledContent("Data", value: ultimo.data.formatted(date: .long, time: .omitted))
                    LabeledContent("Quantità acquistata", value: Self.quintali(ultimo.quintali))
                    LabeledContent("Costo al quintale", value: ultimo.prezzoQuintale.euro)
                    LabeledContent("Spesa (IVA incl.)", value: ultimo.totale.euro)
                    if let post = ultimo.postcarico {
                        LabeledContent("Deposito dopo il carico", value: Self.quintali(post))
                    }
                } else {
                    Text("Nessun carico registrato").foregroundStyle(.secondary)
                }
                if puoModificare {
                    Button("Registra carico", systemImage: "plus.circle.fill") { presentatore?.apri(.caricoPellet(nil)) }
                }
            } header: {
                Text("Ultimo carico")
            }

            if !carichi.isEmpty {
                Section {
                    ScrollView(.horizontal) {
                        tabella
                            .padding(.vertical, 6)
                    }
                    .listRowInsets(EdgeInsets(top: 0, leading: 12, bottom: 0, trailing: 12))
                } header: {
                    Text("Registro carichi")
                } footer: {
                    Text(puoModificare ? "Scorri di lato per vedere tutte le colonne. Tocca una riga per modificarla." :
                            "Scorri di lato per vedere tutte le colonne.")
                }
            }

            let conPrezzo = carichi.filter { $0.quintali > 0 && $0.prezzoQuintale > 0 }
            if conPrezzo.count > 1 {
                Section("Costo al quintale nel tempo (IVA esclusa)") {
                    Chart(conPrezzo) { carico in
                        LineMark(x: .value("Data", carico.data), y: .value("Costo al quintale", carico.prezzoQuintale))
                        PointMark(x: .value("Data", carico.data), y: .value("Costo al quintale", carico.prezzoQuintale))
                    }
                    .chartYScale(domain: .automatic(includesZero: false))
                    .chartYAxis {
                        AxisMarks { valore in
                            AxisGridLine()
                            AxisValueLabel {
                                if let euro = valore.as(Double.self) { Text("\(euro.numero) €") }
                            }
                        }
                    }
                    .frame(height: 200)
                }
            }
        }
    }

    private var tabella: some View {
        Grid(alignment: .trailing, horizontalSpacing: 16, verticalSpacing: 10) {
            GridRow {
                ForEach(Self.colonne, id: \.self) { titolo in
                    Text(titolo)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .gridColumnAlignment(titolo == Self.colonne[0] || titolo == Self.colonne[1] ? .leading : .trailing)
                }
            }
            Divider()
            ForEach(carichi) { carico in
                GridRow {
                    Text(carico.data, format: .dateTime.day().month(.twoDigits).year(.twoDigits))
                    Text(carico.fornitore.isEmpty ? "–" : carico.fornitore).lineLimit(1)
                    Text(Self.quintali(carico.quintali))
                    Text(carico.prezzoQuintale.euro)
                    Text("\(Self.numero(carico.ivaPercentuale))%")
                    Text(carico.iva.euro)
                    Text(carico.totale.euro).bold()
                    Text(carico.precarico.map { Self.quintali($0) } ?? "–")
                    Text(carico.postcarico.map { Self.quintali($0) } ?? "–")
                }
                .font(.subheadline.monospacedDigit())
                .contentShape(.rect)
                .onTapGesture {
                    if puoModificare { presentatore?.apri(.caricoPellet(carico)) }
                }
            }
            Divider()
            GridRow {
                Text("Totale").bold()
                Text("")
                Text(Self.quintali(carichi.reduce(0) { $0 + $1.quintali })).bold()
                Text("")
                Text("")
                Text("")
                Text(carichi.reduce(0) { $0 + $1.totale }.euro).bold()
                Text("")
                Text("")
            }
            .font(.subheadline.monospacedDigit())
        }
    }

    private static let colonne = [
        String(localized: "Data"), String(localized: "Fornitore"), String(localized: "Quantità"),
        String(localized: "Costo al quintale"), String(localized: "Aliquota IVA"), String(localized: "IVA"),
        String(localized: "Totale"), String(localized: "Pre carico"), String(localized: "Post carico")
    ]

    static func numero(_ valore: Double) -> String {
        valore.numero
    }

    static func quintali(_ valore: Double) -> String { "\(numero(valore)) q" }
}

struct CaricoPelletModificaView: View {
    @Environment(\.modelContext) private var contesto
    @Environment(\.dismiss) private var chiudi
    @Query(sort: \CaricoPellet.data, order: .reverse, animation: .default) private var carichi: [CaricoPellet]
    let carico: CaricoPellet?
    @State private var data: Date
    @State private var fornitore: String
    @State private var quintali: Double?
    @State private var prezzo: Double?
    @State private var iva: Double?
    @State private var precarico: Double?
    @State private var note: String
    @State private var confermaEliminazione = false

    init(carico: CaricoPellet?) {
        self.carico = carico
        self.data = carico?.data ?? .now
        self.fornitore = carico?.fornitore ?? ""
        self.quintali = carico?.quintali
        self.prezzo = carico?.prezzoQuintale
        self.iva = carico?.ivaPercentuale
        self.precarico = carico?.precarico
        self.note = carico?.note ?? ""
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    DatePicker("Data", selection: $data, displayedComponents: .date)
                    TextField("Fornitore", text: $fornitore)
                    CampoNumero(titolo: "Quantità", valore: $quintali, unita: "q")
                }
                Section("Costi") {
                    CampoNumero(titolo: "Costo al quintale", valore: $prezzo, unita: "€")
                    CampoNumero(titolo: "IVA", valore: $iva, unita: "%")
                    LabeledContent("IVA in euro", value: calcolo.iva.euro)
                    LabeledContent("Totale (costo + IVA)", value: calcolo.totale.euro)
                        .bold()
                }
                Section {
                    CampoNumero(titolo: "Precarico", valore: $precarico, unita: "q")
                    LabeledContent("Postcarico", value: precarico.map { SezioniPellet.quintali($0 + (quintali ?? 0)) } ?? "–")
                } header: {
                    Text("Deposito")
                } footer: {
                    Text("Precarico: pellet presente nel deposito prima del carico. Il postcarico si calcola sommando la quantità acquistata.")
                }
                Section("Note") {
                    TextField("Note", text: $note, axis: .vertical)
                }
                if carico != nil {
                    Section {
                        Button("Elimina carico", role: .destructive) { confermaEliminazione = true }
                    }
                }
            }
            .navigationTitle(carico == nil ? "Nuovo carico" : "Modifica carico")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla", role: .cancel) { chiudi() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fine", role: .confirm) { salva() }
                        .disabled(quintali == nil)
                }
            }
            .confirmationDialog("Eliminare il carico?", isPresented: $confermaEliminazione, titleVisibility: .visible) {
                Button("Elimina", role: .destructive) {
                    if let carico { contesto.delete(carico) }
                    chiudi()
                }
            }
            .onAppear(perform: precompila)
        }
    }

    /// IVA e totale calcolati con i dati inseriti finora.
    private var calcolo: (iva: Double, totale: Double) {
        let imponibile = (quintali ?? 0) * (prezzo ?? 0)
        let iva = imponibile * (self.iva ?? 0) / 100
        return (iva, imponibile + iva)
    }

    /// Per un nuovo carico propone fornitore, prezzo e IVA dell'ultimo.
    private func precompila() {
        guard carico == nil, let ultimo = carichi.first else {
            if iva == nil { iva = 22 }
            return
        }
        if fornitore.isEmpty { fornitore = ultimo.fornitore }
        if prezzo == nil { prezzo = ultimo.prezzoQuintale }
        if iva == nil { iva = ultimo.ivaPercentuale }
    }

    private func salva() {
        let destinazione = carico ?? CaricoPellet()
        if carico == nil { contesto.insert(destinazione) }
        destinazione.data = data
        destinazione.fornitore = fornitore
        destinazione.quintali = quintali ?? 0
        destinazione.prezzoQuintale = prezzo ?? 0
        destinazione.ivaPercentuale = iva ?? 0
        destinazione.precarico = precarico
        destinazione.note = note
        chiudi()
    }
}

// MARK: - Svuotamento ceneri

struct SezioniCeneri: View {
    @Environment(\.modelContext) private var contesto
    @Environment(\.puoModificare) private var puoModificare
    @Environment(PresentatoreFogli.self) private var presentatore: PresentatoreFogli?
    @Query(sort: \SvuotamentoCeneri.data, order: .reverse, animation: .default) private var svuotamenti: [SvuotamentoCeneri]
    @Query(sort: \CaricoPellet.data, animation: .default) private var carichi: [CaricoPellet]

    var body: some View {
        Group {
            Section {
                if let ultimo = svuotamenti.first {
                    LabeledContent("Ultimo svuotamento", value: ultimo.data.formatted(date: .long, time: .omitted))
                    LabeledContent("Giorni trascorsi", value: "\(ultimo.data.giorniTrascorsi)")
                } else {
                    Text("Nessuno svuotamento registrato").foregroundStyle(.secondary)
                }
                if puoModificare {
                    Button("Registra svuotamento", systemImage: "plus.circle.fill") { presentatore?.apri(.ceneri(nil)) }
                }
            } header: {
                Text("Svuotamento cenere")
            }

            if !svuotamenti.isEmpty {
                Section {
                    ForEach(Array(svuotamenti.enumerated()), id: \.element.persistentModelID) { indice, voce in
                        let precedente = indice + 1 < svuotamenti.count ? svuotamenti[indice + 1] : nil
                        Button {
                            if puoModificare { presentatore?.apri(.ceneri(voce)) }
                        } label: {
                            RigaCeneri(svuotamento: voce, consumo: consumo(da: precedente, a: voce))
                        }
                        .tint(.primary)
                    }
                    .onDelete { indici in
                        for indice in indici { contesto.delete(svuotamenti[indice]) }
                    }
                    .deleteDisabled(!puoModificare)
                } header: {
                    Text("Storico")
                } footer: {
                    Text("Il consumo è calcolato dalla scorta dello svuotamento precedente, più i carichi di pellet registrati nel frattempo.")
                }
            }
        }
    }

    /// Pellet bruciato tra due svuotamenti, in kg (1 q = 100 kg).
    private func consumo(da precedente: SvuotamentoCeneri?, a attuale: SvuotamentoCeneri) -> Double? {
        guard let precedente, let inizio = precedente.scortaKg, let fine = attuale.scortaKg else { return nil }
        let caricati = carichi
            .filter { $0.data > precedente.data && $0.data <= attuale.data }
            .reduce(0) { $0 + $1.quintali * 100 }
        let valore = inizio + caricati - fine
        return valore >= 0 ? valore : nil
    }
}

private struct RigaCeneri: View {
    let svuotamento: SvuotamentoCeneri
    let consumo: Double?

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(svuotamento.data, format: .dateTime.day().month(.wide).year())
                if !svuotamento.note.isEmpty {
                    Text(svuotamento.note).font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(svuotamento.scortaKg.map { "\(SezioniPellet.numero($0)) kg" } ?? "–")
                    .font(.body.monospacedDigit())
                if let consumo {
                    Text("consumati \(SezioniPellet.numero(consumo)) kg")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

struct SvuotamentoCeneriModificaView: View {
    @Environment(\.modelContext) private var contesto
    @Environment(\.dismiss) private var chiudi
    let svuotamento: SvuotamentoCeneri?
    @State private var data: Date
    @State private var scorta: Double?
    @State private var note: String

    init(svuotamento: SvuotamentoCeneri?) {
        self.svuotamento = svuotamento
        self.data = svuotamento?.data ?? .now
        self.scorta = svuotamento?.scortaKg
        self.note = svuotamento?.note ?? ""
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    DatePicker("Data", selection: $data, displayedComponents: .date)
                    CampoNumero(titolo: "Pellet a scorta", valore: $scorta, unita: "kg")
                } footer: {
                    Text("Il carico in kg indicato dal pannello della caldaia (Deposito) al momento dello svuotamento.")
                }
                Section("Note") {
                    TextField("Note", text: $note, axis: .vertical)
                }
            }
            .navigationTitle(svuotamento == nil ? "Svuotamento cenere" : "Modifica svuotamento")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla", role: .cancel) { chiudi() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fine", role: .confirm) {
                        let destinazione = svuotamento ?? SvuotamentoCeneri()
                        if svuotamento == nil { contesto.insert(destinazione) }
                        destinazione.data = data
                        destinazione.scortaKg = scorta
                        destinazione.note = note
                        chiudi()
                    }
                }
            }
        }
    }
}

// MARK: - Storico manutenzioni

/// Storico manutenzioni di un'operazione (Caldaia, UTA, VMC, Ascensore…):
/// tipologie con periodicità, interventi, note, contratti e documenti del sistema.
struct SezioniStorico: View {
    @Environment(\.modelContext) private var contesto
    @Environment(\.puoModificare) private var puoModificare
    @Environment(PresentatoreFogli.self) private var presentatore: PresentatoreFogli?
    let operazione: Operazione

    var body: some View {
        Group {
            Section {
                if operazione.tipologieOrdinate.isEmpty {
                    Text("Nessuna tipologia di manutenzione. Aggiungila da Modifica.")
                        .foregroundStyle(.secondary)
                }
                ForEach(operazione.tipologieOrdinate) { tipologia in
                    RigaTipologia(tipologia: tipologia)
                }
                if puoModificare && !operazione.tipologieOrdinate.isEmpty {
                    Button("Registra manutenzione", systemImage: "plus.circle.fill") {
                        presentatore?.apri(.interventoStorico(operazione, nil))
                    }
                }
            } header: {
                Text("Scadenze")
            }

            if !operazione.interventiOrdinati.isEmpty {
                Section("Interventi") {
                    ForEach(operazione.interventiOrdinati) { intervento in
                        Button {
                            if puoModificare { presentatore?.apri(.interventoStorico(operazione, intervento)) }
                        } label: {
                            RigaInterventoStorico(intervento: intervento,
                                                  mostraTipologia: operazione.tipologieOrdinate.count > 1)
                        }
                        .tint(.primary)
                    }
                    .onDelete { indici in
                        let elenco = operazione.interventiOrdinati
                        for indice in indici { contesto.delete(elenco[indice]) }
                    }
                    .deleteDisabled(!puoModificare)
                }
            }

            if let sezione = operazione.sezione {
                Section {
                    let contratti = (sezione.contratti ?? []).sorted {
                        ($0.dataScadenza ?? .distantFuture) < ($1.dataScadenza ?? .distantFuture)
                    }
                    if contratti.isEmpty {
                        Text("Nessun contratto").foregroundStyle(.secondary)
                    }
                    ForEach(contratti) { contratto in
                        NavigationLink {
                            ContrattoDettaglioView(contratto: contratto)
                        } label: {
                            RigaContratto(contratto: contratto)
                        }
                    }
                    if puoModificare {
                        Button("Aggiungi contratto", systemImage: "doc.badge.plus") {
                            presentatore?.apri(.contratto(sezione))
                        }
                    }
                } header: {
                    Text("Contratto di manutenzione")
                } footer: {
                    Text("Con una data di scadenza ricevi l'avviso prima che il contratto scada.")
                }

                Section {
                    if sezione.documentiOrdinati.isEmpty {
                        Text("Nessun documento").foregroundStyle(.secondary)
                    }
                    ForEach(sezione.documentiOrdinati) { RigaDocumento(documento: $0) }
                        .onDelete { indici in
                            let elenco = sezione.documentiOrdinati
                            for indice in indici { contesto.delete(elenco[indice]) }
                        }
                        .deleteDisabled(!puoModificare)
                    if puoModificare {
                        Button("Allega manuale o documento", systemImage: "paperclip") {
                            presentatore?.importaDocumenti(in: sezione)
                        }
                    }
                } header: {
                    Text("Manuali e documenti")
                } footer: {
                    Text("I documenti allegati compaiono anche nel Manuale, sezione \(sezione.nome).")
                }
            }

            if !operazione.note.isEmpty {
                Section("Note") {
                    Text(operazione.note)
                        .textSelection(.enabled)
                }
            }
        }
    }
}

/// Riga di una tipologia: periodicità, ultimo intervento e prossima scadenza.
private struct RigaTipologia: View {
    let tipologia: TipologiaIntervento

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(tipologia.nome)
                Text(sottotitolo)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if let scadenza = tipologia.prossimaScadenza {
                BadgeScadenza(data: scadenza, stato: stato(scadenza))
            }
        }
    }

    private var sottotitolo: String {
        let ultima = tipologia.ultimoIntervento.map {
            String(localized: "ultima il \($0.data.formatted(date: .abbreviated, time: .omitted))")
        } ?? String(localized: "nessun intervento registrato")
        return "\(tipologia.descrizionePeriodicita) · \(ultima)"
    }

    private func stato(_ scadenza: Date) -> StatoScadenza {
        scadenza <= .now ? .scaduta : StatoScadenza.calcola(scadenza: scadenza, preavvisoGiorni: 14)
    }
}

private struct RigaInterventoStorico: View {
    let intervento: InterventoStorico
    let mostraTipologia: Bool

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(intervento.data, format: .dateTime.day().month(.wide).year())
                if !intervento.note.isEmpty {
                    Text(intervento.note)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            if mostraTipologia, let tipologia = intervento.tipologia {
                Text(tipologia.nome)
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .foregroundStyle(tipologia.mesiAvviso > 0 ? Color.accentColor : .secondary)
                    .background((tipologia.mesiAvviso > 0 ? Color.accentColor : Color.gray).opacity(0.15), in: .capsule)
            }
        }
    }
}

struct InterventoStoricoModificaView: View {
    @Environment(\.modelContext) private var contesto
    @Environment(\.dismiss) private var chiudi
    let operazione: Operazione
    let intervento: InterventoStorico?
    @State private var data: Date
    @State private var tipologia: TipologiaIntervento?
    @State private var note: String

    init(operazione: Operazione, intervento: InterventoStorico?) {
        self.operazione = operazione
        self.intervento = intervento
        self.data = intervento?.data ?? .now
        self.tipologia = intervento?.tipologia ?? operazione.tipologieOrdinate.first
        self.note = intervento?.note ?? ""
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    DatePicker("Data", selection: $data, displayedComponents: .date)
                    if operazione.tipologieOrdinate.count > 1 {
                        Picker("Tipo", selection: $tipologia) {
                            ForEach(operazione.tipologieOrdinate) { Text($0.nome).tag(Optional($0)) }
                        }
                        .pickerStyle(.menu)
                    }
                } footer: {
                    if let tipologia, tipologia.mesiAvviso > 0 {
                        Text("Prossima scadenza: \(tipologia.descrizionePeriodicita.lowercased()) da questa data.")
                    }
                }
                Section("Note") {
                    TextField("Cosa è stato fatto, chi l'ha fatto…", text: $note, axis: .vertical)
                        .lineLimit(3...)
                }
            }
            .navigationTitle(intervento == nil ? "Nuova manutenzione" : "Modifica manutenzione")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla", role: .cancel) { chiudi() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fine", role: .confirm) {
                        let destinazione = intervento ?? InterventoStorico()
                        if intervento == nil {
                            contesto.insert(destinazione)
                            destinazione.operazione = operazione
                        }
                        destinazione.data = data
                        destinazione.tipologia = tipologia
                        destinazione.note = note
                        Task { await Notifiche.aggiorna(contesto: contesto) }
                        chiudi()
                    }
                }
            }
        }
    }
}

#Preview("Pellet con dati di esempio") {
    let container = Modelli.anteprima()
    let contesto = container.mainContext
    let operazione = Operazione(titolo: "Pellet", tipo: .pellet, sezione: nil)
    contesto.insert(operazione)
    for (giorni, quintali, prezzo, pre) in [(-300, 30.0, 36.0, 4.0), (-120, 25.0, 38.5, 6.5), (-20, 28.0, 37.0, 5.0)] {
        let carico = CaricoPellet(data: .now.addingTimeInterval(Double(giorni) * 86_400))
        carico.fornitore = "Pellet Valle d'Aosta"
        carico.quintali = quintali
        carico.prezzoQuintale = prezzo
        carico.precarico = pre
        contesto.insert(carico)
    }
    return NavigationStack { OperazioneView(operazione: operazione) }
        .modelContainer(container)
}
