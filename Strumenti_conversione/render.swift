import PDFKit
import AppKit
// usage: render <pdf> <outdir> <scale>
let args = CommandLine.arguments
let doc = PDFDocument(url: URL(fileURLWithPath: args[1]))!
let scale = CGFloat(Double(args[3]) ?? 1.5)
for i in 0..<doc.pageCount {
    let page = doc.page(at: i)!
    let r = page.bounds(for: .mediaBox)
    let size = NSSize(width: r.width * scale, height: r.height * scale)
    let img = NSImage(size: size)
    img.lockFocus()
    let ctx = NSGraphicsContext.current!.cgContext
    ctx.setFillColor(.white); ctx.fill(CGRect(origin: .zero, size: size))
    ctx.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: ctx)
    img.unlockFocus()
    let rep = NSBitmapImageRep(data: img.tiffRepresentation!)!
    try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "\(args[2])/p\(String(format: "%02d", i+1)).png"))
}
print("pages:", doc.pageCount)
