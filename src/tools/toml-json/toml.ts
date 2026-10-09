/**
 * TOML ⇄ JSON.
 *
 * A focused, dependency-free subset of TOML 1.0: tables, arrays of tables,
 * dotted and quoted keys, basic/literal strings, arrays, inline tables,
 * integers, floats, booleans and datetimes. Multi-line strings are the one
 * common construct it deliberately refuses — better a clear error than a
 * silent mis-parse.
 *
 * Datetimes have no JSON equivalent, so they round-trip as their text: a TOML
 * datetime becomes a JSON string and comes back unchanged.
 */

export class TomlError extends Error {}

type TomlValue = string | number | boolean | TomlValue[] | { [key: string]: TomlValue }

const DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}([Tt ]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})?)?$/

/** Remove a trailing `#` comment, respecting quoted strings. */
function stripComment(line: string): string {
  let quote: string | null = null
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (quote) {
      if (char === '\\' && quote === '"') i++
      else if (char === quote) quote = null
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === '#') {
      return line.slice(0, i)
    }
  }
  return line
}

/** Find the first top-level `=` that is not inside a quoted key. */
function findEquals(line: string): number {
  let quote: string | null = null
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (quote) {
      if (char === '\\' && quote === '"') i++
      else if (char === quote) quote = null
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === '=') {
      return i
    }
  }
  return -1
}

/** Split on `separator` at depth zero, ignoring separators inside strings or brackets. */
function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = []
  let current = ''
  let quote: string | null = null
  let depth = 0
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quote) {
      current += char
      if (char === '\\' && quote === '"') {
        current += text[i + 1] ?? ''
        i++
      } else if (char === quote) {
        quote = null
      }
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      current += char
    } else if (char === '[' || char === '{') {
      depth++
      current += char
    } else if (char === ']' || char === '}') {
      depth--
      current += char
    } else if (char === separator && depth === 0) {
      parts.push(current)
      current = ''
    } else {
      current += char
    }
  }
  parts.push(current)
  return parts
}

function unescapeBasic(text: string): string {
  return text.replace(/\\(u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|.)/g, (_, escape: string) => {
    switch (escape[0]) {
      case 'n':
        return '\n'
      case 't':
        return '\t'
      case 'r':
        return '\r'
      case 'b':
        return '\b'
      case 'f':
        return '\f'
      case '"':
        return '"'
      case '\\':
        return '\\'
      case 'u':
      case 'U':
        return String.fromCodePoint(parseInt(escape.slice(1), 16))
      default:
        return escape
    }
  })
}

function parseKeyPath(text: string): string[] {
  return splitTopLevel(text, '.').map((part) => {
    const key = part.trim()
    if (!key) throw new TomlError('A key is empty.')
    if (key.startsWith('"')) {
      if (!key.endsWith('"') || key.length < 2) throw new TomlError(`Malformed quoted key ${key}.`)
      return unescapeBasic(key.slice(1, -1))
    }
    if (key.startsWith("'")) {
      if (!key.endsWith("'") || key.length < 2) throw new TomlError(`Malformed quoted key ${key}.`)
      return key.slice(1, -1)
    }
    return key
  })
}

function parseValue(text: string): TomlValue {
  const value = text.trim()
  if (!value) throw new TomlError('A value is missing.')

  if (value.startsWith('"')) {
    if (!value.endsWith('"') || value.length < 2) throw new TomlError(`Unterminated string ${value}.`)
    return unescapeBasic(value.slice(1, -1))
  }
  if (value.startsWith("'")) {
    if (!value.endsWith("'") || value.length < 2) throw new TomlError(`Unterminated literal string ${value}.`)
    return value.slice(1, -1)
  }
  if (value.startsWith('[')) {
    if (!value.endsWith(']')) throw new TomlError(`Unterminated array ${value}.`)
    const inner = value.slice(1, -1).trim()
    if (!inner) return []
    const items = splitTopLevel(inner, ',')
      .map((item) => item.trim())
      .filter((item) => item !== '')
    return items.map(parseValue)
  }
  if (value.startsWith('{')) {
    if (!value.endsWith('}')) throw new TomlError(`Unterminated inline table ${value}.`)
    const inner = value.slice(1, -1).trim()
    const table: { [key: string]: TomlValue } = {}
    if (inner) {
      for (const entry of splitTopLevel(inner, ',').map((item) => item.trim()).filter(Boolean)) {
        const eq = findEquals(entry)
        if (eq < 0) throw new TomlError(`Inline table entry "${entry}" has no "=".`)
        setValue(table, parseKeyPath(entry.slice(0, eq)), parseValue(entry.slice(eq + 1)))
      }
    }
    return table
  }
  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'inf' || value === '+inf') return Infinity
  if (value === '-inf') return -Infinity
  if (value === 'nan' || value === '+nan' || value === '-nan') return NaN

  if (/^[+-]?0[xob][0-9a-fA-F_]+$/.test(value)) {
    const sign = value.startsWith('-') ? -1 : 1
    const body = value.replace(/^[+-]/, '').replace(/_/g, '')
    return sign * Number(body)
  }
  if (/^[+-]?\d[\d_]*$/.test(value)) return Number(value.replace(/_/g, ''))
  if (/^[+-]?\d[\d_]*\.\d[\d_]*([eE][+-]?\d+)?$/.test(value) || /^[+-]?\d[\d_]*[eE][+-]?\d+$/.test(value)) {
    return Number(value.replace(/_/g, ''))
  }
  if (DATETIME_RE.test(value)) return value

  throw new TomlError(`Could not read the value ${value}.`)
}

