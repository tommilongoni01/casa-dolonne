import SwiftUI
import SwiftData

/// Pagine raggiungibili dalla colonna laterale della manutenzione.
enum PaginaManutenzione: Hashable {
    case sistema(Sezione)
    case attivita(AttivitaManutenzione)
    case contratto(Contratto)
    case operazione(Operazione)
    case prodotto(Prodotto)
    case processo(ProcessoAcqua)
    case tutteLeAttivita
    case tuttiIContratti
    case tuttiIProdotti
}

extension Avviso {
    var pagina: PaginaManutenzione {
        switch destinazione {
        case .attivita(let voce): .attivita(voce)
        case .contratto(let voce): .contratto(voce)
        case .operazione(let voce): .operazione(voce)
        case .prodotto(let voce): .prodotto(voce)
        case .processo(let voce): .processo(voce)
        }
    }
}

/// Home della manutenzione: in alto lo stato generale della casa, sotto i sistemi.
/// Su iPad è una vista divisa (elenco a sinistra, pagina selezionata a destra);
/// su iPhone si comprime nella normale navigazione a schede.
struct ManutenzioneHomeView: View {
    @Query(sort: \Sezione.ordine, animation: .default) private var sezioni: [Sezione]
    @Query(animation: .default) private var attivita: [AttivitaManutenzione]
    @Query(animation: .default) private var contratti: [Contratto]
    @Query(animation: .default) private var operazioni: [Operazione]
    @Query(sort: \Prodotto.ordine, animation: .default) private var prodotti: [Prodotto]
    @Query(animation: .default) private var processi: [ProcessoAcqua]
    @State private var selezione: PaginaManutenzione?

    var body: some View {
        let avvisi = StatoCasa.avvisi(attivita: attivita, contratti: contratti, operazioni: operazioni,
                                      prodotti: prodotti, processi: processi)
        let prossime = StatoCasa.prossime(attivita: attivita, contratti: contratti, operazioni: operazioni)

        NavigationSplitView {
            List(selection: $selezione) {
                // MARK: Stato della casa
                Section {
                    RiepilogoStato(avvisi: avvisi, prossime: prossime.count)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }

                Section("Avvisi") {
                    if avvisi.isEmpty {
                        Label("Tutto in regola", systemImage: "checkmark.seal.fill")
                            .foregroundStyle(.green)
                            .symbolEffect(.bounce, value: avvisi.isEmpty)
                    }
                    ForEach(avvisi) { avviso in
                        NavigationLink(value: avviso.pagina) { EtichettaAvviso(avviso: avviso) }
                    }
                }

                if !prossime.isEmpty {
                    Section("Prossimi \(StatoCasa.orizzonteGiorni) giorni") {
                        ForEach(prossime) { avviso in
                            NavigationLink(value: avviso.pagina) { EtichettaAvviso(avviso: avviso) }
                        }
                    }
                }

                // MARK: Sistemi
                Section("Sistemi") {
                    ForEach(sezioni) { sezione in
                        NavigationLink(value: PaginaManutenzione.sistema(sezione)) {
                            RigaSistema(sezione: sezione, avvisi: avvisi.filter {
                                $0.sezione?.persistentModelID == sezione.persistentModelID
                            }.count)
                        }
                    }
                }

                Section("Archivio") {
                    NavigationLink(value: PaginaManutenzione.tutteLeAttivita) {
                        LabeledContent {
                            Text("\(attivita.count)")
                        } label: {
                            Label("Manutenzioni periodiche", systemImage: "wrench.and.screwdriver")
                        }
                    }
                    NavigationLink(value: PaginaManutenzione.tuttiIContratti) {
                        LabeledContent {
                            Text("\(contratti.count)")
                        } label: {
                            Label("Contratti", systemImage: "doc.text")
                        }
                    }
                    NavigationLink(value: PaginaManutenzione.tuttiIProdotti) {
                        Label("Prodotti a scorta", systemImage: "shippingbox")
                    }
                }
            }
            .animation(.default, value: avvisi.map(\.id))
            .navigationTitle("Manutenzione")
            .navigationSplitViewColumnWidth(min: 320, ideal: 380, max: 460)
        } detail: {
            NavigationStack {
                if let selezione, esiste(selezione) {
                    pagina(selezione)
                } else {
                    ContentUnavailableView("Seleziona un sistema", systemImage: "house",
                                           description: Text("Scegli un sistema o un avviso dall'elenco."))
                }
            }
            .id(selezione)
        }
    }

    @ViewBuilder
    private func pagina(_ pagina: PaginaManutenzione) -> some View {
        switch pagina {
        case .sistema(let voce): SistemaManutenzioneView(sezione: voce)
        case .attivita(let voce): AttivitaDettaglioView(attivita: voce)
        case .contratto(let voce): ContrattoDettaglioView(contratto: voce)
        case .operazione(let voce): OperazioneView(operazione: voce)
        case .prodotto(let voce): ProdottoDettaglioView(prodotto: voce)
        case .processo(let voce): ProcessoAcquaView(processo: voce)
        case .tutteLeAttivita: AttivitaListaView()
        case .tuttiIContratti: ContrattiListaView()
        case .tuttiIProdotti: ProdottiListaView()
        }
    }

