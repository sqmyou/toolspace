/**
 * MessagePack and CBOR decoding.
 *
 * Both are compact self-describing binary formats, so a decoder needs no schema
 * — unlike protobuf. They overlap enough to share a reader and a value model.
 *
 * Values that JSON cannot hold keep a wrapper rather than being flattened:
 * byte strings, extension/tag values and 64-bit integers (which exceed
 * JavaScript's safe integer range and are kept as BigInt). `toJson` turns a
 * tree into JSON-safe data and says how it did so, so nothing is lost silently.
 */

export class DecodeError extends Error {}

/** A byte string, shown as hex and kept distinct from text. */
export class Bytes {
  constructor(readonly data: Uint8Array) {}
}

/** A MessagePack extension type, or a CBOR tag. */
export class Tagged {
  constructor(readonly tag: number, readonly value: unknown) {}
}

export type Value = null | boolean | number | bigint | string | Bytes | Tagged | Value[] | Pairs

/** A map, kept as ordered pairs so non-string keys survive. */
export class Pairs {
  constructor(readonly entries: Array<[Value, Value]>) {}
}

/* -------------------------------------------------------------------------
   Shared reader
   ------------------------------------------------------------------------- */

class Reader {
  pos = 0
  constructor(readonly bytes: Uint8Array) {}

  get remaining(): number {
    return this.bytes.length - this.pos
  }

  need(count: number): void {
    if (this.remaining < count) {
      throw new DecodeError(`Unexpected end of input: needed ${count} more byte(s) at offset ${this.pos}.`)
    }
  }

  u8(): number {
    this.need(1)
    return this.bytes[this.pos++]
  }

  u16(): number {
    this.need(2)
    const value = (this.bytes[this.pos] << 8) | this.bytes[this.pos + 1]
    this.pos += 2
    return value
  }

  u32(): number {
    this.need(4)
    const { bytes, pos } = this
    const value = bytes[pos] * 0x1000000 + (bytes[pos + 1] << 16) + (bytes[pos + 2] << 8) + bytes[pos + 3]
    this.pos += 4
    return value
  }

  u64(): bigint {
    this.need(8)
    let value = 0n
    for (let i = 0; i < 8; i++) value = (value << 8n) | BigInt(this.bytes[this.pos + i])
    this.pos += 8
    return value
  }

  take(count: number): Uint8Array {
    this.need(count)
    const slice = this.bytes.subarray(this.pos, this.pos + count)
    this.pos += count
    return slice
  }

  /** A length that fits in memory; absurd lengths are a corrupt rather than hostile stream. */
  count(value: bigint, what: string): number {
    if (value > 0xffffffffn) throw new DecodeError(`${what} length ${value} is too large to decode.`)
    return Number(value)
  }
}

const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes)

/* -------------------------------------------------------------------------
   MessagePack
   ------------------------------------------------------------------------- */

function msgpackValue(reader: Reader): Value {
  const byte = reader.u8()

  if (byte <= 0x7f) return byte
  if (byte >= 0xe0) return byte - 0x100
  if (byte >= 0x80 && byte <= 0x8f) return msgpackMap(reader, byte & 0x0f)
  if (byte >= 0x90 && byte <= 0x9f) return msgpackArray(reader, byte & 0x0f)
  if (byte >= 0xa0 && byte <= 0xbf) return text(reader.take(byte & 0x1f))

  switch (byte) {
    case 0xc0: return null
    case 0xc1: throw new DecodeError(`Reserved MessagePack byte 0xc1 at offset ${reader.pos - 1}.`)
    case 0xc2: return false
    case 0xc3: return true
    case 0xc4: return new Bytes(reader.take(reader.u8()))
    case 0xc5: return new Bytes(reader.take(reader.u16()))
    case 0xc6: return new Bytes(reader.take(reader.u32()))
    case 0xc7: return msgpackExt(reader, reader.u8())
    case 0xc8: return msgpackExt(reader, reader.u16())
    case 0xc9: return msgpackExt(reader, reader.u32())
    case 0xca: return msgpackFloat32(reader)
    case 0xcb: return msgpackFloat64(reader)
    case 0xcc: return reader.u8()
    case 0xcd: return reader.u16()
    case 0xce: return reader.u32()
    case 0xcf: return reader.u64()
    case 0xd0: return (reader.u8() << 24) >> 24
    case 0xd1: return (reader.u16() << 16) >> 16
    case 0xd2: return reader.u32() | 0
    case 0xd3: return reader.u64() - 0x10000000000000000n
    case 0xd4: return msgpackExt(reader, 1)
    case 0xd5: return msgpackExt(reader, 2)
    case 0xd6: return msgpackExt(reader, 4)
    case 0xd7: return msgpackExt(reader, 8)
    case 0xd8: return msgpackExt(reader, 16)
    case 0xd9: return text(reader.take(reader.u8()))
    case 0xda: return text(reader.take(reader.u16()))
    case 0xdb: return text(reader.take(reader.u32()))
    case 0xdc: return msgpackArray(reader, reader.u16())
    case 0xdd: return msgpackArray(reader, reader.u32())
    case 0xde: return msgpackMap(reader, reader.u16())
    case 0xdf: return msgpackMap(reader, reader.u32())
    default: throw new DecodeError(`Unknown MessagePack byte 0x${byte.toString(16)} at offset ${reader.pos - 1}.`)
  }
}

