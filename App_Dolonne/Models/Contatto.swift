import Foundation
import SwiftData

/// Un fornitore, tecnico o riferimento legato a uno o più sistemi dello chalet.
@Model
final class Contatto {
    var nome: String = ""
    var cognome: String = ""
    var azienda: String = ""
    var ruolo: String = ""
    var telefono: String = ""
    var cellulare: String = ""
    var email: String = ""
    var indirizzo: String = ""
    var sitoWeb: String = ""
    var note: String = ""
    var preferito: Bool = false
    var dataCreazione: Date = Date.now

    var sezioni: [Sezione]? = []

    @Relationship(deleteRule: .nullify, inverse: \Contratto.fornitore)
    var contratti: [Contratto]? = []

    init() {}

    /// Nome mostrato in lista: persona se presente, altrimenti azienda.
    var nomeCompleto: String {
        let persona = [nome, cognome].filter { !$0.isEmpty }.joined(separator: " ")
        if !persona.isEmpty { return persona }
        return azienda.isEmpty ? String(localized: "Senza nome") : azienda
    }

    /// Riga secondaria (azienda e/o ruolo) quando il nome principale è una persona.
    var sottotitolo: String {
        let persona = [nome, cognome].filter { !$0.isEmpty }.joined(separator: " ")
        let parti = persona.isEmpty ? [ruolo] : [azienda, ruolo]
        return parti.filter { !$0.isEmpty }.joined(separator: " · ")
    }

    var iniziali: String {
        let parole = nomeCompleto.split(separator: " ").prefix(2)
        return parole.compactMap { $0.first.map(String.init) }.joined().uppercased()
    }

    var sezioniOrdinate: [Sezione] {
        (sezioni ?? []).sorted { $0.ordine < $1.ordine }
    }

    /// Lettera usata per raggruppare la rubrica in ordine alfabetico.
    var letteraIndice: String {
        guard let prima = nomeCompleto.first, prima.isLetter else { return "#" }
        return String(prima).uppercased()
    }
}
