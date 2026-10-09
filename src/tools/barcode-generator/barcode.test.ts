import { describe, expect, it } from 'vitest'
import {
  BarcodeError,
  ean13CheckDigit,
  encode,
  encodeCode128,
  encodeEan13,
  modulesToSvg,
  normaliseInput,
} from './barcode'

describe('encodeCode128', () => {
  it('builds start B, the data and a trailing stop', () => {
    const modules = encodeCode128('ABC')
    // 104 (start B) + 3 data symbols + checksum + stop = 5 symbols + stop.
    expect(modules).toHaveLength(5 * 11 + 13)
    expect(modules.startsWith('11010010000')).toBe(true) // start B
    expect(modules.endsWith('1100011101011')).toBe(true) // stop
  })

  it('packs digit pairs with set C', () => {
    // 105 (start C) + three pairs + checksum + stop.
    expect(encodeCode128('123456')).toHaveLength(5 * 11 + 13)
    expect(encodeCode128('123456').startsWith('11010011100')).toBe(true) // start C
  })

  it('falls back to set B for a lone trailing digit', () => {
    const modules = encodeCode128('12345')
    // start C, two pairs, switch-to-B, one char, checksum, stop.
    expect(modules).toHaveLength(6 * 11 + 13)
  })

  it('rejects empty and non-ASCII input', () => {
    expect(() => encodeCode128('')).toThrow(BarcodeError)
    expect(() => encodeCode128('café')).toThrow(BarcodeError)
    expect(() => encodeCode128('tab\there')).toThrow(BarcodeError)
  })
})

describe('encodeEan13', () => {
  it('matches known encodings exactly', () => {
    expect(encodeEan13('5901234123457')).toBe(
      '10100010110100111011001100100110111101001110101010110011011011001000010101110010011101000100101',
    )
    expect(encodeEan13('4006381333931')).toBe(
      '10100011010100111010111101111010001001011001101010100001010000101000010111010010000101100110101',
    )
  })

  it('computes the check digit and appends it to 12 digits', () => {
    expect(ean13CheckDigit('590123412345')).toBe(7)
    expect(encodeEan13('590123412345')).toBe(encodeEan13('5901234123457'))
  })

  it('always produces 95 modules', () => {
    expect(encodeEan13('4006381333931')).toHaveLength(95)
  })

  it('rejects a wrong check digit and the wrong length', () => {
    expect(() => encodeEan13('5901234123450')).toThrow(BarcodeError)
    expect(() => encodeEan13('123')).toThrow(BarcodeError)
  })
})

describe('normaliseInput / encode', () => {
  it('adds the check digit for a 12-digit EAN', () => {
    expect(normaliseInput('ean13', '590123412345')).toBe('5901234123457')
    expect(normaliseInput('code128', 'hello')).toBe('hello')
  })

  it('routes through the requested symbology', () => {
    expect(encode('ean13', '5901234123457')).toHaveLength(95)
    expect(encode('code128', 'hello').length).toBeGreaterThan(50)
  })
})

describe('modulesToSvg', () => {
  it('produces a sized, self-contained SVG', () => {
    const svg = modulesToSvg('10101', { moduleWidth: 2, quietZone: 4, showText: false })
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('viewBox="0 0 26 90"')
    expect(svg).toContain('<path')
  })
})
