/**
 * QR code generation.
 *
 * `qrcode-generator` is imported dynamically so it stays out of the initial
 * bundle. The library only produces the module grid; the SVG is built here so
 * the size, margin and colours stay under our control.
 */

export type ErrorLevel = 'L' | 'M' | 'Q' | 'H'

export interface QrMatrix {
  /** Number of modules per side. */
  size: number
  /** `dark[row][col]` — true means a filled module. */
  dark: boolean[][]
}

export class QrError extends Error {}

/**
 * Encode a string as UTF-8 bytes.
 *
 * The package's ESM build drops the optional UTF-8 helper and falls back to
 * Latin-1, which mangles anything non-ASCII. Encoding here keeps accented
 * text and emoji correct without pulling in the extra file.
 */
export function toUtf8Bytes(text: string): number[] {
  const bytes: number[] = []
  for (const char of text) {
    const code = char.codePointAt(0) as number
    if (code < 0x80) {
      bytes.push(code)
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      )
    }
  }
  return bytes
}

export async function buildMatrix(text: string, level: ErrorLevel = 'M'): Promise<QrMatrix> {
  if (!text) throw new QrError('Enter something to encode.')

  const { default: qrcode } = await import('qrcode-generator')
  qrcode.stringToBytes = toUtf8Bytes

  const qr = qrcode(0, level)
  qr.addData(text, 'Byte')
  qr.make()

  const size = qr.getModuleCount()
  const dark: boolean[][] = []
  for (let row = 0; row < size; row++) {
    const cells: boolean[] = []
    for (let col = 0; col < size; col++) cells.push(qr.isDark(row, col))
    dark.push(cells)
  }
  return { size, dark }
}

export interface SvgOptions {
  margin?: number
  dark?: string
  light?: string
}

/**
 * Render the matrix as a crisp, scalable SVG. A single `<path>` keeps the
 * output small and avoids thousands of `<rect>` elements.
 */
export function toSvg(matrix: QrMatrix, options: SvgOptions = {}): string {
  const margin = options.margin ?? 2
  const dark = options.dark ?? '#000000'
  const light = options.light ?? '#ffffff'
  const dimension = matrix.size + margin * 2

  let path = ''
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (matrix.dark[row][col]) path += `M${col + margin} ${row + margin}h1v1h-1z`
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimension} ${dimension}" ` +
    `shape-rendering="crispEdges" role="img" aria-label="QR code">` +
    `<rect width="${dimension}" height="${dimension}" fill="${light}"/>` +
    `<path d="${path}" fill="${dark}"/>` +
    `</svg>`
  )
}

/** Draw the matrix onto a canvas and return a PNG blob. Used for downloads. */
export function toCanvas(matrix: QrMatrix, pixelSize = 512, options: SvgOptions = {}): HTMLCanvasElement {
  const margin = options.margin ?? 2
  const dark = options.dark ?? '#000000'
  const light = options.light ?? '#ffffff'
  const dimension = matrix.size + margin * 2
  const scale = Math.max(1, Math.floor(pixelSize / dimension))
  const px = dimension * scale

  const canvas = document.createElement('canvas')
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new QrError('This browser cannot draw to a canvas.')

  ctx.fillStyle = light
  ctx.fillRect(0, 0, px, px)
  ctx.fillStyle = dark
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (matrix.dark[row][col]) {
        ctx.fillRect((col + margin) * scale, (row + margin) * scale, scale, scale)
      }
    }
  }
  return canvas
}
