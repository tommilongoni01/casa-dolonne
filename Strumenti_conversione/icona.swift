import AppKit
// Disegna l'icona di Casa Dolonne: chalet in legno davanti alle montagne innevate.
// uso: icona <cartella di uscita>
let uscita = CommandLine.arguments[1]
let lato: CGFloat = 1024

struct Tavolozza {
    var cieloAlto: NSColor, cieloBasso: NSColor
    var monti: NSColor, montiNeve: NSColor, montePrincipale: NSColor
    var sole: NSColor, legno: NSColor, legnoScuro: NSColor, tetto: NSColor
    var finestra: NSColor, neve: NSColor
}
func c(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat, _ a: CGFloat = 1) -> NSColor { NSColor(srgbRed: r/255, green: g/255, blue: b/255, alpha: a) }

let chiara = Tavolozza(cieloAlto: c(52, 150, 170), cieloBasso: c(18, 86, 104),
                       monti: c(120, 178, 190), montiNeve: c(236, 246, 248), montePrincipale: c(214, 234, 239),
                       sole: c(255, 214, 128, 0.95), legno: c(196, 128, 68), legnoScuro: c(150, 92, 46), tetto: c(84, 52, 36),
                       finestra: c(255, 211, 120), neve: c(250, 252, 253))
let scura = Tavolozza(cieloAlto: c(16, 44, 56), cieloBasso: c(4, 16, 22),
                      monti: c(46, 82, 94), montiNeve: c(170, 196, 204), montePrincipale: c(120, 150, 160),
                      sole: c(232, 236, 220, 0.9), legno: c(150, 96, 52), legnoScuro: c(112, 68, 34), tetto: c(56, 34, 24),
                      finestra: c(255, 196, 92), neve: c(196, 214, 220))

