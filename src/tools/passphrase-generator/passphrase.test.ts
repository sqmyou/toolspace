import { describe, expect, it, vi } from 'vitest'
import { entropyBits, generateBatch, generatePassphrase, PassphraseError, WORD_LIST } from './passphrase'

describe('WORD_LIST', () => {
  it('is a large, unique list of lowercase words', () => {
    expect(WORD_LIST.length).toBeGreaterThan(400)
    expect(new Set(WORD_LIST).size).toBe(WORD_LIST.length)
    expect(WORD_LIST.every((word) => /^[a-z]+$/.test(word))).toBe(true)
  })
})

describe('generatePassphrase', () => {
  it('produces the requested number of words', () => {
    const result = generatePassphrase({ words: 6 })
    expect(result.words).toHaveLength(6)
    expect(result.text.split('-')).toHaveLength(6)
  })

  it('uses a custom separator', () => {
    expect(generatePassphrase({ words: 3, separator: ' ' }).text.split(' ')).toHaveLength(3)
  })

  it('capitalises when asked', () => {
    const result = generatePassphrase({ words: 4, capitalise: true })
    for (const [i, word] of result.words.entries()) {
      expect(word.charAt(0)).toBe(word.charAt(0).toUpperCase())
      expect(result.text.split('-')[i]).toBe(word)
    }
  })

  it('appends a two-digit number when asked', () => {
    const result = generatePassphrase({ words: 2, addNumber: true })
    expect(result.text).toMatch(/-\d{2}$/)
  })

  it('reports entropy and strength consistently', () => {
    expect(generatePassphrase({ words: 1 }).entropyBits).toBeCloseTo(entropyBits(1), 5)
    expect(generatePassphrase({ words: 12 }).strength).toBe('excellent')
    expect(generatePassphrase({ words: 1 }).strength).toBe('weak')
  })

  it('rejects out-of-range word counts', () => {
    expect(() => generatePassphrase({ words: 0 })).toThrow(PassphraseError)
    expect(() => generatePassphrase({ words: 21 })).toThrow(PassphraseError)
  })

  it('is not obviously deterministic', () => {
    const seen = new Set(Array.from({ length: 20 }, () => generatePassphrase().text))
    expect(seen.size).toBeGreaterThan(1)
  })

  it('uses crypto.getRandomValues', () => {
    const spy = vi.spyOn(crypto, 'getRandomValues')
    generatePassphrase()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('generateBatch', () => {
  it('returns the requested count', () => {
    expect(generateBatch(4)).toHaveLength(4)
  })

  it('rejects an invalid batch size', () => {
    expect(() => generateBatch(0)).toThrow(PassphraseError)
  })
})

describe('entropyBits', () => {
  it('scales with the word count', () => {
    expect(entropyBits(2)).toBeCloseTo(entropyBits(1) * 2, 5)
  })
})
