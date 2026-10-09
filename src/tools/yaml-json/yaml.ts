/**
 * YAML ⇄ JSON.
 *
 * A focused, dependency-free subset of YAML 1.2 aimed at the config files
 * people actually paste — GitHub Actions, docker-compose, Kubernetes, CI.
 * It covers block mappings and sequences, flow collections, quoted and plain
 * scalars, comments and both block scalar styles (`|` and `>`).
 *
 * Deliberately refused, with a clear error rather than a silent mis-parse:
 * anchors and aliases, tags, multiple documents, and merge keys. Those are
 * rare in the files this tool targets and each needs real semantics to be
 * correct.
 *
 * Scalar resolution follows the YAML 1.2 core schema, so `on`/`yes`/`no` stay
 * strings — only `true`/`false`/`null`/`~` are special.
 */

export class YamlError extends Error {}

export type YamlValue = string | number | boolean | null | YamlValue[] | { [key: string]: YamlValue }

interface State {
  lines: string[]
  i: number
}

const BOOL_TRUE = new Set(['true', 'True', 'TRUE'])
const BOOL_FALSE = new Set(['false', 'False', 'FALSE'])
const NULLS = new Set(['null', 'Null', 'NULL', '~', ''])
const INT_RE = /^[-+]?[0-9]+$/
const HEX_RE = /^0x[0-9a-fA-F]+$/
const OCT_RE = /^0o[0-7]+$/
const FLOAT_RE = /^[-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][-+]?[0-9]+)?$/

/* -------------------------------------------------------------------------
   Line helpers
   ------------------------------------------------------------------------- */

function indentOf(line: string): number {
  let i = 0
  while (i < line.length && line[i] === ' ') i++
  if (line[i] === '\t') throw new YamlError('Tabs cannot be used for indentation.')
  return i
}

function isSkippable(line: string): boolean {
  const t = line.trim()
  return t === '' || t.startsWith('#')
}

/** Remove a trailing comment, respecting quoted strings. */
function stripComment(line: string): string {
  let quote: string | null = null
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (quote) {
      if (quote === '"' && char === '\\') i++
      else if (char === quote) quote = null
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === '#' && (i === 0 || line[i - 1] === ' ')) {
      return line.slice(0, i)
    }
  }
  return line
}

/** The index of the key/value colon, or -1 if the line is not a mapping entry. */
function findKeyColon(text: string): number {
  let quote: string | null = null
  let depth = 0
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quote) {
      if (quote === '"' && char === '\\') i++
      else if (char === quote) quote = null
    } else if (char === '"' || char === "'") quote = char
    else if (char === '[' || char === '{') depth++
    else if (char === ']' || char === '}') depth--
    else if (char === ':' && depth === 0 && (i === text.length - 1 || text[i + 1] === ' ')) {
      return i
    }
  }
  return -1
}

function isMappingLine(text: string): boolean {
  const t = text.trim()
  if (t.startsWith('{') || t.startsWith('[')) return false
  return findKeyColon(t) !== -1
}

function skip(state: State): void {
  while (state.i < state.lines.length && isSkippable(state.lines[state.i])) state.i++
}

/* -------------------------------------------------------------------------
   Scalars
   ------------------------------------------------------------------------- */

function readDoubleQuoted(text: string): { value: string; used: number } {
  let out = ''
  for (let i = 1; i < text.length; i++) {
    const char = text[i]
    if (char === '\\') {
      const next = text[++i]
      switch (next) {
        case 'n': out += '\n'; break
        case 't': out += '\t'; break
        case 'r': out += '\r'; break
        case '0': out += '\0'; break
        case '"': out += '"'; break
        case '\\': out += '\\'; break
        case '/': out += '/'; break
        case 'u': {
          const hex = text.slice(i + 1, i + 5)
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new YamlError('Invalid \\u escape in a double-quoted string.')
          out += String.fromCharCode(parseInt(hex, 16))
          i += 4
          break
        }
        default: throw new YamlError(`Unknown escape "\\${next}" in a double-quoted string.`)
      }
    } else if (char === '"') {
      return { value: out, used: i + 1 }
    } else {
      out += char
    }
  }
  throw new YamlError('Unterminated double-quoted string.')
}

function readSingleQuoted(text: string): { value: string; used: number } {
  let out = ''
  for (let i = 1; i < text.length; i++) {
    const char = text[i]
    if (char === "'") {
      if (text[i + 1] === "'") {
        out += "'"
        i++
      } else {
        return { value: out, used: i + 1 }
      }
    } else {
      out += char
    }
  }
  throw new YamlError('Unterminated single-quoted string.')
}

