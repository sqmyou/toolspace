import { describe, expect, it } from 'vitest'
import { normalise, scoreQuery, scoreToken, tokenize } from './fuzzy'

describe('normalise / tokenize', () => {
  it('folds case and accents', () => {
    expect(normalise('Café')).toBe('cafe')
    expect(normalise('  MiXeD  ')).toBe('  mixed  ')
  })

  it('splits on whitespace and drops empties', () => {
    expect(tokenize('  base   64  ')).toEqual(['base', '64'])
    expect(tokenize('')).toEqual([])
  })
})

describe('scoreToken', () => {
  it('ranks an exact match highest', () => {
    expect(scoreToken('uuid', 'uuid')).toBe(1)
  })

  it('scores a prefix highly', () => {
    expect(scoreToken('uuid', 'uuid generator')).toBeGreaterThan(0.9)
  })

  it('scores a word-boundary hit above a mid-word hit', () => {
    const boundary = scoreToken('base', 'number base converter')
    const midWord = scoreToken('base', 'database explorer')
    expect(boundary).toBeGreaterThan(midWord)
  })

  it('matches a word prefix inside a longer name', () => {
    expect(scoreToken('gen', 'uuid generator')).toBeGreaterThan(0)
  })

  it('tolerates a single typo', () => {
    expect(scoreToken('jason', 'json')).toBeGreaterThan(0)
    expect(scoreToken('colur', 'color')).toBeGreaterThan(0)
  })

  it('tolerates a transposition-like typo', () => {
    expect(scoreToken('bse64', 'base64')).toBeGreaterThan(0)
  })

  it('rejects unrelated text', () => {
    expect(scoreToken('uuid', 'cron expression explainer')).toBe(0)
    expect(scoreToken('zzzz', 'json')).toBe(0)
  })

  it('does not match an empty needle', () => {
    expect(scoreToken('', 'anything')).toBe(0)
  })

  it('finds scattered subsequences', () => {
    expect(scoreToken('jsn', 'json')).toBeGreaterThan(0)
  })

  it('drops the loose tiers when fuzzy is disabled', () => {
    // "colour" has one edit from "color", so it only matches fuzzily.
    expect(scoreToken('colour', 'color converter', false)).toBe(0)
    expect(scoreToken('colour', 'color converter', true)).toBeGreaterThan(0)
    // A plain substring still matches with fuzzy disabled.
    expect(scoreToken('color', 'color converter', false)).toBeGreaterThan(0)
  })
})

describe('scoreQuery', () => {
  const fields = [
    { text: 'Base64 Decoder', weight: 1 },
    { text: 'Encode and decode base64', weight: 0.5 },
    { text: 'Encoding', weight: 0.3 },
  ]

  it('rewards a match on the high-weight field', () => {
    const strong = scoreQuery(['base64'], fields)
    const weak = scoreQuery(['encoding'], fields)
    expect(strong).toBeGreaterThan(weak)
  })

  it('requires every token to match', () => {
    expect(scoreQuery(['base64', 'missing'], fields)).toBe(0)
  })

  it('is order independent across tokens', () => {
    expect(scoreQuery(['base64', 'decode'], fields)).toBeCloseTo(scoreQuery(['decode', 'base64'], fields))
  })

  it('returns zero for no tokens', () => {
    expect(scoreQuery([], fields)).toBe(0)
  })
})
