import { describe, expect, it } from 'vitest'
import {
  detectDelimiter,
  fromMarkdownTable,
  parseCsv,
  TableError,
  toCsv,
  toMarkdownTable,
} from './table'

describe('parseCsv', () => {
  it('reads plain rows', () => {
    expect(parseCsv('a,b\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('honours quoted fields with delimiters, newlines and doubled quotes', () => {
    const rows = parseCsv('name,note\n"Smith, John","line one\nline two"\n"say ""hi""",x\n')
    expect(rows).toEqual([
      ['name', 'note'],
      ['Smith, John', 'line one\nline two'],
      ['say "hi"', 'x'],
    ])
  })

  it('handles CRLF and a missing final newline', () => {
    expect(parseCsv('a,b\r\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('keeps empty trailing fields', () => {
    expect(parseCsv('a,,b\n')).toEqual([['a', '', 'b']])
  })

  it('accepts other delimiters', () => {
    expect(parseCsv('a\tb\n1\t2\n', '\t')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
})

describe('toCsv', () => {
  it('quotes only the fields that need it', () => {
    expect(toCsv([['a', 'b,c', 'say "hi"', 'line\nbreak']])).toBe('a,"b,c","say ""hi""","line\nbreak"')
  })

  it('round-trips a table with awkward cells', () => {
    const rows = [
      ['name', 'note'],
      ['Smith, John', 'multi\nline'],
      ['quote"d', 'pipe|inside'],
    ]
    expect(parseCsv(toCsv(rows))).toEqual(rows)
  })
})

describe('detectDelimiter', () => {
  it('picks the delimiter with the most occurrences', () => {
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',')
    expect(detectDelimiter('a\tb\tc')).toBe('\t')
    expect(detectDelimiter('a;b;c')).toBe(';')
  })

  it('ignores delimiters inside quotes', () => {
    expect(detectDelimiter('"a;b";c;d')).toBe(';')
  })
})

describe('toMarkdownTable', () => {
  it('emits a padded header, separator and rows', () => {
    const out = toMarkdownTable([
      ['a', 'b'],
      ['1', '2'],
    ])
    expect(out).toBe(['| a   | b   |', '| --- | --- |', '| 1   | 2   |'].join('\n'))
  })

  it('renders alignment', () => {
    const out = toMarkdownTable([['a', 'b', 'c'], ['1', '2', '3']], ['left', 'center', 'right'])
    expect(out.split('\n')[1]).toBe('| :-- | :-: | --: |')
  })

  it('escapes pipes and turns newlines into breaks', () => {
    const out = toMarkdownTable([['a|b', 'x']])
    expect(out).toContain('a\\|b')
    const multiline = toMarkdownTable([['h'], ['one\ntwo']])
    expect(multiline).toContain('one<br>two')
  })

  it('pads short rows to the widest one', () => {
    const out = toMarkdownTable([['a', 'b', 'c'], ['1']])
    expect(out.split('\n')[2]).toBe('| 1   |     |     |')
  })

  it('returns an empty string for no rows', () => {
    expect(toMarkdownTable([])).toBe('')
  })
})

describe('fromMarkdownTable', () => {
  it('reads a table back', () => {
    const markdown = ['| a   | b   |', '| --- | --- |', '| 1   | 2   |'].join('\n')
    expect(fromMarkdownTable(markdown)).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('reads alignment separators and inline pipes', () => {
    const markdown = ['| a | b |', '| :-- | --: |', '| x\\|y | z |'].join('\n')
    expect(fromMarkdownTable(markdown)).toEqual([
      ['a', 'b'],
      ['x|y', 'z'],
    ])
  })

  it('tolerates a table without outer pipes', () => {
    expect(fromMarkdownTable('a | b\n--- | ---\n1 | 2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('rejects input with no table', () => {
    expect(() => fromMarkdownTable('just prose')).toThrow(TableError)
  })

  it('round-trips CSV through Markdown', () => {
    const rows = [
      ['name', 'value'],
      ['a', '1'],
      ['pipe|name', 'multi\nline'],
    ]
    expect(fromMarkdownTable(toMarkdownTable(rows))).toEqual(rows)
  })
})
