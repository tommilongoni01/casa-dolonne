import SwiftUI
import SwiftData

/// Notifiche dell'operazione, modificabili direttamente nella scheda:
/// allarme dopo l'ultimo riempimento, scorta bassa e periodicità delle tipologie di manutenzione.
struct SezioneNotificheOperazione: View {
    @Environment(\.puoModificare) private var puoModificare
    @Bindable var operazione: Operazione

    var body: some View {
        Section {
            if let prodotto = operazione.prodotto {
                ImpostazioniScorta(operazione: operazione, prodotto: prodotto)
            }

            if operazione.tipo == .storicoManutenzioni {
                ImpostazioniTipologie(operazione: operazione)
            }

            if operazione.prodotto == nil && operazione.tipo != .storicoManutenzioni {
                Text(operazione.tipo == .ph ? "La scorta minima si imposta nella scheda di ogni prodotto pH."
                                            : "Nessuna notifica")
                    .foregroundStyle(.secondary)
            }
        } header: {
            Text("Notifiche")
        } footer: {
            if operazione.tipo == .storicoManutenzioni {
                Text("Ogni tipologia ha la sua scadenza, calcolata dall'ultimo intervento dello stesso tipo. Ricevi una notifica 14 giorni prima e il giorno stesso. Con 0 mesi non c'è avviso.")
            } else if operazione.prodotto != nil {
                Text("Le notifiche arrivano alle 9:00.")
            }
        }
        .disabled(!puoModificare)
    }
}

/// Allarme dopo l'ultimo riempimento e avviso di scorta bassa.
private struct ImpostazioniScorta: View {
    @Bindable var operazione: Operazione
    @Bindable var prodotto: Prodotto

