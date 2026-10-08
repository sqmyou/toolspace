/**
 * Colour conversion and WCAG contrast, implemented from scratch so there is
 * no dependency to load and every value is testable in isolation.
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

export interface Hsl {
  h: number
  s: number
  l: number
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function toHex({ r, g, b }: Rgb): string {
  const part = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`
}

/** Parse `#rgb`, `#rrggbb`, `rgb(r,g,b)` or a bare hex string. */
export function parseColor(input: string): Rgb | null {
  const value = input.trim().toLowerCase()

  const shorthand = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(value)
  if (shorthand) {
    return {
      r: parseInt(shorthand[1] + shorthand[1], 16),
      g: parseInt(shorthand[2] + shorthand[2], 16),
      b: parseInt(shorthand[3] + shorthand[3], 16),
    }
  }

  const long = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(value)
  if (long) {
    return { r: parseInt(long[1], 16), g: parseInt(long[2], 16), b: parseInt(long[3], 16) }
  }

  const functional = /^rgba?\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)/.exec(value)
  if (functional) {
    const [r, g, b] = [functional[1], functional[2], functional[3]].map(Number)
    if ([r, g, b].every((n) => n >= 0 && n <= 255)) return { r, g, b }
  }

  return null
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min
  const l = (max + min) / 2

  let h = 0
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6
    else if (max === gn) h = (bn - rn) / delta + 2
    else h = (rn - gn) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }

  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))
  return { h, s: s * 100, l: l * 100 }
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const sn = clamp(s, 0, 100) / 100
  const ln = clamp(l, 0, 100) / 100
  const c = (1 - Math.abs(2 * ln - 1)) * sn
  const hp = (((h % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))

  let rgb: [number, number, number] = [0, 0, 0]
  if (hp < 1) rgb = [c, x, 0]
  else if (hp < 2) rgb = [x, c, 0]
  else if (hp < 3) rgb = [0, c, x]
  else if (hp < 4) rgb = [0, x, c]
  else if (hp < 5) rgb = [x, 0, c]
  else rgb = [c, 0, x]

  const m = ln - c / 2
  return { r: Math.round((rgb[0] + m) * 255), g: Math.round((rgb[1] + m) * 255), b: Math.round((rgb[2] + m) * 255) }
}

/** sRGB channel to linear light, per the WCAG relative luminance definition. */
function linearize(channel: number): number {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(rgb: Rgb): number {
  return 0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b)
}

/** WCAG 2.1 contrast ratio, from 1 (identical) to 21 (black on white). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return (lighter + 0.05) / (darker + 0.05)
}

export interface ContrastResult {
  ratio: number
  /** 4.5:1 for normal text, 3:1 for large text — both at AA. */
  aaNormal: boolean
  aaLarge: boolean
  aaaNormal: boolean
  aaaLarge: boolean
}

export function evaluateContrast(foreground: Rgb, background: Rgb): ContrastResult {
  const ratio = contrastRatio(foreground, background)
  return {
    ratio,
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaaNormal: ratio >= 7,
    aaaLarge: ratio >= 4.5,
  }
}

export function formatHsl({ h, s, l }: Hsl): string {
  return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`
}

export function formatRgb({ r, g, b }: Rgb): string {
  return `rgb(${r} ${g} ${b})`
}
