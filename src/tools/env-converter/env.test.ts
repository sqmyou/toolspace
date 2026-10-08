import { describe, expect, it } from 'vitest'
import { convert, EnvError, parseEnv, parseInput, toEnv, toJson, toK8s, toShell } from './env'

describe('parseEnv', () => {
  it('parses simple pairs', () => {
    expect(parseEnv('A=1\nB=2')).toEqual([
      { key: 'A', value: '1' },
      { key: 'B', value: '2' },
    ])
  })

  it('tolerates export and spacing', () => {
    expect(parseEnv('export A = 1')).toEqual([{ key: 'A', value: '1' }])
  })

  it('strips double quotes and unescapes', () => {
    expect(parseEnv('A="line\\nbreak"')[0].value).toBe('line\nbreak')
  })

  it('keeps single-quoted values literal', () => {
    expect(parseEnv("A='a\\nb'")[0].value).toBe('a\\nb')
  })

  it('drops inline comments on unquoted values', () => {
    expect(parseEnv('A=value # trailing')[0].value).toBe('value')
  })

  it('keeps # inside quotes', () => {
    expect(parseEnv('A="a # b"')[0].value).toBe('a # b')
  })

  it('attaches a preceding comment', () => {
    expect(parseEnv('# the port\nPORT=80')[0]).toEqual({ key: 'PORT', value: '80', comment: 'the port' })
  })

  it('throws on an unparseable line', () => {
    expect(() => parseEnv('this is not valid')).toThrow(EnvError)
  })
})

describe('toJson', () => {
  it('builds a JSON object', () => {
    expect(JSON.parse(toJson(parseEnv('A=1\nB=x')))).toEqual({ A: '1', B: 'x' })
  })
})

describe('toEnv', () => {
  it('quotes values that need it', () => {
    expect(toEnv(parseEnv('A=a b'))).toBe('A="a b"\n')
  })

  it('round-trips through parseEnv', () => {
    const entries = parseEnv('A=a b\nB=plain\nC=""')
    expect(parseEnv(toEnv(entries))).toEqual(entries)
  })

  it('keeps comments attached to their entry', () => {
    expect(parseEnv(toEnv(parseEnv('# port\nPORT=80')))).toEqual([{ key: 'PORT', value: '80', comment: 'port' }])
  })
})

describe('toShell', () => {
  it('emits export lines with single quotes', () => {
    expect(toShell(parseEnv('A=a b'))).toBe("export A='a b'\n")
  })

  it('escapes embedded single quotes', () => {
    expect(toShell([{ key: 'A', value: "it's" }])).toBe("export A='it'\\''s'\n")
  })
})

describe('toK8s', () => {
  it('emits a name/value list', () => {
    expect(toK8s(parseEnv('A=1'))).toBe('env:\n  - name: A\n    value: "1"\n')
  })

  it('handles no entries', () => {
    expect(toK8s([])).toBe('env: []\n')
  })
})

describe('convert', () => {
  it('routes to the right formatter', () => {
    const entries = parseEnv('A=1')
    expect(convert(entries, 'compose')).toBe('environment:\n  A: "1"\n')
    expect(convert(entries, 'json')).toContain('"A"')
  })
})

describe('parseInput', () => {
  it('accepts JSON objects', () => {
    expect(parseInput('{"A":"1"}')).toEqual([{ key: 'A', value: '1' }])
  })

  it('falls back to env parsing', () => {
    expect(parseInput('A=1')).toEqual([{ key: 'A', value: '1' }])
  })

  it('rejects non-object JSON', () => {
    expect(() => parseInput('[1,2]')).toThrow(EnvError)
  })
})
