import SwiftUI
import SwiftData

/// Pagina di manutenzione di un sistema: avvisi, operazioni, manutenzioni periodiche e contratti.
struct SistemaManutenzioneView: View {
    @Environment(\.modelContext) private var contesto
    @Environment(\.puoModificare) private var puoModificare
    let sezione: Sezione
    @Query(sort: \ProcessoAcqua.dataInizio, order: .reverse, animation: .default) private var processi: [ProcessoAcqua]
    @Query(sort: \Prodotto.ordine, animation: .default) private var tuttiIProdotti: [Prodotto]
    @State private var mostraNuovaOperazione = false
    @State private var mostraNuovaAttivita = false

    var body: some View {
        List {
            let avvisi = StatoCasa.avvisi(
                attivita: sezione.attivita ?? [], contratti: sezione.contratti ?? [],
                operazioni: sezione.operazioni ?? [],
                prodotti: prodottiDelSistema,
                processi: haCambioAcqua ? processi : []
            )
            if !avvisi.isEmpty {
                Section("Avvisi") {
                    ForEach(avvisi) { RigaAvviso(avviso: $0) }
                }
            }

            Section("Operazioni") {
                if sezione.operazioniOrdinate.isEmpty {
                    Text("Nessuna operazione per questo sistema").foregroundStyle(.secondary)
                }
                ForEach(sezione.operazioniOrdinate) { operazione in
                    NavigationLink {
                        OperazioneView(operazione: operazione)
                    } label: {
                        RigaOperazione(operazione: operazione, processi: processi)
                    }
                }
                .onMove(perform: spostaOperazioni)
                .moveDisabled(!puoModificare)
            }

            let attivita = (sezione.attivita ?? []).sorted { $0.prossimaScadenza < $1.prossimaScadenza }
            if !attivita.isEmpty {
                Section("Manutenzioni periodiche") {
                    ForEach(attivita) { voce in
                        NavigationLink {
                            AttivitaDettaglioView(attivita: voce)
                        } label: {
                            RigaAttivita(attivita: voce)
                        }
                    }
                }
            }

            if let contratti = sezione.contratti, !contratti.isEmpty {
                Section("Contratti") {
                    ForEach(contratti) { contratto in
                        NavigationLink {
                            ContrattoDettaglioView(contratto: contratto)
                        } label: {
                            RigaContratto(contratto: contratto)
                        }
                    }
                }
            }
        }
        .navigationTitle(sezione.nome)
        .toolbar {
            if puoModificare {
                ToolbarItem(placement: .primaryAction) {
                    Menu("Aggiungi", systemImage: "plus") {
                        Button("Nuova operazione", systemImage: "checklist") { mostraNuovaOperazione = true }
                        Button("Nuova manutenzione periodica", systemImage: "calendar.badge.plus") {
                            mostraNuovaAttivita = true
                        }
                    }
                }
            }
        }
        .sheet(isPresented: $mostraNuovaOperazione) {
            OperazioneModificaView(operazione: nil, sezione: sezione)
        }
        .sheet(isPresented: $mostraNuovaAttivita) {
            AttivitaModificaView(attivita: nil, sezionePredefinita: sezione)
        }
    }

    /// Prodotti collegati alle operazioni; per il pH tutti i prodotti della categoria.
    private var prodottiDelSistema: [Prodotto] {
        var elenco = (sezione.operazioni ?? []).compactMap(\.prodotto)
        if sezione.operazioni?.contains(where: { $0.tipo == .ph }) ?? false {
            elenco += tuttiIProdotti.filter { $0.categoria == .ph && !elenco.contains($0) }
        }
        return elenco
    }

    private var haCambioAcqua: Bool {
        sezione.operazioni?.contains { $0.tipo == .cambioAcqua } ?? false
    }

    private func spostaOperazioni(da origine: IndexSet, a destinazione: Int) {
        var elenco = sezione.operazioniOrdinate
        elenco.move(fromOffsets: origine, toOffset: destinazione)
        for (indice, voce) in elenco.enumerated() { voce.ordine = indice }
    }
}

/// Riga di un'operazione con un riassunto dei suoi dati live.
struct RigaOperazione: View {
    let operazione: Operazione
    let processi: [ProcessoAcqua]
    @Query(sort: \MisuraPH.data, order: .reverse, animation: .default) private var misure: [MisuraPH]
    @Query(sort: \CaricoPellet.data, order: .reverse, animation: .default) private var carichi: [CaricoPellet]
    @Query(sort: \SvuotamentoCeneri.data, order: .reverse, animation: .default) private var svuotamenti: [SvuotamentoCeneri]

