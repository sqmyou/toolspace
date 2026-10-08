import { describe, expect, it } from 'vitest'
import { filterLines, fromJsonArray, parseJsonLines, pluckField, reformat, stats, toJsonArray } from './jsonl'

describe('parseJsonLines', () => {
  it('parses one value per line', () => {
    const result = parseJsonLines('{"a":1}\n{"a":2}')
    expect(result.values).toEqual([{ a: 1 }, { a: 2 }])
    expect(result.errors).toEqual([])
  })

  it('skips blank lines', () => {
    const result = parseJsonLines('{"a":1}\n\n\n{"a":2}\n')
    expect(result.blank).toBe(3)
    expect(result.values).toHaveLength(2)
  })

  it('reports bad lines without losing the good ones', () => {
    const result = parseJsonLines('{"a":1}\nnot json\n{"a":3}')
    expect(result.values).toEqual([{ a: 1 }, { a: 3 }])
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].line).toBe(2)
    expect(result.errors[0].error).toBeTruthy()
  })

  it('accepts any JSON value, not just objects', () => {
    const result = parseJsonLines('1\n"two"\n[3]\ntrue\nnull')
    expect(result.values).toEqual([1, 'two', [3], true, null])
  })

  it('counts lines from one', () => {
    const result = parseJsonLines('\n{"a":1}')
    expect(result.results[0].line).toBe(2)
  })
})

describe('fromJsonArray', () => {
  it('explodes an array into lines', () => {
    expect(fromJsonArray('[{"a":1},{"b":2}]')).toBe('{"a":1}\n{"b":2}')
  })

  it('handles nested values', () => {
    expect(fromJsonArray('[[1,2],[3]]')).toBe('[1,2]\n[3]')
  })

  it('rejects non-arrays and bad JSON', () => {
    expect(() => fromJsonArray('{"a":1}')).toThrow(/not an array/)
    expect(() => fromJsonArray('nope')).toThrow()
  })
})

describe('toJsonArray', () => {
  it('joins lines into a pretty array', () => {
    const output = toJsonArray('{"a":1}\n{"a":2}')
    expect(JSON.parse(output)).toEqual([{ a: 1 }, { a: 2 }])
    expect(output).toContain('\n  ')
  })

  it('refuses to guess when a line is broken', () => {
    expect(() => toJsonArray('{"a":1}\nbad')).toThrow(/could not be parsed/)
  })
})

describe('reformat', () => {
  it('compacts each line', () => {
    expect(reformat('{ "a" : 1 }')).toBe('{"a":1}')
  })

  it('can pretty-print each line', () => {
    expect(reformat('{"a":1}', 2)).toContain('\n  "a": 1')
  })

  it('rejects broken input', () => {
    expect(() => reformat('nope')).toThrow()
  })
})

describe('filterLines', () => {
  it('keeps matching lines', () => {
    const input = '{"n":1}\n{"n":2}\n{"n":3}'
    expect(filterLines(input, (value) => (value as { n: number }).n > 1)).toBe('{"n":2}\n{"n":3}')
  })

  it('ignores lines that failed to parse', () => {
    expect(filterLines('{"n":1}\nbad', () => true)).toBe('{"n":1}')
  })
})

describe('pluckField', () => {
  it('pulls a field from every object', () => {
    expect(pluckField('{"name":"a"}\n{"name":"b"}', 'name')).toEqual(['a', 'b'])
  })

  it('returns undefined for a missing field', () => {
    expect(pluckField('{"name":"a"}', 'nope')).toEqual([undefined])
  })

  it('rejects non-object lines', () => {
    expect(() => pluckField('1\n2', 'name')).toThrow(/JSON object/)
  })

  it('rejects broken JSON', () => {
    expect(() => pluckField('bad', 'name')).toThrow(/Line 1/)
  })
})

describe('stats', () => {
  it('summarises a file', () => {
    const result = stats('{"a":1,"b":2}\n{"a":3}\n\nbad')
    expect(result.lines).toBe(3)
    expect(result.valid).toBe(2)
    expect(result.invalid).toBe(1)
    expect(result.blank).toBe(1)
    expect(result.fields).toEqual(['a', 'b'])
    expect(result.types.object).toBe(2)
  })

  it('counts mixed types', () => {
    const result = stats('1\n"a"\ntrue\nnull\n[1]')
    expect(result.types).toMatchObject({ number: 1, string: 1, boolean: 1, null: 1, array: 1 })
  })
})
