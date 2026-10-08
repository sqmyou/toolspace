import { describe, expect, it } from 'vitest'
import { DurationError, formatClock, formatDuration, parseDuration, parseIso, sumDurations } from './duration'

describe('parseDuration', () => {
  it('parses a single unit', () => {
    expect(parseDuration('90s')).toBe(90000)
    expect(parseDuration('2 hours')).toBe(7200000)
    expect(parseDuration('1d')).toBe(86400000)
  })

  it('parses combined units', () => {
    expect(parseDuration('1h30m')).toBe(5400000)
    expect(parseDuration('1h 30m 15s')).toBe(5415000)
    expect(parseDuration('2 days 4 hours')).toBe(187200000)
  })

  it('parses a bare number as seconds', () => {
    expect(parseDuration('45')).toBe(45000)
  })

  it('parses clock notation', () => {
    expect(parseDuration('01:30')).toBe(5400000)
    expect(parseDuration('1:30:15')).toBe(5415000)
    expect(parseDuration('0:00.500')).toBe(500)
  })

  it('is case-insensitive and ignores extra spaces', () => {
    expect(parseDuration('  1H 30M ')).toBe(5400000)
  })

  it('handles fractions', () => {
    expect(parseDuration('1.5h')).toBe(5400000)
  })

  it('rejects junk', () => {
    expect(() => parseDuration('')).toThrow(DurationError)
    expect(() => parseDuration('abc')).toThrow(DurationError)
    expect(() => parseDuration('1 fortnight')).toThrow(DurationError)
  })
})

describe('parseIso', () => {
  it('parses ISO-8601 durations', () => {
    expect(parseIso('PT1H30M')).toBe(5400000)
    expect(parseIso('P1D')).toBe(86400000)
    expect(parseIso('P1DT2H')).toBe(93600000)
    expect(parseIso('PT0.5S')).toBe(500)
  })

  it('is reached through parseDuration', () => {
    expect(parseDuration('P1W')).toBe(604800000)
  })

  it('rejects an empty duration', () => {
    expect(() => parseIso('P')).toThrow(DurationError)
    expect(() => parseIso('nonsense')).toThrow(DurationError)
  })
})

describe('formatDuration', () => {
  it('formats with short units', () => {
    expect(formatDuration(5400000)).toBe('1h 30m')
    expect(formatDuration(90000)).toBe('1m 30s')
  })

  it('formats with long units and singular agreement', () => {
    expect(formatDuration(5400000, { long: true })).toBe('1 hour 30 minutes')
    expect(formatDuration(1000, { long: true })).toBe('1 second')
  })

  it('can include milliseconds', () => {
    expect(formatDuration(1500, { millis: true })).toBe('1s 500ms')
  })

  it('can pad every unit', () => {
    expect(formatDuration(5400000, { pad: true })).toBe('0y 0mo 0w 0d 1h 30m 0s')
  })

  it('shows zero for nothing', () => {
    expect(formatDuration(0)).toBe('0s')
  })

  it('marks negative durations', () => {
    expect(formatDuration(-5400000)).toBe('-1h 30m')
  })

  it('round-trips through parseDuration', () => {
    for (const ms of [0, 1000, 90000, 5400000, 86400000]) {
      expect(parseDuration(formatDuration(ms))).toBe(ms)
    }
  })
})

describe('formatClock', () => {
  it('omits hours when there are none', () => {
    expect(formatClock(90000)).toBe('01:30')
  })

  it('includes hours when present', () => {
    expect(formatClock(5415000)).toBe('01:30:15')
  })

  it('marks negative values', () => {
    expect(formatClock(-90000)).toBe('-01:30')
  })
})

describe('sumDurations', () => {
  it('adds values', () => {
    expect(sumDurations([1000, 2000, 3000])).toBe(6000)
    expect(sumDurations([])).toBe(0)
  })
})
