// 使い方: swift normalize.swift <入力> <出力.jpg> [下端カット率 0〜0.3]
// 被写体（バイク）だけを切り抜き、白背景 1200x900 の同じレイアウトに配置する
import Foundation
import Vision
import CoreImage
import CoreImage.CIFilterBuiltins
import AppKit

let args = CommandLine.arguments
guard args.count >= 3 else { print("usage: in out [bottomCrop]"); exit(1) }
let inURL = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])
let bottomCrop = args.count > 3 ? Double(args[3]) ?? 0 : 0

guard var input = CIImage(contentsOf: inURL) else { print("cannot read"); exit(1) }
if bottomCrop > 0 {
  let e = input.extent
  let cut = e.height * bottomCrop
  input = input.cropped(to: CGRect(x: e.minX, y: e.minY + cut, width: e.width, height: e.height - cut))
    .transformed(by: CGAffineTransform(translationX: 0, y: -cut))
}
// 透過PNGは白に敷く
let flat = input.composited(over: CIImage(color: .white).cropped(to: input.extent))

let ctx = CIContext()
guard let cg = ctx.createCGImage(flat, from: flat.extent) else { exit(1) }
let req = VNGenerateForegroundInstanceMaskRequest()
let handler = VNImageRequestHandler(cgImage: cg)
try handler.perform([req])
guard let obs = req.results?.first else { print("no subject"); exit(2) }
let maskBuf = try obs.generateScaledMaskForImage(forInstances: obs.allInstances, from: handler)
let mask = CIImage(cvPixelBuffer: maskBuf)

// マスクの範囲（バウンディングボックス）を求める
let w = CVPixelBufferGetWidth(maskBuf), h = CVPixelBufferGetHeight(maskBuf)
CVPixelBufferLockBaseAddress(maskBuf, .readOnly)
let base = CVPixelBufferGetBaseAddress(maskBuf)!.assumingMemoryBound(to: Float32.self)
let rowFloats = CVPixelBufferGetBytesPerRow(maskBuf) / 4
var minX = w, minY = h, maxX = 0, maxY = 0
for y in 0..<h { for x in 0..<w where base[y * rowFloats + x] > 0.5 {
  if x < minX { minX = x }; if x > maxX { maxX = x }; if y < minY { minY = y }; if y > maxY { maxY = y }
} }
CVPixelBufferUnlockBaseAddress(maskBuf, .readOnly)
// CIImage は下原点なので y を反転
let box = CGRect(x: CGFloat(minX), y: CGFloat(h - 1 - maxY), width: CGFloat(maxX - minX + 1), height: CGFloat(maxY - minY + 1))

let cutout = flat.applyingFilter("CIBlendWithMask", parameters: [
  kCIInputBackgroundImageKey: CIImage(color: .clear).cropped(to: flat.extent),
  kCIInputMaskImageKey: mask
]).cropped(to: box)

// 1200x900 のキャンバスに、幅1000・高さ690以内で配置。接地面をそろえる
let W: CGFloat = 1200, H: CGFloat = 900
let scale = min(1000 / box.width, 690 / box.height)
let dw = box.width * scale, dh = box.height * scale
let ox = (W - dw) / 2, oy: CGFloat = 110   // 下から110pxを地面に
let placed = cutout
  .transformed(by: CGAffineTransform(translationX: -box.minX, y: -box.minY))
  .transformed(by: CGAffineTransform(scaleX: scale, y: scale))
  .transformed(by: CGAffineTransform(translationX: ox, y: oy))

// 足元のやわらかい影
let shadow = CIImage(color: CIColor(red: 0, green: 0, blue: 0, alpha: 0.12))
  .cropped(to: CGRect(x: ox + dw * 0.08, y: oy - 6, width: dw * 0.84, height: 16))
  .applyingGaussianBlur(sigma: 14)

let canvas = CIImage(color: .white).cropped(to: CGRect(x: 0, y: 0, width: W, height: H))
let out = placed.composited(over: shadow.composited(over: canvas)).cropped(to: canvas.extent)
let cs = CGColorSpace(name: CGColorSpace.sRGB)!
try ctx.writeJPEGRepresentation(of: out, to: outURL, colorSpace: cs,
  options: [kCGImageDestinationLossyCompressionQuality as CIImageRepresentationOption: 0.86])
print("ok \(args[2]) box=\(Int(box.width))x\(Int(box.height)) scale=\(String(format: "%.2f", scale))")
