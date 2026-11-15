import Foundation
import SwiftData

/// Crea le sezioni e i prodotti predefiniti al primo avvio.
enum DatiIniziali {
    static let sezioni: [(String, String)] = [
        ("Impianto idraulico", "drop.fill"),
        ("Impianto elettrico", "bolt.fill"),
        ("Caldaia", "flame.fill"),
        ("Istruzioni generali", "book.closed.fill"),
        ("Impianto fotovoltaico", "sun.max.fill"),
        ("Piscina", "figure.pool.swim"),
        ("Ascensore", "arrow.up.arrow.down.square.fill"),
        ("UTA", "fan.fill"),
        ("VMC", "wind")
    ]

    static func creaSeNecessario(in contesto: ModelContext) {
        let sezioniEsistenti = (try? contesto.fetchCount(FetchDescriptor<Sezione>())) ?? 0
        if sezioniEsistenti == 0 {
            for (indice, voce) in sezioni.enumerated() {
                contesto.insert(Sezione(nome: voce.0, icona: voce.1, ordine: indice))
            }
        }

        let prodottiEsistenti = (try? contesto.fetchCount(FetchDescriptor<Prodotto>())) ?? 0
        if prodottiEsistenti == 0 {
            contesto.insert(Prodotto(nome: "Pellet", categoria: .pellet, unita: "sacchi", ordine: 0))
            let ossigeno = Prodotto(nome: "Ossigeno attivo", categoria: .ossigeno, unita: "l", ordine: 1)
            ossigeno.scortaMinima = 50
            contesto.insert(ossigeno)
            contesto.insert(Prodotto(nome: "Correttore pH", categoria: .ph, unita: "kg", ordine: 2))
            contesto.insert(Prodotto(nome: "Flocculante", categoria: .flocculante, unita: "l", ordine: 3))
        }
        creaOperazioniPiscina(in: contesto)
        aggiornamentoPiscinaV2(in: contesto)
        creaOperazioniImpianti(in: contesto)
        aggiornamentoRevisione1(in: contesto)
        ripristinaOssigeno(in: contesto)
        try? contesto.save()
    }

    /// Ricrea l'operazione Ossigeno della piscina se è stata eliminata per sbaglio,
    /// ricollegandola al prodotto esistente (acquisti e riempimenti tornano visibili).
    private static func ripristinaOssigeno(in contesto: ModelContext) {
        let chiave = "ripristinoOssigeno1"
        guard !UserDefaults.standard.bool(forKey: chiave) else { return }
        defer { UserDefaults.standard.set(true, forKey: chiave) }
        let sezioni = (try? contesto.fetch(FetchDescriptor<Sezione>())) ?? []
        guard let piscina = sezioni.first(where: { $0.nome.localizedCaseInsensitiveCompare("Piscina") == .orderedSame }),
              !(piscina.operazioni ?? []).contains(where: { $0.tipo == .ossigeno }) else { return }

        let prodotti = (try? contesto.fetch(FetchDescriptor<Prodotto>())) ?? []
        let prodotto = prodotti.first { $0.categoria == .ossigeno } ?? {
            let nuovo = Prodotto(nome: "Ossigeno attivo", categoria: .ossigeno, unita: "l", ordine: 1)
            nuovo.scortaMinima = 50
            contesto.insert(nuovo)
            return nuovo
        }()
        // Subito dopo il pH, come in origine.
        let ordinePH = piscina.operazioniOrdinate.first { $0.tipo == .ph }?.ordine ?? 0
        for altra in piscina.operazioniOrdinate where altra.ordine > ordinePH { altra.ordine += 1 }
        let ossigeno = Operazione(titolo: "Ossigeno", tipo: .ossigeno, sezione: piscina, ordine: ordinePH + 1)
        ossigeno.prodotto = prodotto
        ossigeno.giorniAllarme = 20
        contesto.insert(ossigeno)
    }

