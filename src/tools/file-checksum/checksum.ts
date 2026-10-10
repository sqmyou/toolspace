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

/** The raw 32-bit checksum as an unsigned integer. */
export function crc32Int(bytes: Uint8Array): number {
  const lookup = table()
  let crc = 0xffffffff
  for (const byte of bytes) crc = lookup[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

export function crc32(bytes: Uint8Array): string {
  return crc32Int(bytes).toString(16).padStart(8, '0')
}

export function crc32Text(text: string): string {
  return crc32(encoder.encode(text))
}

/** Every digest the tool computes, keyed the way the UI and verify use them. */
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

/** Result field holding each algorithm's digest. */
const FIELD: Record<string, keyof ChecksumResult> = {
  'CRC-32': 'crc32',
  'SHA-1': 'sha1',
  'SHA-256': 'sha256',
  'SHA-384': 'sha384',
  'SHA-512': 'sha512',
}

/**
 * Which algorithm a hex digest belongs to, keyed by how many hex characters it
 * has. CRC-32 and SHA-1 through SHA-512 are the only lengths this tool can
 * check against, and no two of them collide.
 */
export const DIGEST_LENGTHS: Record<number, string> = {
  8: 'CRC-32',
  40: 'SHA-1',
  64: 'SHA-256',
  96: 'SHA-384',
  128: 'SHA-512',
}

/** The algorithms this tool recognises, in digest-length order. */
export const DIGEST_ALGORITHMS = Object.values(DIGEST_LENGTHS)

/** Read a digest out of a result by its algorithm name. */
export function digestFor(result: ChecksumResult, algorithm: string): string {
  const field = FIELD[algorithm]
  return field ? String(result[field]) : ''
}

/**
 * Turn a pasted hash into bare lowercase hex, or null when it is not hex.
 * Tolerates the shapes people actually paste: spaces, colons and dashes as
 * group separators, a `0x` prefix, and upper case. `sha256sum` output is two
 * hex tokens, so callers should split the line first.
 */
export function normalizeHex(input: string): string | null {
  const stripped = input
    .trim()
    .replace(/^0x/i, '')
    .replace(/[\s:_-]/g, '')
    .toLowerCase()
  if (!stripped) return null
  return /^[0-9a-f]+$/.test(stripped) ? stripped : null
}

/** Identify a hex digest's algorithm from its length, or null if unknown. */
export function identifyDigest(hex: string): { algorithm: string; hex: string } | null {
  const normalized = normalizeHex(hex)
  if (!normalized) return null
  const algorithm = DIGEST_LENGTHS[normalized.length]
  return algorithm ? { algorithm, hex: normalized } : null
}

export type VerifyStatus = 'match' | 'mismatch' | 'unknown'

export interface VerifyResult {
  status: VerifyStatus
  /** The recognised algorithm, present only when the pasted value identifies one. */
  algorithm?: string
  /** The pasted value reduced to bare lowercase hex. */
  hex: string
}

/**
 * Compare a pasted hash against a computed result. A value that is not hex, or
 * whose length matches no known algorithm, yields `unknown` rather than a bare
 * "no match", so the UI can say what is actually wrong.
 */
export function verify(expected: string, result: ChecksumResult): VerifyResult {
  const normalized = normalizeHex(expected)
  if (!normalized) return { status: 'unknown', hex: '' }
  const identified = identifyDigest(normalized)
  if (!identified) return { status: 'unknown', hex: normalized }
  const actual = digestFor(result, identified.algorithm).toLowerCase()
  return {
    status: actual === identified.hex ? 'match' : 'mismatch',
    algorithm: identified.algorithm,
    hex: identified.hex,
  }
}

/**
 * Pull a digest out of pasted checksum-file output. Handles the two common
 * layouts `sha256sum`/`shasum` write — `"<hex>  <filename>"` and BSD's
 * `"SHA256 (<filename>) = <hex>"` — plus a bare hash. Returns the algorithm
 * and hex when the line names a digest this tool knows, else null.
 */
export function parseExpectedLine(line: string): { algorithm: string; hex: string } | null {
  const text = line.trim()
  if (!text) return null

  const bsd = text.match(/^(?:SHA1|SHA256|SHA384|SHA512|CRC32)\s*\(.*?\)\s*=\s*([0-9a-fA-F\s:-]+)$/i)
  if (bsd) return identifyDigest(bsd[1])

  // A hex run is the digest; ignore a trailing filename token.
  const tokens = text.split(/\s+/)
  for (const token of tokens) {
    const identified = identifyDigest(token)
    if (identified) return identified
  }
  // Fall back to the whole line, which covers colon/dash grouped digests.
  return identifyDigest(text.replace(/\s.*$/, ''))
}
