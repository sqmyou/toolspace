/**
 * Typing-speed maths.
 *
 * The standard figure is words per minute, where a "word" is five characters
 * including spaces — that is what makes a 60-second burst of code and a
 * 60-second burst of prose comparable. Accuracy is measured over every
 * keypress, not just the final text, so a burst of backspacing cannot hide a
 * mistake.
 */

export const CHARS_PER_WORD = 5

export interface KeyEvent {
  /** The character the user produced. A backspace is `null`. */
  char: string | null
  /** Whether the keypress matched what was expected. */
  correct: boolean
  /** Milliseconds since the test began. */
  at: number
  /** The character that was expected, when the tool recorded it. */
  expected?: string | null
}

export interface KeystrokeStats {
  /** Every keypress, including backspaces. */
  total: number
  correct: number
  incorrect: number
  backspaces: number
  accuracy: number
  /** Net characters typed per minute (WPM × 5). */
  cpm: number
  wpm: number
  rawWpm: number
}

/**
 * Summarise a run.
 *
 * `wpm` counts only the characters still standing in the final text, so a
 * mistake that was corrected still costs time but not a character. `rawWpm`
 * counts every correct keypress, which is the flattering number. Both are
 * conventional, and showing both is more honest than picking one.
 */
export function keystrokeStats(events: KeyEvent[], finalLength: number, durationMs: number): KeystrokeStats {
  const total = events.length
  const backspaces = events.filter((event) => event.char === null).length
  const incorrect = events.filter((event) => event.char !== null && !event.correct).length
  const correct = total - incorrect - backspaces
  const minutes = durationMs > 0 ? durationMs / 60000 : 0
  const typed = correct + incorrect

  return {
    total,
    correct,
    incorrect,
    backspaces,
    accuracy: typed === 0 ? 0 : (correct / typed) * 100,
    cpm: minutes > 0 ? finalLength / minutes : 0,
    wpm: minutes > 0 ? finalLength / CHARS_PER_WORD / minutes : 0,
    rawWpm: minutes > 0 ? correct / CHARS_PER_WORD / minutes : 0,
  }
}

/**
 * Build a practice text from a word bank.
 *
 * Words are drawn in a fixed order with no immediate repeat, and joined with
 * spaces, so a run is deterministic given the same seed list and does not
 * depend on Math.random.
 */
export function buildText(bank: string[], count: number): string {
  if (bank.length === 0 || count <= 0) return ''
  const words: string[] = []
  for (let i = 0; i < count; i += 1) {
    let word = bank[i % bank.length]
    if (words[words.length - 1] === word && bank.length > 1) word = bank[(i + 1) % bank.length]
    words.push(word)
  }
  return words.join(' ')
}

