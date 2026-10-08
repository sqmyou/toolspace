/** Parse and describe 5-field cron expressions (minute hour dom month dow). */

export interface CronField {
  name: string
  value: string
  description: string
  values: number[]
}

export interface CronResult {
  fields: CronField[]
  description: string
  valid: boolean
  error?: string
  /** The next few run times from a given moment, best-effort within a year. */
  next: Date[]
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const ALIASES: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11, sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }

interface FieldSpec {
  name: string
  min: number
  max: number
  names?: string[]
}

const SPECS: FieldSpec[] = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'day of month', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12, names: MONTHS },
  { name: 'day of week', min: 0, max: 6, names: DAYS },
]

function substituteNames(part: string, spec: FieldSpec): string {
  let out = part.toLowerCase()
  for (const [alias, index] of Object.entries(ALIASES)) {
    const numeric = spec.name === 'month' ? index + 1 : index
    out = out.replace(new RegExp(`\\b${alias}\\b`, 'g'), String(numeric))
  }
  return out
}

function expand(part: string, spec: FieldSpec): number[] {
  const substituted = substituteNames(part, spec)
  const stepSplit = substituted.split('/')
  if (stepSplit.length > 2) throw new Error(`Too many "/" in "${part}"`)
  const step = stepSplit[1] !== undefined ? Number(stepSplit[1]) : 1
  if (!Number.isInteger(step) || step < 1) throw new Error(`Invalid step in "${part}"`)

  const rangePart = stepSplit[0]
  let start: number
  let end: number
  if (rangePart === '*' || rangePart === '') {
    start = spec.min
    end = spec.max
  } else if (rangePart.includes('-')) {
    const [from, to] = rangePart.split('-')
    start = Number(from)
    end = Number(to)
  } else {
    start = Number(rangePart)
    end = start
  }

  if (!Number.isInteger(start) || !Number.isInteger(end)) throw new Error(`Invalid value in "${part}"`)
  if (start < spec.min || end > spec.max || start > end) {
    throw new Error(`${spec.name} must be between ${spec.min} and ${spec.max}`)
  }

  const values: number[] = []
  for (let value = start; value <= end; value += step) values.push(value)
  return values
}

export function parseField(raw: string, spec: FieldSpec): CronField {
  const values = new Set<number>()
  for (const part of raw.split(',')) {
    if (!part) throw new Error(`Empty list item in "${raw}"`)
    for (const value of expand(part, spec)) values.add(value)
  }
  const sorted = [...values].sort((a, b) => a - b)
  return { name: spec.name, value: raw, description: humanize(raw, sorted, spec), values: sorted }
}

const ANY_PHRASE: Record<string, string> = {
  minute: 'every minute',
  hour: 'every hour',
  'day of month': 'every day',
  month: 'every month',
  'day of week': 'every day of the week',
}

function humanize(raw: string, values: number[], spec: FieldSpec): string {
  if (raw === '*') return ANY_PHRASE[spec.name]
  const step = raw.match(/^\*\/(\d+)$/)
  if (step) return `every ${step[1]} ${spec.name}s`
  const labels = spec.names
    ? values.map((value) => (spec.name === 'month' ? MONTHS[value - 1] : DAYS[value]) ?? String(value))
    : values.map(String)
  return labels.join(', ')
}

export function parseCron(expression: string): CronResult {
  const trimmed = expression.trim().replace(/\s+/g, ' ')
  const parts = trimmed.split(' ')

  if (!trimmed) return { fields: [], description: '', valid: false, error: 'Enter a cron expression', next: [] }
  if (parts.length !== 5) {
    return {
      fields: [],
      description: '',
      valid: false,
      error: `Expected 5 fields (minute hour day-of-month month day-of-week), got ${parts.length}`,
      next: [],
    }
  }

  try {
    const fields = parts.map((part, index) => parseField(part, SPECS[index]))
    const description = fields.map((field, index) => humanize(field.value, field.values, SPECS[index])).join(' · ')
    return { fields, description, valid: true, next: nextRuns(fields, new Date(), 5) }
  } catch (err) {
    return { fields: [], description: '', valid: false, error: err instanceof Error ? err.message : 'Invalid expression', next: [] }
  }
}

function matches(values: number[], value: number): boolean {
  return values.includes(value)
}

/** Brute-force forward search, capped so we never spin indefinitely. */
export function nextRuns(fields: CronField[], from: Date, count: number): Date[] {
  const [minute, hour, dom, month, dow] = fields
  const results: Date[] = []
  const cursor = new Date(from.getTime())
  cursor.setSeconds(0, 0)
  cursor.setMinutes(cursor.getMinutes() + 1)

  const limit = 366 * 24 * 60
  for (let i = 0; i < limit && results.length < count; i++) {
    const monthValue = cursor.getMonth() + 1
    const domValue = cursor.getDate()
    const dowValue = cursor.getDay()
    const domRestricted = dom.value !== '*'
    const dowRestricted = dow.value !== '*'

    // Vixie cron: when both day fields are restricted, either may match.
    const dayOk =
      domRestricted && dowRestricted
        ? matches(dom.values, domValue) || matches(dow.values, dowValue)
        : domRestricted
          ? matches(dom.values, domValue)
          : dowRestricted
            ? matches(dow.values, dowValue)
            : true

    if (
      matches(minute.values, cursor.getMinutes()) &&
      matches(hour.values, cursor.getHours()) &&
      matches(month.values, monthValue) &&
      dayOk
    ) {
      results.push(new Date(cursor.getTime()))
    }
    cursor.setMinutes(cursor.getMinutes() + 1)
  }
  return results
}

const PRESETS: { label: string; expression: string }[] = [
  { label: 'Every minute', expression: '* * * * *' },
  { label: 'Every 15 minutes', expression: '*/15 * * * *' },
  { label: 'Hourly', expression: '0 * * * *' },
  { label: 'Daily at midnight', expression: '0 0 * * *' },
  { label: 'Weekdays at 09:00', expression: '0 9 * * 1-5' },
  { label: 'Weekly on Sunday', expression: '0 0 * * 0' },
  { label: 'Monthly on the 1st', expression: '0 0 1 * *' },
]

export function presets(): { label: string; expression: string }[] {
  return PRESETS
}
