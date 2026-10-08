/**
 * ULID and UUID generation.
 *
 * A ULID is 48 bits of millisecond timestamp followed by 80 random bits,
 * encoded in Crockford base32 (26 characters). That makes ULIDs sortable by
 * creation time as plain strings, which is their whole point.
 *
 * Randomness comes from crypto.getRandomValues, so ids are never guessable
 * from each other. Nothing here talks to a server.
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export class UlidError extends Error {}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

function encodeTime(time: number): string {
  let value = time
  const chars = new Array<string>(10)
  for (let i = 9; i >= 0; i--) {
    chars[i] = ALPHABET[value % 32]
    value = Math.floor(value / 32)
  }
  return chars.join('')
}

function encodeRandom(bytes: Uint8Array): string {
  // 80 bits spread over 16 base32 characters.
  let chars = ''
  let buffer = 0
  let bits = 0
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte
    bits += 8
    while (bits >= 5) {
      bits -= 5
      chars += ALPHABET[(buffer >> bits) & 31]
    }
  }
  if (bits > 0) chars += ALPHABET[(buffer << (5 - bits)) & 31]
  return chars.slice(0, 16)
}

/** Generate a ULID. Pass a timestamp (ms) to make it deterministic in tests. */
export function ulid(time: number = Date.now()): string {
  if (!Number.isInteger(time) || time < 0 || time > 0xffffffffffff) throw new UlidError('A ULID timestamp must be a 48-bit whole number of milliseconds')
  return encodeTime(time) + encodeRandom(randomBytes(10))
}

const DECODE: Record<string, number> = {}
for (let i = 0; i < ALPHABET.length; i++) DECODE[ALPHABET[i]] = i
// Crockford decoding treats these lookalikes as their canonical characters.
DECODE['I'] = 1
DECODE['L'] = 1
DECODE['O'] = 0

export interface DecodedUlid {
  time: Date
  timestamp: number
  random: string
}

/** Decode a ULID back to its timestamp and random part. */
export function decodeUlid(input: string): DecodedUlid {
  const text = input.trim().toUpperCase()
  if (text.length !== 26) throw new UlidError('A ULID is exactly 26 characters')
  let timestamp = 0
  for (let i = 0; i < 10; i++) {
    const value = DECODE[text[i]]
    if (value === undefined) throw new UlidError(`"${text[i]}" is not a valid base32 character`)
    timestamp = timestamp * 32 + value
  }
  if (timestamp > 0xffffffffffff) throw new UlidError('The timestamp part overflows 48 bits')
  for (let i = 10; i < 26; i++) {
    if (DECODE[text[i]] === undefined) throw new UlidError(`"${text[i]}" is not a valid base32 character`)
  }
  return { time: new Date(timestamp), timestamp, random: text.slice(10) }
}

/** A random UUID v4 in the canonical hyphenated form. */
export function uuidV4(): string {
  const bytes = randomBytes(16)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Validate the shape of a UUID (any version, hyphenated or not). */
export function isUuid(input: string): boolean {
  return /^[0-9a-f]{8}-?[0-9a-f]{4}-?[1-8][0-9a-f]{3}-?[89ab][0-9a-f]{3}-?[0-9a-f]{12}$/i.test(input.trim())
}

/** The version digit of a UUID, or null when the input is not a UUID. */
export function uuidVersion(input: string): number | null {
  const text = input.trim().replace(/-/g, '')
  if (!isUuid(input)) return null
  return Number(text[12])
}
