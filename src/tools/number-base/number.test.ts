import { describe, expect, it } from 'vitest'
import { bitLength, convert, describe as describeNumber, digitRange, formatInBase, groupDigits, parseInBase } from './number'

describe('parseInBase', () => {
  it('parses common bases', () => {
    expect(parseInBase('255', 10)).toBe(255n)
    expect(parseInBase('ff', 16)).toBe(255n)
    expect(parseInBase('0xFF', 16)).toBe(255n)
    expect(parseInBase('0b1010', 2)).toBe(10n)
    expect(parseInBase('0o377', 8)).toBe(255n)
    expect(parseInBase('377', 8)).toBe(255n)
    expect(parseInBase('z', 36)).toBe(35n)
  })

  it('ignores separators and handles signs', () => {
    expect(parseInBase('1 000_000', 10)).toBe(1000000n)
    expect(parseInBase('1,000,000', 10)).toBe(1000000n)
    expect(parseInBase("1'000'000", 10)).toBe(1000000n)
    expect(parseInBase('dead_beef', 16)).toBe(0xdeadbeefn)
    expect(parseInBase('-ff', 16)).toBe(-255n)
    expect(parseInBase('+ff', 16)).toBe(255n)
  })

  it('folds unicode digits to ASCII', () => {
    expect(parseInBase('１２３', 10)).toBe(123n) // full-width digits
    expect(parseInBase('  ff  ', 16)).toBe(255n)
  })

  it('supports very large values', () => {
    expect(parseInBase('ffffffffffffffffffffffffffffffff', 16)).toBe(2n ** 128n - 1n)
    expect(parseInBase('1'.repeat(5000), 2)).toBe(2n ** 5000n - 1n)
  })

  it('reports the invalid digit and the accepted range', () => {
    expect(() => parseInBase('12g', 16)).toThrow(/“g” is not a digit in base 16/)
    expect(() => parseInBase('12g', 16)).toThrow(/0–9 and a–f/)
    expect(() => parseInBase('2', 2)).toThrow(/0–1/)
  })

  it('rejects empty input, a bare sign or prefix, and bad bases', () => {
    expect(() => parseInBase('', 10)).toThrow(/Enter a value/)
    expect(() => parseInBase('-', 10)).toThrow(/sign or prefix/)
    expect(() => parseInBase('0x', 16)).toThrow(/sign or prefix/)
    expect(() => parseInBase('1', 1)).toThrow(/between 2 and 36/)
    expect(() => parseInBase('1', 37)).toThrow(/between 2 and 36/)
    expect(() => parseInBase('1', 2.5)).toThrow(/between 2 and 36/)
  })
})

describe('formatInBase', () => {
  it('formats values', () => {
    expect(formatInBase(255n, 16)).toBe('ff')
    expect(formatInBase(255n, 2)).toBe('11111111')
    expect(formatInBase(0n, 10)).toBe('0')
    expect(formatInBase(-10n, 10)).toBe('-10')
  })

  it('pads to a bit width without truncating a wider value', () => {
    expect(formatInBase(5n, 2, 8)).toBe('00000101')
    expect(formatInBase(0xffn, 16, 8)).toBe('ff')
    // A 9-bit value exceeds an 8-bit pad, so it keeps all its bits.
    expect(formatInBase(0x1ffn, 16, 8)).toBe('1ff')
  })

  it('never pads a negative value', () => {
    expect(formatInBase(-5n, 2, 8)).toBe('-101')
  })

  it('uppercases when asked', () => {
    expect(formatInBase(255n, 16, 0, true)).toBe('FF')
    expect(formatInBase(-255n, 16, 0, true)).toBe('-FF')
    // Uppercase is not hex-specific: letters in any base above 10 fold too.
    expect(formatInBase(35n, 36, 0, true)).toBe('Z')
  })
})

describe('bitLength', () => {
  it('counts magnitude bits and ignores the sign', () => {
    expect(bitLength(0n)).toBe(0)
    expect(bitLength(1n)).toBe(1)
    expect(bitLength(255n)).toBe(8)
    expect(bitLength(256n)).toBe(9)
    expect(bitLength(-255n)).toBe(8)
  })
})

describe('describe', () => {
  it('renders an already-parsed integer without re-parsing', () => {
    expect(describeNumber(255n)).toEqual({
      decimal: '255',
      hex: 'ff',
      octal: '377',
      binary: '11111111',
      bitLength: 8,
      byteLength: 1,
    })
  })

  it('honours padding and uppercase like convert', () => {
    expect(describeNumber(255n, 16, true).hex).toBe('00FF')
    expect(describeNumber(5n, 8).binary).toBe('00000101')
  })

  it('matches convert for the same value', () => {
    for (const value of ['0', '255', '-4096', 'deadbeefdeadbeef']) {
      expect(describeNumber(parseInBase(value, 16), 32, true)).toEqual(convert(value, 16, 32, true))
    }
  })

  it('counts bits and bytes from the magnitude, not the sign', () => {
    expect(describeNumber(-255n)).toMatchObject({ bitLength: 8, byteLength: 1 })
  })
})

describe('convert', () => {
  it('converts across bases with bit and byte counts', () => {
    expect(convert('255', 10)).toEqual({
      decimal: '255',
      hex: 'ff',
      octal: '377',
      binary: '11111111',
      bitLength: 8,
      byteLength: 1,
    })
  })

  it('rounds the byte count up', () => {
    expect(convert('256', 10).byteLength).toBe(2)
    expect(convert('0', 10)).toMatchObject({ bitLength: 0, byteLength: 0 })
  })

  it('uppercases hex when asked', () => {
    expect(convert('255', 10, 0, true).hex).toBe('FF')
  })

  it('round-trips a 128-bit value', () => {
    const hex = 'deadbeefdeadbeefdeadbeefdeadbeef'
    const result = convert(hex, 16)
    expect(parseInBase(result.decimal, 10)).toBe(parseInBase(hex, 16))
  })

  it('round-trips through every base', () => {
    const value = 12345678901234567890n
    for (let base = 2; base <= 36; base++) {
      expect(parseInBase(formatInBase(value, base), base)).toBe(value)
    }
  })
})

describe('groupDigits', () => {
  it('groups without changing the value', () => {
    expect(groupDigits('11111111', 4)).toBe('1111 1111')
    expect(groupDigits('-1010', 2)).toBe('-10 10')
    expect(groupDigits('1000000', 3)).toBe('1 000 000')
  })

  it('leaves the value untouched for a non-positive or fractional size', () => {
    expect(groupDigits('1111', 0)).toBe('1111')
    expect(groupDigits('1111', -2)).toBe('1111')
    expect(groupDigits('1111', 2.5)).toBe('1111')
  })

  it('does not add a trailing space', () => {
    expect(groupDigits('1111', 4)).toBe('1111')
    expect(groupDigits('11111', 4)).toBe('1 1111')
  })
})

describe('digitRange', () => {
  it('describes the digits a base accepts', () => {
    expect(digitRange(2)).toBe('0–1')
    expect(digitRange(10)).toBe('0–9')
    expect(digitRange(16)).toBe('0–9 and a–f')
    expect(digitRange(36)).toBe('0–9 and a–z')
  })
})
