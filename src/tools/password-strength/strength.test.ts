import { describe, expect, it } from 'vitest'
import { analyzePassword, estimateGuessesLog10 } from './strength'

describe('estimateGuessesLog10', () => {
  it('returns 0 for an empty password', () => {
    expect(estimateGuessesLog10('')).toBe(0)
  })

  it('treats a numeric password by value, not digit entropy', () => {
    // "1234" is at most ~1234 guesses, i.e. ~3.1 log10
    expect(estimateGuessesLog10('1234')).toBeLessThan(4)
  })

  it('penalises a repeated character hard', () => {
    expect(estimateGuessesLog10('aaaaaaaaaaaaaaaa')).toBeLessThan(6)
  })

  it('penalises a short keyboard walk', () => {
    expect(estimateGuessesLog10('qwerty')).toBeLessThan(estimateGuessesLog10('mK7#xQ'))
  })

  it('rewards length for random-looking input', () => {
    expect(estimateGuessesLog10('Tr0ub4dour&3xK9z')).toBeGreaterThan(estimateGuessesLog10('Tr0ub4dour&3'))
  })

  it('handles a repeated unit such as "abcabcabc"', () => {
    expect(estimateGuessesLog10('abcabcabcabc')).toBeLessThan(estimateGuessesLog10('abcXYZpqr912'))
  })
})

describe('analyzePassword', () => {
  it('gives an empty password the weakest score', () => {
    const result = analyzePassword('')
    expect(result.score).toBe(0)
    expect(result.label).toBe('very weak')
    expect(result.suggestions.length).toBeGreaterThan(0)
  })

  it('flags a common password', () => {
    const result = analyzePassword('password')
    expect(result.label).toBe('very weak')
    expect(result.weaknesses.join(' ')).toMatch(/common/i)
  })

  it('flags a keyboard pattern', () => {
    const result = analyzePassword('qwerty123')
    expect(result.score).toBeLessThanOrEqual(1)
    expect(result.weaknesses.join(' ')).toMatch(/keyboard|common/i)
  })

  it('flags repeats and sequences', () => {
    expect(analyzePassword('aaaaaaBBBBBB').weaknesses.join(' ')).toMatch(/repeats a character/i)
    expect(analyzePassword('abcd9876efgh').weaknesses.join(' ')).toMatch(/sequential|straight run/i)
  })

  it('rates a long random password highly', () => {
    const result = analyzePassword('gT7#pLq2$Xw9mVz4')
    expect(result.score).toBeGreaterThanOrEqual(3)
    expect(result.label).toMatch(/strong/)
  })

  it('rates a long passphrase reasonably without calling it weak', () => {
    const result = analyzePassword('correct-horse-battery-staple-42')
    expect(result.score).toBeGreaterThanOrEqual(2)
  })

  it('reports a crack time string', () => {
    expect(analyzePassword('gT7#pLq2$Xw9mVz4').crackTime).toMatch(/year/)
  })

  it('reports entropy in bits', () => {
    expect(analyzePassword('abcdef').entropyBits).toBeGreaterThan(0)
  })

  it('suggests more length for short passwords', () => {
    expect(analyzePassword('Ab3$x').suggestions.join(' ')).toMatch(/12 characters/)
  })

  it('is deterministic', () => {
    const a = analyzePassword('Some-Pass-123')
    const b = analyzePassword('Some-Pass-123')
    expect(a).toEqual(b)
  })
})
