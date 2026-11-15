import SwiftUI

struct ImpostazioniView: View {
    @AppStorage(ChiaviImpostazioni.modalitaModifica) private var modalitaModifica = true
    @AppStorage(ChiaviImpostazioni.aspetto) private var aspetto: Aspetto = .automatico

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker(selection: $aspetto) {
                        ForEach(Aspetto.allCases) { Text($0.nome).tag($0) }
                    } label: {
                        Label {
                            Text("Aspetto")
                        } icon: {
                            IconaQuadrata(simbolo: "circle.lefthalf.filled", colore: .indigo)
                        }
                    }
                } footer: {
                    Text("Automatico segue l'impostazione chiaro/scuro del dispositivo.")
                }

                Section {
                    Toggle(isOn: $modalitaModifica.animation()) {
                        Label {
                            Text("Modalità modifica")
                        } icon: {
                            IconaQuadrata(simbolo: "pencil", colore: .orange)
                        }
                    }
                } footer: {
                    Text("Disattivala per consultare l'app in sola lettura, senza rischio di modifiche accidentali.")
                }

                Section {
                    Button {
                        if let url = URL(string: UIApplication.openNotificationSettingsURLString) {
                            UIApplication.shared.open(url)
                        }
                    } label: {
                        Label {
                            Text("Notifiche")
                                .foregroundStyle(.primary)
                        } icon: {
                            IconaQuadrata(simbolo: "bell.badge.fill", colore: .red)
                        }
                    }
                } footer: {
                    Text("Promemoria per scadenze, manutenzioni, riempimenti e scorte basse.")
                }

                Section {
                    LabeledContent("Versione", value: versione)
                }
            }
            .navigationTitle("Impostazioni")
        }
    }

    private var versione: String {
        let info = Bundle.main.infoDictionary
        let numero = info?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = info?["CFBundleVersion"] as? String ?? "1"
        return "\(numero) (\(build))"
    }
}
