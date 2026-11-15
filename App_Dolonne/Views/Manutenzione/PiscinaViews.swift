import SwiftUI
import SwiftData
import Charts

// MARK: - Misure pH

/// Sezioni di lista con grafico e ultime misure dei due strumenti.
struct SezioniMisurePH: View {
    @Environment(\.modelContext) private var contesto
    @Environment(\.puoModificare) private var puoModificare
    @Query(sort: \MisuraPH.data, order: .reverse, animation: .default) private var misure: [MisuraPH]
    private let strumento1 = ChiaviImpostazioni.strumento1Predefinito
    private let strumento2 = ChiaviImpostazioni.strumento2Predefinito
    @Environment(PresentatoreFogli.self) private var presentatore: PresentatoreFogli?

    /// Punto del grafico con il nome dello strumento come serie.
    private struct Punto: Identifiable {
        let id = UUID()
        let data: Date
        let valore: Double
        let strumento: String
    }

    var body: some View {
        Group {
            Section {
                if let ultima = misure.first {
                    HStack(spacing: 12) {
                        valoreGrande(ultima.valoreStrumento1, nome: strumento1)
                        valoreGrande(ultima.valoreStrumento2, nome: strumento2)
                    }
                    .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))
                    Text("Ultima misura del \(ultima.data.formatted(date: .long, time: .omitted))")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                } else {
                    Text("Nessuna misura registrata").foregroundStyle(.secondary)
                }
                if puoModificare {
                    Button("Registra misura", systemImage: "plus.circle.fill") { presentatore?.apri(.misuraPH(nil)) }
                }
            } header: {
                Text("Misure pH")
            }

            if misure.count > 1 {
                Section {
                    Chart {
                        RectangleMark(yStart: .value("Min", 7.2), yEnd: .value("Max", 7.6))
                            .foregroundStyle(.green.opacity(0.12))
                        ForEach(punti) { punto in
                            LineMark(x: .value("Data", punto.data), y: .value("pH", punto.valore))
                                .foregroundStyle(by: .value("Strumento", punto.strumento))
                            PointMark(x: .value("Data", punto.data), y: .value("pH", punto.valore))
                                .foregroundStyle(by: .value("Strumento", punto.strumento))
                        }
                    }
                    .chartYScale(domain: .automatic(includesZero: false))
                    .frame(height: 200)
                } footer: {
                    Text("La fascia verde indica l'intervallo ideale 7,2 – 7,6.")
                }
            }

