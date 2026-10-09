import { describe, expect, it } from 'vitest'
import {
  bitwiseOp,
  CalcError,
  degreesToDms,
  dmsToDegrees,
  evaluate,
  formatInMode,
  formatNumber,
  fromDegrees,
  programById,
  toDegrees,
} from './calc'

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

describe('angle conversion', () => {
  it('converts a familiar angle into degrees from every unit', () => {
    expect(toDegrees(180, 'deg')).toBe(180)
    expect(toDegrees(Math.PI, 'rad')).toBeCloseTo(180, 10)
    expect(toDegrees(200, 'grad')).toBeCloseTo(180, 10)
    expect(toDegrees(0.5, 'turn')).toBe(180)
    expect(toDegrees(3200, 'mil')).toBeCloseTo(180, 10)
  })

  it('round-trips through degrees', () => {
    for (const mode of ['deg', 'rad', 'grad', 'turn', 'mil'] as const) {
      expect(fromDegrees(toDegrees(37, mode), mode)).toBeCloseTo(37, 10)
    }
  })
})

describe('degrees / dms', () => {
  it('combines a d/m/s triple', () => {
    expect(dmsToDegrees(51, 30, 0)).toBeCloseTo(51.5, 10)
    expect(dmsToDegrees(51, 30, 36)).toBeCloseTo(51.51, 10)
  })

  it('treats a negative degree as a negative whole angle', () => {
    expect(dmsToDegrees(-51, 30, 0)).toBeCloseTo(-51.5, 10)
    expect(dmsToDegrees(0, -30, 0)).toBeCloseTo(-0.5, 10)
  })

  it('splits decimal degrees back into d/m/s', () => {
    const parts = degreesToDms(51.51)
    expect(parts.degrees).toBe(51)
    expect(parts.minutes).toBe(30)
    expect(parts.seconds).toBeCloseTo(36, 6)
    expect(degreesToDms(-51.5)).toEqual({ degrees: -51, minutes: 30, seconds: 0 })
  })

  it('round-trips a d/m/s triple through decimal degrees', () => {
    const parts = degreesToDms(12.3456)
    expect(dmsToDegrees(parts.degrees, parts.minutes, parts.seconds)).toBeCloseTo(12.3456, 10)
  })
})

describe('bitwise', () => {
  it('does and, or and xor', () => {
    expect(bitwiseOp('and', 0b1100, 0b1010, 8)).toBe(0b1000)
    expect(bitwiseOp('or', 0b1100, 0b1010, 8)).toBe(0b1110)
    expect(bitwiseOp('xor', 0b1100, 0b1010, 8)).toBe(0b0110)
  })

  it('inverts NOT within the chosen width', () => {
    expect(bitwiseOp('not', 0, 0, 8)).toBe(-1)
    expect(bitwiseOp('not', 0, 0, 16)).toBe(-1)
    expect(bitwiseOp('not', 0b10101010, 0, 8)).toBe(85)
  })

  it('reports a signed result in two\'s complement', () => {
    expect(bitwiseOp('and', -1, 255, 8)).toBe(-1)
    expect(bitwiseOp('or', 0x80, 0, 8)).toBe(-128)
  })

  it('rejects an operand that does not fit the width', () => {
    expect(() => bitwiseOp('and', 256, 0, 8)).toThrow(CalcError)
    expect(() => bitwiseOp('and', 1.5, 0, 16)).toThrow(CalcError)
    expect(() => bitwiseOp('not', 70000, 0, 16)).toThrow(CalcError)
  })
})

describe('programs', () => {
  it('resolves a program by id', () => {
    expect(programById('dms').label).toBe('DMS Converter')
    expect(programById('angle').id).toBe('angle')
  })

  it('gives the bitwise program one field for NOT and two otherwise', () => {
    const bitwise = programById('bitwise')
    expect(bitwise.fields({ angleMode: 'deg', dmsMode: 'dms', bitwiseOp: 'and', notWidth: 16 })).toEqual(['A', 'B'])
    expect(bitwise.fields({ angleMode: 'deg', dmsMode: 'dms', bitwiseOp: 'not', notWidth: 16 })).toEqual(['Operand'])
  })

  it('runs each program', () => {
    const context = { angleMode: 'rad' as const, dmsMode: 'dms' as const, bitwiseOp: 'xor' as const, notWidth: 8 }
    expect(programById('angle').run([Math.PI], context)).toBeCloseTo(180, 10)
    expect(programById('dms').run([10, 30, 0], context)).toBeCloseTo(10.5, 10)
    expect(programById('bitwise').run([0b1100, 0b1010], context)).toBe(0b0110)
  })
})

describe('formatInMode', () => {
  it('formats decimal as decimal', () => {
    expect(formatInMode(255, 'dec')).toBe('255')
  })

  it('formats hex with a prefix', () => {
    expect(formatInMode(255, 'hex')).toBe('0XFF')
    expect(formatInMode(-255, 'hex')).toBe('-0XFF')
  })

  it('formats binary with a prefix', () => {
    expect(formatInMode(5, 'bin')).toBe('0b101')
    expect(formatInMode(-5, 'bin')).toBe('-0b101')
  })

  it('falls back to decimal for fractional values', () => {
    expect(formatInMode(1.5, 'hex')).toBe('1.5')
  })
})
