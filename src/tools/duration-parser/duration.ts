/**
 * Human duration parsing and formatting.
 *
 * Parsing accepts the loose forms people actually type ("1h30m", "2 days
 * 4 hours", "90s") as well as an ISO-8601 duration. Values are returned in
 * milliseconds, and formatting can choose between a compact clock and words.
 */

export class DurationError extends Error {}

export interface Unit {
  ms: number
  names: string[]
  short: string
}

export const UNITS: Unit[] = [
  { ms: 31557600000, names: ['year', 'years', 'y', 'yr', 'yrs'], short: 'y' },
  { ms: 2629800000, names: ['month', 'months', 'mo', 'mos'], short: 'mo' },
  { ms: 604800000, names: ['week', 'weeks', 'w', 'wk', 'wks'], short: 'w' },
  { ms: 86400000, names: ['day', 'days', 'd'], short: 'd' },
  { ms: 3600000, names: ['hour', 'hours', 'h', 'hr', 'hrs'], short: 'h' },
  { ms: 60000, names: ['minute', 'minutes', 'min', 'mins', 'm'], short: 'm' },
  { ms: 1000, names: ['second', 'seconds', 'sec', 'secs', 's'], short: 's' },
  { ms: 1, names: ['millisecond', 'milliseconds', 'ms', 'msec', 'msecs'], short: 'ms' },
]

const BY_NAME = new Map<string, number>()
for (const unit of UNITS) for (const name of unit.names) BY_NAME.set(name, unit.ms)

const CLOCK = /^(\d+):(\d{1,2})(?::(\d{1,2}))?(?:\.(\d{1,3}))?$/
const ISO = /^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i

/** Parse a duration string into milliseconds. */
export function parseDuration(input: string): number {
  const text = input.trim().toLowerCase()
  if (!text) throw new DurationError('Enter a duration, for example 1h30m')

  const clock = CLOCK.exec(text)
  if (clock) {
    const [, hours, minutes, seconds = '0', millis = '0'] = clock
    return Number(hours) * 3600000 + Number(minutes) * 60000 + Number(seconds) * 1000 + Number(millis.padEnd(3, '0'))
  }

  if (text.startsWith('p')) return parseIso(text)

  // Insert a space between a number and its unit so "1h30m" tokenises cleanly.
  const spaced = text.replace(/(\d+(?:\.\d+)?)\s*/g, '$1 ').replace(/([a-z]+)/g, ' $1 ').trim()
  const tokens = spaced.split(/\s+/)
  let total = 0
  let matched = 0

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (!/^\d+(?:\.\d+)?$/.test(token)) throw new DurationError(`"${token}" is not a number`)
    const value = Number(token)
    const next = tokens[i + 1]
    const unit = next ? BY_NAME.get(next) : 1000
    if (next && unit === undefined) throw new DurationError(`"${next}" is not a known unit`)
    total += value * (unit ?? 1000)
    matched += 1
    if (next) i += 1
  }

  if (matched === 0) throw new DurationError('Enter a duration, for example 1h30m')
  return total
}

/** Parse an ISO-8601 duration such as "P1DT2H". */
export function parseIso(text: string): number {
  const match = ISO.exec(text.trim())
  if (!match) throw new DurationError('That is not a valid ISO-8601 duration')
  const [years, months, weeks, days, hours, minutes, seconds] = match.slice(1).map((part) => Number(part ?? 0))
  if (!match.slice(1).some((part) => part !== undefined)) throw new DurationError('That duration has no components')
  const byShort = (short: string) => UNITS.find((unit) => unit.short === short)!.ms
  return (
    years * byShort('y') +
    months * byShort('mo') +
    weeks * byShort('w') +
    days * byShort('d') +
    hours * byShort('h') +
    minutes * byShort('m') +
    seconds * byShort('s')
  )
}

export interface FormatOptions {
  /** Use full unit names instead of single letters. */
  long?: boolean
  /** Include milliseconds. */
  millis?: boolean
  /** Show every unit, including zeroes. */
  pad?: boolean
}

/** Format milliseconds as a compact duration, e.g. "1h 30m". */
export function formatDuration(ms: number, options: FormatOptions = {}): string {
  const negative = ms < 0
  let remaining = Math.abs(Math.round(ms))
  const parts: string[] = []
  const units = options.millis ? UNITS : UNITS.filter((unit) => unit.ms >= 1000)

  for (const unit of units) {
    const value = Math.floor(remaining / unit.ms)
    remaining -= value * unit.ms
    if (value === 0 && !options.pad) continue
    parts.push(options.long ? `${value} ${value === 1 ? unit.names[0] : unit.names[1] ?? unit.names[0]}` : `${value}${unit.short}`)
  }

  if (parts.length === 0) parts.push(options.long ? '0 seconds' : '0s')
  return `${negative ? '-' : ''}${parts.join(' ')}`
}

/** Format milliseconds as a clock, e.g. "01:30:00" or "01:30". */
export function formatClock(ms: number): string {
  const negative = ms < 0
  let remaining = Math.floor(Math.abs(ms) / 1000)
  const hours = Math.floor(remaining / 3600)
  remaining -= hours * 3600
  const minutes = Math.floor(remaining / 60)
  const seconds = remaining - minutes * 60
  const pad = (value: number) => String(value).padStart(2, '0')
  const body = hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
  return `${negative ? '-' : ''}${body}`
}

/** Add several durations together. */
export function sumDurations(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}
