import SwiftUI
import SwiftData

/// Scheda di un'operazione: descrizione e passaggi, notifiche, dati live e guida del manuale.
struct OperazioneView: View {
    @Environment(\.modelContext) private var contesto
    @Environment(\.puoModificare) private var puoModificare
    let operazione: Operazione
    @State private var mostraDescrizione = false

    var body: some View {
        List {
            descrizione

            let allarmiAttivi = operazione.allarmi.filter { $0.stato != .ok }
            if !allarmiAttivi.isEmpty {
                Section {
                    ForEach(allarmiAttivi) { allarme in
                        Label {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(allarme.stato == .scaduta
                                     ? "\(allarme.titolo): da fare"
                                     : "\(allarme.titolo): entro il \(allarme.data.formatted(date: .long, time: .omitted))")
                                Text(allarme.dettaglio)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        } icon: {
                            Image(systemName: "bell.badge.fill")
                        }
                        .foregroundStyle(allarme.stato == .scaduta ? .red : .orange)
                    }
                }
            }

            if let prodotto = operazione.prodotto, prodotto.sottoScorta {
                Section {
                    Label("Scorta sotto \(prodotto.scortaMinima.quantita(prodotto.unita)): restano circa \(prodotto.analisi.giacenza.quantita(prodotto.unita))",
                          systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(.red)
                }
            }

            datiLive

            SezioneNotificheOperazione(operazione: operazione)

            SezioneManualeOperazione(operazione: operazione)
        }
        .ospitaFogli()
        .navigationTitle(operazione.titolo)
        .onDisappear {
            // Le impostazioni degli allarmi si modificano direttamente nella scheda:
            // all'uscita si riallineano le notifiche.
            Task { await Notifiche.aggiorna(contesto: contesto) }
        }
        .sheet(isPresented: $mostraDescrizione) {
            DescrizioneOperazioneView(operazione: operazione)
        }
    }

    /// Riquadro della descrizione: toccandolo si aprono descrizione, passaggi e note.
    private var descrizione: some View {
        Section {
            Button {
                if puoModificare { mostraDescrizione = true }
            } label: {
                VStack(alignment: .leading, spacing: 10) {
                    if operazione.descrizione.isEmpty && operazione.passaggi.isEmpty {
                        Label(puoModificare ? "Tocca per aggiungere una breve descrizione e i passaggi"
                                            : "Nessuna descrizione",
                              systemImage: puoModificare ? "square.and.pencil" : "text.alignleft")
                            .foregroundStyle(.secondary)
                    }
                    if !operazione.descrizione.isEmpty {
                        Text(operazione.descrizione)
                            .foregroundStyle(.primary)
                    }
                    ForEach(Array(operazione.passaggi.enumerated()), id: \.offset) { indice, passaggio in
                        HStack(alignment: .firstTextBaseline, spacing: 10) {
                            Text("\(indice + 1)")
                                .font(.caption.bold().monospacedDigit())
                                .foregroundStyle(.white)
                                .frame(width: 22, height: 22)
                                .background(Color.accentColor, in: .circle)
                            Text(passaggio)
                                .foregroundStyle(.primary)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .disabled(!puoModificare)
        } header: {
            HStack {
                Text("Descrizione")
                Spacer()
                if puoModificare && !(operazione.descrizione.isEmpty && operazione.passaggi.isEmpty) {
                    Image(systemName: "square.and.pencil")
                        .foregroundStyle(.tint)
                        .accessibilityLabel("Modifica descrizione")
                }
            }
        }
    }

    @ViewBuilder
    private var datiLive: some View {
        switch operazione.tipo {
        case .ph:
            SezioniMisurePH()
            SezioniProdottiPH()
        case .ossigeno:
            sezioneScorta
        case .cambioAcqua:
            SezioniProcessiAcqua()
        case .pellet:
            SezioniPellet()
        case .ceneri:
            SezioniCeneri()
        case .storicoManutenzioni:
            SezioniStorico(operazione: operazione)
        case .generica:
            EmptyView()
        }
    }

    @ViewBuilder
    private var sezioneScorta: some View {
        if let prodotto = operazione.prodotto {
            SezioniScorta(prodotto: prodotto, mostraGrafici: false)
            Section {
                NavigationLink("Grafici e dettaglio scorta") {
                    ProdottoDettaglioView(prodotto: prodotto)
                }
            }
        } else {
            Section("Scorta") {
                Text("Nessun prodotto collegato. Collegalo da Modifica.")
                    .foregroundStyle(.secondary)
            }
        }
    }
}

/// Crea o modifica un'operazione: testi, passaggi, prodotto, allarme e guida collegata.
/// Copia di lavoro di una tipologia di manutenzione durante la modifica.
private struct BozzaTipologia: Identifiable {
    let id = UUID()
    var esistente: TipologiaIntervento?
    var nome: String
    var mesi: Int
}

struct OperazioneModificaView: View {
    @Environment(\.modelContext) private var contesto
    @Environment(\.dismiss) private var chiudi
    @Query(sort: \Prodotto.ordine, animation: .default) private var prodotti: [Prodotto]
    @Query(sort: \Sezione.ordine, animation: .default) private var sezioni: [Sezione]

    let operazione: Operazione?
    let sezione: Sezione?
    /// Chiamato prima dell'eliminazione, per chiudere la scheda dell'operazione.
    var alEliminare: () -> Void = {}
    @State private var titolo: String
    @State private var descrizione: String
    @State private var passaggi: [String]
    @State private var prodotto: Prodotto?
    @State private var allarmeAttivo: Bool
    @State private var giorniAllarme: Int
    @State private var guida: Guida?
    @State private var avvisoScorta: Bool
    @State private var sogliaScorta: Double?
    @State private var tipologie: [BozzaTipologia]
    @State private var note: String
    @State private var confermaEliminazione = false

    init(operazione: Operazione?, sezione: Sezione?, alEliminare: @escaping () -> Void = {}) {
        self.operazione = operazione
        self.sezione = sezione
        self.alEliminare = alEliminare
        self.titolo = operazione?.titolo ?? ""
        self.descrizione = operazione?.descrizione ?? ""
        self.passaggi = operazione?.passaggi ?? []
        self.prodotto = operazione?.prodotto
        self.allarmeAttivo = (operazione?.giorniAllarme ?? 0) > 0
        self.giorniAllarme = max(operazione?.giorniAllarme ?? 0, 20)
        self.guida = operazione?.guida
        self.tipologie = (operazione?.tipologieOrdinate ?? []).map {
            BozzaTipologia(esistente: $0, nome: $0.nome, mesi: $0.mesiAvviso)
        }
        self.note = operazione?.note ?? ""
        let soglia = operazione?.prodotto?.scortaMinima ?? 0
        self.avvisoScorta = soglia > 0
        self.sogliaScorta = soglia > 0 ? soglia : nil
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Titolo", text: $titolo)
                }

                Section("Descrizione breve") {
                    TextField("A cosa serve, quando va fatta…", text: $descrizione, axis: .vertical)
                        .lineLimit(2...)
                }

                Section {
                    ForEach(passaggi.indices, id: \.self) { indice in
                        HStack(alignment: .firstTextBaseline) {
                            Text("\(indice + 1).")
                                .foregroundStyle(.secondary)
                                .monospacedDigit()
                            TextField("Passaggio", text: $passaggi[indice], axis: .vertical)
                        }
                    }
                    .onDelete { passaggi.remove(atOffsets: $0) }
                    .onMove { passaggi.move(fromOffsets: $0, toOffset: $1) }
                    Button("Aggiungi passaggio", systemImage: "plus") { passaggi.append("") }
                } header: {
                    Text("Passaggi")
                } footer: {
                    Text("Scorri verso sinistra per eliminare un passaggio, tieni premuto per spostarlo.")
                }

                if operazione?.tipo == .storicoManutenzioni {
                    Section {
                        ForEach($tipologie) { $voce in
                            VStack(alignment: .leading, spacing: 6) {
                                TextField("Nome (es. Verifica periodica)", text: $voce.nome)
                                    .font(.body.weight(.medium))
                                Stepper(value: $voce.mesi, in: 0...120) {
                                    Text(voce.mesi == 0 ? "Nessun avviso" : "Avviso ogni \(voce.mesi) mesi")
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .padding(.vertical, 2)
                        }
                        .onDelete { tipologie.remove(atOffsets: $0) }
                        .onMove { tipologie.move(fromOffsets: $0, toOffset: $1) }
                        Button("Aggiungi tipologia", systemImage: "plus") {
                            tipologie.append(BozzaTipologia(nome: "", mesi: 12))
                        }
                    } header: {
                        Text("Tipologie di manutenzione")
                    } footer: {
                        Text("Ogni tipologia ha la sua scadenza, calcolata dall'ultimo intervento dello stesso tipo. Con 0 mesi non c'è avviso (es. manutenzioni fatte da noi).")
                    }
                }

                if operazione?.tipo.usaProdotto ?? true {
                    Section {
                        Picker("Prodotto a scorta", selection: $prodotto) {
                            Text("Nessuno").tag(Prodotto?.none)
                            ForEach(prodotti) { Text($0.nome).tag(Optional($0)) }
                        }
                        if prodotto != nil {
                            Toggle("Allarme dopo l'ultimo riempimento", isOn: $allarmeAttivo)
                            if allarmeAttivo {
                                Stepper("Dopo \(giorniAllarme) giorni", value: $giorniAllarme, in: 1...365)
                            }
                            Toggle("Avviso scorta bassa", isOn: $avvisoScorta)
                            if avvisoScorta {
                                CampoNumero(titolo: "Sotto", valore: $sogliaScorta, unita: prodotto?.unita ?? "")
                            }
                        }
                    } header: {
                        Text("Scorta e notifiche")
                    }
                }

                Section("Note") {
                    TextField("Note sull'impianto, codici, riferimenti…", text: $note, axis: .vertical)
                        .lineLimit(3...)
                }

                Section("Manuale") {
                    Picker("Guida collegata", selection: $guida) {
                        Text("Nessuna").tag(Guida?.none)
                        ForEach(sezioni) { voce in
                            if !voce.guideOrdinate.isEmpty {
                                Section(voce.nome) {
                                    ForEach(voce.guideOrdinate) { Text($0.titolo).tag(Optional($0)) }
                                }
                            }
                        }
                    }
                    .pickerStyle(.navigationLink)
                }

                if operazione != nil {
                    Section {
                        Button("Elimina operazione", role: .destructive) { confermaEliminazione = true }
                    }
                }
            }
            .navigationTitle(operazione == nil ? "Nuova operazione" : "Modifica operazione")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla", role: .cancel) { chiudi() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fine", role: .confirm) { salva() }
                        .disabled(titolo.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .confirmationDialog("Eliminare l'operazione e i suoi collegamenti?", isPresented: $confermaEliminazione,
                                titleVisibility: .visible) {
                Button("Elimina", role: .destructive) {
                    chiudi()
                    alEliminare()
                    if let operazione { contesto.delete(operazione) }
                }
            } message: {
                Text("Verrà eliminato anche il suo storico manutenzioni. Scorte, misure, carichi e processi restano salvati.")
            }
        }
    }

    private func salva() {
        let destinazione = operazione ?? Operazione(
            titolo: titolo, tipo: .generica, sezione: sezione,
            ordine: (sezione?.operazioniOrdinate.last?.ordine ?? -1) + 1
        )
        if operazione == nil { contesto.insert(destinazione) }
        destinazione.titolo = titolo
        destinazione.descrizione = descrizione.trimmingCharacters(in: .whitespacesAndNewlines)
        destinazione.passaggi = passaggi
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        destinazione.prodotto = prodotto
        destinazione.giorniAllarme = prodotto != nil && allarmeAttivo ? giorniAllarme : 0
        destinazione.guida = guida
        prodotto?.scortaMinima = avvisoScorta ? (sogliaScorta ?? 0) : 0
        destinazione.note = note.trimmingCharacters(in: .whitespacesAndNewlines)
        if destinazione.tipo == .storicoManutenzioni {
            salvaTipologie(in: destinazione)
        }
        Task { await Notifiche.aggiorna(contesto: contesto) }
        chiudi()
    }

    /// Aggiorna, crea ed elimina le tipologie secondo la bozza.
    private func salvaTipologie(in operazione: Operazione) {
        let valide = tipologie.filter { !$0.nome.trimmingCharacters(in: .whitespaces).isEmpty }
        let mantenute = Set(valide.compactMap { $0.esistente?.persistentModelID })
        for vecchia in operazione.tipologie ?? [] where !mantenute.contains(vecchia.persistentModelID) {
            contesto.delete(vecchia)
        }
        for (indice, voce) in valide.enumerated() {
            let tipologia = voce.esistente ?? {
                let nuova = TipologiaIntervento(nome: voce.nome, mesiAvviso: voce.mesi, ordine: indice)
                contesto.insert(nuova)
                nuova.operazione = operazione
                return nuova
            }()
            tipologia.nome = voce.nome.trimmingCharacters(in: .whitespaces)
            tipologia.mesiAvviso = voce.mesi
            tipologia.ordine = indice
        }
    }
}
