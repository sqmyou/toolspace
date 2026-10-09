/**
 * Bencode decoder (BitTorrent's serialisation format).
 *
 * Four types, all ASCII-framed:
 *   i42e            integer
 *   4:spam          byte string, prefixed by its length
 *   l...e           list
 *   d3:cow3:moo e   dictionary, keys are byte strings sorted by raw bytes
 *
 * Byte strings are not necessarily text, so they are kept as raw bytes and
 * decoded lazily: `asText` returns the UTF-8 reading, `asHex` the hex, and
 * `isText` decides whether a string is safe to show as words.
 */

export class BencodeError extends Error {}

/** A decoded bencode value. Byte strings carry their raw bytes, not a string. */
export type BencodeValue =
  | { kind: 'int'; value: bigint }
  | { kind: 'bytes'; value: Uint8Array }
  | { kind: 'list'; value: BencodeValue[] }
  | { kind: 'dict'; value: Array<[Uint8Array, BencodeValue]> }

const DECODER = new TextDecoder('utf-8', { fatal: true })

/** A printable reading of a byte string, or undefined when it is binary. */
export function asText(bytes: Uint8Array): string | undefined {
  try {
    const text = DECODER.decode(bytes)
    for (const char of text) {
      const code = char.codePointAt(0) ?? 0
      if (code < 0x09 || (code > 0x0d && code < 0x20) || code === 0x7f) return undefined
    }
    return text
  } catch {
    return undefined
  }
}

export function asHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function isText(bytes: Uint8Array): boolean {
  return asText(bytes) !== undefined
}

class Reader {
  private offset = 0

  constructor(private readonly bytes: Uint8Array) {}

  get position(): number {
    return this.offset
  }

  atEnd(): boolean {
    return this.offset >= this.bytes.length
  }

  peek(): number {
    if (this.atEnd()) throw new BencodeError(`Unexpected end of input at offset ${this.offset}.`)
    return this.bytes[this.offset]
  }

  next(): number {
    const byte = this.peek()
    this.offset++
    return byte
  }

  expect(char: string): void {
    if (this.peek() !== char.charCodeAt(0)) {
      throw new BencodeError(`Expected "${char}" at offset ${this.offset}.`)
    }
    this.offset++
  }

  /** Read a run of ASCII digits as a bigint, so large values stay exact. */
  private readIntegerRaw(): bigint {
    const start = this.offset
    while (!this.atEnd() && this.bytes[this.offset] >= 0x30 && this.bytes[this.offset] <= 0x39) {
      this.offset++
    }
    if (this.offset === start) throw new BencodeError(`Expected a number at offset ${start}.`)
    return BigInt(new TextDecoder().decode(this.bytes.subarray(start, this.offset)))
  }

  readValue(): BencodeValue {
    const marker = this.peek()
    if (marker === 'i'.charCodeAt(0)) {
      this.offset++
      const sign = this.peek() === '-'.charCodeAt(0) ? (this.offset++, -1n) : 1n
      const magnitude = this.readIntegerRaw()
      this.expect('e')
      return { kind: 'int', value: sign * magnitude }
    }
    if (marker === 'l'.charCodeAt(0)) {
      this.offset++
      const items: BencodeValue[] = []
      while (this.peek() !== 'e'.charCodeAt(0)) items.push(this.readValue())
      this.expect('e')
      return { kind: 'list', value: items }
    }
    if (marker === 'd'.charCodeAt(0)) {
      this.offset++
      const entries: Array<[Uint8Array, BencodeValue]> = []
      while (this.peek() !== 'e'.charCodeAt(0)) {
        const key = this.readBytes()
        entries.push([key, this.readValue()])
      }
      this.expect('e')
      return { kind: 'dict', value: entries }
    }
    if (marker >= 0x30 && marker <= 0x39) {
      return { kind: 'bytes', value: this.readBytes() }
    }
    throw new BencodeError(`Unexpected byte 0x${marker.toString(16)} at offset ${this.offset}.`)
  }

