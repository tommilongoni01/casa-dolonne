import AppKit
// usage: sheet <out.png> files...
let a = Array(CommandLine.arguments.dropFirst())
let out = a[0]; let files = Array(a.dropFirst())
let cols = 4, cellW: CGFloat = 420, cellH: CGFloat = 300
let rows = (files.count + cols - 1) / cols
let size = NSSize(width: CGFloat(cols) * cellW, height: CGFloat(rows) * cellH)
let img = NSImage(size: size)
img.lockFocus()
NSColor.white.setFill(); NSRect(origin: .zero, size: size).fill()
for (i, f) in files.enumerated() {
    let c = i % cols, r = i / cols
    let x = CGFloat(c) * cellW, y = size.height - CGFloat(r + 1) * cellH
    if let im = NSImage(contentsOfFile: f) {
        let s = min((cellW - 10) / im.size.width, (cellH - 30) / im.size.height)
        let w = im.size.width * s, h = im.size.height * s
        im.draw(in: NSRect(x: x + 5, y: y + 25, width: w, height: h))
        NSColor.red.setStroke(); NSBezierPath(rect: NSRect(x: x + 5, y: y + 25, width: w, height: h)).stroke()
    }
    (URL(fileURLWithPath: f).lastPathComponent as NSString).draw(at: NSPoint(x: x + 5, y: y + 5), withAttributes: [.font: NSFont.boldSystemFont(ofSize: 16)])
}
img.unlockFocus()
let rep = NSBitmapImageRep(data: img.tiffRepresentation!)!
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: out))
