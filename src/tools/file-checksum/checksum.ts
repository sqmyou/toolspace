/** Checksums for text and files: SHA family via WebCrypto plus a local CRC-32. */

export type ShaAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'

export const SHA_ALGORITHMS: ShaAlgorithm[] = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']

const encoder = new TextEncoder()

export function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function sha(algo: ShaAlgorithm, data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(algo, data as BufferSource)
  return toHex(new Uint8Array(digest))
}

export function shaText(algo: ShaAlgorithm, text: string): Promise<string> {
  return sha(algo, encoder.encode(text))
}

let crcTable: Uint32Array | null = null

function table(): Uint32Array {
  if (crcTable) return crcTable
  const result = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    result[n] = c >>> 0
  }
  crcTable = result
  return result
}

export function crc32(bytes: Uint8Array): string {
  const lookup = table()
  let crc = 0xffffffff
  for (const byte of bytes) crc = lookup[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0')
}

export function crc32Text(text: string): string {
  return crc32(encoder.encode(text))
}

export interface ChecksumResult {
  size: number
  crc32: string
  sha1: string
  sha256: string
  sha384: string
  sha512: string
}

export async function checksumBytes(bytes: Uint8Array): Promise<ChecksumResult> {
  const [sha1, sha256, sha384, sha512] = await Promise.all([
    sha('SHA-1', bytes),
    sha('SHA-256', bytes),
    sha('SHA-384', bytes),
    sha('SHA-512', bytes),
  ])
  return { size: bytes.length, crc32: crc32(bytes), sha1, sha256, sha384, sha512 }
}

export function checksumText(text: string): Promise<ChecksumResult> {
  return checksumBytes(encoder.encode(text))
}
