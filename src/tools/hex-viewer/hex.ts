/**
 * Byte-view helpers: hex, base64 and printable ASCII.
 *
 * Text is encoded as UTF-8 so non-ASCII characters become the bytes you would
 * see in a file, not their JavaScript code units. Decoding is lossy on
 * purpose: bytes that are not valid UTF-8 fall back to the replacement
 * character so a view never throws on binary data.
 */

export class HexError extends Error {}

export interface HexFormatOptions {
  uppercase?: boolean
  /** Insert a space every N bytes; 0 means no spaces. */
  group?: number
  /** Prefix every byte with 0x and separate with commas. */
  cStyle?: boolean
}

/** Parse hex text, ignoring whitespace, colons, commas and 0x prefixes. */
export function parseHex(input: string): Uint8Array {
  let text = input.replace(/0x/gi, '').replace(/[\s:,_-]/g, '')
  if (text === '') return new Uint8Array(0)
  if (!/^[0-9a-fA-F]+$/.test(text)) {
    const bad = text.match(/[^0-9a-fA-F]/)?.[0]
    throw new HexError(`"${bad}" is not a hex digit`)
  }
  // A single trailing nibble is the common copy-paste slip.
  if (text.length % 2 !== 0) {
    if (text.length === 1) text = `0${text}`
    else throw new HexError(`Expected an even number of hex digits, got ${text.length}`)
  }
  const bytes = new Uint8Array(text.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(text.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

/** Render bytes as a hex string. */
export function toHex(bytes: Uint8Array, options: HexFormatOptions = {}): string {
  const parts = [...bytes].map((byte) => {
    const hex = byte.toString(16).padStart(2, '0')
    const cased = options.uppercase ? hex.toUpperCase() : hex
    return options.cStyle ? `0x${cased}` : cased
  })
  if (options.cStyle) return parts.join(', ')
  const group = options.group ?? 1
  if (group <= 0) return parts.join('')
  const chunks: string[] = []
  for (let i = 0; i < parts.length; i += group) chunks.push(parts.slice(i, i + group).join(' '))
  return chunks.join(' ')
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Base64-encode bytes without building a huge intermediate string. */
export function toBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    out += BASE64[a >> 2]
    out += BASE64[((a & 3) << 4) | (b === undefined ? 0 : b >> 4)]
    out += b === undefined ? '=' : BASE64[((b & 15) << 2) | (c === undefined ? 0 : c >> 6)]
    out += c === undefined ? '=' : BASE64[c & 63]
  }
  return out
}

const BASE64_LOOKUP: Record<string, number> = {}
for (let i = 0; i < BASE64.length; i++) BASE64_LOOKUP[BASE64[i]] = i

/** Decode base64 (standard or URL-safe, with or without padding). */
export function fromBase64(input: string): Uint8Array {
  const text = input.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '')
  if (text === '') return new Uint8Array(0)
  for (const char of text) if (!(char in BASE64_LOOKUP)) throw new HexError(`"${char}" is not a base64 character`)
  if (text.length % 4 === 1) throw new HexError('That base64 string is truncated')

  const bytes: number[] = []
  let buffer = 0
  let bits = 0
  for (const char of text) {
    buffer = (buffer << 6) | BASE64_LOOKUP[char]
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 0xff)
    }
  }
  return new Uint8Array(bytes)
}

/** Encode a string to its UTF-8 bytes. */
export function bytesFromText(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

/** Decode bytes as UTF-8, replacing anything invalid. */
export function textFromBytes(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

export interface HexDumpOptions {
  bytesPerLine?: number
}

/** A classic hex dump with an offset column and an ASCII gutter. */
export function hexDump(bytes: Uint8Array, options: HexDumpOptions = {}): string {
  const width = Math.max(1, Math.min(64, options.bytesPerLine ?? 16))
  const lines: string[] = []
  for (let offset = 0; offset < bytes.length; offset += width) {
    const chunk = bytes.subarray(offset, offset + width)
    const hex = [...chunk].map((byte) => byte.toString(16).padStart(2, '0')).join(' ').padEnd(width * 3 - 1)
    const ascii = [...chunk].map((byte) => (byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.')).join('')
    lines.push(`${offset.toString(16).padStart(8, '0')}  ${hex}  |${ascii}|`)
  }
  return lines.join('\n')
}
