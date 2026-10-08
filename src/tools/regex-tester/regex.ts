/** Regex running with indices, plus a plain-English pattern explainer. */

export interface MatchInfo {
  value: string
  index: number
  groups: (string | undefined)[]
  named: Record<string, string | undefined>
}

/** Compile a pattern, returning a friendly error instead of throwing at the UI. */
export function compile(pattern: string, flags: string): { regex?: RegExp; error?: string } {
  try {
    // Always include `d` so we can report exact indices; avoid a duplicate flag.
    const unique = Array.from(new Set((flags + 'd').split(''))).join('')
    return { regex: new RegExp(pattern, unique) }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Invalid regular expression' }
  }
}

export function runRegex(pattern: string, flags: string, input: string, limit = 500): { matches: MatchInfo[]; error?: string } {
  const { regex, error } = compile(pattern, flags)
  if (!regex) return { matches: [], error }

  const matches: MatchInfo[] = []
  const global = regex.global
  if (!global) {
    const match = regex.exec(input)
    if (match) matches.push(toInfo(match))
    return { matches }
  }

  let match: RegExpExecArray | null
  while ((match = regex.exec(input)) !== null && matches.length < limit) {
    matches.push(toInfo(match))
    if (match[0] === '') regex.lastIndex++ // guard against zero-width loops
  }
  return { matches }
}

function toInfo(match: RegExpExecArray): MatchInfo {
  const indices = match.indices
  return {
    value: match[0],
    index: indices ? indices[0][0] : match.index,
    groups: match.slice(1),
    named: { ...(match.groups ?? {}) },
  }
}

export interface Explanation {
  token: string
  meaning: string
}

/** A deliberately simple, readable breakdown of the most common constructs. */
export function explain(pattern: string): Explanation[] {
  const out: Explanation[] = []
  const chars = [...pattern]
  let i = 0

  const classes: Record<string, string> = {
    d: 'a digit (0–9)', D: 'anything but a digit', w: 'a word character', W: 'anything but a word character',
    s: 'whitespace', S: 'anything but whitespace', b: 'a word boundary', B: 'not a word boundary',
    n: 'a newline', t: 'a tab', '.': 'any character',
  }

  while (i < chars.length) {
    const char = chars[i]

    if (char === '\\') {
      const next = chars[i + 1] ?? ''
      out.push({ token: `\\${next}`, meaning: classes[next] ?? `the literal “${next}”` })
      i += 2
      continue
    }

    if (char === '[') {
      let inner = ''
      let j = i + 1
      if (chars[j] === '^') {
        inner += '^'
        j++
      }
      while (j < chars.length && chars[j] !== ']') {
        inner += chars[j]
        j++
      }
      const negated = inner.startsWith('^')
      out.push({ token: `[${inner}]`, meaning: `${negated ? 'not' : 'one of'} ${inner.replace(/^\^/, '')}` })
      i = j + 1
      continue
    }

    if (char === '(') {
      let header = ''
      let j = i + 1
      if (chars[j] === '?') {
        while (j < chars.length && chars[j] !== ':' && chars[j] !== ')') {
          header += chars[j]
          j++
        }
        if (chars[j] === ':') j++
      }
      const named = header.match(/\?<([^>]+)>/)
      const label = named ? `start of named group “${named[1]}”` : header.includes('=') ? 'a lookahead assertion' : header.includes('!') ? 'a negative lookahead' : 'start of a group'
      out.push({ token: `(${header}`, meaning: label })
      i = j
      continue
    }

    if (char === ')') {
      out.push({ token: ')', meaning: 'end of group' })
      i++
      continue
    }

    if (char === '{') {
      let inner = ''
      let j = i + 1
      while (j < chars.length && chars[j] !== '}') {
        inner += chars[j]
        j++
      }
      out.push({ token: `{${inner}}`, meaning: describeRepeat(inner) })
      i = j + 1
      continue
    }

    const single: Record<string, string> = {
      '^': 'start of the string (or line with the m flag)',
      $: 'end of the string (or line with the m flag)',
      '.': 'any character except newline',
      '|': 'OR',
      '*': 'repeat the previous token zero or more times',
      '+': 'repeat the previous token one or more times',
      '?': 'make the previous token optional',
    }
    out.push({ token: char, meaning: single[char] ?? `the literal “${char}”` })
    i++
  }

  return out
}

function describeRepeat(inner: string): string {
  if (inner.includes(',')) {
    const [min, max] = inner.split(',')
    return max ? `repeat the previous token between ${min} and ${max} times` : `repeat the previous token at least ${min} times`
  }
  return `repeat the previous token exactly ${inner} times`
}

export function highlight(input: string, matches: MatchInfo[]): { text: string; match: boolean }[] {
  const segments: { text: string; match: boolean }[] = []
  let cursor = 0
  for (const match of [...matches].sort((a, b) => a.index - b.index)) {
    if (match.index < cursor) continue
    if (match.index > cursor) segments.push({ text: input.slice(cursor, match.index), match: false })
    segments.push({ text: match.value, match: true })
    cursor = match.index + match.value.length
  }
  if (cursor < input.length) segments.push({ text: input.slice(cursor), match: false })
  return segments
}
