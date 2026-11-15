import Foundation
import SwiftData
import UserNotifications

/// Pianifica le notifiche locali per attività di manutenzione e scadenze dei contratti.
enum Notifiche {
    static func richiediPermesso() async {
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
    }

    /// Ricrea tutte le notifiche a partire dai dati correnti.
    static func aggiorna(contesto: ModelContext) async {
        let centro = UNUserNotificationCenter.current()
        centro.removeAllPendingNotificationRequests()

        let attivita = (try? contesto.fetch(FetchDescriptor<AttivitaManutenzione>())) ?? []
        for voce in attivita where voce.attiva {
            let nome = voce.sezione.map { "\(voce.titolo) – \($0.nome)" } ?? voce.titolo
            await pianifica(
                id: "attivita-\(voce.persistentModelID.hashValue)",
                titolo: String(localized: "Manutenzione in scadenza"),
                testo: nome,
                scadenza: voce.prossimaScadenza,
                preavvisoGiorni: voce.giorniPreavviso,
                centro: centro
            )
        }

        // Allarmi delle operazioni: ossigeno (il giorno stesso) e manutenzioni periodiche (anche 14 giorni prima).
        let operazioni = (try? contesto.fetch(FetchDescriptor<Operazione>())) ?? []
        for operazione in operazioni {
            for allarme in operazione.allarmi {
                await pianifica(
                    id: "operazione-\(operazione.persistentModelID.hashValue)-\(allarme.id)",
                    titolo: allarme.titolo,
                    testo: allarme.dettaglio,
                    scadenza: allarme.data,
                    preavvisoGiorni: allarme.preavvisoNotifica ? allarme.giorniPreavviso : 0,
                    centro: centro
                )
            }
        }

        // Scorta bassa: se già sotto soglia promemoria al mattino seguente,
        // altrimenti nel giorno in cui la stima dei consumi prevede di scendere sotto soglia.
        let prodotti = (try? contesto.fetch(FetchDescriptor<Prodotto>())) ?? []
        for prodotto in prodotti where prodotto.scortaMinima > 0 {
            let analisi = prodotto.analisi
            let attuale = analisi.giacenza
            var quando: Date?
            if attuale <= prodotto.scortaMinima {
                quando = Calendar.current.date(byAdding: .day, value: 1, to: .now)
            } else if let media = analisi.consumoMedioGiornaliero, media > 0 {
                let giorni = Int(((attuale - prodotto.scortaMinima) / media).rounded(.down))
                quando = Calendar.current.date(byAdding: .day, value: giorni, to: .now)
            }
            guard let quando else { continue }
            await pianifica(
                id: "scorta-\(prodotto.persistentModelID.hashValue)",
                titolo: String(localized: "Scorta bassa: \(prodotto.nome)"),
                testo: String(localized: "Sotto \(prodotto.scortaMinima.quantita(prodotto.unita))"),
                scadenza: quando,
                preavvisoGiorni: 0,
                mostraScadenza: false,
                centro: centro
            )
        }

        let contratti = (try? contesto.fetch(FetchDescriptor<Contratto>())) ?? []
        for contratto in contratti {
            guard let scadenza = contratto.dataScadenza else { continue }
            await pianifica(
                id: "contratto-\(contratto.persistentModelID.hashValue)",
                titolo: String(localized: "Contratto in scadenza"),
                testo: contratto.titolo,
                scadenza: scadenza,
                preavvisoGiorni: contratto.giorniPreavviso,
                centro: centro
            )
        }
    }

    /// Una notifica con il preavviso indicato e una il giorno stesso, alle 9:00.
    private static func pianifica(
        id: String, titolo: String, testo: String, scadenza: Date, preavvisoGiorni: Int,
        mostraScadenza: Bool = true, centro: UNUserNotificationCenter
    ) async {
        let calendario = Calendar.current
        var date: [(String, Date)] = [("\(id)-giorno", scadenza)]
        if preavvisoGiorni > 0, let anticipo = calendario.date(byAdding: .day, value: -preavvisoGiorni, to: scadenza) {
            date.append(("\(id)-preavviso", anticipo))
        }

        for (identificativo, data) in date {
            var componenti = calendario.dateComponents([.year, .month, .day], from: data)
            componenti.hour = 9
            guard let quando = calendario.date(from: componenti), quando > .now else { continue }

            let contenuto = UNMutableNotificationContent()
            contenuto.title = titolo
            contenuto.body = mostraScadenza
                ? String(localized: "\(testo) · scadenza \(scadenza.formatted(date: .long, time: .omitted))")
                : testo
            contenuto.sound = .default

            let trigger = UNCalendarNotificationTrigger(dateMatching: componenti, repeats: false)
            try? await centro.add(UNNotificationRequest(identifier: identificativo, content: contenuto, trigger: trigger))
        }
    }
}
