/**
 * Cubic Bézier easing.
 *
 * A CSS timing function is a cubic Bézier with its end points pinned at (0,0)
 * and (1,1); only the two control points vary. Evaluating it means solving for
 * the curve parameter that produces a given x, which is done with a few
 * Newton steps and a bisection fallback when the derivative is too flat.
 * The x coordinates are limited to 0-1 as CSS requires, so the curve is always
 * a function of progress; the y coordinates are free, which allows overshoot.
 */

export class BezierError extends Error {}

export interface Bezier {
  x1: number
  y1: number
  x2: number
  y2: number
}

export const PRESETS: Record<string, Bezier> = {
  linear: { x1: 0, y1: 0, x2: 1, y2: 1 },
  ease: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
  'ease-in': { x1: 0.42, y1: 0, x2: 1, y2: 1 },
  'ease-out': { x1: 0, y1: 0, x2: 0.58, y2: 1 },
  'ease-in-out': { x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
  'material standard': { x1: 0.4, y1: 0, x2: 0.2, y2: 1 },
  'material decelerate': { x1: 0, y1: 0, x2: 0.2, y2: 1 },
  'material accelerate': { x1: 0.4, y1: 0, x2: 1, y2: 1 },
  'material sharp': { x1: 0.4, y1: 0, x2: 0.6, y2: 1 },
  'back out (overshoot)': { x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 },
  'back in (anticipate)': { x1: 0.36, y1: 0, x2: 0.66, y2: -0.56 },
  'snap (very fast out)': { x1: 0.1, y1: 0.9, x2: 0.2, y2: 1 },
}

export function presetNames(): string[] {
  return Object.keys(PRESETS)
}

function number(value: string, label: string): number {
  const parsed = Number(value.trim())
  if (!Number.isFinite(parsed)) throw new BezierError(`${label} is not a number`)
  return parsed
}

/** Parse "cubic-bezier(a, b, c, d)" or a bare list of four numbers. */
export function parseBezier(input: string): Bezier {
  const text = input.trim()
  if (!text) throw new BezierError('Enter a cubic-bezier value')

  const preset = PRESETS[text.toLowerCase()]
  if (preset) return { ...preset }

  const inner = /^cubic-bezier\((.*)\)$/i.exec(text)?.[1] ?? text
  const parts = inner.split(/[\s,]+/).filter(Boolean)
  if (parts.length !== 4) throw new BezierError('A cubic-bezier needs exactly four numbers')

  const [x1, y1, x2, y2] = [number(parts[0], 'x1'), number(parts[1], 'y1'), number(parts[2], 'x2'), number(parts[3], 'y2')]
  for (const [value, label] of [
    [x1, 'x1'],
    [x2, 'x2'],
  ] as const) {
    if (value < 0 || value > 1) throw new BezierError(`${label} must be between 0 and 1`)
  }
  return { x1, y1, x2, y2 }
}

/** The four coefficients for one axis of the curve. */
function coefficients(p1: number, p2: number): [number, number, number] {
  const c = 3 * p1
  const b = 3 * (p2 - p1) - c
  const a = 1 - c - b
  return [a, b, c]
}

function sample(coefficients: [number, number, number], t: number): number {
  const [a, b, c] = coefficients
  return ((a * t + b) * t + c) * t
}

function slope(coefficients: [number, number, number], t: number): number {
  const [a, b, c] = coefficients
  return (3 * a * t + 2 * b) * t + c
}

/** Solve for t where x(t) equals the target, then return y(t). */
function solveX(ax: [number, number, number], x: number): number {
  let t = x
  for (let i = 0; i < 8; i++) {
    const error = sample(ax, t) - x
    if (Math.abs(error) < 1e-7) return t
    const derivative = slope(ax, t)
    if (Math.abs(derivative) < 1e-6) break
    t -= error / derivative
  }

  let low = 0
  let high = 1
  t = x
  for (let i = 0; i < 40; i++) {
    const value = sample(ax, t)
    if (Math.abs(value - x) < 1e-7) return t
    if (value > x) high = t
    else low = t
    t = (low + high) / 2
  }
  return t
}

/** Build an easing function y(x) for the given control points. */
export function createEasing(bezier: Bezier): (x: number) => number {
  const ax = coefficients(bezier.x1, bezier.x2)
  const ay = coefficients(bezier.y1, bezier.y2)
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    return sample(ay, solveX(ax, x))
  }
}

/** Evaluate the curve directly at a progress value. */
export function evaluate(bezier: Bezier, x: number): number {
  return createEasing(bezier)(x)
}

/** Points along the curve for drawing a preview. */
export function sampleCurve(bezier: Bezier, steps = 100): { x: number; y: number }[] {
  if (!Number.isInteger(steps) || steps < 2) throw new BezierError('Steps must be an integer of 2 or more')
  const easing = createEasing(bezier)
  return Array.from({ length: steps + 1 }, (_, index) => {
    const x = index / steps
    return { x, y: easing(x) }
  })
}

function trim(value: number): string {
  return String(Number(value.toFixed(4)))
}

/** CSS text for the curve. */
export function toCss(bezier: Bezier): string {
  if (bezier.x1 === 0 && bezier.y1 === 0 && bezier.x2 === 1 && bezier.y2 === 1) return 'linear'
  return `cubic-bezier(${trim(bezier.x1)}, ${trim(bezier.y1)}, ${trim(bezier.x2)}, ${trim(bezier.y2)})`
}

export interface BezierSummary {
  progress: { at: number; value: number }[]
  overshoot: boolean
  /** True when progress ever moves backwards, which CSS forbids in practice. */
  nonMonotonic: boolean
  fastestAt: number
}

/** A quick read of the curve's shape. */
export function summarise(bezier: Bezier): BezierSummary {
  const easing = createEasing(bezier)
  const progress = [0.25, 0.5, 0.75].map((at) => ({ at, value: easing(at) }))

  const steps = 200
  let fastestAt = 0
  let fastest = -Infinity
  let previous = 0
  let nonMonotonic = false
  for (let i = 1; i <= steps; i++) {
    const x = i / steps
    const value = easing(x)
    const speed = (value - easing((i - 1) / steps)) / (1 / steps)
    if (speed > fastest) {
      fastest = speed
      fastestAt = x
    }
    if (value < previous - 1e-9) nonMonotonic = true
    previous = value
  }

  return {
    progress,
    overshoot: Math.max(bezier.y1, bezier.y2) > 1 || Math.min(bezier.y1, bezier.y2) < 0,
    nonMonotonic,
    fastestAt,
  }
}
