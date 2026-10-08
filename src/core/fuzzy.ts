/**
 * Fuzzy matching for tool discovery.
 *
 * The goal is that nobody has to remember an exact tool name or fight with
 * word order and spelling. A query like "jasn" or "base 64" should still land
 * on the right tool.
 *
 * Every function here is pure so the ranking can be unit tested without a
 * browser.
 */

/** Lowercase and fold accents so "café" and "cafe" behave the same. */
export function normalise(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/** Split a query into words, dropping empties. */
export function tokenize(query: string): string[] {
  return normalise(query)
    .split(/\s+/)
    .filter(Boolean)
}

/** Characters that start a new "word" inside an identifier or path. */
const BOUNDARY = /[\s\-_/.·:,[\]()]/

/**
 * Compactness of a subsequence match, 0 when `needle` is not a subsequence of
 * `haystack`. Contiguous hits score near 1, scattered hits score lower.
 */
function subsequenceScore(needle: string, haystack: string): number {
  let cursor = 0
  let first = -1
  let last = -1

  for (const char of needle) {
    const found = haystack.indexOf(char, cursor)
    if (found === -1) return 0
    if (first === -1) first = found
    last = found
    cursor = found + 1
  }

  return needle.length / (last - first + 1)
}

/** True when `a` and `b` are within `max` edits, bailing out early. */
function withinEditDistance(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false
  if (a === b) return true

  const previous = new Array<number>(b.length + 1)
  const current = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) previous[j] = j

  for (let i = 1; i <= a.length; i++) {
    current[0] = i
    let rowMin = current[0]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
      rowMin = Math.min(rowMin, current[j])
    }
    // If the whole row is already worse than the budget, no later row can help.
    if (rowMin > max) return false
    for (let j = 0; j <= b.length; j++) previous[j] = current[j]
  }

  return previous[b.length] <= max
}

/**
 * Score a single query token against a single string. Returns 0 when there is
 * no match at all, and approaches 1 for an exact hit.
 *
 * The tiers, best first: exact, prefix, word-boundary substring, substring,
 * word prefix, one typo, then a scattered subsequence.
 *
 * `allowFuzzy` gates the two looseest tiers (typo and subsequence). They are
 * useful on names and keywords but too noisy on prose descriptions, where an
 * ordinary substring match is the right level of tolerance.
 */
export function scoreToken(token: string, text: string, allowFuzzy = true): number {
  const needle = normalise(token)
  const haystack = normalise(text)
  if (!needle || !haystack) return 0

  if (haystack === needle) return 1
  if (haystack.startsWith(needle)) return 0.95

  const index = haystack.indexOf(needle)
  if (index >= 0) {
    return index === 0 || BOUNDARY.test(haystack[index - 1]) ? 0.9 : 0.8
  }

  if (!allowFuzzy) return 0

  for (const word of haystack.split(/[\s\-_/.·:,[\]()]+/)) {
    if (!word) continue
    if (word.startsWith(needle)) return 0.75
  }
  for (const word of haystack.split(/[\s\-_/.·:,[\]()]+/)) {
    if (!word) continue
    if (withinEditDistance(needle, word, 1)) return 0.65
  }

  const compactness = subsequenceScore(needle, haystack)
  if (compactness > 0) return 0.3 + compactness * 0.3

  return 0
}

export interface Field {
  text: string
  /** Relative importance, 0–1. The tool's name should sit near 1. */
  weight: number
  /** Allow typo and subsequence matches. Disable for prose descriptions. */
  fuzzy?: boolean
}

/**
 * Score a whole query against a weighted set of fields.
 *
 * All tokens must match somewhere, which keeps results precise. The result is
 * the mean of each token's best weighted match.
 */
export function scoreQuery(tokens: string[], fields: Field[]): number {
  if (tokens.length === 0) return 0

  let total = 0
  for (const token of tokens) {
    let best = 0
    for (const field of fields) {
      const score = scoreToken(token, field.text, field.fuzzy !== false)
      if (score > 0) best = Math.max(best, score * field.weight)
    }
    // A missing token means the result is not what was asked for.
    if (best === 0) return 0
    total += best
  }

  return total / tokens.length
}
