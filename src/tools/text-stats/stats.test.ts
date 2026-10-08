import { describe, expect, it } from 'vitest'
import { analyzeText, countSentences, countWords, readingEaseLabel } from './stats'

describe('countWords', () => {
  it('ignores punctuation', () => {
    expect(countWords('Hello, world!')).toEqual(['Hello', 'world'])
    expect(countWords("don't stop")).toEqual(["don't", 'stop'])
  })
})

describe('countSentences', () => {
  it('counts terminators', () => {
    expect(countSentences('One. Two! Three?')).toBe(3)
  })

  it('counts a trailing fragment as a sentence', () => {
    expect(countSentences('One. Two')).toBe(2)
  })

  it('returns zero for empty input', () => {
    expect(countSentences('   ')).toBe(0)
  })
})

describe('analyzeText', () => {
  it('counts basics', () => {
    const stats = analyzeText('The quick brown fox. It jumps!')
    expect(stats.words).toBe(6)
    expect(stats.sentences).toBe(2)
    expect(stats.characters).toBe(30)
    expect(stats.longestWord).toBe('quick')
  })

  it('computes reading times from word count', () => {
    const stats = analyzeText(Array.from({ length: 450 }, () => 'word').join(' '))
    expect(stats.readingSeconds).toBe(120)
    expect(stats.speakingSeconds).toBeGreaterThan(150)
  })

  it('handles empty input without NaN', () => {
    const stats = analyzeText('')
    expect(stats.fleschReadingEase).toBe(0)
    expect(stats.fleschKincaidGrade).toBe(0)
    expect(Number.isNaN(stats.gunningFog)).toBe(false)
  })
})

describe('readingEaseLabel', () => {
  it('maps ranges to labels', () => {
    expect(readingEaseLabel(95)).toMatch(/very easy/)
    expect(readingEaseLabel(65)).toMatch(/standard/)
    expect(readingEaseLabel(10)).toMatch(/very hard/)
  })
})
