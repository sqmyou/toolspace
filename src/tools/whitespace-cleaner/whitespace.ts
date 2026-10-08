/**
 * Whitespace normalisation.
 *
 * Each rule is applied in a fixed, predictable order so the same input and
 * options always produce the same output: newline style, then per-line work,
 * then line-level filtering, then whole-document work.
 */

export interface CleanOptions {
  /** Convert CRLF/CR line endings to LF. */
  normalizeNewlines?: boolean
  /** Expand tab characters to spaces. */
  tabsToSpaces?: boolean
  tabWidth?: number
  /** Collapse runs of spaces and tabs inside a line. */
  collapseSpaces?: boolean
  /** Remove whitespace at the start and end of every line. */
  trimLines?: boolean
  /** Drop lines that are empty after trimming. */
  removeEmptyLines?: boolean
  /** Cap consecutive blank lines; 0 removes them all. */
  maxBlankLines?: number
  /** Join lines into a single paragraph. */
  joinLines?: boolean
  /** Trim leading and trailing whitespace from the whole document. */
  trimDocument?: boolean
}

export interface CleanResult {
  text: string
  linesBefore: number
  linesAfter: number
  charactersRemoved: number
}

export const DEFAULT_OPTIONS: Required<CleanOptions> = {
  normalizeNewlines: true,
  tabsToSpaces: false,
  tabWidth: 4,
  collapseSpaces: false,
  trimLines: true,
  removeEmptyLines: false,
  maxBlankLines: 1,
  joinLines: false,
  trimDocument: true,
}

export function clean(input: string, options: CleanOptions = {}): CleanResult {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const linesBefore = input === '' ? 0 : input.split(/\r\n|\r|\n/).length
  let text = input

  // Splitting lines loses the original terminator, so pick the one to rejoin
  // with up front. A mixed-ending file keeps whichever style it uses first.
  const detected = input.includes('\r\n') ? '\r\n' : input.includes('\r') ? '\r' : '\n'
  const eol = opts.normalizeNewlines ? '\n' : detected

  if (opts.tabsToSpaces) text = text.replace(/\t/g, ' '.repeat(Math.max(1, opts.tabWidth)))

  let lines = text.split(/\r\n|\r|\n/)

  if (opts.collapseSpaces) lines = lines.map((line) => line.replace(/[^\S\n]+/g, ' '))
  if (opts.trimLines) lines = lines.map((line) => line.trim())

  if (opts.removeEmptyLines) {
    lines = lines.filter((line) => line !== '')
  } else if (opts.maxBlankLines >= 0) {
    const limited: string[] = []
    let blanks = 0
    for (const line of lines) {
      if (line === '') {
        blanks += 1
        if (blanks > opts.maxBlankLines) continue
      } else {
        blanks = 0
      }
      limited.push(line)
    }
    lines = limited
  }

  text = opts.joinLines ? lines.filter((line) => line !== '').join(' ') : lines.join(eol)
  if (opts.trimDocument) text = text.trim()

  return {
    text,
    linesBefore,
    linesAfter: text === '' ? 0 : text.split(/\r\n|\r|\n/).length,
    charactersRemoved: input.length - text.length,
  }
}

/** A quick count of the whitespace problems a document contains. */
export interface WhitespaceIssues {
  trailingWhitespace: number
  leadingWhitespace: number
  tabs: number
  crlf: number
  multipleSpaces: number
  blankLines: number
}

export function inspect(input: string): WhitespaceIssues {
  const lines = input.split(/\r\n|\r|\n/)
  return {
    trailingWhitespace: lines.filter((line) => /[ \t]+$/.test(line)).length,
    leadingWhitespace: lines.filter((line) => /^[ \t]+/.test(line)).length,
    tabs: (input.match(/\t/g) ?? []).length,
    crlf: (input.match(/\r\n/g) ?? []).length,
    multipleSpaces: (input.match(/ {2,}/g) ?? []).length,
    blankLines: lines.filter((line) => line.trim() === '').length,
  }
}
