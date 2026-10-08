import { describe, expect, it } from 'vitest'
import { DEFAULT_FORMAT_OPTIONS, formatSql, SqlFormatError } from './sql'

describe('formatSql', () => {
  it('returns empty string for blank input', async () => {
    expect(await formatSql('')).toBe('')
    expect(await formatSql('   \n  ')).toBe('')
  })

  it('puts keywords on their own lines', async () => {
    const out = await formatSql('select * from users where id = 1')
    expect(out).toContain('SELECT')
    expect(out.split('\n').length).toBeGreaterThan(1)
  })

  it('uppercases keywords by default', async () => {
    expect(await formatSql('select 1')).toContain('SELECT')
  })

  it('respects a lower keyword case', async () => {
    const out = await formatSql('SELECT 1', { ...DEFAULT_FORMAT_OPTIONS, keywordCase: 'lower' })
    expect(out).toContain('select')
    expect(out).not.toContain('SELECT')
  })

  it('preserves author casing when asked', async () => {
    const out = await formatSql('SeLeCt 1', { ...DEFAULT_FORMAT_OPTIONS, keywordCase: 'preserve' })
    expect(out).toContain('SeLeCt')
  })

  it('honours the indent width', async () => {
    const two = await formatSql('select a, b from t', { ...DEFAULT_FORMAT_OPTIONS, indent: 2 })
    const four = await formatSql('select a, b from t', { ...DEFAULT_FORMAT_OPTIONS, indent: 4 })
    expect(four.length).toBeGreaterThanOrEqual(two.length)
  })

  it('is idempotent on already formatted SQL', async () => {
    const once = await formatSql('select a from t where x = 1')
    expect(await formatSql(once)).toBe(once)
  })

  it('formats more than one statement', async () => {
    const out = await formatSql('select 1; select 2;')
    expect(out.match(/SELECT/g)?.length).toBe(2)
    expect(out).toContain('1;')
    expect(out).toContain('2;')
  })

  it('throws a readable error on invalid SQL', async () => {
    await expect(formatSql('select from where ((((')).rejects.toThrow(SqlFormatError)
  })
})
