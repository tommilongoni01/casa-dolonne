import Foundation
import CoreGraphics
// Elenca per pagina: rettangoli delle immagini (Do) con clip, e bbox dei tracciati disegnati.
struct GS { var ctm = CGAffineTransform.identity; var clip: CGRect? = nil }
final class State {
    var stack: [GS] = [GS()]
    var path: [CGPoint] = []
    var pathIsRect = false
    var pendingClip = false
    var subpaths = 0
    var images: [(CGRect, CGRect?)] = []
    var shapes: [(CGRect, Bool, String)] = []   // bbox, isRect, op
    var gs: GS { get { stack[stack.count-1] } set { stack[stack.count-1] = newValue } }
}
func pop(_ s: CGPDFScannerRef) -> CGFloat { var v: CGPDFReal = 0; CGPDFScannerPopNumber(s, &v); return CGFloat(v) }
func st(_ info: UnsafeMutableRawPointer?) -> State { Unmanaged<State>.fromOpaque(info!).takeUnretainedValue() }
func bbox(_ pts: [CGPoint]) -> CGRect {
    guard let f = pts.first else { return .null }
    var r = CGRect(origin: f, size: .zero); for p in pts { r = r.union(CGRect(origin: p, size: .zero)) }; return r
}
let table = CGPDFOperatorTableCreate()!
CGPDFOperatorTableSetCallback(table, "q") { _, i in let s = st(i); s.stack.append(s.gs) }
CGPDFOperatorTableSetCallback(table, "Q") { _, i in let s = st(i); if s.stack.count > 1 { s.stack.removeLast() } }
CGPDFOperatorTableSetCallback(table, "cm") { sc, i in
    let s = st(i); let f = pop(sc), e = pop(sc), d = pop(sc), c = pop(sc), b = pop(sc), a = pop(sc)
    s.gs.ctm = CGAffineTransform(a: a, b: b, c: c, d: d, tx: e, ty: f).concatenating(s.gs.ctm)
}
CGPDFOperatorTableSetCallback(table, "m") { sc, i in let s = st(i); let y = pop(sc), x = pop(sc); s.path.append(CGPoint(x: x, y: y).applying(s.gs.ctm)); s.subpaths += 1; s.pathIsRect = false }
CGPDFOperatorTableSetCallback(table, "l") { sc, i in let s = st(i); let y = pop(sc), x = pop(sc); s.path.append(CGPoint(x: x, y: y).applying(s.gs.ctm)) }
CGPDFOperatorTableSetCallback(table, "c") { sc, i in let s = st(i); var p: [CGPoint] = []; for _ in 0..<3 { let y = pop(sc), x = pop(sc); p.append(CGPoint(x: x, y: y).applying(s.gs.ctm)) }; s.path += p }
CGPDFOperatorTableSetCallback(table, "v") { sc, i in let s = st(i); for _ in 0..<2 { let y = pop(sc), x = pop(sc); s.path.append(CGPoint(x: x, y: y).applying(s.gs.ctm)) } }
CGPDFOperatorTableSetCallback(table, "y") { sc, i in let s = st(i); for _ in 0..<2 { let y = pop(sc), x = pop(sc); s.path.append(CGPoint(x: x, y: y).applying(s.gs.ctm)) } }
CGPDFOperatorTableSetCallback(table, "re") { sc, i in
    let s = st(i); let h = pop(sc), w = pop(sc), y = pop(sc), x = pop(sc)
    let r = CGRect(x: x, y: y, width: w, height: h).applying(s.gs.ctm)
    s.path += [CGPoint(x: r.minX, y: r.minY), CGPoint(x: r.maxX, y: r.maxY)]; s.pathIsRect = s.subpaths == 0; s.subpaths += 1
}
CGPDFOperatorTableSetCallback(table, "W") { _, i in st(i).pendingClip = true }
CGPDFOperatorTableSetCallback(table, "W*") { _, i in st(i).pendingClip = true }
func endPath(_ i: UnsafeMutableRawPointer?, _ op: String) {
    let s = st(i); let b = bbox(s.path)
    if s.pendingClip { s.gs.clip = s.gs.clip.map { $0.intersection(b) } ?? b; s.pendingClip = false }
    if op != "n" && !b.isNull { s.shapes.append((b, s.pathIsRect, op)) }
    s.path = []; s.subpaths = 0; s.pathIsRect = false
}
for op in ["S","s","f","F","f*","B","B*","b","b*","n"] {
    switch op {
    case "S": CGPDFOperatorTableSetCallback(table, "S") { _, i in endPath(i, "S") }
    case "s": CGPDFOperatorTableSetCallback(table, "s") { _, i in endPath(i, "s") }
    case "f": CGPDFOperatorTableSetCallback(table, "f") { _, i in endPath(i, "f") }
    case "F": CGPDFOperatorTableSetCallback(table, "F") { _, i in endPath(i, "F") }
    case "f*": CGPDFOperatorTableSetCallback(table, "f*") { _, i in endPath(i, "f*") }
    case "B": CGPDFOperatorTableSetCallback(table, "B") { _, i in endPath(i, "B") }
    case "B*": CGPDFOperatorTableSetCallback(table, "B*") { _, i in endPath(i, "B*") }
    case "b": CGPDFOperatorTableSetCallback(table, "b") { _, i in endPath(i, "b") }
    case "b*": CGPDFOperatorTableSetCallback(table, "b*") { _, i in endPath(i, "b*") }
    default: CGPDFOperatorTableSetCallback(table, "n") { _, i in endPath(i, "n") }
    }
}
CGPDFOperatorTableSetCallback(table, "Do") { sc, i in
    let s = st(i); var name: UnsafePointer<CChar>?; CGPDFScannerPopName(sc, &name)
    let r = CGRect(x: 0, y: 0, width: 1, height: 1).applying(s.gs.ctm)
    if r.width > 20 && r.height > 20 { s.images.append((r, s.gs.clip)) }
}
let doc = CGPDFDocument(URL(fileURLWithPath: CommandLine.arguments[1]) as CFURL)!
var out: [[String: Any]] = []
for n in 1...doc.numberOfPages {
    let page = doc.page(at: n)!
    let state = State()
    let cs = CGPDFContentStreamCreateWithPage(page)
    let scanner = CGPDFScannerCreate(cs, table, Unmanaged.passUnretained(state).toOpaque())
    CGPDFScannerScan(scanner)
    let box = page.getBoxRect(.mediaBox)
    func j(_ r: CGRect) -> [Int] { [Int(r.minX), Int(box.height - r.maxY), Int(r.width), Int(r.height)] } // top-left origin
    let imgs = state.images.map { (r, c) -> [Int] in j(c.map { r.intersection($0) } ?? r) }
    let shapes = state.shapes.filter { $0.0.width < box.width * 0.95 }.map { ["r": j($0.0), "rect": $0.1, "op": $0.2] as [String: Any] }
    out.append(["page": n, "h": Int(box.height), "w": Int(box.width), "images": imgs, "shapes": shapes])
}
print(String(data: try! JSONSerialization.data(withJSONObject: out), encoding: .utf8)!)