    /// Modifiche della revisione 1 (feedback "modifica app dolonne rev 1"):
    /// litri come "l", "Svuotamento cenere", tipologie di manutenzione configurabili
    /// e storico manutenzioni anche per Ascensore, Fotovoltaico, Idraulico, Elettrico e Piscina.
    private static func aggiornamentoRevisione1(in contesto: ModelContext) {
        let chiave = "aggiornamentoRevisione1"
        guard !UserDefaults.standard.bool(forKey: chiave) else { return }
        defer { UserDefaults.standard.set(true, forKey: chiave) }

        for prodotto in (try? contesto.fetch(FetchDescriptor<Prodotto>())) ?? [] where prodotto.unita == "L" {
            prodotto.unita = "l"
        }

        let operazioni = (try? contesto.fetch(FetchDescriptor<Operazione>())) ?? []
        for operazione in operazioni where operazione.tipo == .ceneri && operazione.titolo == "Svuotamento ceneri" {
            operazione.titolo = "Svuotamento cenere"
        }

        // Storici esistenti: le vecchie impostazioni diventano tipologie, gli interventi vengono collegati.
        for operazione in operazioni where operazione.tipo == .storicoManutenzioni && (operazione.tipologie ?? []).isEmpty {
            if operazione.conTipologie {
                let principale = aggiungiTipologia("Principale", mesi: operazione.mesiAllarme, ordine: 0, a: operazione, contesto: contesto)
                let cliente = aggiungiTipologia("Cliente", mesi: 0, ordine: 1, a: operazione, contesto: contesto)
                for intervento in operazione.interventi ?? [] {
                    intervento.tipologia = intervento.tipo == .cliente ? cliente : principale
                }
            } else {
                let unica = aggiungiTipologia("Manutenzione", mesi: operazione.mesiAllarme, ordine: 0, a: operazione, contesto: contesto)
                for intervento in operazione.interventi ?? [] { intervento.tipologia = unica }
            }
        }

        // Nuovi storici manutenzioni.
        let sezioni = (try? contesto.fetch(FetchDescriptor<Sezione>())) ?? []
        func sezione(_ nome: String) -> Sezione? {
            sezioni.first { $0.nome.localizedCaseInsensitiveCompare(nome) == .orderedSame }
        }
        let predefinite: [(String, [(String, Int)])] = [
            ("Ascensore", [("Manutenzione impianto", 6), ("Verifica periodica", 24)]),
            ("Impianto fotovoltaico", [("Principale", 12), ("Cliente", 0)]),
            ("Impianto idraulico", [("Principale", 12), ("Cliente", 0)]),
            ("Impianto elettrico", [("Principale", 12), ("Cliente", 0)]),
            ("Piscina", [("Manutenzione fornitore", 0)])
        ]
        for (nome, tipologie) in predefinite {
            guard let impianto = sezione(nome),
                  !(impianto.operazioni ?? []).contains(where: { $0.tipo == .storicoManutenzioni }) else { continue }
            let storico = Operazione(titolo: "Storico manutenzioni", tipo: .storicoManutenzioni, sezione: impianto,
                                     ordine: (impianto.operazioniOrdinate.last?.ordine ?? -1) + 1)
            contesto.insert(storico)
            for (indice, voce) in tipologie.enumerated() {
                _ = aggiungiTipologia(voce.0, mesi: voce.1, ordine: indice, a: storico, contesto: contesto)
            }
        }
    }

    private static func aggiungiTipologia(
        _ nome: String, mesi: Int, ordine: Int, a operazione: Operazione, contesto: ModelContext
    ) -> TipologiaIntervento {
        let tipologia = TipologiaIntervento(nome: nome, mesiAvviso: mesi, ordine: ordine)
        contesto.insert(tipologia)
        tipologia.operazione = operazione
        return tipologia
    }

