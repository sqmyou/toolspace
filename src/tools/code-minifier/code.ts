/**
 * Pure helpers for the JS & CSS minifier / beautifier.
 *
 * Both languages are handled by small token scanners rather than full parsers,
 * on purpose: the tool must work on a fragment that may not be a whole valid
 * program, and the logic has to run in tests without a browser.
 *
 * The JS minifier is deliberately conservative. It strips comments and
 * redundant whitespace but never renames an identifier and never drops a
 * newline, because newlines are significant to the language (automatic
 * semicolon insertion). So it cannot change what the code does, at the cost of
 * not matching a bundler-grade minifier for size.
 */

export type CodeLanguage = 'javascript' | 'css'

const encoder = new TextEncoder()

function byteLength(text: string): number {
  return encoder.encode(text).length
}

export interface MinifyResult {
  output: string
  /** Bytes removed. Negative only if the input was already minimal. */
  saved: number
  before: number
  after: number
}

/* -------------------------------------------------------------------------- */
/* JavaScript                                                                  */
/* -------------------------------------------------------------------------- */

export interface JsToken {
  type: 'word' | 'number' | 'string' | 'regex' | 'punct' | 'comment'
  value: string
  /** The whitespace before this token contained a newline. */
  newlineBefore: boolean
}

/**
 * Keywords that may be followed by an expression, which is what decides
 * whether a `/` after them starts a regular expression or is division.
 */
const EXPRESSION_KEYWORDS = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'throw', 'case', 'do', 'else', 'yield', 'await',
])

/**
 * Splitting a run of characters only ever makes sense with braces or a
 * semicolon, where a newline cannot change parsing.
 */
const PUNCTUATOR_PATTERNS = [
  /^>>>=/, /^\.\.\./, /^===/, /^!==/, /^>>>/, /^\*\*=/, /^\*\*/, /^<<=/, /^>>=/,
  /^&&=/, /^\|\|=/, /^\?\?=/, /^\.\?/, /^\+=/, /^-=/, /^\*=/, /^\/=/, /^%=/,
  /^&=/, /^\|=/, /^\^=/, /^=>/, /^==/, /^!=/, /^<=/, /^>=/, /^\+\+/, /^--/,
  /^&&/, /^\|\|/, /^\?\?/, /^<</, /^>>/, /^[+\-*/%&|^~!?=<>,;:.(){}\[\]]/,
]

