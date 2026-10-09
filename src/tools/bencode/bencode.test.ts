import { describe, expect, it } from 'vitest'
import {
  asHex,
  asText,
  BencodeError,
  decode,
  formatTree,
  isText,
  toJson,
  type BencodeValue,
} from './bencode'

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text)
const latin1FromHex = (hex: string): Uint8Array =>
  Uint8Array.from(hex.match(/../g)!.map((pair) => parseInt(pair, 16)))
/** Bencode a raw byte string `<length>:<bytes>`. */
const rawString = (payload: number[]): Uint8Array =>
  Uint8Array.from([...bytes(`${payload.length}:`), ...payload])

describe('decode integers', () => {
  it('reads positive, negative and zero', () => {
    expect(decode(bytes('i42e')).value).toEqual({ kind: 'int', value: 42n })
    expect(decode(bytes('i-7e')).value).toEqual({ kind: 'int', value: -7n })
    expect(decode(bytes('i0e')).value).toEqual({ kind: 'int', value: 0n })
  })

  it('rejects a missing terminator', () => {
    expect(() => decode(bytes('i42'))).toThrow(BencodeError)
  })

  it('rejects a non-numeric integer', () => {
    expect(() => decode(bytes('ixe'))).toThrow(BencodeError)
  })
})

describe('decode byte strings', () => {
  it('reads the length-prefixed payload', () => {
    const result = decode(bytes('4:spam'))
    expect(result.value.kind).toBe('bytes')
    expect(asText((result.value as { value: Uint8Array }).value)).toBe('spam')
  })

  it('reads an empty string', () => {
    expect(asText((decode(bytes('0:')).value as { value: Uint8Array }).value)).toBe('')
  })

  it('rejects a length longer than the input', () => {
    expect(() => decode(bytes('10:abc'))).toThrow(/needs 10 byte/)
  })
})

describe('decode lists and dicts', () => {
  it('reads a list', () => {
    const value = decode(bytes('l4:spami42ee')).value
    expect(value.kind).toBe('list')
    expect((value as { value: BencodeValue[] }).value.map((item) => item.kind)).toEqual(['bytes', 'int'])
  })

  it('reads an empty list and dict', () => {
    expect(decode(bytes('le')).value).toEqual({ kind: 'list', value: [] })
    expect(decode(bytes('de')).value).toEqual({ kind: 'dict', value: [] })
  })

  it('reads a dictionary with ordered entries', () => {
    const value = decode(bytes('d3:cow3:moo4:spam4:eggse')).value
    expect(value.kind).toBe('dict')
    const entries = (value as { value: Array<[Uint8Array, BencodeValue]> }).value
    expect(entries.map(([key]) => asText(key))).toEqual(['cow', 'spam'])
  })

  it('reads nested structures', () => {
    const value = decode(bytes('d4:listl1:a1:be5:innerd3:keyi5eee')).value
    const json = toJson(value)
    expect(json).toEqual({ list: ['a', 'b'], inner: { key: 5 } })
  })

  it('reports trailing bytes', () => {
    const result = decode(bytes('i1ejunk'))
    expect(result.value).toEqual({ kind: 'int', value: 1n })
    expect(result.rest).toBe(4)
  })

  it('rejects empty input', () => {
    expect(() => decode(new Uint8Array())).toThrow(BencodeError)
  })
})

describe('text versus binary', () => {
  it('detects valid UTF-8', () => {
    expect(isText(bytes('hello'))).toBe(true)
    expect(asText(bytes('hello'))).toBe('hello')
  })

  it('treats invalid UTF-8 as binary', () => {
    const raw = latin1FromHex('fffe')
    expect(isText(raw)).toBe(false)
    expect(asText(raw)).toBeUndefined()
    expect(asHex(raw)).toBe('fffe')
  })

  it('treats control bytes as binary', () => {
    expect(isText(latin1FromHex('0001'))).toBe(false)
  })
})

describe('formatTree', () => {
  it('renders a nested dict with indentation', () => {
    const value = decode(bytes('d4:listl1:a1:be5:innerd3:keyi5eee')).value
    const out = formatTree(value)
    expect(out).toBe(
      [
        'dict {2}',
        '  list: list [2]',
        '    bytes "a"',
        '    bytes "b"',
        '  inner: dict {1}',
        '    key: int 5',
      ].join('\n'),
    )
  })

  it('renders top-level scalars on one line', () => {
    expect(formatTree(decode(bytes('4:spam')).value)).toBe('bytes "spam"')
    expect(formatTree(decode(bytes('i42e')).value)).toBe('int 42')
  })

  it('shows binary strings as a byte count and hex', () => {
    const value = decode(rawString([0xff, 0xfe])).value
    expect(formatTree(value)).toBe('bytes <2 bytes> fffe')
  })
})

describe('toJson', () => {
  it('wraps binary strings and notes it', () => {
    const notes: string[] = []
    const value = decode(rawString([0xff, 0xfe])).value
    const json = toJson(value, notes)
    expect(json).toEqual({ $hex: 'fffe' })
    expect(notes.some((n) => n.includes('binary'))).toBe(true)
  })

  it('keeps large integers as strings with a note', () => {
    const notes: string[] = []
    const value = decode(bytes('i9007199254740993e')).value
    expect(toJson(value, notes)).toBe('9007199254740993')
    expect(notes.some((n) => n.includes('safe range'))).toBe(true)
  })
})
