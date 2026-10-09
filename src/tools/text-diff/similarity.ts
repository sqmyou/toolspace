/**
 * String similarity.
 *
 * Levenshtein gives the edit distance; the ratio normalises it to 0–1 so two
 * pairs of different lengths can be compared. The two-row implementation keeps
 * memory at O(min(n, m)) instead of a full table.
 */

/** Edit distance: the fewest insertions, deletions or substitutions to go from a to b. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  // Compare code points so emoji and accents count as one edit, not two.
  const left = [...a]
  const right = [...b]
  if (left.length > right.length) return levenshtein(b, a)

  let previous = Array.from({ length: left.length + 1 }, (_, i) => i)
  for (let j = 1; j <= right.length; j++) {
    const current = [j]
    for (let i = 1; i <= left.length; i++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1
      current[i] = Math.min(previous[i] + 1, current[i - 1] + 1, previous[i - 1] + cost)
    }
    previous = current
  }
  return previous[left.length]
}

/** Similarity from 0 (nothing alike) to 1 (identical). */
export function similarity(a: string, b: string): number {
  if (a === b) return 1
  const longest = Math.max([...a].length, [...b].length)
  if (longest === 0) return 1
  return 1 - levenshtein(a, b) / longest
}

/** Similarity shown as a whole-number percentage. */
export function similarityPercent(a: string, b: string): number {
  return Math.round(similarity(a, b) * 100)
}

export interface SimilarityRow {
  a: string
  b: string
  distance: number
  percent: number
}

/** Compare every line of one text against every line of another, best first. */
export function closestPairs(before: string, after: string, limit = 20): SimilarityRow[] {
  const left = before.split(/\r\n?|\n/).map((line) => line.trim()).filter(Boolean)
  const right = after.split(/\r\n?|\n/).map((line) => line.trim()).filter(Boolean)
  const rows: SimilarityRow[] = []
  for (const a of left) {
    for (const b of right) {
      if (a === b) continue
      rows.push({ a, b, distance: levenshtein(a, b), percent: similarityPercent(a, b) })
    }
  }
  return rows.sort((x, y) => y.percent - x.percent || x.distance - y.distance).slice(0, limit)
}
