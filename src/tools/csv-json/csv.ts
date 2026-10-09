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

export class TableError extends Error {}

export type Alignment = 'none' | 'left' | 'center' | 'right'

const SEPARATOR_CELL = /^:?-+:?$/

/** Escape a cell for a Markdown row: pipes and newlines need encoding. */
function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}

function unescapeCell(value: string): string {
  return value.replace(/\\\|/g, '|').replace(/<br\s*\/?>/gi, '\n').trim()
}

/** Serialise rows as RFC 4180 CSV. */
export function toCsv(rows: string[][], delimiter: Delimiter = ','): string {
  const escape = (field: string): string =>
    field.includes(delimiter) || field.includes('"') || /[\n\r]/.test(field)
      ? `"${field.replace(/"/g, '""')}"`
      : field
  return rows.map((row) => row.map(escape).join(delimiter)).join('\n')
}

/**
 * Render rows as a GitHub-flavoured Markdown table. The first row is the
 * header. Columns are padded to their widest cell so the raw Markdown lines up,
 * which also makes generated tables diff cleanly. `alignments` sets the `:--`
 * markers in the separator row.
 */
export function toMarkdownTable(rows: string[][], alignments: Alignment[] = []): string {
  if (rows.length === 0) return ''
  const columns = Math.max(...rows.map((row) => row.length))
  const pad = (row: string[]): string[] => [...row, ...Array(columns - row.length).fill('')]
  const cells = rows.map((row) => pad(row).map(escapeCell))
  const widths = Array.from({ length: columns }, (_, c) => Math.max(3, ...cells.map((row) => row[c].length)))

  const format = (row: string[]): string => `| ${row.map((cell, c) => cell.padEnd(widths[c])).join(' | ')} |`
  const separator = Array.from({ length: columns }, (_, c) => {
    const alignment = alignments[c] ?? 'none'
    // The separator must be exactly `widths[c]` characters so the row lines up.
    if (alignment === 'left') return `:${'-'.repeat(widths[c] - 1)}`
    if (alignment === 'right') return `${'-'.repeat(widths[c] - 1)}:`
    if (alignment === 'center') return `:${'-'.repeat(widths[c] - 2)}:`
    return '-'.repeat(widths[c])
  })

  return [format(cells[0]), `| ${separator.join(' | ')} |`, ...cells.slice(1).map(format)].join('\n')
}

export interface CsvToMarkdownOptions {
  delimiter?: Delimiter
  hasHeader?: boolean
  /** One alignment for every column, or a per-column list. */
  alignments?: Alignment[] | Alignment
}

/** Render CSV (or TSV) as a Markdown table. */
export function csvToMarkdown(input: string, options: CsvToMarkdownOptions = {}): string {
  const delimiter = options.delimiter ?? detectDelimiter(input)
  const rows = parseCsv(input, delimiter)
  if (rows.length === 0) return ''

  const table = options.hasHeader === false ? withPlaceholderHeader(rows) : rows
  const columns = Math.max(...table.map((row) => row.length))
  const alignments =
    typeof options.alignments === 'string'
      ? Array<Alignment>(columns).fill(options.alignments)
      : options.alignments
  return toMarkdownTable(table, alignments)
}

/** Prepend `Column 1..n` so a headerless CSV still becomes a valid table. */
function withPlaceholderHeader(rows: string[][]): string[][] {
  const width = Math.max(...rows.map((row) => row.length))
  return [Array.from({ length: width }, (_, i) => `Column ${i + 1}`), ...rows]
}

/** Read a GitHub-flavoured Markdown table back into rows. Throws on no table. */
export function fromMarkdownTable(markdown: string): string[][] {
  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes('|'))
  if (lines.length === 0) throw new TableError('No table rows found.')

  const splitRow = (line: string): string[] => {
    let body = line
    if (body.startsWith('|')) body = body.slice(1)
    if (body.endsWith('|') && !body.endsWith('\\|')) body = body.slice(0, -1)
    const out: string[] = []
    let field = ''
    for (let i = 0; i < body.length; i++) {
      const char = body[i]
      if (char === '\\' && body[i + 1] === '|') {
        field += '|'
        i++
        continue
      }
      if (char === '|') {
        out.push(field)
        field = ''
        continue
      }
      field += char
    }
    out.push(field)
    return out.map(unescapeCell)
  }

  const rows: string[][] = []
  let sawSeparator = false
  for (const line of lines) {
    const cells = splitRow(line)
    if (!sawSeparator && cells.length > 0 && cells.every((cell) => SEPARATOR_CELL.test(cell))) {
      sawSeparator = true
      continue
    }
    rows.push(cells)
  }
  if (rows.length === 0) throw new TableError('The table has a header but no rows.')
  const columns = Math.max(...rows.map((row) => row.length))
  return rows.map((row) => [...row, ...Array(columns - row.length).fill('')])
}

export interface MarkdownToCsvResult {
  csv: string
  error?: string
}

/** Convert a Markdown table back to CSV. */
export function markdownToCsv(input: string, delimiter: Delimiter = ','): MarkdownToCsvResult {
  try {
    return { csv: toCsv(fromMarkdownTable(input), delimiter) }
  } catch (err) {
    return { csv: '', error: err instanceof Error ? err.message : 'No table rows found.' }
  }
}
