/**
 * Unified diff: build one from two texts, and apply one to a text.
 *
 * Both directions are implemented here rather than one, because they share the
 * same line model and because a patch tool that cannot show you the diff it is
 * about to apply is hard to trust.
 *
 * The builder uses the classic LCS/Myers-style dynamic program. It is O(n·m)
 * in memory, which is fine for the hand-sized files this tool targets and keeps
 * the algorithm short enough to check by eye. The applier locates each hunk by
 * its context, tolerates the usual `\ No newline at end of file` marker, and
 * reports a line number when it fails — a silent bad patch is worse than an
 * error.
 */

export class DiffError extends Error {}

export type LineOp = 'context' | 'add' | 'remove'

export interface DiffLine {
  op: LineOp
  text: string
}

export interface Hunk {
  /** 1-based start line in the old file. */
  oldStart: number
  oldCount: number
  /** 1-based start line in the new file. */
  newStart: number
  newCount: number
  lines: DiffLine[]
}

export interface Patch {
  oldPath: string
  newPath: string
  hunks: Hunk[]
  /**
   * Whether the patched result should end with a newline. `true`/`false` when
   * the patch was built here; `undefined` when parsed from text with no
   * `\ No newline at end of file` marker, in which case the source's own
   * ending is kept.
   */
  finalNewline?: boolean
}

/* -------------------------------------------------------------------------
   Building
   ------------------------------------------------------------------------- */

const CONTEXT = 3

/**
 * Longest common subsequence of two line arrays, as index pairs.
 * Ties prefer the earlier old line, which keeps output stable.
 */
function lcs(a: string[], b: string[]): Array<[number, number]> {
  const n = a.length
  const m = b.length
  const table: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }
  const pairs: Array<[number, number]> = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pairs.push([i, j])
      i++
      j++
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      i++
    } else {
      j++
    }
  }
  return pairs
}

/** Split into lines, tracking whether the text ended with a newline. */
function splitLines(text: string): { lines: string[]; finalNewline: boolean } {
  if (text === '') return { lines: [], finalNewline: true }
  const finalNewline = text.endsWith('\n')
  const body = finalNewline ? text.slice(0, -1) : text
  return { lines: body.split('\n'), finalNewline }
}

function lineOps(before: string[], after: string[]): DiffLine[] {
  const common = lcs(before, after)
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  for (const [ai, bj] of common) {
    while (i < ai) out.push({ op: 'remove', text: before[i++] })
    while (j < bj) out.push({ op: 'add', text: after[j++] })
    out.push({ op: 'context', text: before[i] })
    i++
    j++
  }
  while (i < before.length) out.push({ op: 'remove', text: before[i++] })
  while (j < after.length) out.push({ op: 'add', text: after[j++] })
  return out
}

/** Group an op list into hunks with `CONTEXT` lines of surrounding context. */
function toHunks(ops: DiffLine[]): Hunk[] {
  const changed = ops.map((line) => line.op !== 'context')
  const hunks: Hunk[] = []
  let index = 0
  while (index < ops.length) {
    if (!changed[index]) {
      index++
      continue
    }
    // Grow to include context, then extend over nearby changes.
    let start = Math.max(0, index - CONTEXT)
    let end = index
    while (end < ops.length) {
      if (changed[end]) {
        end = Math.min(ops.length, end + 1 + CONTEXT)
        continue
      }
      // A run of context shorter than 2*CONTEXT merges the two changes.
      let next = end
      while (next < ops.length && !changed[next]) next++
      if (next < ops.length && next - end <= CONTEXT * 2) {
        end = next + 1
        continue
      }
      break
    }
    const slice = ops.slice(start, end)
    let oldStart = 1
    let newStart = 1
    for (let k = 0; k < start; k++) {
      if (ops[k].op !== 'add') oldStart++
      if (ops[k].op !== 'remove') newStart++
    }
    const oldCount = slice.filter((line) => line.op !== 'add').length
    const newCount = slice.filter((line) => line.op !== 'remove').length
    hunks.push({ oldStart, oldCount, newStart, newCount, lines: slice })
    index = end
  }
  return hunks
}

/** Build a unified patch between two texts. */
export function buildPatch(
  before: string,
  after: string,
  oldPath = 'a.txt',
  newPath = 'b.txt',
): Patch {
  const oldSide = splitLines(before)
  const newSide = splitLines(after)
  const stem = (lines: string[], isNew: boolean) => {
    if (lines.length === 0) return lines
    const last = lines[lines.length - 1]
    // Drop a final blank that exists only because the text ends with a newline,
    // so the hunk counts match the patched file. A trailing blank-less file
    // must also record where it ends, otherwise the count is off by one.
    if (last === '' && (isNew ? newSide.finalNewline : oldSide.finalNewline)) return lines.slice(0, -1)
    return lines
  }
  const beforeLines = stem(oldSide.lines, false)
  const afterLines = stem(newSide.lines, true)
  return {
    oldPath,
    newPath,
    hunks: toHunks(lineOps(beforeLines, afterLines)),
    finalNewline: newSide.finalNewline,
  }
}

const NO_NEWLINE = '\\ No newline at end of file'

/** Render a patch in the usual unified format. */
export function formatPatch(patch: Patch): string {
  const out = [`--- ${patch.oldPath}`, `+++ ${patch.newPath}`]
  for (const hunk of patch.hunks) {
    out.push(`@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`)
    for (const line of hunk.lines) {
      const prefix = line.op === 'add' ? '+' : line.op === 'remove' ? '-' : ' '
      out.push(`${prefix}${line.text}`)
    }
  }
  if (patch.finalNewline === false) out.push(NO_NEWLINE)
  return `${out.join('\n')}\n`
}

