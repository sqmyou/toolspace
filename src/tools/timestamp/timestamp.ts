/**
 * Timestamp parsing and formatting.
 *
 * Pure functions with no dependency: correctness here matters more than
 * breadth, so the awkward cases (seconds vs milliseconds, how to read a
 * date-only string) are handled explicitly rather than guessed at.
 */

/** Number of milliseconds in an epoch second. */
const MS_PER_SECOND = 1000
/** Seconds in a day, used to sanity-check "looks like seconds" guesses. */
const SECONDS_PER_YEAR = 31_536_000

export interface ParseResult {
  /** Epoch milliseconds. */
  date: Date
  /** How the input was interpreted, for display. */
  interpretation: string
}

export class TimestampError extends Error {}

/**
 * Parse a timestamp from a number (seconds or milliseconds), an ISO-8601
 * string, or any string the platform `Date` understands.
 */
export function parseTimestamp(input: string): ParseResult {
  const value = input.trim()
  if (!value) throw new TimestampError('Enter a timestamp or date.')

  // Pure integer: decide seconds vs milliseconds by magnitude.
  if (/^-?\d+$/.test(value)) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) throw new TimestampError('That number is out of range.')

    const asSeconds = numeric > -SECONDS_PER_YEAR * 3000 && numeric < SECONDS_PER_YEAR * 3000
    const ms = asSeconds ? numeric * MS_PER_SECOND : numeric
    const date = new Date(ms)
    if (Number.isNaN(date.getTime())) throw new TimestampError('That timestamp is out of range.')
    return { date, interpretation: asSeconds ? 'Unix seconds' : 'Unix milliseconds' }
  }

  // Dates without a time are ambiguous: JavaScript treats them as UTC, most
  // people mean local midnight. Treat as local for a date-only string.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const date = dateOnly ? new Date(`${value}T00:00:00`) : new Date(value)
  if (Number.isNaN(date.getTime())) throw new TimestampError('Could not read that as a date.')

  return { date, interpretation: dateOnly ? 'Date (local midnight)' : 'Date string' }
}

export interface ZoneFormat {
  zone: string
  label: string
  formatted: string
  offset: string
}

/** A short, human list of the zones people actually need. */
export const COMMON_ZONES = [
  'UTC',
  'America/Los_Angeles',
  'America/New_York',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Africa/Lagos',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
] as const

/** Format a date in a specific IANA zone, without any dependency. */
export function formatInZone(date: Date, zone: string): ZoneFormat {
  const dateTime = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)

  const formatted = dateTime.replace(',', '')
  const offset = offsetFor(date, zone)

  return { zone, label: zone.replace(/_/g, ' '), formatted, offset }
}

/** UTC offset such as `+02:00` for the given instant and zone. */
export function offsetFor(date: Date, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    timeZoneName: 'longOffset',
  }).formatToParts(date)
  const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name)
  if (!match) return '+00:00'
  return `${match[1]}${match[2]}:${match[3]}`
}

export interface RelativeTime {
  text: string
  /** Positive means the timestamp is in the future. */
  deltaMs: number
}

/** "3 hours ago", "in 2 days" — for quickly orienting an epoch value. */
export function relativeTo(date: Date, now = new Date()): RelativeTime {
  const deltaMs = date.getTime() - now.getTime()
  const abs = Math.abs(deltaMs)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000_000],
    ['month', 2_592_000_000],
    ['week', 604_800_000],
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
    ['second', 1000],
  ]
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === 'second') {
      const amount = Math.round(deltaMs / ms)
      return { text: rtf.format(amount, unit), deltaMs }
    }
  }
  return { text: 'now', deltaMs }
}

/** ISO-8601 in UTC, the format most APIs and logs use. */
export function toIso(date: Date): string {
  return date.toISOString()
}
