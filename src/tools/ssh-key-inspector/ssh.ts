/**
 * SSH public and private key inspection.
 *
 * Public keys are `type base64 comment`; the Base64 payload is the wire
 * format from RFC 4253 — a sequence of length-prefixed fields. OpenSSH private
 * keys carry their public half in the clear, so both forms can be described
 * without ever touching the secret half.
 */

export interface Fingerprints {
  sha256: string
  md5: string
}

export interface SshKey {
  kind: 'public' | 'private'
  type: string
  /** Human-readable key type, e.g. "Ed25519" or "RSA". */
  label: string
  comment: string
  bits?: number
  curve?: string
  encrypted?: boolean
  fingerprints: Fingerprints
  warnings: string[]
}

export class SshError extends Error {}

const TYPE_LABELS: Record<string, string> = {
  'ssh-ed25519': 'Ed25519',
  'ssh-rsa': 'RSA',
  'rsa-sha2-256': 'RSA',
  'rsa-sha2-512': 'RSA',
  'ecdsa-sha2-nistp256': 'ECDSA P-256',
  'ecdsa-sha2-nistp384': 'ECDSA P-384',
  'ecdsa-sha2-nistp521': 'ECDSA P-521',
  'ssh-dss': 'DSA',
  'sk-ssh-ed25519@openssh.com': 'Ed25519 security key',
  'sk-ecdsa-sha2-nistp256@openssh.com': 'ECDSA security key',
}

const CURVES: Record<string, string> = {
  nistp256: 'P-256',
  nistp384: 'P-384',
  nistp521: 'P-521',
}

function base64ToBytes(text: string): Uint8Array {
  try {
    const binary = atob(text)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    throw new SshError('The Base64 payload is malformed.')
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function toHex(bytes: Uint8Array, separator = ':'): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join(separator)
}

/** A cursor over the SSH wire format. */
class Reader {
  offset = 0
  constructor(readonly bytes: Uint8Array) {}

  private take(length: number): Uint8Array {
    if (this.offset + length > this.bytes.length) throw new SshError('The key data is truncated.')
    const slice = this.bytes.subarray(this.offset, this.offset + length)
    this.offset += length
    return slice
  }

  uint32(): number {
    const bytes = this.take(4)
    return (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]
  }

  string(): Uint8Array {
    return this.take(this.uint32())
  }

  text(): string {
    return new TextDecoder().decode(this.string())
  }
}

/** Bit length of a big-endian positive integer, ignoring a sign-padding byte. */
function mpintBits(bytes: Uint8Array): number {
  let start = 0
  while (start < bytes.length - 1 && bytes[start] === 0) start += 1
  if (start >= bytes.length) return 0
  const leading = bytes[start]
  const significant = Math.floor(Math.log2(leading)) + 1
  return (bytes.length - start - 1) * 8 + significant
}

interface BlobInfo {
  type: string
  label: string
  bits?: number
  curve?: string
}

function describeBlob(blob: Uint8Array): BlobInfo {
  const reader = new Reader(blob)
  const type = reader.text()
  const label = TYPE_LABELS[type] ?? type
  const info: BlobInfo = { type, label }

  if (type === 'ssh-rsa' || type.startsWith('rsa-sha2')) {
    reader.string() // public exponent
    info.bits = mpintBits(reader.string())
  } else if (type.startsWith('ecdsa-sha2-')) {
    const curve = reader.text()
    info.curve = CURVES[curve] ?? curve
    info.bits = curve === 'nistp256' ? 256 : curve === 'nistp384' ? 384 : curve === 'nistp521' ? 521 : undefined
  } else if (type === 'ssh-ed25519' || type.startsWith('sk-ssh-ed25519')) {
    info.bits = 256
  } else if (type === 'ssh-dss') {
    info.bits = 1024
  }
  return info
}

async function fingerprints(blob: Uint8Array): Promise<Fingerprints> {
  const sha256 = new Uint8Array(await crypto.subtle.digest('SHA-256', blob as BufferSource))
  return {
    sha256: `SHA256:${bytesToBase64(sha256).replace(/=+$/, '')}`,
    md5: `MD5:${toHex(md5(blob))}`,
  }
}

// MD5 per RFC 1321, kept local so the tool has no cross-tool dependency.
// WebCrypto does not expose MD5; it is included only for the legacy fingerprint.
const MD5_SHIFTS = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]
const MD5_K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0)

