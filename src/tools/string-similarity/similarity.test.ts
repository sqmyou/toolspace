import { describe, expect, it } from 'vitest'
import {
  compare,
  damerauLevenshtein,
  dice,
  jaro,
  jaroWinkler,
  levenshtein,
  percent,
} from './similarity'

describe('levenshtein', () => {
  it('is zero for equal strings', () => {
    expect(levenshtein('kitten', 'kitten')).toBe(0)
    expect(levenshtein('', '')).toBe(0)
  })

  it('counts single-character edits', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3)
    expect(levenshtein('flaw', 'lawn')).toBe(2)
  })

  it('handles an empty side as the length', () => {
    expect(levenshtein('abc', '')).toBe(3)
    expect(levenshtein('', 'abcd')).toBe(4)
  })

  it('is symmetric', () => {
    expect(levenshtein('night', 'nacht')).toBe(levenshtein('nacht', 'night'))
  })
})

describe('damerauLevenshtein', () => {
  it('treats a transposition as one edit', () => {
    expect(damerauLevenshtein('teh', 'the')).toBe(1)
    expect(levenshtein('teh', 'the')).toBe(2)
  })

  it('matches the plain distance when no swap helps', () => {
    expect(damerauLevenshtein('kitten', 'sitting')).toBe(3)
  })
})

describe('jaro and jaroWinkler', () => {
  it('is 1 for identical and 0 for no overlap', () => {
    expect(jaro('same', 'same')).toBe(1)
    expect(jaro('abc', 'xyz')).toBe(0)
  })

  it('scores known pairs', () => {
    expect(jaro('MARTHA', 'MARHTA')).toBeCloseTo(0.944, 3)
    expect(jaro('DWAYNE', 'DUANE')).toBeCloseTo(0.822, 3)
  })

  it('boosts a shared prefix in Jaro–Winkler', () => {
    const base = jaro('MARTHA', 'MARHTA')
    expect(jaroWinkler('MARTHA', 'MARHTA')).toBeGreaterThan(base)
  })

  it('does not boost below the 0.7 threshold', () => {
    expect(jaroWinkler('abc', 'xyz')).toBe(jaro('abc', 'xyz'))
  })
})

describe('dice', () => {
  it('is 1 for identical and 0 for no shared bigrams', () => {
    expect(dice('night', 'night')).toBe(1)
    expect(dice('abc', 'xyz')).toBe(0)
  })

  it('rewards shared bigrams', () => {
    expect(dice('night', 'nacht')).toBeCloseTo(0.25, 2)
  })

  it('is 0 for strings shorter than two characters', () => {
    expect(dice('a', 'a')).toBe(1)
    expect(dice('a', 'b')).toBe(0)
  })
})

describe('compare', () => {
  it('returns every measure together', () => {
    const result = compare('kitten', 'sitting')
    expect(result.levenshtein).toBe(3)
    expect(result.damerau).toBe(3)
    expect(result.jaro).toBeGreaterThan(0)
    expect(result.jaroWinkler).toBeGreaterThanOrEqual(result.jaro)
    expect(result.dicePercent).toBeCloseTo(result.dice * 100)
  })

  it('puts percent in the expected range', () => {
    expect(percent(0)).toBe(0)
    expect(percent(1)).toBe(100)
    expect(percent(0.12345)).toBe(12.3)
  })
})
