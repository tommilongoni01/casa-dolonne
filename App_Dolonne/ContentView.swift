import SwiftUI
import SwiftData

/// Struttura principale: quattro schede; su iPad ogni scheda è una vista divisa.
struct ContentView: View {
    @Environment(\.modelContext) private var contesto
    @Environment(\.scenePhase) private var faseScena
    @AppStorage(ChiaviImpostazioni.modalitaModifica) private var modalitaModifica = true
    @AppStorage(ChiaviImpostazioni.aspetto) private var aspetto: Aspetto = .automatico

    var body: some View {
        TabView {
            Tab("Manutenzione", systemImage: "wrench.and.screwdriver") {
                ManutenzioneHomeView()
            }
            Tab("Manuale", systemImage: "book") {
                ManualeHomeView()
            }
            Tab("Contatti", systemImage: "person.2") {
                ContattiListaView()
            }
            Tab("Impostazioni", systemImage: "gearshape") {
                ImpostazioniView()
            }
        }
        .environment(\.puoModificare, modalitaModifica)
        .preferredColorScheme(aspetto.schema)
        .task {
            DatiIniziali.creaSeNecessario(in: contesto)
            ImportazioneContenuti.importaSeNecessario(in: contesto)
            ImportazioneContenuti.importaCarichiPellet(in: contesto)
            await Notifiche.richiediPermesso()
        }
        .onChange(of: faseScena) { _, nuovaFase in
            // Le scadenze vengono riallineate ogni volta che l'app torna in primo piano
            // o va in background (quindi anche dopo ogni modifica fatta).
            guard nuovaFase != .inactive else { return }
            Task { await Notifiche.aggiorna(contesto: contesto) }
        }
    }
}

#Preview {
    ContentView()
        .modelContainer(Modelli.anteprima())
}
