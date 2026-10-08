/**
 * Descriptive statistics.
 *
 * Sample variance divides by n-1 and population variance by n, and the two are
 * kept as separate functions rather than a flag so the choice is visible at the
 * call site. Quartiles use linear interpolation between ranks, which matches
 * what a spreadsheet reports for the same data.
 */

export class StatsError extends Error {}

/** Parse a list of numbers from free text, ignoring separators and blanks. */
export function parseNumbers(input: string): number[] {
  const parts = input
    .split(/[\s,;]+/)
    .map((part) => part.trim())
    .filter(Boolean)
  const numbers: number[] = []
  for (const part of parts) {
    const value = Number(part)
    if (!Number.isFinite(value)) throw new StatsError(`"${part}" is not a number`)
    numbers.push(value)
  }
  if (numbers.length === 0) throw new StatsError('Enter at least one number')
  return numbers
}

function requireData(values: readonly number[], minimum = 1): void {
  if (values.length < minimum) throw new StatsError(`This needs at least ${minimum} ${minimum === 1 ? 'value' : 'values'}`)
  if (values.some((value) => !Number.isFinite(value))) throw new StatsError('Every value must be a finite number')
}

export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

export function mean(values: readonly number[]): number {
  requireData(values)
  return sum(values) / values.length
}

/** Middle value, or the average of the two middle values. */
export function median(values: readonly number[]): number {
  requireData(values)
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

/** Most frequent value. Ties resolve to the smallest value. */
export function mode(values: readonly number[]): number[] {
  requireData(values)
  const counts = new Map<number, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  const highest = Math.max(...counts.values())
  if (highest === 1) return []
  return [...counts.entries()].filter(([, count]) => count === highest).map(([value]) => value).sort((a, b) => a - b)
}

export function variance(values: readonly number[], sample = true): number {
  requireData(values, sample ? 2 : 1)
  const average = mean(values)
  const total = sum(values.map((value) => (value - average) ** 2))
  return total / (sample ? values.length - 1 : values.length)
}

export function standardDeviation(values: readonly number[], sample = true): number {
  return Math.sqrt(variance(values, sample))
}

/** Value at a percentile, interpolating between ranks. `p` is 0-100. */
export function percentile(values: readonly number[], p: number): number {
  requireData(values)
  if (!Number.isFinite(p) || p < 0 || p > 100) throw new StatsError('A percentile must be between 0 and 100')
  const sorted = [...values].sort((a, b) => a - b)
  const rank = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(rank)
  const upper = Math.ceil(rank)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (rank - lower)
}

export interface Quartiles {
  q1: number
  q2: number
  q3: number
  iqr: number
}

export function quartiles(values: readonly number[]): Quartiles {
  requireData(values)
  const q1 = percentile(values, 25)
  const q2 = percentile(values, 50)
  const q3 = percentile(values, 75)
  return { q1, q2, q3, iqr: q3 - q1 }
}

/** Values more than 1.5 IQR from the quartiles. */
export function outliers(values: readonly number[]): number[] {
  const { q1, q3, iqr } = quartiles(values)
  const low = q1 - 1.5 * iqr
  const high = q3 + 1.5 * iqr
  return values.filter((value) => value < low || value > high)
}

/** Fisher's measure of skewness; positive means a longer right tail. */
export function skewness(values: readonly number[]): number {
  requireData(values, 3)
  const average = mean(values)
  const sd = standardDeviation(values, false)
  if (sd === 0) return 0
  const total = sum(values.map((value) => ((value - average) / sd) ** 3))
  return (values.length / ((values.length - 1) * (values.length - 2))) * total
}

/** Excess kurtosis; 0 is a normal distribution. */
export function kurtosis(values: readonly number[]): number {
  requireData(values, 4)
  const average = mean(values)
  const sd = standardDeviation(values, false)
  if (sd === 0) return 0
  const n = values.length
  const total = sum(values.map((value) => ((value - average) / sd) ** 4))
  return (n * (n + 1) * total) / ((n - 1) * (n - 2) * (n - 3)) - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3))
}

export function geometricMean(values: readonly number[]): number {
  requireData(values)
  if (values.some((value) => value <= 0)) throw new StatsError('The geometric mean needs positive values')
  return Math.exp(sum(values.map((value) => Math.log(value))) / values.length)
}

export function harmonicMean(values: readonly number[]): number {
  requireData(values)
  if (values.some((value) => value === 0)) throw new StatsError('The harmonic mean cannot include zero')
  return values.length / sum(values.map((value) => 1 / value))
}

/** How many standard deviations each value sits from the mean. */
export function zScores(values: readonly number[]): number[] {
  requireData(values, 2)
  const average = mean(values)
  const sd = standardDeviation(values, true)
  if (sd === 0) return values.map(() => 0)
  return values.map((value) => (value - average) / sd)
}

export interface Summary {
  count: number
  sum: number
  min: number
  max: number
  range: number
  mean: number
  median: number
  mode: number[]
  varianceSample: number
  variancePopulation: number
  standardDeviationSample: number
  standardDeviationPopulation: number
  quartiles: Quartiles
  skewness: number | null
  kurtosis: number | null
  geometricMean: number | null
  harmonicMean: number | null
}

/** Everything the tool shows, in one pass. */
export function summarise(values: readonly number[]): Summary {
  requireData(values)
  const sorted = [...values].sort((a, b) => a - b)
  const positive = values.every((value) => value > 0)
  const nonZero = values.every((value) => value !== 0)
  return {
    count: values.length,
    sum: sum(values),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    range: sorted[sorted.length - 1] - sorted[0],
    mean: mean(values),
    median: median(values),
    mode: mode(values),
    varianceSample: values.length >= 2 ? variance(values, true) : 0,
    variancePopulation: variance(values, false),
    standardDeviationSample: values.length >= 2 ? standardDeviation(values, true) : 0,
    standardDeviationPopulation: standardDeviation(values, false),
    quartiles: quartiles(values),
    skewness: values.length >= 3 ? skewness(values) : null,
    kurtosis: values.length >= 4 ? kurtosis(values) : null,
    geometricMean: positive ? geometricMean(values) : null,
    harmonicMean: nonZero ? harmonicMean(values) : null,
  }
}
