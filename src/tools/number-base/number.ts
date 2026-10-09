/** Arbitrary-precision base conversion, so huge integers survive round trips. */

export interface ConversionResult {
  decimal: string
  hex: string
  octal: string
  binary: string
  /** Bits needed to hold the magnitude; 0 for zero. */
  bitLength: number
  /** Bytes needed to hold the magnitude; 0 for zero. */
  byteLength: number
}

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'

/** Human description of the digits a base accepts, for error messages. */
export function digitRange(base: number): string {
  if (base <= 10) return `0–${base - 1}`
  return `0–9 and a–${DIGITS[base - 1]}`
}

function assertBase(base: number): void {
  if (!Number.isInteger(base) || base < 2 || base > 36) {
    throw new Error('Base must be a whole number between 2 and 36')
  }
}

/**
 * Parse a string in `base` (2–36) into a BigInt, validating every digit.
 *
 * Separators (spaces, underscores, commas, apostrophes) are ignored so pasted
 * values like `1,000,000` or `dead_beef` work. Unicode digits are folded to
 * ASCII with NFKC. A leading `+`/`-` and a matching `0x`/`0o`/`0b` prefix are
 * accepted.
 */
export function parseInBase(value: string, base: number): bigint {
  assertBase(base)
  const clean = value.normalize('NFKC').trim().toLowerCase().replace(/[\s_',]/g, '')
  if (!clean) throw new Error('Enter a value to convert')

  let negative = false
  let body = clean
  if (body.startsWith('-')) {
    negative = true
    body = body.slice(1)
  } else if (body.startsWith('+')) {
    body = body.slice(1)
  }

  let prefixLength = 0
  if (base === 16 && body.startsWith('0x')) prefixLength = 2
  else if (base === 8 && body.startsWith('0o')) prefixLength = 2
  else if (base === 2 && body.startsWith('0b')) prefixLength = 2
  body = body.slice(prefixLength)

  if (!body) throw new Error('Enter digits after the sign or prefix')

  let result = 0n
  const bigBase = BigInt(base)
  for (const char of body) {
    const digit = DIGITS.indexOf(char)
    if (digit === -1 || digit >= base) {
      throw new Error(`“${char}” is not a digit in base ${base}. Use ${digitRange(base)}.`)
    }
    result = result * bigBase + BigInt(digit)
  }
  return negative ? -result : result
}

/** Bits in the magnitude of a BigInt (0 has 0 bits); the sign is ignored. */
export function bitLength(value: bigint): number {
  const magnitude = value < 0n ? -value : value
  return magnitude === 0n ? 0 : magnitude.toString(2).length
}

/**
 * Render a BigInt in `base`, optionally padded to at least `bits` bits for
 * bases 2/8/16 and upper-casing any letters when `uppercase` is set.
 */
export function formatInBase(value: bigint, base: number, padBits = 0, uppercase = false): string {
  assertBase(base)
  const negative = value < 0n
  let magnitude = negative ? -value : value
  let digits = ''
  const bigBase = BigInt(base)
  if (magnitude === 0n) digits = '0'
  while (magnitude > 0n) {
    digits = DIGITS[Number(magnitude % bigBase)] + digits
    magnitude /= bigBase
  }
  // Pad only as far as the requested minimum width; a value that already needs
  // more bits than `padBits` keeps every digit.
  if (padBits > 0 && !negative) {
    const width = Math.max(Math.ceil(padBits / Math.log2(base)), digits.length)
    digits = digits.padStart(width, '0')
  }
  if (uppercase) digits = digits.toUpperCase()
  return (negative ? '-' : '') + digits
}

export function convert(value: string, base: number, padBits = 0, uppercase = false): ConversionResult {
  return describe(parseInBase(value, base), padBits, uppercase)
}

/**
 * Render an already-parsed integer in the four standard bases plus its size.
 * Split out from `convert` so a caller that has a BigInt in hand (e.g. after
 * `swap`) does not parse the same digits twice.
 */
export function describe(n: bigint, padBits = 0, uppercase = false): ConversionResult {
  const bits = bitLength(n)
  return {
    decimal: n.toString(),
    hex: formatInBase(n, 16, padBits, uppercase),
    octal: formatInBase(n, 8, padBits),
    binary: formatInBase(n, 2, padBits),
    bitLength: bits,
    byteLength: Math.ceil(bits / 8),
  }
}

/**
 * Group a digit string into readable chunks without changing its value.
 * Grouping runs from the right so thousands separators read naturally and a
 * full byte of bits stays intact; a non-positive or non-integer size returns
 * the value untouched.
 */
export function groupDigits(value: string, size: number): string {
  if (!Number.isInteger(size) || size < 1) return value
  const negative = value.startsWith('-')
  const body = negative ? value.slice(1) : value
  let grouped = ''
  for (let end = body.length; end > 0; end -= size) {
    const chunk = body.slice(Math.max(0, end - size), end)
    grouped = grouped ? `${chunk} ${grouped}` : chunk
  }
  return (negative ? '-' : '') + grouped
}
