// Logo della web app da una foto: ritaglio quadrato, luce e colori più vivi, PNG 1024 px.
// Uso: swift logo_da_foto.swift foto.jpg uscita.png x y lato
//      (x, y = angolo in alto a sinistra del quadrato in pixel della foto; il quadrato può uscire
//       sopra la foto: il cielo viene esteso ripetendo i bordi.)
import CoreImage
import CoreImage.CIFilterBuiltins
import Foundation
import ImageIO
import UniformTypeIdentifiers

let argomenti = CommandLine.arguments
guard argomenti.count == 6, let x = Double(argomenti[3]), let yAlto = Double(argomenti[4]), let lato = Double(argomenti[5]),
      let foto = CIImage(contentsOf: URL(fileURLWithPath: argomenti[1]), options: [.applyOrientationProperty: true]) else {
    print("uso: swift logo_da_foto.swift foto.jpg uscita.png x y lato"); exit(1)
}

// Core Image ha l'origine in basso a sinistra.
let altezza = foto.extent.height
let quadrato = CGRect(x: x, y: altezza - yAlto - lato, width: lato, height: lato)
var immagine = foto.clampedToExtent().cropped(to: quadrato)
    .transformed(by: CGAffineTransform(translationX: -quadrato.minX, y: -quadrato.minY))

let esposizione = CIFilter.exposureAdjust()
esposizione.inputImage = immagine
esposizione.ev = 0.45
immagine = esposizione.outputImage!

let colori = CIFilter.vibrance()
colori.inputImage = immagine
colori.amount = 0.35
immagine = colori.outputImage!

let scala = 1024 / lato
immagine = immagine.transformed(by: CGAffineTransform(scaleX: scala, y: scala))
    .cropped(to: CGRect(x: 0, y: 0, width: 1024, height: 1024))

let nitidezza = CIFilter.unsharpMask()
nitidezza.inputImage = immagine
nitidezza.radius = 1.5
nitidezza.intensity = 0.5
immagine = nitidezza.outputImage!.cropped(to: CGRect(x: 0, y: 0, width: 1024, height: 1024))

let contesto = CIContext()
let spazio = CGColorSpace(name: CGColorSpace.sRGB)!
guard let cg = contesto.createCGImage(immagine, from: immagine.extent, format: .RGBA8, colorSpace: spazio),
      let destinazione = CGImageDestinationCreateWithURL(URL(fileURLWithPath: argomenti[2]) as CFURL, UTType.png.identifier as CFString, 1, nil) else {
    print("errore nella creazione dell'immagine"); exit(1)
}
CGImageDestinationAddImage(destinazione, cg, nil)
CGImageDestinationFinalize(destinazione)
print("salvato \(argomenti[2])")
