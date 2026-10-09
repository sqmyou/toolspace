/**
 * A small expression evaluator for the calculator.
 *
 * Recursive-descent parser over a hand-written tokenizer. Supports the usual
 * arithmetic, `^` for powers (right-associative), `%` for modulo, postfix `!`
 * factorials, parentheses, implicit multiplication (`2pi`, `3(4)`), a set of
 * common functions, and the constants pi/e/tau.
 */

export class CalcError extends Error {}

export interface EvaluateOptions {
  /** Interpret trig arguments (and inverse-trig results) in degrees. */
  degrees?: boolean
  /** Extra named values available to the expression (e.g. `ans`). */
  variables?: Record<string, number>
}

type TokenType = 'number' | 'ident' | 'op' | 'eof'

interface Token {
  type: TokenType
  value: string
  position: number
}

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  'π': Math.PI,
  tau: Math.PI * 2,
  'τ': Math.PI * 2,
  e: Math.E,
  phi: (1 + Math.sqrt(5)) / 2,
}

const FUNCTIONS: Record<string, { arity: number | 'variadic'; fn: (args: number[]) => number }> = {
  sin: { arity: 1, fn: (a) => Math.sin(a[0]) },
  cos: { arity: 1, fn: (a) => Math.cos(a[0]) },
  tan: { arity: 1, fn: (a) => Math.tan(a[0]) },
  asin: { arity: 1, fn: (a) => Math.asin(a[0]) },
  acos: { arity: 1, fn: (a) => Math.acos(a[0]) },
  atan: { arity: 1, fn: (a) => Math.atan(a[0]) },
  sinh: { arity: 1, fn: (a) => Math.sinh(a[0]) },
  cosh: { arity: 1, fn: (a) => Math.cosh(a[0]) },
  tanh: { arity: 1, fn: (a) => Math.tanh(a[0]) },
  sqrt: { arity: 1, fn: (a) => Math.sqrt(a[0]) },
  cbrt: { arity: 1, fn: (a) => Math.cbrt(a[0]) },
  abs: { arity: 1, fn: (a) => Math.abs(a[0]) },
  exp: { arity: 1, fn: (a) => Math.exp(a[0]) },
  ln: { arity: 1, fn: (a) => Math.log(a[0]) },
  log: { arity: 1, fn: (a) => Math.log10(a[0]) },
  log10: { arity: 1, fn: (a) => Math.log10(a[0]) },
  log2: { arity: 1, fn: (a) => Math.log2(a[0]) },
  floor: { arity: 1, fn: (a) => Math.floor(a[0]) },
  ceil: { arity: 1, fn: (a) => Math.ceil(a[0]) },
  round: { arity: 1, fn: (a) => Math.round(a[0]) },
  sign: { arity: 1, fn: (a) => Math.sign(a[0]) },
  pow: { arity: 2, fn: (a) => Math.pow(a[0], a[1]) },
  atan2: { arity: 2, fn: (a) => Math.atan2(a[0], a[1]) },
  min: { arity: 'variadic', fn: (a) => Math.min(...a) },
  max: { arity: 'variadic', fn: (a) => Math.max(...a) },
  hypot: { arity: 'variadic', fn: (a) => Math.hypot(...a) },
}

const TRIG = new Set(['sin', 'cos', 'tan'])
const INVERSE_TRIG = new Set(['asin', 'acos', 'atan', 'atan2'])

/** Names offered as hints in the UI. */
export const FUNCTION_NAMES = Object.keys(FUNCTIONS).sort()
export const CONSTANT_NAMES = Object.keys(CONSTANTS)

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < input.length) {
    const char = input[i]
    if (/\s/.test(char)) {
      i++
      continue
    }
    if (/[0-9.]/.test(char)) {
      const match = /^[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?/.exec(input.slice(i))
      if (!match) throw new CalcError(`Unexpected "${char}" at position ${i + 1}.`)
      tokens.push({ type: 'number', value: match[0], position: i })
      i += match[0].length
      continue
    }
    if (/[a-zA-Z_]/.test(char) || char === 'π' || char === 'τ') {
      const match = /^(?:[a-zA-Z_][a-zA-Z0-9_]*|[πτ])/.exec(input.slice(i))
      if (!match) throw new CalcError(`Unexpected "${char}" at position ${i + 1}.`)
      tokens.push({ type: 'ident', value: match[0], position: i })
      i += match[0].length
      continue
    }
    if ('+-*/%^()!,×÷'.includes(char)) {
      const normalized = char === '×' ? '*' : char === '÷' ? '/' : char
      tokens.push({ type: 'op', value: normalized, position: i })
      i++
      continue
    }
    throw new CalcError(`Unexpected character "${char}" at position ${i + 1}.`)
  }
  tokens.push({ type: 'eof', value: '', position: input.length })
  return tokens
}

