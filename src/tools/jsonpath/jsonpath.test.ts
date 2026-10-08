import { describe, expect, it } from 'vitest'
import { JsonPathError, query, type JsonValue } from './jsonpath'

const DOC: JsonValue = {
  store: {
    book: [
      { title: 'Refactoring', price: 30, tags: ['code', 'craft'] },
      { title: 'Clean Code', price: 20, tags: ['code'] },
      { title: 'The Art', price: 45, tags: [] },
    ],
    bicycle: { color: 'red', price: 120 },
  },
  cheap: true,
}

describe('query', () => {
  it('reads a root property', () => {
    expect(query(DOC, '$.cheap').map((m) => m.value)).toEqual([true])
  })

  it('reads nested properties with dot and bracket forms', () => {
    expect(query(DOC, '$.store.bicycle.color')[0].value).toBe('red')
    expect(query(DOC, "$.store['bicycle'].color")[0].value).toBe('red')
  })

  it('reads an array index, including negative', () => {
    expect(query(DOC, '$.store.book[0].title')[0].value).toBe('Refactoring')
    expect(query(DOC, '$.store.book[-1].title')[0].value).toBe('The Art')
  })

  it('reports paths for every match', () => {
    expect(query(DOC, '$.store.book[1].title')[0].path).toBe('$.store.book[1].title')
  })

  it('expands a wildcard over arrays and objects', () => {
    expect(query(DOC, '$.store.book[*].price').map((m) => m.value)).toEqual([30, 20, 45])
    expect(query(DOC, '$.store.bicycle.*').map((m) => m.value)).toEqual(['red', 120])
  })

  it('takes slices', () => {
    expect(query(DOC, '$.store.book[0:2].title').map((m) => m.value)).toEqual(['Refactoring', 'Clean Code'])
    expect(query(DOC, '$.store.book[::2].title').map((m) => m.value)).toEqual(['Refactoring', 'The Art'])
    expect(query(DOC, '$.store.book[1:].title').map((m) => m.value)).toEqual(['Clean Code', 'The Art'])
  })

  it('walks recursively', () => {
    expect(query(DOC, '$..price').map((m) => m.value)).toEqual([30, 20, 45, 120])
    expect(query(DOC, '$..tags[0]').map((m) => m.value)).toEqual(['code', 'code'])
  })

  it('filters numbers', () => {
    expect(query(DOC, '$.store.book[?(@.price < 30)].title').map((m) => m.value)).toEqual(['Clean Code'])
    expect(query(DOC, '$.store.book[?(@.price >= 30)].title').map((m) => m.value)).toEqual(['Refactoring', 'The Art'])
  })

  it('filters strings', () => {
    expect(query(DOC, '$.store.book[?(@.title == "Clean Code")].price').map((m) => m.value)).toEqual([20])
  })

  it('filters on existence, so an empty array still matches', () => {
    expect(query(DOC, '$.store.book[?(@.tags)].title').map((m) => m.value)).toEqual(['Refactoring', 'Clean Code', 'The Art'])
    expect(query(DOC, '$.store.book[?(@.missing)]').map((m) => m.value)).toEqual([])
  })

  it('filters with a regex', () => {
    expect(query(DOC, '$.store.book[?(@.title =~ "^Clean")].title').map((m) => m.value)).toEqual(['Clean Code'])
  })

  it('returns nothing for a missing path', () => {
    expect(query(DOC, '$.store.nope')).toEqual([])
    expect(query(DOC, '$.store.book[99]')).toEqual([])
  })

  it('returns the document itself for "$"', () => {
    expect(query(DOC, '$')).toEqual([{ path: '$', value: DOC }])
  })

  it('rejects malformed paths', () => {
    expect(() => query(DOC, 'store.book')).toThrow(JsonPathError)
    expect(() => query(DOC, '$.store[')).toThrow(JsonPathError)
    expect(() => query(DOC, '$.store.book[?(@.x & 1)]')).toThrow(JsonPathError)
    expect(() => query(DOC, '$.store.book[0:2:0]')).toThrow(JsonPathError)
  })

  it('does not evaluate code in a filter', () => {
    expect(() => query(DOC, '$.store.book[?(@.price > process.exit(1))]')).toThrow(JsonPathError)
  })
})