function resolvePlain(text: string): YamlValue {
  if (NULLS.has(text)) return null
  if (BOOL_TRUE.has(text)) return true
  if (BOOL_FALSE.has(text)) return false
  if (INT_RE.test(text)) return Number.parseInt(text, 10)
  if (HEX_RE.test(text)) return Number.parseInt(text, 16)
  if (OCT_RE.test(text)) return Number.parseInt(text.slice(2), 8)
  if (FLOAT_RE.test(text) && /[.eE]/.test(text)) return Number.parseFloat(text)
  return text
}

function parseScalar(text: string): YamlValue {
  const t = text.trim()
  if (t.startsWith('"')) {
    const { value, used } = readDoubleQuoted(t)
    if (t.slice(used).trim() !== '') throw new YamlError('Unexpected text after a quoted string.')
    return value
  }
  if (t.startsWith("'")) {
    const { value, used } = readSingleQuoted(t)
    if (t.slice(used).trim() !== '') throw new YamlError('Unexpected text after a quoted string.')
    return value
  }
  return resolvePlain(t)
}

/* -------------------------------------------------------------------------
   Flow collections
   ------------------------------------------------------------------------- */

function skipSpace(text: string, i: number): number {
  while (i < text.length && (text[i] === ' ' || text[i] === '\t')) i++
  return i
}

function flowValue(text: string, i: number): { value: YamlValue; i: number } {
  i = skipSpace(text, i)
  if (text[i] === '[') return flowSequence(text, i)
  if (text[i] === '{') return flowMapping(text, i)
  // A flow scalar runs to the next top-level delimiter.
  let quote: string | null = null
  const start = i
  for (; i < text.length; i++) {
    const char = text[i]
    if (quote) {
      if (quote === '"' && char === '\\') i++
      else if (char === quote) quote = null
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === ',' || char === ']' || char === '}') {
      break
    }
  }
  return { value: parseScalar(text.slice(start, i)), i }
}

function flowSequence(text: string, i: number): { value: YamlValue[]; i: number } {
  const out: YamlValue[] = []
  i = skipSpace(text, i + 1)
  if (text[i] === ']') return { value: out, i: i + 1 }
  for (;;) {
    const step = flowValue(text, i)
    out.push(step.value)
    i = skipSpace(text, step.i)
    if (text[i] === ',') {
      i = skipSpace(text, i + 1)
      continue
    }
    if (text[i] === ']') return { value: out, i: i + 1 }
    throw new YamlError('Malformed flow sequence: expected "," or "]".')
  }
}

function flowMapping(text: string, i: number): { value: { [key: string]: YamlValue }; i: number } {
  const out: { [key: string]: YamlValue } = {}
  i = skipSpace(text, i + 1)
  if (text[i] === '}') return { value: out, i: i + 1 }
  for (;;) {
    const keyStep = flowKey(text, i)
    const key = String(parseScalar(keyStep.text))
    i = skipSpace(text, keyStep.i)
    if (text[i] !== ':') throw new YamlError('Malformed flow mapping: expected ":".')
    const valueStep = flowValue(text, i + 1)
    out[key] = valueStep.value
    i = skipSpace(text, valueStep.i)
    if (text[i] === ',') {
      i = skipSpace(text, i + 1)
      continue
    }
    if (text[i] === '}') return { value: out, i: i + 1 }
    throw new YamlError('Malformed flow mapping: expected "," or "}".')
  }
}

/** In a flow mapping a key runs to the first top-level `:`, not to a comma. */
function flowKey(text: string, i: number): { text: string; i: number } {
  i = skipSpace(text, i)
  let quote: string | null = null
  const start = i
  for (; i < text.length; i++) {
    const char = text[i]
    if (quote) {
      if (quote === '"' && char === '\\') i++
      else if (char === quote) quote = null
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === ':') {
      break
    } else if (char === ',' || char === '}') {
      throw new YamlError('Malformed flow mapping: expected ":".')
    }
  }
  return { text: text.slice(start, i), i }
}

