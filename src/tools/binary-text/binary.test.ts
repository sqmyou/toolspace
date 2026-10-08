import { describe, expect, it } from 'vitest'
import { binaryStats, binaryToText, BinaryError, groupBits, textToBinary } from './binary'

describe('textToBinary', () => {
  it('encodes ASCII as eight bits per byte', () => {
    expect(textToBinary('A')).toBe('01000001')
    expect(textToBinary('Hi')).toBe('0100100001101001')
  })

  it('encodes non-ASCII as UTF-8 bytes', () => {
    expect(textToBinary('é')).toBe('1100001110101001')
  })

  it('can space the bytes', () => {
    expect(textToBinary('Hi', { spaced: true })).toBe('01001000 01101001')
  })

  it('can prefix the bytes', () => {
    expect(textToBinary('A', { prefixed: true })).toBe('0b01000001')
  })

  it('can reverse the bit order', () => {
    expect(textToBinary('A', { reversed: true })).toBe('10000010')
  })

  it('returns an empty string for empty input', () => {
    expect(textToBinary('')).toBe('')
  })
})

describe('binaryToText', () => {
  it('decodes eight-bit groups', () => {
    expect(binaryToText('01000001')).toBe('A')
    expect(binaryToText('0100100001101001')).toBe('Hi')
  })

  it('ignores whitespace, underscores and 0b prefixes', () => {
    expect(binaryToText('0100 1000 0110 1001')).toBe('Hi')
    expect(binaryToText('0b01001000_0b01101001')).toBe('Hi')
  })

  it('round-trips ASCII and non-ASCII', () => {
    for (const text of ['A', 'Hi', 'toolspace', 'café ☕']) {
      expect(binaryToText(textToBinary(text))).toBe(text)
    }
  })

  it('round-trips with reversed bits', () => {
    const encoded = textToBinary('Hi', { reversed: true })
    expect(binaryToText(encoded, { reversed: true })).toBe('Hi')
  })

  it('rejects non-binary characters', () => {
    expect(() => binaryToText('0102')).toThrow(BinaryError)
  })

  it('rejects a partial byte', () => {
    expect(() => binaryToText('010')).toThrow(BinaryError)
  })

  it('returns an empty string for empty input', () => {
    expect(binaryToText('   ')).toBe('')
  })
})

describe('groupBits', () => {
  it('groups from the left', () => {
    expect(groupBits('0100100001101001', 4)).toBe('0100 1000 0110 1001')
  })

  it('leaves a short tail intact', () => {
    expect(groupBits('010010000', 8)).toBe('01001000 0')
  })

  it('returns the input unchanged for a size of zero', () => {
    expect(groupBits('01001000', 0)).toBe('01001000')
  })
})

describe('binaryStats', () => {
  it('counts bits and bytes', () => {
    const stats = binaryStats('0100100001101001')
    expect(stats.bits).toBe(16)
    expect(stats.bytes).toBe(2)
    expect(stats.ones).toBe(6)
    expect(stats.zeros).toBe(10)
    expect(stats.density).toBeCloseTo(0.375)
  })

  it('rounds bytes up for a partial byte', () => {
    expect(binaryStats('010').bytes).toBe(1)
  })

  it('handles empty input', () => {
    expect(binaryStats('').density).toBe(0)
  })

  it('rejects non-binary input', () => {
    expect(() => binaryStats('0102')).toThrow(BinaryError)
  })
})
