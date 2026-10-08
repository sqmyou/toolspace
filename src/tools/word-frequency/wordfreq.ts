/**
 * Word and n-gram frequency counting.
 *
 * Tokenisation keeps letters, digits and internal apostrophes, so "don't"
 * stays one word. Case folding and stop-word removal are optional because
 * both change the answer you get.
 */

export interface FrequencyOptions {
  caseSensitive?: boolean
  minLength?: number
  ignoreStopWords?: boolean
  ngramSize?: number
  top?: number
}

export interface Frequency {
  term: string
  count: number
  percent: number
}

export interface FrequencyReport {
  totalWords: number
  uniqueWords: number
  entries: Frequency[]
}

/** The most common English function words, used only when filtering is on. */
export const STOP_WORDS: string[] = [
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'could',
  'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has',
  'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if',
  'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor',
  'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out',
  'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs',
  'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under',
  'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom',
  'why', 'will', 'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves',
]

/** Split text into words, keeping internal apostrophes and hyphens. */
export function tokenizeWords(text: string): string[] {
  return text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []
}

export function frequency(text: string, options: FrequencyOptions = {}): FrequencyReport {
  const minLength = options.minLength ?? 1
  const size = Math.max(1, Math.min(3, options.ngramSize ?? 1))
  const fold = !options.caseSensitive
  const stop = new Set(options.ignoreStopWords ? STOP_WORDS : [])

  const tokens = tokenizeWords(text)
    .map((word) => (fold ? word.toLowerCase() : word))
    .filter((word) => word.length >= minLength)
    .filter((word) => !stop.has(word))

  const counts = new Map<string, number>()
  let total = 0
  for (let i = 0; i + size <= tokens.length; i++) {
    const term = tokens.slice(i, i + size).join(' ')
    counts.set(term, (counts.get(term) ?? 0) + 1)
    total += 1
  }

  const entries = [...counts.entries()]
    .map(([term, count]) => ({ term, count, percent: total ? (count / total) * 100 : 0 }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))

  return {
    totalWords: tokens.length,
    uniqueWords: new Set(tokens).size,
    entries: options.top && options.top > 0 ? entries.slice(0, options.top) : entries,
  }
}

/** Longest word, useful as a sanity check on tokenisation. */
export function longestWord(text: string): string {
  return tokenizeWords(text).reduce((longest, word) => (word.length > longest.length ? word : longest), '')
}
