/**
 * Binary text conversion.
 *
 * Text is encoded as UTF-8, so "é" becomes its two real bytes rather than a
 * single 16-bit code unit. Decoding accepts spaces, newlines and 0b prefixes,
 * and rejects a bit count that is not a whole number of bytes.
 */

export class BinaryError extends Error {}

export interface BinaryOptions {
  /** Separate each byte with a space. */
  spaced?: boolean
  /** Prefix every byte with 0b. */
  prefixed?: boolean
  /** Reverse the bit order within each byte. */
  reversed?: boolean
}

function reverseByte(value: number): number {
  let result = 0
  for (let bit = 0; bit < 8; bit++) result |= ((value >> bit) & 1) << (7 - bit)
  return result
}

/** Encode text as a binary string. */
export function textToBinary(text: string, options: BinaryOptions = {}): string {
  const bytes = new TextEncoder().encode(text)
  const parts = [...bytes].map((byte) => {
    const value = options.reversed ? reverseByte(byte) : byte
    const bits = value.toString(2).padStart(8, '0')
    return options.prefixed ? `0b${bits}` : bits
  })
  return options.spaced || options.prefixed ? parts.join(' ') : parts.join('')
}

/** Decode a binary string back to UTF-8 text. */
export function binaryToText(input: string, options: BinaryOptions = {}): string {
  const body = input.replace(/0b/gi, '').replace(/[\s_]/g, '')
  if (body === '') return ''
  if (!/^[01]+$/.test(body)) {
    const bad = body.match(/[^01]/)?.[0]
    throw new BinaryError(`"${bad}" is not a binary digit`)
  }
  if (body.length % 8 !== 0) throw new BinaryError(`Expected a multiple of 8 bits, got ${body.length}`)

  const bytes = new Uint8Array(body.length / 8)
  for (let i = 0; i < bytes.length; i++) {
    const value = parseInt(body.slice(i * 8, i * 8 + 8), 2)
    bytes[i] = options.reversed ? reverseByte(value) : value
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

/** Split binary into groups of `size` bits, right-aligned, for readability. */
export function groupBits(binary: string, size: number): string {
  if (size <= 0) return binary
  const clean = binary.replace(/[\s_]/g, '')
  const chunks: string[] = []
  for (let i = 0; i < clean.length; i += size) chunks.push(clean.slice(i, i + size))
  return chunks.join(' ')
}

export interface BinaryStats {
  bits: number
  bytes: number
  ones: number
  zeros: number
  /** Ones divided by total bits, between 0 and 1. */
  density: number
}

/** Basic statistics about a binary string. */
export function binaryStats(input: string): BinaryStats {
  const body = input.replace(/0b/gi, '').replace(/[\s_]/g, '')
  if (!/^[01]*$/.test(body)) throw new BinaryError('That is not a binary string')
  const ones = [...body].filter((bit) => bit === '1').length
  const bits = body.length
  return {
    bits,
    bytes: Math.ceil(bits / 8),
    ones,
    zeros: bits - ones,
    density: bits === 0 ? 0 : ones / bits,
  }
}
