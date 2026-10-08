import { describe, expect, it } from 'vitest'
import { breakdown, ByteSizeError, formatBytes, parseBytes } from './bytes'

describe('formatBytes', () => {
  it('uses decimal units by default', () => {
    expect(formatBytes(1000)).toBe('1 kB')
    expect(formatBytes(1_500_000)).toBe('1.5 MB')
    expect(formatBytes(1_000_000_000)).toBe('1 GB')
  })

  it('uses binary units when asked', () => {
    expect(formatBytes(1024, { binary: true })).toBe('1 KiB')
    expect(formatBytes(1024 ** 2, { binary: true })).toBe('1 MiB')
    expect(formatBytes(1_000_000_000, { binary: true })).toBe('953.67 MiB')
  })

  it('never shows decimals for plain bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(999)).toBe('999 B')
  })

  it('honours the decimal count', () => {
    expect(formatBytes(1234, { decimals: 0 })).toBe('1 kB')
    expect(formatBytes(1234, { decimals: 3 })).toBe('1.234 kB')
  })

  it('pins a fixed unit', () => {
    expect(formatBytes(1024, { fixedUnit: 'kB', decimals: 3 })).toBe('1.024 kB')
    expect(formatBytes(1024, { fixedUnit: 'KiB', decimals: 3 })).toBe('1 KiB')
  })

  it('keeps the sign for negative values', () => {
    expect(formatBytes(-1500)).toBe('-1.5 kB')
  })

  it('rejects non-finite input', () => {
    expect(() => formatBytes(Number.POSITIVE_INFINITY)).toThrow(ByteSizeError)
    expect(() => formatBytes(Number.NaN)).toThrow(ByteSizeError)
  })

  it('rejects an unknown fixed unit', () => {
    expect(() => formatBytes(1, { fixedUnit: 'XB' })).toThrow(ByteSizeError)
  })
})

describe('parseBytes', () => {
  it('reads a value with a unit', () => {
    expect(parseBytes('1.5 MB').bytes).toBe(1_500_000)
    expect(parseBytes('2GiB').bytes).toBe(2 * 1024 ** 3)
  })

  it('treats a bare number as bytes', () => {
    expect(parseBytes('512').bytes).toBe(512)
  })

  it('accepts several spellings', () => {
    expect(parseBytes('1k').bytes).toBe(1000)
    expect(parseBytes('1 kb').bytes).toBe(1000)
    expect(parseBytes('1 KiB').bytes).toBe(1024)
    expect(parseBytes('3 bytes').bytes).toBe(3)
  })

  it('is case-insensitive', () => {
    expect(parseBytes('5 gb').bytes).toBe(parseBytes('5 GB').bytes)
  })

  it('rejects nonsense', () => {
    expect(() => parseBytes('')).toThrow(ByteSizeError)
    expect(() => parseBytes('abc')).toThrow(ByteSizeError)
    expect(() => parseBytes('1 xb')).toThrow(ByteSizeError)
  })

  it('round-trips through formatBytes', () => {
    const original = '1.5 MB'
    expect(formatBytes(parseBytes(original).bytes)).toBe(original)
  })
})

describe('breakdown', () => {
  it('lists the common representations', () => {
    const rows = breakdown(1024)
    expect(rows).toHaveLength(6)
    expect(rows.find((row) => row.label === 'Binary')?.value).toBe('1 KiB')
    expect(rows.find((row) => row.label === 'Bits')?.value).toBe('8192 bit')
  })
})
