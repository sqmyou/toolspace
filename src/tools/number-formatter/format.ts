/**
 * Number formatting.
 *
 * Parsing is deliberately forgiving: it strips grouping separators and
 * currency symbols, and understands both "1,234.56" and "1.234,56" by looking
 * at which separator comes last. Formatting uses Intl, so the grouping and
 * decimal marks follow the chosen locale rather than a hard-coded guess.
 */

export class NumberError extends Error {}

export interface ParseOptions {
  /** Treat the last separator as the decimal mark. Defaults to true. */
  detectSeparators?: boolean
}

/** Parse a human number, tolerating grouping separators and a currency symbol. */
export function parseNumber(input: string, options: ParseOptions = {}): number {
  let text = input.trim()
  if (!text) throw new NumberError('Enter a number')

  let negative = false
  if (/^\(.*\)$/.test(text)) {
    negative = true
    text = text.slice(1, -1)
  }

  text = text.replace(/[\s\u00a0\u202f]/g, '')
  if (text.startsWith('-')) {
    negative = !negative
    text = text.slice(1)
  } else if (text.startsWith('+')) {
    text = text.slice(1)
  }
  // Drop anything that is not a digit or a separator: currency symbols, unit
  // suffixes, stray letters.
  text = text.replace(/[^\d.,]/g, '')
  if (!/\d/.test(text)) throw new NumberError(`"${input.trim()}" is not a number`)

  if (options.detectSeparators ?? true) {
    const lastComma = text.lastIndexOf(',')
    const lastDot = text.lastIndexOf('.')
    const decimals = (mark: string) => text.length - text.lastIndexOf(mark) - 1

    // The separator with a one-to-two digit tail (or the only separator) is
    // the decimal mark; the other one groups thousands.
    let decimal: ',' | '.' | null = null
    if (lastComma !== -1 && lastDot !== -1) decimal = lastComma > lastDot ? ',' : '.'
    else if (lastComma !== -1) decimal = decimals(',') !== 3 || lastComma === 0 ? ',' : '.'
    else if (lastDot !== -1) decimal = decimals('.') === 3 ? ',' : '.'

    if (decimal === ',') text = text.replace(/\./g, '').replace(/,/g, '.')
    else if (decimal === '.') text = text.replace(/,/g, '')
    else text = text.replace(/[.,]/g, '')
  }

  const value = Number(text)
  if (!Number.isFinite(value)) throw new NumberError(`"${input.trim()}" is not a number`)
  return negative ? -value : value
}

export interface FormatOptions {
  locale?: string
  style?: 'decimal' | 'currency' | 'percent' | 'unit'
  currency?: string
  unit?: string
  minimumFractionDigits?: number
  maximumFractionDigits?: number
  compact?: boolean
  signDisplay?: 'auto' | 'always' | 'never' | 'exceptZero'
}

/** Format a number with Intl, falling back to plain text on a bad option. */
export function formatNumber(value: number, options: FormatOptions = {}): string {
  if (!Number.isFinite(value)) throw new NumberError('Only finite numbers can be formatted')
  const { locale = 'en-US', style = 'decimal', compact = false, ...rest } = options
  try {
    return new Intl.NumberFormat(locale, {
      style,
      notation: compact ? 'compact' : 'standard',
      currency: style === 'currency' ? options.currency ?? 'USD' : undefined,
      unit: style === 'unit' ? options.unit ?? 'kilometer' : undefined,
      minimumFractionDigits: rest.minimumFractionDigits,
      maximumFractionDigits: rest.maximumFractionDigits,
      signDisplay: rest.signDisplay ?? 'auto',
    }).format(value)
  } catch (err) {
    throw new NumberError(err instanceof Error ? err.message : 'That locale or option is not supported')
  }
}

/** Fixed decimal places, without Intl grouping. */
export function toFixed(value: number, decimals: number): string {
  if (!Number.isFinite(value)) throw new NumberError('Only finite numbers can be formatted')
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 100) throw new NumberError('Decimal places must be between 0 and 100')
  return value.toFixed(decimals)
}

/** Engineering-style abbreviation, e.g. 1500 -> "1.5K". */
export function abbreviate(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) throw new NumberError('Only finite numbers can be abbreviated')
  const units = ['', 'K', 'M', 'B', 'T', 'P', 'E']
  const sign = value < 0 ? '-' : ''
  let magnitude = Math.abs(value)
  let index = 0
  while (magnitude >= 1000 && index < units.length - 1) {
    magnitude /= 1000
    index += 1
  }
  const rounded = Number(magnitude.toFixed(decimals))
  return `${sign}${rounded}${units[index]}`
}

/** A number written out in English words. */
export function numberToWords(value: number): string {
  if (!Number.isFinite(value)) throw new NumberError('Only finite numbers can be written out')
  if (!Number.isInteger(value)) throw new NumberError('Only whole numbers can be written out')
  if (Math.abs(value) >= 1e15) throw new NumberError('That number is too large to write out')

  const ones = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
  const scales = ['', ' thousand', ' million', ' billion', ' trillion']

  function chunk(n: number): string {
    const parts: string[] = []
    if (n >= 100) {
      parts.push(`${ones[Math.floor(n / 100)]} hundred`)
      n %= 100
    }
    if (n >= 20) {
      const remainder = n % 10
      parts.push(remainder ? `${tens[Math.floor(n / 10)]}-${ones[remainder]}` : tens[Math.floor(n / 10)])
    } else if (n > 0) {
      parts.push(ones[n])
    }
    return parts.join(' ')
  }

  if (value === 0) return 'zero'
  const sign = value < 0 ? 'negative ' : ''
  let remaining = Math.abs(value)
  const groups: string[] = []
  let scale = 0
  while (remaining > 0) {
    const part = remaining % 1000
    if (part > 0) groups.unshift(`${chunk(part)}${scales[scale]}`)
    remaining = Math.floor(remaining / 1000)
    scale += 1
  }
  return sign + groups.join(' ')
}

/** Common representations of a value, for the side-by-side list. */
export function representations(value: number, locale = 'en-US'): [string, string][] {
  return [
    ['Default', formatNumber(value, { locale })],
    ['Plain', String(value)],
    ['Compact', formatNumber(value, { locale, compact: true })],
    ['Abbreviated', abbreviate(value)],
    ['Currency (USD)', formatNumber(value, { locale, style: 'currency', currency: 'USD' })],
    ['Percent', formatNumber(value, { locale, style: 'percent' })],
    ['Two decimals', formatNumber(value, { locale, minimumFractionDigits: 2, maximumFractionDigits: 2 })],
    ['Scientific', value.toExponential()],
    ['Binary', value >= 0 && Number.isInteger(value) ? value.toString(2) : '—'],
    ['Hexadecimal', value >= 0 && Number.isInteger(value) ? `0x${value.toString(16)}` : '—'],
  ]
}
