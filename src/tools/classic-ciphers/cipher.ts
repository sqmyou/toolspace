/**
 * Classic substitution ciphers.
 *
 * Caesar, ROT13 and Atbash are the same idea (shift or mirror the alphabet), so
 * they share one letter-mapping core and only differ in the map. Morse is a
 * token table with a ` / ` word separator, and the decoder is tolerant of
 * sloppy spacing because that is how people paste it.
 */

const A = 'a'.charCodeAt(0)

/** Shift letters by `shift` places, wrapping the alphabet. Case is preserved. */
export function caesar(text: string, shift: number): string {
  const step = ((Math.trunc(shift) % 26) + 26) % 26
  if (step === 0) return text
  return text.replace(/[a-zA-Z]/g, (char) => {
    const base = char <= 'Z' ? 'A'.charCodeAt(0) : A
    return String.fromCharCode(((char.charCodeAt(0) - base + step) % 26) + base)
  })
}

/** ROT13 is its own inverse, which is why it is used for light obfuscation. */
export function rot13(text: string): string {
  return caesar(text, 13)
}

/** Atbash mirrors the alphabet: a↔z, b↔y, ... */
export function atbash(text: string): string {
  return text.replace(/[a-zA-Z]/g, (char) => {
    const base = char <= 'Z' ? 'A'.charCodeAt(0) : A
    return String.fromCharCode(25 - (char.charCodeAt(0) - base) + base)
  })
}

export const MORSE: Record<string, string> = {
  a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....',
  i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.',
  q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-',
  y: '-.--', z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
  '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--',
  '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...',
  ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-',
  '"': '.-..-.', '$': '...-..-', '@': '.--.-.',
}

const MORSE_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(MORSE).map(([char, code]) => [code, char]),
)

/** Encode text as Morse. Words are separated by ` / `. */
export function toMorse(text: string): string {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      [...word]
        .map((char) => MORSE[char] ?? '')
        .filter(Boolean)
        .join(' '),
    )
    .filter(Boolean)
    .join(' / ')
}

/**
 * Decode Morse. Accepts `/`, `|` or three-or-more spaces as a word separator,
 * and any whitespace between letters, because pasted Morse is inconsistent.
 */
export function fromMorse(text: string): string {
  return text
    .trim()
    .split(/\s*(?:\/|\||\s{3,})\s*/)
    .map((word) =>
      word
        .split(/\s+/)
        .map((code) => MORSE_REVERSE[code] ?? (code === '' ? '' : '?'))
        .join(''),
    )
    .join(' ')
    .trim()
}

export type CipherName = 'rot13' | 'caesar' | 'atbash' | 'morse'

/** Decode a Caesar shift by running the alphabet backwards. */
export function caesarDecode(text: string, shift: number): string {
  return caesar(text, -shift)
}

/** Decode Morse back to text. Provided for symmetry with the other ciphers. */
export function morseDecode(text: string): string {
  return fromMorse(text)
}

/**
 * Every Caesar shift, useful when you do not know the key. Shift 0 is omitted
 * because it is the input unchanged.
 */
export function allCaesarShifts(text: string): { shift: number; text: string }[] {
  return Array.from({ length: 25 }, (_, index) => ({ shift: index + 1, text: caesar(text, index + 1) }))
}
