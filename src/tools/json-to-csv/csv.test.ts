import { describe, expect, it } from 'vitest'
import { csvToJson, jsonToCsv, parseCsv } from './csv'

describe('jsonToCsv', () => {
  it('converts an array of objects', () => {
    const result = jsonToCsv([{ a: 1, b: 'x' }, { a: 2, b: 'y' }])
    expect(result.csv).toBe('a,b\n1,x\n2,y')
    expect(result.columns).toEqual(['a', 'b'])
    expect(result.rowCount).toBe(2)
  })

  it('unions columns across rows, filling gaps', () => {
    const result = jsonToCsv([{ a: 1 }, { b: 2 }])
    expect(result.csv).toBe('a,b\n1,\n,2')
  })

  it('flattens nested objects to dotted names', () => {
    const result = jsonToCsv([{ user: { name: 'Ada', city: 'London' } }])
    expect(result.columns).toEqual(['user.name', 'user.city'])
    expect(result.csv).toBe('user.name,user.city\nAda,London')
  })

  it('joins arrays with a semicolon', () => {
    const result = jsonToCsv([{ tags: ['a', 'b'] }])
    expect(result.csv).toBe('tags\na; b')
  })

  it('quotes fields containing the delimiter, quotes or newlines', () => {
    const result = jsonToCsv([{ a: 'x,y', b: 'he said "hi"', c: 'line1\nline2' }])
    expect(result.csv).toContain('"x,y"')
    expect(result.csv).toContain('"he said ""hi"""')
    expect(result.csv).toContain('"line1\nline2"')
  })

  it('quotes everything when asked', () => {
    expect(jsonToCsv([{ a: 'x' }], { quoteAll: true }).csv).toBe('"a"\n"x"')
  })

  it('supports a custom delimiter', () => {
    expect(jsonToCsv([{ a: 1, b: 2 }], { delimiter: ';' }).csv).toBe('a;b\n1;2')
  })

  it('renders null and missing values as empty', () => {
    expect(jsonToCsv([{ a: null, b: undefined as never }]).csv).toBe('a,b\n,')
  })

  it('wraps a single object in one row', () => {
    expect(jsonToCsv({ a: 1 }).csv).toBe('a\n1')
  })
})

describe('parseCsv', () => {
  it('splits simple rows', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('handles quoted fields with delimiters and newlines', () => {
    expect(parseCsv('a,b\n"x,y","line1\nline2"')).toEqual([['a', 'b'], ['x,y', 'line1\nline2']])
  })

  it('unescapes doubled quotes', () => {
    expect(parseCsv('a\n"he said ""hi"""')).toEqual([['a'], ['he said "hi"']])
  })

  it('ignores CR in CRLF input', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('returns nothing for empty input', () => {
    expect(parseCsv('')).toEqual([])
  })
})

describe('csvToJson', () => {
  it('uses the header row as keys', () => {
    expect(csvToJson('a,b\n1,x')).toEqual([{ a: 1, b: 'x' }])
  })

  it('coerces numbers, booleans and null', () => {
    expect(csvToJson('n,f,b,z\n42,3.5,true,null')).toEqual([{ n: 42, f: 3.5, b: true, z: null }])
  })

  it('keeps strings that only look numeric', () => {
    expect(csvToJson('v\n007x')).toEqual([{ v: '007x' }])
  })

  it('skips fully empty rows', () => {
    expect(csvToJson('a\n1\n\n2')).toEqual([{ a: 1 }, { a: 2 }])
  })

  it('fills missing trailing columns with an empty string', () => {
    expect(csvToJson('a,b\n1')).toEqual([{ a: 1, b: '' }])
  })
})

describe('round trip', () => {
  it('survives csv -> json -> csv for flat data', () => {
    const csv = 'name,score\nAda,10\nGrace,20'
    const json = csvToJson(csv)
    expect(jsonToCsv(json).csv).toBe(csv)
  })
})
