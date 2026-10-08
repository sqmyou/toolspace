import { describe, expect, it } from 'vitest'
import { convert, formatInBase, groupDigits, parseInBase } from './number'

describe('parseInBase', () => {
  it('parses common bases', () => {
    expect(parseInBase('255', 10)).toBe(255n)
    expect(parseInBase('ff', 16)).toBe(255n)
    expect(parseInBase('0xFF', 16)).toBe(255n)
    expect(parseInBase('0b1010', 2)).toBe(10n)
    expect(parseInBase('377', 8)).toBe(255n)
  })

  it('ignores separators and handles signs', () => {
    expect(parseInBase('1 000_000', 10)).toBe(1000000n)
    expect(parseInBase('-ff', 16)).toBe(-255n)
  })

  it('supports very large values', () => {
    expect(parseInBase('ffffffffffffffffffffffffffffffff', 16)).toBe(2n ** 128n - 1n)
  })

  it('rejects invalid digits', () => {
    expect(() => parseInBase('12g', 16)).toThrow(/not a valid digit/)
    expect(() => parseInBase('2', 2)).toThrow()
  })

  it('rejects empty input and bad bases', () => {
    expect(() => parseInBase('', 10)).toThrow()
    expect(() => parseInBase('1', 1)).toThrow()
    expect(() => parseInBase('1', 37)).toThrow()
  })
})

describe('formatInBase', () => {
  it('formats values', () => {
    expect(formatInBase(255n, 16)).toBe('ff')
    expect(formatInBase(255n, 2)).toBe('11111111')
    expect(formatInBase(0n, 10)).toBe('0')
    expect(formatInBase(-10n, 10)).toBe('-10')
  })

  it('pads to a bit width', () => {
    expect(formatInBase(5n, 2, 8)).toBe('00000101')
  })
})

describe('convert', () => {
  it('converts across bases', () => {
    expect(convert('255', 10)).toEqual({
      decimal: '255', hex: 'ff', octal: '377', binary: '11111111',
    })
  })

  it('uppercases hex when asked', () => {
    expect(convert('255', 10, 0, true).hex).toBe('FF')
  })

  it('round-trips a 128-bit value', () => {
    const hex = 'deadbeefdeadbeefdeadbeefdeadbeef'
    const result = convert(hex, 16)
    expect(parseInBase(result.decimal, 10)).toBe(parseInBase(hex, 16))
  })
})

describe('groupDigits', () => {
  it('groups without changing the value', () => {
    expect(groupDigits('11111111', 4)).toBe('1111 1111')
    expect(groupDigits('-1010', 2)).toBe('-10 10')
  })
})
