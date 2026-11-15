import SwiftUI
import SwiftData
import Charts

/// Tutti i prodotti a scorta.
struct ProdottiListaView: View {
    @Environment(\.modelContext) private var contesto
    @Environment(\.puoModificare) private var puoModificare
    @Query(sort: \Prodotto.ordine, animation: .default) private var prodotti: [Prodotto]
    @State private var mostraNuovo = false

    var body: some View {
        List {
            ForEach(prodotti) { prodotto in
                NavigationLink {
                    ProdottoDettaglioView(prodotto: prodotto)
                } label: {
                    RigaProdotto(prodotto: prodotto)
                }
            }
            .onDelete { indici in
                for indice in indici { contesto.delete(prodotti[indice]) }
            }
            .deleteDisabled(!puoModificare)
        }
        .navigationTitle("Prodotti a scorta")
        .toolbar {
            if puoModificare {
                ToolbarItem(placement: .primaryAction) {
                    Button("Nuovo prodotto", systemImage: "plus") { mostraNuovo = true }
                }
            }
        }
        .sheet(isPresented: $mostraNuovo) {
            ProdottoModificaView(prodotto: nil, ordine: (prodotti.last?.ordine ?? 0) + 1)
        }
    }
}

struct RigaProdotto: View {
    let prodotto: Prodotto

