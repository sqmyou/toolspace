import { describe, expect, it } from 'vitest'
import { csvToJson, detectDelimiter, jsonToCsv, parseCsv } from './csv'

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