    /// Evita di mostrare un elemento appena eliminato.
    private func esiste(_ pagina: PaginaManutenzione) -> Bool {
        switch pagina {
        case .sistema(let voce): sezioni.contains(voce)
        case .attivita(let voce): attivita.contains(voce)
        case .contratto(let voce): contratti.contains(voce)
        case .operazione(let voce): operazioni.contains(voce)
        case .prodotto(let voce): prodotti.contains(voce)
        case .processo(let voce): processi.contains(voce)
        case .tutteLeAttivita, .tuttiIContratti, .tuttiIProdotti: true
        }
    }
}

/// Tre contatori in alto: scaduti, in scadenza / in corso, prossimi.
private struct RiepilogoStato: View {
    let avvisi: [Avviso]
    let prossime: Int

    var body: some View {
        HStack(spacing: 10) {
            contatore(avvisi.filter { $0.gravita == .scaduto }.count, titolo: "Da fare subito", colore: .red,
                      icona: "exclamationmark.triangle.fill")
            contatore(avvisi.filter { $0.gravita == .inScadenza || $0.gravita == .inCorso }.count,
                      titolo: "In scadenza / in corso", colore: .orange, icona: "clock.fill")
            contatore(prossime, titolo: "In arrivo", colore: .blue, icona: "calendar")
        }
    }

    private func contatore(_ valore: Int, titolo: LocalizedStringKey, colore: Color, icona: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: icona)
                .foregroundStyle(valore > 0 ? colore : .secondary)
            Text("\(valore)")
                .font(.title.bold().monospacedDigit())
                .contentTransition(.numericText(value: Double(valore)))
                .animation(.snappy, value: valore)
            Text(titolo)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2, reservesSpace: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 14))
    }
}

private struct RigaSistema: View {
    let sezione: Sezione
    let avvisi: Int

    var body: some View {
        HStack(spacing: 14) {
            IconaQuadrata(simbolo: sezione.icona, colore: sezione.colore, dimensione: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text(sezione.nome)
                Text(riepilogo)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if avvisi > 0 {
                Text("\(avvisi)")
                    .font(.caption.bold())
                    .foregroundStyle(.white)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(.red, in: .capsule)
                    .accessibilityLabel("\(avvisi) avvisi")
            }
        }
        .padding(.vertical, 2)
    }

    private var riepilogo: String {
        let operazioni = sezione.operazioni?.count ?? 0
        let attivita = sezione.attivita?.count ?? 0
        if operazioni == 0 && attivita == 0 { return String(localized: "Nessuna operazione") }
        var parti: [String] = []
        if operazioni > 0 {
            parti.append(operazioni == 1 ? String(localized: "1 operazione") : String(localized: "\(operazioni) operazioni"))
        }
        if attivita > 0 {
            parti.append(attivita == 1 ? String(localized: "1 manutenzione") : String(localized: "\(attivita) manutenzioni"))
        }
        return parti.joined(separator: " · ")
    }
}

/// Riga di un avviso che porta alla schermata corrispondente (usata dentro le pagine di dettaglio).
struct RigaAvviso: View {
    let avviso: Avviso

    var body: some View {
        NavigationLink {
            switch avviso.destinazione {
            case .attivita(let voce): AttivitaDettaglioView(attivita: voce)
            case .contratto(let voce): ContrattoDettaglioView(contratto: voce)
            case .operazione(let voce): OperazioneView(operazione: voce)
            case .prodotto(let voce): ProdottoDettaglioView(prodotto: voce)
            case .processo(let voce): ProcessoAcquaView(processo: voce)
            }
        } label: {
            EtichettaAvviso(avviso: avviso)
        }
    }
}

/// Contenuto della riga di un avviso: icona colorata, testi e scadenza.
struct EtichettaAvviso: View {
    let avviso: Avviso

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: avviso.icona)
                .font(.body.weight(.semibold))
                .foregroundStyle(colore)
                .frame(width: 26)
            VStack(alignment: .leading, spacing: 2) {
                Text(avviso.titolo)
                if !avviso.dettaglio.isEmpty {
                    Text(avviso.dettaglio)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 8)
            if avviso.gravita == .inCorso, let data = avviso.data {
                Text(data, style: .timer)
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.blue)
            } else if let data = avviso.data {
                BadgeScadenza(data: data, stato: stato)
            }
        }
    }

    private var colore: Color {
        switch avviso.gravita {
        case .scaduto: .red
        case .inScadenza: .orange
        case .inCorso: .blue
        case .informazione: .secondary
        }
    }

    private var stato: StatoScadenza {
        switch avviso.gravita {
        case .scaduto: .scaduta
        case .inScadenza, .inCorso: .inScadenza
        case .informazione: .ok
        }
    }
}