            if !misure.isEmpty {
                Section("Storico misure") {
                    ForEach(misure) { misura in
                        Button {
                            if puoModificare { presentatore?.apri(.misuraPH(misura)) }
                        } label: {
                            RigaMisuraPH(misura: misura, strumento1: strumento1, strumento2: strumento2)
                        }
                        .tint(.primary)
                    }
                    .onDelete { indici in
                        for indice in indici { contesto.delete(misure[indice]) }
                    }
                    .deleteDisabled(!puoModificare)
                }
            }
        }
    }

    private var punti: [Punto] {
        misure.flatMap { misura in
            [
                misura.valoreStrumento1.map { Punto(data: misura.data, valore: $0, strumento: strumento1) },
                misura.valoreStrumento2.map { Punto(data: misura.data, valore: $0, strumento: strumento2) }
            ].compactMap { $0 }
        }
    }

    private func valoreGrande(_ valore: Double?, nome: String) -> some View {
        VStack(spacing: 2) {
            Text(nome)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(valore.map { $0.formatted(.number.precision(.fractionLength(1...2))) } ?? "–")
                .font(.title.bold().monospacedDigit())
                .foregroundStyle(valore.map { ColorePH.colore($0) } ?? .secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(.fill.quaternary, in: .rect(cornerRadius: 12))
    }
}

/// Prodotti usati per correggere il pH: ognuno ha la sua scheda con scorta, acquisti e riempimenti.
struct SezioniProdottiPH: View {
    @Environment(\.puoModificare) private var puoModificare
    @Environment(PresentatoreFogli.self) private var presentatore: PresentatoreFogli?
    @Query(sort: \Prodotto.ordine, animation: .default) private var prodotti: [Prodotto]

    var body: some View {
        Section {
            let prodottiPH = prodotti.filter { $0.categoria == .ph }
            if prodottiPH.isEmpty {
                Text("Nessun prodotto").foregroundStyle(.secondary)
            }
            ForEach(prodottiPH) { prodotto in
                NavigationLink {
                    ProdottoDettaglioView(prodotto: prodotto)
                } label: {
                    RigaProdotto(prodotto: prodotto)
                }
            }
            if puoModificare {
                Button("Aggiungi prodotto", systemImage: "plus.circle.fill") {
                    presentatore?.apri(.nuovoProdotto(.ph))
                }
            }
        } header: {
            Text("Prodotti pH a scorta")
        } footer: {
            Text("Apri un prodotto per registrare acquisti, riempimenti e rettifiche della giacenza.")
        }
    }
}

enum ColorePH {
    static func colore(_ ph: Double) -> Color {
        (7.2...7.6).contains(ph) ? .green : (7.0...7.8).contains(ph) ? .orange : .red
    }
}

private struct RigaMisuraPH: View {
    let misura: MisuraPH
    let strumento1: String
    let strumento2: String

    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(misura.data, format: .dateTime.day().month(.abbreviated).year())
                if !misura.note.isEmpty {
                    Text(misura.note).font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer()
            VStack(alignment: .trailing) {
                valore(misura.valoreStrumento1, nome: strumento1)
                valore(misura.valoreStrumento2, nome: strumento2)
            }
        }
    }

    @ViewBuilder
    private func valore(_ valore: Double?, nome: String) -> some View {
        if let valore {
            Text("\(nome): \(valore.formatted(.number.precision(.fractionLength(1...2))))")
                .font(.subheadline.monospacedDigit())
                .foregroundStyle(ColorePH.colore(valore))
        }
    }
}

struct MisuraPHModificaView: View {
    @Environment(\.modelContext) private var contesto
    @Environment(\.dismiss) private var chiudi
    private let strumento1 = ChiaviImpostazioni.strumento1Predefinito
    private let strumento2 = ChiaviImpostazioni.strumento2Predefinito
    let misura: MisuraPH?
    @State private var data: Date
    @State private var valore1: Double?
    @State private var valore2: Double?
    @State private var note: String

    init(misura: MisuraPH?) {
        self.misura = misura
        self.data = misura?.data ?? .now
        self.valore1 = misura?.valoreStrumento1
        self.valore2 = misura?.valoreStrumento2
        self.note = misura?.note ?? ""
    }

    var body: some View {
        NavigationStack {
            Form {
                DatePicker("Data", selection: $data, displayedComponents: .date)
                Section("Valori pH") {
                    CampoNumero(titolo: LocalizedStringKey(strumento1), valore: $valore1)
                    CampoNumero(titolo: LocalizedStringKey(strumento2), valore: $valore2)
                }
                Section("Note") {
                    TextField("Note (es. aggiunto correttore)", text: $note, axis: .vertical)
                }
            }
            .navigationTitle(misura == nil ? "Nuova misura" : "Modifica misura")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla", role: .cancel) { chiudi() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fine", role: .confirm) {
                        let destinazione = misura ?? MisuraPH()
                        if misura == nil { contesto.insert(destinazione) }
                        destinazione.data = data
                        destinazione.valoreStrumento1 = valore1
                        destinazione.valoreStrumento2 = valore2
                        destinazione.note = note
                        chiudi()
                    }
                    .disabled(valore1 == nil && valore2 == nil)
                }
            }
        }
    }
}

// MARK: - Svuotamento e riempimento

/// Sezioni di lista per il cambio acqua: processo in corso, avvio e storico.
struct SezioniProcessiAcqua: View {
    @Environment(\.modelContext) private var contesto
    @Environment(\.puoModificare) private var puoModificare
    @Query(sort: \ProcessoAcqua.dataInizio, order: .reverse, animation: .default) private var processi: [ProcessoAcqua]
    @Environment(PresentatoreFogli.self) private var presentatore: PresentatoreFogli?

