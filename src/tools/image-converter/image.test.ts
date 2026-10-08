import { describe, expect, it } from 'vitest'
import { fitWithin, formatBytes, isSameAspect, outputName, parseDimensions, rejectReason, scaleByPercent } from './image'

describe('fitWithin', () => {
  it('keeps smaller images as-is', () => {
    expect(fitWithin({ width: 100, height: 50 }, { width: 200, height: 200 })).toEqual({ width: 100, height: 50 })
  })

  it('scales down preserving the aspect ratio', () => {
    expect(fitWithin({ width: 4000, height: 2000 }, { width: 1000, height: 1000 })).toEqual({ width: 1000, height: 500 })
    expect(fitWithin({ width: 2000, height: 4000 }, { width: 500, height: 1000 })).toEqual({ width: 500, height: 1000 })
  })

  it('never returns zero dimensions', () => {
    const result = fitWithin({ width: 10000, height: 1 }, { width: 10, height: 10 })
    expect(result.width).toBeGreaterThanOrEqual(1)
    expect(result.height).toBeGreaterThanOrEqual(1)
  })
})

describe('scaleByPercent', () => {
  it('scales by a percentage', () => {
    expect(scaleByPercent({ width: 800, height: 600 }, 50)).toEqual({ width: 400, height: 300 })
    expect(scaleByPercent({ width: 800, height: 600 }, 150)).toEqual({ width: 1200, height: 900 })
  })

  it('clamps to at least 1%', () => {
    expect(scaleByPercent({ width: 800, height: 600 }, 0)).toEqual({ width: 8, height: 6 })
  })
})

describe('isSameAspect', () => {
  it('detects matching and mismatched ratios', () => {
    expect(isSameAspect({ width: 800, height: 600 }, { width: 400, height: 300 })).toBe(true)
    expect(isSameAspect({ width: 800, height: 600 }, { width: 400, height: 400 })).toBe(false)
  })

  it('handles zero dimensions', () => {
    expect(isSameAspect({ width: 0, height: 0 }, { width: 1, height: 1 })).toBe(false)
  })
})

describe('formatBytes', () => {
  it('formats across units', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.00 MB')
  })
})

describe('outputName', () => {
  it('swaps the extension and sanitises the base', () => {
    expect(outputName('Holiday Photo.png', 'image/jpeg')).toBe('Holiday_Photo.jpg')
    expect(outputName('no-extension', 'image/webp')).toBe('no-extension.webp')
    expect(outputName('!!!.png', 'image/png')).toBe('_.png')
  })
})

describe('parseDimensions', () => {
  it('accepts positive numbers only', () => {
    expect(parseDimensions('120')).toBe(120)
    expect(parseDimensions('12.9')).toBe(12)
    expect(parseDimensions('0')).toBeNull()
    expect(parseDimensions('abc')).toBeNull()
    expect(parseDimensions('-5')).toBeNull()
  })
})

describe('rejectReason', () => {
  it('flags SVG, GIF and non-images', () => {
    expect(rejectReason('image/svg+xml')).toContain('SVG')
    expect(rejectReason('image/gif')).toContain('GIF')
    expect(rejectReason('application/pdf')).toContain('not an image')
    expect(rejectReason('image/png')).toBeNull()
  })
})