function isPlainObject(value: unknown): value is { [key: string]: TomlValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function descend(table: { [key: string]: TomlValue }, key: string): { [key: string]: TomlValue } {
  const existing = table[key]
  if (existing === undefined) {
    const created: { [key: string]: TomlValue } = {}
    table[key] = created
    return created
  }
  // A sub-table under an array-of-tables names the most recent element.
  if (Array.isArray(existing)) {
    const last = existing[existing.length - 1]
    if (isPlainObject(last)) return last
    throw new TomlError(`"${key}" is an array, not a table.`)
  }
  if (!isPlainObject(existing)) throw new TomlError(`"${key}" is already a value, not a table.`)
  return existing
}

function setValue(table: { [key: string]: TomlValue }, path: string[], value: TomlValue): void {
  const final = path[path.length - 1]
  let target = table
  for (let i = 0; i < path.length - 1; i++) target = descend(target, path[i])
  if (final in target) throw new TomlError(`Key "${path.join('.')}" is defined more than once.`)
  target[final] = value
}

function makeTable(root: { [key: string]: TomlValue }, path: string[]): { [key: string]: TomlValue } {
  let target = root
  for (const key of path) target = descend(target, key)
  return target
}

function makeArrayTable(root: { [key: string]: TomlValue }, path: string[]): { [key: string]: TomlValue } {
  const final = path[path.length - 1]
  let parent = root
  for (let i = 0; i < path.length - 1; i++) parent = descend(parent, path[i])
  const existing = parent[final]
  const element: { [key: string]: TomlValue } = {}
  if (existing === undefined) parent[final] = [element]
  else if (Array.isArray(existing)) existing.push(element)
  else throw new TomlError(`"${final}" is already a table, not an array of tables.`)
  return element
}

/** Parse a TOML document into a JSON-shaped object. */
export function parseToml(text: string): Record<string, unknown> {
  const root: { [key: string]: TomlValue } = {}
  const lines = text.split(/\r?\n/)
  let current = root

  for (let i = 0; i < lines.length; i++) {
    const line = stripComment(lines[i]).trim()
    if (!line) continue
    if (line.includes('"""') || line.includes("'''")) {
      throw new TomlError(`Line ${i + 1}: multi-line strings are not supported.`)
    }

    if (line.startsWith('[[')) {
      if (!line.endsWith(']]')) throw new TomlError(`Line ${i + 1}: malformed array-of-tables header.`)
      current = makeArrayTable(root, parseKeyPath(line.slice(2, -2).trim()))
      continue
    }
    if (line.startsWith('[')) {
      if (!line.endsWith(']')) throw new TomlError(`Line ${i + 1}: malformed table header.`)
      current = makeTable(root, parseKeyPath(line.slice(1, -1).trim()))
      continue
    }

    const eq = findEquals(line)
    if (eq < 0) throw new TomlError(`Line ${i + 1}: expected "key = value".`)
    setValue(current, parseKeyPath(line.slice(0, eq)), parseValue(line.slice(eq + 1)))
  }

  return root as Record<string, unknown>
}

/* -------------------------------------------------------------------------
   JSON -> TOML
   ------------------------------------------------------------------------- */

const BARE_KEY = /^[A-Za-z0-9_-]+$/

function quoteKey(key: string): string {
  return BARE_KEY.test(key) ? key : `"${key.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function formatString(value: string): string {
  return `"${value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r')}"`
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return formatString(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'nan'
    if (value === Infinity) return 'inf'
    if (value === -Infinity) return '-inf'
    return String(value)
  }
  if (Array.isArray(value)) return `[${value.map(formatValue).join(', ')}]`
  throw new TomlError('Only strings, numbers, booleans and arrays can be TOML values.')
}

function emitTable(
  out: string[],
  table: { [key: string]: unknown },
  path: string[],
  headerPrinted: boolean,
): void {
  if (!headerPrinted && path.length > 0) out.push(`[${path.map(quoteKey).join('.')}]`)

  const scalars: [string, unknown][] = []
  const childTables: [string, unknown][] = []
  const arrayTables: [string, { [key: string]: unknown }[]][] = []
  for (const [key, value] of Object.entries(table)) {
    if (Array.isArray(value) && value.length > 0 && value.every(isPlainObject)) {
      arrayTables.push([key, value as { [key: string]: unknown }[]])
    } else if (isPlainObject(value)) {
      childTables.push([key, value])
    } else {
      if (value === null) throw new TomlError(`TOML has no null; the key "${[...path, key].join('.')}" is null.`)
      scalars.push([key, value])
    }
  }

  for (const [key, value] of scalars) out.push(`${quoteKey(key)} = ${formatValue(value)}`)
  for (const [key, value] of childTables) {
    out.push('')
    emitTable(out, value as { [key: string]: unknown }, [...path, key], false)
  }
  for (const [key, items] of arrayTables) {
    for (const item of items) {
      out.push('')
      out.push(`[[${[...path, key].map(quoteKey).join('.')}]]`)
      emitTable(out, item, [...path, key], true)
    }
  }
}

/** Serialise a JSON object as TOML. */
export function toToml(value: unknown): string {
  if (!isPlainObject(value)) throw new TomlError('The top level must be a JSON object.')
  const out: string[] = []
  emitTable(out, value as { [key: string]: unknown }, [], false)
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}