    var body: some View {
        let analisi = prodotto.analisi
        HStack {
            Label {
                VStack(alignment: .leading, spacing: 2) {
                    Text(prodotto.nome)
                    if prodotto.mostraPrevisioni, let giorni = analisi.giorniAutonomia {
                        Text("Autonomia: \(giorni) giorni")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            } icon: {
                Image(systemName: prodotto.categoria.icona)
            }
            Spacer()
            Text(analisi.giacenza.quantita(prodotto.unita))
                .font(.body.monospacedDigit())
                .foregroundStyle(prodotto.sottoScorta ? .red : .secondary)
            if prodotto.sottoScorta {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(.orange)
                    .accessibilityLabel("Sotto scorta")
            }
        }
    }
}

/// Giacenza, consumi, costi e movimenti di un prodotto.
struct ProdottoDettaglioView: View {
    @Environment(\.puoModificare) private var puoModificare
    let prodotto: Prodotto
    @State private var mostraModificaProdotto = false

    var body: some View {
        List {
            SezioniScorta(prodotto: prodotto)
        }
        .ospitaFogli()
        .navigationTitle(prodotto.nome)
        .toolbar {
            if puoModificare {
                ToolbarItem(placement: .primaryAction) {
                    Button("Impostazioni prodotto", systemImage: "slider.horizontal.3") {
                        mostraModificaProdotto = true
                    }
                }
            }
        }
        .sheet(isPresented: $mostraModificaProdotto) {
            ProdottoModificaView(prodotto: prodotto, ordine: prodotto.ordine)
        }
    }
}

/// Sezioni di lista con giacenza, pulsanti per i movimenti, grafici e storico.
/// Usate sia nella scheda prodotto sia dentro le operazioni (pH, ossigeno…).
struct SezioniScorta: View {
    @Environment(\.modelContext) private var contesto
    @Environment(\.puoModificare) private var puoModificare
    let prodotto: Prodotto
    var mostraGrafici = true
    @Environment(PresentatoreFogli.self) private var presentatore: PresentatoreFogli?

    var body: some View {
        let analisi = prodotto.analisi
        Group {
            Section {
                riepilogo(analisi)
            } header: {
                Text("Scorta · \(prodotto.nome)")
            }

            if puoModificare {
                Section {
                    HStack {
                        ForEach(TipoMovimento.allCases) { tipo in
                            Button {
                                presentatore?.apri(.movimento(tipo, prodotto, nil))
                            } label: {
                                VStack(spacing: 4) {
                                    Image(systemName: tipo.icona).font(.title3)
                                    Text(tipo.nome(per: prodotto.categoria))
                                        .font(.caption).lineLimit(2).multilineTextAlignment(.center)
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

            if mostraGrafici && analisi.andamento.count > 1 {
                Section("Andamento giacenza") {
                    Chart(analisi.andamento) { punto in
                        LineMark(x: .value("Data", punto.data), y: .value("Giacenza", punto.valore))
                            .interpolationMethod(.stepEnd)
                        AreaMark(x: .value("Data", punto.data), y: .value("Giacenza", punto.valore))
                            .interpolationMethod(.stepEnd)
                            .foregroundStyle(.tint.opacity(0.15))
                    }
                    .frame(height: 180)
                }
            }

            let acquisti = prodotto.movimentiOrdinati.filter { $0.tipo == .acquisto && $0.costo > 0 }
            if mostraGrafici && !acquisti.isEmpty {
                Section("Spese per mese") {
                    Chart(acquisti) { acquisto in
                        BarMark(x: .value("Mese", acquisto.data, unit: .month),
                                y: .value("Spesa", acquisto.costo))
                    }
                    .chartYAxis {
                        AxisMarks { valore in
                            AxisGridLine()
                            AxisValueLabel {
                                if let euro = valore.as(Double.self) {
                                    Text(euro, format: .currency(code: "EUR").precision(.fractionLength(0)))
                                }
                            }
                        }
                    }
                    .frame(height: 180)
                }
            }

            Section("Acquisti e \(String(localized: TipoMovimento.consumo.nome(per: prodotto.categoria)).lowercased())") {
                if prodotto.movimentiOrdinati.isEmpty {
                    Text("Nessun movimento registrato").foregroundStyle(.secondary)
                }
                ForEach(prodotto.movimentiOrdinati) { movimento in
                    Button {
                        if puoModificare { presentatore?.apri(.movimento(movimento.tipo, prodotto, movimento)) }
                    } label: {
                        RigaMovimento(movimento: movimento, prodotto: prodotto)
                    }
                    .tint(.primary)
                }
                .onDelete { indici in
                    let elenco = prodotto.movimentiOrdinati
                    for indice in indici { contesto.delete(elenco[indice]) }
                }
                .deleteDisabled(!puoModificare)
            }
        }
    }

    @ViewBuilder
    private func riepilogo(_ analisi: AnalisiScorta) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Giacenza attuale")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text(analisi.giacenza.quantita(prodotto.unita))
                .font(.largeTitle.bold().monospacedDigit())
                .foregroundStyle(prodotto.sottoScorta ? .red : .primary)
            if prodotto.sottoScorta {
                Label("Sotto la scorta minima (\(prodotto.scortaMinima.quantita(prodotto.unita)))",
                      systemImage: "exclamationmark.triangle.fill")
                    .font(.subheadline)
                    .foregroundStyle(.orange)
            }
        }
        .padding(.vertical, 4)

        if let data = analisi.dataUltimoMovimento {
            LabeledContent("Ultimo movimento", value: data.formatted(date: .long, time: .omitted))
        }
        if prodotto.mostraPrevisioni {
            if let mensile = analisi.consumoMedioMensile {
                LabeledContent {
                    Text("\(mensile.quantita(prodotto.unita)) al mese")
                } label: {
                    Text("Consumo medio")
                    Text(analisi.consumoImpostato ? "impostato" : "calcolato dai riempimenti")
                }
            }
            if let giorni = analisi.giorniAutonomia,
               let esaurimento = Calendar.current.date(byAdding: .day, value: giorni, to: .now) {
                LabeledContent("Autonomia", value: String(localized: "\(giorni) giorni (fino al \(esaurimento.formatted(date: .abbreviated, time: .omitted)))"))
            }
        }
        LabeledContent("Totale acquistato", value: analisi.totaleAcquistato.quantita(prodotto.unita))
        LabeledContent("Totale consumato", value: analisi.totaleConsumato.quantita(prodotto.unita))
        if analisi.costoTotale > 0 {
            LabeledContent("Spesa totale", value: analisi.costoTotale.euro)
        }
        if let medio = analisi.costoMedioUnitario {
            LabeledContent("Costo medio", value: String(localized: "\(medio.euro) / \(prodotto.unita)"))
        }
    }
}

private struct RigaMovimento: View {
    let movimento: Movimento
    let prodotto: Prodotto
    private var unita: String { prodotto.unita }

    var body: some View {
        HStack {
            Image(systemName: movimento.tipo.icona)
                .foregroundStyle(colore)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(movimento.tipo.nome(per: prodotto.categoria))
                Text(movimento.data, format: .dateTime.day().month(.abbreviated).year())
                    .font(.caption)
                    .foregroundStyle(.secondary)
                let dettagli = [movimento.descrizioneProdotto, movimento.fornitore, movimento.note].filter { !$0.isEmpty }
                if !dettagli.isEmpty {
                    Text(dettagli.joined(separator: " · "))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(testoQuantita)
                    .font(.body.monospacedDigit())
                if movimento.costo > 0 {
                    Text(movimento.costo.euro)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private var testoQuantita: String {
        switch movimento.tipo {
        case .acquisto: "+" + movimento.quantita.quantita(unita)
        case .consumo: "−" + movimento.quantita.quantita(unita)
        case .conteggio: "= " + movimento.quantita.quantita(unita)
        }
    }

    private var colore: Color {
        switch movimento.tipo {
        case .acquisto: .green
        case .consumo: .orange
        case .conteggio: .blue
        }
    }
}

/// Registra un acquisto, un consumo o un conteggio di giacenza.
struct MovimentoModificaView: View {
    @Environment(\.modelContext) private var contesto
    @Environment(\.dismiss) private var chiudi
    let movimento: Movimento?
    let tipo: TipoMovimento
    let prodotto: Prodotto
    @State private var data: Date
    @State private var quantita: Double?
    @State private var prezzoUnitario: Double?
    @State private var fornitore: String
    @State private var descrizioneProdotto: String
    @State private var note: String

    init(movimento: Movimento?, tipo: TipoMovimento, prodotto: Prodotto) {
        self.movimento = movimento
        self.tipo = tipo
        self.prodotto = prodotto
        self.data = movimento?.data ?? .now
        self.quantita = movimento?.quantita
        self.prezzoUnitario = movimento.flatMap { $0.costo == 0 || $0.quantita == 0 ? nil : $0.costo / $0.quantita }
        self.fornitore = movimento?.fornitore ?? ""
        self.descrizioneProdotto = movimento?.descrizioneProdotto ?? ""
        self.note = movimento?.note ?? ""
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    DatePicker("Data", selection: $data, displayedComponents: .date)
                    if tipo == .acquisto {
                        TextField("Prodotto acquistato (nome, marca)", text: $descrizioneProdotto)
                    }
                    CampoNumero(titolo: tipo == .conteggio ? "Quantità presente" : "Quantità",
                                valore: $quantita, unita: prodotto.unita)
                } footer: {
                    switch tipo {
                    case .acquisto: Text("Il carico si aggiunge alla scorta.")
                    case .consumo: Text("La quantità utilizzata (o messa in piscina) viene sottratta dalla scorta.")
                    case .conteggio: Text("Forza la giacenza al valore indicato, ad esempio dopo aver controllato quanto è rimasto davvero. La differenza viene conteggiata come consumo.")
                    }
                }

                if tipo == .acquisto {
                    Section("Acquisto") {
                        CampoNumero(titolo: "Costo al \(prodotto.unita)", valore: $prezzoUnitario, unita: "€")
                        LabeledContent("Costo totale", value: costoTotale.euro)
                            .bold()
                        TextField("Fornitore", text: $fornitore)
                    }
                }

                Section("Note") {
                    TextField(tipo == .acquisto ? "Note (es. liquido o polvere)" : "Note", text: $note, axis: .vertical)
                }
            }
            .navigationTitle(Text(tipo.nome(per: prodotto.categoria)))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla", role: .cancel) { chiudi() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fine", role: .confirm) { salva() }
                        .disabled(quantita == nil)
                }
            }
        }
    }

    private var costoTotale: Double { (quantita ?? 0) * (prezzoUnitario ?? 0) }

    private func salva() {
        let destinazione = movimento ?? Movimento(tipo: tipo)
        if movimento == nil {
            contesto.insert(destinazione)
            destinazione.prodotto = prodotto
        }
        destinazione.data = data
        destinazione.quantita = quantita ?? 0
        destinazione.costo = tipo == .acquisto ? costoTotale : 0
        destinazione.fornitore = tipo == .acquisto ? fornitore : ""
        destinazione.descrizioneProdotto = tipo == .acquisto ? descrizioneProdotto : ""
        destinazione.note = note
        chiudi()
    }
}

/// Nome, unità di misura e scorta minima di un prodotto.
struct ProdottoModificaView: View {
    @Environment(\.modelContext) private var contesto
    @Environment(\.dismiss) private var chiudi
    let prodotto: Prodotto?
    let ordine: Int
    @State private var nome: String
    @State private var categoria: CategoriaProdotto
    @State private var unita: String
    @State private var scortaMinima: Double?
    @State private var consumoMensile: Double?
    @State private var note: String

    init(prodotto: Prodotto?, ordine: Int, categoriaPredefinita: CategoriaProdotto = .altro) {
        self.prodotto = prodotto
        self.ordine = ordine
        self.nome = prodotto?.nome ?? ""
        self.categoria = prodotto?.categoria ?? categoriaPredefinita
        self.unita = prodotto?.unita ?? (categoriaPredefinita == .ph ? "kg" : "pz")
        self.scortaMinima = prodotto.flatMap { $0.scortaMinima == 0 ? nil : $0.scortaMinima }
        self.consumoMensile = prodotto?.consumoMensileFisso
        self.note = prodotto?.note ?? ""
    }

    var body: some View {
        NavigationStack {
            Form {
                TextField("Nome", text: $nome)
                Picker("Categoria", selection: $categoria) {
                    ForEach(CategoriaProdotto.allCases) { voce in
                        Label { Text(voce.nome) } icon: { Image(systemName: voce.icona) }
                            .tag(voce)
                    }
                }
                TextField("Unità di misura (sacchi, kg, l…)", text: $unita)
                Section {
                    CampoNumero(titolo: "Scorta minima", valore: $scortaMinima, unita: unita)
                } footer: {
                    Text("Sotto questa quantità il prodotto viene segnalato.")
                }
                if categoria != .ph {
                    Section {
                        CampoNumero(titolo: "Consumo mensile", valore: $consumoMensile, unita: "\(unita)/mese")
                    } footer: {
                        Text("Facoltativo. Se lo indichi, l'autonomia si calcola come giacenza diviso questo consumo; altrimenti si usa il consumo medio dei riempimenti registrati.")
                    }
                }
                Section("Note") {
                    TextField("Note", text: $note, axis: .vertical)
                }
            }
            .navigationTitle(prodotto == nil ? "Nuovo prodotto" : "Modifica prodotto")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla", role: .cancel) { chiudi() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fine", role: .confirm) { salva() }
                        .disabled(nome.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    private func salva() {
        let destinazione = prodotto ?? Prodotto(nome: nome, categoria: categoria, unita: unita, ordine: ordine)
        if prodotto == nil { contesto.insert(destinazione) }
        destinazione.nome = nome
        destinazione.categoria = categoria
        destinazione.unita = unita
        destinazione.scortaMinima = scortaMinima ?? 0
        destinazione.consumoMensileFisso = (consumoMensile ?? 0) > 0 ? consumoMensile : nil
        destinazione.note = note
        chiudi()
    }
}
