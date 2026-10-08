import { describe, expect, it } from 'vitest'
import { parseIni, toIni } from './ini'

describe('parseIni', () => {
  it('parses sections and keys', () => {
    const { data } = parseIni('[server]\nhost = localhost\nport = 8080\n')
    expect(data).toEqual({ server: { host: 'localhost', port: '8080' } })
  })

  it('keeps top-level keys in the empty section', () => {
    const { data } = parseIni('name = app\n[db]\nurl = x\n')
    expect(data['']).toEqual({ name: 'app' })
    expect(data.db).toEqual({ url: 'x' })
  })

  it('ignores comments and blank lines', () => {
    const { data } = parseIni('; note\n# another\n\n[a]\nk = v\n')
    expect(data).toEqual({ a: { k: 'v' } })
  })

  it('strips matching quotes from values', () => {
    const { data } = parseIni('[a]\nquoted = "hello world"\nsingle = \'x\'\n')
    expect(data.a.quoted).toBe('hello world')
    expect(data.a.single).toBe('x')
  })

  it('keeps hashes inside values', () => {
    const { data } = parseIni('[a]\ncolor = #fff\n')
    expect(data.a.color).toBe('#fff')
  })

  it('warns about duplicate sections and keys', () => {
    const { data, warnings } = parseIni('[a]\nk = 1\n[a]\nk = 2\n')
    expect(data.a.k).toBe('2')
    expect(warnings).toHaveLength(2)
  })

  it('warns about malformed lines', () => {
    const { warnings } = parseIni('just some text\n')
    expect(warnings[0]).toContain('no "="')
  })

  it('drops an empty top-level bucket', () => {
    const { data } = parseIni('[a]\nk = v\n')
    expect('' in data).toBe(false)
  })
})

describe('toIni', () => {
  it('writes sections after top-level keys', () => {
    const text = toIni({ name: 'app', server: { host: 'localhost', port: 8080 } })
    expect(text).toBe('name = app\n\n[server]\nhost = localhost\nport = 8080\n')
  })

  it('quotes only values that would otherwise be ambiguous', () => {
    expect(toIni({ a: { k: 'hello world' } })).toContain('k = hello world')
    expect(toIni({ a: { k: ' leading' } })).toContain('k = " leading"')
    expect(toIni({ a: { k: 'a#b' } })).toContain('k = "a#b"')
    expect(toIni({ a: { k: 'plain' } })).toContain('k = plain')
  })

  it('stores deeper nesting as JSON', () => {
    expect(toIni({ a: { nested: { x: 1 } } })).toContain('nested = {"x":1}')
  })

  it('renders booleans and numbers without quotes', () => {
    expect(toIni({ a: { on: true, n: 3 } })).toBe('[a]\non = true\nn = 3\n')
  })

  it('returns an empty string for no data', () => {
    expect(toIni({})).toBe('')
  })
})

describe('round trip', () => {
  it('preserves a simple document', () => {
    const source = 'title = demo\n\n[server]\nhost = localhost\nport = 8080\n'
    const { data } = parseIni(source)
    expect(toIni(data as Record<string, unknown>)).toBe(source)
  })
})