function parseInline(text: string): YamlValue {
  const t = text.trim()
  if (t.startsWith('[')) {
    const { value, i } = flowSequence(t, 0)
    if (skipSpace(t, i) !== t.length) throw new YamlError('Unexpected text after a flow sequence.')
    return value
  }
  if (t.startsWith('{')) {
    const { value, i } = flowMapping(t, 0)
    if (skipSpace(t, i) !== t.length) throw new YamlError('Unexpected text after a flow mapping.')
    return value
  }
  return parseScalar(t)
}

/* -------------------------------------------------------------------------
   Block structure
   ------------------------------------------------------------------------- */

function analyzeNext(state: State, indent: number): YamlValue | null {
  skip(state)
  if (state.i >= state.lines.length) return null
  const nextIndent = indentOf(state.lines[state.i])
  if (nextIndent <= indent) return null
  return parseNode(state, nextIndent)
}

function parseBlockScalar(state: State, parentIndent: number, header: string): string {
  const folded = header.startsWith('>')
  const chomp = header.includes('-') ? 'strip' : header.includes('+') ? 'keep' : 'clip'
  const collected: string[] = []
  let blockIndent = -1
  while (state.i < state.lines.length) {
    const line = state.lines[state.i]
    if (line.trim() === '') {
      collected.push('')
      state.i++
      continue
    }
    const ind = indentOf(line)
    if (ind <= parentIndent) break
    if (blockIndent === -1) blockIndent = ind
    collected.push(line.slice(Math.min(blockIndent, line.length)))
    state.i++
  }
  while (collected.length && collected[collected.length - 1] === '') collected.pop()

  let text: string
  if (folded) {
    const parts: string[] = []
    let blankRun = 0
    for (const line of collected) {
      if (line === '') {
        blankRun++
      } else if (blankRun > 0) {
        parts.push('\n'.repeat(blankRun))
        parts.push(line)
        blankRun = 0
      } else {
        parts.push(parts.length ? ` ${line}` : line)
      }
    }
    text = parts.join('')
  } else {
    text = collected.join('\n')
  }
  if (chomp === 'strip') return text
  return `${text}\n`
}

function parseMapping(state: State, indent: number): { [key: string]: YamlValue } {
  const out: { [key: string]: YamlValue } = {}
  for (;;) {
    skip(state)
    if (state.i >= state.lines.length) break
    const line = state.lines[state.i]
    const ind = indentOf(line)
    if (ind < indent) break
    const content = stripComment(line).trim()
    if (content === '') {
      state.i++
      continue
    }
    if (ind > indent) throw new YamlError(`Unexpected indentation on line ${state.i + 1}.`)
    if (content === '---' || content === '...') throw new YamlError('Multiple YAML documents are not supported.')
    if (content.startsWith('- ') || content === '-') break
    const colon = findKeyColon(content)
    if (colon === -1) throw new YamlError(`Expected "key: value" on line ${state.i + 1}.`)
    const key = parseKey(content.slice(0, colon).trim())
    const rest = content.slice(colon + 1).trim()
    state.i++
    if (rest === '') {
      out[key] = analyzeNext(state, indent) ?? null
    } else if (rest.startsWith('|') || rest.startsWith('>')) {
      out[key] = parseBlockScalar(state, indent, rest)
    } else {
      out[key] = parseInline(rest)
    }
  }
  return out
}

function parseSequence(state: State, indent: number): YamlValue[] {
  const out: YamlValue[] = []
  for (;;) {
    skip(state)
    if (state.i >= state.lines.length) break
    const line = state.lines[state.i]
    const ind = indentOf(line)
    if (ind < indent) break
    const content = stripComment(line).trim()
    if (!content.startsWith('-')) break
    if (ind > indent) throw new YamlError(`Unexpected indentation on line ${state.i + 1}.`)
    let after = content.slice(1)
    if (after.startsWith(' ')) after = after.slice(1)
    if (after === '') {
      state.i++
      out.push(analyzeNext(state, indent) ?? null)
      continue
    }
    if (isMappingLine(after)) {
      // "- key: value" is a mapping whose first entry shares the dash line.
      // Rewrite the dash away and parse it as a mapping one level in.
      const childIndent = indent + 2
      state.lines[state.i] = ' '.repeat(childIndent) + after
      out.push(parseMapping(state, childIndent))
      continue
    }
    state.i++
    out.push(parseInline(after))
  }
  return out
}

function parseKey(text: string): string {
  if (text.startsWith('"') || text.startsWith("'")) return String(parseScalar(text))
  return text
}

