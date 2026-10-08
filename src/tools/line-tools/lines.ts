/** Sorting, deduplicating and tidying lists of lines. */

export interface LineOptions {
  trim: boolean
  dropEmpty: boolean
  dedupe: boolean
  dedupeCaseSensitive: boolean
  sort: 'none' | 'asc' | 'desc' | 'length'
  natural: boolean
  caseSensitive: boolean
  reverse: boolean
  shuffle: boolean
  numbering: 'none' | 'plain' | 'dot' | 'paren'
}

export const DEFAULT_OPTIONS: LineOptions = {
  trim: true,
  dropEmpty: true,
  dedupe: false,
  dedupeCaseSensitive: true,
  sort: 'none',
  natural: false,
  caseSensitive: true,
  reverse: false,
  shuffle: false,
  numbering: 'none',
}

export function processLines(text: string, options: LineOptions, rng: () => number = Math.random): string {
  let lines = text.split(/\r?\n/)
  if (options.trim) lines = lines.map((line) => line.trim())
  if (options.dropEmpty) lines = lines.filter((line) => line !== '')

  if (options.dedupe) {
    const seen = new Set<string>()
    lines = lines.filter((line) => {
      const key = options.dedupeCaseSensitive ? line : line.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  if (options.sort !== 'none') {
    const fold = (line: string) => (options.caseSensitive ? line : line.toLowerCase())
    if (options.sort === 'length') {
      lines.sort((a, b) => a.length - b.length || fold(a).localeCompare(fold(b)))
    } else {
      // A plain comparison keeps ASCII case order; localeCompare is used only
      // when case-insensitive or natural ordering is asked for.
      const compare = options.natural
        ? (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: options.caseSensitive ? 'case' : 'base' })
        : options.caseSensitive
          ? (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
          : (a: string, b: string) => a.localeCompare(b)
      lines.sort((a, b) => compare(fold(a), fold(b)))
      if (options.sort === 'desc') lines.reverse()
    }
  }

  if (options.shuffle) {
    for (let i = lines.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[lines[i], lines[j]] = [lines[j], lines[i]]
    }
  }

  if (options.reverse) lines.reverse()

  if (options.numbering !== 'none') {
    lines = lines.map((line, index) => {
      const n = index + 1
      if (options.numbering === 'dot') return `${n}. ${line}`
      if (options.numbering === 'paren') return `${n}) ${line}`
      return `${n} ${line}`
    })
  }

  return lines.join('\n')
}

export interface LineStats {
  lines: number
  unique: number
  words: number
  bytes: number
}

export function lineStats(text: string): LineStats {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
  const unique = new Set(lines.map((line) => line.trim())).size
  const words = text.split(/\s+/).filter(Boolean).length
  return { lines: lines.length, unique, words, bytes: new TextEncoder().encode(text).length }
}
