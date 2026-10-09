/**
 * Barcode symbologies.
 *
 * Two encoders, both dependency-free: Code 128 (sets B and C, with automatic
 * set selection so digit runs stay compact) and EAN-13. Each returns a module
 * string — '1' is a bar, '0' is a space — which the SVG and canvas renderers
 * turn into a picture. Keeping the encoders to a module string keeps them
 * testable without a DOM.
 */

export class BarcodeError extends Error {}

export type Symbology = 'code128' | 'ean13'

/* -------------------------------------------------------------------------
   Code 128
   ------------------------------------------------------------------------- */

/**
 * Module patterns for the 107 Code 128 symbols, indexed by codepoint. The
 * first 103 are the data symbols, 103–105 the start codes A/B/C, and 106 the
 * stop pattern. Each is six alternating bars/spaces, except the stop which
 * carries a trailing 2-module bar.
 */
const CODE128_PATTERNS: string[] = [
  '11011001100', '11001101100', '11001100110', '10010011000', '10010001100', '10001001100',
  '10011001000', '10011000100', '10001100100', '11001001000', '11001000100', '11000100100',
  '10110011100', '10011011100', '10011001110', '10111001100', '10011101100', '10011100110',
  '11001110010', '11001011100', '11001001110', '11011100100', '11001110100', '11101101110',
  '11101001100', '11100101100', '11100100110', '11101100100', '11100110100', '11100110010',
  '11011011000', '11011000110', '11000110110', '10100011000', '10001011000', '10001000110',
  '10110001000', '10001101000', '10001100010', '11010001000', '11000101000', '11000100010',
  '10110111000', '10110001110', '10001101110', '10111011000', '10111000110', '10001110110',
  '11101110110', '11010001110', '11000101110', '11011101000', '11011100010', '11011101110',
  '11101011000', '11101000110', '11100010110', '11101101000', '11101100010', '11100011010',
  '11101111010', '11001000010', '11110001010', '10100110000', '10100001100', '10010110000',
  '10010000110', '10000101100', '10000100110', '10110010000', '10110000100', '10011010000',
  '10011000010', '10000110100', '10000110010', '11000010010', '11001010000', '11110111010',
  '11000010100', '10001111010', '10100111100', '10010111100', '10010011110', '10111100100',
  '10011110100', '10011110010', '11110100100', '11110010100', '11110010010', '11011011110',
  '11011110110', '11110110110', '10101111000', '10100011110', '10001011110', '10111101000',
  '10111100010', '11110101000', '11110100010', '10111011110', '10111101110', '11101011110',
  '11110101110', '11010000100', '11010010000', '11010011100', '1100011101011',
]

const START_B = 104
const START_C = 105
const CODE_B = 100 // switch to set B
const CODE_C = 99 // switch to set C
const STOP = 106

/** Code values 0–94 map to ASCII 32–126; the rest need a control-code escape. */
function codeBValue(char: string): number | null {
  const code = char.charCodeAt(0)
  if (code < 32 || code > 126) return null
  return code - 32
}

/**
 * How many digits start at `index`, but at most two. Set C encodes pairs, so
 * a lone trailing digit cannot use it.
 */
function digitRun(text: string, index: number): number {
  let count = 0
  while (count < 2 && index + count < text.length && text[index + count] >= '0' && text[index + count] <= '9') {
    count++
  }
  return count
}

/** Encode text as Code 128, choosing set C for runs of digits. */
export function encodeCode128(text: string): string {
  if (!text) throw new BarcodeError('Enter something to encode.')
  for (const char of text) {
    if (codeBValue(char) === null) {
      throw new BarcodeError('Code 128 here encodes printable ASCII (32–126) only.')
    }
  }

  const codes: number[] = []
  let index = 0
  // A leading pair of digits lets the whole symbol start in set C.
  let inSetC = text.length >= 2 && digitRun(text, 0) === 2
  codes.push(inSetC ? START_C : START_B)

  while (index < text.length) {
    if (inSetC) {
      const run = digitRun(text, index)
      if (run === 2) {
        codes.push(Number(text.slice(index, index + 2)))
        index += 2
        continue
      }
      // Odd digit left: switch to B for the remainder.
      codes.push(CODE_B)
      inSetC = false
    } else {
      const run = digitRun(text, index)
      if (run === 2) {
        codes.push(CODE_C)
        inSetC = true
        continue
      }
      codes.push(codeBValue(text[index]) as number)
      index += 1
    }
  }

  let checksum = codes[0]
  for (let i = 1; i < codes.length; i++) checksum += codes[i] * i
  checksum %= 103
  codes.push(checksum, STOP)

  return codes.map((code) => CODE128_PATTERNS[code]).join('')
}

/* -------------------------------------------------------------------------
   EAN-13
   ------------------------------------------------------------------------- */

const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const EAN_G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
const EAN_R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100']
const EAN_PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']

/** The EAN-13 check digit for the first twelve digits. */
export function ean13CheckDigit(first12: string): number {
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3)
  return (10 - (sum % 10)) % 10
}

/**
 * Encode an EAN-13. Twelve digits are accepted and the check digit is
 * appended; thirteen are accepted only when the check digit is correct.
 */
