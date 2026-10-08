import { describe, expect, it } from 'vitest'
import { CalcError, evaluate, formatNumber } from './calc'

describe('evaluate: arithmetic', () => {
  it('follows precedence', () => {
    expect(evaluate('2 + 3 * 4')).toBe(14)
    expect(evaluate('(2 + 3) * 4')).toBe(20)
    expect(evaluate('10 - 2 - 3')).toBe(5)
    expect(evaluate('100 / 5 / 2')).toBe(10)
  })

  it('handles unary minus', () => {
    expect(evaluate('-5 + 3')).toBe(-2)
    expect(evaluate('2 * -3')).toBe(-6)
    expect(evaluate('-(2 + 3)')).toBe(-5)
  })

  it('computes powers right-associatively', () => {
    expect(evaluate('2 ^ 3')).toBe(8)
    expect(evaluate('2 ^ 3 ^ 2')).toBe(512)
    expect(evaluate('2 ^ -2')).toBe(0.25)
  })

  it('supports modulo', () => {
    expect(evaluate('10 % 3')).toBe(1)
  })

  it('supports factorials', () => {
    expect(evaluate('5!')).toBe(120)
    expect(evaluate('(2 + 3)!')).toBe(120)
    expect(evaluate('3! + 1')).toBe(7)
  })

  it('rejects factorial of a non-integer', () => {
    expect(() => evaluate('1.5!')).toThrow(CalcError)
  })
})

describe('evaluate: names, functions and constants', () => {
  it('knows pi, e and tau', () => {
    expect(evaluate('pi')).toBeCloseTo(Math.PI)
    expect(evaluate('e')).toBeCloseTo(Math.E)
    expect(evaluate('tau')).toBeCloseTo(Math.PI * 2)
  })

  it('applies functions', () => {
    expect(evaluate('sqrt(16)')).toBe(4)
    expect(evaluate('log(1000)')).toBeCloseTo(3)
    expect(evaluate('ln(e)')).toBeCloseTo(1)
    expect(evaluate('max(3, 7, 5)')).toBe(7)
    expect(evaluate('pow(2, 8)')).toBe(256)
  })

  it('supports implicit multiplication', () => {
    expect(evaluate('2pi')).toBeCloseTo(Math.PI * 2)
    expect(evaluate('3(4)')).toBe(12)
    expect(evaluate('2sqrt(9)')).toBe(6)
  })

  it('honours degree mode for trig', () => {
    expect(evaluate('sin(30)', { degrees: true })).toBeCloseTo(0.5)
    expect(evaluate('sin(0)')).toBe(0)
    expect(evaluate('asin(0.5)', { degrees: true })).toBeCloseTo(30)
  })

  it('rejects unknown names and wrong arity', () => {
    expect(() => evaluate('nope(1)')).toThrow(/Unknown function/)
    expect(() => evaluate('mystery')).toThrow(/Unknown name/)
    expect(() => evaluate('pow(2)')).toThrow(/takes 2 arguments/)
  })
})

describe('evaluate: errors', () => {
  it('rejects empty input', () => {
    expect(() => evaluate('   ')).toThrow(CalcError)
  })

  it('rejects unbalanced parentheses', () => {
    expect(() => evaluate('(1 + 2')).toThrow(/closing/)
    expect(() => evaluate('sqrt(4')).toThrow(/Missing/)
  })

  it('rejects trailing operators', () => {
    expect(() => evaluate('1 +')).toThrow(CalcError)
  })

  it('rejects stray characters', () => {
    expect(() => evaluate('1 $ 2')).toThrow(/Unexpected character/)
  })
})

describe('formatNumber', () => {
  it('trims floating-point noise', () => {
    expect(formatNumber(0.1 + 0.2)).toBe('0.3')
  })

  it('uses scientific notation for extremes', () => {
    expect(formatNumber(1e20)).toMatch(/e\+?20/)
    expect(formatNumber(1e-9)).toMatch(/e-9/)
  })

  it('renders special values', () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(Infinity)).toBe('Infinity')
    expect(formatNumber(NaN)).toBe('NaN')
  })
})
