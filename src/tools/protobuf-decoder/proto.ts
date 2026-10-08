/**
 * A schema-less Protocol Buffers decoder.
 *
 * Without a .proto file the field names are unknowable, so this walks the wire
 * format and shows field numbers, wire types and the best guess at each value:
 * a string, a nested message, a packed list or raw bytes.
 */

export class ProtobufError extends Error {}

export const WIRE_TYPES: Record<number, string> = {
  0: 'varint',
  1: 'fixed64',
  2: 'length-delimited',
  3: 'start-group',
  4: 'end-group',
  5: 'fixed32',
}

export interface ProtoField {
  number: number
  wireType: number
  wireName: string
  /** Human-readable rendering of the value. */
  value: string
  /** Nested fields when the payload itself parsed as a message. */
  children?: ProtoField[]
  /** Present when the value came from a packed repeated field. */
  packed?: number[]
}

interface Reader {
  bytes: Uint8Array
  pos: number
}

function readVarint(reader: Reader): bigint {
  let result = 0n
  let shift = 0n
  for (let i = 0; i < 10; i++) {
    if (reader.pos >= reader.bytes.length) throw new ProtobufError('Unexpected end of input while reading a varint.')
    const byte = reader.bytes[reader.pos++]
    result |= BigInt(byte & 0x7f) << shift
    if ((byte & 0x80) === 0) return result
    shift += 7n
  }
  throw new ProtobufError('Varint is longer than 10 bytes.')
}

function zigzag(value: bigint): bigint {
  return (value >> 1n) ^ -(value & 1n)
}

function utf8(bytes: Uint8Array): string | null {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    // Control characters other than tab/newline suggest this is not text.
    return /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text) ? null : text
  } catch {
    return null
  }
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function readBytes(reader: Reader, length: number): Uint8Array {
  if (reader.pos + length > reader.bytes.length) throw new ProtobufError('Declared length runs past the end of the input.')
  const slice = reader.bytes.subarray(reader.pos, reader.pos + length)
  reader.pos += length
  return slice
}

function decodeMessage(bytes: Uint8Array, depth: number): ProtoField[] {
  const reader: Reader = { bytes, pos: 0 }
  const fields: ProtoField[] = []
  while (reader.pos < bytes.length) {
    const tag = readVarint(reader)
    const number = Number(tag >> 3n)
    const wireType = Number(tag & 7n)
    if (number === 0) throw new ProtobufError('Field number 0 is not valid.')

    if (wireType === 0) {
      const value = readVarint(reader)
      fields.push({ number, wireType, wireName: WIRE_TYPES[wireType], value: `${value} (int) · ${zigzag(value)} (sint)` })
    } else if (wireType === 1) {
      const slice = readBytes(reader, 8)
      fields.push({ number, wireType, wireName: WIRE_TYPES[wireType], value: `0x${toHex(slice)}` })
    } else if (wireType === 5) {
      const slice = readBytes(reader, 4)
      fields.push({ number, wireType, wireName: WIRE_TYPES[wireType], value: `0x${toHex(slice)}` })
    } else if (wireType === 2) {
      const length = Number(readVarint(reader))
      const slice = readBytes(reader, length)
      fields.push(decodeLengthDelimited(number, slice, depth))
    } else {
      throw new ProtobufError(`Unsupported wire type ${wireType} for field ${number}.`)
    }
  }
  return fields
}

function decodeLengthDelimited(number: number, slice: Uint8Array, depth: number): ProtoField {
  const base = { number, wireType: 2, wireName: WIRE_TYPES[2] }
  const asText = utf8(slice)
  if (asText !== null && asText.length > 0) {
    return { ...base, value: asText }
  }
  if (slice.length === 0) {
    return { ...base, value: '(empty)' }
  }

  // A nested message is the safer guess for binary payloads, so try that before
  // the packed heuristics, which can misread structured bytes as numbers.
  if (depth < 8) {
    try {
      const children = decodeMessage(slice, depth + 1)
      if (children.length > 0) {
        return { ...base, value: `${children.length} nested field${children.length === 1 ? '' : 's'}`, children }
      }
    } catch {
      /* Not a nested message; fall through to packed and raw bytes. */
    }
  }

  const packed = tryPacked(slice)
  if (packed) {
    return { ...base, value: `packed [${packed.join(', ')}]`, packed }
  }

  return { ...base, value: `0x${toHex(slice)}` }
}

function tryPacked(slice: Uint8Array): number[] | null {
  if (slice.length === 0) return null
  const reader: Reader = { bytes: slice, pos: 0 }
  const values: number[] = []
  try {
    while (reader.pos < slice.length) {
      values.push(Number(readVarint(reader)))
      if (values.length > 4096) return null
    }
  } catch {
    return null
  }
  return values.length > 1 ? values : null
}

export function decodeProtobuf(bytes: Uint8Array): ProtoField[] {
  if (bytes.length === 0) throw new ProtobufError('The input is empty.')
  return decodeMessage(bytes, 0)
}

/** Accept hex (with optional spaces) or base64 and return raw bytes. */
export function parsePayload(text: string): Uint8Array {
  const compact = text.replace(/\s+/g, '')
  if (!compact) return new Uint8Array()
  if (/^[0-9a-f]+$/i.test(compact) && compact.length % 2 === 0) {
    const out = new Uint8Array(compact.length / 2)
    for (let i = 0; i < out.length; i++) out[i] = parseInt(compact.slice(i * 2, i * 2 + 2), 16)
    return out
  }
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) {
    const binary = atob(compact)
    const out = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
    return out
  }
  throw new ProtobufError('Input must be hex or base64.')
}

/** Flatten the tree into indented lines so it can be copied out. */
export function formatFields(fields: ProtoField[], level = 0): string {
  const pad = '  '.repeat(level)
  return fields
    .map((field) => {
      const line = `${pad}${field.number}: ${field.value}  [${field.wireName}]`
      if (field.children) return `${line}\n${formatFields(field.children, level + 1)}`
      return line
    })
    .join('\n')
}
