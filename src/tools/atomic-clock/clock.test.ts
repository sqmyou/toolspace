import { describe, expect, it } from 'vitest'
import {
  dayOfYear,
  daysInMonth,
  formatInZone,
  isoDate,
  isoTime,
  isLeapYear,
  isoWeek,
  localParts,
  zoneInfo,
} from './clock'

describe('isLeapYear', () => {
  it('follows the Gregorian rules', () => {
    expect(isLeapYear(2024)).toBe(true)
    expect(isLeapYear(1900)).toBe(false) // divisible by 100, not 400
    expect(isLeapYear(2000)).toBe(true) // divisible by 400
    expect(isLeapYear(2023)).toBe(false)
  })
})

describe('daysInMonth', () => {
  it('knows the month lengths', () => {
    expect(daysInMonth(2023, 1)).toBe(31)
    expect(daysInMonth(2023, 4)).toBe(30)
    expect(daysInMonth(2023, 2)).toBe(28)
  })

  it('adds the leap day', () => {
    expect(daysInMonth(2024, 2)).toBe(29)
  })

  it('is zero for a nonsense month', () => {
    expect(daysInMonth(2024, 13)).toBe(0)
  })
})

describe('dayOfYear', () => {
  it('counts from the first of January', () => {
    expect(dayOfYear(2023, 1, 1)).toBe(1)
    expect(dayOfYear(2023, 12, 31)).toBe(365)
  })

  it('accounts for a leap year', () => {
    expect(dayOfYear(2024, 12, 31)).toBe(366)
    expect(dayOfYear(2024, 3, 1)).toBe(61)
  })
})

describe('isoWeek', () => {
  it('numbers the first week correctly', () => {
    // 2024-01-04 is the first Thursday of 2024, so it is week 1.
    expect(isoWeek(new Date(2024, 0, 4))).toEqual({ week: 1, year: 2024 })
  })

  it('handles the year boundary where December belongs to next year', () => {
    // 2024-12-30 (Monday) is week 1 of 2025 in ISO terms.
    expect(isoWeek(new Date(2024, 11, 30))).toEqual({ week: 1, year: 2025 })
  })

  it('handles the start of a year that belongs to the previous ISO year', () => {
    // 2023-01-01 was a Sunday, so it is week 52 of 2022.
    expect(isoWeek(new Date(2023, 0, 1))).toEqual({ week: 52, year: 2022 })
  })
})

describe('localParts', () => {
  it('reads local fields off a date', () => {
    const date = new Date(2024, 5, 15, 9, 8, 7, 6)
    expect(localParts(date)).toEqual({
      year: 2024,
      month: 6,
      day: 15,
      hour: 9,
      minute: 8,
      second: 7,
      millisecond: 6,
      weekday: date.getDay(),
    })
  })
})

describe('isoDate / isoTime', () => {
  const parts = localParts(new Date(2024, 0, 5, 7, 4, 3, 42))

  it('pads every field', () => {
    expect(isoDate(parts)).toBe('2024-01-05')
    expect(isoTime(parts)).toBe('07:04:03.042')
    expect(isoTime(parts, false)).toBe('07:04:03')
  })
})

describe('zoneInfo', () => {
  it('reports a UTC offset for a fixed zone', () => {
    const info = zoneInfo('UTC', new Date(2024, 0, 1))
    expect(info.name).toBe('UTC')
    expect(info.offset).toMatch(/UTC(?:[+-]\d{2}:\d{2})?/)
  })

  it('reports a non-UTC offset somewhere in the world', () => {
    const info = zoneInfo('Asia/Tokyo', new Date(2024, 0, 1))
    expect(info.offset).toBe('UTC+09:00')
  })
})

describe('formatInZone', () => {
  it('renders a moment in another zone', () => {
    // 2024-01-01T00:00:00Z is 09:00 in Tokyo.
    const date = new Date(Date.UTC(2024, 0, 1, 0, 0, 0, 500))
    expect(formatInZone(date, 'Asia/Tokyo')).toBe('09:00:00.500')
  })

  it('falls back instead of throwing on a bad zone', () => {
    const date = new Date(2024, 0, 1, 12, 0, 0)
    expect(() => formatInZone(date, 'Not/AZone')).not.toThrow()
  })
})
