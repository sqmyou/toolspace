/**
 * gitignore pattern handling.
 *
 * The matching rules follow git: a pattern without a slash applies at any
 * depth, a pattern with a slash is anchored, a trailing slash restricts it to
 * directories, and a leading exclamation mark re-includes a path. Later
 * patterns win, so negations are applied in order.
 */

export class GitignoreError extends Error {}

export interface PatternInfo {
  /** The original line, trimmed. */
  pattern: string
  negated: boolean
  directoryOnly: boolean
  anchored: boolean
  /** The pattern with the markers removed. */
  body: string
  regex: RegExp | null
}

function escapeLiteral(char: string): string {
  return /[.+^${}()|[\]\\]/.test(char) ? `\\${char}` : char
}

function compile(body: string, anchored: boolean): RegExp {
  let out = ''
  for (let i = 0; i < body.length; i++) {
    const char = body[i]
    if (char === '*') {
      if (body[i + 1] === '*') {
        while (body[i + 1] === '*') i++
        if (body[i + 1] === '/') {
          i++
          out += '(?:.*/)?'
        } else {
          out += '.*'
        }
      } else {
        out += '[^/]*'
      }
    } else if (char === '?') {
      out += '[^/]'
    } else if (char === '[') {
      const end = body.indexOf(']', i + 1)
      if (end === -1) out += '\\['
      else {
        out += body.slice(i, end + 1)
        i = end
      }
    } else {
      out += escapeLiteral(char)
    }
  }
  // A pattern that names a directory also ignores everything inside it, so the
  // match may end at the pattern or continue into a child path.
  const prefix = anchored ? '^' : '(?:^|.*/)'
  return new RegExp(prefix + out + '(?:/.*)?$')
}

/** Read one line of a gitignore file. Returns null for blanks and comments. */
export function parsePattern(line: string): PatternInfo | null {
  const trimmed = line.replace(/\s+$/, '')
  if (!trimmed || trimmed.startsWith('#')) return null

  let body = trimmed
  const negated = body.startsWith('!')
  if (negated) body = body.slice(1)

  const directoryOnly = body.endsWith('/')
  if (directoryOnly) body = body.slice(0, -1)

  const anchored = body.startsWith('/') || body.slice(1).includes('/')
  if (body.startsWith('/')) body = body.slice(1)
  if (!body) return null

  return { pattern: trimmed, negated, directoryOnly, anchored, body, regex: compile(body, anchored) }
}

/** True when the path is ignored by the pattern list. */
export function isIgnored(patterns: readonly string[], path: string): boolean {
  const target = path.trim().replace(/^\.?\//, '').replace(/\/+$/, '')
  if (!target) return false
  let ignored = false
  for (const line of patterns) {
    const info = parsePattern(line)
    if (!info?.regex) continue
    if (info.regex.test(target)) ignored = !info.negated
  }
  return ignored
}

export interface Decision {
  path: string
  ignored: boolean
  /** The pattern that produced the final decision. */
  matched: string | null
  negated: boolean
}

/** The same as isIgnored, but reports which pattern decided it. */
export function explain(patterns: readonly string[], path: string): Decision {
  const target = path.trim().replace(/^\.?\//, '').replace(/\/+$/, '')
  let ignored = false
  let matched: string | null = null
  let negated = false
  for (const line of patterns) {
    const info = parsePattern(line)
    if (!info?.regex) continue
    if (info.regex.test(target)) {
      ignored = !info.negated
      matched = info.pattern
      negated = info.negated
    }
  }
  return { path: target, ignored, matched, negated }
}

/** Every non-comment line, in order. */
export function parseLines(input: string): PatternInfo[] {
  return input
    .split(/\r?\n/)
    .map(parsePattern)
    .filter((info): info is PatternInfo => info !== null)
}

export const TEMPLATES: Record<string, string> = {
  Node: `node_modules/\nnpm-debug.log*\nyarn-error.log*\n.env\n.env.local\n.env.*.local\ndist/\ncoverage/\n.nyc_output/\n*.tsbuildinfo`,
  Python: `__pycache__/\n*.py[cod]\n.venv/\nvenv/\nbuild/\ndist/\n*.egg-info/\n.pytest_cache/\n.mypy_cache/\n.coverage`,
  Rust: `target/\nCargo.lock\n**/*.rs.bk`,
  Go: `bin/\n*.exe\n*.test\n*.out\nvendor/`,
  Java: `*.class\n*.jar\ntarget/\n.gradle/\nbuild/`,
  'macOS': `.DS_Store\n.AppleDouble\n.LSOverride\nIcon\r\n._*`,
  Windows: `Thumbs.db\nehthumbs.db\nDesktop.ini\n$RECYCLE.BIN/`,
  VSCode: `.vscode/*\n!.vscode/settings.json\n!.vscode/extensions.json`,
  Logs: `logs/\n*.log\nnpm-debug.log*\nyarn-debug.log*`,
  'Env & secrets': `.env\n.env.*\n!.env.example\n*.pem\n*.key`,
}

export function templateNames(): string[] {
  return Object.keys(TEMPLATES)
}

/** Join the chosen templates with a header comment for each. */
export function generate(names: readonly string[]): string {
  const blocks: string[] = []
  for (const name of names) {
    const body = TEMPLATES[name]
    if (!body) throw new GitignoreError(`There is no template called "${name}"`)
    blocks.push(`# ${name}\n${body}`)
  }
  return blocks.join('\n\n') + (blocks.length ? '\n' : '')
}

export interface Summary {
  total: number
  negations: number
  directoryOnly: number
  anchored: number
}

export function summarise(patterns: readonly string[]): Summary {
  const infos = parseLines(patterns.join('\n'))
  return {
    total: infos.length,
    negations: infos.filter((info) => info.negated).length,
    directoryOnly: infos.filter((info) => info.directoryOnly).length,
    anchored: infos.filter((info) => info.anchored).length,
  }
}
