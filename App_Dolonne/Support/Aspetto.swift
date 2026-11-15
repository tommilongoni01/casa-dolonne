import SwiftUI

/// Tema scelto nelle Impostazioni.
enum Aspetto: String, CaseIterable, Identifiable {
    case automatico
    case chiaro
    case scuro

    var id: String { rawValue }

    var nome: LocalizedStringResource {
        switch self {
        case .automatico: "Automatico"
        case .chiaro: "Chiaro"
        case .scuro: "Scuro"
        }
    }

    var schema: ColorScheme? {
        switch self {
        case .automatico: nil
        case .chiaro: .light
        case .scuro: .dark
        }
    }
}

extension Sezione {
    /// Colore dell'icona del sistema, come le icone dell'app Impostazioni di iOS.
    var colore: Color {
        switch icona {
        case "drop.fill", "shower.fill": .blue
        case "bolt.fill", "lightbulb.fill": .yellow
        case "flame.fill": .orange
        case "book.closed.fill": .gray
        case "sun.max.fill": .green
        case "figure.pool.swim", "snowflake": .cyan
        case "arrow.up.arrow.down.square.fill": .indigo
        case "fan.fill", "thermometer.medium": .teal
        case "wind", "leaf.fill": .mint
        case "lock.fill", "wifi", "tv.fill": .purple
        case "car.fill", "house.fill": .brown
        default: .accentColor
        }
    }
}

/// Icona quadrata arrotondata con simbolo bianco, come nelle liste di Impostazioni.
struct IconaQuadrata: View {
    let simbolo: String
    let colore: Color
    var dimensione: CGFloat = 30

    var body: some View {
        Image(systemName: simbolo)
            .font(.system(size: dimensione * 0.52, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: dimensione, height: dimensione)
            .background(colore.gradient, in: .rect(cornerRadius: dimensione * 0.24))
            .accessibilityHidden(true)
    }
}