    var body: some View {
        Toggle("Allarme dopo l'ultimo riempimento", isOn: allarmeAttivo.animation())
        if operazione.giorniAllarme > 0 {
            Stepper(value: $operazione.giorniAllarme, in: 1...365) {
                LabeledContent("Dopo", value: String(localized: "\(operazione.giorniAllarme) giorni"))
            }
            if let data = operazione.allarmi.first(where: { $0.id == "riempimento" })?.data {
                LabeledContent("Prossimo allarme", value: data.formatted(date: .long, time: .omitted))
            } else {
                Text("Registra un riempimento per attivare l'allarme.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }

        Toggle("Avviso scorta bassa", isOn: scortaAttiva.animation())
        if prodotto.scortaMinima > 0 {
            CampoNumero(titolo: "Sotto", valore: soglia, unita: prodotto.unita)
                .foregroundStyle(prodotto.sottoScorta ? .red : .primary)
        }
    }

    private var allarmeAttivo: Binding<Bool> {
        Binding { operazione.giorniAllarme > 0 } set: { operazione.giorniAllarme = $0 ? 20 : 0 }
    }

    private var scortaAttiva: Binding<Bool> {
        Binding { prodotto.scortaMinima > 0 } set: { prodotto.scortaMinima = $0 ? 50 : 0 }
    }

    private var soglia: Binding<Double?> {
        Binding { prodotto.scortaMinima > 0 ? prodotto.scortaMinima : nil } set: { prodotto.scortaMinima = max(0, $0 ?? 0) }
    }
}

/// Periodicità di ogni tipologia di manutenzione, con aggiunta e rinomina.
private struct ImpostazioniTipologie: View {
    @Environment(\.modelContext) private var contesto
    let operazione: Operazione
    @State private var nuovoNome = ""
    @State private var mostraNuova = false
    @State private var daRinominare: TipologiaIntervento?
    @State private var nomeModificato = ""

    var body: some View {
        ForEach(operazione.tipologieOrdinate) { tipologia in
            RigaPeriodicita(tipologia: tipologia)
                .contextMenu {
                    Button("Rinomina", systemImage: "pencil") {
                        nomeModificato = tipologia.nome
                        daRinominare = tipologia
                    }
                    if (tipologia.interventi ?? []).isEmpty {
                        Button("Elimina tipologia", systemImage: "trash", role: .destructive) {
                            contesto.delete(tipologia)
                        }
                    }
                }
        }
        Button("Aggiungi tipologia", systemImage: "plus") {
            nuovoNome = ""
            mostraNuova = true
        }
        .alert("Nuova tipologia", isPresented: $mostraNuova) {
            TextField("Nome (es. Verifica periodica)", text: $nuovoNome)
            Button("Annulla", role: .cancel) {}
            Button("Aggiungi") { aggiungi() }
        } message: {
            Text("Dopo averla aggiunta imposti ogni quanti mesi va fatta.")
        }
        .alert("Rinomina tipologia", isPresented: Binding {
            daRinominare != nil
        } set: { if !$0 { daRinominare = nil } }) {
            TextField("Nome", text: $nomeModificato)
            Button("Annulla", role: .cancel) {}
            Button("Salva") {
                let nome = nomeModificato.trimmingCharacters(in: .whitespaces)
                if !nome.isEmpty { daRinominare?.nome = nome }
            }
        }
    }

    private func aggiungi() {
        let nome = nuovoNome.trimmingCharacters(in: .whitespaces)
        guard !nome.isEmpty else { return }
        let tipologia = TipologiaIntervento(nome: nome, mesiAvviso: 12,
                                            ordine: (operazione.tipologieOrdinate.last?.ordine ?? -1) + 1)
        contesto.insert(tipologia)
        tipologia.operazione = operazione
    }
}

private struct RigaPeriodicita: View {
    @Bindable var tipologia: TipologiaIntervento

    var body: some View {
        Stepper(value: $tipologia.mesiAvviso, in: 0...120) {
            VStack(alignment: .leading, spacing: 2) {
                Text(tipologia.nome)
                Text(tipologia.mesiAvviso == 0 ? String(localized: "Nessun avviso")
                     : String(localized: "Ogni \(tipologia.mesiAvviso) mesi"))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .contentTransition(.numericText())
            }
        }
    }
}

/// Collegamento alla guida del manuale: si sceglie toccando la riga.
struct SezioneManualeOperazione: View {
    @Environment(\.puoModificare) private var puoModificare
    @Query(sort: \Sezione.ordine) private var sezioni: [Sezione]
    @Bindable var operazione: Operazione

    var body: some View {
        Section("Manuale") {
            if let guida = operazione.guida {
                NavigationLink {
                    GuidaView(guida: guida)
                } label: {
                    Label(guida.titolo, systemImage: "book.fill")
                }
            }
            if puoModificare {
                Picker(selection: $operazione.guida) {
                    Text("Nessuna").tag(Guida?.none)
                    ForEach(sezioni) { voce in
                        if !voce.guideOrdinate.isEmpty {
                            Section(voce.nome) {
                                ForEach(voce.guideOrdinate) { Text($0.titolo).tag(Optional($0)) }
                            }
                        }
                    }
                } label: {
                    Label(operazione.guida == nil ? "Collega una guida" : "Cambia guida", systemImage: "link")
                }
                .pickerStyle(.navigationLink)
            } else if operazione.guida == nil {
                Label("Nessuna guida collegata", systemImage: "book")
                    .foregroundStyle(.secondary)
            }
        }
    }
}

/// Pannello che si apre toccando il riquadro della descrizione.
struct DescrizioneOperazioneView: View {
    @Environment(\.dismiss) private var chiudi
    let operazione: Operazione
    @State private var descrizione: String
    @State private var passaggi: [String]
    @State private var note: String

    init(operazione: Operazione) {
        self.operazione = operazione
        self.descrizione = operazione.descrizione
        self.passaggi = operazione.passaggi
        self.note = operazione.note
    }

    var body: some View {
        NavigationStack {
            Form {
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
                    Button("Aggiungi passaggio", systemImage: "plus") {
                        withAnimation { passaggi.append("") }
                    }
                } header: {
                    Text("Passaggi")
                } footer: {
                    Text("Scorri verso sinistra per eliminare un passaggio, tieni premuto per spostarlo.")
                }

                Section("Note") {
                    TextField("Note sull'impianto, codici, riferimenti…", text: $note, axis: .vertical)
                        .lineLimit(3...)
                }
            }
            .navigationTitle(operazione.titolo)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla", role: .cancel) { chiudi() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fine", role: .confirm) {
                        operazione.descrizione = descrizione.trimmingCharacters(in: .whitespacesAndNewlines)
                        operazione.passaggi = passaggi
                            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                            .filter { !$0.isEmpty }
                        operazione.note = note.trimmingCharacters(in: .whitespacesAndNewlines)
                        chiudi()
                    }
                }
            }
        }
    }
}

#Preview("Ossigeno modificabile") {
    let container = Modelli.anteprima()
    let contesto = container.mainContext
    let prodotto = Prodotto(nome: "Ossigeno attivo", categoria: .ossigeno, unita: "l")
    prodotto.scortaMinima = 50
    contesto.insert(prodotto)
    let acquisto = Movimento(tipo: .acquisto, data: .now.addingTimeInterval(-40 * 86_400), quantita: 100)
    acquisto.costo = 400
    acquisto.prodotto = prodotto
    contesto.insert(acquisto)
    let riempimento = Movimento(tipo: .consumo, data: .now.addingTimeInterval(-5 * 86_400), quantita: 10)
    riempimento.prodotto = prodotto
    contesto.insert(riempimento)
    let operazione = Operazione(titolo: "Ossigeno", tipo: .ossigeno, sezione: nil)
    operazione.prodotto = prodotto
    operazione.giorniAllarme = 20
    contesto.insert(operazione)
    return NavigationStack { OperazioneView(operazione: operazione) }
        .modelContainer(container)
}
