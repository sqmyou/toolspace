import { describe, expect, it } from 'vitest'
import { diffJson, renderValue, summarize } from './diff'

describe('diffJson', () => {
  it('reports nothing for equal values', () => {
    expect(diffJson({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] })).toEqual([])
  })

  it('ignores object key order', () => {
    expect(diffJson({ a: 1, b: 2 }, { b: 2, a: 1 })).toEqual([])
  })

  it('detects a changed scalar with a path', () => {
    expect(diffJson({ a: { b: 1 } }, { a: { b: 2 } })).toEqual([
      { path: 'a.b', kind: 'changed', before: 1, after: 2 },
    ])
  })

  it('detects added and removed keys', () => {
    const changes = diffJson({ a: 1, b: 2 }, { a: 1, c: 3 })
    expect(changes).toContainEqual({ path: 'b', kind: 'removed', before: 2 })
    expect(changes).toContainEqual({ path: 'c', kind: 'added', after: 3 })
  })

  it('reports a type change at the parent and stops descending', () => {
    expect(diffJson({ a: 'x' }, { a: { b: 1 } })).toEqual([
      { path: 'a', kind: 'type', before: 'x', after: { b: 1 } },
    ])
  })

  it('compares arrays positionally', () => {
    expect(diffJson([1, 2, 3], [1, 9])).toEqual([
      { path: '[1]', kind: 'changed', before: 2, after: 9 },
      { path: '[2]', kind: 'removed', before: 3 },
    ])
  })

  it('detects appended array items', () => {
    expect(diffJson([1], [1, 2])).toEqual([{ path: '[1]', kind: 'added', after: 2 }])
  })

  it('labels a root type change', () => {
    expect(diffJson(1, '1')[0].path).toBe('(root)')
  })
})

describe('summarize', () => {
  it('counts each kind of change', () => {
    const summary = summarize([
      { path: 'a', kind: 'added' },
      { path: 'b', kind: 'removed' },
      { path: 'c', kind: 'changed' },
      { path: 'd', kind: 'type' },
    ])
    expect(summary).toEqual({ added: 1, removed: 1, changed: 1, type: 1 })
  })
})

describe('renderValue', () => {
  it('renders values compactly', () => {
    expect(renderValue({ a: 1 })).toBe('{"a":1}')
    expect(renderValue('hi')).toBe('"hi"')
    expect(renderValue(undefined)).toBe('undefined')
  })
})
