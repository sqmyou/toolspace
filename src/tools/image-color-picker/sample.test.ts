import { describe, expect, it } from 'vitest'
import { contrastWithWhite, dominantColors, formatPercent, paletteToCss, paletteToList, readableInk } from './sample'

describe('dominantColors', () => {
  it('returns the most common colour first', () => {
    const pixels = ['#ff0000', '#ff0000', '#ff0000', '#00ff00', '#0000ff']
    const result = dominantColors(pixels)
    expect(result[0].hex).toBe('#ff0000')
    expect(result[0].share).toBeCloseTo(3 / 5)
  })

  it('merges near-identical shades into one entry', () => {
    const pixels = ['#ff0000', '#ff0101', '#fe0000', '#0000ff']
    const result = dominantColors(pixels, 12, 2)
    expect(result).toHaveLength(2)
    expect(result[0].share).toBeCloseTo(3 / 4)
  })

  it('averages a bucket rather than taking its first pixel', () => {
    const result = dominantColors(['#100000', '#300000'], 12, 2)
    expect(result[0].rgb).toEqual({ r: 32, g: 0, b: 0 })
  })

  it('respects the limit', () => {
    const pixels = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#880000', '#008800']
    expect(dominantColors(pixels, 8)).toHaveLength(8)
    expect(dominantColors(pixels, 3)).toHaveLength(3)
  })

  it('keeps the largest clusters when a limit cuts the list', () => {
    const pixels = ['#ff0000', '#ff0000', '#ff0000', '#00ff00', '#00ff00', '#0000ff']
    expect(dominantColors(pixels, 2).map((entry) => entry.hex)).toEqual(['#ff0000', '#00ff00'])
  })

  it('returns nothing for no pixels', () => {
    expect(dominantColors([])).toEqual([])
  })

  it('always reports share relative to every pixel, not just the kept ones', () => {
    const pixels = Array.from({ length: 100 }, (_, i) => (i < 50 ? '#ffffff' : '#000000'))
    const result = dominantColors(pixels, 1)
    expect(result).toHaveLength(1)
    expect(result[0].share).toBeCloseTo(0.5)
  })
})

describe('readableInk', () => {
  it('picks dark ink on light swatches', () => {
    expect(readableInk({ r: 255, g: 255, b: 255 })).toBe('#10131a')
  })

  it('picks light ink on dark swatches', () => {
    expect(readableInk({ r: 0, g: 0, b: 0 })).toBe('#ffffff')
  })
})

describe('contrastWithWhite', () => {
  it('is 21 for black and 1 for white', () => {
    expect(contrastWithWhite({ r: 0, g: 0, b: 0 })).toBeCloseTo(21)
    expect(contrastWithWhite({ r: 255, g: 255, b: 255 })).toBeCloseTo(1)
  })
})

describe('formatPercent', () => {
  it('scales precision to the size of the share', () => {
    expect(formatPercent(0.5)).toBe('50%')
    expect(formatPercent(0.0125)).toBe('1.3%')
    expect(formatPercent(0.00123)).toBe('0.12%')
  })
})

describe('palette export', () => {
  const samples = [
    { hex: '#112233', rgb: { r: 17, g: 34, b: 51 }, share: 0.5 },
    { hex: '#aabbcc', rgb: { r: 170, g: 187, b: 204 }, share: 0.5 },
  ]

  it('writes a css variable block', () => {
    expect(paletteToCss(samples)).toBe(':root {\n  --color-1: #112233;\n  --color-2: #aabbcc;\n}')
  })

  it('writes a plain hex list', () => {
    expect(paletteToList(samples)).toBe('#112233\n#aabbcc')
  })
})
