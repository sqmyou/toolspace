import { describe, expect, it } from 'vitest'
import {
  COMMON_ZONES,
  dayDifference,
  formatOffset,
  formatTime,
  isWeekend,
  offsetMinutes,
  planDay,
  todayIn,
  workingOverlaps,
  zonedParts,
} from './timezone'

const at = (iso: string) => new Date(iso)

describe('offsetMinutes / formatOffset', () => {
  it('reports offsets for common zones in winter', () => {
    expect(offsetMinutes(at('2024-01-15T12:00:00Z'), 'America/New_York')).toBe(-300)
    expect(offsetMinutes(at('2024-01-15T12:00:00Z'), 'Europe/London')).toBe(0)
    expect(offsetMinutes(at('2024-01-15T12:00:00Z'), 'Asia/Tokyo')).toBe(540)
  })

  it('tracks daylight saving changes', () => {
    expect(offsetMinutes(at('2024-07-15T12:00:00Z'), 'America/New_York')).toBe(-240)
    expect(offsetMinutes(at('2024-07-15T12:00:00Z'), 'Europe/London')).toBe(60)
  })

  it('formats offsets', () => {
    expect(formatOffset(-300)).toBe('UTC-05:00')
    expect(formatOffset(0)).toBe('UTC+00:00')
    expect(formatOffset(540)).toBe('UTC+09:00')
    expect(formatOffset(-210)).toBe('UTC-03:30')
  })
})

describe('zonedParts / formatTime', () => {
  it('reads the wall clock in a zone', () => {
    const parts = zonedParts(at('2024-01-15T12:00:00Z'), 'America/New_York')
    expect(parts).toMatchObject({ year: 2024, month: 1, day: 15, hour: 7, minute: 0, weekday: 1 })
    expect(formatTime(at('2024-01-15T12:00:00Z'), 'Asia/Tokyo')).toBe('21:00')
  })

  it('renders midnight as hour zero', () => {
    expect(zonedParts(at('2024-01-15T00:00:00Z'), 'UTC').hour).toBe(0)
  })
})

describe('dayDifference', () => {
  it('is zero within the same calendar day', () => {
    expect(dayDifference(at('2024-01-15T12:00:00Z'), 'Asia/Tokyo', 'America/New_York')).toBe(0)
  })

  it('detects a next-day rollover', () => {
    expect(dayDifference(at('2024-01-15T23:30:00Z'), 'Asia/Tokyo', 'America/New_York')).toBe(1)
  })
})

describe('isWeekend', () => {
  it('spots Saturday and Sunday', () => {
    expect(isWeekend(at('2024-01-13T12:00:00Z'), 'UTC')).toBe(true)
    expect(isWeekend(at('2024-01-14T12:00:00Z'), 'UTC')).toBe(true)
    expect(isWeekend(at('2024-01-15T12:00:00Z'), 'UTC')).toBe(false)
  })
})

describe('planDay', () => {
  const zones = [
    { zone: 'UTC', label: 'UTC' },
    { zone: 'Europe/London', label: 'London' },
    { zone: 'Asia/Tokyo', label: 'Tokyo' },
  ]

  it('produces one slot per step and records every zone', () => {
    const slots = planDay({ start: at('2024-01-15T00:00:00Z'), baseZone: 'UTC', zones, workStart: 9, workEnd: 18, awakeStart: 7, awakeEnd: 23, stepMinutes: 60 })
    expect(slots).toHaveLength(24)
    expect(Object.keys(slots[0].hours)).toEqual(['UTC', 'Europe/London', 'Asia/Tokyo'])
    expect(slots[0].hours['Asia/Tokyo'].hour).toBe(9)
  })

  it('finds a working overlap for zones with the same offset', () => {
    const slots = planDay({ start: at('2024-01-15T00:00:00Z'), baseZone: 'UTC', zones: zones.slice(0, 2), workStart: 9, workEnd: 18, awakeStart: 7, awakeEnd: 23, stepMinutes: 60 })
    const overlaps = workingOverlaps(slots)
    expect(overlaps).toHaveLength(9)
    expect(overlaps.every((slot) => slot.hours['UTC'].hour >= 9 && slot.hours['UTC'].hour < 18)).toBe(true)
  })

  it('reports no overlap when offsets are far apart', () => {
    const slots = planDay({ start: at('2024-01-15T00:00:00Z'), baseZone: 'UTC', zones: [zones[0], zones[2]], workStart: 9, workEnd: 17, awakeStart: 7, awakeEnd: 23, stepMinutes: 60 })
    expect(workingOverlaps(slots)).toHaveLength(0)
  })

  it('marks weekends inside the slot data', () => {
    const slots = planDay({ start: at('2024-01-13T00:00:00Z'), baseZone: 'UTC', zones: [zones[0]], workStart: 9, workEnd: 18, awakeStart: 7, awakeEnd: 23, stepMinutes: 60 })
    expect(slots[0].hours['UTC'].weekend).toBe(true)
    expect(slots[0].allWorking).toBe(false)
  })
})

describe('todayIn', () => {
  it('returns the local date, rolling over when needed', () => {
    expect(todayIn('UTC', at('2024-01-15T23:30:00Z'))).toBe('2024-01-15')
    expect(todayIn('Asia/Tokyo', at('2024-01-15T23:30:00Z'))).toBe('2024-01-16')
  })
})

describe('COMMON_ZONES', () => {
  it('is a non-empty list of valid IANA zones', () => {
    expect(COMMON_ZONES.length).toBeGreaterThan(5)
    for (const zone of COMMON_ZONES) {
      expect(() => new Intl.DateTimeFormat('en-US', { timeZone: zone.zone })).not.toThrow()
    }
  })
})
