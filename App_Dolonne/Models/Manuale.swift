import Foundation
import SwiftData
import UniformTypeIdentifiers

/// Guida scritta direttamente nell'app, composta da blocchi di testo formattato e foto.
@Model
final class Guida {
    var titolo: String = ""
    var dataCreazione: Date = Date.now
    var dataModifica: Date = Date.now
    var sezione: Sezione?

    @Relationship(deleteRule: .cascade, inverse: \BloccoGuida.guida)
    var blocchi: [BloccoGuida]? = []

    @Relationship(deleteRule: .nullify, inverse: \Operazione.guida)
    var operazioni: [Operazione]? = []

    init(titolo: String, sezione: Sezione?) {
        self.titolo = titolo
        self.sezione = sezione
    }

    var blocchiOrdinati: [BloccoGuida] {
        (blocchi ?? []).sorted { $0.ordine < $1.ordine }
    }

    var eVuota: Bool {
        titolo.trimmingCharacters(in: .whitespaces).isEmpty && (blocchi ?? []).isEmpty
    }
}

/// Un paragrafo di testo formattato oppure un'immagine all'interno di una guida.
@Model
final class BloccoGuida {
    enum Tipo: String, Codable {
        case testo
        case immagine
    }

    var ordine: Int = 0
    var tipoRaw: String = Tipo.testo.rawValue
    /// Testo formattato serializzato (vedi `AttributedString+Archivio`).
    var testoArchiviato: Data?
    @Attribute(.externalStorage) var immagine: Data?
    var didascalia: String = ""
    var guida: Guida?

    init(tipo: Tipo, ordine: Int) {
        self.tipoRaw = tipo.rawValue
        self.ordine = ordine
    }

    var tipo: Tipo { Tipo(rawValue: tipoRaw) ?? .testo }

    var testo: AttributedString {
        get { AttributedString.daArchivio(testoArchiviato) }
        set { testoArchiviato = newValue.archiviato() }
    }
}

/// Documento del fornitore (PDF, immagine, ecc.) allegato a una sezione del manuale.
@Model
final class Documento {
    var titolo: String = ""
    var nomeFile: String = ""
    var note: String = ""
    var dataAggiunta: Date = Date.now
    @Attribute(.externalStorage) var dati: Data?
    var sezione: Sezione?

    init(titolo: String, nomeFile: String, dati: Data, sezione: Sezione?) {
        self.titolo = titolo
        self.nomeFile = nomeFile
        self.dati = dati
        self.sezione = sezione
    }

    var icona: String {
        let ext = (nomeFile as NSString).pathExtension
        guard let tipo = UTType(filenameExtension: ext) else { return "doc" }
        if tipo.conforms(to: .pdf) { return "doc.richtext" }
        if tipo.conforms(to: .image) { return "photo" }
        if tipo.conforms(to: .spreadsheet) { return "tablecells" }
        return "doc"
    }
}
