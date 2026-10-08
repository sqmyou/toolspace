/**
 * JSON ⇄ CSV conversion.
 *
 * Arrays of objects become rows. Nested objects and arrays are flattened to
 * dotted column names ("user.name"), and any column whose values are arrays
 * is joined with "; " so a row never spans multiple lines by accident.
 */

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

export interface CsvOptions {
  delimiter?: string
  /** Quote every field, not just the ones that need it. */
  quoteAll?: boolean
}

export interface JsonToCsvResult {
  csv: string
  columns: string[]
  rowCount: number
}

function flatten(value: JsonValue, prefix: string, into: Record<string, string>): void {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value)
    if (entries.length === 0) {
      into[prefix] = ''
      return
    }
    for (const [key, child] of entries) flatten(child, prefix ? `${prefix}.${key}` : key, into)
    return
  }
  if (Array.isArray(value)) {
    into[prefix] = value.map((item) => (item !== null && typeof item === 'object' ? JSON.stringify(item) : String(item ?? ''))).join('; ')
    return
  }
  into[prefix] = value == null ? '' : String(value)
}

function escapeField(value: string, delimiter: string, quoteAll: boolean): string {
  const needsQuotes = quoteAll || value.includes(delimiter) || /["\n\r]/.test(value) || value !== value.trim()
  return needsQuotes ? `"${value.replace(/"/g, '""')}"` : value
}

/** Convert an array of objects to CSV. */
export function jsonToCsv(input: JsonValue, options: CsvOptions = {}): JsonToCsvResult {
  const delimiter = options.delimiter ?? ','
  const rows = Array.isArray(input) ? input : [input]

  const flatRows = rows.map((row) => {
    const flat: Record<string, string> = {}
    flatten(row, '', flat)
    return flat
  })

  const columns: string[] = []
  for (const row of flatRows) {
    for (const key of Object.keys(row)) if (!columns.includes(key)) columns.push(key)
  }

  const header = columns.map((column) => escapeField(column, delimiter, options.quoteAll ?? false)).join(delimiter)
  const body = flatRows.map((row) => columns.map((column) => escapeField(row[column] ?? '', delimiter, options.quoteAll ?? false)).join(delimiter))

  return {
    csv: [header, ...body].filter((line, index) => index === 0 || line.length > 0).join('\n'),
    columns,
    rowCount: flatRows.length,
  }
}

/** Parse CSV text into rows of strings, honouring quoted fields. */
export function parseCsv(text: string, delimiter = ','): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
      } else {
        field += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === delimiter) {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char !== '\r') {
      field += char
    }
    i += 1
  }

  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

function coerce(value: string): JsonValue {
  const trimmed = value.trim()
  if (trimmed === '') return ''
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (trimmed === 'null') return null
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) return Number(trimmed)
  return value
}

/** Parse CSV into an array of objects, coercing obvious numbers and booleans. */
export function csvToJson(text: string, delimiter = ','): JsonValue[] {
  const rows = parseCsv(text, delimiter).filter((row) => row.some((cell) => cell.trim() !== ''))
  if (rows.length === 0) return []
  const [header, ...body] = rows
  return body.map((row) => {
    const record: Record<string, JsonValue> = {}
    header.forEach((column, index) => {
      record[column.trim()] = coerce(row[index] ?? '')
    })
    return record
  })
}
