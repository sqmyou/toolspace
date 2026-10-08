import { describe, expect, it } from 'vitest'
import { applyDiscount, applyMarkup, marginAndMarkup, PercentageError, percentBreakdown, percentChange, percentOf, percentOfTotal, reversePercent, round } from './percentage'

describe('percentOf', () => {
  it('computes a share of a value', () => {
    expect(percentOf(20, 150)).toBe(30)
    expect(percentOf(0, 150)).toBe(0)
    expect(percentOf(100, 42)).toBe(42)
  })

  it('accepts fractions and negatives', () => {
    expect(percentOf(12.5, 80)).toBe(10)
    expect(percentOf(-10, 200)).toBe(-20)
  })

  it('rejects non-numbers', () => {
    expect(() => percentOf(Number.NaN, 10)).toThrow(PercentageError)
    expect(() => percentOf(10, Number.POSITIVE_INFINITY)).toThrow(PercentageError)
  })
})

describe('percentOfTotal', () => {
  it('computes the share', () => {
    expect(percentOfTotal(25, 200)).toBe(12.5)
    expect(percentOfTotal(50, 50)).toBe(100)
  })

  it('rejects a zero total', () => {
    expect(() => percentOfTotal(5, 0)).toThrow(PercentageError)
  })
})

describe('percentChange', () => {
  it('reports an increase', () => {
    expect(percentChange(100, 150)).toBe(50)
  })

  it('reports a decrease', () => {
    expect(percentChange(100, 80)).toBe(-20)
  })

  it('handles a negative starting point by magnitude', () => {
    expect(percentChange(-100, -50)).toBe(50)
  })

  it('rejects a zero base', () => {
    expect(() => percentChange(0, 10)).toThrow(PercentageError)
  })
})

describe('reversePercent', () => {
  it('undoes an increase', () => {
    expect(reversePercent(150, 50)).toBe(100)
  })

  it('undoes a decrease', () => {
    expect(reversePercent(80, -20)).toBe(100)
  })

  it('rejects a total wipeout', () => {
    expect(() => reversePercent(10, -100)).toThrow(PercentageError)
  })
})

describe('applyDiscount / applyMarkup', () => {
  it('applies a discount', () => {
    expect(applyDiscount(200, 25)).toBe(150)
  })

  it('applies a markup', () => {
    expect(applyMarkup(100, 30)).toBe(130)
  })
})

describe('percentBreakdown', () => {
  it('splits values into percentages', () => {
    expect(percentBreakdown([1, 1, 2])).toEqual([25, 25, 50])
  })

  it('returns an empty list for no input', () => {
    expect(percentBreakdown([])).toEqual([])
  })

  it('rejects a zero total', () => {
    expect(() => percentBreakdown([0, 0])).toThrow(PercentageError)
  })
})

describe('marginAndMarkup', () => {
  it('computes both figures', () => {
    const result = marginAndMarkup(80, 100)
    expect(result.margin).toBe(20)
    expect(result.markup).toBe(25)
  })

  it('rejects zero cost or price', () => {
    expect(() => marginAndMarkup(0, 100)).toThrow(PercentageError)
    expect(() => marginAndMarkup(50, 0)).toThrow(PercentageError)
  })
})

describe('round', () => {
  it('rounds to the requested places', () => {
    expect(round(1.005, 2)).toBe(1.01)
    expect(round(2.5)).toBe(2.5)
    expect(round(12.3456, 3)).toBe(12.346)
  })

  it('rejects non-finite input', () => {
    expect(() => round(Number.NaN)).toThrow(PercentageError)
  })
})