class Parser {
  private index = 0
  private readonly degrees: boolean
  private readonly variables: Record<string, number>

  constructor(private readonly tokens: Token[], options: EvaluateOptions) {
    this.degrees = Boolean(options.degrees)
    this.variables = options.variables ?? {}
  }

  parse(): number {
    const value = this.expression()
    const token = this.peek()
    if (token.type !== 'eof') throw new CalcError(`Unexpected "${token.value}" at position ${token.position + 1}.`)
    return value
  }

  private peek(): Token {
    return this.tokens[this.index]
  }

  private next(): Token {
    return this.tokens[this.index++]
  }

  private expression(): number {
    let value = this.term()
    for (;;) {
      const token = this.peek()
      if (token.type === 'op' && (token.value === '+' || token.value === '-')) {
        this.next()
        const right = this.term()
        value = token.value === '+' ? value + right : value - right
      } else {
        return value
      }
    }
  }

  private term(): number {
    let value = this.unary()
    for (;;) {
      const token = this.peek()
      if (token.type === 'op' && (token.value === '*' || token.value === '/' || token.value === '%')) {
        this.next()
        const right = this.unary()
        if (token.value === '*') value *= right
        else if (token.value === '/') value /= right
        else value %= right
      } else if (this.startsImplicitFactor(token)) {
        value *= this.unary()
      } else {
        return value
      }
    }
  }

  /** A number, name or "(" right after a value means multiplication. */
  private startsImplicitFactor(token: Token): boolean {
    if (token.type === 'number' || token.type === 'ident') return true
    return token.type === 'op' && token.value === '('
  }

  private unary(): number {
    const token = this.peek()
    if (token.type === 'op' && (token.value === '-' || token.value === '+')) {
      this.next()
      const value = this.unary()
      return token.value === '-' ? -value : value
    }
    return this.power()
  }

  private power(): number {
    const base = this.postfix()
    const token = this.peek()
    if (token.type === 'op' && token.value === '^') {
      this.next()
      const exponent = this.unary()
      return Math.pow(base, exponent)
    }
    return base
  }

  private postfix(): number {
    let value = this.primary()
    for (;;) {
      const token = this.peek()
      if (token.type === 'op' && token.value === '!') {
        this.next()
        value = factorial(value)
      } else {
        return value
      }
    }
  }

  private primary(): number {
    const token = this.next()
    if (token.type === 'number') return Number(token.value)

    if (token.type === 'ident') {
      const name = token.value
      const lower = name.toLowerCase()
      if (this.peek().type === 'op' && this.peek().value === '(') {
        const fn = FUNCTIONS[lower]
        if (!fn) throw new CalcError(`Unknown function "${name}".`)
        this.next()
        const args: number[] = []
        if (!(this.peek().type === 'op' && this.peek().value === ')')) {
          args.push(this.expression())
          while (this.peek().type === 'op' && this.peek().value === ',') {
            this.next()
            args.push(this.expression())
          }
        }
        if (!(this.peek().type === 'op' && this.peek().value === ')')) {
          throw new CalcError(`Missing ")" after ${name}(…).`)
        }
        this.next()
        return this.applyFunction(lower, args)
      }
      const constant = CONSTANTS[lower]
      if (constant !== undefined) return constant
      if (lower in this.variables) return this.variables[lower]
      throw new CalcError(`Unknown name "${name}".`)
    }

    if (token.type === 'op' && token.value === '(') {
      const value = this.expression()
      if (!(this.peek().type === 'op' && this.peek().value === ')')) {
        throw new CalcError('Missing closing ")".')
      }
      this.next()
      return value
    }

    if (token.type === 'eof') throw new CalcError('The expression is incomplete.')
    throw new CalcError(`Unexpected "${token.value}" at position ${token.position + 1}.`)
  }

