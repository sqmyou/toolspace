import { describe, expect, it } from 'vitest'
import {
  alphabetSize,
  CHARSETS,
  DEFAULT_OPTIONS,
  estimateStrength,
  generatePassword,
  PasswordError,
  randomInt,
  type PasswordOptions,
} from './password'

/** Deterministic PRNG so tests don't depend on the platform CSPRNG. */
function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    // xorshift32
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 0x100000000
  }
}

const opts = (over: Partial<PasswordOptions> = {}): PasswordOptions => ({
  ...DEFAULT_OPTIONS,
  ...over,
})

describe('randomInt', () => {
  it('stays within range', () => {
    const rand = seeded(1)
    for (let i = 0; i < 1000; i++) {
      const v = randomInt(10, rand)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(10)
    }
  })

  it('rejects a non-positive max', () => {
    expect(() => randomInt(0, Math.random)).toThrow(RangeError)
  })
})

describe('generatePassword', () => {
  it('honours the requested length', () => {
    for (const length of [1, 5, 20, 64]) {
      expect(generatePassword(opts({ length }), { random: seeded(length) })).toHaveLength(length)
    }
  })

  it('uses only characters from the selected sets', () => {
    const options = opts({ digits: false, symbols: false })
    const alphabet = CHARSETS.lowercase + CHARSETS.uppercase
    const pw = generatePassword(options, { random: seeded(7) })
    for (const ch of pw) expect(alphabet).toContain(ch)
  })

  it('includes at least one character from every selected set', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generatePassword(DEFAULT_OPTIONS, { random: seeded(i + 1) })
      expect(/[a-z]/.test(pw)).toBe(true)
      expect(/[A-Z]/.test(pw)).toBe(true)
      expect(/[0-9]/.test(pw)).toBe(true)
      expect(/[^a-zA-Z0-9]/.test(pw)).toBe(true)
    }
  })

  it('is deterministic for a fixed random source', () => {
    const a = generatePassword(DEFAULT_OPTIONS, { random: seeded(42) })
    const b = generatePassword(DEFAULT_OPTIONS, { random: seeded(42) })
    expect(a).toBe(b)
  })

  it('produces different output for different seeds', () => {
    const a = generatePassword(DEFAULT_OPTIONS, { random: seeded(1) })
    const b = generatePassword(DEFAULT_OPTIONS, { random: seeded(2) })
    expect(a).not.toBe(b)
  })

  it('drops ambiguous characters when asked', () => {
    const pw = generatePassword(opts({ length: 200, symbols: false }), {
      random: seeded(9),
      avoidAmbiguous: true,
    })
    for (const ch of 'Il1O0o') expect(pw).not.toContain(ch)
  })

  it('throws when no character set is selected', () => {
    expect(() =>
      generatePassword(opts({ lowercase: false, uppercase: false, digits: false, symbols: false })),
    ).toThrow(PasswordError)
  })

  it('floors fractional lengths to at least one character', () => {
    expect(generatePassword(opts({ length: 0 }), { random: seeded(3) })).toHaveLength(1)
  })
})

describe('alphabetSize', () => {
  it('counts only the enabled sets', () => {
    expect(alphabetSize(opts({ lowercase: true, uppercase: false, digits: false, symbols: false }))).toBe(26)
    expect(alphabetSize(DEFAULT_OPTIONS)).toBe(
      CHARSETS.lowercase.length + CHARSETS.uppercase.length + CHARSETS.digits.length + CHARSETS.symbols.length,
    )
  })
})

describe('estimateStrength', () => {
  it('grows with length and alphabet', () => {
    const small = estimateStrength('abc', 26)
    const big = estimateStrength('abc', 94)
    expect(big.entropyBits).toBeGreaterThan(small.entropyBits)
  })

  it('reports a top score for a long mixed password', () => {
    const pw = 'A'.repeat(32)
    expect(estimateStrength(pw, 94).score).toBe(4)
  })

  it('clamps to the documented scale', () => {
    for (const pw of ['', 'a', 'abcdefghij']) {
      const s = estimateStrength(pw, 26)
      expect(s.score).toBeGreaterThanOrEqual(0)
      expect(s.score).toBeLessThanOrEqual(4)
    }
  })
})
