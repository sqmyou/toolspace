/** Per-character Unicode inspection and HTML entity encode/decode. */

export interface CharInfo {
  char: string
  codePoint: number
  /** Inclusive UTF-16 index of the first code unit. */
  index: number
  /** Uppercase hex, e.g. "1F600". */
  hex: string
  decimal: string
  /** U+XXXX form. */
  unicode: string
  /** \uXXXX or \u{XXXXX} escape for JS string literals. */
  js: string
  /** HTML numeric entity. */
  html: string
  name: string
}

const NAMED: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  "'": '&#39;',
}

export function encodeHtml(input: string): string {
  return [...input]
    .map((char) => {
      if (NAMED[char]) return NAMED[char]
      const code = char.codePointAt(0) ?? 0
      return code > 127 ? `&#${code};` : char
    })
    .join('')
}

/** Decode named and numeric HTML entities. */
export function decodeHtml(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&(lt|gt|amp|quot|apos|nbsp);/g, (_, name) => {
      const table: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: '\u00a0' }
      return table[name] ?? _
    })
}

function nameFor(code: number): string {
  const rev: Record<number, string> = { 60: 'LESS-THAN SIGN', 62: 'GREATER-THAN SIGN', 38: 'AMPERSAND', 34: 'QUOTATION MARK', 39: 'APOSTROPHE' }
  if (rev[code]) return rev[code]
  if (code === 32) return 'SPACE'
  if (code === 9) return 'CHARACTER TABULATION'
  if (code === 10) return 'LINE FEED'
  if (code < 32) return 'CONTROL'
  if (code >= 128 && code <= 159) return 'CONTROL'
  return ''
}

export function inspect(input: string): CharInfo[] {
  const infos: CharInfo[] = []
  let index = 0
  for (const char of input) {
    const codePoint = char.codePointAt(0) ?? 0
    const hex = codePoint.toString(16).toUpperCase()
    infos.push({
      char,
      codePoint,
      index,
      hex,
      decimal: String(codePoint),
      unicode: `U+${hex.padStart(4, '0')}`,
      js: codePoint > 0xffff ? `\\u{${hex}}` : `\\u${hex.padStart(4, '0')}`,
      html: `&#${codePoint};`,
      name: nameFor(codePoint),
    })
    index += char.length
  }
  return infos
}
