/**
 * CSV ⇄ Markdown table.
 *
 * The CSV side follows RFC 4180: double-quoted fields may contain the
 * delimiter, newlines and doubled quotes. The Markdown side is GitHub-flavoured
 * pipe tables, including the alignment separator row.
 *
 * Two conversions need care. A cell that contains a newline has no way to stay
 * multi-line inside one Markdown row, so it becomes `<br>` on the way out and is
 * turned back on the way in. A literal `|` in a cell is escaped as `\|` so it
 * does not split the row.
 */

export class TableError extends Error {}

export type Delimiter = ',' | '\t' | ';' | '|'
export type Alignment = 'none' | 'left' | 'center' | 'right'

const DELIMITERS: Delimiter[] = [',', '\t', ';', '|']

/* -------------------------------------------------------------------------
   CSV
   ------------------------------------------------------------------------- */

/** Parse RFC 4180 CSV into rows of fields. */
export function parseCsv(text: string, delimiter: Delimiter = ','): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let started = false
  let i = 0

  const endField = () => {
    row.push(field)
    field = ''
    started = true
  }
  const endRow = () => {
    endField()
    rows.push(row)
    row = []
    started = false
  }

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
        i++
        continue
      }
      field += char
      i++
      continue
    }
    if (char === '"' && field === '') {
      inQuotes = true
      i++
      continue
    }
    if (char === delimiter) {
      endField()
      i++
      continue
    }
    if (char === '\r') {
      if (text[i + 1] === '\n') i++
      endRow()
      i++
      continue
    }
    if (char === '\n') {
      endRow()
      i++
      continue
    }
    field += char
    started = true
    i++
  }
  if (started || field !== '' || row.length > 0) endRow()
  return rows
}

/** Serialise rows as RFC 4180 CSV. */
export function toCsv(rows: string[][], delimiter: Delimiter = ','): string {
  const escape = (field: string): string => {
    if (field.includes(delimiter) || field.includes('"') || /[\n\r]/.test(field)) {
      return `"${field.replace(/"/g, '""')}"`
    }
    return field
  }
  return rows.map((row) => row.map(escape).join(delimiter)).join('\n')
}

/** Guess the delimiter from the first line, ignoring quoted runs. */
export function detectDelimiter(text: string): Delimiter {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  let best: Delimiter = ','
  let bestCount = 0
  for (const candidate of DELIMITERS) {
    let count = 0
    let inQuotes = false
    for (let i = 0; i < firstLine.length; i++) {
      const char = firstLine[i]
      if (char === '"') inQuotes = !inQuotes
      else if (!inQuotes && char === candidate) count++
    }
    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  }
  return best
}

/* -------------------------------------------------------------------------
   Markdown
   ------------------------------------------------------------------------- */

const SEPARATOR_CELL = /^:?-+:?$/

/** Escape a cell for a table row: pipes and newlines need encoding. */
function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}

function unescapeCell(value: string): string {
  return value.replace(/\\\|/g, '|').replace(/<br\s*\/?>/gi, '\n').trim()
}

/** Build a GitHub-flavoured Markdown table from rows. The first row is the header. */
export function toMarkdownTable(rows: string[][], alignments: Alignment[] = []): string {
  if (rows.length === 0) return ''
  const columns = Math.max(...rows.map((row) => row.length))
  const pad = (row: string[]): string[] => [...row, ...Array(columns - row.length).fill('')]

  const cells = rows.map((row) => pad(row).map((cell) => escapeCell(cell)))
  const widths = Array.from({ length: columns }, (_, c) =>
    Math.max(3, ...cells.map((row) => row[c].length)),
  )

  const format = (row: string[]): string => `| ${row.map((cell, c) => cell.padEnd(widths[c])).join(' | ')} |`
  const separator = Array.from({ length: columns }, (_, c) => {
    const alignment = alignments[c] ?? 'none'
    // The separator must be exactly `widths[c]` characters so the row lines up.
    if (alignment === 'left') return `:${'-'.repeat(widths[c] - 1)}`
    if (alignment === 'right') return `${'-'.repeat(widths[c] - 1)}:`
    if (alignment === 'center') return `:${'-'.repeat(widths[c] - 2)}:`
    return '-'.repeat(widths[c])
  })

  const lines = [format(cells[0]), `| ${separator.join(' | ')} |`]
  for (const row of cells.slice(1)) lines.push(format(row))
  return lines.join('\n')
}

/** Read a GitHub-flavoured Markdown table back into rows. */
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
