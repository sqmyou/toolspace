import { describe, expect, it } from 'vitest'
import { clean, inspect } from './whitespace'

describe('clean', () => {
  it('trims lines and the document by default', () => {
    expect(clean('  hello  \n  world  ').text).toBe('hello\nworld')
  })

  it('normalises CRLF to LF', () => {
    expect(clean('a\r\nb\r\n').text).toBe('a\nb')
    expect(clean('a\r\nb', { normalizeNewlines: false }).text).toBe('a\r\nb')
  })

  it('expands tabs at the requested width', () => {
    expect(clean('a\tb', { tabsToSpaces: true, tabWidth: 2 }).text).toBe('a  b')
    expect(clean('a\tb', { tabsToSpaces: true, tabWidth: 8 }).text).toBe('a        b')
  })

  it('collapses runs of spaces inside a line', () => {
    expect(clean('a    b', { collapseSpaces: true }).text).toBe('a b')
    expect(clean('a    b', { collapseSpaces: false }).text).toBe('a    b')
  })

  it('removes empty lines', () => {
    expect(clean('a\n\n\nb', { removeEmptyLines: true }).text).toBe('a\nb')
  })

  it('caps consecutive blank lines', () => {
    expect(clean('a\n\n\n\nb', { maxBlankLines: 1 }).text).toBe('a\n\nb')
    expect(clean('a\n\n\n\nb', { maxBlankLines: 0 }).text).toBe('a\nb')
    expect(clean('a\n\n\n\nb', { maxBlankLines: 2 }).text).toBe('a\n\n\nb')
  })

  it('joins lines into one paragraph', () => {
    expect(clean('one\ntwo\nthree', { joinLines: true }).text).toBe('one two three')
  })

  it('reports the change in size', () => {
    const result = clean('  a  \n  b  ')
    expect(result.linesBefore).toBe(2)
    expect(result.linesAfter).toBe(2)
    expect(result.charactersRemoved).toBe(8)
  })

  it('handles empty input', () => {
    expect(clean('')).toEqual({ text: '', linesBefore: 0, linesAfter: 0, charactersRemoved: 0 })
  })

  it('applies rules in a stable order', () => {
    const result = clean('  a\t\tb  \n\n\n  c  ', { tabsToSpaces: true, collapseSpaces: true })
    expect(result.text).toBe('a b\n\nc')
  })
})

describe('inspect', () => {
  it('counts whitespace problems', () => {
    const issues = inspect('a  \n\tb\n\n\nc   d\r\n')
    expect(issues.trailingWhitespace).toBe(1)
    expect(issues.leadingWhitespace).toBe(1)
    expect(issues.tabs).toBe(1)
    expect(issues.crlf).toBe(1)
    expect(issues.multipleSpaces).toBe(2)
    expect(issues.blankLines).toBe(3)
  })

  it('reports zero for clean text', () => {
    expect(inspect('a\nb')).toEqual({
      trailingWhitespace: 0,
      leadingWhitespace: 0,
      tabs: 0,
      crlf: 0,
      multipleSpaces: 0,
      blankLines: 0,
    })
  })
})