export function tokenizeJs(source: string): JsToken[] {
  const tokens: JsToken[] = []
  let i = 0
  let newlineBefore = false
  let previous: JsToken | null = null

  const regexAllowed = (): boolean => {
    if (!previous) return true
    if (previous.type === 'word') return EXPRESSION_KEYWORDS.has(previous.value)
    if (previous.type === 'punct') return ![')', ']', '}'].includes(previous.value)
    return false
  }

  while (i < source.length) {
    const char = source[i]

    if (char === ' ' || char === '\t' || char === '\r' || char === '\n') {
      if (char === '\n') newlineBefore = true
      i += 1
      continue
    }

    if (char === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i)
      const stop = end === -1 ? source.length : end
      tokens.push({ type: 'comment', value: source.slice(i, stop), newlineBefore })
      newlineBefore = false
      i = stop
      continue
    }

    if (char === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2)
      const stop = end === -1 ? source.length : end + 2
      const value = source.slice(i, stop)
      tokens.push({ type: 'comment', value, newlineBefore })
      // A newline inside a comment still separates the surrounding tokens.
      newlineBefore = value.includes('\n')
      i = stop
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      let j = i + 1
      while (j < source.length) {
        if (source[j] === '\\') {
          j += 2
          continue
        }
        if (source[j] === char) {
          j += 1
          break
        }
        if (char !== '`' && source[j] === '\n') break
        j += 1
      }
      previous = { type: 'string', value: source.slice(i, j), newlineBefore }
      tokens.push(previous)
      newlineBefore = false
      i = j
      continue
    }

    if (char === '/' && regexAllowed()) {
      let j = i + 1
      let inClass = false
      let closed = false
      while (j < source.length) {
        const c = source[j]
        if (c === '\\') {
          j += 2
          continue
        }
        if (c === '\n') break
        if (c === '[') inClass = true
        else if (c === ']') inClass = false
        else if (c === '/' && !inClass) {
          closed = true
          j += 1
          break
        }
        j += 1
      }
      if (closed) {
        while (j < source.length && /[a-z]/i.test(source[j])) j += 1
        previous = { type: 'regex', value: source.slice(i, j), newlineBefore }
        tokens.push(previous)
        newlineBefore = false
        i = j
        continue
      }
    }

    if (/\d/.test(char) || (char === '.' && /\d/.test(source[i + 1] ?? ''))) {
      const match = /^(?:0[xX][0-9a-fA-F]+n?|0[bB][01]+n?|0[oO][0-7]+n?|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?n?)/.exec(
        source.slice(i),
      )
      if (match) {
        previous = { type: 'number', value: match[0], newlineBefore }
        tokens.push(previous)
        newlineBefore = false
        i += match[0].length
        continue
      }
    }

    if (/[A-Za-z_$]/.test(char) || char.charCodeAt(0) > 127) {
      const match = /^[A-Za-z_$\u00a1-\uffff][\w$\u00a1-\uffff]*/.exec(source.slice(i))
      const value = match ? match[0] : char
      previous = { type: 'word', value, newlineBefore }
      tokens.push(previous)
      newlineBefore = false
      i += value.length
      continue
    }

    const punctuator = PUNCTUATOR_PATTERNS.map((pattern) => pattern.exec(source.slice(i))).find((m) => m !== null)
    previous = { type: 'punct', value: punctuator ? punctuator[0] : char, newlineBefore }
    tokens.push(previous)
    newlineBefore = false
    i += previous.value.length
  }

  return tokens
}

const MULTI_CHAR_PUNCTUATORS = new Set([
  '>>=', '...', '===', '!==', '>>>', '**=', '**', '<<=', '>>=', '&&=', '||=',
  '??=', '=>', '==', '!=', '<=', '>=', '++', '--', '&&', '||', '??', '<<', '>>',
])

const wordish = (token: JsToken): boolean => token.type === 'word' || token.type === 'number'

/**
 * Would concatenating these two tokens produce a different token? Only that
 * case needs a space. `( )` joining to `()` is not a token change, but `+` `+`
 * joining to `++` is, and two slashes would start a comment.
 */
