/**
 * Percentage maths.
 *
 * Every function guards against the cases that usually go wrong: dividing by
 * zero, and a base of zero when working out the share of a total. Rounding is
 * kept out of the maths so callers decide how to display the result.
 */

export class PercentageError extends Error {}

function requireFinite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new PercentageError(`${label} must be a number`)
  return value
}

/** What is `percent` percent of `value`? */
export function percentOf(percent: number, value: number): number {
  requireFinite(percent, 'The percentage')
  requireFinite(value, 'The value')
  return (percent / 100) * value
}

/** `part` is what percent of `whole`? */
export function percentOfTotal(part: number, whole: number): number {
  requireFinite(part, 'The part')
  requireFinite(whole, 'The total')
  if (whole === 0) throw new PercentageError('The total cannot be zero')
  return (part / whole) * 100
}

/** Percentage change from `from` to `to`. */
export function percentChange(from: number, to: number): number {
  requireFinite(from, 'The original value')
  requireFinite(to, 'The new value')
  if (from === 0) throw new PercentageError('The original value cannot be zero')
  return ((to - from) / Math.abs(from)) * 100
}

/** The original value, given a result and the percentage that produced it. */
export function reversePercent(result: number, percent: number): number {
  requireFinite(result, 'The result')
  requireFinite(percent, 'The percentage')
  const factor = 1 + percent / 100
  if (factor === 0) throw new PercentageError('A change of -100% has no original value')
  return result / factor
}

/** Apply a discount percentage to a price. */
export function applyDiscount(price: number, discount: number): number {
  return price - percentOf(discount, price)
}

/** Add a markup percentage to a cost. */
export function applyMarkup(cost: number, markup: number): number {
  return cost + percentOf(markup, cost)
}

/** Split a total into parts by weight, as percentages that sum to 100. */
export function percentBreakdown(values: readonly number[]): number[] {
  if (values.length === 0) return []
  if (values.some((value) => !Number.isFinite(value))) throw new PercentageError('Every part must be a number')
  const total = values.reduce((sum, value) => sum + value, 0)
  if (total === 0) throw new PercentageError('The parts add up to zero')
  return values.map((value) => (value / total) * 100)
}

export interface MarginResult {
  margin: number
  markup: number
}

/** Margin (profit over revenue) and markup (profit over cost) for a price. */
export function marginAndMarkup(cost: number, price: number): MarginResult {
  requireFinite(cost, 'The cost')
  requireFinite(price, 'The price')
  const profit = price - cost
  if (price === 0) throw new PercentageError('The price cannot be zero')
  if (cost === 0) throw new PercentageError('The cost cannot be zero')
  return { margin: (profit / price) * 100, markup: (profit / cost) * 100 }
}

/** Round to a number of decimal places, avoiding float dust. */
export function round(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) throw new PercentageError('Cannot round a non-finite number')
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON * Math.sign(value)) * factor) / factor
}
