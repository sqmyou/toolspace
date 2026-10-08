/**
 * POSIX shell quoting and word splitting.
 *
 * Quoting follows the rule that keeps a string intact when it is re-read by a
 * shell: wrap in single quotes unless every character is already safe, and
 * close the quotes around an embedded single quote. Splitting understands the
 * three quoting forms a shell does, including the fact that inside single
 * quotes nothing is special.
 */

export class ShellError extends Error {}

const SAFE = /^[A-Za-z0-9@%_\-+=:,./]+$/

/** True when a word can be written without any quoting. */
export function isSafe(word: string): boolean {
  return SAFE.test(word)
}

/** Quote one word for a POSIX shell. */
export function quote(word: string): string {
  if (word === '') return "''"
  if (isSafe(word)) return word
  return `'${word.replace(/'/g, "'\\''")}'`
}

/** Quote a whole command line, one word at a time. */
export function quoteAll(words: readonly string[]): string {
  return words.map(quote).join(' ')
}

/** Wrap a value in double quotes, escaping what stays special inside them. */
export function doubleQuote(word: string): string {
  return `"${word.replace(/[\\$`"]/g, '\\$&')}"`
}

export interface SplitOptions {
  /** Throw on an unterminated quote instead of treating it as literal text. */
  strict?: boolean
}

/** Split a command line into words, honouring quotes and backslashes. */
export function splitWords(input: string, options: SplitOptions = {}): string[] {
  const words: string[] = []
  let current = ''
  let started = false
  let quoteChar: '"' | "'" | null = null

  const push = () => {
    if (started) words.push(current)
    current = ''
    started = false
  }

  for (let i = 0; i < input.length; i++) {
    const char = input[i]

    if (quoteChar === "'") {
      if (char === "'") quoteChar = null
      else current += char
      continue
    }

    if (quoteChar === '"') {
      if (char === '"') quoteChar = null
      else if (char === '\\' && i + 1 < input.length && /["\\$`\n]/.test(input[i + 1])) {
        current += input[i + 1]
        i += 1
      } else current += char
      continue
    }

    if (char === "'" || char === '"') {
      quoteChar = char
      started = true
      continue
    }

    if (char === '\\') {
      if (i + 1 < input.length) {
        current += input[i + 1]
        i += 1
        started = true
      }
      continue
    }

    if (/\s/.test(char)) {
      push()
      continue
    }

    current += char
    started = true
  }

  if (quoteChar) {
    if (options.strict) throw new ShellError(`Unterminated ${quoteChar === "'" ? 'single' : 'double'} quote`)
    current = `${quoteChar}${current}`
  }
  push()
  return words
}

/** Escape a value for a shell without using quotes, for `sh -c` fragments. */
export function escape(word: string): string {
  return word.replace(/([^A-Za-z0-9@%_\-+=:,./])/g, '\\$1')
}

/** Quote only where needed, for a list that mixes safe and unsafe words. */
export function quoteMinimal(words: readonly string[]): string {
  return words.map((word) => (isSafe(word) && word !== '' ? word : quote(word))).join(' ')
}

export interface ArgvSummary {
  words: string[]
  quoted: string
  unsafe: string[]
  longest: number
}

/** A one-shot view used by the tool. */
export function summarise(words: readonly string[]): ArgvSummary {
  return {
    words: [...words],
    quoted: quoteAll(words),
    unsafe: words.filter((word) => !isSafe(word)),
    longest: words.reduce((max, word) => Math.max(max, word.length), 0),
  }
}
