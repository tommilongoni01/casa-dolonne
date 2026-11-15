import SwiftUI
import SwiftData

/// Importa guide e documenti convertiti dai file Word/PDF originali
/// (`ContenutiIniziali/contenuti_manuale.json` nel bundle dell'app).
/// Non sovrascrive nulla: guide e documenti già presenti vengono saltati,
/// quindi le modifiche fatte nell'app restano.
enum ImportazioneContenuti {
    private static let chiaveVersione = "versioneContenutiImportati"

    // MARK: Formato del file

    struct Archivio: Decodable {
        let versione: Int
        let sezioni: [SezioneArchivio]
    }

    struct SezioneArchivio: Decodable {
        let sezione: String
        let documenti: [DocumentoArchivio]
        let guide: [GuidaArchivio]
    }

    struct DocumentoArchivio: Decodable {
        let titolo: String
        let file: String
    }

    struct GuidaArchivio: Decodable {
        let titolo: String
        let blocchi: [BloccoArchivio]
    }

    /// Un blocco è testo (lista di paragrafi) oppure un'immagine con didascalia.
    struct BloccoArchivio: Decodable {
        let testo: [Paragrafo]?
        let immagine: String?
        let didascalia: String?
    }

    struct Paragrafo: Decodable {
        let stile: String
        let runs: [Run]
    }

    struct Run: Decodable {
        let t: String
        let b: Bool
        let i: Bool
        let link: String?
    }

    // MARK: Importazione

    static func importaSeNecessario(in contesto: ModelContext) {
        guard let url = risorsa("contenuti_manuale", estensione: "json"),
              let dati = try? Data(contentsOf: url),
              let archivio = try? JSONDecoder().decode(Archivio.self, from: dati) else { return }
        let versioneImportata = UserDefaults.standard.integer(forKey: chiaveVersione)
        guard archivio.versione > versioneImportata else { return }

        let sezioniEsistenti = (try? contesto.fetch(FetchDescriptor<Sezione>())) ?? []
        for voce in archivio.sezioni {
            let sezione = sezioniEsistenti.first {
                $0.nome.compare(voce.sezione, options: [.caseInsensitive, .diacriticInsensitive]) == .orderedSame
            } ?? {
                let nuova = Sezione(nome: voce.sezione, ordine: sezioniEsistenti.count)
                contesto.insert(nuova)
                return nuova
            }()

            for documento in voce.documenti where !(sezione.documenti ?? []).contains(where: { $0.nomeFile == documento.file }) {
                let parti = documento.file.split(separator: ".", maxSplits: 1).map(String.init)
                guard parti.count == 2, let url = risorsa(parti[0], estensione: parti[1]),
                      let contenuto = try? Data(contentsOf: url) else { continue }
                contesto.insert(Documento(titolo: documento.titolo, nomeFile: documento.file, dati: contenuto, sezione: sezione))
            }

            for guida in voce.guide where !(sezione.guide ?? []).contains(where: { $0.titolo == guida.titolo }) {
                importa(guida, in: sezione, contesto: contesto)
            }
        }
        try? contesto.save()
        UserDefaults.standard.set(archivio.versione, forKey: chiaveVersione)
    }

    private static func importa(_ archivio: GuidaArchivio, in sezione: Sezione, contesto: ModelContext) {
        let guida = Guida(titolo: archivio.titolo, sezione: sezione)
        contesto.insert(guida)
        for (indice, voce) in archivio.blocchi.enumerated() {
            if let paragrafi = voce.testo {
                let blocco = BloccoGuida(tipo: .testo, ordine: indice)
                blocco.testo = testoFormattato(paragrafi)
                blocco.guida = guida
                contesto.insert(blocco)
            } else if let nome = voce.immagine {
                let parti = nome.split(separator: ".", maxSplits: 1).map(String.init)
                guard parti.count == 2, let url = risorsa(parti[0], estensione: parti[1]) else { continue }
                let blocco = BloccoGuida(tipo: .immagine, ordine: indice)
                blocco.immagine = try? Data(contentsOf: url)
                blocco.didascalia = voce.didascalia ?? ""
                blocco.guida = guida
                contesto.insert(blocco)
            }
        }
    }

    /// Converte i paragrafi in testo formattato: titoletti in grassetto grande,
    /// grassetto/corsivo e link mantenuti.
    static func testoFormattato(_ paragrafi: [Paragrafo]) -> AttributedString {
        var risultato = AttributedString()
        for (indice, paragrafo) in paragrafi.enumerated() {
            if indice > 0 { risultato += AttributedString("\n") }
            let titoletto = paragrafo.stile == "titoletto"
            for run in paragrafo.runs {
                var parte = AttributedString(run.t)
                var font: Font = titoletto ? .title3 : .body
                if titoletto || run.b { font = font.bold() }
                if run.i { font = font.italic() }
                parte.font = font
                if let link = run.link, let url = URL(string: link) { parte.link = url }
                risultato += parte
            }
        }
        return risultato
    }

    // MARK: Carichi pellet (dal foglio Excel "pellet-carichi e costi")

    private struct ArchivioCarichi: Decodable {
        struct Voce: Decodable {
            let data: String
            let fornitore: String
            let quintali: Double
            let prezzoQuintale: Double
            let ivaPercentuale: Double
            let precarico: Double?
        }
        let versione: Int
        let carichi: [Voce]
    }

    /// Importa una sola volta i carichi storici; salta quelli già presenti (stessa data e quantità).
    static func importaCarichiPellet(in contesto: ModelContext) {
        let chiave = "versioneCarichiPelletImportati"
        guard let url = risorsa("carichi_pellet", estensione: "json"),
              let dati = try? Data(contentsOf: url),
              let archivio = try? JSONDecoder().decode(ArchivioCarichi.self, from: dati),
              archivio.versione > UserDefaults.standard.integer(forKey: chiave) else { return }

        let esistenti = (try? contesto.fetch(FetchDescriptor<CaricoPellet>())) ?? []
        let calendario = Calendar.current
        for voce in archivio.carichi {
            guard let giorno = try? Date(voce.data, strategy: .iso8601.year().month().day()) else { continue }
            // Mezzogiorno locale, così la data non cambia con il fuso orario.
            let data = calendario.date(bySettingHour: 12, minute: 0, second: 0, of: giorno) ?? giorno
            let duplicato = esistenti.contains {
                calendario.isDate($0.data, inSameDayAs: data) && abs($0.quintali - voce.quintali) < 0.001
            }
            guard !duplicato else { continue }
            let carico = CaricoPellet(data: data)
            carico.fornitore = voce.fornitore
            carico.quintali = voce.quintali
            carico.prezzoQuintale = voce.prezzoQuintale
            carico.ivaPercentuale = voce.ivaPercentuale
            carico.precarico = voce.precarico
            contesto.insert(carico)
        }
        try? contesto.save()
        UserDefaults.standard.set(archivio.versione, forKey: chiave)
    }

    private static func risorsa(_ nome: String, estensione: String) -> URL? {
        Bundle.main.url(forResource: nome, withExtension: estensione)
            ?? Bundle.main.url(forResource: nome, withExtension: estensione, subdirectory: "ContenutiIniziali")
    }
}
