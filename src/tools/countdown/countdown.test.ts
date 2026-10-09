import { describe, expect, it } from 'vitest'
import { alarmPattern, breakdown, formatClock, formatHuman, parseDuration, progress, secondsLeft } from './countdown'

describe('parseDuration', () => {
  it('reads a colon clock', () => {
    expect(parseDuration('1:30')).toBe(90000)
    expect(parseDuration('1:30:00')).toBe(5400000)
    expect(parseDuration('0:45')).toBe(45000)
  })

  it('reads unit-suffixed groups', () => {
    expect(parseDuration('1h30m')).toBe(5400000)
    expect(parseDuration('90m')).toBe(5400000)
    expect(parseDuration('45s')).toBe(45000)
    expect(parseDuration('2d')).toBe(172800000)
  })

  it('reads spelled-out units and spaces', () => {
    expect(parseDuration('2 hours 15 minutes')).toBe(8100000)
    expect(parseDuration('1 hour 30 min')).toBe(5400000)
    expect(parseDuration('30 secs')).toBe(30000)
  })

  it('reads a bare number as seconds', () => {
    expect(parseDuration('90')).toBe(90000)
    expect(parseDuration('1.5')).toBe(1500)
  })

  it('is case-insensitive and trims', () => {
    expect(parseDuration('  1H 30M  ')).toBe(5400000)
  })

  it('rejects nonsense with a helpful message', () => {
    expect(() => parseDuration('')).toThrow()
    expect(() => parseDuration('soon')).toThrow()
    expect(() => parseDuration('0h')).toThrow()
  })
})

describe('formatClock', () => {
  it('drops the hour field under an hour', () => {
    expect(formatClock(65000)).toBe('01:05')
  })

  it('shows hours when present', () => {
    expect(formatClock(3661000)).toBe('1:01:01')
  })

  it('clamps at zero', () => {
    expect(formatClock(-5000)).toBe('00:00')
  })

  it('rounds partially elapsed seconds up, so the last second reads 1', () => {
    expect(formatClock(400)).toBe('00:01')
  })
})

describe('formatHuman', () => {
  it('omits empty leading units', () => {
    expect(formatHuman(12000)).toBe('12s')
    expect(formatHuman(304000)).toBe('5m 04s')
    expect(formatHuman(5400000)).toBe('1h 30m 00s')
  })
})

describe('progress', () => {
  it('runs from 0 to 1', () => {
    expect(progress(10000, 10000)).toBe(0)
    expect(progress(0, 10000)).toBe(1)
    expect(progress(5000, 10000)).toBeCloseTo(0.5, 6)
  })

  it('clamps out-of-range values', () => {
    expect(progress(-100, 10000)).toBe(1)
    expect(progress(20000, 10000)).toBe(0)
  })

  it('guards a zero total', () => {
    expect(progress(0, 0)).toBe(1)
  })
})

describe('secondsLeft', () => {
  it('rounds up so a running clock never shows the next second early', () => {
    expect(secondsLeft(1)).toBe(1)
    expect(secondsLeft(1001)).toBe(2)
    expect(secondsLeft(0)).toBe(0)
    expect(secondsLeft(-50)).toBe(0)
  })
})

describe('alarmPattern', () => {
  it('is three rising blips', () => {
    const pattern = alarmPattern()
    expect(pattern).toHaveLength(3)
    expect(pattern[0].delayMs).toBe(0)
    expect(pattern[1].frequency).toBeGreaterThan(pattern[0].frequency)
    expect(pattern[2].frequency).toBeGreaterThan(pattern[1].frequency)
  })
})

describe('breakdown', () => {
  it('splits into h/m/s', () => {
    expect(breakdown(3661000)).toEqual({ hours: 1, minutes: 1, seconds: 1 })
  })

  it('is zero for a negative value', () => {
    expect(breakdown(-1)).toEqual({ hours: 0, minutes: 0, seconds: 0 })
  })
})