    var body: some View {
        HStack(spacing: 12) {
            IconaQuadrata(simbolo: operazione.tipo.icona, colore: coloreIcona, dimensione: 32)
                .animation(.default, value: coloreIcona)
            VStack(alignment: .leading, spacing: 2) {
                Text(operazione.titolo)
                if !riepilogo.isEmpty {
                    Text(riepilogo)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 2)
    }

    private var coloreIcona: Color {
        if operazione.prodotto?.sottoScorta == true { return .red }
        return switch operazione.statoAllarme {
        case .scaduta: .red
        case .inScadenza: .orange
        default: operazione.tipo == .cambioAcqua && processi.contains(where: \.inCorso) ? .blue
            : operazione.sezione?.colore ?? .accentColor
        }
    }

    private var riepilogo: String {
        var parti: [String] = []
        switch operazione.tipo {
        case .ph:
            if let media = misure.first?.media {
                parti.append(String(localized: "pH \(media.formatted(.number.precision(.fractionLength(1))))"))
            }
        case .ossigeno:
            if let ultimo = operazione.ultimoRiempimento {
                let giorni = ultimo.giorniTrascorsi
                parti.append(String(localized: "Ultimo riempimento \(giorni) giorni fa"))
            }
        case .cambioAcqua:
            if let inCorso = processi.first(where: \.inCorso) {
                parti.append(String(localized: "\(String(localized: inCorso.tipo.nome)) in corso"))
            } else if let ultimo = processi.first {
                parti.append(String(localized: "Ultimo il \(ultimo.dataInizio.formatted(date: .abbreviated, time: .omitted))"))
            }
        case .pellet:
            if let ultimo = carichi.first {
                parti.append(String(localized: "Ultimo carico il \(ultimo.data.formatted(date: .abbreviated, time: .omitted)) · \(SezioniPellet.quintali(ultimo.quintali))"))
            }
        case .ceneri:
            if let ultimo = svuotamenti.first {
                parti.append(String(localized: "Ultimo svuotamento \(ultimo.data.giorniTrascorsi) giorni fa"))
            }
        case .storicoManutenzioni:
            if let ultima = operazione.ultimoIntervento {
                parti.append(String(localized: "Ultima il \(ultima.formatted(date: .abbreviated, time: .omitted))"))
            } else {
                parti.append(String(localized: "Nessuna manutenzione registrata"))
            }
        case .generica:
            if !operazione.passaggi.isEmpty { parti.append(String(localized: "\(operazione.passaggi.count) passaggi")) }
        }
        if let prodotto = operazione.prodotto {
            parti.append(String(localized: "scorta \(prodotto.analisi.giacenza.quantita(prodotto.unita))"))
        }
        return parti.joined(separator: " · ")
    }
}

#Preview("Piscina con dati di esempio") {
    let container = Modelli.anteprima()
    let contesto = container.mainContext
    UserDefaults.standard.removeObject(forKey: "operazioniPiscinaCreate")
    DatiIniziali.creaSeNecessario(in: contesto)
    UserDefaults.standard.removeObject(forKey: "operazioniPiscinaCreate")
    let sezioni = (try? contesto.fetch(FetchDescriptor<Sezione>())) ?? []
    let piscina = sezioni.first { $0.nome == "Piscina" }
    if let ossigeno = piscina?.operazioniOrdinate.first(where: { $0.tipo == .ossigeno })?.prodotto {
        let riempimento = Movimento(tipo: .consumo, data: .now.addingTimeInterval(-19 * 86_400), quantita: 1)
        riempimento.prodotto = ossigeno
        contesto.insert(riempimento)
    }
    let misura = MisuraPH(data: .now.addingTimeInterval(-86_400))
    misura.valoreStrumento1 = 7.4
    misura.valoreStrumento2 = 7.5
    contesto.insert(misura)
    let processo = ProcessoAcqua(tipo: .svuotamento, dataInizio: .now.addingTimeInterval(-5400))
    processo.livelloIniziale = 12
    contesto.insert(processo)
    return NavigationStack {
        if let piscina { SistemaManutenzioneView(sezione: piscina) }
    }
    .modelContainer(container)
}