func poligono(_ punti: [CGPoint], _ colore: NSColor) {
    let p = NSBezierPath(); p.move(to: punti[0]); for q in punti.dropFirst() { p.line(to: q) }; p.close()
    colore.setFill(); p.fill()
}
// Coordinate con origine in basso a sinistra (AppKit).
func disegna(_ t: Tavolozza) {
    NSGradient(starting: t.cieloAlto, ending: t.cieloBasso)!.draw(in: NSRect(x: 0, y: 0, width: lato, height: lato), angle: -90)
    // sole / luna
    t.sole.setFill(); NSBezierPath(ovalIn: NSRect(x: 690, y: 700, width: 150, height: 150)).fill()
    // montagne dietro
    poligono([CGPoint(x: -40, y: 360), CGPoint(x: 230, y: 700), CGPoint(x: 470, y: 420), CGPoint(x: 700, y: 650), CGPoint(x: 1064, y: 330), CGPoint(x: 1064, y: 0), CGPoint(x: -40, y: 0)], t.monti)
    poligono([CGPoint(x: 230, y: 700), CGPoint(x: 172, y: 628), CGPoint(x: 205, y: 640), CGPoint(x: 232, y: 612), CGPoint(x: 262, y: 642), CGPoint(x: 290, y: 626)], t.montiNeve)
    poligono([CGPoint(x: 700, y: 650), CGPoint(x: 640, y: 597), CGPoint(x: 672, y: 606), CGPoint(x: 702, y: 582), CGPoint(x: 735, y: 606), CGPoint(x: 768, y: 590)], t.montiNeve)
    // montagna principale
    poligono([CGPoint(x: 120, y: 250), CGPoint(x: 512, y: 810), CGPoint(x: 904, y: 250)], t.montePrincipale)
    poligono([CGPoint(x: 512, y: 810), CGPoint(x: 420, y: 678), CGPoint(x: 470, y: 700), CGPoint(x: 512, y: 660), CGPoint(x: 556, y: 702), CGPoint(x: 604, y: 678)], t.montiNeve)
    // terreno innevato
    let terreno = NSBezierPath()
    terreno.move(to: CGPoint(x: 0, y: 300))
    terreno.curve(to: CGPoint(x: lato, y: 290), controlPoint1: CGPoint(x: 300, y: 360), controlPoint2: CGPoint(x: 720, y: 230))
    terreno.line(to: CGPoint(x: lato, y: 0)); terreno.line(to: CGPoint(x: 0, y: 0)); terreno.close()
    t.neve.setFill(); terreno.fill()
    // chalet: corpo
    let corpo = NSRect(x: 352, y: 200, width: 320, height: 210)
    t.legno.setFill(); NSBezierPath(rect: corpo).fill()
    // assi orizzontali
    t.legnoScuro.setFill()
    for i in 1..<5 { NSBezierPath(rect: NSRect(x: corpo.minX, y: corpo.minY + CGFloat(i) * 42, width: corpo.width, height: 6)).fill() }
    // tetto a capanna sporgente
    poligono([CGPoint(x: 300, y: 392), CGPoint(x: 512, y: 590), CGPoint(x: 724, y: 392), CGPoint(x: 690, y: 392), CGPoint(x: 512, y: 556), CGPoint(x: 334, y: 392)], t.tetto)
    poligono([CGPoint(x: 334, y: 392), CGPoint(x: 512, y: 556), CGPoint(x: 690, y: 392)], t.legno)
    // neve sul tetto
    poligono([CGPoint(x: 292, y: 384), CGPoint(x: 512, y: 600), CGPoint(x: 732, y: 384), CGPoint(x: 716, y: 378), CGPoint(x: 512, y: 576), CGPoint(x: 308, y: 378)], t.neve)
    // finestra nel timpano
    t.finestra.setFill(); NSBezierPath(roundedRect: NSRect(x: 474, y: 430, width: 76, height: 70), xRadius: 6, yRadius: 6).fill()
    t.tetto.setFill(); NSBezierPath(rect: NSRect(x: 509, y: 430, width: 6, height: 70)).fill()
    // finestre e porta
    t.finestra.setFill()
    NSBezierPath(roundedRect: NSRect(x: 386, y: 280, width: 70, height: 62), xRadius: 6, yRadius: 6).fill()
    NSBezierPath(roundedRect: NSRect(x: 568, y: 280, width: 70, height: 62), xRadius: 6, yRadius: 6).fill()
    t.tetto.setFill(); NSBezierPath(roundedRect: NSRect(x: 478, y: 200, width: 68, height: 118), xRadius: 8, yRadius: 8).fill()
    // neve davanti
    let davanti = NSBezierPath()
    davanti.move(to: CGPoint(x: 0, y: 170))
    davanti.curve(to: CGPoint(x: lato, y: 200), controlPoint1: CGPoint(x: 340, y: 230), controlPoint2: CGPoint(x: 680, y: 150))
    davanti.line(to: CGPoint(x: lato, y: 0)); davanti.line(to: CGPoint(x: 0, y: 0)); davanti.close()
    t.neve.setFill(); davanti.fill()
}

/// Disegna in un'immagine sRGB opaca (le icone non devono avere trasparenza) e salva il PNG.
func salva(_ t: Tavolozza, _ nome: String, grigio: Bool = false) {
    let ctx = CGContext(data: nil, width: Int(lato), height: Int(lato), bitsPerComponent: 8, bytesPerRow: 0,
                        space: CGColorSpace(name: CGColorSpace.sRGB)!,
                        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx, flipped: false)
    disegna(t)
    NSGraphicsContext.restoreGraphicsState()
    var immagine = ctx.makeImage()!
    if grigio {
        let g = CGContext(data: nil, width: Int(lato), height: Int(lato), bitsPerComponent: 8, bytesPerRow: 0,
                          space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue)!
        g.draw(immagine, in: CGRect(x: 0, y: 0, width: lato, height: lato))
        immagine = g.makeImage()!
    }
    let rep = NSBitmapImageRep(cgImage: immagine)
    try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "\(uscita)/\(nome)"))
}

salva(chiara, "icona-chiara.png")
salva(scura, "icona-scura.png")
salva(chiara, "icona-tinta.png", grigio: true)
print("ok")