function parseNode(state: State, indent: number): YamlValue {
  const content = stripComment(state.lines[state.i]).trim()
  if (content === '-' || content.startsWith('- ')) return parseSequence(state, indent)
  if (isMappingLine(content)) return parseMapping(state, indent)
  state.i++
  return parseScalar(content)
}

/** Parse a single YAML document into plain JS values. */
export function parseYaml(text: string): YamlValue {
  const body = text.replace(/^\uFEFF/, '')
  if (/^\s*%/.test(body)) throw new YamlError('Directives are not supported.')
  const state: State = { lines: body.split(/\r?\n/), i: 0 }
  skip(state)
  if (state.i < state.lines.length && state.lines[state.i].trim() === '---') {
    state.i++
    skip(state)
  }
  if (state.i >= state.lines.length) return null
  const value = parseNode(state, indentOf(state.lines[state.i]))
  skip(state)
  if (state.i < state.lines.length) {
    const rest = state.lines[state.i].trim()
    if (rest === '...') {
      state.i++
      skip(state)
    }
    if (state.i < state.lines.length) {
      throw new YamlError('Multiple YAML documents are not supported.')
    }
  }
  return value
}

/* -------------------------------------------------------------------------
   Emitting
   ------------------------------------------------------------------------- */

function isMap(value: YamlValue): value is { [key: string]: YamlValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Plain scalars are unquoted; anything ambiguous is double-quoted. */
function scalarToYaml(value: YamlValue): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return JSON.stringify(String(value))
    return String(value)
  }
  return quoteIfNeeded(typeof value === 'string' ? value : String(value))
}

const PLAIN_SAFE = /^[A-Za-z0-9_][A-Za-z0-9_\-./ ]*$/

function quoteIfNeeded(text: string): string {
  const ambiguous =
    text === '' ||
    text !== text.trim() ||
    NULLS.has(text) ||
    BOOL_TRUE.has(text) ||
    BOOL_FALSE.has(text) ||
    INT_RE.test(text) ||
    HEX_RE.test(text) ||
    OCT_RE.test(text) ||
    (FLOAT_RE.test(text) && /[.eE]/.test(text)) ||
    text.startsWith('- ') ||
    /^[-?:,[\]{}#&*!|>'"%@`]/.test(text) ||
    text.includes(': ') ||
    text.endsWith(':') ||
    / #/.test(text) ||
    /[\n\r\t]/.test(text)
  if (!ambiguous && PLAIN_SAFE.test(text)) return text
  return JSON.stringify(text)
}

function emitPair(key: string, value: YamlValue, indent: number): string[] {
  const pad = ' '.repeat(indent)
  const name = quoteIfNeeded(key)
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${pad}${name}: []`]
    return [`${pad}${name}:`, ...emitBlock(value, indent + 2)]
  }
  if (isMap(value)) {
    if (Object.keys(value).length === 0) return [`${pad}${name}: {}`]
    return [`${pad}${name}:`, ...emitBlock(value, indent + 2)]
  }
  return [`${pad}${name}: ${scalarToYaml(value)}`]
}

function emitBlock(value: YamlValue, indent: number): string[] {
  const pad = ' '.repeat(indent)
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${pad}[]`]
    const out: string[] = []
    for (const item of value) {
      if (isMap(item)) {
        const entries = Object.entries(item)
        if (entries.length === 0) {
          out.push(`${pad}- {}`)
          continue
        }
        const childIndent = indent + 2
        const [firstKey, firstValue] = entries[0]
        const first = emitPair(firstKey, firstValue, childIndent)
        out.push(`${pad}- ${first[0].slice(childIndent)}`)
        out.push(...first.slice(1))
        for (const [key, next] of entries.slice(1)) out.push(...emitPair(key, next, childIndent))
      } else if (Array.isArray(item)) {
        if (item.length === 0) {
          out.push(`${pad}- []`)
          continue
        }
        out.push(`${pad}-`)
        out.push(...emitBlock(item, indent + 2))
      } else {
        out.push(`${pad}- ${scalarToYaml(item)}`)
      }
    }
    return out
  }
  if (isMap(value)) {
    const entries = Object.entries(value)
    if (entries.length === 0) return [`${pad}{}`]
    const out: string[] = []
    for (const [key, next] of entries) out.push(...emitPair(key, next, indent))
    return out
  }
  return [`${pad}${scalarToYaml(value)}`]
}

/** Serialise plain JS values to block-style YAML. */
export function toYaml(value: unknown): string {
  return `${emitBlock(value as YamlValue, 0).join('\n')}\n`
}
