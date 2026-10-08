/**
 * Hashing.
 *
 * SHA-1/256/384/512 come from the platform WebCrypto API, so they are fast and
 * audited. MD5 is not available there and is only offered because it is still
 * needed for legacy checksums, so it is implemented here.
 */

export type HashAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512' | 'MD5'

export const HASH_ALGORITHMS: HashAlgorithm[] = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512', 'MD5']

/** Algorithms usable for HMAC (MD5 is excluded: WebCrypto cannot key it). */
export const HMAC_ALGORITHMS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const
export type HmacAlgorithm = (typeof HMAC_ALGORITHMS)[number]

export class HashError extends Error {}

/**
 * MD5, per RFC 1321.
 *
 * Kept deliberately compact: this is a well-known algorithm and the goal is a
 * readable, verifiable implementation rather than a fast one.
 */
export function md5(input: Uint8Array): Uint8Array {
  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ]
  const k = new Uint32Array(64)
  for (let i = 0; i < 64; i++) k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296)

  const originalLength = input.length
  const withPadding = new Uint8Array((((originalLength + 8) >> 6) + 1) << 6)
  withPadding.set(input)
  withPadding[originalLength] = 0x80
  const bitLength = originalLength * 8
  const view = new DataView(withPadding.buffer)
  view.setUint32(withPadding.length - 8, bitLength >>> 0, true)
  view.setUint32(withPadding.length - 4, Math.floor(bitLength / 4294967296), true)

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476

  const words = new Uint32Array(16)
  for (let offset = 0; offset < withPadding.length; offset += 64) {
    for (let i = 0; i < 16; i++) words[i] = view.getUint32(offset + i * 4, true)

    let a = a0
    let b = b0
    let c = c0
    let d = d0

    for (let i = 0; i < 64; i++) {
      let f: number
      let g: number
      if (i < 16) {
        f = (b & c) | (~b & d)
        g = i
      } else if (i < 32) {
        f = (d & b) | (~d & c)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        f = b ^ c ^ d
        g = (3 * i + 5) % 16
      } else {
        f = c ^ (b | ~d)
        g = (7 * i) % 16
      }
      f = (f + a + k[i] + words[g]) >>> 0
      a = d
      d = c
      c = b
      b = (b + ((f << s[i]) | (f >>> (32 - s[i])))) >>> 0
    }

    a0 = (a0 + a) >>> 0
    b0 = (b0 + b) >>> 0
    c0 = (c0 + c) >>> 0
    d0 = (d0 + d) >>> 0
  }

  const out = new Uint8Array(16)
  const outView = new DataView(out.buffer)
  outView.setUint32(0, a0, true)
  outView.setUint32(4, b0, true)
  outView.setUint32(8, c0, true)
  outView.setUint32(12, d0, true)
  return out
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Digest the UTF-8 bytes of a string. */
export async function hash(
  text: string,
  algorithm: HashAlgorithm,
  encoding: 'hex' | 'base64' = 'hex',
): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  if (algorithm === 'MD5') {
    const digest = md5(bytes)
    return encoding === 'base64' ? bytesToBase64(digest) : toHex(digest)
  }
  const digest = new Uint8Array(await crypto.subtle.digest(algorithm, bytes))
  return encoding === 'base64' ? bytesToBase64(digest) : toHex(digest)
}

export async function hmac(
  text: string,
  secret: string,
  algorithm: HmacAlgorithm,
  encoding: 'hex' | 'base64' = 'hex',
): Promise<string> {
  if (!secret) throw new HashError('Enter a secret key for HMAC.')
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text))
  const bytes = new Uint8Array(signature)
  return encoding === 'base64' ? bytesToBase64(bytes) : toHex(bytes)
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}
