/** CSS length conversion and fluid clamp() generation. */

export type LengthUnit = 'px' | 'rem' | 'em' | 'pt' | 'pc' | 'in' | 'cm' | 'mm' | 'q'

/** Absolute units expressed in CSS pixels, at the standard 96dpi. */
const ABSOLUTE_PX: Record<string, number> = {
  px: 1,
  pt: 96 / 72,
  pc: 16,
  in: 96,
  cm: 96 / 2.54,
  mm: 96 / 25.4,
  q: 96 / 101.6,
}

export const UNITS: LengthUnit[] = ['px', 'rem', 'em', 'pt', 'pc', 'in', 'cm', 'mm', 'q']

export class UnitError extends Error {}

/** Convert any supported length to pixels given a root font size. */
export function toPixels(value: number, unit: LengthUnit, root = 16): number {
  if (!Number.isFinite(value)) throw new UnitError('Enter a number.')
  if (unit === 'rem' || unit === 'em') return value * root
  const factor = ABSOLUTE_PX[unit]
  if (factor === undefined) throw new UnitError(`Unknown unit "${unit}".`)
  return value * factor
}

export interface ConversionRow {
  unit: LengthUnit
  value: number
}

/** Express a length in every supported unit. */
export function convertAll(value: number, unit: LengthUnit, root = 16, precision = 4): ConversionRow[] {
  const px = toPixels(value, unit, root)
  return UNITS.map((target) => {
    const factor = target === 'rem' || target === 'em' ? root : ABSOLUTE_PX[target]
    const raw = px / factor
    const rounded = Number(raw.toFixed(precision))
    return { unit: target, value: rounded }
  })
}

export interface ClampInput {
  minSize: number
  maxSize: number
  minViewport: number
  maxViewport: number
  root: number
}

export interface ClampResult {
  css: string
  pxFallback: string
  slope: number
  intercept: number
}

function round(value: number, places = 4): number {
  return Number(value.toFixed(places))
}

/**
 * Build a fluid `clamp()` whose middle term ramps linearly between two viewport
 * widths. The preferred value is `intercept + slope * 100vw`.
 */
export function buildClamp(input: ClampInput): ClampResult {
  const { minSize, maxSize, minViewport, maxViewport, root } = input
  if (![minSize, maxSize, minViewport, maxViewport, root].every(Number.isFinite)) throw new UnitError('All fields need a number.')
  if (root <= 0) throw new UnitError('Root font size must be positive.')
  if (maxViewport <= minViewport) throw new UnitError('The maximum viewport must be wider than the minimum.')

  const slopePx = (maxSize - minSize) / (maxViewport - minViewport)
  const interceptPx = minSize - slopePx * minViewport
  const slopeVw = round(slopePx * 100)
  const interceptRem = round(interceptPx / root)

  const low = round(minSize / root)
  const high = round(maxSize / root)
  const middle = `${interceptRem}rem + ${slopeVw}vw`
  const css = `clamp(${low}rem, calc(${middle}), ${high}rem)`
  return { css, pxFallback: `clamp(${round(minSize)}px, ${round(interceptPx)}px + ${slopeVw}vw, ${round(maxSize)}px)`, slope: slopeVw, intercept: interceptRem }
}
