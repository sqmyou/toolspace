import { describe, expect, it } from 'vitest'
import { frequency, longestWord, tokenizeWords } from './wordfreq'

describe('tokenizeWords', () => {
  it('keeps apostrophes and hyphens inside words', () => {
    expect(tokenizeWords("don't stop well-known")).toEqual(["don't", 'stop', 'well-known'])
  })

  it('splits on punctuation and whitespace', () => {
    expect(tokenizeWords('one, two;three!\nfour')).toEqual(['one', 'two', 'three', 'four'])
  })

  it('keeps accented letters and digits', () => {
    expect(tokenizeWords('café 42')).toEqual(['café', '42'])
  })

  it('returns nothing for empty input', () => {
    expect(tokenizeWords('')).toEqual([])
  })
})

describe('frequency', () => {
  it('counts words case-insensitively by default', () => {
    const report = frequency('the Cat cat CAT dog')
    expect(report.totalWords).toBe(5)
    expect(report.uniqueWords).toBe(3)
    expect(report.entries[0]).toEqual({ term: 'cat', count: 3, percent: 60 })
  })

  it('honours case sensitivity', () => {
    const report = frequency('Cat cat', { caseSensitive: true })
    expect(report.uniqueWords).toBe(2)
  })

  it('drops short words when a minimum is set', () => {
    const report = frequency('a bb ccc dddd', { minLength: 3 })
    expect(report.entries.map((entry) => entry.term)).toEqual(['ccc', 'dddd'])
  })

  it('removes stop words on request', () => {
    const withStop = frequency('the cat and the dog')
    expect(withStop.entries.some((entry) => entry.term === 'the')).toBe(true)
    const without = frequency('the cat and the dog', { ignoreStopWords: true })
    expect(without.entries.some((entry) => entry.term === 'the')).toBe(false)
  })

  it('builds bigrams and trigrams', () => {
    const report = frequency('new york city new york', { ngramSize: 2 })
    expect(report.entries[0]).toEqual({ term: 'new york', count: 2, percent: (2 / 4) * 100 })
  })

  it('caps the number of entries', () => {
    const report = frequency('a b c d e f', { top: 2 })
    expect(report.entries).toHaveLength(2)
  })

  it('breaks ties alphabetically', () => {
    const report = frequency('b a c')
    expect(report.entries.map((entry) => entry.term)).toEqual(['a', 'b', 'c'])
  })

  it('handles empty input', () => {
    const report = frequency('')
    expect(report).toEqual({ totalWords: 0, uniqueWords: 0, entries: [] })
  })
})

describe('longestWord', () => {
  it('finds the longest token', () => {
    expect(longestWord('a bb ccc')).toBe('ccc')
    expect(longestWord('')).toBe('')
  })
})