/** A shuffled copy of `items` using the platform CSPRNG (Fisher–Yates). */
export function shuffled<T>(items: T[]): T[] {
  const copy = items.slice()
  const buffer = new Uint32Array(1)
  for (let i = copy.length - 1; i > 0; i -= 1) {
    crypto.getRandomValues(buffer)
    const j = buffer[0] % (i + 1)
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Split a practice text into the characters a typist has to hit. */
export function characters(text: string): string[] {
  return [...text]
}

/** A single second of a run, used to draw the speed-over-time chart. */
export interface SecondSample {
  /** The second this sample closes, 1-based. */
  second: number
  /** Net WPM for that second alone: correct characters × 12 (five to a word, per second). */
  wpm: number
  /** Errors committed during that second. */
  errors: number
}

/**
 * Bucket a run into one-second samples.
 *
 * WPM weights each bucket equally at one second, so the value is the plain
 * "characters in this second, five to a word": `wpm = correct × 12`.
 */
export function perSecondSeries(events: KeyEvent[], durationMs: number): SecondSample[] {
  const samples: SecondSample[] = []
  const whole = Math.floor(durationMs / 1000)
  for (let second = 1; second <= whole; second += 1) {
    const from = (second - 1) * 1000
    const to = second * 1000
    const bucket = events.filter((event) => event.at > from && event.at <= to)
    const correct = bucket.filter((event) => event.char !== null && event.correct).length
    const errors = bucket.filter((event) => event.char !== null && !event.correct).length
    samples.push({ second, wpm: correct * (60000 / 1000) / CHARS_PER_WORD, errors })
  }
  return samples
}

export interface WeakKey {
  /** The expected character that was missed most often. */
  char: string
  /** How many times it was missed. */
  misses: number
  /** How many times it was attempted. */
  attempts: number
  /** Misses ÷ attempts, 0..1. */
  rate: number
}

/**
 * Rank the characters a typist struggled with.
 *
 * Only events that recorded an `expected` character and were wrong count as
 * misses, so a stray backspace cannot distort the picture.
 */
export function weakKeys(events: KeyEvent[], minimum = 3, limit = 6): WeakKey[] {
  const tally = new Map<string, { misses: number; attempts: number }>()
  for (const event of events) {
    const key = event.expected
    if (key == null || key === ' ') continue
    const entry = tally.get(key) ?? { misses: 0, attempts: 0 }
    entry.attempts += 1
    if (!event.correct) entry.misses += 1
    tally.set(key, entry)
  }
  return [...tally.entries()]
    .filter(([, entry]) => entry.misses > 0)
    .map(([char, entry]) => ({ char, misses: entry.misses, attempts: entry.attempts, rate: entry.misses / entry.attempts }))
    .filter((entry) => entry.attempts >= minimum)
    .sort((a, b) => b.rate - a.rate || b.misses - a.misses || a.char.localeCompare(b.char))
    .slice(0, limit)
}

/** A least-squares line through `ys` sampled at 0..n-1, used to trend the chart. */
export function linearTrend(values: number[]): number[] {
  const n = values.length
  if (n === 0) return []
  if (n === 1) return [values[0]]
  const meanX = (n - 1) / 2
  const meanY = values.reduce((sum, value) => sum + value, 0) / n
  let numerator = 0
  let denominator = 0
  for (let i = 0; i < n; i += 1) {
    numerator += (i - meanX) * (values[i] - meanY)
    denominator += (i - meanX) ** 2
  }
  const slope = denominator === 0 ? 0 : numerator / denominator
  const intercept = meanY - slope * meanX
  return values.map((_, i) => intercept + slope * i)
}

/**
 * Score how steady the inter-key gaps were.
 *
 * A run with a handful of samples reads 0; otherwise the coefficient of
 * variation (`stdDev ÷ mean`) maps to a 0..100 score, capped at 100.
 */
export function consistencyFrom(gaps: number[]): { score: number; mean: number; deviation: number } {
  if (gaps.length < 5) return { score: 0, mean: 0, deviation: 0 }
  const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length
  if (mean <= 0) return { score: 0, mean: 0, deviation: 0 }
  const variance = gaps.reduce((sum, gap) => sum + (gap - mean) ** 2, 0) / gaps.length
  const deviation = Math.sqrt(variance)
  const coefficient = deviation / mean
  const score = Math.min(100, Math.max(0, Math.round(100 * (1 - coefficient / 2))))
  return { score, mean, deviation }
}

/**
 * The speed-over-time chart as an SVG string.
 *
 * Every value is a number, so the result is injection-safe by construction and
 * can be dropped straight into `innerHTML`. Returns an empty string when there
 * is not enough of a run to draw (fewer than two whole seconds).
 */
export function speedChartSvg(samples: Array<{ second: number; wpm: number }>, width = 640, height = 160): string {
  if (samples.length < 2) return ''
  const padX = 10
  const padY = 14
  const values = samples.map((sample) => sample.wpm)
  const peak = Math.max(20, ...values)
  const step = (width - padX * 2) / (samples.length - 1)
  const x = (index: number) => padX + index * step
  const y = (value: number) => height - padY - (value / peak) * (height - padY * 2)

  const round = (value: number) => value.toFixed(1)
  const points = values.map((value, index) => `${round(x(index))},${round(y(value))}`)
  const area = `M ${padX},${height - padY} L ${points.join(' L ')} L ${round(x(values.length - 1))},${height - padY} Z`
  const bars = values
    .map((value, index) => {
      const top = y(value)
      return `<rect class="ts-type-chart__bar" x="${round(x(index) - step * 0.28)}" y="${round(top)}" width="${round(step * 0.56)}" height="${round(Math.max(0, height - padY - top))}" rx="2" />`
    })
    .join('')
  const trend = linearTrend(values).map((value, index) => `${round(x(index))},${round(y(value))}`)
  const dots = values.map((value, index) => `<circle class="ts-type-chart__dot" cx="${round(x(index))}" cy="${round(y(value))}" r="2.4" />`).join('')

  return (
    `<svg class="ts-type-chart" viewBox="0 0 ${width} ${height}" role="img" ` +
    `aria-label="Words per minute across ${samples.length} seconds">` +
    `<path class="ts-type-chart__area" d="${area}" />${bars}` +
    `<polyline class="ts-type-chart__trend" points="${trend.join(' ')}" />` +
    `<polyline class="ts-type-chart__line" points="${points.join(' ')}" />${dots}</svg>`
  )
}