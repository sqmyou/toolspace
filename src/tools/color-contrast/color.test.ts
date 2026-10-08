import { describe, expect, it } from 'vitest'
import { bestTextColor, ColorError, composite, contrastRatio, hslToRgb, mix, parseColor, relativeLuminance, report, suggestForeground, toHex, toHsl, toHslString, toRgbString, wcagLevel } from './color'

const white = parseColor('#ffffff')
const black = parseColor('#000000')

describe('parseColor', () => {
  it('parses long and short hex', () => {
    expect(parseColor('#ff0000')).toEqual({ r: 255, g: 0, b: 0, a: 1 })
    expect(parseColor('#f00')).toEqual({ r: 255, g: 0, b: 0, a: 1 })
    expect(parseColor('00ff00')).toEqual({ r: 0, g: 255, b: 0, a: 1 })
  })

  it('parses hex with alpha', () => {
    expect(parseColor('#ff000080').a).toBeCloseTo(0.502, 2)
    expect(parseColor('#f008').a).toBeCloseTo(0.533, 2)
  })

  it('parses rgb and rgba', () => {
    expect(parseColor('rgb(1, 2, 3)')).toEqual({ r: 1, g: 2, b: 3, a: 1 })
    expect(parseColor('rgba(1, 2, 3, 0.5)')).toEqual({ r: 1, g: 2, b: 3, a: 0.5 })
    expect(parseColor('rgb(1 2 3 / 50%)')).toEqual({ r: 1, g: 2, b: 3, a: 0.5 })
  })

  it('parses hsl and hsla', () => {
    expect(parseColor('hsl(0, 100%, 50%)')).toEqual({ r: 255, g: 0, b: 0, a: 1 })
    expect(parseColor('hsla(120, 100%, 25%, 0.5)').a).toBe(0.5)
  })

  it('clamps channels out of range', () => {
    expect(parseColor('rgb(300, -20, 128)')).toEqual({ r: 255, g: 0, b: 128, a: 1 })
  })

  it('rejects nonsense', () => {
    expect(() => parseColor('')).toThrow(ColorError)
    expect(() => parseColor('not-a-colour')).toThrow(ColorError)
    expect(() => parseColor('#12345')).toThrow(ColorError)
  })
})

describe('conversions', () => {
  it('round-trips through hex', () => {
    expect(toHex(parseColor('rgb(18, 52, 86)'))).toBe('#123456')
    expect(toHex(parseColor('#ff000080'))).toBe('#ff000080')
  })

  it('writes rgb strings', () => {
    expect(toRgbString(parseColor('#123456'))).toBe('rgb(18, 52, 86)')
    expect(toRgbString(parseColor('rgba(1,2,3,0.5)'))).toBe('rgba(1, 2, 3, 0.5)')
  })

  it('converts to hsl', () => {
    const hsl = toHsl(parseColor('#ff0000'))
    expect(hsl.h).toBe(0)
    expect(hsl.s).toBe(100)
    expect(hsl.l).toBe(50)
    expect(toHslString(parseColor('#00ff00'))).toBe('hsl(120, 100%, 50%)')
  })

  it('round-trips hsl to rgb', () => {
    expect(hslToRgb({ h: 240, s: 100, l: 50, a: 1 })).toEqual({ r: 0, g: 0, b: 255, a: 1 })
    expect(hslToRgb({ h: 0, s: 0, l: 0, a: 1 })).toEqual({ r: 0, g: 0, b: 0, a: 1 })
  })

  it('handles achromatic colours', () => {
    expect(toHsl(parseColor('#808080')).s).toBe(0)
  })
})