export function needsSpaceBetween(a: JsToken, b: JsToken): boolean {
  if (wordish(a) && (wordish(b) || b.type === 'regex')) return true
  if (a.type === 'punct' && b.type === 'punct') {
    // Two punctuators that differ only in style may still merge: `+` and `+`.
    if (/[/*]$/.test(a.value) && /^[/*]/.test(b.value)) return true
    return MULTI_CHAR_PUNCTUATORS.has(a.value + b.value)
  }
  // A `/` immediately before a regex literal would swallow it as a comment.
  if (a.type === 'punct' && a.value.endsWith('/') && b.type === 'regex') return true
  return false
}

/**
 * Spacing for the beautifier, which is deliberately more generous than the
 * minifier's: it puts a space around binary operators and after keywords so the
 * output reads like formatted source rather than merely token-safe output.
 */
function beautifyNeedsSpace(a: JsToken, b: JsToken): boolean {
  if (a.type === 'comment' || b.type === 'comment') return true
  if (needsSpaceBetween(a, b)) return true
  if (a.type === 'word' && b.type !== 'punct') return true
  if (a.type === 'punct' && ['=', '+', '-', '*', '/', '%', '==', '===', '!=', '!==', '<=', '>=', '<', '>', '=>', '&&', '||', '??', '+='].includes(a.value)) return true
  if (b.type === 'punct' && ['=', '==', '===', '!=', '!==', '<=', '>=', '=>', '&&', '||', '??', '+='].includes(b.value)) return true
  return false
}

/** Strip comments and redundant whitespace. Newlines are always preserved. */
export function minifyJs(source: string): string {
  const tokens = tokenizeJs(source).filter((token) => token.type !== 'comment' && token.value !== '')
  let out = ''
  let previous: JsToken | null = null

  for (const token of tokens) {
    if (out !== '') {
      if (token.newlineBefore) {
        out = `${out.replace(/[ \t]+$/, '')}\n`
      } else if (previous && needsSpaceBetween(previous, token)) {
        out += ' '
      }
    }
    out += token.value
    previous = token
  }

  return out.replace(/\n{2,}/g, '\n').trim()
}

/**
 * Re-emit the tokens with one statement per line and brace indentation. Braces,
 * semicolons and block-comment newlines are the only places a line may break,
 * so the formatting can never change how the code parses. Comments are kept.
 */
export function beautifyJs(source: string, indent = '  '): string {
  const tokens = tokenizeJs(source)
  let out = ''
  let depth = 0

  const breakLine = () => {
    out = `${out.replace(/[ \t]+$/, '')}\n${indent.repeat(Math.max(depth, 0))}`
  }

  tokens.forEach((token, index) => {
    const next = tokens[index + 1]

    // A newline in the source is kept: with no semicolons it is what separates
    // two statements, so dropping it would change how the code parses.
    if (out !== '' && token.newlineBefore && !/\n$/.test(out)) {
      out = `${out.replace(/[ \t]+$/, '')}\n${indent.repeat(Math.max(depth, 0))}`
    }

    switch (token.value) {
      case '{':
        depth += 1
        out = `${out.replace(/[ \t]+$/, '')} {`
        breakLine()
        return
      case '}':
        depth = Math.max(depth - 1, 0)
        out = `${out.replace(/[ \t]+$/, '')}\n${indent.repeat(depth)}}`
        if (next && next.value !== ';' && next.value !== ',' && next.value !== ')') breakLine()
        return
      case ';':
        out = `${out.replace(/[ \t]+$/, '')};`
        breakLine()
        return
      default:
        break
    }

    if (out !== '' && !/[\n ]$/.test(out)) {
      const previous = tokens[index - 1]
      if (previous && beautifyNeedsSpace(previous, token)) out += ' '
    }
    out += token.value
  })

  return out
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/* -------------------------------------------------------------------------- */
/* CSS                                                                         */
/* -------------------------------------------------------------------------- */

const CSS_PROTECTED = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|url\((?:[^)]*)\))/gi

/** Replace strings and url(...) with placeholders so they survive collapsing. */
function protectCss(source: string): { masked: string; parts: string[] } {
  const parts: string[] = []
  const masked = source.replace(CSS_PROTECTED, (match) => {
    parts.push(match)
    return `\u0000${parts.length - 1}\u0000`
  })
  return { masked, parts }
}

function restoreCss(source: string, parts: string[]): string {
  return source.replace(/\u0000(\d+)\u0000/g, (_, index: string) => parts[Number(index)] ?? '')
}

export function minifyCss(source: string): string {
  const { masked, parts } = protectCss(source)
  const length = masked.length
  let out = ''
  let i = 0
  let depth = 0
  let pendingSpace = false

  while (i < length) {
    const char = masked[i]

    if (/\s/.test(char)) {
      pendingSpace = true
      i += 1
      continue
    }
    if (char === '/' && masked[i + 1] === '*') {
      const end = masked.indexOf('*/', i + 2)
      i = end === -1 ? length : end + 2
      continue
    }
    if (char === '{' || char === '}' || char === ';' || char === ',') {
      out = out.replace(/\s+$/, '')
      if (char === '{') depth += 1
      if (char === '}') depth = Math.max(depth - 1, 0)
      // A semicolon right before a closing brace is redundant.
      if (char === '}' && out.endsWith(';')) out = out.slice(0, -1)
      out += char
      pendingSpace = false
      i += 1
      continue
    }
    if (char === '>' || char === '~') {
      out = `${out.replace(/\s+$/, '')}${char}`
      pendingSpace = false
      i += 1
      continue
    }
    if (char === ':') {
      // Inside a block the colon separates a property from its value; in a
      // selector it introduces a pseudo-class, where the preceding space is
      // meaningful (`a :hover` is not `a:hover`). Space after a declaration
      // colon is redundant; space before one around a selector is not.
      if (depth > 0) {
        out = `${out.replace(/\s+$/, '')}:`
        // Space after a declaration colon is never significant.
        while (i + 1 < length && /\s/.test(masked[i + 1])) i += 1
        pendingSpace = false
      } else {
        if (pendingSpace && out !== '') out += ' '
        out += ':'
        pendingSpace = false
      }
      i += 1
      continue
    }

    if (pendingSpace && out !== '' && !/[({;,>~]$/.test(out)) out += ' '
    out += char
    pendingSpace = false
    i += 1
  }

  return restoreCss(out.trim(), parts)
}

/**
 * Re-indent CSS. A `:` is spaced out only when the next structural character is
 * `;` or `}` (a declaration) rather than `{` (a selector pseudo-class).
 */
export function beautifyCss(source: string, indent = '  '): string {
  const flat = minifyCss(source)
  let out = ''
  let depth = 0
  let inGuard = false
  let guardChar = ''

  for (let i = 0; i < flat.length; i++) {
    const char = flat[i]
    if (inGuard) {
      out += char
      if (char === '\\') {
        out += flat[i + 1] ?? ''
        i += 1
      } else if (char === guardChar) {
        inGuard = false
      }
      continue
    }
    if (char === '"' || char === "'") {
      inGuard = true
      guardChar = char
      out += char
      continue
    }

    if (char === '{') {
      depth += 1
      out = `${out.trimEnd()} {\n${indent.repeat(depth)}`
      continue
    }
    if (char === '}') {
      depth = Math.max(depth - 1, 0)
      out = `${out.trimEnd()}\n${indent.repeat(depth)}}\n${indent.repeat(depth)}`
      continue
    }
    if (char === ';') {
      out = `${out.trimEnd()};\n${indent.repeat(depth)}`
      continue
    }
    if (char === ':') {
      const rest = flat.slice(i + 1)
      const stop = rest.search(/[;{}]/)
      const isDeclaration = stop !== -1 && rest[stop] !== '{'
      out = `${out.trimEnd()}${isDeclaration ? ': ' : ':'}`
      continue
    }
    out += char
  }

  return out
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .filter((line, index, all) => !(line.trim() === '' && all[index - 1]?.trim() === ''))
    .join('\n')
    .trim()
}

/* -------------------------------------------------------------------------- */

export function minify(source: string, language: CodeLanguage): MinifyResult {
  const output = language === 'css' ? minifyCss(source) : minifyJs(source)
  return {
    output,
    saved: byteLength(source) - byteLength(output),
    before: byteLength(source),
    after: byteLength(output),
  }
}

export function beautify(source: string, language: CodeLanguage, indent = '  '): string {
  return language === 'css' ? beautifyCss(source, indent) : beautifyJs(source, indent)
}

/** Best-effort language guess from the shape of the snippet. */
export function detectLanguage(source: string): CodeLanguage {
  const cssSignals = (source.match(/[.#][\w-]+\s*\{|:\s*[\w-]+\s*;|@media|@supports|--[\w-]+\s*:/g) ?? []).length
  const jsSignals = (source.match(/\bfunction\b|\bconst\b|\blet\b|=>|console\.|require\(|\bimport\b|\breturn\b/g) ?? []).length
  return cssSignals > jsSignals ? 'css' : 'javascript'
}
