import { describe, expect, it } from 'vitest'
import { abbreviate, formatNumber, NumberError, numberToWords, parseNumber, representations, toFixed } from './format'

describe('parseNumber', () => {
  it('reads a plain number', () => {
    expect(parseNumber('1234')).toBe(1234)
    expect(parseNumber('-42.5')).toBe(-42.5)
  })

  it('ignores grouping separators', () => {
    expect(parseNumber('1,234,567')).toBe(1234567)
    expect(parseNumber('1 234 567')).toBe(1234567)
  })

  it('detects a comma decimal mark', () => {
    expect(parseNumber('1.234,56')).toBe(1234.56)
    expect(parseNumber('12,5')).toBe(12.5)
  })

  it('reads accounting negatives', () => {
    expect(parseNumber('(1,200)')).toBe(-1200)
  })

  it('strips currency symbols', () => {
    expect(parseNumber('$1,299.99')).toBe(1299.99)
    expect(parseNumber('€1.299,99')).toBe(1299.99)
  })

  it('rejects junk', () => {
    expect(() => parseNumber('')).toThrow(NumberError)
    expect(() => parseNumber('abc')).toThrow(NumberError)
  })
})

describe('formatNumber', () => {
  it('groups by locale', () => {
    expect(formatNumber(1234567.89, { locale: 'en-US' })).toBe('1,234,567.89')
    expect(formatNumber(1234567.89, { locale: 'de-DE' })).toBe('1.234.567,89')
  })

  it('formats currency and percent', () => {
    expect(formatNumber(1234.5, { locale: 'en-US', style: 'currency', currency: 'USD' })).toBe('$1,234.50')
    expect(formatNumber(0.25, { locale: 'en-US', style: 'percent' })).toBe('25%')
  })

  it('formats compact notation', () => {
    expect(formatNumber(1500, { locale: 'en-US', compact: true })).toBe('1.5K')
  })

  it('honours fixed decimal places', () => {
    expect(formatNumber(5, { minimumFractionDigits: 2, maximumFractionDigits: 2 })).toBe('5.00')
  })

  it('can always show a sign', () => {
    expect(formatNumber(5, { signDisplay: 'always' })).toBe('+5')
  })

  it('rejects non-finite values and bad options', () => {
    expect(() => formatNumber(Number.NaN)).toThrow(NumberError)
    expect(() => formatNumber(1, { style: 'currency', currency: 'not-a-currency' })).toThrow(NumberError)
  })

  it('falls back for an unknown locale instead of throwing', () => {
    expect(formatNumber(1234, { locale: 'not-a-locale' })).toBeTruthy()
  })
})

describe('toFixed', () => {
  it('fixes the decimal places', () => {
    expect(toFixed(1.005, 2)).toBe('1.00')
    expect(toFixed(2, 3)).toBe('2.000')
  })

  it('rejects bad precision', () => {
    expect(() => toFixed(1, -1)).toThrow(NumberError)
    expect(() => toFixed(1, 1.5)).toThrow(NumberError)
  })
})

describe('abbreviate', () => {
  it('shortens large magnitudes', () => {
    expect(abbreviate(1500)).toBe('1.5K')
    expect(abbreviate(2_400_000)).toBe('2.4M')
    expect(abbreviate(3_000_000_000)).toBe('3B')
  })

  it('leaves small numbers alone', () => {
    expect(abbreviate(999)).toBe('999')
    expect(abbreviate(0)).toBe('0')
  })

  it('keeps the sign', () => {
    expect(abbreviate(-1500)).toBe('-1.5K')
  })
})

describe('numberToWords', () => {
  it('writes small numbers', () => {
    expect(numberToWords(0)).toBe('zero')
    expect(numberToWords(7)).toBe('seven')
    expect(numberToWords(19)).toBe('nineteen')
    expect(numberToWords(42)).toBe('forty-two')
  })

  it('writes hundreds and thousands', () => {
    expect(numberToWords(100)).toBe('one hundred')
    expect(numberToWords(1234)).toBe('one thousand two hundred thirty-four')
    expect(numberToWords(1_000_001)).toBe('one million one')
  })

  it('writes negatives', () => {
    expect(numberToWords(-5)).toBe('negative five')
  })

  it('rejects fractions and huge values', () => {
    expect(() => numberToWords(1.5)).toThrow(NumberError)
    expect(() => numberToWords(1e16)).toThrow(NumberError)
  })
})

describe('representations', () => {
  it('lists the common forms', () => {
    const rows = representations(255)
    const lookup = Object.fromEntries(rows)
    expect(lookup['Hexadecimal']).toBe('0xff')
    expect(lookup['Binary']).toBe('11111111')
    expect(lookup['Plain']).toBe('255')
    expect(lookup['Currency (USD)']).toBe('$255.00')
  })

  it('skips binary for non-integers', () => {
    const lookup = Object.fromEntries(representations(1.5))
    expect(lookup['Binary']).toBe('—')
    expect(lookup['Hexadecimal']).toBe('—')
  })
})
