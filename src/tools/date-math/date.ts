/**
 * Calendar arithmetic.
 *
 * Everything here works in UTC on purpose. A date calculator should give the
 * same answer in every timezone, and local time would make "add one day"
 * drift by an hour across a daylight-saving boundary. The UI converts the
 * user's calendar date to UTC midnight before calling in.
 */

export class DateError extends Error {}

export interface Duration {
  years?: number
  months?: number
  weeks?: number
  days?: number
  hours?: number
  minutes?: number
  seconds?: number
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/** Days in a month, where month is 1-12. */
export function daysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) throw new DateError('Month must be between 1 and 12')
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
}

/** Parse "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM[:SS]" as UTC. */
export function parseDate(input: string): Date {
  const text = input.trim()
  const dateTime = /^(\d{4})-(\d{1,2})-(\d{1,2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text)
  const dateOnly = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text)
  const match = dateTime ?? dateOnly
  if (!match) throw new DateError('Use YYYY-MM-DD, optionally followed by THH:MM')

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = dateTime ? Number(match[4]) : 0
  const minute = dateTime ? Number(match[5]) : 0
  const second = dateTime?.[6] ? Number(match[6]) : 0

  if (month < 1 || month > 12) throw new DateError('Month must be between 1 and 12')
  if (day < 1 || day > daysInMonth(year, month)) throw new DateError(`${year}-${match[2]} has no day ${day}`)
  if (hour > 23 || minute > 59 || second > 59) throw new DateError('Time must be within a normal day')

  return new Date(Date.UTC(year, month - 1, day, hour, minute, second))
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0')
}

/** Format a UTC date as "YYYY-MM-DD" or with time when asked. */
export function formatDate(date: Date, withTime = false): string {
  const base = `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
  if (!withTime) return base
  return `${base}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
}

/** Add a duration, clamping the day when the target month is shorter. */
export function addDuration(date: Date, duration: Duration): Date {
  const result = new Date(date.getTime())
  const totalMonths = (duration.years ?? 0) * 12 + (duration.months ?? 0)

  if (totalMonths !== 0) {
    const targetMonth = result.getUTCMonth() + totalMonths
    const year = result.getUTCFullYear() + Math.floor(targetMonth / 12)
    const month = ((targetMonth % 12) + 12) % 12
    // 31 January plus one month is 28 or 29 February, never 3 March.
    const day = Math.min(result.getUTCDate(), daysInMonth(year, month + 1))
    result.setUTCFullYear(year, month, day)
  }

  const days = (duration.weeks ?? 0) * 7 + (duration.days ?? 0)
  if (days !== 0) result.setUTCDate(result.getUTCDate() + days)
  if (duration.hours) result.setUTCHours(result.getUTCHours() + duration.hours)
  if (duration.minutes) result.setUTCMinutes(result.getUTCMinutes() + duration.minutes)
  if (duration.seconds) result.setUTCSeconds(result.getUTCSeconds() + duration.seconds)

  return result
}

export interface Difference {
  /** True when the second date is earlier than the first. */
  negative: boolean
  years: number
  months: number
  days: number
  hours: number
  minutes: number
  seconds: number
  totalDays: number
  totalHours: number
  totalMinutes: number
  totalSeconds: number
  weeks: number
  /** Days left after whole weeks. */
  remainderDays: number
  weekdays: number
}

/** Difference between two instants, broken down by calendar unit. */
export function diffDates(from: Date, to: Date): Difference {
  const negative = to.getTime() < from.getTime()
  const start = negative ? to : from
  const end = negative ? from : to

  // Walk whole calendar months forward, then take the leftover as plain time.
  // Building the anchor with addDuration keeps month-end clamping consistent
  // with the "add" panel, so 31 Jan + 1 month is 29 Feb here too.
  let totalMonths = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth())
  let anchor = addDuration(start, { months: totalMonths })
  if (anchor.getTime() > end.getTime()) {
    totalMonths -= 1
    anchor = addDuration(start, { months: totalMonths })
  }

  let remainder = end.getTime() - anchor.getTime()
  const days = Math.floor(remainder / 86400000)
  remainder -= days * 86400000
  const hours = Math.floor(remainder / 3600000)
  remainder -= hours * 3600000
  const minutes = Math.floor(remainder / 60000)
  remainder -= minutes * 60000
  const seconds = Math.floor(remainder / 1000)

  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12

  const totalSeconds = Math.floor((end.getTime() - start.getTime()) / 1000)
  const totalDays = Math.floor(totalSeconds / 86400)

  return {
    negative,
    years,
    months,
    days,
    hours,
    minutes,
    seconds,
    totalDays,
    totalHours: Math.floor(totalSeconds / 3600),
    totalMinutes: Math.floor(totalSeconds / 60),
    totalSeconds,
    weeks: Math.floor(totalDays / 7),
    remainderDays: totalDays % 7,
    weekdays: countWeekdays(start, end),
  }
}

/** Count Monday-Friday days between two dates, inclusive of both ends. */
export function countWeekdays(from: Date, to: Date): number {
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()))
  if (end.getTime() < start.getTime()) return countWeekdays(to, from)

  const fullWeeks = Math.floor((end.getTime() - start.getTime()) / (7 * 86400000))
  let count = fullWeeks * 5
  let cursor = addDuration(start, { days: fullWeeks * 7 })
  while (cursor.getTime() <= end.getTime()) {
    const weekday = cursor.getUTCDay()
    if (weekday !== 0 && weekday !== 6) count += 1
    cursor = addDuration(cursor, { days: 1 })
  }
  return count
}

export interface IsoWeek {
  year: number
  week: number
}

/** ISO-8601 week number: weeks start on Monday and week 1 holds the first Thursday. */
export function isoWeek(date: Date): IsoWeek {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = (target.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - day + 3)
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4))
  const firstDay = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3)
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86400000))
  return { year: target.getUTCFullYear(), week }
}

/** Day of the year, counting from 1. */
export function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1)
  const current = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  return Math.floor((current - start) / 86400000) + 1
}

/** Quarter of the year, 1-4. */
export function quarter(date: Date): number {
  return Math.floor(date.getUTCMonth() / 3) + 1
}
