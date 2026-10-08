/**
 * Base32 encoding (RFC 4648) and Crockford's variant.
 *
 * RFC 4648 uses A-Z and 2-7, padded with "=" to a multiple of 8 characters.
 * Crockford's variant drops padding, uses 0-9A-Z minus I, L, O and U, and
 * decodes the lookalike letters so a hand-copied key still works.
 */

export class Base32Error extends Error {}

const RFC_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export interface EncodeOptions {
  variant?: 'rfc4648' | 'crockford'
  /** Keep the "=" padding. Only applies to RFC 4648. */
  padding?: boolean
}

function alphabetFor(variant: 'rfc4648' | 'crockford'): string {
  return variant === 'crockford' ? CROCKFORD_ALPHABET : RFC_ALPHABET
}

function decodeTable(variant: 'rfc4648' | 'crockford'): Record<string, number> {
  const alphabet = alphabetFor(variant)
  const table: Record<string, number> = {}
  for (let i = 0; i < alphabet.length; i++) table[alphabet[i]] = i
  if (variant === 'crockford') {
    // Crockford decoding folds these characters onto their canonical digit.
    table['I'] = 1
    table['L'] = 1
    table['O'] = 0
  }
  return table
}

/** Encode bytes as base32 text. */
export function encode(bytes: Uint8Array, options: EncodeOptions = {}): string {
  const variant = options.variant ?? 'rfc4648'
  const alphabet = alphabetFor(variant)
  let out = ''
  let buffer = 0
  let bits = 0

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte
    bits += 8
    while (bits >= 5) {
      bits -= 5
      out += alphabet[(buffer >> bits) & 31]
    }
  }
  if (bits > 0) out += alphabet[(buffer << (5 - bits)) & 31]

  if (variant === 'rfc4648' && (options.padding ?? true)) {
    while (out.length % 8 !== 0) out += '='
  }
  return out
}

/** Decode base32 text to bytes. Whitespace and hyphens are ignored. */
export function decode(text: string, options: EncodeOptions = {}): Uint8Array {
  const variant = options.variant ?? 'rfc4648'
  const table = decodeTable(variant)
  const body = text.replace(/[\s-]/g, '').replace(/=+$/, '').toUpperCase()
  if (body === '') return new Uint8Array(0)

  for (const char of body) if (!(char in table)) throw new Base32Error(`"${char}" is not a valid base32 character`)

  const bytes: number[] = []
  let buffer = 0
  let bits = 0
  for (const char of body) {
    buffer = (buffer << 5) | table[char]
    bits += 5
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 0xff)
    }
  }
  // Any leftover bits must be zero padding, otherwise the input is truncated.
  if (bits >= 5) throw new Base32Error('That base32 string is truncated')
  if (bits > 0 && (buffer & ((1 << bits) - 1)) !== 0) throw new Base32Error('That base32 string has trailing data')
  return new Uint8Array(bytes)
}

/** Encode UTF-8 text directly. */
export function encodeText(text: string, options: EncodeOptions = {}): string {
  return encode(new TextEncoder().encode(text), options)
}

/** Decode base32 to UTF-8 text, replacing anything invalid. */
export function decodeText(text: string, options: EncodeOptions = {}): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(decode(text, options))
}
