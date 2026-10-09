/**
 * Coin flip.
 *
 * The randomness comes from crypto.getRandomValues, not Math.random: a flip
 * is meant to be fair, and the platform can give us genuine entropy for free.
 * Everything here is pure so the maths can be tested without the DOM.
 *
 * Unbiased bit extraction is the whole point. `random() % 2` is subtly biased
 * because the range rarely divides evenly, so we reject the tail of the range
 * instead of folding it — the same trick a serial generator uses for a
 * uniform integer.
 */

/** One flip: heads or tails. */
export type Side = 'heads' | 'tails'

/** The minimum number of random bits we can ask for and still be uniform. */
const POOL_LIMIT = 0x10000

/**
 * A uniform integer in [0, max) drawn from the injected source.
 *
 * `source` returns a 16-bit unsigned value. We reject any draw at or above the
 * largest multiple of `max` below POOL_LIMIT, which keeps every outcome
 * equally likely; the loop is expected to run once or twice.
 */
export function uniformInt(max: number, source: () => number): number {
  if (!Number.isInteger(max) || max < 1) throw new Error('max must be a positive integer')
  if (max === 1) return 0
  const ceiling = Math.floor(POOL_LIMIT / max) * max
  let draw = source()
  while (draw >= ceiling) draw = source()
  return draw % max
}

/** A fair coin flip. */
export function flip(source: () => number): Side {
  return uniformInt(2, source) === 0 ? 'heads' : 'tails'
}

/** Roll a handful of flips at once. */
export function flipMany(count: number, source: () => number): Side[] {
  if (!Number.isInteger(count) || count < 0) throw new Error('count must be a non-negative integer')
  return Array.from({ length: count }, () => flip(source))
}

export interface Tally {
  heads: number
  tails: number
  total: number
}

/** Count a run of flips. */
export function tally(sides: Side[]): Tally {
  let heads = 0
  for (const side of sides) if (side === 'heads') heads += 1
  return { heads, tails: sides.length - heads, total: sides.length }
}

/**
 * The longest run of one side in a row — the streak people find "surprising"
 * and therefore worth showing next to the totals.
 */
export function longestStreak(sides: Side[]): { side: Side | null; length: number } {
  let bestSide: Side | null = null
  let best = 0
  let runSide: Side | null = null
  let run = 0
  for (const current of sides) {
    run = current === runSide ? run + 1 : 1
    runSide = current
    // Only the side that owns the longest run wins; a later, shorter run must
    // not overwrite it just because it ended last.
    if (run > best) {
      best = run
      bestSide = current
    }
  }
  return { side: bestSide, length: best }
}
