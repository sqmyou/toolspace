/** UUID, ULID and short-id generation. */

export type IdFormat = 'uuid-v4' | 'uuid-v7' | 'ulid' | 'nanoid' | 'hex' | 'objectid'

const HEX = '0123456789abcdef'
const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const NANO_ALPHABET = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

export function uuidV4(): string {
  const bytes = randomBytes(16)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const uuidV7Counter = { lastMs: 0, seq: 0 }

/** UUIDv7: 48-bit Unix milliseconds, version/variant bits, then randomness. */
export function uuidV7(now = Date.now()): string {
  if (now === uuidV7Counter.lastMs) uuidV7Counter.seq = (uuidV7Counter.seq + 1) & 0xfff
  else {
    uuidV7Counter.lastMs = now
    uuidV7Counter.seq = Math.floor(Math.random() * 0x1000)
  }

  const bytes = randomBytes(16)
  const time = BigInt(now)
  for (let i = 0; i < 6; i++) bytes[5 - i] = Number((time >> BigInt(i * 8)) & 0xffn)
  bytes[6] = 0x70 | (uuidV7Counter.seq >> 8)
  bytes[7] = uuidV7Counter.seq & 0xff
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** ULID: 48-bit timestamp + 80 bits of randomness, Crockford base32. */
export function ulid(now = Date.now()): string {
  let time = BigInt(now)
  let timePart = ''
  for (let i = 0; i < 10; i++) {
    timePart = BASE32[Number(time & 31n)] + timePart
    time >>= 5n
  }

  const random = randomBytes(10)
  let randomPart = ''
  for (let i = 0; i < 16; i++) {
    const bitIndex = i * 5
    const byteIndex = Math.floor(bitIndex / 8)
    const offset = bitIndex % 8
    const window = ((random[byteIndex] << 8) | (random[byteIndex + 1] ?? 0)) >> (16 - offset - 5)
    randomPart += BASE32[window & 31]
  }
  return timePart + randomPart
}

export function nanoid(size = 21): string {
  const bytes = randomBytes(size)
  let out = ''
  for (const byte of bytes) out += NANO_ALPHABET[byte & 63]
  return out
}

export function hexId(bytes = 16): string {
  return [...randomBytes(bytes)].map((b) => HEX[b >> 4] + HEX[b & 15]).join('')
}

/** MongoDB-style ObjectId: 4-byte timestamp, 5 random bytes, 3-byte counter. */
const objectIdCounter = { value: Math.floor(Math.random() * 0xffffff) }
export function objectId(now = Math.floor(Date.now() / 1000)): string {
  objectIdCounter.value = (objectIdCounter.value + 1) & 0xffffff
  const parts = new Uint8Array(12)
  parts[0] = (now >>> 24) & 0xff
  parts[1] = (now >>> 16) & 0xff
  parts[2] = (now >>> 8) & 0xff
  parts[3] = now & 0xff
  parts.set(randomBytes(5), 4)
  parts[9] = (objectIdCounter.value >>> 16) & 0xff
  parts[10] = (objectIdCounter.value >>> 8) & 0xff
  parts[11] = objectIdCounter.value & 0xff
  return [...parts].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function generate(format: IdFormat): string {
  switch (format) {
    case 'uuid-v4':
      return uuidV4()
    case 'uuid-v7':
      return uuidV7()
    case 'ulid':
      return ulid()
    case 'nanoid':
      return nanoid()
    case 'hex':
      return hexId()
    case 'objectid':
      return objectId()
  }
}

export function generateMany(format: IdFormat, count: number): string[] {
  const safe = Math.max(1, Math.min(1000, Math.floor(count)))
  return Array.from({ length: safe }, () => generate(format))
}

/** The variant nibble of a UUID says who defined the rest of the layout. */
export type UuidVariant = 'NCS' | 'RFC 4122' | 'Microsoft' | 'Future'

export interface UuidParts {
  valid: boolean
  /** Lower-case canonical `8-4-4-4-12` form, or '' when invalid. */
  canonical: string
  /** The version nibble (1–8), or null when the variant is not RFC 4122. */
  version: number | null
  variant: UuidVariant | null
  /** Decoded creation time for versions 1 and 7, else null. */
  timestamp: Date | null
  /** Human-readable reason when `valid` is false. */
  error?: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** The UUID epoch is 1582-10-15; Unix time starts 12219292800s later, in 100ns ticks. */
const GREGORIAN_OFFSET_MS = 12_219_292_800_000

function variantOf(nibble: number): UuidVariant {
  if (nibble < 8) return 'NCS'
  if (nibble < 12) return 'RFC 4122'
  if (nibble < 14) return 'Microsoft'
  return 'Future'
}

/**
 * Parse and validate a UUID. Accepts the canonical form plus the usual
 * decorators people paste: surrounding braces, a `urn:uuid:` prefix, upper
 * case, and the compact 32-character form with the hyphens removed.
 */
export function parseUuid(input: string): UuidParts {
  const raw = input.trim()
  if (!raw) {
    return { valid: false, canonical: '', version: null, variant: null, timestamp: null, error: 'Enter a UUID to check.' }
  }

  let body = raw.replace(/^urn:uuid:/i, '').replace(/^\{|\}$/g, '').trim()
  if (/^[0-9a-f]{32}$/i.test(body)) {
    body = `${body.slice(0, 8)}-${body.slice(8, 12)}-${body.slice(12, 16)}-${body.slice(16, 20)}-${body.slice(20)}`
  }

  const canonical = body.toLowerCase()
  if (!UUID_RE.test(canonical)) {
    return {
      valid: false,
      canonical: '',
      version: null,
      variant: null,
      timestamp: null,
      error: 'That is not a UUID. It needs 32 hex digits in 8-4-4-4-12 groups.',
    }
  }

  const variant = variantOf(parseInt(canonical[19], 16))
  const version = variant === 'RFC 4122' ? parseInt(canonical[14], 16) : null

  let timestamp: Date | null = null
  if (version === 7) {
    const ms = parseInt(canonical.slice(0, 8) + canonical.slice(9, 13), 16)
    timestamp = new Date(ms)
  } else if (version === 1) {
    const low = BigInt(`0x${canonical.slice(0, 8)}`)
    const mid = BigInt(`0x${canonical.slice(9, 13)}`)
    const high = BigInt(`0x${canonical.slice(14, 18)}`) & 0xfffn
    const ticks = (high << 48n) | (mid << 32n) | low
    timestamp = new Date(Number(ticks / 10000n) - GREGORIAN_OFFSET_MS)
  }

  return { valid: true, canonical, version, variant, timestamp }
}
