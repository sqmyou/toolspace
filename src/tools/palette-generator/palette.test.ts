import { describe, expect, it } from 'vitest'
import {
  ColorError,
  contrastRatio,
  generateShades,
  harmonies,
  hslToRgb,
  parseHex,
  readableInk,
  rgbToHsl,
  toCssVariables,
  toHex,
} from './palette'

describe('parseHex', () => {
  it('parses six and three digit hex', () => {
    expect(parseHex('#ff0000')).toEqual({ r: 255, g: 0, b: 0 })
    expect(parseHex('f00')).toEqual({ r: 255, g: 0, b: 0 })
    expect(parseHex('#00ff00')).toEqual({ r: 0, g: 255, b: 0 })
  })

  it('rejects bad input', () => {
    expect(() => parseHex('nope')).toThrow(ColorError)
    expect(() => parseHex('#12345')).toThrow(ColorError)
  })
})

describe('toHex', () => {
  it('round-trips', () => {
    expect(toHex(parseHex('#3366cc'))).toBe('#3366cc')
  })

  it('clamps out-of-range channels', () => {
    expect(toHex({ r: 300, g: -5, b: 128 })).toBe('#ff0080')
  })
})

describe('rgb/hsl', () => {
  it('converts a known colour', () => {
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 })
    expect(rgbToHsl({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, l: 0 })
  })

  it('round-trips through hsl', () => {
    const original = parseHex('#3b82f6')
    const { h, s, l } = rgbToHsl(original)
    expect(toHex(hslToRgb(h, s, l))).toBe('#3b82f6')
  })
})

describe('contrast', () => {
  it('scores black on white at 21:1', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 1)
  })

  it('scores a colour against itself at 1:1', () => {
    expect(contrastRatio({ r: 100, g: 100, b: 100 }, { r: 100, g: 100, b: 100 })).toBeCloseTo(1, 2)
  })

  it('picks the readable ink for a background', () => {
    expect(readableInk({ r: 255, g: 255, b: 255 })).toBe('#000000')
    expect(readableInk({ r: 0, g: 0, b: 0 })).toBe('#ffffff')
  })
})

describe('generateShades', () => {
  it('produces a full ramp with the base at 500', () => {
    const shades = generateShades(parseHex('#3b82f6'))
    expect(shades).toHaveLength(11)
    expect(shades.find((s) => s.step === 500)!.hex).toBe('#3b82f6')
  })

  it('gets lighter above 500 and darker below', () => {
    const shades = generateShades(parseHex('#3b82f6'))
    const l50 = parseHex(shades.find((s) => s.step === 50)!.hex)
    const l950 = parseHex(shades.find((s) => s.step === 950)!.hex)
    expect(rgbToHsl(l50).l).toBeGreaterThan(rgbToHsl(l950).l)
  })

  it('gives every swatch a readable ink', () => {
    for (const swatch of generateShades(parseHex('#3b82f6'))) {
      expect(swatch.ratioWithInk).toBeGreaterThan(1)
    }
  })
})

describe('harmonies', () => {
  it('includes the base and a complement', () => {
    const list = harmonies(parseHex('#ff0000'))
    expect(list[0]).toEqual({ name: 'Base', hex: '#ff0000' })
    expect(list.find((h) => h.name === 'Complement')!.hex).toBe('#00ffff')
  })
})

describe('toCssVariables', () => {
  it('emits custom properties', () => {
    const css = toCssVariables(generateShades(parseHex('#3b82f6')), 'brand')
    expect(css).toContain('--brand-500: #3b82f6;')
    expect(css.startsWith(':root {')).toBe(true)
  })

  it('falls back to a default prefix', () => {
    expect(toCssVariables(generateShades(parseHex('#000')), '  ')).toContain('--color-500')
  })
})
