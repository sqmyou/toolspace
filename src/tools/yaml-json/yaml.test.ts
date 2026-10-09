import { describe, expect, it } from 'vitest'
import { parseYaml, toYaml, YamlError } from './yaml'

describe('parseYaml', () => {
  it('reads mappings, sequences and nested blocks', () => {
    const yaml = ['name: demo', 'enabled: true', 'ports:', '  - 80', '  - 443', 'server:', '  host: localhost'].join('\n')
    expect(parseYaml(yaml)).toEqual({
      name: 'demo',
      enabled: true,
      ports: [80, 443],
      server: { host: 'localhost' },
    })
  })

  it('reads a sequence of mappings from dash lines', () => {
    const yaml = ['jobs:', '  - name: build', '    runs-on: ubuntu', '  - name: test', '    runs-on: ubuntu'].join('\n')
    expect(parseYaml(yaml)).toEqual({
      jobs: [
        { name: 'build', 'runs-on': 'ubuntu' },
        { name: 'test', 'runs-on': 'ubuntu' },
      ],
    })
  })

  it('resolves core-schema scalars and leaves on/yes as strings', () => {
    const yaml = ['a: null', 'b: ~', 'c: false', 'd: 42', 'e: 1.5', 'f: 0x1f', 'g: on', 'h: yes', 'i: "true"'].join('\n')
    expect(parseYaml(yaml)).toEqual({
      a: null,
      b: null,
      c: false,
      d: 42,
      e: 1.5,
      f: 31,
      g: 'on',
      h: 'yes',
      i: 'true',
    })
  })

  it('reads flow collections and quoted scalars', () => {
    const yaml = ['list: [1, 2, 3]', 'map: {x: 1, y: "two"}', "quoted: 'it''s here'"].join('\n')
    expect(parseYaml(yaml)).toEqual({
      list: [1, 2, 3],
      map: { x: 1, y: 'two' },
      quoted: "it's here",
    })
  })

  it('reads literal and folded block scalars', () => {
    const yaml = ['literal: |', '  line one', '  line two', 'folded: >', '  part one', '  part two'].join('\n')
    expect(parseYaml(yaml)).toEqual({
      literal: 'line one\nline two\n',
      folded: 'part one part two\n',
    })
  })

  it('ignores comments and blank lines', () => {
    const yaml = ['# leading comment', 'key: value # trailing', '', 'other: 1'].join('\n')
    expect(parseYaml(yaml)).toEqual({ key: 'value', other: 1 })
  })

  it('treats a bare key with no value as null', () => {
    expect(parseYaml('empty:\nother: 1')).toEqual({ empty: null, other: 1 })
  })

  it('handles an empty document', () => {
    expect(parseYaml('')).toBeNull()
    expect(parseYaml('# just a comment')).toBeNull()
  })

  it('rejects tabs used for indentation', () => {
    expect(() => parseYaml('a:\n\tb: 1')).toThrow(YamlError)
  })

  it('rejects multiple documents', () => {
    expect(() => parseYaml('a: 1\n---\nb: 2')).toThrow(/Multiple YAML documents/)
  })
})

describe('toYaml', () => {
  it('emits mappings and nested sequences', () => {
    const out = toYaml({ name: 'demo', ports: [80, 443], server: { host: 'localhost' } })
    expect(out).toBe(['name: demo', 'ports:', '  - 80', '  - 443', 'server:', '  host: localhost', ''].join('\n'))
  })

  it('emits a sequence of mappings in dash form', () => {
    const out = toYaml({ jobs: [{ name: 'build', level: 2 }] })
    expect(out).toBe(['jobs:', '  - name: build', '    level: 2', ''].join('\n'))
  })

  it('quotes scalars that would otherwise be ambiguous', () => {
    const out = toYaml({ a: 'true', b: '123', c: 'null', d: 'plain' })
    expect(out).toBe(['a: "true"', 'b: "123"', 'c: "null"', 'd: plain', ''].join('\n'))
  })

  it('round-trips a realistic config', () => {
    const source = {
      name: 'ci',
      on: { push: { branches: ['main'] } },
      jobs: { build: { steps: [{ uses: 'actions/checkout@v5' }, { run: 'npm test' }] } },
    }
    expect(parseYaml(toYaml(source))).toEqual(source)
  })
})
