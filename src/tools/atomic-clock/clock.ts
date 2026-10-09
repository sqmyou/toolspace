/**
 * Clock maths and formatting.
 *
 * A browser cannot read an atomic clock without asking a time server, and
 * toolspace makes no such request. So "atomic" here means what the platform
 * can actually give: the system clock, which the operating system keeps
 * synchronised, read at millisecond precision and rendered many ways. The
 * pure functions below are all about civil-date arithmetic, which is where the
 * real bugs live (leap years, week numbers, timezone offsets).
 */

export interface Parts {
  year: number
  month: number // 1-12
  day: number // 1-31
  hour: number
  minute: number
  second: number
  millisecond: number
  /** Day of week, 0 (Sunday) to 6 (Saturday). */
  weekday: number
}

/** Split a Date into its local-time parts. */
export function localParts(date: Date): Parts {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
    millisecond: date.getMilliseconds(),
    weekday: date.getDay(),
  }
}

/** Is `year` a leap year in the Gregorian calendar? */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/** Days in a month, leap-aware. `month` is 1-12. */
export function daysInMonth(year: number, month: number): number {
  const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month === 2 && isLeapYear(year)) return 29
  return lengths[month - 1] ?? 0
}

/** Which day of the year a date is, 1-based. */
export function dayOfYear(year: number, month: number, day: number): number {
  let total = day
  for (let m = 1; m < month; m += 1) total += daysInMonth(year, m)
  return total
}

/** The ISO-8601 week number and its year (week starts Monday, week 1 has Jan 4). */
export function isoWeek(date: Date): { week: number; year: number } {
  // Work in UTC so a DST shift cannot move the answer by a day.
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  // Shift to the Thursday of this week; the ISO year is that Thursday's year.
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const year = d.getUTCFullYear()
  const yearStart = new Date(Date.UTC(year, 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { week, year }
}

const pad = (value: number, width = 2): string => String(value).padStart(width, '0')

/** `YYYY-MM-DD`. */
export function isoDate(parts: Parts): string {
  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`
}

/** `HH:MM:SS.mmm`. */
export function isoTime(parts: Parts, withMillis = true): string {
  const base = `${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`
  return withMillis ? `${base}.${pad(parts.millisecond, 3)}` : base
}

/** A full ISO-8601 timestamp in UTC. */
export function isoTimestamp(date: Date): string {
  return date.toISOString()
}

/** The zone name and its offset, e.g. `Europe/London · UTC+01:00`. */
export function zoneInfo(timeZone: string, at: Date): { name: string; offset: string } {
  // `timeZoneName: 'longOffset'` gives a stable UTC±HH:MM string everywhere.
  let offset = 'UTC'
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      timeZoneName: 'longOffset',
    }).formatToParts(at)
    const found = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT'
    offset = found.replace('GMT', 'UTC') || 'UTC'
  } catch {
    offset = 'UTC'
  }
  return { name: timeZone, offset }
}

/** Render a moment in a specific IANA zone, millisecond precision. */
export function formatInZone(date: Date, timeZone: string): string {
  try {
    const text = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date)
    return `${text}.${pad(date.getMilliseconds(), 3)}`
  } catch {
    return isoTime(localParts(date))
  }
}

/** The local timezone, falling back to UTC where the API is unavailable. */
export function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}