    /// Operazioni di Caldaia (pellet, ceneri, storico), UTA e VMC (storico manutenzioni).
    private static func creaOperazioniImpianti(in contesto: ModelContext) {
        let chiave = "operazioniImpiantiCreate"
        guard !UserDefaults.standard.bool(forKey: chiave) else { return }
        defer { UserDefaults.standard.set(true, forKey: chiave) }
        let sezioni = (try? contesto.fetch(FetchDescriptor<Sezione>())) ?? []
        func sezione(_ nome: String) -> Sezione? {
            sezioni.first { $0.nome.localizedCaseInsensitiveCompare(nome) == .orderedSame }
        }

        if let caldaia = sezione("Caldaia") {
            let base = (caldaia.operazioniOrdinate.last?.ordine ?? -1) + 1
            contesto.insert(Operazione(titolo: "Pellet", tipo: .pellet, sezione: caldaia, ordine: base))
            contesto.insert(Operazione(titolo: "Svuotamento cenere", tipo: .ceneri, sezione: caldaia, ordine: base + 1))
            let storico = Operazione(titolo: "Storico manutenzioni", tipo: .storicoManutenzioni, sezione: caldaia, ordine: base + 2)
            storico.conTipologie = true
            storico.mesiAllarme = 12
            contesto.insert(storico)
        }
        for nome in ["UTA", "VMC"] {
            guard let impianto = sezione(nome) else { continue }
            let storico = Operazione(titolo: "Storico manutenzioni", tipo: .storicoManutenzioni, sezione: impianto,
                                     ordine: (impianto.operazioniOrdinate.last?.ordine ?? -1) + 1)
            storico.mesiAllarme = 12
            contesto.insert(storico)
        }
    }

    /// Correzioni ai dati già creati: ossigeno in litri con avviso sotto 50 L,
    /// strumenti pH rinominati in Dosimetro e Scuba.
    private static func aggiornamentoPiscinaV2(in contesto: ModelContext) {
        let chiave = "aggiornamentoPiscinaV2"
        guard !UserDefaults.standard.bool(forKey: chiave) else { return }
        defer { UserDefaults.standard.set(true, forKey: chiave) }
        let prodotti = (try? contesto.fetch(FetchDescriptor<Prodotto>())) ?? []
        for prodotto in prodotti where prodotto.categoria == .ossigeno {
            if prodotto.unita.lowercased() == "kg" { prodotto.unita = "l" }
            if prodotto.scortaMinima == 0 { prodotto.scortaMinima = 50 }
        }
        let preferenze = UserDefaults.standard
        if preferenze.string(forKey: ChiaviImpostazioni.nomeStrumento1) == "Strumento 1" {
            preferenze.set(ChiaviImpostazioni.strumento1Predefinito, forKey: ChiaviImpostazioni.nomeStrumento1)
        }
        if preferenze.string(forKey: ChiaviImpostazioni.nomeStrumento2) == "Strumento 2" {
            preferenze.set(ChiaviImpostazioni.strumento2Predefinito, forKey: ChiaviImpostazioni.nomeStrumento2)
        }
    }

    /// Operazioni predefinite della piscina: pH, ossigeno (allarme a 20 giorni) e cambio acqua.
    private static func creaOperazioniPiscina(in contesto: ModelContext) {
        // Solo la prima volta: se poi ne elimini una non viene ricreata.
        let chiave = "operazioniPiscinaCreate"
        guard !UserDefaults.standard.bool(forKey: chiave) else { return }
        defer { UserDefaults.standard.set(true, forKey: chiave) }
        let sezioni = (try? contesto.fetch(FetchDescriptor<Sezione>())) ?? []
        guard let piscina = sezioni.first(where: { $0.nome.localizedCaseInsensitiveCompare("Piscina") == .orderedSame }) else { return }
        let prodotti = (try? contesto.fetch(FetchDescriptor<Prodotto>())) ?? []
        let esistenti = Set((piscina.operazioni ?? []).map(\.tipo))

        let predefinite: [(TipoOperazione, String)] = [(.ph, "pH"), (.ossigeno, "Ossigeno"), (.cambioAcqua, "Cambio acqua")]
        for (indice, voce) in predefinite.enumerated() where !esistenti.contains(voce.0) {
            let operazione = Operazione(titolo: voce.1, tipo: voce.0, sezione: piscina, ordine: indice)
            if let categoria = voce.0.categoriaProdotto {
                operazione.prodotto = prodotti.first { $0.categoria == categoria }
            }
            if voce.0 == .ossigeno { operazione.giorniAllarme = 20 }
            contesto.insert(operazione)
        }
    }
}
