import { describe, expect, it } from 'vitest'
import { buildClamp, convertAll, toPixels, UnitError } from './units'

describe('toPixels', () => {
  it('treats px as the base', () => {
    expect(toPixels(10, 'px')).toBe(10)
  })

  it('converts rem and em using the root size', () => {
    expect(toPixels(2, 'rem', 16)).toBe(32)
    expect(toPixels(1, 'em', 20)).toBe(20)
  })

  it('converts absolute units at 96dpi', () => {
    expect(toPixels(1, 'in')).toBe(96)
    expect(toPixels(72, 'pt')).toBeCloseTo(96)
    expect(toPixels(1, 'pc')).toBe(16)
    expect(toPixels(2.54, 'cm')).toBeCloseTo(96)
    expect(toPixels(25.4, 'mm')).toBeCloseTo(96)
  })

  it('rejects non-numbers', () => {
    expect(() => toPixels(Number.NaN, 'px')).toThrow(UnitError)
  })
})

describe('convertAll', () => {
  it('returns a row for every unit', () => {
    const rows = convertAll(16, 'px')
    expect(rows).toHaveLength(9)
    expect(rows.find((r) => r.unit === 'rem')!.value).toBe(1)
    expect(rows.find((r) => r.unit === 'pt')!.value).toBeCloseTo(12)
  })

  it('rounds to the requested precision', () => {
    const rows = convertAll(1, 'px', 16, 2)
    expect(rows.find((r) => r.unit === 'rem')!.value).toBe(0.06)
  })
})

describe('buildClamp', () => {
  it('builds a clamp from a linear ramp', () => {
    const result = buildClamp({ minSize: 16, maxSize: 24, minViewport: 320, maxViewport: 1200, root: 16 })
    expect(result.css).toBe('clamp(1rem, calc(0.8182rem + 0.9091vw), 1.5rem)')
  })

  it('produces a slope of zero for equal sizes', () => {
    const result = buildClamp({ minSize: 16, maxSize: 16, minViewport: 320, maxViewport: 1200, root: 16 })
    expect(result.slope).toBe(0)
    expect(result.intercept).toBe(1)
  })

  it('rejects an inverted viewport range', () => {
    expect(() => buildClamp({ minSize: 16, maxSize: 24, minViewport: 1200, maxViewport: 320, root: 16 })).toThrow(UnitError)
  })

  it('rejects a non-positive root', () => {
    expect(() => buildClamp({ minSize: 16, maxSize: 24, minViewport: 320, maxViewport: 1200, root: 0 })).toThrow(UnitError)
  })
})
