import { describe, expect, it } from 'vitest'
import { Base32Error, decode, decodeText, encode, encodeText } from './base32'

const bytes = (text: string) => new TextEncoder().encode(text)

describe('encode (RFC 4648)', () => {
  it('matches the RFC test vectors', () => {
    expect(encode(bytes('foobar'))).toBe('MZXW6YTBOI======')
    expect(encode(bytes('f'))).toBe('MY======')
    expect(encode(bytes('fo'))).toBe('MZXQ====')
    expect(encode(bytes('foo'))).toBe('MZXW6===')
    expect(encode(bytes('foob'))).toBe('MZXW6YQ=')
    expect(encode(bytes('fooba'))).toBe('MZXW6YTB')
  })

  it('encodes empty input as an empty string', () => {
    expect(encode(new Uint8Array(0))).toBe('')
  })

  it('can omit padding', () => {
    expect(encode(bytes('f'), { padding: false })).toBe('MY')
  })

  it('always pads to a multiple of eight', () => {
    for (let length = 1; length <= 10; length++) {
      expect(encode(new Uint8Array(length)).length % 8).toBe(0)
    }
  })
})

describe('decode (RFC 4648)', () => {
  it('round-trips every length remainder', () => {
    for (const text of ['f', 'fo', 'foo', 'foob', 'fooba', 'foobar', 'toolspace']) {
      expect(decodeText(encodeText(text))).toBe(text)
    }
  })

  it('accepts lower case and ignores whitespace and hyphens', () => {
    expect(decodeText('mzxw6ytboi======')).toBe('foobar')
    expect(decodeText('MZXW 6YTB OI')).toBe('foobar')
    expect(decodeText('MZXW-6YTB-OI')).toBe('foobar')
  })

  it('round-trips non-ASCII text', () => {
    expect(decodeText(encodeText('café ☕'))).toBe('café ☕')
  })

  it('rejects invalid characters', () => {
    expect(() => decode('MZXW6!')).toThrow(Base32Error)
  })

  it('accepts the legal lengths and rejects the illegal ones', () => {
    // RFC 4648 allows lengths that are 0, 2, 4, 5 or 7 mod 8.
    expect(() => decode('MZXW6')).not.toThrow()
    // 6 characters leaves 6 stray bits, which is never a legal encoding.
    expect(() => decode('MZXW6Y')).toThrow(Base32Error)
  })
})

describe('Crockford variant', () => {
  it('encodes without padding', () => {
    expect(encode(bytes('foobar'), { variant: 'crockford' })).toBe('CSQPYRK1E8')
  })

  it('round-trips', () => {
    const encoded = encodeText('toolspace', { variant: 'crockford' })
    expect(decodeText(encoded, { variant: 'crockford' })).toBe('toolspace')
  })

  it('decodes lookalike characters', () => {
    const encoded = encodeText('hello', { variant: 'crockford' })
    const swapped = encoded.replace(/0/g, 'O').replace(/1/g, 'I')
    expect(decodeText(swapped, { variant: 'crockford' })).toBe('hello')
  })

  it('does not accept the RFC-only digits 2-7 as letters', () => {
    // "8" is outside Crockford's alphabet.
    expect(() => decode('8', { variant: 'crockford' })).toThrow(Base32Error)
  })
})
