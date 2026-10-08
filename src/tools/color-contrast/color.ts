/**
 * Colour parsing and WCAG contrast.
 *
 * Colours are held as 0-255 channels with a 0-1 alpha. Relative luminance uses
 * the WCAG 2.1 formula, including the small-value linear segment, because
 * skipping it changes the contrast ratio for dark colours. Alpha is composited
 * against an opaque backdrop before measuring, since contrast only makes sense
 * between two solid colours.
 */

export class ColorError extends Error {}

export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

export interface Hsl {
  h: number
  s: number
  l: number
  a: number
}

const HEX = /^#?([0-9a-f]{3,8})$/i
const RGB = /^rgba?\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+(-?[\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i
const HSL = /^hsla?\(\s*(-?[\d.]+)(?:deg)?[\s,]+(-?[\d.]+)%?[\s,]+(-?[\d.]+)%?(?:[\s,/]+([\d.]+%?))?\s*\)$/i

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function alphaFrom(text: string | undefined): number {
  if (text === undefined) return 1
  const value = text.endsWith('%') ? Number(text.slice(0, -1)) / 100 : Number(text)
  if (!Number.isFinite(value)) throw new ColorError(`"${text}" is not a valid alpha`)
  return clamp(value, 0, 1)
}

/** Parse a hex, rgb() or hsl() colour. */
export function parseColor(input: string): Rgba {
  const text = input.trim()
  if (!text) throw new ColorError('Enter a colour')

  const hex = HEX.exec(text)
  if (hex) {
    let body = hex[1]
    if (body.length === 3 || body.length === 4) body = [...body].map((char) => char + char).join('')
    if (body.length !== 6 && body.length !== 8) throw new ColorError('A hex colour needs 3, 4, 6 or 8 digits')
    return {
      r: parseInt(body.slice(0, 2), 16),
      g: parseInt(body.slice(2, 4), 16),
      b: parseInt(body.slice(4, 6), 16),
      a: body.length === 8 ? parseInt(body.slice(6, 8), 16) / 255 : 1,
    }
  }

  const rgb = RGB.exec(text)
  if (rgb) {
    return {
      r: clamp(Math.round(Number(rgb[1])), 0, 255),
      g: clamp(Math.round(Number(rgb[2])), 0, 255),
      b: clamp(Math.round(Number(rgb[3])), 0, 255),
      a: alphaFrom(rgb[4]),
    }
  }

  const hsl = HSL.exec(text)
  if (hsl) return hslToRgb({ h: Number(hsl[1]), s: Number(hsl[2]), l: Number(hsl[3]), a: alphaFrom(hsl[4]) })

  throw new ColorError(`"${text}" is not a colour this tool understands`)
}

function channel(value: number): string {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')
}

/** Hex form, with the alpha pair only when the colour is translucent. */
export function toHex(color: Rgba): string {
  const base = `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`
  return color.a < 1 ? `${base}${channel(color.a * 255)}` : base
}

export function toRgbString(color: Rgba): string {
  const r = Math.round(color.r)
  const g = Math.round(color.g)
  const b = Math.round(color.b)
  return color.a < 1 ? `rgba(${r}, ${g}, ${b}, ${Number(color.a.toFixed(3))})` : `rgb(${r}, ${g}, ${b})`
}

export function toHsl(color: Rgba): Hsl {
  const r = color.r / 255
  const g = color.g / 255
  const b = color.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2
  const delta = max - min

  if (delta === 0) return { h: 0, s: 0, l: lightness * 100, a: color.a }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  let hue: number
  if (max === r) hue = ((g - b) / delta) % 6
  else if (max === g) hue = (b - r) / delta + 2
  else hue = (r - g) / delta + 4
  return { h: (hue * 60 + 360) % 360, s: saturation * 100, l: lightness * 100, a: color.a }
}

export function toHslString(color: Rgba): string {
  const hsl = toHsl(color)
  const round = (value: number) => Number(value.toFixed(1))
  return hsl.a < 1 ? `hsla(${round(hsl.h)}, ${round(hsl.s)}%, ${round(hsl.l)}%, ${Number(hsl.a.toFixed(3))})` : `hsl(${round(hsl.h)}, ${round(hsl.s)}%, ${round(hsl.l)}%)`
}

export function hslToRgb(color: Hsl): Rgba {
  const h = ((color.h % 360) + 360) % 360
  const s = clamp(color.s, 0, 100) / 100
  const l = clamp(color.l, 0, 100) / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255), a: clamp(color.a ?? 1, 0, 1) }
}

