import { describe, expect, it } from 'vitest'
import { Bytes, DecodeError, decodeCbor, decodeMsgpack, formatTree, Pairs, Tagged, toJson } from './decode'

const bytes = (values: number[]): Uint8Array => new Uint8Array(values)
const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text)

describe('decodeMsgpack', () => {
  it('reads every integer width', () => {
    expect(decodeMsgpack(bytes([0x7f])).value).toBe(127)
    expect(decodeMsgpack(bytes([0xff])).value).toBe(-1)
    expect(decodeMsgpack(bytes([0xcc, 0x80])).value).toBe(128)
    expect(decodeMsgpack(bytes([0xcd, 0x01, 0x00])).value).toBe(256)
    expect(decodeMsgpack(bytes([0xce, 0, 1, 0, 0])).value).toBe(65536)
    expect(decodeMsgpack(bytes([0xd0, 0xfb])).value).toBe(-5)
  })

  it('reads floats', () => {
    expect(decodeMsgpack(bytes([0xca, 0x3f, 0x80, 0x00, 0x00])).value).toBeCloseTo(1)
    expect(decodeMsgpack(bytes([0xcb, 0x40, 0x09, 0x21, 0xf9, 0xf0, 0x1b, 0x86, 0x6e])).value).toBeCloseTo(Math.PI)
  })

  it('reads strings, arrays and maps', () => {
    const fixstr = new Uint8Array([0xa5, ...utf8('hello')])
    expect(decodeMsgpack(fixstr).value).toBe('hello')
    expect(decodeMsgpack(bytes([0x93, 0x01, 0x02, 0x03])).value).toEqual([1, 2, 3])
    const map = decodeMsgpack(bytes([0x81, 0xa1, 0x61, 0x01])).value
    expect(map).toBeInstanceOf(Pairs)
    expect((map as Pairs).entries).toEqual([['a', 1]])
  })

  it('reads bin, null, booleans and extensions', () => {
    expect(decodeMsgpack(bytes([0xc0])).value).toBeNull()
    expect(decodeMsgpack(bytes([0xc3])).value).toBe(true)
    const bin = decodeMsgpack(bytes([0xc4, 0x03, 1, 2, 3])).value
    expect(bin).toBeInstanceOf(Bytes)
    expect((bin as Bytes).data.length).toBe(3)
    const ext = decodeMsgpack(bytes([0xd4, 0x01, 0x2a])).value
    expect(ext).toBeInstanceOf(Tagged)
    expect((ext as Tagged).tag).toBe(1)
  })

  it('keeps 64-bit integers past the safe range as BigInt', () => {
    const value = decodeMsgpack(bytes([0xcf, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])).value
    expect(typeof value).toBe('bigint')
    expect(value).toBe(18446744073709551615n)
  })

  it('reports trailing bytes', () => {
    expect(decodeMsgpack(bytes([0x01, 0x02])).rest).toBe(1)
  })

  it('rejects the reserved byte and truncation', () => {
    expect(() => decodeMsgpack(bytes([0xc1]))).toThrow(DecodeError)
    expect(() => decodeMsgpack(bytes([0xcd, 0x01]))).toThrow(/end of input/)
    expect(() => decodeMsgpack(bytes([]))).toThrow(/empty/)
  })
})

describe('decodeCbor', () => {
  it('reads unsigned and negative integers', () => {
    expect(decodeCbor(bytes([0x0a])).value).toBe(10)
    expect(decodeCbor(bytes([0x18, 0x64])).value).toBe(100)
    expect(decodeCbor(bytes([0x19, 0x03, 0xe8])).value).toBe(1000)
    expect(decodeCbor(bytes([0x20])).value).toBe(-1)
    expect(decodeCbor(bytes([0x38, 0x63])).value).toBe(-100)
  })

  it('reads text and byte strings, definite and indefinite', () => {
    expect(decodeCbor(bytes([0x63, ...utf8('abc')])).value).toBe('abc')
    expect(decodeCbor(bytes([0x41, 0x01])).value).toBeInstanceOf(Bytes)
    const indefinite = decodeCbor(bytes([0x7f, 0x62, ...utf8('ab'), 0x61, ...utf8('c'), 0xff])).value
    expect(indefinite).toBe('abc')
  })

  it('reads arrays and maps, definite and indefinite', () => {
    expect(decodeCbor(bytes([0x83, 1, 2, 3])).value).toEqual([1, 2, 3])
    expect(decodeCbor(bytes([0x9f, 1, 2, 0xff])).value).toEqual([1, 2])
    const map = decodeCbor(bytes([0xa1, 0x61, 0x61, 0x01])).value
    expect((map as Pairs).entries).toEqual([['a', 1]])
    expect(decodeCbor(bytes([0xbf, 0x61, 0x61, 0x01, 0xff])).value).toBeInstanceOf(Pairs)
  })

  it('reads simple values, half floats and tags', () => {
    expect(decodeCbor(bytes([0xf4])).value).toBe(false)
    expect(decodeCbor(bytes([0xf5])).value).toBe(true)
    expect(decodeCbor(bytes([0xf6])).value).toBeNull()
    expect(decodeCbor(bytes([0xf9, 0x3c, 0x00])).value).toBeCloseTo(1)
    const tag = decodeCbor(bytes([0xc1, 0x1a, 0x51, 0x4b, 0x67, 0xb0])).value
    expect(tag).toBeInstanceOf(Tagged)
    expect((tag as Tagged).tag).toBe(1)
  })

  it('rejects reserved additional information', () => {
    expect(() => decodeCbor(bytes([0x1c]))).toThrow(DecodeError)
  })
})

describe('presentation', () => {
  it('formats a nested tree', () => {
    const value = decodeMsgpack(bytes([0x81, 0xa1, 0x61, 0x91, 0x01])).value
    expect(formatTree(value)).toContain('a:')
  })

  it('converts to JSON and records what changed', () => {
    const notes: string[] = []
    const value = decodeMsgpack(bytes([0x81, 0xa3, 0x62, 0x69, 0x6e, 0xc4, 0x01, 0x0a])).value
    const json = toJson(value, notes) as Record<string, unknown>
    expect(json).toEqual({ bin: { $bytes: '0a' } })
    expect(notes).toContain('Byte strings are shown as hex objects.')
  })

  it('quotes big integers in the JSON view', () => {
    const notes: string[] = []
    const value = decodeMsgpack(bytes([0xcf, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])).value
    expect(toJson(value, notes)).toBe('18446744073709551615')
    expect(notes.join(' ')).toMatch(/safe range/)
  })
})
