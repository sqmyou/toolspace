import { describe, expect, it } from 'vitest'
import {
  decodeBytes, decodeBytesUrl, decodeText, decodeTextUrl, encodeBytes, encodeBytesUrl,
  encodeText, encodeTextUrl, toDataUri,
} from './base64'

const bytes = (s: string) => new TextEncoder().encode(s)

describe('encodeBytes', () => {
  it('pads correctly for every length remainder', () => {
    expect(encodeBytes(bytes('f'))).toBe('Zg==')
    expect(encodeBytes(bytes('fo'))).toBe('Zm8=')
    expect(encodeBytes(bytes('foo'))).toBe('Zm9v')
    expect(encodeBytes(bytes('foob'))).toBe('Zm9vYg==')
    expect(encodeBytes(bytes('fooba'))).toBe('Zm9vYmE=')
    expect(encodeBytes(bytes('foobar'))).toBe('Zm9vYmFy')
  })

  it('handles empty input', () => {
    expect(encodeBytes(new Uint8Array())).toBe('')
  })

  it('matches the standard vectors for high bytes', () => {
    expect(encodeBytes(new Uint8Array([0xff, 0x00, 0x10]))).toBe('/wAQ')
  })
})

describe('decodeBytes', () => {
  it('round-trips arbitrary bytes', () => {
    const source = new Uint8Array([0, 1, 2, 253, 254, 255, 128])
    expect(decodeBytes(encodeBytes(source))).toEqual(source)
  })

  it('ignores whitespace and newlines', () => {
    expect([...decodeBytes('Zm9v\nYmFy')]).toEqual([...decodeBytes('Zm9vYmFy')])
  })

  it('rejects invalid characters', () => {
    expect(() => decodeBytes('!!!!')).toThrow()
  })
})

describe('URL-safe variant', () => {
  it('uses - and _ without padding', () => {
    const source = new Uint8Array([251, 255])
    const encoded = encodeBytesUrl(source)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(encodeBytesUrl(source)).not.toContain('=')
    expect(decodeBytesUrl(encoded)).toEqual(source)
  })
})

describe('text helpers', () => {
  it('round-trips UTF-8 text', () => {
    const text = 'héllo 😀 world'
    expect(decodeText(encodeText(text))).toBe(text)
  })

  it('round-trips URL-safe text', () => {
    const text = 'a?b=c&d'
    expect(decodeTextUrl(encodeTextUrl(text))).toBe(text)
  })
})

describe('toDataUri', () => {
  it('builds a data URI', () => {
    expect(toDataUri(bytes('hi'), 'text/plain')).toBe('data:text/plain;base64,aGk=')
  })
})