describe('composite / mix', () => {
  it('composites alpha over a backdrop', () => {
    const result = composite({ r: 0, g: 0, b: 0, a: 0.5 }, white)
    expect(result.r).toBeCloseTo(127.5)
    expect(result.a).toBe(1)
  })

  it('returns the front colour when fully opaque', () => {
    expect(composite({ r: 10, g: 20, b: 30, a: 1 }, white)).toEqual({ r: 10, g: 20, b: 30, a: 1 })
  })

  it('mixes two colours', () => {
    expect(mix(black, white, 0.5).r).toBe(128)
    expect(mix(black, white, 0)).toEqual(black)
    expect(mix(black, white, 1)).toEqual(white)
  })
})

describe('relativeLuminance', () => {
  it('is zero for black and one for white', () => {
    expect(relativeLuminance(black)).toBe(0)
    expect(relativeLuminance(white)).toBe(1)
  })

  it('uses the linear segment for very dark colours', () => {
    // rgb(10,10,10) is below the 0.03928 cut-off.
    expect(relativeLuminance(parseColor('#0a0a0a'))).toBeCloseTo(0.003035, 6)
  })
})

describe('contrastRatio', () => {
  it('gives 21 for black on white', () => {
    expect(contrastRatio(black, white)).toBeCloseTo(21, 5)
  })

  it('gives 1 for a colour against itself', () => {
    expect(contrastRatio(white, white)).toBeCloseTo(1, 5)
  })

  it('is symmetric', () => {
    const a = parseColor('#123456')
    const b = parseColor('#abcdef')
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10)
  })

  it('composites a translucent colour first', () => {
    const translucent = { r: 0, g: 0, b: 0, a: 0.5 }
    const ratio = contrastRatio(translucent, white)
    const expected = contrastRatio(composite(translucent, white), white)
    expect(ratio).toBeCloseTo(expected, 10)
  })
})

describe('wcagLevel', () => {
  it('classifies normal text', () => {
    expect(wcagLevel(21)).toBe('AAA')
    expect(wcagLevel(5)).toBe('AA')
    expect(wcagLevel(3.5)).toBe('AA Large')
    expect(wcagLevel(2)).toBe('Fail')
  })

  it('relaxes the thresholds for large text', () => {
    expect(wcagLevel(4.5, true)).toBe('AAA')
    expect(wcagLevel(3.1, true)).toBe('AA')
    expect(wcagLevel(2.9, true)).toBe('Fail')
  })
})

describe('report', () => {
  it('summarises a strong pairing', () => {
    const result = report(black, white)
    expect(result.ratio).toBeCloseTo(21, 5)
    expect(result.normal).toBe('AAA')
    expect(result.normalPass).toBe(true)
    expect(result.aaaPass).toBe(true)
  })

  it('summarises a weak pairing', () => {
    const result = report(parseColor('#999999'), white)
    expect(result.normalPass).toBe(false)
    expect(result.largePass).toBe(false)
  })

  it('passes large text when normal text fails', () => {
    // #777777 on white is about 4.48:1, enough for large text but not body copy.
    const result = report(parseColor('#777777'), white)
    expect(result.normalPass).toBe(false)
    expect(result.largePass).toBe(true)
  })
})

describe('bestTextColor', () => {
  it('picks black on light backgrounds', () => {
    expect(bestTextColor(white).r).toBe(0)
  })

  it('picks white on dark backgrounds', () => {
    expect(bestTextColor(parseColor('#111111')).r).toBe(255)
  })
})

describe('suggestForeground', () => {
  it('returns the input when it already passes', () => {
    expect(suggestForeground(black, white, 4.5)).toEqual(black)
  })

  it('darkens a light colour on a light background', () => {
    const suggestion = suggestForeground(parseColor('#aaaaaa'), white, 4.5)
    expect(contrastRatio(suggestion, white)).toBeGreaterThanOrEqual(4.5)
    expect(relativeLuminance(suggestion)).toBeLessThan(relativeLuminance(parseColor('#aaaaaa')))
  })

  it('lightens a dark colour on a dark background', () => {
    const suggestion = suggestForeground(parseColor('#333333'), black, 4.5)
    expect(contrastRatio(suggestion, black)).toBeGreaterThanOrEqual(4.5)
  })
})