function msgpackFloat32(reader: Reader): number {
  const buffer = reader.take(4)
  return new DataView(buffer.buffer, buffer.byteOffset, 4).getFloat32(0, false)
}

function msgpackFloat64(reader: Reader): number {
  const buffer = reader.take(8)
  return new DataView(buffer.buffer, buffer.byteOffset, 8).getFloat64(0, false)
}

function msgpackExt(reader: Reader, length: number): Tagged {
  const type = (reader.u8() << 24) >> 24
  return new Tagged(type, length === 0 ? null : new Bytes(reader.take(length)))
}

function msgpackArray(reader: Reader, length: number): Value[] {
  const out: Value[] = []
  for (let i = 0; i < length; i++) out.push(msgpackValue(reader))
  return out
}

function msgpackMap(reader: Reader, length: number): Pairs {
  const entries: Array<[Value, Value]> = []
  for (let i = 0; i < length; i++) entries.push([msgpackValue(reader), msgpackValue(reader)])
  return new Pairs(entries)
}

/** Decode a complete MessagePack value; trailing bytes are reported. */
export function decodeMsgpack(bytes: Uint8Array): { value: Value; rest: number } {
  const reader = new Reader(bytes)
  if (bytes.length === 0) throw new DecodeError('The input is empty.')
  const value = msgpackValue(reader)
  return { value, rest: reader.remaining }
}

/* -------------------------------------------------------------------------
   CBOR
   ------------------------------------------------------------------------- */

function halfToNumber(bits: number): number {
  const sign = bits & 0x8000 ? -1 : 1
  const exponent = (bits >> 10) & 0x1f
  const fraction = bits & 0x3ff
  if (exponent === 0) return sign * Math.pow(2, -14) * (fraction / 1024)
  if (exponent === 31) return fraction === 0 ? sign * Infinity : NaN
  return sign * Math.pow(2, exponent - 15) * (1 + fraction / 1024)
}

/** The integer argument that follows the initial byte, per CBOR additional info. */
function cborArgument(reader: Reader, info: number): bigint | 'indefinite' {
  if (info < 24) return BigInt(info)
  if (info === 24) return BigInt(reader.u8())
  if (info === 25) return BigInt(reader.u16())
  if (info === 26) return BigInt(reader.u32())
  if (info === 27) return reader.u64()
  if (info === 31) return 'indefinite'
  throw new DecodeError(`Reserved CBOR additional information ${info} at offset ${reader.pos - 1}.`)
}

function cborValue(reader: Reader): Value {
  const initial = reader.u8()
  const major = initial >> 5
  const info = initial & 0x1f

  // Major 7 owns its bytes (floats and simple values), so read nothing first.
  if (major === 7) return cborSimple(reader, info)

  const argument = cborArgument(reader, info)

  switch (major) {
    case 0:
      if (argument === 'indefinite') throw new DecodeError('Indefinite length is not valid for integers.')
      return argument <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(argument) : argument
    case 1:
      if (argument === 'indefinite') throw new DecodeError('Indefinite length is not valid for integers.')
      return -1n - argument >= BigInt(Number.MIN_SAFE_INTEGER) ? -1 - Number(argument) : -1n - argument
    case 2:
      if (argument === 'indefinite') return new Bytes(cborChunks(reader, 2))
      return new Bytes(reader.take(reader.count(argument, 'Byte string')))
    case 3:
      if (argument === 'indefinite') return text(cborChunks(reader, 3))
      return text(reader.take(reader.count(argument, 'Text string')))
    case 4: {
      if (argument === 'indefinite') {
        const out: Value[] = []
        while (!cborBreak(reader)) out.push(cborValue(reader))
        return out
      }
      const length = reader.count(argument, 'Array')
      const out: Value[] = []
      for (let i = 0; i < length; i++) out.push(cborValue(reader))
      return out
    }
    case 5: {
      const entries: Array<[Value, Value]> = []
      if (argument === 'indefinite') {
        while (!cborBreak(reader)) entries.push([cborValue(reader), cborValue(reader)])
        return new Pairs(entries)
      }
      const length = reader.count(argument, 'Map')
      for (let i = 0; i < length; i++) entries.push([cborValue(reader), cborValue(reader)])
      return new Pairs(entries)
    }
    case 6: {
      if (argument === 'indefinite') throw new DecodeError('Indefinite length is not valid for a tag.')
      return new Tagged(Number(argument), cborValue(reader))
    }
    default:
      throw new DecodeError(`Unsupported CBOR major type ${major}.`)
  }
}

