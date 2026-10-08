/** Base64 / Base64URL codec implemented directly so it works on bytes and text. */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

function encodeWith(bytes: Uint8Array, alphabet: string, pad: boolean): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]
    const b1 = bytes[i + 1]
    const b2 = bytes[i + 2]
    out += alphabet[b0 >> 2]
    out += alphabet[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)]
    if (b1 === undefined) {
      if (pad) out += '=='
      break
    }
    out += alphabet[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)]
    if (b2 === undefined) {
      if (pad) out += '='
      break
    }
    out += alphabet[b2 & 63]
  }
  return out
}

function decodeWith(input: string, alphabet: string): Uint8Array {
  const clean = input.replace(/[\s=]/g, '')
  const lookup = new Map<string, number>()
  for (let i = 0; i < alphabet.length; i++) lookup.set(alphabet[i], i)

  const bytes: number[] = []
  let buffer = 0
  let bits = 0
  for (const char of clean) {
    const value = lookup.get(char)
    if (value === undefined) throw new Error(`Invalid character "${char}"`)
    buffer = (buffer << 6) | value
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 0xff)
    }
  }
  return new Uint8Array(bytes)
}

export function encodeBytes(bytes: Uint8Array): string {
  return encodeWith(bytes, ALPHABET, true)
}

export function decodeBytes(input: string): Uint8Array {
  return decodeWith(input, ALPHABET)
}

export function encodeBytesUrl(bytes: Uint8Array): string {
  return encodeWith(bytes, URL_ALPHABET, false)
}

export function decodeBytesUrl(input: string): Uint8Array {
  return decodeWith(input, URL_ALPHABET)
}

const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: false })

export function encodeText(text: string): string {
  return encodeBytes(encoder.encode(text))
}

export function decodeText(input: string): string {
  return decoder.decode(decodeBytes(input))
}

export function encodeTextUrl(text: string): string {
  return encodeBytesUrl(encoder.encode(text))
}

export function decodeTextUrl(input: string): string {
  return decoder.decode(decodeBytesUrl(input))
}

export function toDataUri(bytes: Uint8Array, mime = 'application/octet-stream'): string {
  return `data:${mime};base64,${encodeBytes(bytes)}`
}
