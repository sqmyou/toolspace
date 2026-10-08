import { describe, expect, it } from 'vitest'
import {
  contrastRatio,
  evaluateContrast,
  formatHsl,
  formatRgb,
  hslToRgb,
  parseColor,
  relativeLuminance,
  rgbToHsl,
  toHex,
  type Rgb,
} from './color'

const BLACK: Rgb = { r: 0, g: 0, b: 0 }
const WHITE: Rgb = { r: 255, g: 255, b: 255 }

describe('parseColor', () => {
  it('parses long hex with and without the hash', () => {
    expect(parseColor('#ff8800')).toEqual({ r: 255, g: 136, b: 0 })
    expect(parseColor('ff8800')).toEqual({ r: 255, g: 136, b: 0 })
  })

  it('expands shorthand hex', () => {
    expect(parseColor('#f80')).toEqual({ r: 255, g: 136, b: 0 })
  })

  it('parses rgb() notation', () => {
    expect(parseColor('rgb(255, 136, 0)')).toEqual({ r: 255, g: 136, b: 0 })
    expect(parseColor('rgb(255 136 0)')).toEqual({ r: 255, g: 136, b: 0 })
  })

  it('rejects nonsense', () => {
    expect(parseColor('not a colour')).toBeNull()
    expect(parseColor('')).toBeNull()
    expect(parseColor('rgb(300, 0, 0)')).toBeNull()
  })
})

describe('conversions', () => {
  it('round-trips rgb -> hsl -> rgb', () => {
    const original: Rgb = { r: 64, g: 128, b: 192 }
    const back = hslToRgb(rgbToHsl(original))
    expect(back.r).toBeCloseTo(original.r, 0)
    expect(back.g).toBeCloseTo(original.g, 0)
    expect(back.b).toBeCloseTo(original.b, 0)
  })

  it('maps white to zero saturation and full lightness', () => {
    const hsl = rgbToHsl(WHITE)
    expect(hsl.s).toBe(0)
    expect(Math.round(hsl.l)).toBe(100)
  })

  it('formats hex with padding', () => {
    expect(toHex({ r: 1, g: 2, b: 3 })).toBe('#010203')
    expect(toHex(WHITE)).toBe('#ffffff')
  })

  it('formats rgb and hsl strings', () => {
    expect(formatRgb({ r: 1, g: 2, b: 3 })).toBe('rgb(1 2 3)')
    expect(formatHsl({ h: 180.4, s: 50.6, l: 25.2 })).toBe('hsl(180 51% 25%)')
  })
})

describe('contrast', () => {
  it('gives 21:1 for black on white', () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 0)
  })

  it('gives 1:1 for identical colours', () => {
    expect(contrastRatio(WHITE, WHITE)).toBeCloseTo(1, 5)
  })

  it('is symmetric', () => {
    const a: Rgb = { r: 10, g: 20, b: 30 }
    expect(contrastRatio(a, WHITE)).toBeCloseTo(contrastRatio(WHITE, a), 10)
  })

  it('computes relative luminance extremes', () => {
    expect(relativeLuminance(BLACK)).toBeCloseTo(0, 5)
    expect(relativeLuminance(WHITE)).toBeCloseTo(1, 5)
  })

  it('passes all checks for black on white', () => {
    expect(evaluateContrast(BLACK, WHITE)).toEqual({
      ratio: expect.any(Number),
      aaNormal: true,
      aaLarge: true,
      aaaNormal: true,
      aaaLarge: true,
    })
  })

  it('fails every check for near-identical colours', () => {
    const a: Rgb = { r: 128, g: 128, b: 128 }
    const b: Rgb = { r: 130, g: 130, b: 130 }
    const result = evaluateContrast(a, b)
    expect(result.aaNormal).toBe(false)
    expect(result.aaaLarge).toBe(false)
  })
})