function md5(input: Uint8Array): Uint8Array {
  const length = input.length
  const withPadding = new Uint8Array(((length + 8) >> 6 << 6) + 64)
  withPadding.set(input)
  withPadding[length] = 0x80
  const bitLength = length * 8
  // The length is appended as a 64-bit little-endian value; only the low word
  // matters for inputs under 2^32 bits.
  new DataView(withPadding.buffer).setUint32(withPadding.length - 8, bitLength >>> 0, true)
  new DataView(withPadding.buffer).setUint32(withPadding.length - 4, Math.floor(bitLength / 2 ** 32), true)

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476

  const view = new DataView(withPadding.buffer)
  for (let chunk = 0; chunk < withPadding.length; chunk += 64) {
    const M = Array.from({ length: 16 }, (_, i) => view.getUint32(chunk + i * 4, true))
    let [a, b, c, d] = [a0, b0, c0, d0]
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
      f = (f + a + MD5_K[i] + M[g]) >>> 0
      a = d
      d = c
      c = b
      const shift = MD5_SHIFTS[i]
      b = (b + ((f << shift) | (f >>> (32 - shift)))) >>> 0
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

function warningsFor(info: BlobInfo): string[] {
  const warnings: string[] = []
  if (info.type === 'ssh-rsa') warnings.push('ssh-rsa is the legacy SHA-1 signature format. Prefer rsa-sha2 or Ed25519.')
  if (info.type === 'ssh-dss') warnings.push('DSA keys are deprecated and rejected by most servers.')
  if (info.bits && info.type === 'ssh-rsa' && info.bits < 2048) warnings.push('RSA keys shorter than 2048 bits are considered weak.')
  return warnings
}

export async function inspectPublicKey(input: string): Promise<SshKey> {
  const tokens = input.trim().split(/\s+/).filter(Boolean)
  // Authorized-keys lines may carry options before the type; find the type token.
  const typeIndex = tokens.findIndex((token) => /^(ssh-|ecdsa-|sk-)/.test(token))
  if (typeIndex < 0) throw new SshError('No SSH key type found. Expected a line like "ssh-ed25519 AAAA… comment".')
  const declaredType = tokens[typeIndex]
  const payload = tokens[typeIndex + 1]
  if (!payload) throw new SshError('The key is missing its Base64 payload.')
  const blob = base64ToBytes(payload)
  const info = describeBlob(blob)
  if (info.type !== declaredType) throw new SshError(`The key type says "${declaredType}" but the payload is "${info.type}".`)

  return {
    kind: 'public',
    type: info.type,
    label: info.label,
    comment: tokens.slice(typeIndex + 2).join(' '),
    bits: info.bits,
    curve: info.curve,
    fingerprints: await fingerprints(blob),
    warnings: warningsFor(info),
  }
}

export function isPrivateKey(input: string): boolean {
  return /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(input)
}

export async function inspectPrivateKey(input: string): Promise<SshKey> {
  const match = /-----BEGIN OPENSSH PRIVATE KEY-----\s*([\s\S]*?)\s*-----END OPENSSH PRIVATE KEY-----/.exec(input)
  if (!match) throw new SshError('Only the OpenSSH private key format is supported. PEM keys can be converted with "ssh-keygen -p -o".')
  const bytes = base64ToBytes(match[1].replace(/\s+/g, ''))
  const magic = 'openssh-key-v1\0'
  for (let i = 0; i < magic.length; i++) {
    if (bytes[i] !== magic.charCodeAt(i)) throw new SshError('Not an openssh-key-v1 file.')
  }
  const reader = new Reader(bytes)
  reader.offset = magic.length
  const cipher = reader.text()
  reader.text() // KDF name
  reader.string() // KDF options
  const keyCount = reader.uint32()
  if (keyCount < 1) throw new SshError('The private key contains no public key.')
  const publicBlob = reader.string()
  const info = describeBlob(publicBlob)

  return {
    kind: 'private',
    type: info.type,
    label: info.label,
    comment: '',
    bits: info.bits,
    curve: info.curve,
    encrypted: cipher !== 'none',
    fingerprints: await fingerprints(publicBlob),
    warnings: [
      'This is a PRIVATE key. Never share it — only the matching public key belongs on a server.',
      ...(cipher === 'none' ? ['The key is stored unencrypted; a passphrase would protect it at rest.'] : []),
      ...warningsFor(info),
    ],
  }
}

export interface KnownHostEntry {
  host: string
  type: string
  key: string
}

/** Parse a known_hosts file into entries. */
export function parseKnownHosts(text: string): KnownHostEntry[] {
  const entries: KnownHostEntry[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const tokens = line.split(/\s+/)
    if (tokens.length < 3) continue
    entries.push({ host: tokens[0], type: tokens[1], key: tokens[2] })
  }
  return entries
}
