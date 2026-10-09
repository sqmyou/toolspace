import { describe, expect, it } from 'vitest'
import {
  fitInside,
  formatRatio,
  gcd,
  heightForWidth,
  parseRatio,
  ratioValue,
  simplify,
  widthForHeight,
} from './aspect'

describe('gcd', () => {
  it('finds the greatest common divisor', () => {
    expect(gcd(1920, 1080)).toBe(120)
    expect(gcd(7, 13)).toBe(1)
  })

  it('handles zero and negatives', () => {
    expect(gcd(0, 5)).toBe(5)
    expect(gcd(-12, 8)).toBe(4)
  })
})

describe('simplify', () => {
  it('reduces common screen sizes to their known ratios', () => {
    expect(simplify(1920, 1080)).toEqual([16, 9])
    expect(simplify(3840, 2160)).toEqual([16, 9])
    expect(simplify(1080, 1080)).toEqual([1, 1])
    expect(simplify(1080, 1350)).toEqual([4, 5])
    expect(simplify(800, 600)).toEqual([4, 3])
  })

  it('leaves an already-coprime pair alone', () => {
    expect(simplify(7, 13)).toEqual([7, 13])
  })

  it('rejects non-positive or non-finite sizes', () => {
    expect(() => simplify(0, 100)).toThrow()
    expect(() => simplify(100, -5)).toThrow()
    expect(() => simplify(Number.NaN, 5)).toThrow()
  })
})

describe('formatRatio', () => {
  it('prints the simplified ratio', () => {
    expect(formatRatio(1920, 1080)).toBe('16:9')
  })
})

describe('ratioValue', () => {
  it('gives width over height', () => {
    expect(ratioValue(1920, 1080)).toBeCloseTo(1.7778, 3)
    expect(ratioValue(100, 100)).toBe(1)
  })

  it('refuses a zero height', () => {
    expect(() => ratioValue(100, 0)).toThrow()
  })
})

describe('heightForWidth / widthForHeight', () => {
  it('solves the missing side', () => {
    expect(heightForWidth(1280, [16, 9])).toBe(720)
    expect(widthForHeight(720, [16, 9])).toBe(1280)
  })

  it('round-trips', () => {
    const height = heightForWidth(1920, [21, 9])
    expect(widthForHeight(height, [21, 9])).toBeCloseTo(1920, 6)
  })

  it('rejects a broken ratio', () => {
    expect(() => heightForWidth(100, [0, 9])).toThrow()
  })
})

describe('fitInside', () => {
  it('fits a 16:9 image inside a 4:3 box without distorting it', () => {
    const result = fitInside(1920, 1080, 1024, 768)
    // Width is the binding constraint here: 1024 / 1920 = 0.5333 → 1024 × 576.
    expect(result.width).toBe(1024)
    expect(result.height).toBe(576)
    expect(result.scale).toBeCloseTo(1024 / 1920, 6)
  })

  it('fits a tall image inside a wide box', () => {
    const result = fitInside(1080, 1920, 800, 800)
    expect(result.width).toBe(450)
    expect(result.height).toBe(800)
  })

  it('scales up when the box is bigger than the image', () => {
    expect(fitInside(100, 100, 400, 400).width).toBe(400)
  })

  it('rejects a zero-sized box', () => {
    expect(() => fitInside(100, 100, 0, 400)).toThrow()
  })
})

describe('parseRatio', () => {
  it('accepts the common separators', () => {
    expect(parseRatio('16:9')).toEqual([16, 9])
    expect(parseRatio('16/9')).toEqual([16, 9])
    expect(parseRatio('16x9')).toEqual([16, 9])
    expect(parseRatio('16 × 9')).toEqual([16, 9])
  })

  it('rejects anything that is not a pair of positive numbers', () => {
    expect(() => parseRatio('16')).toThrow()
    expect(() => parseRatio('16:0')).toThrow()
    expect(() => parseRatio('wide')).toThrow()
  })
})
