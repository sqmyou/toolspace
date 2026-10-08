/** Colour maths for the palette generator: parsing, mixing and contrast. */

export interface Rgb {
  r: number
  g: number
  b: number
}

export class ColorError extends Error {}

export function parseHex(input: string): Rgb {
  let hex = input.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(hex)) hex = hex.split('').map((c) => c + c).join('')
  if (!/^[0-9a-f]{6}$/i.test(hex)) throw new ColorError(`"${input}" is not a hex colour.`)
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  }
}

export function toHex({ r, g, b }: Rgb): string {
  const part = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`
}

export function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: l * 100 }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  return { h: h * 60, s: s * 100, l: l * 100 }
}

export function hslToRgb(h: number, s: number, l: number): Rgb {
  const sn = s / 100
  const ln = l / 100
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

/** Lighten (amount > 0) or darken (amount < 0) by mixing toward white or black. */
export function mix(color: Rgb, amount: number): Rgb {
  const target = amount >= 0 ? 255 : 0
  const ratio = Math.abs(amount)
  return {
    r: color.r + (target - color.r) * ratio,
    g: color.g + (target - color.g) * ratio,
    b: color.b + (target - color.b) * ratio,
  }
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const l1 = relativeLuminance(a)
  const l2 = relativeLuminance(b)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

export function readableInk(background: Rgb): string {
  return contrastRatio(background, { r: 0, g: 0, b: 0 }) >= contrastRatio(background, { r: 255, g: 255, b: 255 })
    ? '#000000'
    : '#ffffff'
}

export interface Swatch {
  step: number
  hex: string
  ink: string
  ratioWithInk: number
}

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

/**
 * Build a tint/shade ramp around a base colour.
 *
 * The base colour sits at 500. Lighter steps mix toward white and darker steps
 * toward black, in uneven amounts so the ramp reads like a design-system scale
 * rather than a linear fade.
 */
export function generateShades(base: Rgb): Swatch[] {
  const lightMix: Record<number, number> = { 50: 0.95, 100: 0.9, 200: 0.75, 300: 0.55, 400: 0.28, 500: 0 }
  const darkMix: Record<number, number> = { 600: 0.16, 700: 0.32, 800: 0.48, 900: 0.62, 950: 0.75 }
  return STEPS.map((step) => {
    let color: Rgb
    if (step <= 500) color = mix(base, lightMix[step])
    else color = mix(base, -darkMix[step])
    const hex = toHex(color)
    const ink = readableInk(color)
    return { step, hex, ink, ratioWithInk: Number(contrastRatio(color, hexToRgbSafe(ink)).toFixed(2)) }
  })
}

function hexToRgbSafe(hex: string): Rgb {
  return parseHex(hex)
}

/** Complementary and triad hues, useful as a starting palette. */
export function harmonies(base: Rgb): { name: string; hex: string }[] {
  const { h, s, l } = rgbToHsl(base)
  return [
    { name: 'Base', hex: toHex(base) },
    { name: 'Complement', hex: toHex(hslToRgb(h + 180, s, l)) },
    { name: 'Triad A', hex: toHex(hslToRgb(h + 120, s, l)) },
    { name: 'Triad B', hex: toHex(hslToRgb(h - 120, s, l)) },
    { name: 'Analogous A', hex: toHex(hslToRgb(h + 30, s, l)) },
    { name: 'Analogous B', hex: toHex(hslToRgb(h - 30, s, l)) },
  ]
}

export function toCssVariables(shades: Swatch[], name: string): string {
  const prefix = name.trim() ? name.trim().replace(/\s+/g, '-').toLowerCase() : 'color'
  return `:root {\n${shades.map((s) => `  --${prefix}-${s.step}: ${s.hex};`).join('\n')}\n}\n`
}
