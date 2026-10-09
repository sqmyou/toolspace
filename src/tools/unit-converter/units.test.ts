import { describe, expect, it } from 'vitest'
import { CATEGORIES, convertToAll, convertUnit, findCategory, findUnit, formatUnitValue, parseUnitInput, UnitError } from './units'

function unitOf(categoryId: string, unitId: string) {
  const category = findCategory(categoryId)!
  const unit = findUnit(category, unitId)
  expect(unit).toBeDefined()
  return unit!
}

describe('catalogue integrity', () => {
  it('has unique category and unit ids', () => {
    const categoryIds = CATEGORIES.map((category) => category.id)
    expect(new Set(categoryIds).size).toBe(categoryIds.length)
    for (const category of CATEGORIES) {
      const ids = category.units.map((unit) => unit.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids).toContain(category.defaultUnit)
    }
  })

  it('keeps every factor finite and non-zero', () => {
    for (const category of CATEGORIES) {
      for (const unit of category.units) {
        expect(Number.isFinite(unit.factor)).toBe(true)
        expect(unit.factor).not.toBe(0)
      }
    }
  })
})

describe('convertUnit', () => {
  it('converts within the linear families', () => {
    expect(convertUnit(1, unitOf('length', 'km'), unitOf('length', 'm'))).toBeCloseTo(1000, 9)
    expect(convertUnit(1, unitOf('length', 'mi'), unitOf('length', 'km'))).toBeCloseTo(1.609344, 9)
    expect(convertUnit(1, unitOf('mass', 'lb'), unitOf('mass', 'g'))).toBeCloseTo(453.59237, 6)
    expect(convertUnit(1, unitOf('data-rate', 'mbps'), unitOf('data-rate', 'mbps-b'))).toBeCloseTo(0.125, 9)
  })

  it('converts temperatures through their offset', () => {
    expect(convertUnit(100, unitOf('temperature', 'c'), unitOf('temperature', 'f'))).toBeCloseTo(212, 9)
    expect(convertUnit(32, unitOf('temperature', 'f'), unitOf('temperature', 'c'))).toBeCloseTo(0, 9)
    expect(convertUnit(0, unitOf('temperature', 'c'), unitOf('temperature', 'k'))).toBeCloseTo(273.15, 9)
    expect(convertUnit(0, unitOf('temperature', 'k'), unitOf('temperature', 'f'))).toBeCloseTo(-459.67, 9)
  })

  it('round-trips', () => {
    for (const category of CATEGORIES) {
      for (const from of category.units) {
        const to = category.units[(category.units.indexOf(from) + 1) % category.units.length]
        const back = convertUnit(convertUnit(7.5, from, to), to, from)
        expect(back).toBeCloseTo(7.5, 6)
      }
    }
  })

  it('rejects non-finite input', () => {
    expect(() => convertUnit(Number.NaN, unitOf('length', 'm'), unitOf('length', 'km'))).toThrow(UnitError)
  })
})

describe('convertToAll', () => {
  it('returns one row per unit in the category', () => {
    const category = findCategory('length')!
    const rows = convertToAll(1, unitOf('length', 'm'), category)
    expect(rows).toHaveLength(category.units.length)
    expect(rows.find((row) => row.unit.id === 'mm')?.value).toBeCloseTo(1000, 9)
  })
})

describe('parseUnitInput', () => {
  it('tolerates pasted separators', () => {
    expect(parseUnitInput('1,000')).toBe(1000)
    expect(parseUnitInput(' 1_000 ')).toBe(1000)
    expect(parseUnitInput('+2.5')).toBe(2.5)
    expect(parseUnitInput('-40')).toBe(-40)
  })

  it('throws with a reason on blank or junk input', () => {
    expect(() => parseUnitInput('')).toThrow(UnitError)
    expect(() => parseUnitInput('12abc')).toThrow(UnitError)
  })
})

describe('formatUnitValue', () => {
  it('trims trailing zeros and handles the extremes', () => {
    expect(formatUnitValue(0)).toBe('0')
    expect(formatUnitValue(1000)).toBe('1000')
    expect(formatUnitValue(1 / 3)).toBe('0.33333333')
    expect(formatUnitValue(1e13)).toContain('e13')
    expect(formatUnitValue(1e-9)).toContain('e-9')
  })
})
