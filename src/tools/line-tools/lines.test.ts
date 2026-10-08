import { describe, expect, it } from 'vitest'
import { DEFAULT_OPTIONS, lineStats, processLines, type LineOptions } from './lines'

const opts = (overrides: Partial<LineOptions> = {}): LineOptions => ({ ...DEFAULT_OPTIONS, ...overrides })

describe('processLines', () => {
  it('trims and drops empty lines by default', () => {
    expect(processLines('  a  \n\n b \n', opts())).toBe('a\nb')
  })

  it('keeps empty lines when asked', () => {
    expect(processLines('a\n\nb', opts({ dropEmpty: false }))).toBe('a\n\nb')
  })

  it('sorts ascending and descending', () => {
    expect(processLines('b\na\nc', opts({ sort: 'asc' }))).toBe('a\nb\nc')
    expect(processLines('b\na\nc', opts({ sort: 'desc' }))).toBe('c\nb\na')
  })

  it('sorts case-insensitively when configured', () => {
    expect(processLines('Beta\nalpha', opts({ sort: 'asc', caseSensitive: false }))).toBe('alpha\nBeta')
    expect(processLines('Beta\nalpha', opts({ sort: 'asc', caseSensitive: true }))).toBe('Beta\nalpha')
  })

  it('sorts numerically in natural mode', () => {
    expect(processLines('item10\nitem2', opts({ sort: 'asc', natural: true }))).toBe('item2\nitem10')
    expect(processLines('item10\nitem2', opts({ sort: 'asc' }))).toBe('item10\nitem2')
  })

  it('sorts by line length', () => {
    expect(processLines('ccc\na\nbb', opts({ sort: 'length' }))).toBe('a\nbb\nccc')
  })

  it('deduplicates keeping the first occurrence', () => {
    expect(processLines('a\nb\na', opts({ dedupe: true }))).toBe('a\nb')
  })

  it('deduplicates case-insensitively when configured', () => {
    expect(processLines('A\na', opts({ dedupe: true, dedupeCaseSensitive: false }))).toBe('A')
    expect(processLines('A\na', opts({ dedupe: true, dedupeCaseSensitive: true }))).toBe('A\na')
  })

  it('reverses the output', () => {
    expect(processLines('a\nb\nc', opts({ reverse: true }))).toBe('c\nb\na')
  })

  it('shuffles deterministically with an injected rng', () => {
    const rng = () => 0.5
    const result = processLines('a\nb\nc\nd', opts({ shuffle: true }), rng)
    expect(result.split('\n').sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('numbers lines in each style', () => {
    expect(processLines('a\nb', opts({ numbering: 'plain' }))).toBe('1 a\n2 b')
    expect(processLines('a\nb', opts({ numbering: 'dot' }))).toBe('1. a\n2. b')
    expect(processLines('a\nb', opts({ numbering: 'paren' }))).toBe('1) a\n2) b')
  })

  it('handles windows line endings', () => {
    expect(processLines('a\r\nb', opts())).toBe('a\nb')
  })
})

describe('lineStats', () => {
  it('counts lines, unique lines, words and bytes', () => {
    const stats = lineStats('a b\nc\n\nc')
    expect(stats.lines).toBe(3)
    expect(stats.unique).toBe(2)
    expect(stats.words).toBe(4)
    expect(stats.bytes).toBe(8)
  })
})
