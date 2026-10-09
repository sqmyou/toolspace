/**
 * Currency conversion via the Frankfurter API (European Central Bank rates).
 *
 * A *network* tool: it fetches the reference rates you ask for, so it declares
 * itself with `remote`. All the arithmetic and formatting here is pure, so it
 * can be tested without the network.
 */

const API = 'https://api.frankfurter.dev/v1'

/** Every supported currency, as `code -> English name`. */
export function currenciesUrl(): string {
  return `${API}/currencies`
}

/** The latest rates for a base currency, optionally limited to some symbols. */
export function latestUrl(base: string, symbols: string[] = []): string {
  const query = new URLSearchParams({ base })
  if (symbols.length) query.set('symbols', symbols.join(','))
  return `${API}/latest?${query.toString()}`
}

export interface Currency {
  code: string
  name: string
}

/** Parse the currencies payload into a sorted list. Pure. */
export function parseCurrencies(payload: unknown): Currency[] {
  if (typeof payload !== 'object' || payload === null) return []
  return Object.entries(payload as Record<string, unknown>)
    .filter(([code, name]) => /^[A-Z]{3}$/.test(code) && typeof name === 'string')
    .map(([code, name]) => ({ code, name: name as string }))
    .sort((a, b) => a.code.localeCompare(b.code))
}

export interface Rates {
  base: string
  date: string
  rates: Record<string, number>
}

/** Parse the latest-rates payload. Pure. */
export function parseRates(payload: unknown): Rates {
  const data = (payload ?? {}) as { base?: unknown; date?: unknown; rates?: unknown }
  const rates: Record<string, number> = {}
  if (typeof data.rates === 'object' && data.rates !== null) {
    for (const [code, value] of Object.entries(data.rates as Record<string, unknown>)) {
      if (typeof value === 'number') rates[code] = value
    }
  }
  return {
    base: typeof data.base === 'string' ? data.base : '',
    date: typeof data.date === 'string' ? data.date : '',
    rates,
  }
}

/** Convert an amount using a rate of "units of target per one unit of base". */
export function convert(amount: number, rate: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(rate)) return Number.NaN
  return amount * rate
}

/**
 * Format a value in a currency, falling back to a plain number when the code
 * is not one `Intl` knows (which is not an error worth showing).
 */
export function formatMoney(value: number, code: string): string {
  if (!Number.isFinite(value)) return '\u2014'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(value)
  } catch {
    return value.toLocaleString(undefined, { maximumFractionDigits: 4 })
  }
}
