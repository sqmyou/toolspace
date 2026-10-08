import { describe, expect, it } from 'vitest'
import { generateRows, makeRandom, toCsv, toJson, type FieldKey } from './fake'

describe('makeRandom', () => {
  it('is deterministic for a given seed', () => {
    const a = makeRandom(42)
    const b = makeRandom(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('differs across seeds', () => {
    expect(makeRandom(1)()).not.toBe(makeRandom(2)())
  })
})

describe('generateRows', () => {
  const fields: FieldKey[] = ['firstName', 'lastName', 'email', 'uuid']

  it('produces the requested count and fields', () => {
    const rows = generateRows({ fields, count: 5, seed: 7 })
    expect(rows).toHaveLength(5)
    expect(Object.keys(rows[0])).toEqual(fields)
  })

  it('is reproducible for the same seed', () => {
    const first = generateRows({ fields, count: 3, seed: 99 })
    const second = generateRows({ fields, count: 3, seed: 99 })
    expect(first).toEqual(second)
  })

  it('emails are unique per row and use a safe domain', () => {
    const rows = generateRows({ fields, count: 20, seed: 3 })
    const emails = rows.map((row) => row.email)
    expect(new Set(emails).size).toBe(20)
    expect(emails.every((email) => /@(example\.(com|org|net)|test\.example)$/.test(email))).toBe(true)
  })

  it('clamps the count', () => {
    expect(generateRows({ fields, count: 0, seed: 1 })).toHaveLength(1)
    expect(generateRows({ fields, count: 9999, seed: 1 })).toHaveLength(500)
  })

  it('generates a valid uuid shape', () => {
    const [row] = generateRows({ fields: ['uuid'], count: 1, seed: 5 })
    expect(row.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})

describe('toCsv', () => {
  it('writes a header and escapes separators', () => {
    const csv = toCsv([{ name: 'Ada, Inc.', note: 'say "hi"' }])
    expect(csv.split('\n')[0]).toBe('name,note')
    expect(csv).toContain('"Ada, Inc."')
    expect(csv).toContain('"say ""hi"""')
  })

  it('returns an empty string with no rows', () => {
    expect(toCsv([])).toBe('')
  })
})

describe('toJson', () => {
  it('pretty-prints rows', () => {
    expect(toJson([{ a: '1' }])).toBe('[\n  {\n    "a": "1"\n  }\n]')
  })
})
