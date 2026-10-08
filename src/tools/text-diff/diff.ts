/** Line and word diffing via longest-common-subsequence. */

export type DiffType = 'equal' | 'add' | 'remove'

export interface DiffPart {
  type: DiffType
  value: string
}

export interface DiffGroup<T> {
  type: DiffType
  items: T[]
}

/**
 * Classic LCS table diff. Falls back to a coarse replace when inputs are very
 * large, so the O(n·m) table cannot freeze the tab.
 */
export function diff<T>(a: T[], b: T[], equals: (x: T, y: T) => boolean): DiffGroup<T>[] {
  const MAX = 4000
  if (a.length > MAX || b.length > MAX) return coarse(a, b, equals)

  const n = a.length
  const m = b.length
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] = equals(a[i], b[j])
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }

  const groups: DiffGroup<T>[] = []
  const push = (type: DiffType, item: T) => {
    const last = groups[groups.length - 1]
    if (last && last.type === type) last.items.push(item)
    else groups.push({ type, items: [item] })
  }

  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (equals(a[i], b[j])) {
      push('equal', a[i])
      i++
      j++
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      push('remove', a[i])
      i++
    } else {
      push('add', b[j])
      j++
    }
  }
  while (i < n) push('remove', a[i++])
  while (j < m) push('add', b[j++])
  return groups
}

function coarse<T>(a: T[], b: T[], equals: (x: T, y: T) => boolean): DiffGroup<T>[] {
  const tail = suffix(a, b, equals)
  let prefix = 0
  while (prefix < a.length - tail && prefix < b.length - tail && equals(a[prefix], b[prefix])) prefix++

  const groups: DiffGroup<T>[] = []
  if (prefix) groups.push({ type: 'equal', items: a.slice(0, prefix) })
  const midA = a.slice(prefix, a.length - tail)
  const midB = b.slice(prefix, b.length - tail)
  if (midA.length) groups.push({ type: 'remove', items: midA })
  if (midB.length) groups.push({ type: 'add', items: midB })
  if (tail) groups.push({ type: 'equal', items: a.slice(a.length - tail) })
  return groups
}

function suffix<T>(a: T[], b: T[], equals: (x: T, y: T) => boolean): number {
  let count = 0
  while (
    count < a.length &&
    count < b.length &&
    equals(a[a.length - 1 - count], b[b.length - 1 - count])
  ) count++
  return count
}

function toParts<T>(groups: DiffGroup<T>[], join: (items: T[]) => string): DiffPart[] {
  return groups.map((group) => ({ type: group.type, value: join(group.items) }))
}

export function diffLines(before: string, after: string): DiffPart[] {
  const groups = diff(before.split('\n'), after.split('\n'), (x, y) => x === y)
  return toParts(groups, (items) => items.join('\n'))
}

export function diffWords(before: string, after: string): DiffPart[] {
  const groups = diff(tokenize(before), tokenize(after), (x, y) => x === y)
  return toParts(groups, (items) => items.join(''))
}

/** Split into words and the whitespace between them, keeping exact spacing. */
export function tokenize(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? []
}

export interface DiffStats {
  added: number
  removed: number
  unchanged: number
}

export function diffStats(parts: DiffPart[]): DiffStats {
  const stats: DiffStats = { added: 0, removed: 0, unchanged: 0 }
  for (const part of parts) {
    if (!part.value) continue
    const count = part.value.split('\n').length
    if (part.type === 'add') stats.added += count
    else if (part.type === 'remove') stats.removed += count
    else stats.unchanged += count
  }
  return stats
}