    var body: some View {
        Group {
            let inCorso = processi.filter(\.inCorso)
            if !inCorso.isEmpty {
                Section("In corso") {
                    ForEach(inCorso) { processo in
                        NavigationLink {
                            ProcessoAcquaView(processo: processo)
                        } label: {
                            RigaProcessoInCorso(processo: processo)
                        }
                    }
                }
            }

            if puoModificare {
                Section {
                    HStack {
                        ForEach(TipoProcessoAcqua.allCases) { tipo in
                            Button {
                                presentatore?.apri(.avvioProcesso(tipo, ultimoLivello: processi.first.map(\.livelloAttuale)))
                            } label: {
                                VStack(spacing: 4) {
                                    Image(systemName: tipo.icona).font(.title3)
                                    Text("Avvia \(String(localized: tipo.nome).lowercased())").font(.caption)
                                }
                                .frame(maxWidth: .infinity, minHeight: 56)
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }
            }

            Section("Storico") {
                let conclusi = processi.filter { !$0.inCorso }
                if conclusi.isEmpty {
                    Text("Nessun processo registrato").foregroundStyle(.secondary)
                }
                ForEach(conclusi) { processo in
                    NavigationLink {
                        ProcessoAcquaView(processo: processo)
                    } label: {
                        RigaProcessoConcluso(processo: processo)
                    }
                }
                .onDelete { indici in
                    for indice in indici { contesto.delete(conclusi[indice]) }
                }
                .deleteDisabled(!puoModificare)
            }
        }
    }
}

private struct RigaProcessoInCorso: View {
    let processo: ProcessoAcqua

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: processo.tipo.icona)
                .font(.title2)
                .foregroundStyle(.white)
                .frame(width: 44, height: 44)
                .background(.blue.gradient, in: .circle)
            VStack(alignment: .leading, spacing: 2) {
                Text(processo.tipo.nome).font(.headline)
                Text("\(processo.livelloAttuale.formatted()) cm · \(processo.variazione.formatted(.number.precision(.fractionLength(0...1)))) cm di variazione")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text(processo.dataInizio, style: .timer)
                .font(.body.monospacedDigit())
                .foregroundStyle(.blue)
        }
    }
}

private struct RigaProcessoConcluso: View {
    let processo: ProcessoAcqua

