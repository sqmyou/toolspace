/**
 * Aspect-ratio maths.
 *
 * Everything is integer arithmetic where it can be, so a 1920×1080 image
 * simplifies to exactly 16:9 and not 1.7778:1 — people expect the whole-number
 * ratio a camera or a video spec would print.
 */

/** Greatest common divisor, Euclid's way. */
export function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a))
  b = Math.abs(Math.round(b))
  while (b) {
    const next = a % b
    a = b
    b = next
  }
  return a
}

/** Simplify a width and height to the smallest whole-number ratio. */
export function simplify(width: number, height: number): [number, number] {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Width and height must be positive numbers.')
  }
  const divisor = gcd(width, height) || 1
  return [Math.round(width / divisor), Math.round(height / divisor)]
}

/** `16:9` from `[16, 9]`. */
export function formatRatio(width: number, height: number): string {
  const [a, b] = simplify(width, height)
  return `${a}:${b}`
}

/** Width over height as a single decimal, e.g. 1.778. */
export function ratioValue(width: number, height: number): number {
  if (height === 0) throw new Error('Height cannot be zero.')
  return width / height
}

/** The height that pairs with a width for a given ratio like `16:9`. */
export function heightForWidth(width: number, ratio: [number, number]): number {
  const [a, b] = ratio
  if (a <= 0 || b <= 0) throw new Error('A ratio needs two positive numbers.')
  return (width * b) / a
}

/** The width that pairs with a height for a given ratio like `16:9`. */
export function widthForHeight(height: number, ratio: [number, number]): number {
  const [a, b] = ratio
  if (a <= 0 || b <= 0) throw new Error('A ratio needs two positive numbers.')
  return (height * a) / b
}

export interface Fit {
  width: number
  height: number
  scale: number
  /** Round letterspace the result leaves, in the fitted axis. */
  slack: number
}

/**
 * Scale `width × height` down (or up) to the largest whole-number size that
 * fits inside `maxWidth × maxHeight`, keeping the ratio. This is the "will it
 * fit in this box?" question the tool exists to answer.
 */
export function fitInside(width: number, height: number, maxWidth: number, maxHeight: number): Fit {
  if (width <= 0 || height <= 0) throw new Error('Width and height must be positive.')
  if (maxWidth <= 0 || maxHeight <= 0) throw new Error('The box must have a positive size.')
  const scale = Math.min(maxWidth / width, maxHeight / height)
  const fittedWidth = Math.floor(width * scale)
  const fittedHeight = Math.floor(height * scale)
  return {
    width: fittedWidth,
    height: fittedHeight,
    scale,
    slack: Math.max(maxWidth - fittedWidth, maxHeight - fittedHeight),
  }
}

/** Parse `16:9`, `16/9`, `16x9` or `16 9` into a pair. Throws if unusable. */
export function parseRatio(input: string): [number, number] {
  const parts = input.trim().split(/[:/x×,\s]+/).filter(Boolean).map(Number)
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n) || n <= 0)) {
    throw new Error('Enter a ratio like 16:9.')
  }
  return [parts[0], parts[1]]
}