  private applyFunction(name: string, args: number[]): number {
    const spec = FUNCTIONS[name]
    if (spec.arity === 'variadic') {
      if (args.length === 0) throw new CalcError(`${name}() needs at least one argument.`)
      return spec.fn(args)
    }
    if (args.length !== spec.arity) {
      throw new CalcError(`${name}() takes ${spec.arity} argument${spec.arity === 1 ? '' : 's'}, got ${args.length}.`)
    }
    let callArgs = args
    if (this.degrees && TRIG.has(name)) callArgs = args.map((a) => (a * Math.PI) / 180)
    const result = spec.fn(callArgs)
    if (this.degrees && INVERSE_TRIG.has(name)) return (result * 180) / Math.PI
    return result
  }
}

function factorial(value: number): number {
  if (!Number.isInteger(value) || value < 0) throw new CalcError('Factorial needs a non-negative whole number.')
  if (value > 170) return Infinity
  let result = 1
  for (let i = 2; i <= value; i++) result *= i
  return result
}

/** Evaluate an expression, throwing CalcError on bad input. */
export function evaluate(expression: string, options: EvaluateOptions = {}): number {
  const trimmed = expression.trim()
  if (!trimmed) throw new CalcError('Enter an expression.')
  const parser = new Parser(tokenize(trimmed), options)
  const value = parser.parse()
  if (Number.isNaN(value)) throw new CalcError('That expression is not a number.')
  return value
}

/** Format a result for display, avoiding floating-point noise like 0.30000000000000004. */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return Number.isNaN(value) ? 'NaN' : value > 0 ? 'Infinity' : '-Infinity'
  if (value === 0) return '0'
  const magnitude = Math.abs(value)
  if (magnitude >= 1e15 || magnitude < 1e-6) return value.toExponential(10).replace(/\.?0+e/, 'e')
  return String(Number(value.toPrecision(14)))
}

/* ---------------------------------------------------------------------------
   Programs
   ---------------------------------------------------------------------------
   Beyond the free-text expression box, the calculator offers a handful of
   "programs": a small, fixed computation with one or two inputs. They cover
   the things an expression box handles badly — unit conversion and bitwise
   work — and they are all ordinary JavaScript, so a program that makes no
   sense for its input throws CalcError and is reported as "Invalid" rather
   than silently producing a wrong number.
   ------------------------------------------------------------------------- */

export type AngleMode = 'deg' | 'rad' | 'grad' | 'turn' | 'mil'
export type DmsMode = 'dd' | 'dm' | 'dms'
export type BitwiseOp = 'and' | 'or' | 'xor' | 'not'
export type NumberMode = 'dec' | 'hex' | 'bin'

export interface ProgramContext {
  /** Unit the angle inputs are given in. */
  angleMode: AngleMode
  /** How many DMS slots to show: decimal, degrees+minutes, or d/m/s. */
  dmsMode: DmsMode
  bitwiseOp: BitwiseOp
  /** Operand width in bits: 8, 16 or 32. */
  notWidth: number
}

export const DEFAULT_PROGRAM_CONTEXT: ProgramContext = {
  angleMode: 'deg',
  dmsMode: 'dms',
  bitwiseOp: 'and',
  notWidth: 16,
}

/** How many degrees one unit of each mode is worth. */
const DEGREES_PER_UNIT: Record<AngleMode, number> = {
  deg: 1,
  rad: 180 / Math.PI,
  grad: 0.9,
  turn: 360,
  mil: 180 / 3200,
}

export const ANGLE_UNITS: { value: AngleMode; label: string; suffix: string }[] = [
  { value: 'deg', label: 'Degrees', suffix: '°' },
  { value: 'rad', label: 'Radians', suffix: ' rad' },
  { value: 'grad', label: 'Gradians', suffix: ' grad' },
  { value: 'turn', label: 'Turns', suffix: ' turn' },
  { value: 'mil', label: 'Mils', suffix: ' mil' },
]

export const BITWISE_WIDTHS = [8, 16, 32]

export function toDegrees(value: number, mode: AngleMode): number {
  return value * DEGREES_PER_UNIT[mode]
}

export function fromDegrees(degrees: number, mode: AngleMode): number {
  return degrees / DEGREES_PER_UNIT[mode]
}

/** Combine a sign-magnitude d/m/s triple into decimal degrees. */
export function dmsToDegrees(degrees: number, minutes = 0, seconds = 0): number {
  const sign = degrees < 0 || minutes < 0 || seconds < 0 ? -1 : 1
  return degrees + sign * (Math.abs(minutes) / 60 + Math.abs(seconds) / 3600)
}

