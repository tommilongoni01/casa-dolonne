import SwiftUI
import SwiftData
import Contacts
import ContactsUI

/// Selettore della Rubrica di sistema: mostra i contatti del dispositivo e restituisce quelli scelti.
/// Non serve il permesso di accesso alla rubrica, perché la scelta la fa la persona nel selettore.
struct SelettoreRubrica: UIViewControllerRepresentable {
    @Binding var mostra: Bool
    let scelti: ([CNContact]) -> Void

    func makeUIViewController(context: Context) -> UIViewController {
        UIViewController()
    }

    func updateUIViewController(_ ospite: UIViewController, context: Context) {
        guard mostra, ospite.presentedViewController == nil else { return }
        let selettore = CNContactPickerViewController()
        selettore.delegate = context.coordinator
        // Il selettore va presentato dopo il ciclo di aggiornamento corrente.
        DispatchQueue.main.async {
            ospite.present(selettore, animated: true)
        }
    }

    func makeCoordinator() -> Coordinatore { Coordinatore(self) }

    final class Coordinatore: NSObject, CNContactPickerDelegate {
        let genitore: SelettoreRubrica

        init(_ genitore: SelettoreRubrica) {
            self.genitore = genitore
        }

        func contactPicker(_ picker: CNContactPickerViewController, didSelect contacts: [CNContact]) {
            genitore.mostra = false
            genitore.scelti(contacts)
        }

        func contactPickerDidCancel(_ picker: CNContactPickerViewController) {
            genitore.mostra = false
        }
    }
}

enum ImportazioneRubrica {
    /// Crea i contatti scelti; salta quelli già presenti (stesso nome e stesso numero o email).
    /// Restituisce quanti contatti sono stati aggiunti.
    @discardableResult
    static func importa(_ scelti: [CNContact], esistenti: [Contatto], in contesto: ModelContext) -> Int {
        var aggiunti = 0
        for voce in scelti {
            let contatto = Contatto()
            contatto.nome = voce.givenName
            contatto.cognome = voce.familyName
            contatto.azienda = voce.organizationName
            contatto.ruolo = voce.jobTitle

            for numero in voce.phoneNumbers {
                let valore = numero.value.stringValue
                let mobile = numero.label == CNLabelPhoneNumberMobile || numero.label == CNLabelPhoneNumberiPhone
                if mobile && contatto.cellulare.isEmpty {
                    contatto.cellulare = valore
                } else if contatto.telefono.isEmpty {
                    contatto.telefono = valore
                } else if contatto.cellulare.isEmpty {
                    contatto.cellulare = valore
                }
            }
            contatto.email = voce.emailAddresses.first.map { String($0.value) } ?? ""
            contatto.sitoWeb = voce.urlAddresses.first.map { String($0.value) } ?? ""
            if let indirizzo = voce.postalAddresses.first?.value {
                contatto.indirizzo = CNPostalAddressFormatter.string(from: indirizzo, style: .mailingAddress)
                    .replacingOccurrences(of: "\n", with: ", ")
            }

            let duplicato = esistenti.contains { altro in
                altro.nomeCompleto.localizedCaseInsensitiveCompare(contatto.nomeCompleto) == .orderedSame
                    && (Self.cifre(altro.cellulare + altro.telefono) == Self.cifre(contatto.cellulare + contatto.telefono)
                        || (!contatto.email.isEmpty && altro.email.caseInsensitiveCompare(contatto.email) == .orderedSame))
            }
            guard !duplicato else { continue }
            contesto.insert(contatto)
            aggiunti += 1
        }
        return aggiunti
    }

    private static func cifre(_ testo: String) -> String { testo.filter(\.isNumber) }
}
