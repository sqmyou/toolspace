/**
 * Random value generation backed by crypto.getRandomValues.
 *
 * Rejection sampling is used rather than a plain modulo, because modulo biases
 * the low numbers whenever the range does not divide 2^32 evenly. Passwords
 * pick characters from a shuffled-by-selection pool so no character class is
 * favoured, and a guarantee option can require at least one of each class.
 */

export class RandomError extends Error {}

export const CHAR_SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/',
} as const

export type CharSetName = keyof typeof CHAR_SETS

/** A uniform random integer in [0, max). */
export function randomInt(max: number): number {
  if (!Number.isInteger(max) || max < 1 || max > 2 ** 32) throw new RandomError('The range must be a whole number between 1 and 2^32')
  const limit = Math.floor(2 ** 32 / max) * max
  const buffer = new Uint32Array(1)
  let value: number
  do {
    crypto.getRandomValues(buffer)
    value = buffer[0]
  } while (value >= limit)
  return value % max
}

/** A uniform random integer in [min, max], both ends included. */
export function randomBetween(min: number, max: number): number {
  if (min > max) throw new RandomError('The minimum cannot exceed the maximum')
  return min + randomInt(max - min + 1)
}

/** A random byte array. */
export function randomBytes(length: number): Uint8Array {
  if (!Number.isInteger(length) || length < 0) throw new RandomError('Length must be a non-negative whole number')
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

/** A random lowercase hexadecimal string. */
export function randomHex(length: number): string {
  return [...randomBytes(Math.ceil(length / 2))].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, length)
}

/** A random base64url string with no padding, useful for tokens. */
export function randomToken(bytes: number): string {
  const buffer = randomBytes(bytes)
  let binary = ''
  for (const byte of buffer) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Pick one element uniformly. */
export function pick<T>(items: readonly T[]): T {
  if (items.length === 0) throw new RandomError('Cannot pick from an empty list')
  return items[randomInt(items.length)]
}

export interface PasswordOptions {
  length: number
  sets: CharSetName[]
  /** Require at least one character from every selected set. */
  requireEach?: boolean
}

/** Generate a password from the selected character sets. */
export function randomPassword(options: PasswordOptions): string {
  const sets = options.sets.filter((name) => name in CHAR_SETS)
  if (sets.length === 0) throw new RandomError('Select at least one character set')
  if (!Number.isInteger(options.length) || options.length < 1) throw new RandomError('The length must be at least 1')
  if (options.requireEach && options.length < sets.length) throw new RandomError('The length is shorter than the number of character sets')

  const pools = sets.map((name) => CHAR_SETS[name])
  const all = pools.join('')
  const chars: string[] = []

  if (options.requireEach) for (const pool of pools) chars.push(pool[randomInt(pool.length)])
  while (chars.length < options.length) chars.push(all[randomInt(all.length)])

  // Fisher-Yates shuffle so the guaranteed characters are not always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

/** Shuffle a copy of a list. */
export function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** A random passphrase drawn from a word list. */
export function randomPassphrase(words: readonly string[], count: number, separator = '-', digits = 0): string {
  if (words.length === 0) throw new RandomError('The word list is empty')
  if (!Number.isInteger(count) || count < 1) throw new RandomError('Choose at least one word')
  const parts: string[] = []
  for (let i = 0; i < count; i++) {
    const word = pick(words)
    parts.push(digits > 0 ? `${word}${randomInt(10 ** digits).toString().padStart(digits, '0')}` : word)
  }
  return parts.join(separator)
}

/** A random integer in a range, returned as a string for display. */
export function randomNumberString(min: number, max: number): string {
  return String(randomBetween(min, max))
}