    var body: some View {
        HStack {
            Label {
                VStack(alignment: .leading, spacing: 2) {
                    Text(processo.tipo.nome)
                    Text(processo.dataInizio, format: .dateTime.day().month(.wide).year())
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } icon: {
                Image(systemName: processo.tipo.icona)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(processo.variazione.formatted(.number.precision(.fractionLength(0...1)))) cm")
                    .font(.body.monospacedDigit())
                Text(Int(processo.durata / 60).durataLeggibile)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

/// Dettaglio live di un processo: tempo trascorso, livello, velocità, stima e letture.
struct ProcessoAcquaView: View {
    @Environment(\.modelContext) private var contesto
    @Environment(\.puoModificare) private var puoModificare
    @Bindable var processo: ProcessoAcqua
    @State private var mostraLettura = false
    @State private var mostraFine = false
    @State private var letturaDaModificare: LetturaLivello?

    var body: some View {
        List {
            Section {
                riepilogo
            }

            if processo.inCorso && puoModificare {
                Section {
                    Button {
                        mostraLettura = true
                    } label: {
                        Label("Registra livello", systemImage: "ruler.fill")
                            .font(.headline)
                            .frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .buttonStyle(.borderedProminent)
                    Button {
                        mostraFine = true
                    } label: {
                        Label("Termina \(String(localized: processo.tipo.nome).lowercased())", systemImage: "flag.checkered")
                            .frame(maxWidth: .infinity, minHeight: 36)
                    }
                    .buttonStyle(.bordered)
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
            }

            if processo.punti.count > 1 {
                Section("Andamento livello") {
                    Chart {
                        ForEach(Array(processo.punti.enumerated()), id: \.offset) { _, punto in
                            LineMark(x: .value("Ora", punto.data), y: .value("Livello", punto.livello))
                            PointMark(x: .value("Ora", punto.data), y: .value("Livello", punto.livello))
                        }
                        if let obiettivo = processo.livelloObiettivo {
                            RuleMark(y: .value("Obiettivo", obiettivo))
                                .foregroundStyle(.green)
                                .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                                .annotation(position: .top, alignment: .leading) {
                                    Text("Obiettivo").font(.caption2).foregroundStyle(.green)
                                }
                        }
                    }
                    .chartYScale(domain: .automatic(includesZero: false))
                    .chartYAxisLabel("cm")
                    .frame(height: 200)
                }
            }

            Section("Letture") {
                RigaLettura(etichetta: "Inizio", data: processo.dataInizio, livello: processo.livelloIniziale,
                            precedente: nil, inizio: processo.dataInizio)
                ForEach(Array(processo.lettureOrdinate.enumerated()), id: \.element.persistentModelID) { indice, lettura in
                    let precedente = indice == 0 ? processo.livelloIniziale : processo.lettureOrdinate[indice - 1].livello
                    Button {
                        if puoModificare { letturaDaModificare = lettura }
                    } label: {
                        RigaLettura(etichetta: nil, data: lettura.data, livello: lettura.livello,
                                    precedente: precedente, inizio: processo.dataInizio)
                    }
                    .tint(.primary)
                }
                .onDelete { indici in
                    let elenco = processo.lettureOrdinate
                    for indice in indici { contesto.delete(elenco[indice]) }
                }
                .deleteDisabled(!puoModificare)
                if let fine = processo.dataFine, let livello = processo.livelloFinale {
                    RigaLettura(etichetta: "Fine", data: fine, livello: livello,
                                precedente: processo.lettureOrdinate.last?.livello ?? processo.livelloIniziale,
                                inizio: processo.dataInizio)
                }
            }

            if !processo.note.isEmpty {
                Section("Note") { Text(processo.note) }
            }
        }
        .navigationTitle(Text(processo.tipo.nome))
        .toolbar {
            if puoModificare && !processo.inCorso {
                ToolbarItem(placement: .primaryAction) {
                    Button("Modifica") { mostraFine = true }
                }
            }
        }
        .sheet(isPresented: $mostraLettura) {
            LetturaLivelloView(processo: processo, lettura: nil)
        }
        .sheet(item: $letturaDaModificare) { lettura in
            LetturaLivelloView(processo: processo, lettura: lettura)
        }
        .sheet(isPresented: $mostraFine) {
            FineProcessoView(processo: processo)
        }
    }

    @ViewBuilder
    private var riepilogo: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(processo.inCorso ? "Tempo trascorso" : "Durata totale")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if processo.inCorso {
                    Text(processo.dataInizio, style: .timer)
                        .font(.largeTitle.bold().monospacedDigit())
                } else {
                    Text(Int(processo.durata / 60).durataLeggibile)
                        .font(.largeTitle.bold())
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("Livello").font(.subheadline).foregroundStyle(.secondary)
                Text("\(processo.livelloAttuale.formatted(.number.precision(.fractionLength(0...1)))) cm")
                    .font(.title2.bold().monospacedDigit())
            }
        }
        .padding(.vertical, 4)

        LabeledContent("Inizio", value: processo.dataInizio.formatted(date: .abbreviated, time: .shortened))
        LabeledContent("Livello iniziale", value: "\(processo.livelloIniziale.formatted()) cm")
        LabeledContent(processo.tipo == .svuotamento ? "Centimetri svuotati" : "Centimetri riempiti",
                       value: "\(processo.variazione.formatted(.number.precision(.fractionLength(0...1)))) cm")
        if let velocita = processo.velocita {
            LabeledContent("Velocità media",
                           value: "\(abs(velocita).formatted(.number.precision(.fractionLength(0...2)))) cm/h")
        }
        if let obiettivo = processo.livelloObiettivo {
            LabeledContent("Livello obiettivo", value: "\(obiettivo.formatted()) cm")
        }
        if let arrivo = processo.arrivoStimato {
            LabeledContent("Arrivo stimato") {
                Text("\(arrivo.formatted(.dateTime.hour().minute())) (\(arrivo.formatted(.relative(presentation: .named))))")
            }
        }
        if let temperatura = processo.temperaturaIniziale {
            LabeledContent("Temperatura iniziale", value: "\(temperatura.formatted()) °C")
        }
        if let temperatura = processo.temperaturaFinale {
            LabeledContent("Temperatura finale", value: "\(temperatura.formatted()) °C")
        }
        if let fine = processo.dataFine {
            LabeledContent("Fine", value: fine.formatted(date: .abbreviated, time: .shortened))
        }
    }
}

private struct RigaLettura: View {
    let etichetta: LocalizedStringKey?
    let data: Date
    let livello: Double
    let precedente: Double?
    let inizio: Date

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                if let etichetta {
                    Text(etichetta).font(.body.weight(.medium))
                }
                Text(data, format: .dateTime.hour().minute())
                    .font(etichetta == nil ? .body : .caption)
                    .foregroundStyle(etichetta == nil ? .primary : .secondary)
                if data > inizio {
                    Text("+\(Int(data.timeIntervalSince(inizio) / 60).durataLeggibile)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(livello.formatted(.number.precision(.fractionLength(0...1)))) cm")
                    .font(.body.monospacedDigit())
                if let precedente {
                    let delta = livello - precedente
                    Text("\(delta >= 0 ? "+" : "−")\(abs(delta).formatted(.number.precision(.fractionLength(0...1)))) cm")
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

/// Avvio di uno svuotamento o riempimento.
struct AvvioProcessoView: View {
    @Environment(\.modelContext) private var contesto
    @Environment(\.dismiss) private var chiudi
    let tipo: TipoProcessoAcqua
    @State private var inizio = Date.now
    @State private var livello: Double?
    @State private var obiettivo: Double?
    @State private var temperatura: Double?
    @State private var note = ""


    init(tipo: TipoProcessoAcqua, ultimoLivello: Double?) {
        self.tipo = tipo
        // Lo svuotamento parte dal livello pieno (0 cm); il riempimento da dove si era arrivati.
        self.livello = tipo == .svuotamento ? 0 : (ultimoLivello ?? 0)
        self.obiettivo = tipo == .riempimento ? 0 : nil
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    DatePicker("Inizio", selection: $inizio)
                    CampoNumero(titolo: "Livello iniziale", valore: $livello, unita: "cm", negativi: true)
                    CampoNumero(titolo: "Livello obiettivo", valore: $obiettivo, unita: "cm", negativi: true)
                    CampoNumero(titolo: "Temperatura acqua", valore: $temperatura, unita: "°C")
                } footer: {
                    Text("Il livello pieno è 0 cm; svuotando scende a -5, -10 cm… Con il livello obiettivo (es. -30 cm per lo svuotamento, 0 cm per il riempimento) l'app stima quando terminerà.")
                }
                Section("Note") {
                    TextField("Note", text: $note, axis: .vertical)
                }
            }
            .navigationTitle(Text("Avvia \(String(localized: tipo.nome).lowercased())"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla", role: .cancel) { chiudi() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Avvia", role: .confirm) {
                        let processo = ProcessoAcqua(tipo: tipo, dataInizio: inizio)
                        processo.livelloIniziale = livello ?? 0
                        processo.livelloObiettivo = obiettivo
                        processo.temperaturaIniziale = temperatura
                        processo.note = note
                        contesto.insert(processo)
                        chiudi()
                    }
                    .disabled(livello == nil)
                }
            }
        }
    }
}

/// Nuova lettura (o modifica) del livello durante il processo.
struct LetturaLivelloView: View {
    @Environment(\.modelContext) private var contesto
    @Environment(\.dismiss) private var chiudi
    let processo: ProcessoAcqua
    let lettura: LetturaLivello?
    @State private var data: Date
    @State private var livello: Double?

    init(processo: ProcessoAcqua, lettura: LetturaLivello?) {
        self.processo = processo
        self.lettura = lettura
        self.data = lettura?.data ?? .now
        self.livello = lettura?.livello ?? processo.livelloAttuale
    }

    var body: some View {
        NavigationStack {
            Form {
                DatePicker("Ora", selection: $data)
                CampoNumero(titolo: "Livello", valore: $livello, unita: "cm", negativi: true)
                HStack {
                    ForEach([-5.0, -1.0, 1.0, 5.0], id: \.self) { passo in
                        Button(passo > 0 ? "+\(Int(passo))" : "\(Int(passo))") {
                            livello = (livello ?? 0) + passo
                        }
                        .buttonStyle(.bordered)
                        .frame(maxWidth: .infinity)
                    }
                }
                .listRowBackground(Color.clear)
                if let livello {
                    LabeledContent("Variazione dall'inizio",
                                   value: "\(abs(livello - processo.livelloIniziale).formatted(.number.precision(.fractionLength(0...1)))) cm")
                }
            }
            .navigationTitle(lettura == nil ? "Registra livello" : "Modifica lettura")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla", role: .cancel) { chiudi() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salva", role: .confirm) {
                        let destinazione = lettura ?? LetturaLivello(livello: livello ?? 0)
                        if lettura == nil {
                            contesto.insert(destinazione)
                            destinazione.processo = processo
                        }
                        destinazione.data = data
                        destinazione.livello = livello ?? 0
                        chiudi()
                    }
                    .disabled(livello == nil)
                }
            }
        }
        .presentationDetents([.medium])
    }
}

/// Conclusione del processo (o modifica dei dati finali).
struct FineProcessoView: View {
    @Environment(\.dismiss) private var chiudi
    @Bindable var processo: ProcessoAcqua
    @State private var fine: Date
    @State private var livello: Double?
    @State private var temperatura: Double?
    @State private var note: String

