import SwiftUI
import SwiftData

/// Scheda contatto in stile app Contatti di iOS.
struct ContattoDettaglioView: View {
    @Environment(\.modelContext) private var contesto
    @Environment(\.dismiss) private var chiudi
    @Environment(\.puoModificare) private var puoModificare
    @Bindable var contatto: Contatto
    @State private var mostraModifica = false
    @State private var confermaEliminazione = false

    var body: some View {
        List {
            Section {
                intestazione
                    .listRowBackground(Color.clear)
            }

            Section {
                if !contatto.cellulare.isEmpty {
                    rigaLink("cellulare", valore: contatto.cellulare, url: urlTelefono(contatto.cellulare))
                }
                if !contatto.telefono.isEmpty {
                    rigaLink("telefono", valore: contatto.telefono, url: urlTelefono(contatto.telefono))
                }
                if !contatto.email.isEmpty {
                    rigaLink("email", valore: contatto.email, url: URL(string: "mailto:\(contatto.email)"))
                }
                if !contatto.sitoWeb.isEmpty {
                    rigaLink("sito web", valore: contatto.sitoWeb, url: urlSito)
                }
                if !contatto.indirizzo.isEmpty {
                    rigaLink("indirizzo", valore: contatto.indirizzo, url: urlMappe)
                }
            }

            if !contatto.sezioniOrdinate.isEmpty {
                Section("Sistemi di riferimento") {
                    ForEach(contatto.sezioniOrdinate) { sezione in
                        NavigationLink {
                            SezioneManualeView(sezione: sezione)
                        } label: {
                            Label {
                                Text(sezione.nome)
                            } icon: {
                                IconaQuadrata(simbolo: sezione.icona, colore: sezione.colore, dimensione: 28)
                            }
                        }
                    }
                }
            }

            if let contratti = contatto.contratti, !contratti.isEmpty {
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

            if !contatto.note.isEmpty {
                Section("Note") {
                    Text(contatto.note)
                }
            }

            if puoModificare {
                Section {
                    Button("Elimina contatto", role: .destructive) { confermaEliminazione = true }
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(contatto.preferito ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti",
                       systemImage: contatto.preferito ? "star.fill" : "star") {
                    contatto.preferito.toggle()
                }
                .disabled(!puoModificare)
            }
            if puoModificare {
                ToolbarItem(placement: .primaryAction) {
                    Button("Modifica") { mostraModifica = true }
                }
            }
        }
        .sheet(isPresented: $mostraModifica) {
            ContattoModificaView(contatto: contatto)
        }
        .confirmationDialog("Eliminare il contatto?", isPresented: $confermaEliminazione, titleVisibility: .visible) {
            Button("Elimina", role: .destructive) {
                contesto.delete(contatto)
                chiudi()
            }
        }
    }

    private var intestazione: some View {
        VStack(spacing: 12) {
            AvatarContatto(contatto: contatto, dimensione: 96)
            VStack(spacing: 4) {
                Text(contatto.nomeCompleto)
                    .font(.title.bold())
                    .multilineTextAlignment(.center)
                if !contatto.sottotitolo.isEmpty {
                    Text(contatto.sottotitolo)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
            }
            HStack(spacing: 10) {
                PulsanteAzione(titolo: "chiama", icona: "phone.fill", url: urlTelefono(numeroPrincipale))
                PulsanteAzione(titolo: "messaggio", icona: "message.fill", url: urlSMS)
                PulsanteAzione(titolo: "WhatsApp", icona: "bubble.left.and.text.bubble.right.fill", url: urlWhatsApp)
                PulsanteAzione(titolo: "email", icona: "envelope.fill",
                               url: contatto.email.isEmpty ? nil : URL(string: "mailto:\(contatto.email)"))
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func rigaLink(_ etichetta: LocalizedStringKey, valore: String, url: URL?) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(etichetta)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            if let url {
                Link(valore, destination: url)
            } else {
                Text(valore)
            }
        }
        .textSelection(.enabled)
    }

    // MARK: URL

    private var numeroPrincipale: String {
        contatto.cellulare.isEmpty ? contatto.telefono : contatto.cellulare
    }

    private func soloCifre(_ numero: String) -> String {
        numero.filter { $0.isNumber || $0 == "+" }
    }

    private func urlTelefono(_ numero: String) -> URL? {
        let cifre = soloCifre(numero)
        return cifre.isEmpty ? nil : URL(string: "tel:\(cifre)")
    }

    private var urlSMS: URL? {
        let cifre = soloCifre(numeroPrincipale)
        return cifre.isEmpty ? nil : URL(string: "sms:\(cifre)")
    }

    private var urlWhatsApp: URL? {
        var cifre = soloCifre(numeroPrincipale).replacing("+", with: "")
        guard !cifre.isEmpty else { return nil }
        // Numeri italiani senza prefisso internazionale.
        if !soloCifre(numeroPrincipale).hasPrefix("+") && !cifre.hasPrefix("00") { cifre = "39" + cifre }
        if cifre.hasPrefix("00") { cifre.removeFirst(2) }
        return URL(string: "https://wa.me/\(cifre)")
    }

    private var urlSito: URL? {
        let indirizzo = contatto.sitoWeb.hasPrefix("http") ? contatto.sitoWeb : "https://\(contatto.sitoWeb)"
        return URL(string: indirizzo)
    }

    private var urlMappe: URL? {
        var componenti = URLComponents(string: "https://maps.apple.com/")
        componenti?.queryItems = [URLQueryItem(name: "q", value: contatto.indirizzo)]
        return componenti?.url
    }
}

/// Pulsante rotondo con icona come quelli sotto il nome nella scheda contatto.
private struct PulsanteAzione: View {
    let titolo: LocalizedStringKey
    let icona: String
    let url: URL?
    @Environment(\.openURL) private var apriURL

    var body: some View {
        Button {
            if let url { apriURL(url) }
        } label: {
            VStack(spacing: 4) {
                Image(systemName: icona)
                    .font(.title3)
                Text(titolo)
                    .font(.caption2)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity, minHeight: 56)
        }
        .buttonStyle(.bordered)
        .buttonBorderShape(.roundedRectangle(radius: 12))
        .disabled(url == nil)
    }
}