  private readBytes(): Uint8Array {
    const length = Number(this.readIntegerRaw())
    this.expect(':')
    if (this.offset + length > this.bytes.length) {
      throw new BencodeError(
        `Byte string at offset ${this.offset} needs ${length} byte(s) but only ${this.bytes.length - this.offset} remain.`,
      )
    }
    const slice = this.bytes.subarray(this.offset, this.offset + length)
    this.offset += length
    return slice
  }
}

export interface DecodeResult {
  value: BencodeValue
  /** Bytes left after the first value; non-zero means trailing data. */
  rest: number
}

/** Decode one bencode value. Throws on malformed input. */
export function decode(bytes: Uint8Array): DecodeResult {
  if (bytes.length === 0) throw new BencodeError('The input is empty.')
  const reader = new Reader(bytes)
  const value = reader.readValue()
  return { value, rest: bytes.length - reader.position }
}

/* -------------------------------------------------------------------------
   Rendering
   ------------------------------------------------------------------------- */

/** Render a value as an indented tree. Byte-string keys prefer text. */
export function formatTree(value: BencodeValue): string {
  const lines: string[] = []
  write(value, 0)
  return lines.join('\n')

  function leaf(value: BencodeValue): string {
    if (value.kind === 'int') return `int ${value.value.toString()}`
    if (value.kind === 'bytes') {
      return isText(value.value)
        ? `bytes ${JSON.stringify(asText(value.value))}`
        : `bytes <${value.value.length} bytes> ${hexPreview(value.value)}`
    }
    return ''
  }

  function write(value: BencodeValue, depth: number): void {
    const pad = '  '.repeat(depth)
    if (value.kind === 'int' || value.kind === 'bytes') {
      lines.push(pad + leaf(value))
      return
    }
    if (value.kind === 'list') {
      if (value.value.length === 0) {
        lines.push(`${pad}list []`)
        return
      }
      lines.push(`${pad}list [${value.value.length}]`)
      for (const item of value.value) write(item, depth + 1)
      return
    }
    writeDict(value.value, depth, '')
  }

  function writeDict(entries: Array<[Uint8Array, BencodeValue]>, depth: number, headerPrefix: string): void {
    const pad = '  '.repeat(depth)
    lines.push(`${pad}${headerPrefix}dict {${entries.length}}`)
    for (const [key, item] of entries) {
      const label = isText(key) ? asText(key) : `<${asHex(key)}>`
      const childPad = '  '.repeat(depth + 1)
      if (item.kind === 'int' || item.kind === 'bytes') {
        lines.push(`${childPad}${label}: ${leaf(item)}`)
      } else if (item.kind === 'list') {
        lines.push(`${childPad}${label}: list [${item.value.length}]`)
        for (const child of item.value) write(child, depth + 2)
      } else {
        writeDict(item.value, depth + 1, `${label}: `)
      }
    }
  }
}

function hexPreview(bytes: Uint8Array): string {
  const hex = asHex(bytes.subarray(0, 16))
  return bytes.length > 16 ? `${hex}…` : hex
}

/** Convert to JSON-safe values, reporting anything that had to be wrapped. */
export function toJson(value: BencodeValue, notes: string[] = []): unknown {
  switch (value.kind) {
    case 'int': {
      const asNumber = Number(value.value)
      if (Number.isSafeInteger(asNumber)) return asNumber
      notes.push('An integer beyond the safe range was kept as a string.')
      return value.value.toString()
    }
    case 'bytes': {
      const text = asText(value.value)
      if (text !== undefined) return text
      notes.push('A binary byte string is shown as { $hex } in the JSON view.')
      return { $hex: asHex(value.value) }
    }
    case 'list':
      return value.value.map((item) => toJson(item, notes))
    case 'dict': {
      const out: Record<string, unknown> = {}
      for (const [key, item] of value.value) {
        const name = asText(key) ?? `$hex:${asHex(key)}`
        out[name] = toJson(item, notes)
      }
      return out
    }
  }
}

/** De-duplicated notes, preserving first-seen order. */
export function uniqueNotes(notes: string[]): string[] {
  return [...new Set(notes)]
}