/** Composite a translucent colour over an opaque backdrop. */
export function composite(color: Rgba, backdrop: Rgba): Rgba {
  const a = color.a + backdrop.a * (1 - color.a)
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 }
  const mix = (front: number, back: number) => (front * color.a + back * backdrop.a * (1 - color.a)) / a
  return { r: mix(color.r, backdrop.r), g: mix(color.g, backdrop.g), b: mix(color.b, backdrop.b), a }
}

/** WCAG 2.1 relative luminance, 0 for black and 1 for white. */
export function relativeLuminance(color: Rgba): number {
  const linear = (value: number) => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b)
}

/** Contrast ratio between two colours, from 1 to 21. */
export function contrastRatio(first: Rgba, second: Rgba, backdrop: Rgba = { r: 255, g: 255, b: 255, a: 1 }): number {
  const a = relativeLuminance(first.a < 1 ? composite(first, backdrop) : first)
  const b = relativeLuminance(second.a < 1 ? composite(second, backdrop) : second)
  const lighter = Math.max(a, b)
  const darker = Math.min(a, b)
  return (lighter + 0.05) / (darker + 0.05)
}

export type WcagLevel = 'AAA' | 'AA' | 'AA Large' | 'Fail'

/** WCAG pass level. Large text is 18.66px bold or 24px regular and up. */
export function wcagLevel(ratio: number, large = false): WcagLevel {
  const aa = large ? 3 : 4.5
  const aaa = large ? 4.5 : 7
  if (ratio >= aaa) return 'AAA'
  if (ratio >= aa) return 'AA'
  if (ratio >= 3) return 'AA Large'
  return 'Fail'
}

/** Black or white, whichever contrasts more with the background. */
export function bestTextColor(background: Rgba): Rgba {
  const black = { r: 0, g: 0, b: 0, a: 1 }
  const white = { r: 255, g: 255, b: 255, a: 1 }
  return contrastRatio(black, background) >= contrastRatio(white, background) ? black : white
}

/** Nudge a colour's lightness until it reaches the target ratio. */
export function suggestForeground(foreground: Rgba, background: Rgba, target = 4.5): Rgba {
  if (contrastRatio(foreground, background) >= target) return foreground
  const hsl = toHsl(foreground)
  const goDarker = relativeLuminance(background) > 0.5

  for (let step = 1; step <= 100; step++) {
    const lightness = goDarker ? hsl.l - step : hsl.l + step
    if (lightness < 0 || lightness > 100) break
    const candidate = hslToRgb({ ...hsl, l: lightness })
    if (contrastRatio(candidate, background) >= target) return candidate
  }
  return goDarker ? { r: 0, g: 0, b: 0, a: 1 } : { r: 255, g: 255, b: 255, a: 1 }
}

/** Mix two colours by weight, 0 returning the first and 1 the second. */
export function mix(first: Rgba, second: Rgba, weight: number): Rgba {
  const w = clamp(weight, 0, 1)
  return {
    r: Math.round(first.r + (second.r - first.r) * w),
    g: Math.round(first.g + (second.g - first.g) * w),
    b: Math.round(first.b + (second.b - first.b) * w),
    a: first.a + (second.a - first.a) * w,
  }
}

export interface ContrastReport {
  ratio: number
  normal: WcagLevel
  large: WcagLevel
  normalPass: boolean
  largePass: boolean
  aaaPass: boolean
}

export function report(foreground: Rgba, background: Rgba, backdrop?: Rgba): ContrastReport {
  const ratio = contrastRatio(foreground, background, backdrop)
  const normal = wcagLevel(ratio, false)
  const large = wcagLevel(ratio, true)
  return {
    ratio,
    normal,
    large,
    normalPass: normal !== 'Fail' && normal !== 'AA Large',
    largePass: large !== 'Fail',
    aaaPass: normal === 'AAA',
  }
}
