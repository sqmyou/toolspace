/**
 * TOTP and HOTP generation (RFC 4226 / 6238) using WebCrypto.
 *
 * The HMAC primitives take raw key bytes so the algorithm can be checked
 * against the published test vectors; the public helpers accept the Base32
 * secrets that authenticator apps share.
 */

export type TotpAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-512'

export interface TotpOptions {
  digits?: number
  step?: number
  algorithm?: TotpAlgorithm
  /** Milliseconds since the epoch. Defaults to now. */
  timestamp?: number
}

export interface TotpResult {
  code: string
  secondsRemaining: number
  counter: number
  period: number
}

export const DEFAULT_DIGITS = 6
export const DEFAULT_STEP = 30

export class TotpError extends Error {}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** Decode an RFC 4648 Base32 string, ignoring spaces, dashes and padding. */
export function base32Decode(input: string): Uint8Array {
  const clean = input.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '')
  if (!clean) throw new TotpError('The secret is empty.')
  if (/[^A-Z2-7]/.test(clean)) throw new TotpError('The secret contains characters that are not valid Base32.')

  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const char of clean) {
    value = (value << 5) | ALPHABET.indexOf(char)
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return new Uint8Array(bytes)
}

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

async function hmac(keyBytes: Uint8Array, message: Uint8Array, algorithm: TotpAlgorithm): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', keyBytes as BufferSource, { name: 'HMAC', hash: algorithm }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, message as BufferSource)
  return new Uint8Array(signature)
}

/** HOTP: HMAC the big-endian counter then apply dynamic truncation. */
export async function hotp(keyBytes: Uint8Array, counter: number, digits = DEFAULT_DIGITS, algorithm: TotpAlgorithm = 'SHA-1'): Promise<string> {
  if (!Number.isInteger(counter) || counter < 0) throw new TotpError('The counter must be a non-negative integer.')
  if (digits < 1 || digits > 10) throw new TotpError('Digits must be between 1 and 10.')
  const message = new Uint8Array(8)
  // Counters beyond 2^53 are unrealistic here, so split into high/low words.
  const high = Math.floor(counter / 2 ** 32)
  const low = counter >>> 0
  const view = new DataView(message.buffer)
  view.setUint32(0, high)
  view.setUint32(4, low)

  const digest = await hmac(keyBytes, message, algorithm)
  const offset = digest[digest.length - 1] & 0x0f
  const binary =
    ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff)
  return (binary % 10 ** digits).toString().padStart(digits, '0')
}

/** TOTP: HOTP over the time step counter, plus the time left in the window. */
export async function totp(keyBytes: Uint8Array, options: TotpOptions = {}): Promise<TotpResult> {
  const digits = options.digits ?? DEFAULT_DIGITS
  const period = options.step ?? DEFAULT_STEP
  const algorithm = options.algorithm ?? 'SHA-1'
  const timestamp = options.timestamp ?? Date.now()
  if (period <= 0) throw new TotpError('The period must be greater than zero.')

  const seconds = Math.floor(timestamp / 1000)
  const counter = Math.floor(seconds / period)
  const code = await hotp(keyBytes, counter, digits, algorithm)
  return { code, secondsRemaining: period - (seconds % period), counter, period }
}

export async function generateTotp(secret: string, options: TotpOptions = {}): Promise<TotpResult> {
  return totp(base32Decode(secret), options)
}

/** Build an otpauth:// URI that can be scanned into an authenticator app. */
export function otpauthUri(secret: string, account: string, issuer: string, options: TotpOptions = {}): string {
  const digits = options.digits ?? DEFAULT_DIGITS
  const period = options.step ?? DEFAULT_STEP
  const algorithm = (options.algorithm ?? 'SHA-1').replace('-', '')
  const label = issuer ? `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}` : encodeURIComponent(account)
  const params = new URLSearchParams({ secret, digits: String(digits), period: String(period) })
  if (issuer) params.set('issuer', issuer)
  if (algorithm !== 'SHA1') params.set('algorithm', algorithm)
  return `otpauth://totp/${label}?${params.toString()}`
}

/** Group a code for readability: `123456` -> `123 456`. */
export function formatCode(code: string): string {
  return code.replace(/(\d{3})(?=\d)/g, '$1 ')
}
