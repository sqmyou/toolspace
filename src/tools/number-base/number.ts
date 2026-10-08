/** Arbitrary-precision base conversion, so huge integers survive round trips. */

export interface ConversionResult {
  decimal: string
  hex: string
  octal: string
  binary: string
}

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'

/** Parse a string in `base` (2–36) into a BigInt, validating every digit. */
export function parseInBase(value: string, base: number): bigint {
  const clean = value.trim().toLowerCase().replace(/[\s_]/g, '')
  if (!clean) throw new Error('Enter a number')
  if (base < 2 || base > 36) throw new Error('Base must be between 2 and 36')

  let negative = false
  let body = clean
  if (body.startsWith('-')) {
    negative = true
    body = body.slice(1)
  } else if (body.startsWith('+')) {
    body = body.slice(1)
  }

  let prefix = ''
  if (base === 16 && body.startsWith('0x')) prefix = '0x'
  if (base === 8 && body.startsWith('0o')) prefix = '0o'
  if (base === 2 && body.startsWith('0b')) prefix = '0b'
  body = body.slice(prefix.length)

  if (!body) throw new Error('Enter a number')

  let result = 0n
  const bigBase = BigInt(base)
  for (const char of body) {
    const digit = DIGITS.indexOf(char)
    if (digit === -1 || digit >= base) throw new Error(`“${char}” is not a valid digit in base ${base}`)
    result = result * bigBase + BigInt(digit)
  }
  return negative ? -result : result
}

/** Render a BigInt in `base`, optionally padded to `bits` bits for 2/8/16. */
export function formatInBase(value: bigint, base: number, padBits = 0): string {
  if (base < 2 || base > 36) throw new Error('Base must be between 2 and 36')
  const negative = value < 0n
  let magnitude = negative ? -value : value
  let digits = ''
  const bigBase = BigInt(base)
  if (magnitude === 0n) digits = '0'
  while (magnitude > 0n) {
    digits = DIGITS[Number(magnitude % bigBase)] + digits
    magnitude /= bigBase
  }
  if (padBits > 0 && !negative) {
    const width = Math.ceil(padBits / Math.log2(base))
    digits = digits.padStart(width, '0')
  }
  return (negative ? '-' : '') + digits
}

export function convert(value: string, base: number, padBits = 0, uppercase = false): ConversionResult {
  const n = parseInBase(value, base)
  const hex = formatInBase(n, 16, padBits)
  return {
    decimal: n.toString(),
    hex: uppercase ? hex.toUpperCase() : hex,
    octal: formatInBase(n, 8, padBits),
    binary: formatInBase(n, 2, padBits),
  }
}

/** Group a bit/hex string into readable chunks without changing its value. */
export function groupDigits(value: string, size: number): string {
  const negative = value.startsWith('-')
  const body = negative ? value.slice(1) : value
  const grouped = body.replace(new RegExp(`(.{${size}})`, 'g'), '$1 ').trim()
  return (negative ? '-' : '') + grouped
}