/* -------------------------------------------------------------------------
   Applying
   ------------------------------------------------------------------------- */

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/

/** Parse a unified patch. Returns the hunks plus any `\ No newline` markers. */
export function parsePatch(text: string): Patch {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let oldPath = 'a.txt'
  let newPath = 'b.txt'
  // In the unified format the marker is only present when the new file lacks a
  // trailing newline, so its absence means the file does end with one.
  let finalNewline = true
  const hunks: Hunk[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith(NO_NEWLINE)) {
      finalNewline = false
      i++
      continue
    }
    if (line.startsWith('--- ')) {
      oldPath = line.slice(4).split('\t')[0].trim() || oldPath
      i++
      continue
    }
    if (line.startsWith('+++ ')) {
      newPath = line.slice(4).split('\t')[0].trim() || newPath
      i++
      continue
    }
    const header = HUNK_HEADER.exec(line)
    if (!header) {
      if (line === '' || line.startsWith('diff ') || line.startsWith('index ')) {
        i++
        continue
      }
      throw new DiffError(`Line ${i + 1} is not a hunk header: "${line}".`)
    }
    const oldStart = Number(header[1])
    const oldCount = header[2] === undefined ? 1 : Number(header[2])
    const newStart = Number(header[3])
    const newCount = header[4] === undefined ? 1 : Number(header[4])
    i++
    const hunkLines: DiffLine[] = []
    let seenOld = 0
    let seenNew = 0
    if (oldCount === 0 && newCount === 0) {
      hunks.push({ oldStart, oldCount, newStart, newCount, lines: hunkLines })
      continue
    }
    // Read exactly the declared number of old and new lines. A trailing blank
    // line in the patch text is then never mistaken for hunk content.
    while (i < lines.length && (seenOld < oldCount || seenNew < newCount)) {
      const body = lines[i]
      if (body.startsWith(NO_NEWLINE)) {
        i++
        continue
      }
      if (body === '') {
        // Some transports strip the single-space prefix from an empty context
        // line; treat a bare blank as an empty context line.
        hunkLines.push({ op: 'context', text: '' })
        seenOld++
        seenNew++
        i++
        continue
      }
      const op: LineOp = body[0] === '+' ? 'add' : body[0] === '-' ? 'remove' : 'context'
      if (body[0] !== '+' && body[0] !== '-' && body[0] !== ' ') {
        throw new DiffError(`Line ${i + 1} in the hunk is not prefixed by " ", "+" or "-".`)
      }
      hunkLines.push({ op, text: body.slice(1) })
      if (op !== 'add') seenOld++
      if (op !== 'remove') seenNew++
      i++
    }
    const countedOld = hunkLines.filter((line) => line.op !== 'add').length
    const countedNew = hunkLines.filter((line) => line.op !== 'remove').length
    if (countedOld !== oldCount || countedNew !== newCount) {
      throw new DiffError(
        `Hunk at line ${oldStart} says ${oldCount}/${newCount} lines but contains ${countedOld}/${countedNew}.`,
      )
    }
    hunks.push({ oldStart, oldCount, newStart, newCount, lines: hunkLines })
  }
  return { oldPath, newPath, hunks, finalNewline }
}

export interface ApplyResult {
  text: string
  /** Hunk headers applied, for a short report. */
  applied: string[]
}

/** Apply a parsed patch to `source`, or throw with the line number that failed. */
export function applyPatch(source: string, patch: Patch): ApplyResult {
  const { lines, finalNewline } = splitLines(source)
  const out: string[] = []
  let cursor = 0
  const applied: string[] = []

  for (const hunk of patch.hunks) {
    // Trust the header's old start, but fall back to a search when it has
    // drifted — a patch built against a slightly different file is common.
    let start = hunk.oldStart - 1
    if (!matchesAt(lines, hunk, start)) {
      const found = searchFor(lines, hunk, cursor)
      if (found === -1) {
        throw new DiffError(`Hunk @@ -${hunk.oldStart} does not match the source around line ${hunk.oldStart}.`)
      }
      start = found
    }
    if (start < cursor) throw new DiffError(`Hunk @@ -${hunk.oldStart} overlaps the previous hunk.`)
    out.push(...lines.slice(cursor, start))
    let at = start
    for (const line of hunk.lines) {
      if (line.op === 'context') {
        if (lines[at] !== line.text) {
          throw new DiffError(`Expected "${line.text}" at line ${at + 1} but found "${lines[at] ?? ''}".`)
        }
        out.push(line.text)
        at++
      } else if (line.op === 'remove') {
        if (lines[at] !== line.text) {
          throw new DiffError(`Expected to remove "${line.text}" at line ${at + 1} but found "${lines[at] ?? ''}".`)
        }
        at++
      } else {
        out.push(line.text)
      }
    }
    cursor = at
    applied.push(`@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`)
  }
  out.push(...lines.slice(cursor))
  // Fall back to the source's own ending only when the patch says nothing.
  const wantFinalNewline = patch.finalNewline ?? finalNewline
  const text = out.length === 0 ? '' : out.join('\n') + (wantFinalNewline ? '\n' : '')
  return { text, applied }
}

/** Does the hunk's context and removals sit exactly at `start`? */
function matchesAt(lines: string[], hunk: Hunk, start: number): boolean {
  if (start < 0) return false
  let at = start
  for (const line of hunk.lines) {
    if (line.op === 'add') continue
    if (lines[at] !== line.text) return false
    at++
  }
  return true
}

function searchFor(lines: string[], hunk: Hunk, from: number): number {
  for (let start = Math.max(0, from); start <= lines.length; start++) {
    if (matchesAt(lines, hunk, start)) return start
  }
  return -1
}
