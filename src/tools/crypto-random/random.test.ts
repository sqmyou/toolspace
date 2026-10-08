import { describe, expect, it } from 'vitest'
import { CHAR_SETS, pick, randomBetween, randomBytes, randomHex, randomInt, randomPassphrase, randomPassword, RandomError, randomToken, shuffle } from './random'

describe('randomInt', () => {
  it('stays within the range', () => {
    for (let i = 0; i < 500; i++) {
      const value = randomInt(10)
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(10)
    }
  })

  it('covers the whole range over many draws', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 2000; i++) seen.add(randomInt(6))
    expect(seen.size).toBe(6)
  })

  it('supports a range of one', () => {
    expect(randomInt(1)).toBe(0)
  })

  it('rejects invalid ranges', () => {
    expect(() => randomInt(0)).toThrow(RandomError)
    expect(() => randomInt(-5)).toThrow(RandomError)
    expect(() => randomInt(1.5)).toThrow(RandomError)
    expect(() => randomInt(2 ** 33)).toThrow(RandomError)
  })
})

describe('randomBetween', () => {
  it('includes both ends', () => {
    expect(randomBetween(5, 5)).toBe(5)
    for (let i = 0; i < 200; i++) {
      const value = randomBetween(1, 3)
      expect(value).toBeGreaterThanOrEqual(1)
      expect(value).toBeLessThanOrEqual(3)
    }
  })

  it('rejects a reversed range', () => {
    expect(() => randomBetween(5, 1)).toThrow(RandomError)
  })
})

describe('randomBytes / randomHex / randomToken', () => {
  it('returns the requested number of bytes', () => {
    expect(randomBytes(16)).toHaveLength(16)
    expect(randomBytes(0)).toHaveLength(0)
  })

  it('produces hex of the requested length', () => {
    const hex = randomHex(20)
    expect(hex).toHaveLength(20)
    expect(hex).toMatch(/^[0-9a-f]+$/)
  })

  it('produces a url-safe token with no padding', () => {
    const token = randomToken(24)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(token).not.toContain('=')
  })

  it('does not repeat itself', () => {
    expect(new Set(Array.from({ length: 100 }, () => randomHex(16))).size).toBe(100)
  })

  it('rejects a negative length', () => {
    expect(() => randomBytes(-1)).toThrow(RandomError)
  })
})

describe('pick', () => {
  it('returns an element of the list', () => {
    const items = ['a', 'b', 'c']
    for (let i = 0; i < 100; i++) expect(items).toContain(pick(items))
  })

  it('rejects an empty list', () => {
    expect(() => pick([])).toThrow(RandomError)
  })
})

describe('randomPassword', () => {
  it('respects the requested length', () => {
    expect(randomPassword({ length: 24, sets: ['lower', 'upper', 'digits'] })).toHaveLength(24)
  })

  it('uses only the selected sets', () => {
    const password = randomPassword({ length: 200, sets: ['digits'] })
    expect(password).toMatch(/^[0-9]+$/)
  })

  it('includes one of each set when required', () => {
    for (let i = 0; i < 50; i++) {
      const password = randomPassword({ length: 8, sets: ['lower', 'upper', 'digits', 'symbols'], requireEach: true })
      expect(password).toMatch(/[a-z]/)
      expect(password).toMatch(/[A-Z]/)
      expect(password).toMatch(/[0-9]/)
      expect(password).toMatch(/[!@#$%^&*()\-_=+[\]{};:,.?/]/)
    }
  })

  it('does not always put the guaranteed characters first', () => {
    const firstChars = new Set<string>()
    for (let i = 0; i < 60; i++) firstChars.add(randomPassword({ length: 8, sets: ['lower', 'upper', 'digits', 'symbols'], requireEach: true })[0])
    expect(firstChars.size).toBeGreaterThan(1)
  })

  it('rejects bad options', () => {
    expect(() => randomPassword({ length: 10, sets: [] })).toThrow(RandomError)
    expect(() => randomPassword({ length: 0, sets: ['lower'] })).toThrow(RandomError)
    expect(() => randomPassword({ length: 2, sets: ['lower', 'upper', 'digits'], requireEach: true })).toThrow(RandomError)
  })

  it('ignores unknown set names', () => {
    expect(() => randomPassword({ length: 10, sets: ['nope' as never] })).toThrow(RandomError)
  })

  it('exposes the expected character sets', () => {
    expect(CHAR_SETS.lower).toHaveLength(26)
    expect(CHAR_SETS.digits).toBe('0123456789')
  })
})

describe('shuffle', () => {
  it('keeps every element', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8]
    expect(shuffle(items).sort()).toEqual(items)
  })

  it('does not modify the input', () => {
    const items = [1, 2, 3]
    shuffle(items)
    expect(items).toEqual([1, 2, 3])
  })

  it('actually reorders over many runs', () => {
    const orders = new Set(Array.from({ length: 40 }, () => shuffle([1, 2, 3, 4, 5]).join('')))
    expect(orders.size).toBeGreaterThan(1)
  })
})

describe('randomPassphrase', () => {
  it('joins the requested number of words', () => {
    const words = ['alpha', 'bravo', 'charlie', 'delta']
    const phrase = randomPassphrase(words, 3)
    expect(phrase.split('-')).toHaveLength(3)
    for (const word of phrase.split('-')) expect(words).toContain(word)
  })

  it('can append digits to each word', () => {
    const phrase = randomPassphrase(['alpha', 'bravo'], 2, '.', 2)
    // Words are drawn independently, so the same word may appear twice.
    for (const part of phrase.split('.')) expect(part).toMatch(/^(alpha|bravo)\d\d$/)
  })

  it('rejects bad input', () => {
    expect(() => randomPassphrase([], 3)).toThrow(RandomError)
    expect(() => randomPassphrase(['a'], 0)).toThrow(RandomError)
  })
})