export function encodeEan13(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (digits.length !== 12 && digits.length !== 13) {
    throw new BarcodeError('EAN-13 needs 12 digits (the check digit is added) or 13 with a correct check digit.')
  }

  let code = digits
  if (digits.length === 12) {
    code = digits + String(ean13CheckDigit(digits))
  } else if (Number(digits[12]) !== ean13CheckDigit(digits.slice(0, 12))) {
    throw new BarcodeError(`That check digit is wrong; it should be ${ean13CheckDigit(digits.slice(0, 12))}.`)
  }

  const parity = EAN_PARITY[Number(code[0])]
  let modules = '101'
  for (let i = 0; i < 6; i++) {
    modules += (parity[i] === 'L' ? EAN_L : EAN_G)[Number(code[i + 1])]
  }
  modules += '01010'
  for (let i = 7; i < 13; i++) modules += EAN_R[Number(code[i])]
  modules += '101'
  return modules
}

/* -------------------------------------------------------------------------
   Shared helpers
   ------------------------------------------------------------------------- */

/** Normalise a symbology's input, returning the digits/text it will draw. */
export function normaliseInput(symbology: Symbology, input: string): string {
  if (symbology === 'ean13') {
    const digits = input.replace(/\D/g, '')
    return digits.length === 12 ? digits + String(ean13CheckDigit(digits)) : digits
  }
  return input
}

export function encode(symbology: Symbology, input: string): string {
  if (symbology === 'ean13') return encodeEan13(input)
  return encodeCode128(input)
}

/* -------------------------------------------------------------------------
   Rendering
   ------------------------------------------------------------------------- */

/** Module ranges that EAN-13 draws as longer guard bars: lead, centre, trail. */
export const EAN13_GUARDS: [number, number][] = [
  [0, 3],
  [45, 50],
  [92, 95],
]

export interface RenderOptions {
  /** Pixels per module. */
  moduleWidth?: number
  /** Height of the bars at full length. */
  height?: number
  /** Quiet zone on each side, in modules. */
  quietZone?: number
  /** Draw the human-readable text under the bars. */
  showText?: boolean
  text?: string
  dark?: string
  light?: string
}

function inRanges(index: number, ranges: [number, number][]): boolean {
  return ranges.some(([start, end]) => index >= start && index < end)
}

/**
 * Render a module string as an SVG. A single `<path>` keeps the markup small
 * and crisp regardless of size. `guards` marks modules drawn at full height
 * while the rest are shortened to leave room for the text, as EAN expects.
 */
export function modulesToSvg(
  modules: string,
  options: RenderOptions = {},
  guards: [number, number][] = [],
): string {
  const moduleWidth = options.moduleWidth ?? 2
  const height = options.height ?? 90
  const quiet = options.quietZone ?? 10
  const dark = options.dark ?? '#000000'
  const light = options.light ?? '#ffffff'
  const showText = options.showText ?? true
  const textHeight = showText ? 18 : 0
  const totalWidth = (modules.length + quiet * 2) * moduleWidth
  const totalHeight = height + textHeight

  let path = ''
  let index = 0
  while (index < modules.length) {
    if (modules[index] === '1') {
      const start = index
      while (index < modules.length && modules[index] === '1') index++
      const width = (index - start) * moduleWidth
      const barTop = inRanges(start, guards) ? 0 : showText ? textHeight * 1.4 : 0
      path += `M${(start + quiet) * moduleWidth} ${barTop}h${width}v${height - barTop}h-${width}z`
    } else {
      index++
    }
  }

  const text = showText && options.text
    ? `<text x="${totalWidth / 2}" y="${totalHeight - 3}" text-anchor="middle" ` +
      `font-family="ui-monospace, monospace" font-size="13" fill="${dark}">${escapeXml(options.text)}</text>`
    : ''

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" ` +
    `width="${totalWidth}" height="${totalHeight}" role="img" aria-label="Barcode">` +
    `<rect width="${totalWidth}" height="${totalHeight}" fill="${light}"/>` +
    `<path d="${path}" fill="${dark}"/>` +
    text +
    `</svg>`
  )
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"]/g, (char) =>
    char === '&' ? '&amp;' : char === '<' ? '&lt;' : char === '>' ? '&gt;' : '&quot;',
  )
}

/** Draw a module string onto a canvas at a given pixel width. */
export function modulesToCanvas(
  modules: string,
  targetWidth = 900,
  options: RenderOptions = {},
  guards: [number, number][] = [],
): HTMLCanvasElement {
  const quiet = options.quietZone ?? 10
  const showText = options.showText ?? true
  const totalModules = modules.length + quiet * 2
  const scale = Math.max(1, Math.floor(targetWidth / totalModules))
  const width = totalModules * scale
  const barArea = options.height ?? 90
  const textArea = showText ? 20 : 0
  const height = barArea + textArea

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new BarcodeError('This browser cannot draw to a canvas.')

  ctx.fillStyle = options.light ?? '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = options.dark ?? '#000000'

  let index = 0
  while (index < modules.length) {
    if (modules[index] === '1') {
      const start = index
      while (index < modules.length && modules[index] === '1') index++
      const x = (start + quiet) * scale
      const barWidth = (index - start) * scale
      const barTop = inRanges(start, guards) ? 0 : showText ? textArea : 0
      ctx.fillRect(x, barTop, barWidth, barArea - barTop)
    } else {
      index++
    }
  }

  if (showText && options.text) {
    ctx.fillStyle = options.dark ?? '#000000'
    ctx.font = '13px ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.fillText(options.text, width / 2, height - 4)
  }
  return canvas
}
