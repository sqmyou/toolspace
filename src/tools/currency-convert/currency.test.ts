import { describe, expect, it } from 'vitest'
import { convert, currenciesUrl, formatMoney, latestUrl, parseCurrencies, parseRates } from './currency'

describe('url builders', () => {
  it('points at the frankfurter api', () => {
    expect(currenciesUrl()).toBe('https://api.frankfurter.dev/v1/currencies')
  })

  it('builds a latest url with a base and symbols', () => {
    expect(latestUrl('USD', ['EUR', 'GBP'])).toBe('https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR%2CGBP')
  })

  it('omits symbols when none are given', () => {
    expect(latestUrl('EUR')).toBe('https://api.frankfurter.dev/v1/latest?base=EUR')
  })
})

describe('parseCurrencies', () => {
  it('reads the code-to-name map and sorts by code', () => {
    const list = parseCurrencies({ USD: 'United States Dollar', EUR: 'Euro', AUD: 'Australian Dollar' })
    expect(list.map((c) => c.code)).toEqual(['AUD', 'EUR', 'USD'])
    expect(list[0].name).toBe('Australian Dollar')
  })

  it('drops entries that are not three-letter codes', () => {
    expect(parseCurrencies({ USD: 'Dollar', notacode: 'Nope', EUR: 5 })).toEqual([{ code: 'USD', name: 'Dollar' }])
  })

  it('survives a malformed payload', () => {
    expect(parseCurrencies(null)).toEqual([])
    expect(parseCurrencies([])).toEqual([])
  })
})

describe('parseRates', () => {
  it('reads base, date and numeric rates', () => {
    const rates = parseRates({ amount: 1, base: 'USD', date: '2026-10-08', rates: { EUR: 0.89, GBP: 0.75, BAD: 'x' } })
    expect(rates.base).toBe('USD')
    expect(rates.date).toBe('2026-10-08')
    expect(rates.rates).toEqual({ EUR: 0.89, GBP: 0.75 })
  })

  it('survives a malformed payload', () => {
    expect(parseRates(null)).toEqual({ base: '', date: '', rates: {} })
  })
})

describe('convert', () => {
  it('multiplies the amount by the rate', () => {
    expect(convert(10, 0.9)).toBeCloseTo(9)
  })

  it('returns NaN for non-finite input rather than throwing', () => {
    expect(Number.isNaN(convert(Number.NaN, 2))).toBe(true)
    expect(Number.isNaN(convert(2, Number.POSITIVE_INFINITY))).toBe(true)
  })
})

describe('formatMoney', () => {
  it('formats a known currency', () => {
    expect(formatMoney(1234.5, 'USD')).toMatch(/1,234\.5/)
  })

  it('falls back to a plain number for an unknown code', () => {
    expect(formatMoney(12.5, 'ZZZ')).toMatch(/12\.5/)
  })

  it('renders a dash for a non-finite value', () => {
    expect(formatMoney(Number.NaN, 'USD')).toBe('\u2014')
  })
})
