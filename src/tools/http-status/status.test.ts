import { describe, expect, it } from 'vitest'
import { categoryOf, lookupStatus, parseStatus, searchStatuses, STATUSES, statusesByCategory } from './status'

describe('categoryOf', () => {
  it('classifies each range', () => {
    expect(categoryOf(100)).toBe('informational')
    expect(categoryOf(200)).toBe('success')
    expect(categoryOf(301)).toBe('redirect')
    expect(categoryOf(404)).toBe('client-error')
    expect(categoryOf(503)).toBe('server-error')
  })

  it('marks codes outside the range as unknown', () => {
    expect(categoryOf(99)).toBe('unknown')
    expect(categoryOf(600)).toBe('unknown')
    expect(categoryOf(200.5)).toBe('unknown')
  })
})

describe('parseStatus', () => {
  it('reads a valid code', () => {
    expect(parseStatus('404')).toBe(404)
    expect(parseStatus(' 200 ')).toBe(200)
  })

  it('rejects bad input', () => {
    expect(() => parseStatus('abc')).toThrow()
    expect(() => parseStatus('99')).toThrow()
    expect(() => parseStatus('600')).toThrow()
  })
})

describe('lookupStatus', () => {
  it('finds known codes', () => {
    expect(lookupStatus(404)?.name).toBe('Not Found')
    expect(lookupStatus(301)?.name).toBe('Moved Permanently')
    expect(lookupStatus(500)?.category).toBe('server-error')
  })

  it('returns nothing for unknown codes', () => {
    expect(lookupStatus(299)).toBeUndefined()
  })
})

describe('searchStatuses', () => {
  it('returns everything for an empty query', () => {
    expect(searchStatuses('')).toHaveLength(STATUSES.length)
  })

  it('matches on the code', () => {
    expect(searchStatuses('404').map((status) => status.code)).toEqual([404])
  })

  it('matches on the name, ignoring case', () => {
    expect(searchStatuses('gateway').map((status) => status.code)).toEqual([502, 504])
  })

  it('matches on the description', () => {
    expect(searchStatuses('rate limited').map((status) => status.code)).toEqual([429])
  })

  it('returns nothing for a miss', () => {
    expect(searchStatuses('zzzz')).toEqual([])
  })
})

describe('statusesByCategory', () => {
  it('filters by category', () => {
    const redirects = statusesByCategory('redirect')
    expect(redirects.length).toBeGreaterThan(0)
    expect(redirects.every((status) => status.code >= 300 && status.code < 400)).toBe(true)
  })
})

describe('the table itself', () => {
  it('has no duplicate codes', () => {
    const codes = STATUSES.map((status) => status.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('keeps every code inside its category range', () => {
    for (const status of STATUSES) expect(status.category).toBe(categoryOf(status.code))
  })

  it('gives every entry a name and description', () => {
    for (const status of STATUSES) {
      expect(status.name.length).toBeGreaterThan(0)
      expect(status.description.length).toBeGreaterThan(0)
    }
  })
})
