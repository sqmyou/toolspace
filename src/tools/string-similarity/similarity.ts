/**
 * String similarity and distance.
 *
 * Five measures that answer different questions, so the tool shows them
 * together rather than picking one:
 *
 * - Levenshtein: fewest single-character edits (insert, delete, substitute).
 * - Damerau–Levenshtein: as above but a transposition counts as one edit, which
 *   matches typos like "teh" → "the".
 * - Jaro and Jaro–Winkler: reward matching characters and shared prefixes; good
 *   for short names.
 * - Dice coefficient over character bigrams: order-insensitive overlap, good for
 *   longer strings and word reordering.
 *
 * The Levenshtein row is computed with an O(n) rolling array rather than the
 * full matrix; the transposition variant keeps a small extra row for the
 * previous-but-one values.
 */

export interface SimilarityResult {
  levenshtein: number
  damerau: number
  jaro: number
  jaroWinkler: number
  dice: number
  /** Dice expressed as a percentage, for the widest-range readout. */
  dicePercent: number
}

/* -------------------------------------------------------------------------
   Edit distance
   ------------------------------------------------------------------------- */

/** Levenshtein distance between two strings, in code units. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  // Work on the shorter string as columns to keep the array small.
  if (a.length < b.length) [a, b] = [b, a]

  let previous: number[] = Array.from({ length: b.length + 1 }, (_, i) => i)
  let current: number[] = new Array(b.length + 1)

  for (let i = 1; i <= a.length; i++) {
    current[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
    }
    ;[previous, current] = [current, previous]
  }
  return previous[b.length]
}

/** Damerau–Levenshtein distance, where an adjacent swap is a single edit. */
export function damerauLevenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const rows = a.length + 1
  const cols = b.length + 1
  const d: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0))
  for (let i = 0; i < rows; i++) d[i][0] = i
  for (let j = 0; j < cols; j++) d[0][j] = j

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }
  return d[a.length][b.length]
}

/* -------------------------------------------------------------------------
   Jaro family
   ------------------------------------------------------------------------- */

/** Jaro similarity in the range 0..1. */
export function jaro(a: string, b: string): number {
  if (a === b) return 1
  if (a.length === 0 || b.length === 0) return 0

  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1)
  const aMatched = new Array<boolean>(a.length).fill(false)
  const bMatched = new Array<boolean>(b.length).fill(false)

  let matches = 0
  for (let i = 0; i < a.length; i++) {
    const from = Math.max(0, i - window)
    const to = Math.min(i + window + 1, b.length)
    for (let j = from; j < to; j++) {
      if (bMatched[j] || a[i] !== b[j]) continue
      aMatched[i] = true
      bMatched[j] = true
      matches++
      break
    }
  }
  if (matches === 0) return 0

  let transpositions = 0
  let k = 0
  for (let i = 0; i < a.length; i++) {
    if (!aMatched[i]) continue
    while (!bMatched[k]) k++
    if (a[i] !== b[k]) transpositions++
    k++
  }
  const half = transpositions / 2
  return (matches / a.length + matches / b.length + (matches - half) / matches) / 3
}

/** Jaro–Winkler, which boosts Jaro for a shared prefix. */
export function jaroWinkler(a: string, b: string, scaling = 0.1): number {
  const base = jaro(a, b)
  if (base <= 0.7) return base
  let prefix = 0
  const limit = Math.min(4, a.length, b.length)
  while (prefix < limit && a[prefix] === b[prefix]) prefix++
  return base + prefix * scaling * (1 - base)
}

/* -------------------------------------------------------------------------
   Dice over bigrams
   ------------------------------------------------------------------------- */

function bigrams(text: string): string[] {
  const out: string[] = []
  for (let i = 0; i < text.length - 1; i++) out.push(text.slice(i, i + 2))
  return out
}

/** Sørensen–Dice coefficient over character bigrams, in the range 0..1. */
export function dice(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const left = bigrams(a)
  const counts = new Map<string, number>()
  for (const gram of left) counts.set(gram, (counts.get(gram) ?? 0) + 1)
  let overlap = 0
  for (const gram of bigrams(b)) {
    const remaining = counts.get(gram) ?? 0
    if (remaining > 0) {
      overlap++
      counts.set(gram, remaining - 1)
    }
  }
  return (2 * overlap) / (left.length + bigrams(b).length)
}

/** All measures at once. */
export function compare(a: string, b: string): SimilarityResult {
  const diceScore = dice(a, b)
  return {
    levenshtein: levenshtein(a, b),
    damerau: damerauLevenshtein(a, b),
    jaro: jaro(a, b),
    jaroWinkler: jaroWinkler(a, b),
    dice: diceScore,
    dicePercent: diceScore * 100,
  }
}

/** A 0..1 score as a whole-number percentage. */
export function percent(value: number): number {
  return Math.round(value * 1000) / 10
}
