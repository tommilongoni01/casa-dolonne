import Foundation
import PDFKit
import AppKit
// usage: figures <pdf> <scan.json> <outdir> <prefix>
// Per ogni immagine: ritaglio (immagine + frecce/cerchi + etichette collegate), didascalie dai riquadri con bordo.
let a = CommandLine.arguments
let pdf = PDFDocument(url: URL(fileURLWithPath: a[1]))!
let scan = try! JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: a[2]))) as! [[String: Any]]
let outDir = a[3], prefix = a[4]
let scale: CGFloat = 4
func rect(_ v: Any) -> CGRect {
    let n: [Int] = v as! [Int]
    let x = CGFloat(n[0]), y = CGFloat(n[1]), w = CGFloat(n[2]), h = CGFloat(n[3])
    return CGRect(x: x, y: y, width: w, height: h)
}
var result: [[String: Any]] = []
var counter = 0
for p in scan {
    let pageNo = p["page"] as! Int
    let page = pdf.page(at: pageNo - 1)!
    let H = CGFloat(p["h"] as! Int), Wd = CGFloat(p["w"] as! Int)
    func ordina(_ l: CGRect, _ r: CGRect) -> Bool {
        let dy: CGFloat = abs(l.minY - r.minY)
        if dy > 5 { return l.minY < r.minY }
        return l.minX < r.minX
    }
    let rawImages: [Any] = p["images"] as! [Any]
    let images: [CGRect] = rawImages.map(rect).sorted(by: ordina)
    let rawShapes: [[String: Any]] = p["shapes"] as! [[String: Any]]
    let shapes: [(CGRect, String)] = rawShapes.map { (d: [String: Any]) -> (CGRect, String) in (rect(d["r"]!), d["op"] as! String) }
    // riquadri didascalia: stesso rettangolo sia riempito che bordato, fuori dalle immagini
    var boxes: [CGRect] = []
    for (r, op) in shapes where op == "S" {
        if shapes.contains(where: { $0.1 == "f" && $0.0.equalTo(r) }), !images.contains(where: { $0.intersects(r.insetBy(dx: 2, dy: 2)) }) {
            if !boxes.contains(where: { $0.equalTo(r) }) { boxes.append(r) }
        }
    }
    let overlays = shapes.filter { (r, op) in
        !boxes.contains(where: { $0.equalTo(r) }) && r.width < Wd * 0.9
            && !(op != "S" && (r.width < 1.5 || r.height < 1.5))
            && !images.contains(where: { $0.contains(r) && op == "f" && r.width > $0.width * 0.95 })
    }.map(\.0)
    // righe di testo della pagina (coordinate con origine in alto)
    var lines: [(CGRect, String)] = []
    if let sel = page.selection(for: page.bounds(for: .mediaBox)) {
        for l in sel.selectionsByLine() {
            let b = l.bounds(for: page); let s = (l.string ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            if s.isEmpty { continue }
            let r = CGRect(x: b.minX, y: H - b.maxY, width: b.width, height: b.height)
            if r.minY > H - 60 { continue } // piè di pagina
            lines.append((r, s))
        }
    }
    func textIn(_ box: CGRect) -> String {
        lines.filter { box.insetBy(dx: -1, dy: -1).contains(CGPoint(x: $0.0.midX, y: $0.0.midY)) }.map(\.1).joined(separator: " ")
    }
    var usedOverlay = Set<Int>(), usedLine = Set<Int>()
    for img in images {
        var region = img
        var labels: [String] = []
        var changed = true
        while changed {
            changed = false
            for (i, o) in overlays.enumerated() where !usedOverlay.contains(i) && o.intersects(region.insetBy(dx: -6, dy: -6)) {
                region = region.union(o); usedOverlay.insert(i); changed = true
            }
            for (i, l) in lines.enumerated() where !usedLine.contains(i) {
                let centro = CGPoint(x: l.0.midX, y: l.0.midY)
                if boxes.contains(where: { $0.contains(centro) }) { continue }
                if img.contains(centro) { usedLine.insert(i); continue }
                // etichette sopra l'immagine: solo se delle frecce salgono oltre il bordo superiore
                let sopra = region.minY < img.minY - 4 && centro.y >= region.minY - 14 && centro.y <= img.minY
                // etichette a lato: nella fascia verticale dell'immagine e toccate da una freccia
                let toccata = overlays.enumerated().contains { usedOverlay.contains($0.offset) && $0.element.intersects(l.0.insetBy(dx: -6, dy: -6)) }
                let aLato = centro.y > img.minY && centro.y < img.maxY && toccata
                // etichette sotto: toccate da una freccia che parte dall'immagine
                let sotto = centro.y >= img.maxY && centro.y <= region.maxY + 14 && toccata
                if sopra || aLato || sotto {
                    region = region.union(l.0); usedLine.insert(i); labels.append(l.1); changed = true
                }
            }
        }
        // tutto il testo finito dentro il ritaglio (fuori dallo screenshot) conta come etichetta
        labels = lines.filter { l in
            let c = CGPoint(x: l.0.midX, y: l.0.midY)
            return region.contains(c) && !img.contains(c) && !boxes.contains(where: { $0.contains(c) })
        }.map(\.1)
        let captions = boxes.filter { b in
            let overlap = min(b.maxY, img.maxY) - max(b.minY, img.minY)
            return overlap > 0
        }.sorted { $0.minY < $1.minY }.map(textIn).filter { !$0.isEmpty }
        region = region.insetBy(dx: -4, dy: -4).intersection(CGRect(x: 0, y: 0, width: Wd, height: H))
        // render del ritaglio
        let size = NSSize(width: region.width * scale, height: region.height * scale)
        let im = NSImage(size: size)
        im.lockFocus()
        let ctx = NSGraphicsContext.current!.cgContext
        ctx.setFillColor(.white); ctx.fill(CGRect(origin: .zero, size: size))
        ctx.scaleBy(x: scale, y: scale)
        ctx.translateBy(x: -region.minX, y: -(H - region.maxY))
        page.draw(with: .mediaBox, to: ctx)
        im.unlockFocus()
        counter += 1
        let name = String(format: "%@_%02d.jpg", prefix, counter)
        var rep = NSBitmapImageRep(data: im.tiffRepresentation!)!
        // ridimensiona a massimo 1600 px di larghezza
        if rep.pixelsWide > 1600 {
            let f = 1600 / CGFloat(rep.pixelsWide)
            let small = NSImage(size: NSSize(width: CGFloat(rep.pixelsWide) * f, height: CGFloat(rep.pixelsHigh) * f))
            small.lockFocus(); NSImage(data: rep.tiffRepresentation!)!.draw(in: NSRect(origin: .zero, size: small.size)); small.unlockFocus()
            rep = NSBitmapImageRep(data: small.tiffRepresentation!)!
        }
        try! rep.representation(using: .jpeg, properties: [NSBitmapImageRep.PropertyKey.compressionFactor: 0.82])!.write(to: URL(fileURLWithPath: "\(outDir)/\(name)"))
        result.append(["file": name, "page": pageNo, "captions": captions, "labels": labels])
    }
}
print(String(data: try! JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted]), encoding: .utf8)!)
