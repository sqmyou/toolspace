/**
 * Password generation — the pure part.
 *
 * Everything here is a plain function over plain data so it can be unit
 * tested without a browser. The rendering lives in `index.ts`; this file
 * knows nothing about the DOM.
 */

export interface PasswordOptions {
  length: number
  lowercase: boolean
  uppercase: boolean
  digits: boolean
  symbols: boolean
}

export const CHARSETS = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/',
} as const

export const DEFAULT_OPTIONS: PasswordOptions = {
  length: 20,
  lowercase: true,
  uppercase: true,
  digits: true,
  symbols: true,
}

/** Homoglyph-prone characters that are easy to confuse by eye. */
const AMBIGUOUS = new Set('Il1O0o')

function poolsFor(options: PasswordOptions, avoidAmbiguous: boolean): string[] {
  const pools: string[] = []
  for (const key of ['lowercase', 'uppercase', 'digits', 'symbols'] as const) {
    if (!options[key]) continue
    let chars: string = CHARSETS[key]
    if (avoidAmbiguous && key !== 'symbols') {
      chars = [...chars].filter((c) => !AMBIGUOUS.has(c)).join('')
    }
    if (chars) pools.push(chars)
  }
  return pools
}

/**
 * Return a cryptographically random integer in `[0, max)` without modulo
 * bias. Rejection sampling is the standard technique: draw a 32-bit value,
 * discard anything in the final partial range, and retry.
 */
export function randomInt(max: number, random: () => number): number {
  if (max <= 0) throw new RangeError('max must be positive')
  const limit = Math.floor(0xffffffff / max) * max
  for (;;) {
    const value = Math.floor(random() * 0x100000000)
    if (value < limit) return value % max
  }
}

export class PasswordError extends Error {}

/**
 * Generate a password.
 *
 * `random` defaults to the platform CSPRNG. It is injectable purely so
 * tests can make generation deterministic.
 */
export function generatePassword(
  options: PasswordOptions = DEFAULT_OPTIONS,
  {
    avoidAmbiguous = false,
    random = Math.random,
  }: { avoidAmbiguous?: boolean; random?: () => number } = {},
): string {
  const pools = poolsFor(options, avoidAmbiguous)
  if (pools.length === 0) {
    throw new PasswordError('Select at least one character set.')
  }

  const length = Math.max(1, Math.floor(options.length))
  const all = pools.join('')

  // Seed one character from each requested set so the result always
  // honours the user's selection, then fill the rest from the union.
  const chars: string[] = pools.map((pool) => pool[randomInt(pool.length, random)])
  while (chars.length < length) {
    chars.push(all[randomInt(all.length, random)])
  }

  shuffleInPlace(chars, random)
  return chars.slice(0, length).join('')
}

function shuffleInPlace(items: string[], random: () => number): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, random)
    ;[items[i], items[j]] = [items[j], items[i]]
  }
}

export interface Strength {
  /** 0-4, in the spirit of zxcvbn's coarse buckets. */
  score: number
  label: 'Very weak' | 'Weak' | 'Fair' | 'Strong' | 'Very strong'
  /** Approximate search space as log2(bits). */
  entropyBits: number
}

/** Estimate strength from the generator's own alphabet size. */
export function estimateStrength(password: string, alphabetSize: number): Strength {
  const entropyBits = password.length * Math.log2(Math.max(alphabetSize, 1))
  const score =
    entropyBits >= 128 ? 4 : entropyBits >= 80 ? 3 : entropyBits >= 50 ? 2 : entropyBits >= 30 ? 1 : 0
  const label = (['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'] as const)[score]
  return { score, label, entropyBits }
}

/** Size of the alphabet a password was drawn from. */
export function alphabetSize(options: PasswordOptions, avoidAmbiguous = false): number {
  return poolsFor(options, avoidAmbiguous).join('').length
}
