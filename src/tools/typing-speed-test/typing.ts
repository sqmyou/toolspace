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
 * A 0..100 consistency score from how evenly the inter-key gaps fell.
 * `100 × mean ÷ (mean + stdDev)` is bounded, has no magic constants, and
 * rewards a steady rhythm over a spiky one.
 */
export function consistencyOf(intervalMs: number[], mean: number): number {
  if (intervalMs.length < 2 || mean <= 0) return 0
  const variance = intervalMs.reduce((sum, gap) => sum + (gap - mean) ** 2, 0) / intervalMs.length
  const deviation = Math.sqrt(variance)
  return (100 * mean) / (mean + deviation)
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
