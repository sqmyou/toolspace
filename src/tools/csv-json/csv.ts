/** CSV parsing and JSON conversion, including delimiter sniffing. */

export type Delimiter = ',' | ';' | '\t' | '|'

export function detectDelimiter(input: string): Delimiter {
  const sample = input.split(/\r?\n/).slice(0, 5).join('\n')
  const candidates: Delimiter[] = [',', ';', '\t', '|']
  let best: Delimiter = ','
  let bestScore = -1
  for (const delimiter of candidates) {
    // A delimiter that never appears still "parses" as one wide column, which
    // would outscore a real comma file that merely has a ragged row. Skip it.
    if (!sample.includes(delimiter)) continue
    const rows = parseCsv(sample, delimiter)
    if (rows.length === 0) continue
    const widths = rows.map((row) => row.length)
    const consistent = widths.every((width) => width === widths[0])
    const score = consistent ? widths[0] : 0
    if (score > bestScore) {
      bestScore = score
      best = delimiter
    }
  }
  return best
}

/** RFC 4180-ish parser: quoted fields, escaped quotes, embedded newlines. */
export function parseCsv(input: string, delimiter: Delimiter = ','): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let started = false

  for (let i = 0; i < input.length; i++) {
    const char = input[i]

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"' && field === '') {
      inQuotes = true
      started = true
    } else if (char === delimiter) {
      row.push(field)
      field = ''
      started = true
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      started = false
    } else if (char === '\r') {
      // Swallow CR; the following LF ends the row.
    } else {
      field += char
      started = true
    }
  }

  if (started || field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // Drop a trailing blank row produced by a final newline.
  return rows.filter((cells, index) => !(index === rows.length - 1 && cells.length === 1 && cells[0] === ''))
}

export interface CsvToJsonOptions {
  delimiter?: Delimiter
  hasHeader?: boolean
}

export function csvToJson(input: string, options: CsvToJsonOptions = {}): Record<string, string>[] | string[][] {
  const delimiter = options.delimiter ?? detectDelimiter(input)
  const rows = parseCsv(input, delimiter)
  if (rows.length === 0) return []

  if (options.hasHeader === false) return rows

  const [header, ...body] = rows
  return body.map((cells) => {
    const record: Record<string, string> = {}
    header.forEach((key, index) => {
      const name = key || `column_${index + 1}`
      record[name] = cells[index] ?? ''
    })
    return record
  })
}

function quote(value: string, delimiter: Delimiter): string {
  return value.includes(delimiter) || /["\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function jsonToCsv(input: string, delimiter: Delimiter = ','): { csv: string; error?: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch (err) {
    return { csv: '', error: err instanceof Error ? err.message : 'Invalid JSON' }
  }

  if (Array.isArray(parsed) && parsed.every((item) => !Array.isArray(item) && typeof item !== 'object')) {
    return { csv: (parsed as unknown[]).map((value) => quote(cellToString(value), delimiter)).join('\n') }
  }

  if (!Array.isArray(parsed)) {
    if (typeof parsed === 'object' && parsed !== null) {
      const entries = Object.entries(parsed as Record<string, unknown>)
      const lines = ['key' + delimiter + 'value']
      for (const [key, value] of entries) lines.push(`${quote(key, delimiter)}${delimiter}${quote(cellToString(value), delimiter)}`)
      return { csv: lines.join('\n') }
    }
    return { csv: '', error: 'JSON must be an array of objects, an array of values, or an object' }
  }

  const objects = parsed as Record<string, unknown>[]
  const headers = [...new Set(objects.flatMap((item) => (item && typeof item === 'object' ? Object.keys(item) : [])))]
  if (headers.length === 0) return { csv: '' }

  const lines = [headers.map((header) => quote(header, delimiter)).join(delimiter)]
  for (const item of objects) {
    lines.push(headers.map((header) => quote(cellToString(item?.[header]), delimiter)).join(delimiter))
  }
  return { csv: lines.join('\n') }
}

/* -------------------------------------------------------------------------
   CSV <-> Markdown table
   ------------------------------------------------------------------------- */

/** Escape the characters that would break a Markdown table cell. */
function mdCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}

export interface CsvToMarkdownOptions {
  delimiter?: Delimiter
  hasHeader?: boolean
}

/** Render CSV (or TSV) as a Markdown table. */
export function csvToMarkdown(input: string, options: CsvToMarkdownOptions = {}): string {
  const delimiter = options.delimiter ?? detectDelimiter(input)
  const rows = parseCsv(input, delimiter)
  if (rows.length === 0) return ''

  const hasHeader = options.hasHeader ?? true
  const width = Math.max(...rows.map((row) => row.length))
  const heading = hasHeader ? rows[0] : Array.from({ length: width }, (_, i) => `Column ${i + 1}`)
  const body = hasHeader ? rows.slice(1) : rows

  const line = (cells: string[]) => `| ${Array.from({ length: width }, (_, i) => mdCell(cells[i] ?? '')).join(' | ')} |`
  const separator = `| ${Array.from({ length: width }, () => '---').join(' | ')} |`

  return [line(heading), separator, ...body.map(line)].join('\n')
}

/** Split a Markdown table row on unescaped pipes. */
function splitMarkdownRow(row: string): string[] {
  let text = row.trim()
  if (text.startsWith('|')) text = text.slice(1)
  if (text.endsWith('|')) text = text.slice(0, -1)

  const cells: string[] = []
  let current = ''
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '\\' && text[i + 1] === '|') {
      current += '|'
      i++
    } else if (char === '|') {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current.trim())
  return cells
}

export interface MarkdownToCsvResult {
  csv: string
  error?: string
}

/** Convert a Markdown table back to CSV. */
export function markdownToCsv(input: string, delimiter: Delimiter = ','): MarkdownToCsvResult {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') || line.endsWith('|'))
  if (lines.length === 0) return { csv: '', error: 'No Markdown table rows found (a row starts or ends with "|").' }

  const isSeparator = (row: string) => row.split('|').every((cell) => /^[\s:=-]*$/.test(cell))
  const rows = lines.map(splitMarkdownRow).filter((_, index) => !(index === 1 && isSeparator(lines[index])))
  if (rows.length === 0) return { csv: '', error: 'The table has no rows.' }

  const csv = rows
    .map((cells) => cells.map((cell) => quote(cell.replace(/<br\s*\/?>/gi, '\n'), delimiter)).join(delimiter))
    .join('\n')
  return { csv }
}
