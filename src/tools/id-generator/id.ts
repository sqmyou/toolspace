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
