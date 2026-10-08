import { describe, expect, it } from 'vitest'
import { countSentences, countText, evaluateLimit, evaluateLimits, formatDuration, letterFrequency, LIMITS } from './count'

describe('countText', () => {
  it('counts characters, letters and words', () => {
    const result = countText('Hello world')
    expect(result.characters).toBe(11)
    expect(result.charactersNoSpaces).toBe(10)
    expect(result.letters).toBe(10)
    expect(result.words).toBe(2)
    expect(result.spaces).toBe(1)
  })

  it('counts an emoji as one character, not two', () => {
    expect(countText('😀').characters).toBe(1)
    expect(countText('a😀').characters).toBe(2)
  })

  it('treats contractions and hyphenated words as single words', () => {
    expect(countText("don't").words).toBe(1)
    expect(countText('well-known').words).toBe(1)
    expect(countText('state-of-the-art').words).toBe(1)
  })

  it('counts a bare number as a word but not a dash', () => {
    expect(countText('42').words).toBe(1)
    expect(countText('---').words).toBe(0)
    expect(countText('v2 release').words).toBe(2)
  })

  it('counts accented and non-latin letters', () => {
    expect(countText('café').letters).toBe(4)
    expect(countText('日本語').letters).toBe(3)
    expect(countText('naïve façade').words).toBe(2)
  })

  it('counts unique words case-insensitively', () => {
    expect(countText('the The THE cat').uniqueWords).toBe(2)
  })

  it('counts paragraphs by blank lines and ignores trailing whitespace', () => {
    expect(countText('one\n\ntwo\n\nthree').paragraphs).toBe(3)
    expect(countText('   ').paragraphs).toBe(0)
    expect(countText('one\n\n\n\ntwo').paragraphs).toBe(2)
  })

  it('returns zeroes for empty input', () => {
    const result = countText('')
    expect(result.characters).toBe(0)
    expect(result.words).toBe(0)
    expect(result.sentences).toBe(0)
    expect(result.paragraphs).toBe(0)
    expect(result.lines).toBe(0)
  })

  it('tracks upper and lower case counts', () => {
    const result = countText('AbC dEf')
    expect(result.upper).toBe(3)
    expect(result.lower).toBe(3)
  })

  it('estimates reading time at 200 words per minute', () => {
    expect(countText(Array.from({ length: 200 }, () => 'word').join(' ')).readingSeconds).toBe(60)
    expect(countText(Array.from({ length: 400 }, () => 'word').join(' ')).readingSeconds).toBe(120)
    expect(countText('one word').readingSeconds).toBe(1)
  })
})

describe('countSentences', () => {
  it('splits on full stops, question marks and exclamations', () => {
    expect(countSentences('One. Two? Three!')).toBe(3)
  })

  it('does not count a trailing stop as an empty sentence', () => {
    expect(countSentences('Only one.')).toBe(1)
  })

  it('treats unpunctuated text as a single sentence', () => {
    expect(countSentences('no punctuation here')).toBe(1)
  })

  it('ignores ellipses mid-sentence', () => {
    expect(countSentences('Wait… what?')).toBe(2)
  })

  it('returns zero for empty or punctuation-only input', () => {
    expect(countSentences('')).toBe(0)
    expect(countSentences('...')).toBe(0)
  })
})

describe('letterFrequency', () => {
  it('orders by frequency then alphabetically', () => {
    expect(letterFrequency('aabbbc')).toEqual([
      { letter: 'b', count: 3 },
      { letter: 'a', count: 2 },
      { letter: 'c', count: 1 },
    ])
  })

  it('ignores non-letters and respects the limit', () => {
    const result = letterFrequency('a1!b2@c3', 2)
    expect(result).toHaveLength(2)
    expect(result.map((entry) => entry.letter)).toEqual(['a', 'b'])
  })
})

describe('evaluateLimit', () => {
  const limit = LIMITS.find((entry) => entry.field === 'Post' && entry.platform === 'Twitter / X')!

  it('flags ok, near and over states', () => {
    expect(evaluateLimit(limit, countText('short')).state).toBe('ok')
    expect(evaluateLimit(limit, countText('x'.repeat(260))).state).toBe('near')
    expect(evaluateLimit(limit, countText('x'.repeat(300))).state).toBe('over')
  })

  it('reports the remaining characters', () => {
    expect(evaluateLimit(limit, countText('x'.repeat(100))).remaining).toBe(180)
    expect(evaluateLimit(limit, countText('x'.repeat(300))).remaining).toBe(-20)
  })
})

describe('evaluateLimits', () => {
  it('returns every limit when no platform is chosen', () => {
    expect(evaluateLimits(countText('hi'))).toHaveLength(LIMITS.length)
  })

  it('filters by platform', () => {
    const results = evaluateLimits(countText('hi'), 'YouTube')
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((entry) => entry.platform === 'YouTube')).toBe(true)
  })

  it('measures word limits against the word count', () => {
    const wordLimit = LIMITS.find((entry) => entry.kind === 'word')!
    const status = evaluateLimit(wordLimit, countText('one two three'))
    expect(status.used).toBe(3)
  })
})

describe('formatDuration', () => {
  it('formats seconds, minutes and hours', () => {
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(45)).toBe('45s')
    expect(formatDuration(90)).toBe('1m 30s')
    expect(formatDuration(120)).toBe('2m')
    expect(formatDuration(3900)).toBe('1h 05m')
  })
})
