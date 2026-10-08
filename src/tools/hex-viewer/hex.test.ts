import { describe, expect, it } from 'vitest'
import { bytesFromText, fromBase64, HexError, hexDump, parseHex, textFromBytes, toBase64, toHex } from './hex'

describe('parseHex', () => {
  it('reads plain hex', () => {
    expect([...parseHex('48656c6c6f')]).toEqual([0x48, 0x65, 0x6c, 0x6c, 0x6f])
  })

  it('ignores whitespace, colons and commas', () => {
    expect([...parseHex('48:65 6c,6c\n6f')]).toEqual([0x48, 0x65, 0x6c, 0x6c, 0x6f])
  })

  it('strips 0x prefixes', () => {
    expect([...parseHex('0x48 0x65')]).toEqual([0x48, 0x65])
  })

  it('pads a single nibble', () => {
    expect([...parseHex('f')]).toEqual([0x0f])
  })

  it('rejects a stray nibble and bad characters', () => {
    expect(() => parseHex('abc')).toThrow(HexError)
    expect(() => parseHex('zz')).toThrow(HexError)
  })

  it('returns an empty array for empty input', () => {
    expect(parseHex('  ')).toHaveLength(0)
  })
})

describe('toHex', () => {
  it('formats lower case by default', () => {
    expect(toHex(new Uint8Array([0xde, 0xad]))).toBe('de ad')
  })

  it('supports upper case and grouping', () => {
    expect(toHex(new Uint8Array([1, 2, 3, 4]), { uppercase: true, group: 2 })).toBe('01 02 03 04')
  })

  it('supports a compact form', () => {
    expect(toHex(new Uint8Array([1, 2]), { group: 0 })).toBe('0102')
  })

  it('supports C-style output', () => {
    expect(toHex(new Uint8Array([1, 255]), { cStyle: true, uppercase: true })).toBe('0x01, 0xFF')
  })
})

describe('base64', () => {
  it('encodes and decodes round trip', () => {
    const bytes = bytesFromText('Hello, world!')
    expect(fromBase64(toBase64(bytes))).toEqual(bytes)
  })

  it('matches the known encoding of "Hello"', () => {
    expect(toBase64(bytesFromText('Hello'))).toBe('SGVsbG8=')
  })

  it('handles every length remainder', () => {
    for (const text of ['a', 'ab', 'abc', 'abcd']) {
      expect(textFromBytes(fromBase64(toBase64(bytesFromText(text))))).toBe(text)
    }
  })

  it('accepts url-safe input without padding', () => {
    const bytes = new Uint8Array([0xfb, 0xff, 0xbf])
    expect([...fromBase64(toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''))]).toEqual([...bytes])
  })

  it('rejects invalid characters and truncated input', () => {
    expect(() => fromBase64('!!!!')).toThrow(HexError)
    expect(() => fromBase64('AAAAA')).toThrow(HexError)
  })
})

describe('text conversion', () => {
  it('round-trips ASCII and non-ASCII text', () => {
    expect(textFromBytes(bytesFromText('café ☕'))).toBe('café ☕')
  })

  it('encodes non-ASCII as UTF-8 bytes', () => {
    expect([...bytesFromText('é')]).toEqual([0xc3, 0xa9])
  })

  it('replaces invalid UTF-8 instead of throwing', () => {
    expect(textFromBytes(new Uint8Array([0xff, 0xfe]))).toContain('\ufffd')
  })
})

describe('hexDump', () => {
  it('lays out offsets, hex and ASCII', () => {
    const dump = hexDump(bytesFromText('Hello'))
    expect(dump).toBe('00000000  48 65 6c 6c 6f                                   |Hello|')
  })

  it('wraps long input at the requested width', () => {
    const dump = hexDump(bytesFromText('abcdefghij'), { bytesPerLine: 4 })
    const lines = dump.split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('|abcd|')
    expect(lines[2]).toContain('|ij|')
  })

  it('shows a dot for unprintable bytes', () => {
    expect(hexDump(new Uint8Array([0x00]))).toContain('|.|')
  })
})
