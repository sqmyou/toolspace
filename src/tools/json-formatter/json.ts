/** JSON formatting, validation and inspection. */

export interface JsonIssue {
  message: string
  /** 1-based; 0 when the position is unknown. */
  line: number
  column: number
}

const POSITION = /position (\d+)/i

export function locate(text: string, position: number): { line: number; column: number } {
  const upTo = text.slice(0, Math.max(0, position))
  const lines = upTo.split('\n')
  return { line: lines.length, column: lines[lines.length - 1].length + 1 }
}

/**
 * Validate JSON and, when it fails, point at the offending character.
 *
 * Engines word the parse error differently, but they agree on "position N",
 * so we take that and work out the line and column ourselves.
 */
export function validateJson(text: string): JsonIssue | null {
  if (!text.trim()) return { message: 'Nothing to check — the input is empty.', line: 1, column: 1 }
  try {
    JSON.parse(text)
    return null
  } catch (error) {
    const raw = error instanceof Error ? error.message : 'Invalid JSON.'
    const match = POSITION.exec(raw)
    const message = raw
      .replace(/\s*\(line \d+ column \d+\)/, '')
      .replace(/\s*in JSON at position \d+/, '')
      .replace(/\s*at position \d+.*$/, '')
      .trim()
    if (match) {
      const { line, column } = locate(text, Number(match[1]))
      return { message, line, column }
    }
    return { message, line: 0, column: 0 }
  }
}

export function parseJson(text: string): unknown {
  return JSON.parse(text)
}

/** Recursively sort object keys, leaving arrays in order. */
export function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue)
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(source).sort((a, b) => a.localeCompare(b))) {
      out[key] = sortJsonValue(source[key])
    }
    return out
  }
  return value
}

export function formatJson(value: unknown, indent: number | '\t'): string {
  return JSON.stringify(value, null, indent)
}

export interface JsonStats {
  nodes: number
  depth: number
  bytes: number
}

/** Count values and nesting depth so the size of a document is obvious. */
export function jsonStats(value: unknown, text: string): JsonStats {
  let nodes = 0
  let depth = 0

  const walk = (node: unknown, level: number): void => {
    nodes++
    depth = Math.max(depth, level)
    if (Array.isArray(node)) {
      for (const item of node) walk(item, level + 1)
    } else if (node && typeof node === 'object') {
      for (const item of Object.values(node as Record<string, unknown>)) walk(item, level + 1)
    }
  }

  walk(value, 1)
  return { nodes, depth, bytes: new TextEncoder().encode(text).length }
}
