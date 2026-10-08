import { describe, expect, it } from 'vitest'
import { BezierError, createEasing, evaluate, parseBezier, PRESETS, presetNames, sampleCurve, summarise, toCss } from './bezier'

describe('parseBezier', () => {
  it('reads the CSS function form', () => {
    expect(parseBezier('cubic-bezier(0.42, 0, 0.58, 1)')).toEqual({ x1: 0.42, y1: 0, x2: 0.58, y2: 1 })
  })

  it('reads a bare list of numbers', () => {
    expect(parseBezier('0 0 1 1')).toEqual({ x1: 0, y1: 0, x2: 1, y2: 1 })
  })

  it('resolves preset names', () => {
    expect(parseBezier('ease-in-out')).toEqual(PRESETS['ease-in-out'])
    expect(parseBezier('EASE')).toEqual(PRESETS.ease)
  })

  it('rejects the wrong number of values', () => {
    expect(() => parseBezier('cubic-bezier(0, 0, 1)')).toThrow(BezierError)
    expect(() => parseBezier('')).toThrow(BezierError)
  })

  it('rejects x outside 0-1 but allows overshooting y', () => {
    expect(() => parseBezier('cubic-bezier(1.5, 0, 0.5, 1)')).toThrow(/between 0 and 1/)
    expect(() => parseBezier('cubic-bezier(-0.1, 0, 0.5, 1)')).toThrow(/between 0 and 1/)
    expect(parseBezier('cubic-bezier(0.34, 1.56, 0.64, 1)').y1).toBe(1.56)
  })
})

describe('evaluate', () => {
  it('is pinned at both ends', () => {
    for (const bezier of Object.values(PRESETS)) {
      expect(evaluate(bezier, 0)).toBe(0)
      expect(evaluate(bezier, 1)).toBe(1)
    }
  })

  it('is the identity for linear', () => {
    const easing = createEasing(PRESETS.linear)
    for (const x of [0.1, 0.25, 0.5, 0.75, 0.9]) expect(easing(x)).toBeCloseTo(x, 5)
  })

  it('starts slowly for ease-in', () => {
    expect(evaluate(PRESETS['ease-in'], 0.25)).toBeLessThan(0.25)
  })

  it('starts quickly for ease-out', () => {
    expect(evaluate(PRESETS['ease-out'], 0.25)).toBeGreaterThan(0.25)
  })

  it('is symmetric for ease-in-out', () => {
    const easing = createEasing(PRESETS['ease-in-out'])
    expect(easing(0.5)).toBeCloseTo(0.5, 3)
    expect(easing(0.25) + easing(0.75)).toBeCloseTo(1, 3)
  })

  it('overshoots for a back-out curve', () => {
    expect(evaluate(PRESETS['back out (overshoot)'], 0.7)).toBeGreaterThan(1)
  })

  it('clamps outside the range', () => {
    const easing = createEasing(PRESETS.ease)
    expect(easing(-1)).toBe(0)
    expect(easing(2)).toBe(1)
  })
})

describe('sampleCurve', () => {
  it('returns the requested number of points plus the end', () => {
    const points = sampleCurve(PRESETS.ease, 10)
    expect(points).toHaveLength(11)
    expect(points[0]).toEqual({ x: 0, y: 0 })
    expect(points[10].x).toBe(1)
  })

  it('increases in x', () => {
    const points = sampleCurve(PRESETS['ease-in-out'], 20)
    for (let i = 1; i < points.length; i++) expect(points[i].x).toBeGreaterThan(points[i - 1].x)
  })

  it('rejects a silly step count', () => {
    expect(() => sampleCurve(PRESETS.ease, 1)).toThrow(BezierError)
    expect(() => sampleCurve(PRESETS.ease, 2.5)).toThrow(BezierError)
  })
})

describe('toCss', () => {
  it('names the linear curve', () => {
    expect(toCss(PRESETS.linear)).toBe('linear')
  })

  it('writes the cubic-bezier function', () => {
    expect(toCss({ x1: 0.42, y1: 0, x2: 0.58, y2: 1 })).toBe('cubic-bezier(0.42, 0, 0.58, 1)')
  })

  it('round-trips through the parser', () => {
    for (const bezier of Object.values(PRESETS)) {
      if (toCss(bezier) === 'linear') continue
      expect(parseBezier(toCss(bezier))).toEqual(bezier)
    }
  })
})

describe('summarise', () => {
  it('reports progress at the quarters', () => {
    const result = summarise(PRESETS.linear)
    const values = result.progress.map((point) => point.value)
    expect(values).toHaveLength(3)
    for (const [index, expected] of [0.25, 0.5, 0.75].entries()) expect(values[index]).toBeCloseTo(expected, 6)
  })

  it('flags overshoot', () => {
    expect(summarise(PRESETS['back out (overshoot)']).overshoot).toBe(true)
    expect(summarise(PRESETS.ease).overshoot).toBe(false)
  })

  it('finds where the curve moves fastest', () => {
    const result = summarise(PRESETS['ease-in'])
    expect(result.fastestAt).toBeGreaterThan(0.5)
  })
})

describe('presets', () => {
  it('lists names that all parse back to themselves', () => {
    for (const name of presetNames()) expect(parseBezier(name)).toEqual(PRESETS[name])
  })

  it('keeps every x inside 0-1', () => {
    for (const bezier of Object.values(PRESETS)) {
      expect(bezier.x1).toBeGreaterThanOrEqual(0)
      expect(bezier.x1).toBeLessThanOrEqual(1)
      expect(bezier.x2).toBeGreaterThanOrEqual(0)
      expect(bezier.x2).toBeLessThanOrEqual(1)
    }
  })
})