export interface DmsParts {
  degrees: number
  minutes: number
  seconds: number
}

/** Split decimal degrees into a sign-magnitude d/m/s triple. */
export function degreesToDms(degrees: number): DmsParts {
  const sign = degrees < 0 ? -1 : 1
  const absolute = Math.abs(degrees)
  const whole = Math.floor(absolute)
  const minutePart = (absolute - whole) * 60
  const minutes = Math.floor(minutePart)
  const seconds = Number(((minutePart - minutes) * 60).toPrecision(10))
  return { degrees: sign * whole, minutes, seconds }
}

/** Mask a value into `width` bits, as an unsigned integer. */
function toUnsigned(value: number, width: number): number {
  const modulus = 2 ** width
  return ((Math.trunc(value) % modulus) + modulus) % modulus
}

/** Reinterpret an unsigned width-bit value as signed (two's complement). */
function toSigned(value: number, width: number): number {
  const signBit = 2 ** (width - 1)
  return value >= signBit ? value - 2 ** width : value
}

/**
 * Run a bitwise operation at a given width. Operands must fit the width
 * (either as an unsigned value or a negative two's-complement one); anything
 * outside that range is Invalid, which is what stops `NOT` being applied to a
 * number the width cannot even represent.
 */
export function bitwiseOp(op: BitwiseOp, a: number, b: number, width: number): number {
  const modulus = 2 ** width
  const fits = (value: number) => Number.isInteger(value) && value >= -(modulus / 2) && value <= modulus - 1
  if (!fits(a) || !fits(b)) throw new CalcError(`${a} does not fit in ${width} bits.`)
  const left = toUnsigned(a, width)
  const right = toUnsigned(b, width)
  let raw: number
  switch (op) {
    case 'and':
      raw = left & right
      break
    case 'or':
      raw = left | right
      break
    case 'xor':
      raw = left ^ right
      break
    case 'not':
      raw = ~left
      break
  }
  return toSigned(toUnsigned(raw, width), width)
}

export type ProgramId = 'angle' | 'dms' | 'bitwise'

export interface CalcProgram {
  id: ProgramId
  label: string
  hint: string
  /** Input slot labels for the current settings. */
  fields: (context: ProgramContext) => string[]
  /** Compute a result, or throw CalcError for input the program cannot take. */
  run: (values: number[], context: ProgramContext) => number
}

export const PROGRAMS: CalcProgram[] = [
  {
    id: 'angle',
    label: 'Angle Converter',
    hint: 'Convert an angle between degrees, radians, gradians, turns and mils',
    fields: () => ['Angle'],
    run: (values, context) => toDegrees(values[0] ?? 0, context.angleMode),
  },
  {
    id: 'dms',
    label: 'DMS Converter',
    hint: 'Combine degrees, minutes and seconds into decimal degrees',
    fields: (context) =>
      context.dmsMode === 'dd' ? ['Degrees'] : context.dmsMode === 'dm' ? ['Degrees', 'Minutes'] : ['Degrees', 'Minutes', 'Seconds'],
    run: (values, context) => {
      const [degrees = 0, minutes = 0, seconds = 0] = values
      if (context.dmsMode === 'dd') return degrees
      if (context.dmsMode === 'dm') return dmsToDegrees(degrees, minutes)
      return dmsToDegrees(degrees, minutes, seconds)
    },
  },
  {
    id: 'bitwise',
    label: 'Bitwise',
    hint: 'AND, OR, XOR and NOT at 8, 16 or 32 bits',
    fields: (context) => (context.bitwiseOp === 'not' ? ['Operand'] : ['A', 'B']),
    run: (values, context) => bitwiseOp(context.bitwiseOp, values[0] ?? 0, values[1] ?? 0, context.notWidth),
  },
]

export function programById(id: ProgramId): CalcProgram {
  return PROGRAMS.find((program) => program.id === id) ?? PROGRAMS[0]
}

/** Format a value for the selected number mode, for the readout and the copy action. */
export function formatInMode(value: number, mode: NumberMode): string {
  if (mode === 'dec') return formatNumber(value)
  if (!Number.isInteger(value)) return formatNumber(value)
  if (mode === 'hex') return (value < 0 ? '-0x' + Math.abs(value).toString(16) : '0x' + value.toString(16)).toUpperCase()
  return (value < 0 ? '-' : '') + '0b' + Math.abs(value).toString(2)
}
