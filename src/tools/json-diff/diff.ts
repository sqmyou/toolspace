/** Structural comparison of two JSON values. */

export type ChangeKind = 'added' | 'removed' | 'changed' | 'type'

export interface JsonChange {
  /** JSON Pointer-ish location, e.g. `user.tags[2]`. */
  path: string
  kind: ChangeKind
  before?: unknown
  after?: unknown
}

export interface DiffSummary {
  added: number
  removed: number
  changed: number
  type: number
}

function kindOf(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function childPath(base: string, key: string): string {
  return base ? `${base}.${key}` : key
}

/**
 * Compare two parsed JSON values.
 *
 * Object key order is ignored; arrays are compared position by position. Each
 * difference is reported once, at the deepest point where the two trees part
 * company, so the list stays readable.
 */
export function diffJson(before: unknown, after: unknown, base = ''): JsonChange[] {
  const changes: JsonChange[] = []
  const beforeKind = kindOf(before)
  const afterKind = kindOf(after)

  if (beforeKind !== afterKind) {
    return [{ path: base || '(root)', kind: 'type', before, after }]
  }

  if (beforeKind === 'object') {
    const a = before as Record<string, unknown>
    const b = after as Record<string, unknown>
    for (const key of Object.keys(a)) {
      if (!(key in b)) changes.push({ path: childPath(base, key), kind: 'removed', before: a[key] })
    }
    for (const key of Object.keys(b)) {
      if (!(key in a)) changes.push({ path: childPath(base, key), kind: 'added', after: b[key] })
    }
    for (const key of Object.keys(a)) {
      if (key in b) changes.push(...diffJson(a[key], b[key], childPath(base, key)))
    }
    return changes
  }

  if (beforeKind === 'array') {
    const a = before as unknown[]
    const b = after as unknown[]
    const shared = Math.min(a.length, b.length)
    for (let i = 0; i < shared; i++) {
      changes.push(...diffJson(a[i], b[i], `${base}[${i}]`))
    }
    for (let i = shared; i < a.length; i++) changes.push({ path: `${base}[${i}]`, kind: 'removed', before: a[i] })
    for (let i = shared; i < b.length; i++) changes.push({ path: `${base}[${i}]`, kind: 'added', after: b[i] })
    return changes
  }

  if (before !== after) {
    return [{ path: base || '(root)', kind: 'changed', before, after }]
  }
  return changes
}

export function summarize(changes: JsonChange[]): DiffSummary {
  const summary: DiffSummary = { added: 0, removed: 0, changed: 0, type: 0 }
  for (const change of changes) summary[change.kind]++
  return summary
}

/** A compact one-line rendering of an arbitrary JSON value. */
export function renderValue(value: unknown): string {
  if (value === undefined) return 'undefined'
  return JSON.stringify(value) ?? String(value)
}
