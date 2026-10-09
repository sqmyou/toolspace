import { describe, expect, it } from 'vitest'
import {
  csvToJson,
  csvToMarkdown,
  detectDelimiter,
  fromMarkdownTable,
  jsonToCsv,
  markdownToCsv,
  parseCsv,
  TableError,
  toCsv,
  toMarkdownTable,
} from './csv'

describe('parseCsv', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('honours quotes, escaped quotes and embedded newlines', () => {
    const rows = parseCsv('name,note\n"Ada, Inc.","say ""hi""\nnow"')
    expect(rows[1]).toEqual(['Ada, Inc.', 'say "hi"\nnow'])
  })

  it('ignores a trailing newline', () => {
    expect(parseCsv('a,b\n1,2\n')).toHaveLength(2)
  })

  it('supports other delimiters', () => {
    expect(parseCsv('a;b\n1;2', ';')).toEqual([['a', 'b'], ['1', '2']])
  })
})

describe('detectDelimiter', () => {
  it('sniffs comma, semicolon, tab and pipe', () => {
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',')
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';')
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t')
    expect(detectDelimiter('a|b|c\n1|2|3')).toBe('|')
  })
})

describe('csvToJson', () => {
  it('maps header columns to keys', () => {
    expect(csvToJson('id,name\n1,Ada', { delimiter: ',' })).toEqual([{ id: '1', name: 'Ada' }])
  })

  it('names blank headers and fills missing cells', () => {
    expect(csvToJson('a,,c\n1,2', { delimiter: ',' })).toEqual([{ a: '1', column_2: '2', c: '' }])
  })

  it('can skip the header', () => {
    expect(csvToJson('1,2\n3,4', { hasHeader: false, delimiter: ',' })).toEqual([['1', '2'], ['3', '4']])
  })
})

describe('jsonToCsv', () => {
  it('unions keys across objects', () => {
    const { csv } = jsonToCsv('[{"a":1,"b":2},{"a":3,"c":4}]')
    expect(csv.split('\n')[0]).toBe('a,b,c')
    expect(csv.split('\n')[1]).toBe('1,2,')
    expect(csv.split('\n')[2]).toBe('3,,4')
  })

  it('quotes values containing the delimiter or quotes', () => {
    const { csv } = jsonToCsv('[{"name":"Ada, Inc."}]')
    expect(csv).toContain('"Ada, Inc."')
  })

  it('stringifies nested values', () => {
    const { csv } = jsonToCsv('[{"tags":["a","b"]}]')
    expect(csv).toContain('"[""a"",""b""]"')
  })

  it('handles primitives and objects', () => {
    expect(jsonToCsv('[1,2,3]').csv).toBe('1\n2\n3')
    expect(jsonToCsv('{"a":1}').csv).toBe('key,value\na,1')
  })

  it('reports invalid JSON', () => {
    expect(jsonToCsv('nope').error).toBeTruthy()
    expect(jsonToCsv('"just a string"').error).toBeTruthy()
  })
})

describe('csvToMarkdown', () => {
  it('renders a padded header, separator and body rows', () => {
    expect(csvToMarkdown('a,b\n1,2\n3,4')).toBe('| a   | b   |\n| --- | --- |\n| 1   | 2   |\n| 3   | 4   |')
  })

  it('escapes pipes and newlines inside cells', () => {
    expect(csvToMarkdown('h\n"a|b"')).toContain('a\\|b')
    expect(csvToMarkdown('h\n"line1\nline2"')).toContain('line1<br>line2')
  })

  it('generates placeholder headers when asked and pads short rows', () => {
    const table = csvToMarkdown('1,2,3\n4', { delimiter: ',', hasHeader: false })
    expect(table.split('\n')[0]).toBe('| Column 1 | Column 2 | Column 3 |')
    expect(table.split('\n')[3]).toBe('| 4        |          |          |')
  })

  it('renders column alignment', () => {
    const table = csvToMarkdown('a,b,c\n1,2,3', { alignments: ['left', 'center', 'right'] })
    expect(table.split('\n')[1]).toBe('| :-- | :-: | --: |')
  })

  it('sniffs the delimiter', () => {
    expect(csvToMarkdown('a;b\n1;2').split('\n')[1]).toBe('| --- | --- |')
  })

  it('returns an empty string for empty input', () => {
    expect(csvToMarkdown('')).toBe('')
  })
})

describe('toMarkdownTable', () => {
  it('pads each column to its widest cell', () => {
    expect(toMarkdownTable([['a', 'b'], ['1', '2']])).toBe('| a   | b   |\n| --- | --- |\n| 1   | 2   |')
  })

  it('pads short rows to the widest one', () => {
    expect(toMarkdownTable([['a', 'b', 'c'], ['1']]).split('\n')[2]).toBe('| 1   |     |     |')
  })

  it('returns an empty string for no rows', () => {
    expect(toMarkdownTable([])).toBe('')
  })
})

describe('fromMarkdownTable', () => {
  it('reads a table back', () => {
    const markdown = ['| a   | b   |', '| --- | --- |', '| 1   | 2   |'].join('\n')
    expect(fromMarkdownTable(markdown)).toEqual([['a', 'b'], ['1', '2']])
  })

  it('reads alignment separators and inline pipes', () => {
    expect(fromMarkdownTable('| a | b |\n| :-- | --: |\n| x\\|y | z |')).toEqual([['a', 'b'], ['x|y', 'z']])
  })

  it('tolerates a table without outer pipes', () => {
    expect(fromMarkdownTable('a | b\n--- | ---\n1 | 2')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('rejects input with no table', () => {
    expect(() => fromMarkdownTable('just prose')).toThrow(TableError)
  })

  it('round-trips awkward cells', () => {
    const rows = [['name', 'value'], ['a', '1'], ['pipe|name', 'multi\nline']]
    expect(fromMarkdownTable(toMarkdownTable(rows))).toEqual(rows)
  })
})

describe('toCsv', () => {
  it('quotes only the fields that need it', () => {
    expect(toCsv([['a', 'b,c', 'say "hi"', 'line\nbreak']])).toBe('a,"b,c","say ""hi""","line\nbreak"')
  })

  it('round-trips through parseCsv', () => {
    const rows = [['name', 'note'], ['Smith, John', 'multi\nline'], ['quote"d', 'pipe|inside']]
    expect(parseCsv(toCsv(rows))).toEqual(rows)
  })
})

describe('markdownToCsv', () => {
  it('drops the separator row and reverses the escaping', () => {
    const { csv } = markdownToCsv('| a | b |\n| --- | --- |\n| 1 | a\\|b |\n| x<br>y | 2 |')
    expect(csv.split('\n')[0]).toBe('a,b')
    expect(csv).toContain('a|b')
    expect(csv).toContain('"x\ny"')
  })

  it('round-trips csv -> markdown -> csv', () => {
    const table = [
      '| a | b |',
      '| --- | --- |',
      '| 1 | 2 |',
      '| 3 | 4 |',
    ].join('\n')
    const { csv } = markdownToCsv(csvToMarkdown('a,b\n1,2\n3,4'))
    expect(csv).toBe('a,b\n1,2\n3,4')
    expect(markdownToCsv(table).csv).toBe('a,b\n1,2\n3,4')
  })

  it('reports when there is no table', () => {
    expect(markdownToCsv('just prose').error).toBeTruthy()
  })
})
