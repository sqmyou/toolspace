import { describe, expect, it } from 'vitest'
import { formatInZone, offsetFor, parseTimestamp, relativeTo, TimestampError, toIso } from './timestamp'

const KNOWN_EPOCH_SECONDS = 1_700_000_000 // 2023-11-14T22:13:20Z

describe('parseTimestamp', () => {
  it('reads a 10-digit number as seconds', () => {
    const { date, interpretation } = parseTimestamp(String(KNOWN_EPOCH_SECONDS))
    expect(interpretation).toBe('Unix seconds')
    expect(date.getTime()).toBe(KNOWN_EPOCH_SECONDS * 1000)
  })

  it('reads a 13-digit number as milliseconds', () => {
    const { date, interpretation } = parseTimestamp('1700000000000')
    expect(interpretation).toBe('Unix milliseconds')
    expect(date.getTime()).toBe(1_700_000_000_000)
  })

  it('parses an ISO string', () => {
    const { date, interpretation } = parseTimestamp('2023-11-14T22:13:20.000Z')
    expect(interpretation).toBe('Date string')
    expect(date.getTime()).toBe(KNOWN_EPOCH_SECONDS * 1000)
  })

  it('treats a date-only value as local midnight', () => {
    const { date, interpretation } = parseTimestamp('2024-03-01')
    expect(interpretation).toBe('Date (local midnight)')
    expect(date.getHours()).toBe(0)
    expect(date.getDate()).toBe(1)
  })

  it('throws on empty input', () => {
    expect(() => parseTimestamp('')).toThrow(TimestampError)
    expect(() => parseTimestamp('   ')).toThrow(TimestampError)
  })

  it('throws on nonsense', () => {
    expect(() => parseTimestamp('banana')).toThrow(TimestampError)
  })
})

describe('formatInZone', () => {
  it('formats UTC', () => {
    const date = new Date(KNOWN_EPOCH_SECONDS * 1000)
    const utc = formatInZone(date, 'UTC')
    expect(utc.formatted).toContain('2023-11-14')
    expect(utc.formatted).toContain('22:13:20')
    expect(utc.offset).toBe('+00:00')
  })

  it('applies the zone offset', () => {
    const date = new Date(KNOWN_EPOCH_SECONDS * 1000)
    const tokyo = formatInZone(date, 'Asia/Tokyo')
    expect(tokyo.formatted).toContain('2023-11-15')
    expect(tokyo.offset).toBe('+09:00')
  })

  it('produces a readable label', () => {
    expect(formatInZone(new Date(), 'America/New_York').label).toBe('America/New York')
  })
})

describe('offsetFor', () => {
  it('reports zero for UTC', () => {
    expect(offsetFor(new Date(0), 'UTC')).toBe('+00:00')
  })

  it('handles negative offsets', () => {
    expect(offsetFor(new Date(KNOWN_EPOCH_SECONDS * 1000), 'America/New_York')).toBe('-05:00')
  })
})

describe('relativeTo', () => {
  const now = new Date('2024-01-01T12:00:00Z')

  it('describes the past', () => {
    const past = new Date('2024-01-01T09:00:00Z')
    expect(relativeTo(past, now).text).toBe('3 hours ago')
    expect(relativeTo(past, now).deltaMs).toBeLessThan(0)
  })

  it('describes the future', () => {
    const future = new Date('2024-01-03T12:00:00Z')
    expect(relativeTo(future, now).text).toBe('in 2 days')
    expect(relativeTo(future, now).deltaMs).toBeGreaterThan(0)
  })

  it('handles the present', () => {
    expect(relativeTo(now, now).text).toBe('now')
  })
})

describe('toIso', () => {
  it('emits a UTC ISO string', () => {
    expect(toIso(new Date(KNOWN_EPOCH_SECONDS * 1000))).toBe('2023-11-14T22:13:20.000Z')
  })
})
