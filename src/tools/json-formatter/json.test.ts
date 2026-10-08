import { describe, expect, it } from 'vitest'
import { formatJson, jsonStats, locate, sortJsonValue, validateJson } from './json'

describe('validateJson', () => {
  it('accepts valid JSON', () => {
    expect(validateJson('{"a":1}')).toBeNull()
    expect(validateJson('[1,2,3]')).toBeNull()
    expect(validateJson('"text"')).toBeNull()
    expect(validateJson('42')).toBeNull()
  })

  it('flags empty input', () => {
    const issue = validateJson('   ')
    expect(issue?.message).toMatch(/empty/i)
  })

  it('reports a line and column for a syntax error', () => {
    const issue = validateJson('{\n  "a": 1,\n  "b": 2,\n}')
    expect(issue).not.toBeNull()
    expect(issue!.line).toBeGreaterThan(1)
  })

  it('reports a message without leaking engine wording', () => {
    const issue = validateJson('{bad}')
    expect(issue!.message).not.toMatch(/in JSON at position/i)
  })
})

describe('locate', () => {
  it('converts an offset to line and column', () => {
    expect(locate('abc', 0)).toEqual({ line: 1, column: 1 })
    expect(locate('a\nb', 2)).toEqual({ line: 2, column: 1 })
    expect(locate('a\nbc', 3)).toEqual({ line: 2, column: 2 })
  })
})

describe('sortJsonValue', () => {
  it('sorts keys recursively but keeps array order', () => {
    expect(sortJsonValue({ b: 1, a: { d: 1, c: 2 } })).toEqual({ a: { c: 2, d: 1 }, b: 1 })
    expect(sortJsonValue([3, 1, 2])).toEqual([3, 1, 2])
  })

  it('leaves primitives alone', () => {
    expect(sortJsonValue(5)).toBe(5)
    expect(sortJsonValue(null)).toBeNull()
  })
})

describe('formatJson', () => {
  it('honours the indent', () => {
    expect(formatJson({ a: 1 }, 2)).toBe('{\n  "a": 1\n}')
    expect(formatJson({ a: 1 }, 0)).toBe('{"a":1}')
  })
})

describe('jsonStats', () => {
  it('counts nodes, depth and bytes', () => {
    const stats = jsonStats({ a: [1, 2] }, '{"a":[1,2]}')
    expect(stats.nodes).toBe(4)
    expect(stats.depth).toBe(3)
    expect(stats.bytes).toBe(11)
  })
})