    init(processo: ProcessoAcqua) {
        self.processo = processo
        self.fine = processo.dataFine ?? .now
        self.livello = processo.livelloFinale ?? processo.livelloAttuale
        self.temperatura = processo.temperaturaFinale
        self.note = processo.note
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    DatePicker("Fine", selection: $fine, in: processo.dataInizio...)
                    CampoNumero(titolo: "Livello finale", valore: $livello, unita: "cm", negativi: true)
                    CampoNumero(titolo: "Temperatura acqua", valore: $temperatura, unita: "°C")
                    LabeledContent("Tempo totale",
                                   value: Int(fine.timeIntervalSince(processo.dataInizio) / 60).durataLeggibile)
                    if let livello {
                        LabeledContent("Variazione totale",
                                       value: "\(abs(livello - processo.livelloIniziale).formatted(.number.precision(.fractionLength(0...1)))) cm")
                    }
                }
                Section("Note") {
                    TextField("Note", text: $note, axis: .vertical)
                }
            }
            .navigationTitle(processo.inCorso ? "Termina processo" : "Dati finali")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla", role: .cancel) { chiudi() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fine", role: .confirm) {
                        processo.dataFine = fine
                        processo.livelloFinale = livello
                        processo.temperaturaFinale = temperatura
                        processo.note = note
                        chiudi()
                    }
                    .disabled(livello == nil)
                }
            }
        }
    }
}

#Preview("Svuotamento in corso") {
    let container = Modelli.anteprima()
    let processo = ProcessoAcqua(tipo: .svuotamento, dataInizio: .now.addingTimeInterval(-7200))
    processo.livelloIniziale = 10
    processo.livelloObiettivo = 30
    processo.temperaturaIniziale = 26
    container.mainContext.insert(processo)
    for (minuti, livello) in [(-90, 13.5), (-60, 15.0), (-30, 18.0), (0, 20.0)] {
        let lettura = LetturaLivello(data: .now.addingTimeInterval(Double(minuti) * 60), livello: livello)
        lettura.processo = processo
        container.mainContext.insert(lettura)
    }
    return NavigationStack { ProcessoAcquaView(processo: processo) }
        .modelContainer(container)
}
