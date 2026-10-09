/**
 * Countdown maths.
 *
 * A countdown is only as good as its parsing: people type "1h30m", "90", "1:30"
 * and "2 hours 15 min" and all of them should work. So the parser accepts three
 * shapes — a colon clock, unit-suffixed groups, and a bare number (seconds) —
 * and the rest of the module is plain millisecond arithmetic.
 */

const UNIT_MS: Record<string, number> = {
  d: 86400000,
  h: 3600000,
  m: 60000,
  s: 1000,
}

/** Parse a duration into milliseconds, or throw a readable error. */
export function parseDuration(input: string): number {
  const text = input.trim().toLowerCase()
  if (!text) throw new Error('Enter a duration.')

  // `1:30:00` / `1:30` — the largest field is hours when three are present.
  if (/^\d+(:\d{1,2}){1,2}$/.test(text)) {
    const fields = text.split(':').map(Number)
    const seconds = fields.reduce((total, field) => total * 60 + field, 0)
    return seconds * 1000
  }

  // `1h30m`, `90m`, `2 hours 15 min`, `45s`.
  const matches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(d|h|m|s|hours?|minutes?|mins?|seconds?|secs?|days?)/g)]
  if (matches.length > 0) {
    let total = 0
    for (const match of matches) {
      const value = Number(match[1])
      const key = match[2][0]
      total += value * (UNIT_MS[key] ?? 0)
    }
    if (total > 0) return Math.round(total)
    throw new Error('That duration adds up to nothing.')
  }

  // A bare number is seconds — the most common "quick timer" shorthand.
  if (/^\d+(\.\d+)?$/.test(text)) return Math.round(Number(text) * 1000)

  throw new Error('Try 1h30m, 90m, 1:30 or 45s.')
}

/** `HH:MM:SS`, or `MM:SS` when under an hour. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

/** A spoken-style duration: `1h 30m 00s`, `5m 04s`, `12s`. */
export function formatHuman(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const parts: string[] = []
  if (hours) parts.push(`${hours}h`)
  if (minutes) parts.push(`${minutes}m`)
  parts.push(`${String(seconds).padStart(minutes || hours ? 2 : 1, '0')}s`)
  return parts.join(' ')
}

/** How much of the run is spent, 0..1. */
export function progress(remainingMs: number, totalMs: number): number {
  if (totalMs <= 0) return 1
  const done = (totalMs - Math.max(0, remainingMs)) / totalMs
  return Math.min(1, Math.max(0, done))
}

/** Seconds left, rounded up — what a display should show. */
export function secondsLeft(remainingMs: number): number {
  return Math.max(0, Math.ceil(remainingMs / 1000))
}

export interface Beep {
  /** Frequency in Hz, for the Web Audio oscillator. */
  frequency: number
  /** How long the tone lasts, in milliseconds. */
  durationMs: number
  /** Delay from "now". */
  delayMs: number
}

/**
 * The pattern played at zero: three rising blips. Returned as data rather than
 * played here, so the sequence stays testable and the caller owns the audio
 * context.
 */
export function alarmPattern(): Beep[] {
  const pattern: Beep[] = []
  for (let i = 0; i < 3; i += 1) {
    pattern.push({ frequency: 660 + i * 110, durationMs: 180, delayMs: i * 260 })
  }
  return pattern
}

/** Split a countdown into whole hours, minutes and seconds. */
export function breakdown(ms: number): { hours: number; minutes: number; seconds: number } {
  const total = Math.max(0, Math.round(ms / 1000))
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  }
}
