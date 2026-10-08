/**
 * PBKDF2 key derivation via WebCrypto.
 *
 * `deriveBits` takes raw bytes so the implementation can be checked against
 * the RFC 6070 test vectors; the convenience helpers encode text and format
 * the result as hex or Base64.
 */

export type Pbkdf2Hash = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'

export const PBKDF2_HASHES: Pbkdf2Hash[] = ['SHA-256', 'SHA-512', 'SHA-384', 'SHA-1']

export interface DeriveOptions {
  iterations?: number
  hash?: Pbkdf2Hash
  length?: number
  saltEncoding?: 'utf8' | 'hex' | 'base64'
  outputEncoding?: 'hex' | 'base64'
}

export class Pbkdf2Error extends Error {}

export const DEFAULT_ITERATIONS = 600_000
export const DEFAULT_LENGTH = 32

export async function deriveBits(
  password: Uint8Array,
  salt: Uint8Array,
  iterations: number,
  hash: Pbkdf2Hash,
  lengthBytes: number,
): Promise<Uint8Array> {
  if (iterations < 1) throw new Pbkdf2Error('Iterations must be at least 1.')
  if (lengthBytes < 1 || lengthBytes > 1024) throw new Pbkdf2Error('Derived length must be between 1 and 1024 bytes.')
  const key = await crypto.subtle.importKey('raw', password as BufferSource, 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt as BufferSource, iterations, hash }, key, lengthBytes * 8)
  return new Uint8Array(bits)
}

const HEX = '0123456789abcdef'

export function toHex(bytes: Uint8Array): string {
  let out = ''
  for (const byte of bytes) out += HEX[byte >> 4] + HEX[byte & 0x0f]
  return out
}

export function fromHex(text: string): Uint8Array {
  const clean = text.replace(/\s+/g, '')
  if (clean.length % 2 !== 0 || /[^0-9a-fA-F]/.test(clean)) throw new Pbkdf2Error('Hex input must have an even number of hex digits.')
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function fromBase64(text: string): Uint8Array {
  try {
    const binary = atob(text.trim())
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    throw new Pbkdf2Error('That is not valid Base64.')
  }
}

function decodeSalt(salt: string, encoding: NonNullable<DeriveOptions['saltEncoding']>): Uint8Array {
  if (encoding === 'hex') return fromHex(salt)
  if (encoding === 'base64') return fromBase64(salt)
  return new TextEncoder().encode(salt)
}

export interface DeriveResult {
  hash: Pbkdf2Hash
  iterations: number
  length: number
  hex: string
  base64: string
}

/** Derive a key from text and return both output encodings. */
export async function derive(password: string, salt: string, options: DeriveOptions = {}): Promise<DeriveResult> {
  const iterations = options.iterations ?? DEFAULT_ITERATIONS
  const hash = options.hash ?? 'SHA-256'
  const length = options.length ?? DEFAULT_LENGTH
  const saltBytes = decodeSalt(salt, options.saltEncoding ?? 'utf8')
  const bytes = await deriveBits(new TextEncoder().encode(password), saltBytes, iterations, hash, length)
  return { hash, iterations, length, hex: toHex(bytes), base64: toBase64(bytes) }
}

export function randomSalt(length = 16): string {
  if (length < 8 || length > 64) throw new Pbkdf2Error('Salt length must be between 8 and 64 bytes.')
  return toHex(crypto.getRandomValues(new Uint8Array(length)))
}

/** A rough brute-force estimate for a given iteration count, in words. */
export function describeCost(iterations: number): string {
  if (iterations < 100_000) return 'Low — below the 100k now recommended for PBKDF2-HMAC-SHA256.'
  if (iterations < 300_000) return 'Moderate — acceptable for legacy systems.'
  if (iterations < 600_000) return 'Good — in line with older OWASP guidance.'
  return 'Strong — meets the current OWASP recommendation of 600k.'
}

export function encodeSalt(bytes: Uint8Array, encoding: NonNullable<DeriveOptions['saltEncoding']> = 'utf8'): string {
  if (encoding === 'hex') return toHex(bytes)
  if (encoding === 'base64') return toBase64(bytes)
  return new TextDecoder().decode(bytes)
}
