/**
 * HTML entity encoding and decoding.
 *
 * A small table covers the characters that actually need escaping, and
 * decoding additionally understands numeric references (&#169; and &#xA9;).
 * Encoding leaves every other character alone, so accented text stays readable
 * rather than turning into a wall of numeric references.
 */

export class EntityError extends Error {}

/** Named entities for the characters that matter in HTML output. */
export const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  copy: '\u00a9',
  reg: '\u00ae',
  trade: '\u2122',
  hellip: '\u2026',
  mdash: '\u2014',
  ndash: '\u2013',
  lsquo: '\u2018',
  rsquo: '\u2019',
  ldquo: '\u201c',
  rdquo: '\u201d',
  bull: '\u2022',
  middot: '\u00b7',
  laquo: '\u00ab',
  raquo: '\u00bb',
  deg: '\u00b0',
  plusmn: '\u00b1',
  times: '\u00d7',
  divide: '\u00f7',
  euro: '\u20ac',
  pound: '\u00a3',
  yen: '\u00a5',
  cent: '\u00a2',
  sect: '\u00a7',
  para: '\u00b6',
  dagger: '\u2020',
  permil: '\u2030',
  prime: '\u2032',
  frac12: '\u00bd',
  frac14: '\u00bc',
  frac34: '\u00be',
  larr: '\u2190',
  rarr: '\u2192',
  harr: '\u2194',
  ne: '\u2260',
  le: '\u2264',
  ge: '\u2265',
  infin: '\u221e',
  alpha: '\u03b1',
  beta: '\u03b2',
  gamma: '\u03b3',
  delta: '\u03b4',
  pi: '\u03c0',
  omega: '\u03c9',
  check: '\u2713',
  cross: '\u2717',
  star: '\u2605',
  heart: '\u2665',
}

const REVERSE = new Map<string, string>()
for (const [name, char] of Object.entries(NAMED)) {
  // Keep the shortest name when several map to the same character.
  if (!REVERSE.has(char) || name.length < REVERSE.get(char)!.length) REVERSE.set(char, name)
}

const DECODE = /&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g

export interface EncodeOptions {
  /** Also escape characters that do not strictly need it, like quotes. */
  quotes?: boolean
  /** Escape every non-ASCII character as a numeric reference. */
  all?: boolean
}

/** Escape the characters that would otherwise break HTML. */
export function encode(input: string, options: EncodeOptions = {}): string {
  const quotes = options.quotes ?? true
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  const pattern = options.all ? (quotes ? /[&<>"']|[^\x20-\x7e]/g : /[&<>]|[^\x20-\x7e]/g) : quotes ? /[&<>"']/g : /[&<>]/g
  return input.replace(pattern, (char) => map[char] ?? `&#${char.codePointAt(0)};`)
}

function decodeReference(body: string): string | null {
  if (body.startsWith('#')) {
    const hex = body[1] === 'x' || body[1] === 'X'
    const code = parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10)
    if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return null
    if (code >= 0xd800 && code <= 0xdfff) return null
    return String.fromCodePoint(code)
  }
  return NAMED[body] ?? null
}

/** Decode entities, leaving anything unknown untouched. */
export function decode(input: string): string {
  return input.replace(DECODE, (match, body: string) => decodeReference(body) ?? match)
}

/** Decode and strip tags, giving readable plain text. */
export function stripTags(input: string): string {
  return decode(input.replace(/<[^>]*>/g, '')).replace(/[ \t]+/g, ' ').trim()
}

export interface EntityInfo {
  char: string
  codePoint: number
  name: string | null
  entity: string
}

/** The characters in a string that have a named entity, in order of first use. */
export function namedEntities(input: string): EntityInfo[] {
  const seen = new Set<string>()
  const rows: EntityInfo[] = []
  for (const char of input) {
    const codePoint = char.codePointAt(0)!
    if (codePoint < 0x20 || seen.has(char)) continue
    const name = REVERSE.get(char)
    if (!name) continue
    seen.add(char)
    rows.push({ char, codePoint, name, entity: `&${name};` })
  }
  return rows
}

/** Every character as its code point, for the inspector view. */
export function codePoints(input: string): EntityInfo[] {
  return [...input].map((char) => ({
    char,
    codePoint: char.codePointAt(0)!,
    name: REVERSE.get(char) ?? null,
    entity: REVERSE.has(char) ? `&${REVERSE.get(char)};` : `&#${char.codePointAt(0)};`,
  }))
}
