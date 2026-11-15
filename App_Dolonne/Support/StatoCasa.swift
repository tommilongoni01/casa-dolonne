import Foundation
import SwiftData

/// Una voce dello stato della casa: scadenza, allarme, scorta bassa o processo in corso.
struct Avviso: Identifiable {
    enum Destinazione {
        case attivita(AttivitaManutenzione)
        case contratto(Contratto)
        case operazione(Operazione)
        case prodotto(Prodotto)
        case processo(ProcessoAcqua)
    }

    enum Gravita: Int, Comparable {
        case scaduto, inScadenza, inCorso, informazione
        static func < (lhs: Gravita, rhs: Gravita) -> Bool { lhs.rawValue < rhs.rawValue }
    }

    let id: String
    let titolo: String
    let dettaglio: String
    let data: Date?
    let gravita: Gravita
    let icona: String
    let sezione: Sezione?
    let destinazione: Destinazione
}

/// Raccoglie avvisi e prossime operazioni da tutti i dati.
enum StatoCasa {
    /// Giorni in avanti considerati per le "prossime operazioni".
    static let orizzonteGiorni = 30

    static func avvisi(
        attivita: [AttivitaManutenzione], contratti: [Contratto], operazioni: [Operazione],
        prodotti: [Prodotto], processi: [ProcessoAcqua]
    ) -> [Avviso] {
        var elenco: [Avviso] = []

        for processo in processi where processo.inCorso {
            elenco.append(Avviso(
                id: "processo-\(processo.persistentModelID.hashValue)",
                titolo: String(localized: "\(String(localized: processo.tipo.nome)) piscina in corso"),
                dettaglio: String(localized: "Iniziato alle \(processo.dataInizio.formatted(date: .omitted, time: .shortened))"),
                data: processo.dataInizio, gravita: .inCorso, icona: processo.tipo.icona,
                sezione: nil, destinazione: .processo(processo)))
        }

        for voce in attivita where voce.attiva && voce.stato != .ok {
            elenco.append(Avviso(
                id: "attivita-\(voce.persistentModelID.hashValue)", titolo: voce.titolo,
                dettaglio: voce.sezione?.nome ?? String(localized: "Manutenzione"),
                data: voce.prossimaScadenza, gravita: voce.stato == .scaduta ? .scaduto : .inScadenza,
                icona: "wrench.and.screwdriver.fill", sezione: voce.sezione, destinazione: .attivita(voce)))
        }

        for voce in contratti where voce.dataScadenza != nil && voce.stato != .ok {
            elenco.append(Avviso(
                id: "contratto-\(voce.persistentModelID.hashValue)", titolo: voce.titolo,
                dettaglio: String(localized: "Scadenza contratto"),
                data: voce.dataScadenza, gravita: voce.stato == .scaduta ? .scaduto : .inScadenza,
                icona: "doc.text.fill", sezione: voce.sezione, destinazione: .contratto(voce)))
        }

        for voce in operazioni {
            for allarme in voce.allarmi where allarme.stato != .ok {
                elenco.append(Avviso(
                    id: "operazione-\(voce.persistentModelID.hashValue)-\(allarme.id)",
                    titolo: allarme.titolo, dettaglio: allarme.dettaglio,
                    data: allarme.data, gravita: allarme.stato == .scaduta ? .scaduto : .inScadenza,
                    icona: voce.tipo.icona, sezione: voce.sezione, destinazione: .operazione(voce)))
            }
        }

        for prodotto in prodotti where prodotto.sottoScorta {
            elenco.append(Avviso(
                id: "prodotto-\(prodotto.persistentModelID.hashValue)",
                titolo: String(localized: "Scorta bassa: \(prodotto.nome)"),
                dettaglio: String(localized: "Restano circa \(prodotto.analisi.giacenza.quantita(prodotto.unita))"),
                data: nil, gravita: .inScadenza, icona: prodotto.categoria.icona,
                sezione: nil, destinazione: .prodotto(prodotto)))
        }

        return elenco.sorted { ($0.gravita, $0.data ?? .distantFuture) < ($1.gravita, $1.data ?? .distantFuture) }
    }

    /// Operazioni e scadenze dei prossimi giorni non ancora in allarme.
    static func prossime(attivita: [AttivitaManutenzione], contratti: [Contratto], operazioni: [Operazione]) -> [Avviso] {
        let limite = Calendar.current.date(byAdding: .day, value: orizzonteGiorni, to: .now) ?? .now
        var elenco: [Avviso] = []

        for voce in attivita where voce.attiva && voce.stato == .ok && voce.prossimaScadenza <= limite {
            elenco.append(Avviso(
                id: "attivita-\(voce.persistentModelID.hashValue)", titolo: voce.titolo,
                dettaglio: voce.sezione?.nome ?? String(localized: "Manutenzione"),
                data: voce.prossimaScadenza, gravita: .informazione,
                icona: "wrench.and.screwdriver", sezione: voce.sezione, destinazione: .attivita(voce)))
        }
        for voce in contratti where voce.stato == .ok {
            guard let scadenza = voce.dataScadenza, scadenza <= limite else { continue }
            elenco.append(Avviso(
                id: "contratto-\(voce.persistentModelID.hashValue)", titolo: voce.titolo,
                dettaglio: String(localized: "Scadenza contratto"), data: scadenza, gravita: .informazione,
                icona: "doc.text", sezione: voce.sezione, destinazione: .contratto(voce)))
        }
        for voce in operazioni {
            for allarme in voce.allarmi where allarme.stato == .ok && allarme.data <= limite {
                elenco.append(Avviso(
                    id: "operazione-\(voce.persistentModelID.hashValue)-\(allarme.id)",
                    titolo: allarme.titolo, dettaglio: allarme.dettaglio, data: allarme.data, gravita: .informazione,
                    icona: voce.tipo.icona, sezione: voce.sezione, destinazione: .operazione(voce)))
            }
        }
        return elenco.sorted { ($0.data ?? .distantFuture) < ($1.data ?? .distantFuture) }
    }
}
