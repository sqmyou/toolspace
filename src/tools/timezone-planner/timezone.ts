/** Timezone maths on top of `Intl`, no external date library. */

export interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  weekday: number
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

function partsFor(date: Date, timeZone: string): ZonedParts & { second: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  })
  const map: Record<string, string> = {}
  for (const part of formatter.formatToParts(date)) map[part.type] = part.value
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    // Some engines render midnight as hour 24 under hour12: false.
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: WEEKDAYS[map.weekday] ?? 0,
  }
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const { second: _second, ...rest } = partsFor(date, timeZone)
  void _second
  return rest
}

/** Offset of `timeZone` from UTC at `date`, in minutes (east positive). */
export function offsetMinutes(date: Date, timeZone: string): number {
  const parts = partsFor(date, timeZone)
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return Math.round((asUtc - date.getTime()) / 60000)
}

export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
}

export function formatTime(date: Date, timeZone: string, hour12 = false): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour12,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatDay(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short' }).format(date)
}

/** Difference in calendar days between a zone's date and a reference zone's date. */
export function dayDifference(date: Date, timeZone: string, referenceZone: string): number {
  const a = zonedParts(date, timeZone)
  const b = zonedParts(date, referenceZone)
  const aUtc = Date.UTC(a.year, a.month - 1, a.day)
  const bUtc = Date.UTC(b.year, b.month - 1, b.day)
  return Math.round((aUtc - bUtc) / 86_400_000)
}

export function isWeekend(date: Date, timeZone: string): boolean {
  const day = zonedParts(date, timeZone).weekday
  return day === 0 || day === 6
}

export interface ZoneCandidate {
  zone: string
  label: string
}

export interface Slot {
  instant: Date
  hours: Record<string, { hour: number; minute: number; dayDifference: number; weekend: boolean }>
  allWorking: boolean
  allAwake: boolean
}

export interface PlanOptions {
  /** Any instant that lands on the day to plan, in `baseZone`. */
  start: Date
  baseZone: string
  zones: ZoneCandidate[]
  workStart: number
  workEnd: number
  awakeStart: number
  awakeEnd: number
  /** Step between candidate slots, in minutes. */
  stepMinutes?: number
}

/**
 * Walk a day in `baseZone` in fixed steps and record what each clock reads in
 * every zone, flagging slots where everyone is inside working (or awake) hours.
 */
export function planDay(options: PlanOptions): Slot[] {
  const { start, baseZone, zones, workStart, workEnd, awakeStart, awakeEnd, stepMinutes = 30 } = options
  const base = zonedParts(start, baseZone)
  const dayStartUtc = Date.UTC(base.year, base.month - 1, base.day, 0, 0, 0)
  const baseOffset = offsetMinutes(start, baseZone)
  // Midnight in `baseZone` expressed as an absolute instant.
  const midnight = new Date(dayStartUtc - baseOffset * 60_000)

  const slots: Slot[] = []
  for (let minute = 0; minute < 24 * 60; minute += stepMinutes) {
    const instant = new Date(midnight.getTime() + minute * 60_000)
    const hours: Slot['hours'] = {}
    let allWorking = true
    let allAwake = true
    for (const zone of zones) {
      const parts = zonedParts(instant, zone.zone)
      const weekend = parts.weekday === 0 || parts.weekday === 6
      hours[zone.zone] = {
        hour: parts.hour,
        minute: parts.minute,
        dayDifference: dayDifference(instant, zone.zone, baseZone),
        weekend,
      }
      const inWork = !weekend && parts.hour >= workStart && parts.hour < workEnd
      const inAwake = parts.hour >= awakeStart && parts.hour < awakeEnd
      if (!inWork) allWorking = false
      if (!inAwake) allAwake = false
    }
    slots.push({ instant, hours, allWorking, allAwake })
  }
  return slots
}

/** The slots where the whole group is simultaneously in working hours. */
export function workingOverlaps(slots: Slot[]): Slot[] {
  return slots.filter((slot) => slot.allWorking)
}

export function todayIn(timeZone: string, now = new Date()): string {
  const parts = zonedParts(now, timeZone)
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

/** A short list of common zones for the picker. */
export const COMMON_ZONES: ZoneCandidate[] = [
  { zone: 'UTC', label: 'UTC' },
  { zone: 'America/Los_Angeles', label: 'San Francisco' },
  { zone: 'America/New_York', label: 'New York' },
  { zone: 'America/Sao_Paulo', label: 'São Paulo' },
  { zone: 'Europe/London', label: 'London' },
  { zone: 'Europe/Paris', label: 'Paris' },
  { zone: 'Europe/Berlin', label: 'Berlin' },
  { zone: 'Africa/Lagos', label: 'Lagos' },
  { zone: 'Europe/Moscow', label: 'Moscow' },
  { zone: 'Asia/Dubai', label: 'Dubai' },
  { zone: 'Asia/Kolkata', label: 'Mumbai' },
  { zone: 'Asia/Shanghai', label: 'Shanghai' },
  { zone: 'Asia/Tokyo', label: 'Tokyo' },
  { zone: 'Australia/Sydney', label: 'Sydney' },
]
