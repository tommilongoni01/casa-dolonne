import SwiftUI
import SwiftData
import UIKit

// MARK: - Testo formattato

extension AttributedString {
    /// Serializza il testo mantenendo gli attributi SwiftUI (grassetto, dimensioni, colori…).
    func archiviato() -> Data? {
        if let dati = try? JSONEncoder().encode(self, configuration: AttributeScopes.SwiftUIAttributes.self) {
            return dati
        }
        return try? JSONEncoder().encode(self)
    }

    static func daArchivio(_ dati: Data?) -> AttributedString {
        guard let dati else { return AttributedString() }
        if let testo = try? JSONDecoder().decode(
            AttributedString.self, from: dati, configuration: AttributeScopes.SwiftUIAttributes.self
        ) {
            return testo
        }
        return (try? JSONDecoder().decode(AttributedString.self, from: dati)) ?? AttributedString()
    }
}

// MARK: - Modalità modifica / sola lettura

extension EnvironmentValues {
    /// `false` per i membri della famiglia che consultano l'app in sola lettura.
    @Entry var puoModificare: Bool = true
}

enum ChiaviImpostazioni {
    static let modalitaModifica = "modalitaModifica"
    static let nomeStrumento1 = "nomeStrumentoPH1"
    static let nomeStrumento2 = "nomeStrumentoPH2"
    static let datiIniziali = "datiInizialiCreati"
    static let aspetto = "aspetto"
    static let strumento1Predefinito = "Dosimetro"
    static let strumento2Predefinito = "Scuba"
}

// MARK: - Formattazione

extension Date {
    /// Giorni di calendario trascorsi da questa data a oggi (ignora l'ora).
    var giorniTrascorsi: Int {
        let calendario = Calendar.current
        return calendario.dateComponents([.day], from: calendario.startOfDay(for: self),
                                         to: calendario.startOfDay(for: .now)).day ?? 0
    }
}

/// Formati numerici con il punto delle migliaia sempre presente (1.430,00 e non 1430,00):
/// in italiano il sistema raggruppa le cifre solo dalle 5 in su.
enum FormatiNumero {
    static let euro: NumberFormatter = {
        let formato = NumberFormatter()
        formato.numberStyle = .currency
        formato.currencyCode = "EUR"
        formato.minimumGroupingDigits = 1
        return formato
    }()

    static let numero: NumberFormatter = {
        let formato = NumberFormatter()
        formato.numberStyle = .decimal
        formato.minimumFractionDigits = 0
        formato.maximumFractionDigits = 2
        formato.minimumGroupingDigits = 1
        return formato
    }()
}

extension Double {
    var euro: String { FormatiNumero.euro.string(from: NSNumber(value: self)) ?? formatted(.currency(code: "EUR")) }

    /// Numero con al massimo 2 decimali e separatore delle migliaia.
    var numero: String { FormatiNumero.numero.string(from: NSNumber(value: self)) ?? formatted() }

    func quantita(_ unita: String) -> String {
        "\(numero) \(unita)"
    }
}

extension Int {
    /// Durata in minuti resa come "1 h 20 min".
    var durataLeggibile: String {
        Duration.seconds(self * 60).formatted(.units(allowed: [.hours, .minutes], width: .abbreviated))
    }
}

// MARK: - Componenti condivisi

/// Badge colorato che riassume lo stato di una scadenza.
struct BadgeScadenza: View {
    let data: Date
    let stato: StatoScadenza

    var body: some View {
        Text(data, format: .dateTime.day().month(.abbreviated).year())
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .foregroundStyle(colore)
            .background(colore.opacity(0.15), in: .capsule)
    }

    private var colore: Color {
        switch stato {
        case .scaduta: .red
        case .inScadenza: .orange
        case .ok: .green
        }
    }
}

/// Immagine creata da dati binari salvati.
struct ImmagineDaDati: View {
    let dati: Data?

    var body: some View {
        if let dati, let immagine = UIImage(data: dati) {
            Image(uiImage: immagine)
                .resizable()
                .scaledToFit()
        } else {
            Image(systemName: "photo")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, minHeight: 120)
        }
    }
}

/// Scrive un allegato in una cartella temporanea per mostrarlo con Quick Look.
enum FileTemporanei {
    static func url(per dati: Data?, nomeFile: String) -> URL? {
        guard let dati else { return nil }
        let nome = nomeFile.isEmpty ? "documento" : nomeFile
        let cartella = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        do {
            try FileManager.default.createDirectory(at: cartella, withIntermediateDirectories: true)
            let url = cartella.appending(path: nome)
            try dati.write(to: url)
            return url
        } catch {
            return nil
        }
    }
}

/// Campo numerico opzionale (vuoto = nessun valore).
struct CampoNumero: View {
    let titolo: LocalizedStringKey
    @Binding var valore: Double?
    var unita: String = ""
    /// Tastiera con il segno meno (es. livello dell'acqua sotto lo zero).
    var negativi = false

    var body: some View {
        LabeledContent(titolo) {
            HStack {
                TextField(titolo, value: $valore, format: .number.precision(.fractionLength(0...2)))
                    .keyboardType(negativi ? .numbersAndPunctuation : .decimalPad)
                    .multilineTextAlignment(.trailing)
                if !unita.isEmpty {
                    Text(unita).foregroundStyle(.secondary)
                }
            }
        }
    }
}

/// Selettore di durata in ore e minuti.
struct CampoDurata: View {
    let titolo: LocalizedStringKey
    @Binding var minuti: Int

    var body: some View {
        LabeledContent(titolo) {
            HStack(spacing: 4) {
                Picker("Ore", selection: ore) {
                    ForEach(0..<73) { Text("\($0) h").tag($0) }
                }
                Picker("Minuti", selection: minutiResto) {
                    ForEach(Array(stride(from: 0, to: 60, by: 5)), id: \.self) { Text("\($0) min").tag($0) }
                }
            }
            .labelsHidden()
        }
    }

    private var ore: Binding<Int> {
        Binding { minuti / 60 } set: { minuti = $0 * 60 + minuti % 60 }
    }

    private var minutiResto: Binding<Int> {
        Binding { (minuti % 60) / 5 * 5 } set: { minuti = (minuti / 60) * 60 + $0 }
    }
}
