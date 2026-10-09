import { describe, expect, it } from 'vitest'
import { parseToml, TomlError, toToml } from './toml'

describe('parseToml', () => {
  it('reads keys, strings, numbers and booleans', () => {
    const data = parseToml('title = "demo"\ncount = 42\nratio = 1.5\non = true\n')
    expect(data).toEqual({ title: 'demo', count: 42, ratio: 1.5, on: true })
  })

  it('reads tables and dotted keys', () => {
    const data = parseToml('[server]\nhost = "localhost"\nport = 8080\n\n[a.b]\nx = 1\n')
    expect(data).toEqual({ server: { host: 'localhost', port: 8080 }, a: { b: { x: 1 } } })
  })

  it('reads arrays, including multiline and nested values', () => {
    const data = parseToml('ports = [ 8001, 8002, 8003 ]\nnames = ["a", "b"]\nmatrix = [[1, 2], [3, 4]]\n')
    expect(data).toEqual({ ports: [8001, 8002, 8003], names: ['a', 'b'], matrix: [[1, 2], [3, 4]] })
  })

  it('reads inline tables', () => {
    expect(parseToml('point = { x = 1, y = 2, name = "p" }\n')).toEqual({
      point: { x: 1, y: 2, name: 'p' },
    })
  })

  it('reads arrays of tables, with nested sub-tables', () => {
    const toml = [
      '[[products]]',
      'name = "Hammer"',
      '',
      '[[products]]',
      'name = "Nail"',
      '[products.details]',
      'size = 3',
    ].join('\n')
    expect(parseToml(toml)).toEqual({
      products: [{ name: 'Hammer' }, { name: 'Nail', details: { size: 3 } }],
    })
  })

  it('honours literal strings, escapes and quoted keys', () => {
    const data = parseToml('lit = \'C:\\path\'\nesc = "line\\nbreak"\n"a.b" = 1\n')
    expect(data.lit).toBe('C:\\path')
    expect(data.esc).toBe('line\nbreak')
    expect(data['a.b']).toBe(1)
  })

  it('keeps a # inside a value, stripping only real comments', () => {
    expect(parseToml('colour = "#fff" # the hash\nx = 1 # trailing\n')).toEqual({
      colour: '#fff',
      x: 1,
    })
  })

  it('reads hex, octal, binary and separators', () => {
    expect(parseToml('a = 0x1f\nb = 0o17\nc = 0b101\nd = 1_000_000\n')).toEqual({
      a: 31,
      b: 15,
      c: 5,
      d: 1000000,
    })
  })

  it('keeps datetimes as text so they survive a JSON round-trip', () => {
    const data = parseToml('when = 1979-05-27T07:32:00Z\nday = 1979-05-27\n')
    expect(data.when).toBe('1979-05-27T07:32:00Z')
    expect(data.day).toBe('1979-05-27')
  })

  it('reports specific errors', () => {
    expect(() => parseToml('= 1')).toThrow(TomlError)
    expect(() => parseToml('a = ')).toThrow(TomlError)
    expect(() => parseToml('a = "unterminated')).toThrow(TomlError)
    expect(() => parseToml('a = 1\na = 2')).toThrow(/more than once/)
    expect(() => parseToml('a = """x"""')).toThrow(/multi-line/)
  })
})

describe('toToml', () => {
  it('serialises scalars, nested tables and arrays of tables', () => {
    const toml = toToml({
      title: 'demo',
      server: { host: 'localhost', port: 8080 },
      products: [
        { name: 'Hammer' },
        { name: 'Nail' },
      ],
    })
    expect(toml).toContain('title = "demo"')
    expect(toml).toContain('[server]')
    expect(toml).toContain('port = 8080')
    expect(toml).toContain('[[products]]')
    expect((toml.match(/\[\[products\]\]/g) ?? []).length).toBe(2)
  })

  it('quotes keys that are not bare and escapes strings', () => {
    const toml = toToml({ 'a.b': 'x', note: 'line\nbreak' })
    expect(toml).toContain('"a.b" = "x"')
    expect(toml).toContain('"line\\nbreak"')
  })

  it('round-trips a document', () => {
    const source = 'title = "demo"\n\n[server]\nhost = "localhost"\nport = 8080\n'
    const data = parseToml(source)
    expect(parseToml(toToml(data))).toEqual(data)
  })

  it('rejects a non-object root and nulls', () => {
    expect(() => toToml([1, 2])).toThrow(TomlError)
    expect(() => toToml({ a: null })).toThrow(/null/)
  })
})
