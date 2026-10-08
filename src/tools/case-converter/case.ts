/** Word-splitting and case conversion for the text transformer. */

/** Split an identifier-ish string into lowercase words. */
export function words(input: string): string[] {
  return split(input).map((w) => w.toLowerCase())
}

function split(input: string): string[] {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-zA-Z])([0-9])/g, '$1 $2')
    .replace(/([0-9])([a-zA-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
}

export function upper(input: string): string {
  return input.toUpperCase()
}

export function lower(input: string): string {
  return input.toLowerCase()
}

export function sentenceCase(input: string): string {
  const trimmed = input.trim().replace(/\s+/g, ' ')
  if (!trimmed) return ''
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
}

export function titleCase(input: string): string {
  const small = new Set([
    'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by',
    'of', 'in', 'with', 'as', 'is', 'it',
  ])
  const list = split(input)
  return list
    .map((word, index) => {
      const lower = word.toLowerCase()
      if (index !== 0 && index !== list.length - 1 && small.has(lower)) return lower
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
}

export function camelCase(input: string): string {
  return words(input)
    .map((word, index) => (index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join('')
}

export function pascalCase(input: string): string {
  return words(input)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}

export function snakeCase(input: string): string {
  return words(input).join('_')
}

export function kebabCase(input: string): string {
  return words(input).join('-')
}

export function constantCase(input: string): string {
  return words(input).join('_').toUpperCase()
}

export function dotCase(input: string): string {
  return words(input).join('.')
}

export function toggleCase(input: string): string {
  return [...input].map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join('')
}

/** Reverse the order of characters (code-point aware, so emoji survive). */
export function reverse(input: string): string {
  return [...input].reverse().join('')
}

export interface LineOptions {
  trim: boolean
  sort: boolean
  dedupe: boolean
  reverse: boolean
}

/** Apply the line-level transforms in a predictable order. */
export function transformLines(input: string, options: LineOptions): string {
  let lines = input.split('\n')
  if (options.trim) lines = lines.map((line) => line.trim()).filter((line) => line.length > 0)
  if (options.dedupe) lines = [...new Set(lines)]
  if (options.sort) lines = [...lines].sort((a, b) => a.localeCompare(b))
  if (options.reverse) lines = [...lines].reverse()
  return lines.join('\n')
}