function cborSimple(reader: Reader, info: number): Value {
  if (info === 20) return false
  if (info === 21) return true
  if (info === 22) return null
  if (info === 23) return new Tagged(-1, 'undefined')
  if (info === 25) return halfToNumber(reader.u16())
  if (info === 26) {
    const buffer = reader.take(4)
    return new DataView(buffer.buffer, buffer.byteOffset, 4).getFloat32(0, false)
  }
  if (info === 27) {
    const buffer = reader.take(8)
    return new DataView(buffer.buffer, buffer.byteOffset, 8).getFloat64(0, false)
  }
  if (info < 20) return new Tagged(-1, `simple(${info})`)
  throw new DecodeError(`Unsupported CBOR simple value ${info} at offset ${reader.pos - 1}.`)
}

/** An indefinite-length string is a run of definite chunks ending at a break. */
function cborChunks(reader: Reader, major: number): Uint8Array {
  const parts: Uint8Array[] = []
  for (;;) {
    const initial = reader.u8()
    if (initial === 0xff) break
    if (initial >> 5 !== major) throw new DecodeError('An indefinite-length string may only hold matching chunks.')
    const argument = cborArgument(reader, initial & 0x1f)
    if (argument === 'indefinite') throw new DecodeError('A string chunk cannot itself be indefinite.')
    parts.push(reader.take(reader.count(argument, 'String chunk')))
  }
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

/** Consume a break byte if the next item is one. */
function cborBreak(reader: Reader): boolean {
  reader.need(1)
  if (reader.bytes[reader.pos] === 0xff) {
    reader.pos++
    return true
  }
  return false
}

/** Decode a complete CBOR value; trailing bytes are reported. */
export function decodeCbor(bytes: Uint8Array): { value: Value; rest: number } {
  if (bytes.length === 0) throw new DecodeError('The input is empty.')
  const reader = new Reader(bytes)
  const value = cborValue(reader)
  return { value, rest: reader.remaining }
}

/* -------------------------------------------------------------------------
   Presentation
   ------------------------------------------------------------------------- */

const hex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')

/** Render a decoded tree as indented lines, for the copyable text view. */
export function formatTree(value: Value, level = 0): string {
  const pad = '  '.repeat(level)
  if (value instanceof Bytes) return `h'${hex(value.data)}' (${value.data.length} bytes)`
  if (value instanceof Tagged) {
    const inner = value.value instanceof Bytes ? `h'${hex(value.value.data)}'` : String(value.value)
    return `${pad}tag ${value.tag}: ${inner}`
  }
  if (value instanceof Pairs) {
    if (value.entries.length === 0) return `${pad}{}`
    return value.entries
      .map(([key, item]) => {
        const label = key instanceof Bytes ? `h'${hex(key.data)}'` : String(key)
        const rendered = formatTree(item, level + 1)
        return typeof item === 'object' && item !== null ? `${pad}${label}:\n${rendered}` : `${pad}${label}: ${rendered}`
      })
      .join('\n')
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}[]`
    return value.map((item) => `${pad}-\n${formatTree(item, level + 1)}`).join('\n')
  }
  if (typeof value === 'bigint') return `${value}n`
  if (typeof value === 'string') return `${pad}${JSON.stringify(value)}`
  return `${pad}${String(value)}`
}

/** Convert a decoded tree to JSON-safe data, recording what had to be changed. */
export function toJson(value: Value, notes: string[] = []): unknown {
  if (value instanceof Bytes) {
    notes.push('Byte strings are shown as hex objects.')
    return { $bytes: hex(value.data) }
  }
  if (value instanceof Tagged) {
    notes.push('Tagged values are shown as { $tag, value } objects.')
    return { $tag: value.tag, value: toJson(value.value as Value, notes) }
  }
  if (value instanceof Pairs) {
    const out: Record<string, unknown> = {}
    for (const [key, item] of value.entries) {
      const label = typeof key === 'string' ? key : formatTree(key).trim()
      out[label] = toJson(item, notes)
    }
    return out
  }
  if (Array.isArray(value)) return value.map((item) => toJson(item, notes))
  if (typeof value === 'bigint') {
    notes.push('64-bit integers beyond the safe range are quoted to avoid precision loss.')
    return value.toString()
  }
  return value
}

/** Remove duplicate notes while keeping the first-seen order. */
export function uniqueNotes(notes: string[]): string[] {
  return [...new Set(notes)]
}
