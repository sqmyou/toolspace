import { describe, expect, it } from 'vitest'
import { addDuration, countWeekdays, DateError, dayOfYear, daysInMonth, diffDates, formatDate, isLeapYear, isoWeek, parseDate, quarter } from './date'

describe('isLeapYear / daysInMonth', () => {
  it('knows leap years including century rules', () => {
    expect(isLeapYear(2024)).toBe(true)
    expect(isLeapYear(2023)).toBe(false)
    expect(isLeapYear(1900)).toBe(false)
    expect(isLeapYear(2000)).toBe(true)
  })

  it('returns the length of each month', () => {
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(daysInMonth(2023, 2)).toBe(28)
    expect(daysInMonth(2023, 4)).toBe(30)
    expect(() => daysInMonth(2023, 13)).toThrow(DateError)
  })
})

describe('parseDate', () => {
  it('parses a date-only string as UTC midnight', () => {
    expect(parseDate('2024-03-05').toISOString()).toBe('2024-03-05T00:00:00.000Z')
  })

  it('parses a date with time', () => {
    expect(parseDate('2024-03-05T14:30:15').toISOString()).toBe('2024-03-05T14:30:15.000Z')
    expect(parseDate('2024-03-05 14:30').toISOString()).toBe('2024-03-05T14:30:00.000Z')
  })

  it('rejects impossible dates', () => {
    expect(() => parseDate('2023-02-29')).toThrow(DateError)
    expect(() => parseDate('2024-13-01')).toThrow(DateError)
    expect(() => parseDate('not a date')).toThrow(DateError)
    expect(() => parseDate('2024-01-01T25:00')).toThrow(DateError)
  })

  it('round-trips through formatDate', () => {
    expect(formatDate(parseDate('2024-12-31'))).toBe('2024-12-31')
    expect(formatDate(parseDate('2024-12-31T23:59:59'), true)).toBe('2024-12-31T23:59:59')
  })
})

describe('addDuration', () => {
  it('adds days across month and year boundaries', () => {
    expect(formatDate(addDuration(parseDate('2024-02-28'), { days: 1 }))).toBe('2024-02-29')
    expect(formatDate(addDuration(parseDate('2023-02-28'), { days: 1 }))).toBe('2023-03-01')
    expect(formatDate(addDuration(parseDate('2023-12-31'), { days: 1 }))).toBe('2024-01-01')
  })

  it('clamps the day when the target month is shorter', () => {
    expect(formatDate(addDuration(parseDate('2024-01-31'), { months: 1 }))).toBe('2024-02-29')
    expect(formatDate(addDuration(parseDate('2023-03-31'), { months: 1 }))).toBe('2023-04-30')
  })

  it('adds years and months together', () => {
    expect(formatDate(addDuration(parseDate('2024-01-15'), { years: 1, months: 2 }))).toBe('2025-03-15')
  })

  it('handles negative amounts', () => {
    expect(formatDate(addDuration(parseDate('2024-03-01'), { days: -1 }))).toBe('2024-02-29')
    expect(formatDate(addDuration(parseDate('2024-01-15'), { months: -1 }))).toBe('2023-12-15')
  })

  it('converts weeks to days', () => {
    expect(formatDate(addDuration(parseDate('2024-01-01'), { weeks: 2 }))).toBe('2024-01-15')
  })

  it('adds time units', () => {
    expect(formatDate(addDuration(parseDate('2024-01-01T23:00'), { hours: 2 }), true)).toBe('2024-01-02T01:00:00')
    expect(formatDate(addDuration(parseDate('2024-01-01T00:30'), { minutes: -45 }), true)).toBe('2023-12-31T23:45:00')
  })
})

describe('diffDates', () => {
  it('counts whole days between dates', () => {
    const diff = diffDates(parseDate('2024-01-01'), parseDate('2024-01-31'))
    expect(diff.totalDays).toBe(30)
    expect(diff.months).toBe(0)
    expect(diff.days).toBe(30)
  })

  it('breaks a long span into years, months and days', () => {
    const diff = diffDates(parseDate('2020-01-15'), parseDate('2024-03-20'))
    expect(diff.years).toBe(4)
    expect(diff.months).toBe(2)
    expect(diff.days).toBe(5)
  })

  it('borrows correctly across a short month', () => {
    const diff = diffDates(parseDate('2024-01-31'), parseDate('2024-03-01'))
    expect(diff.months).toBe(1)
    expect(diff.days).toBe(1)
  })

  it('flags a reversed range', () => {
    const diff = diffDates(parseDate('2024-05-01'), parseDate('2024-04-01'))
    expect(diff.negative).toBe(true)
    expect(diff.totalDays).toBe(30)
  })

  it('reports weeks and remainder days', () => {
    const diff = diffDates(parseDate('2024-01-01'), parseDate('2024-01-17'))
    expect(diff.weeks).toBe(2)
    expect(diff.remainderDays).toBe(2)
  })

  it('reports sub-day units', () => {
    const diff = diffDates(parseDate('2024-01-01T10:00'), parseDate('2024-01-01T11:30'))
    expect(diff.hours).toBe(1)
    expect(diff.minutes).toBe(30)
    expect(diff.totalMinutes).toBe(90)
  })

  it('is zero for the same instant', () => {
    const diff = diffDates(parseDate('2024-06-06'), parseDate('2024-06-06'))
    expect(diff.totalDays).toBe(0)
    expect(diff.negative).toBe(false)
  })
})

describe('countWeekdays', () => {
  it('counts Monday to Friday inclusive', () => {
    expect(countWeekdays(parseDate('2024-01-01'), parseDate('2024-01-05'))).toBe(5)
  })

  it('skips weekends', () => {
    expect(countWeekdays(parseDate('2024-01-06'), parseDate('2024-01-07'))).toBe(0)
  })

  it('counts a whole week as five', () => {
    expect(countWeekdays(parseDate('2024-01-01'), parseDate('2024-01-07'))).toBe(5)
    expect(countWeekdays(parseDate('2024-01-01'), parseDate('2024-01-14'))).toBe(10)
  })

  it('is symmetric', () => {
    expect(countWeekdays(parseDate('2024-03-01'), parseDate('2024-02-01'))).toBe(countWeekdays(parseDate('2024-02-01'), parseDate('2024-03-01')))
  })

  it('counts a single weekday as one', () => {
    expect(countWeekdays(parseDate('2024-01-03'), parseDate('2024-01-03'))).toBe(1)
  })
})

describe('isoWeek / dayOfYear / quarter', () => {
  it('numbers ISO weeks', () => {
    expect(isoWeek(parseDate('2024-01-04'))).toEqual({ year: 2024, week: 1 })
    expect(isoWeek(parseDate('2024-01-01'))).toEqual({ year: 2024, week: 1 })
    expect(isoWeek(parseDate('2023-01-01'))).toEqual({ year: 2022, week: 52 })
    expect(isoWeek(parseDate('2024-12-30'))).toEqual({ year: 2025, week: 1 })
  })

  it('counts the day of the year', () => {
    expect(dayOfYear(parseDate('2024-01-01'))).toBe(1)
    expect(dayOfYear(parseDate('2024-12-31'))).toBe(366)
    expect(dayOfYear(parseDate('2023-12-31'))).toBe(365)
  })

  it('reports the quarter', () => {
    expect(quarter(parseDate('2024-01-01'))).toBe(1)
    expect(quarter(parseDate('2024-04-01'))).toBe(2)
    expect(quarter(parseDate('2024-12-31'))).toBe(4)
  })
})
