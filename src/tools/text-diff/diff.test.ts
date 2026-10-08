import { describe, expect, it } from 'vitest'
import { diffLines, diffStats, diffWords, tokenize } from './diff'

describe('diffLines', () => {
  it('marks unchanged, added and removed lines', () => {
    const parts = diffLines('a\nb\nc', 'a\nx\nc')
    expect(parts.map((p) => p.type)).toEqual(['equal', 'remove', 'add', 'equal'])
  })

  it('handles pure additions', () => {
    const parts = diffLines('a', 'a\nb')
    expect(parts).toEqual([
      { type: 'equal', value: 'a' },
      { type: 'add', value: 'b' },
    ])
  })

  it('handles empty sides', () => {
    expect(diffLines('', 'a').some((p) => p.type === 'add')).toBe(true)
    expect(diffLines('a', '').some((p) => p.type === 'remove')).toBe(true)
  })
})

describe('diffWords', () => {
  it('finds changed words with exact spacing', () => {
    const parts = diffWords('the quick fox', 'the slow fox')
    const removed = parts.filter((p) => p.type === 'remove').map((p) => p.value).join('')
    const added = parts.filter((p) => p.type === 'add').map((p) => p.value).join('')
    expect(removed).toContain('quick')
    expect(added).toContain('slow')
  })
})

describe('tokenize', () => {
  it('keeps whitespace', () => {
    expect(tokenize('a  b')).toEqual(['a', '  ', 'b'])
  })
})

describe('diffStats', () => {
  it('counts changes', () => {
    const stats = diffStats(diffLines('a\nb', 'a\nc'))
    expect(stats.removed).toBe(1)
    expect(stats.added).toBe(1)
    expect(stats.unchanged).toBeGreaterThanOrEqual(1)
  })
})
