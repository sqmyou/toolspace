/**
 * Click-speed maths.
 *
 * Timestamps are milliseconds from a monotonic clock (performance.now, not
 * Date.now, so a clock adjustment mid-test cannot corrupt the result). Every
 * function is pure and takes the timestamps it needs, which is what makes the
 * scoring testable without a browser.
 */

/** How many clicks happened in the trailing `windowMs` ending at `end`. */
export function clicksInWindow(timestamps: number[], windowMs: number, end: number): number {
  const start = end - windowMs
  let count = 0
  for (const time of timestamps) if (time > start && time <= end) count += 1
  return count
}

/** Clicks per second over a trailing window. */
export function cpsInWindow(timestamps: number[], windowMs: number, end: number): number {
  if (windowMs <= 0) return 0
  return (clicksInWindow(timestamps, windowMs, end) * 1000) / windowMs
}

/**
 * The fastest window in a run: the highest clicks-per-second over any
 * `windowMs` stretch. This is the "best second" people compare, and it is more
 * honest than an average that a slow start drags down.
 */
export function bestCps(timestamps: number[], windowMs = 1000): number {
  let best = 0
  for (const time of timestamps) {
    best = Math.max(best, cpsInWindow(timestamps, windowMs, time))
  }
  return best
}

/** Average clicks per second across the whole run. */
export function averageCps(timestamps: number[], windowMs = 1000): number {
  if (timestamps.length === 0) return 0
  const span = timestamps[timestamps.length - 1] - timestamps[0]
  // A run shorter than the window would divide by nearly zero; measure over
  // the window instead so a two-click burst is not reported as 40 CPS.
  const duration = Math.max(span, windowMs)
  return (timestamps.length * 1000) / duration
}

/** The gaps between consecutive clicks, in milliseconds. */
export function intervals(timestamps: number[]): number[] {
  const gaps: number[] = []
  for (let i = 1; i < timestamps.length; i += 1) gaps.push(timestamps[i] - timestamps[i - 1])
  return gaps
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/** Population standard deviation — a spread-of-times measure. */
export function stdDev(values: number[]): number {
  if (values.length === 0) return 0
  const avg = mean(values)
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

/**
 * A 0..100 consistency score derived from how evenly spaced the clicks were.
 * A perfectly metronomic run scores 100; wild swings score low. The formula is
 * `100 * mean / (mean + stdDev)`, which is bounded, has no magic constants, and
 * rewards a low spread relative to the gap size.
 */
export function consistency(intervalsMs: number[]): number {
  if (intervalsMs.length < 2) return 0
  const avg = mean(intervalsMs)
  const deviation = stdDev(intervalsMs)
  if (avg <= 0) return 0
  return (100 * avg) / (avg + deviation)
}

/** The shortest and longest gaps, for reporting the fastest single interval. */
export function extremes(intervalsMs: number[]): { shortest: number; longest: number } {
  if (intervalsMs.length === 0) return { shortest: 0, longest: 0 }
  let shortest = Infinity
  let longest = 0
  for (const gap of intervalsMs) {
    if (gap < shortest) shortest = gap
    if (gap > longest) longest = gap
  }
  return { shortest, longest }
}
