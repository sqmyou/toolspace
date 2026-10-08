/**
 * JSON Lines handling.
 *
 * Each non-empty line is a value, so a file with one bad line should not hide
 * the good ones. Parsing therefore reports per-line results rather than
 * throwing, and the caller decides whether a partial result is useful.
 */

export interface LineResult {
  /** One-based line number. */
  line: number
  raw: string
  value: unknown
  error: string | null
}

export interface ParseResult {
  results: LineResult[]
  values: unknown[]
  errors: LineResult[]
  blank: number
}

/** Parse text where each line holds one JSON value. */
export function parseJsonLines(input: string): ParseResult {
  const lines = input.split(/\r?\n/)
  const results: LineResult[] = []
  let blank = 0

  for (const [index, raw] of lines.entries()) {
    const text = raw.trim()
    if (!text) {
      blank += 1
      continue
    }
    try {
      results.push({ line: index + 1, raw: text, value: JSON.parse(text), error: null })
    } catch (err) {
      results.push({ line: index + 1, raw: text, value: null, error: err instanceof Error ? err.message : 'Invalid JSON' })
    }
  }

  return {
    results,
    values: results.filter((result) => !result.error).map((result) => result.value),
    errors: results.filter((result) => result.error !== null),
    blank,
  }
}

/** Split a JSON array into one compact object per line. */
export function fromJsonArray(input: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'That is not valid JSON')
  }
  if (!Array.isArray(parsed)) throw new Error('That JSON is not an array')
  return parsed.map((item) => JSON.stringify(item)).join('\n')
}

/** Join lines back into a pretty-printed JSON array. */
export function toJsonArray(input: string, indent = 2): string {
  const { values, errors } = parseJsonLines(input)
  if (errors.length) throw new Error(`${errors.length} line${errors.length === 1 ? '' : 's'} could not be parsed`)
  return JSON.stringify(values, null, indent)
}

/** Compact or pretty-print every line, keeping one value per line. */
export function reformat(input: string, indent = 0): string {
  const { results, errors } = parseJsonLines(input)
  if (errors.length) throw new Error(`${errors.length} line${errors.length === 1 ? '' : 's'} could not be parsed`)
  return results.map((result) => (indent > 0 ? JSON.stringify(result.value, null, indent).replace(/\n/g, '\n') : JSON.stringify(result.value))).join('\n')
}

/** Keep only the lines whose value passes the test. */
export function filterLines(input: string, predicate: (value: unknown) => boolean): string {
  const { values } = parseJsonLines(input)
  return values.filter(predicate).map((value) => JSON.stringify(value)).join('\n')
}

/** Pull one field out of every object line. */
export function pluckField(input: string, field: string): unknown[] {
  const { values, errors } = parseJsonLines(input)
  if (errors.length) throw new Error(`Line ${errors[0].line} is not valid JSON`)
  return values.map((value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Every line must be a JSON object to pick a field')
    return (value as Record<string, unknown>)[field]
  })
}

export interface JsonlStats {
  lines: number
  blank: number
  valid: number
  invalid: number
  fields: string[]
  types: Record<string, number>
}

/** A quick shape report for a JSON Lines file. */
export function stats(input: string): JsonlStats {
  const { results, blank } = parseJsonLines(input)
  const types: Record<string, number> = {}
  const fields = new Set<string>()

  for (const result of results) {
    if (result.error) continue
    const value = result.value
    const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
    types[type] = (types[type] ?? 0) + 1
    if (type === 'object') for (const key of Object.keys(value as Record<string, unknown>)) fields.add(key)
  }

  return {
    lines: results.length,
    blank,
    valid: results.filter((result) => !result.error).length,
    invalid: results.filter((result) => result.error).length,
    fields: [...fields].sort(),
    types,
  }
}
